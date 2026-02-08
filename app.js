import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАЛАШТУВАННЯ ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA"; // <--- ДОДАЙ ЦЕ

// --- ЛОГІКА МЕНЮ ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menu-overlay');
const burgerBtn = document.getElementById('burger-btn');
const pageTitle = document.getElementById('page-title');
const navLinks = document.querySelectorAll('.nav-link');

function toggleMenu(open) {
    if (open) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

burgerBtn.onclick = () => toggleMenu(true);
overlay.onclick = () => toggleMenu(false);

navLinks.forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');
        
        // Ховаємо всі сторінки, показуємо потрібну
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${targetId}`).classList.remove('hidden');
        
        // Оновлюємо заголовок і активне посилання
        pageTitle.innerText = link.innerText.trim();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        toggleMenu(false); // Закриваємо меню на мобільному
    };
});


// --- ОСНОВНА ЛОГІКА ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout-menu').onclick = () => signOut(auth);

    // Публікація поста
    document.getElementById('btn-publish').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        const file = document.getElementById('post-file-input').files[0];
        if (!txt && !file) return;

        let imgData = null;
        if (file) {
            const reader = new FileReader();
            imgData = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
        }

        await addDoc(collection(db, "posts"), {
            text: txt, image: imgData,
            uid: auth.currentUser.uid, name: auth.currentUser.displayName,
            createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
        document.getElementById('post-file-input').value = "";
    };

    // Відправка в чат
    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value, uid: auth.currentUser.uid,
            name: auth.currentUser.displayName, createdAt: serverTimestamp()
        });
        input.value = "";
    };
});

// Функція видалення
window.deleteItem = async (col, id) => {
    if (confirm("Видалити?")) await deleteDoc(doc(db, col, id));
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        // Заповнюємо дані в меню та профілі
        document.getElementById('menu-avatar').src = user.photoURL;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-avatar-big').src = user.photoURL;
        document.getElementById('profile-name-big').innerText = user.displayName;

        const isAdmin = ADMINS.includes(user.uid);
        loadFeed(isAdmin);
        loadChat(isAdmin);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadFeed(isAdmin) {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const container = document.getElementById('feed-container');
        container.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const canDel = isAdmin || p.uid === auth.currentUser.uid;
            container.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        ${p.name}
                        ${canDel ? `<i class="fas fa-trash del-post-btn" onclick="deleteItem('posts', '${d.id}')"></i>` : ''}
                    </div>
                    <div class="post-text">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

function loadChat(isAdmin) {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            const canDel = isAdmin || isMe;
            chat.innerHTML += `
                <div class="msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}">
                    <div class="msg-bubble">
                        ${canDel ? `<div class="msg-del" onclick="deleteItem('messages', '${d.id}')">×</div>` : ''}
                        ${!isMe ? `<div class="msg-sender">${m.name}</div>` : ''}
                        <div>${m.text}</div>
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
