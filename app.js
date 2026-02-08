import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentChatFriendId = null;

// Стиснення фото
async function compressImage(file, maxWidth = 800) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = maxWidth / img.width;
                canvas.width = maxWidth; canvas.height = img.height * ratio;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// Навігація
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
    if(pageId === 'contacts') loadAllUsers();
    if(pageId === 'friends') loadFriends();
};

document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};

// --- ФУНКЦІЇ СОЦМЕРЕЖІ ---

// Лайк
window.toggleLike = async (postId, likes) => {
    const ref = doc(db, "posts", postId);
    const uid = auth.currentUser.uid;
    if (likes.includes(uid)) {
        await updateDoc(ref, { likes: arrayRemove(uid) });
    } else {
        await updateDoc(ref, { likes: arrayUnion(uid) });
    }
};

// Коментар
window.addComment = async (postId) => {
    const inp = document.getElementById(`comment-in-${postId}`);
    if (!inp.value.trim()) return;
    await updateDoc(doc(db, "posts", postId), {
        comments: arrayUnion({
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            text: inp.value
        })
    });
    inp.value = "";
};

// Підписка
window.toggleFollow = async (targetUid) => {
    const myRef = doc(db, "users", auth.currentUser.uid);
    const userDoc = await getDoc(myRef);
    const following = userDoc.data().following || [];
    
    if (following.includes(targetUid)) {
        await updateDoc(myRef, { following: arrayRemove(targetUid) });
    } else {
        await updateDoc(myRef, { following: arrayUnion(targetUid) });
    }
};

// Завантаження постів
function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const liked = p.likes?.includes(auth.currentUser.uid) ? 'liked' : '';
            cont.innerHTML += `
                <div class="post-card">
                    <b>${p.name}</b>
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                    <div class="post-actions">
                        <span class="action-btn ${liked}" onclick="toggleLike('${d.id}', ${JSON.stringify(p.likes || [])})"><i class="fas fa-heart"></i> ${p.likes?.length || 0}</span>
                        <span class="action-btn"><i class="fas fa-comment"></i> ${p.comments?.length || 0}</span>
                        <span class="action-btn" onclick="alert('Репостнуто!')"><i class="fas fa-share"></i></span>
                    </div>
                    <div class="comment-section">
                        ${(p.comments || []).map(c => `<div><b>${c.name}:</b> ${c.text}</div>`).join('')}
                        <input type="text" id="comment-in-${d.id}" class="comment-input" placeholder="Написати коментар..." onkeydown="if(event.key==='Enter') addComment('${d.id}')">
                    </div>
                </div>`;
        });
    });
}

// Знайти людей
function loadAllUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('all-users-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            if (d.id === auth.currentUser.uid) return;
            const u = d.data();
            cont.innerHTML += `
                <div class="contact-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${u.customAvatar || 'https://ui-avatars.com/api/?name='+u.displayName}" style="width:40px; height:40px; border-radius:50%">
                        <span>${u.displayName}</span>
                    </div>
                    <button class="chat-btn" onclick="toggleFollow('${d.id}')">Підписатися</button>
                </div>`;
        });
    });
}

// Завантаження друзів та логіка чату
async function loadFriends() {
    const myDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const following = myDoc.data().following || [];
    const cont = document.getElementById('friends-container');
    cont.innerHTML = '';

    onSnapshot(collection(db, "users"), (snap) => {
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            const followers = u.following || [];
            // Взаємна підписка
            if (following.includes(d.id) && followers.includes(auth.currentUser.uid)) {
                cont.innerHTML += `
                    <div class="contact-item">
                        <span>${u.displayName}</span>
                        <button class="chat-btn" onclick="openPrivateChat('${d.id}', '${u.displayName}')">Чат</button>
                    </div>`;
            }
        });
    });
}

window.openPrivateChat = (friendId, name) => {
    currentChatFriendId = friendId;
    showPage('private-chat');
    document.getElementById('page-title').innerText = "Чат з " + name;
    loadMessages();
};

function loadMessages() {
    const chatId = [auth.currentUser.uid, currentChatFriendId].sort().join('_');
    onSnapshot(query(collection(db, "direct_messages"), where("chatId", "==", chatId), orderBy("createdAt", "asc")), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.senderId === auth.currentUser.uid;
            box.innerHTML += `<div style="align-self:${isMe?'flex-end':'flex-start'}; background:${isMe?'var(--msg-out)':'var(--msg-in)'}; padding:10px; border-radius:10px; max-width:80%;">${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

document.getElementById('btn-send-chat').onclick = async () => {
    const inp = document.getElementById('chat-input');
    if (!inp.value.trim() || !currentChatFriendId) return;
    const chatId = [auth.currentUser.uid, currentChatFriendId].sort().join('_');
    await addDoc(collection(db, "direct_messages"), {
        chatId, text: inp.value, senderId: auth.currentUser.uid, createdAt: serverTimestamp()
    });
    inp.value = "";
};

// Публікація поста
document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text').value;
    const file = document.getElementById('post-file-input').files[0];
    const btn = document.getElementById('btn-publish');
    btn.disabled = true;
    let img = file ? await compressImage(file) : null;
    await addDoc(collection(db, "posts"), {
        text: txt, image: img, uid: auth.currentUser.uid, name: auth.currentUser.displayName,
        likes: [], comments: [], createdAt: serverTimestamp()
    });
    document.getElementById('post-text').value = "";
    btn.disabled = false;
};

// Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        await setDoc(doc(db, "users", user.uid), { displayName: user.displayName, email: user.email }, { merge: true });
        const uDoc = await getDoc(doc(db, "users", user.uid));
        const av = uDoc.data()?.customAvatar || user.photoURL;
        document.getElementById('menu-avatar').src = av;
        document.getElementById('menu-username').innerText = user.displayName;
        loadFeed();
    }
});

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
