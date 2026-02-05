import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. ПЕРЕМИКАННЯ СТОРІНОК (Силове)
const showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${id}`);
    if (target) target.classList.remove('hidden');
    window.scrollTo(0,0);
};

// 2. ПРИВ'ЯЗКА КНОПОК
document.addEventListener('DOMContentLoaded', () => {
    
    // Навігація
    document.getElementById('nav-feed').onclick = () => showPage('feed');
    document.getElementById('nav-search').onclick = () => showPage('search');
    document.getElementById('nav-messages').onclick = () => showPage('messages');
    document.getElementById('nav-profile').onclick = () => showPage('profile');
    document.getElementById('direct-icon').onclick = () => showPage('messages');
    document.getElementById('logo-home').onclick = () => showPage('feed');

    // Авторизація
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    // Пости
    document.getElementById('btn-post').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        const img = document.getElementById('post-img-url').value;
        if (!txt.trim()) return;

        await addDoc(collection(db, "posts"), {
            text: txt,
            image: img || null,
            userName: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
        document.getElementById('post-img-url').value = "";
    };

    // Чат
    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value,
            senderId: auth.currentUser.uid,
            senderName: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        input.value = "";
    };
});

// 3. СТАН КОРИСТУВАЧА
onAuthStateChanged(auth, (user) => {
    const authUI = document.getElementById('auth-container');
    const appUI = document.getElementById('app-container');
    if (user) {
        authUI.classList.add('hidden');
        appUI.classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        loadData();
    } else {
        authUI.classList.remove('hidden');
        appUI.classList.add('hidden');
    }
});

function loadData() {
    // Стрічка
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><img src="${p.avatar}" class="nav-thumb"> <b>${p.userName}</b></div>
                    <div class="post-content-text">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" style="width:100%; display:block">` : ''}
                </div>`;
        });
    });

    // Чат
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const mine = m.senderId === auth.currentUser.uid;
            chat.innerHTML += `
                <div class="msg-wrapper ${mine ? 'my-msg' : 'other-msg'}">
                    <div class="msg-bubble"><small>${m.senderName}</small><p>${m.text}</p></div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
