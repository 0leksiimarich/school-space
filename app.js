import { auth, db, googleProvider } from './firebase.js';
import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАЛАШТУВАННЯ АДМІНІВ ---
const ADMINS = ['ТВІЙ_UID_ТУТ']; // Сюди впиши свій UID з консолі

// Функція видалення
window.deleteMsg = async (id) => {
    if (confirm("Видалити це повідомлення?")) {
        await deleteDoc(doc(db, "messages", id));
    }
};

const fileToText = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
});

document.addEventListener('DOMContentLoaded', () => {
    // Навігація
    const showPage = (id) => {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${id}`).classList.remove('hidden');
    };

    document.getElementById('nav-feed').onclick = () => showPage('feed');
    document.getElementById('nav-messages').onclick = () => showPage('messages');
    document.getElementById('nav-profile').onclick = () => showPage('profile');

    // Фото для поста
    let selectedFile = null;
    const fileInput = document.getElementById('post-file');
    document.getElementById('btn-add-photo').onclick = () => fileInput.click();
    fileInput.onchange = (e) => { selectedFile = e.target.files[0]; };

    // Публікація поста
    document.getElementById('btn-post').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        if (!txt.trim() && !selectedFile) return;
        let img = selectedFile ? await fileToText(selectedFile) : null;
        await addDoc(collection(db, "posts"), {
            text: txt, image: img,
            userName: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
        selectedFile = null;
    };

    // Відправка повідомлення (Telegram Style)
    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value,
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        input.value = "";
    };

    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Твій UID для списку ADMINS:", user.uid); // Скопіюй це з консолі
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadData();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadData() {
    // Пости
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            feed.innerHTML += `<div class="post-card">
                <b>${p.userName}</b><p>${p.text}</p>
                ${p.image ? `<img src="${p.image}" style="width:100%">` : ''}
            </div>`;
        });
    });

    // Чат (Telegram Style)
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            const isAdmin = ADMINS.includes(auth.currentUser.uid);
            
            chat.innerHTML += `
                <div class="msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}">
                    <img src="${m.avatar}" class="chat-av">
                    <div class="msg-bubble">
                        <div class="msg-info"><b>${m.name}</b> ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}</div>
                        <p>${m.text}</p>
                        ${(isMe || isAdmin) ? `<span class="del-btn" onclick="deleteMsg('${d.id}')">×</span>` : ''}
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
