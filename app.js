// 1. ІМПОРТИ
import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// --- 2. ТВОЇ НАЛАШТУВАННЯ ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// --- 3. БУРГЕР-МЕНЮ ТА НАВІГАЦІЯ ---
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

if (burgerBtn) burgerBtn.onclick = () => toggleMenu(true);
if (overlay) overlay.onclick = () => toggleMenu(false);

navLinks.forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');
        
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${targetId}`).classList.remove('hidden');
        
        pageTitle.innerText = link.innerText.trim();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        toggleMenu(false);
    };
});

// --- 4. WEB PUSH СПОВІЩЕННЯ ---
async function setupNotifications(user) {
    try {
        const messaging = getMessaging();
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        
        const token = await getToken(messaging, { 
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY 
        });

        if (token) {
            console.log("Токен отримано!");
            await setDoc(doc(db, "users", user.uid), {
                fcmToken: token,
                name: user.displayName
            }, { merge: true });
        }

        onMessage(messaging, (payload) => {
            console.log("Message received: ", payload);
            alert(`Нове повідомлення: ${payload.notification.body}`);
        });
    } catch (e) { console.warn("Сповіщення не активовано:", e); }
}

// --- 5. ФУНКЦІЇ ДЛЯ КОНТЕНТУ ---

// Публікація в стрічку
async function publishPost() {
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
}

// Відправка в чат
async function sendMessage() {
    const input = document.getElementById('msg-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "messages"), {
        text: input.value, uid: auth.currentUser.uid,
        name: auth.currentUser.displayName, createdAt: serverTimestamp()
    });
    input.value = "";
}

window.deleteItem = async (col, id) => {
    if (confirm("Видалити?")) await deleteDoc(doc(db, col, id));
};

// --- 6. ОБРОБНИКИ ПОДІЙ ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout-menu').onclick = () => signOut(auth);
    document.getElementById('btn-publish').onclick = publishPost;
    document.getElementById('btn-send-msg').onclick = sendMessage;
    document.getElementById('msg-input').onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };
});

// --- 7. СТАН КОРИСТУВАЧА ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        document.getElementById('menu-avatar').src = user.photoURL;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-avatar-big').src = user.photoURL;
        document.getElementById('profile-name-big').innerText = user.displayName;

        const isAdmin = ADMINS.includes(user.uid);
        loadFeed(isAdmin);
        loadChat(isAdmin);
        setupNotifications(user);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- 8. ЗАВАНТАЖЕННЯ ДАНИХ ---
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
                        <strong>${p.name}</strong>
                        ${canDel ? `<i class="fas fa-trash del-post-btn" onclick="deleteItem('posts', '${d.id}')"></i>` : ''}
                    </div>
                    <p>${p.text}</p>
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
            const isMe = auth.currentUser && m.uid === auth.currentUser.uid;
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
