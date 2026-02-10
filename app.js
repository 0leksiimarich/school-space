import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; 

// --- ФУНКЦІЇ ВИДАЛЕННЯ ---
window.deletePost = async (id) => {
    if(confirm("Видалити пост?")) await deleteDoc(doc(db, "posts", id));
};

window.deleteChatMsg = async (id) => {
    if(confirm("Видалити повідомлення?")) await deleteDoc(doc(db, "chat", id));
};

window.unbanUser = async (id) => {
    if(confirm("Розбанити?")) await updateDoc(doc(db, "users", id), { banned: false });
};

// --- СИНХРОНІЗАЦІЯ ПРОФІЛЮ ---
async function syncProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, banned: false });
    }
}

// --- СТИСНЕННЯ ФОТО ---
async function compress(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 600; canvas.height = img.height * (600 / img.width);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- ЧАТ ---
function loadChat() {
    const q = query(collection(db, "chat"), orderBy("at", "asc"), limit(60));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('chat-messages');
        cont.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser?.uid;
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            cont.innerHTML += `
                <div class="msg ${isMe ? 'me' : 'other'}" ${isAdmin ? `onclick="deleteChatMsg('${d.id}')"` : ''}>
                    <div class="msg-info">${m.name}</div>
                    <div>${m.text}</div>
                </div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "chat"), {
        uid: auth.currentUser.uid, name: auth.currentUser.displayName,
        text: input.value, at: serverTimestamp()
    });
    input.value = '';
}

// --- СТРІЧКА ТА КОМЕНТАРІ ---
window.toggleLike = async (id, liked) => {
    await updateDoc(doc(db, "posts", id), {
        likes: liked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
    });
};

window.addComment = async (id) => {
    const input = document.getElementById(`in-${id}`);
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    await updateDoc(doc(db, "posts", id), {
        comments: arrayUnion({ name: auth.currentUser.displayName, text: val, at: Date.now() })
    });
};

function loadFeed(search = "") {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (search && !p.text.toLowerCase().includes(search.toLowerCase())) return;

            const isLiked = p.likes?.includes(auth.currentUser.uid);
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            const cmnts = (p.comments || []).map(c => `<div><b>${c.name}:</b> ${c.text}</div>`).join('');

            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv || 'https://ui-avatars.com/api/?name='+p.name}" class="post-author-av">
                        <div style="flex-grow:1"><b>${p.name}</b></div>
                        ${isAdmin ? `<i class="fas fa-trash-alt delete-btn" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <div style="white-space:pre-wrap">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                    <div class="post-actions">
                        <div class="action-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${d.id}', ${isLiked})">
                            <i class="fa${isLiked ? 's' : 'r'} fa-heart"></i> ${p.likes?.length || 0}
                        </div>
                        <div class="action-btn"><i class="far fa-comment"></i> ${p.comments?.length || 0}</div>
                    </div>
                    <div class="comment-box">${cmnts}</div>
                    <input type="text" id="in-${d.id}" class="comment-input" placeholder="Коментувати..." onkeydown="if(event.key==='Enter') addComment('${d.id}')">
                </div>`;
        });
    });
}

// --- СИСТЕМА ---
onAuthStateChanged(auth, async (u) => {
    if (u) {
        await syncProfile(u);
        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (uSnap.data()?.banned) {
            document.getElementById('ban-screen').classList.remove('hidden');
            return;
        }
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('menu-avatar').src = u.photoURL;
        document.getElementById('menu-username').innerText = u.displayName;
        document.getElementById('profile-avatar-big').src = u.photoURL;
        document.getElementById('profile-name-big').innerText = u.displayName;

        if (u.uid === ADMIN_UID) {
            document.getElementById('admin-link').style.display = 'flex';
            onSnapshot(collection(db, "users"), s => {
                const bList = document.getElementById('banned-list');
                bList.innerHTML = '';
                s.forEach(userDoc => {
                    if(userDoc.data().banned) bList.innerHTML += `<div class="post-card" style="display:flex; justify-content:space-between"><span>${userDoc.data().displayName}</span><button class="tg-btn-small" onclick="unbanUser('${userDoc.id}')">Розбан</button></div>`;
                });
            });
        }
        loadFeed(); loadChat();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('btn-send-chat').onclick = sendChat;
document.getElementById('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendChat(); };
document.getElementById('search-input').oninput = (e) => loadFeed(e.target.value);

// ПУБЛІКАЦІЯ З ОЧИЩЕННЯМ ФОТО
document.getElementById('btn-publish').onclick = async () => {
    const tIn = document.getElementById('post-text');
    const fIn = document.getElementById('post-file-input');
    const btn = document.getElementById('btn-publish');

    if (!tIn.value.trim() && !fIn.files[0]) return;
    btn.disabled = true;
    let imgData = fIn.files[0] ? await compress(fIn.files[0]) : null;

    await addDoc(collection(db, "posts"), {
        text: tIn.value, image: imgData, name: auth.currentUser.displayName,
        uid: auth.currentUser.uid, authorAv: auth.currentUser.photoURL,
        createdAt: serverTimestamp(), likes: [], comments: []
    });

    tIn.value = ''; 
    fIn.value = ''; // КЛЮЧОВИЙ ФІКС БАГУ
    btn.disabled = false;
};

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};

document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};
