import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; 
let isInitialLoad = true;

// --- СИНХРОНІЗАЦІЯ ПРОФІЛЮ (ФІКС БАГУ) ---
async function syncProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            banned: false
        });
    }
}

// --- ЛОГІКА ЧАТУ ---
function loadChat() {
    const q = query(collection(db, "chat"), orderBy("at", "asc"), limit(100));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('chat-messages');
        cont.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            cont.innerHTML += `
                <div class="msg ${isMe ? 'me' : 'other'}">
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
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName,
        text: input.value,
        at: serverTimestamp()
    });
    input.value = '';
}

// --- ПОСТИ, ЛАЙКИ, КОМЕНТАРІ ---
window.toggleLike = async (id, liked) => {
    await updateDoc(doc(db, "posts", id), {
        likes: liked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
    });
};

window.addComment = async (id) => {
    const input = document.getElementById(`in-${id}`);
    if (!input.value.trim()) return;
    const text = input.value;
    input.value = ''; 
    await updateDoc(doc(db, "posts", id), {
        comments: arrayUnion({
            name: auth.currentUser.displayName,
            text: text,
            at: Date.now()
        })
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
            const cmnts = (p.comments || []).map(c => `<div class="comment-item"><b>${c.name}:</b> ${c.text}</div>`).join('');

            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv || 'https://ui-avatars.com/api/?name='+p.name}" class="post-author-av">
                        <b>${p.name}</b>
                    </div>
                    <div style="white-space:pre-wrap">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                    <div class="post-actions">
                        <div class="action-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${d.id}', ${isLiked})">
                            <i class="fa${isLiked ? 's' : 'r'} fa-heart"></i> ${p.likes?.length || 0}
                        </div>
                        <div class="action-btn"><i class="far fa-comment"></i> ${p.comments?.length || 0}</div>
                    </div>
                    <div class="comment-box">
                        ${cmnts}
                        <input type="text" id="in-${d.id}" class="comment-input" placeholder="Написати коментар..." onkeydown="if(event.key==='Enter') addComment('${d.id}')">
                    </div>
                </div>`;
        });
    });
}

// --- АВТОРИЗАЦІЯ ТА СИСТЕМА ---
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

        if (u.uid === ADMIN_UID) document.getElementById('admin-link').style.display = 'flex';
        
        loadFeed();
        loadChat();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// Обробники подій
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('btn-send-chat').onclick = sendChat;
document.getElementById('chat-input').onkeydown = (e) => { if(e.key === 'Enter') sendChat(); };
document.getElementById('search-input').oninput = (e) => loadFeed(e.target.value);

document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text').value;
    const file = document.getElementById('post-file-input').files[0];
    if (!txt.trim() && !file) return;
    
    let imgData = null;
    if (file) {
        const reader = new FileReader();
        imgData = await new Promise(r => {
            reader.onload = e => r(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    await addDoc(collection(db, "posts"), {
        text: txt, image: imgData, name: auth.currentUser.displayName,
        uid: auth.currentUser.uid, authorAv: auth.currentUser.photoURL,
        createdAt: serverTimestamp(), likes: [], comments: []
    });
    document.getElementById('post-text').value = '';
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
