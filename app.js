import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; 

// --- ПЕРЕМИКАННЯ СТОРІНОК ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${id}`);
    if(targetPage) targetPage.classList.remove('hidden');
    
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};

// --- СПИСОК УЧАСНИКІВ ---
function loadUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('users-list');
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            cont.innerHTML += `
                <div class="user-row">
                    <img src="${u.photoURL || 'https://ui-avatars.com/api/?name='+u.displayName}" style="width:40px; height:40px; border-radius:50%;">
                    <div>
                        <div style="font-weight:bold">${u.displayName}</div>
                        <div style="font-size:12px; color:var(--text-sec)">${u.uid === ADMIN_UID ? 'Адміністратор' : 'Учень'}</div>
                    </div>
                </div>`;
        });
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
            cont.innerHTML += `
                <div class="msg ${isMe ? 'me' : 'other'}">
                    <div style="font-size:10px; opacity:0.6">${m.name}</div>
                    <div>${m.text}</div>
                </div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

// --- СТРІЧКА ---
function loadFeed(search = "") {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (search && !p.text.toLowerCase().includes(search.toLowerCase())) return;
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv}" class="post-author-av">
                        <b>${p.name}</b>
                        ${isAdmin ? `<i class="fas fa-trash delete-btn" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <div style="white-space:pre-wrap">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

// --- СИСТЕМА ---
onAuthStateChanged(auth, async (u) => {
    if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, banned: false });
        } else if (snap.data().banned) {
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
        loadUsers(); // Завантажуємо список учасників
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// Обробники
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};
document.getElementById('menu-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};
document.getElementById('btn-send-chat').onclick = async () => {
    const inp = document.getElementById('chat-input');
    if(!inp.value.trim()) return;
    await addDoc(collection(db, "chat"), { uid: auth.currentUser.uid, name: auth.currentUser.displayName, text: inp.value, at: serverTimestamp() });
    inp.value = '';
};

// Видалення
window.deletePost = async (id) => { if(confirm("Видалити?")) await deleteDoc(doc(db, "posts", id)); };
