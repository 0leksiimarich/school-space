import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// --- ТВОЇ ДАНІ ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// Елементи інтерфейсу
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menu-overlay');
const burgerBtn = document.getElementById('burger-btn');
const pageTitle = document.getElementById('page-title');
const navLinks = document.querySelectorAll('.nav-link');

// 1. ЛОГІКА МЕНЮ
function toggleMenu(open) {
    if (open) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// 2. ІНІЦІАЛІЗАЦІЯ КНОПОК (Оживляємо їх)
function bindButtons() {
    if (burgerBtn) burgerBtn.onclick = () => toggleMenu(true);
    if (overlay) overlay.onclick = () => toggleMenu(false);

    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) btnGoogle.onclick = () => signInWithPopup(auth, googleProvider);

    const btnLogout = document.getElementById('btn-logout-menu');
    if (btnLogout) btnLogout.onclick = () => signOut(auth);

    const btnPublish = document.getElementById('btn-publish');
    if (btnPublish) btnPublish.onclick = publishPost;

    const btnSendMsg = document.getElementById('btn-send-msg');
    if (btnSendMsg) btnSendMsg.onclick = sendMessage;

    const msgInput = document.getElementById('msg-input');
    if (msgInput) {
        msgInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    }

    navLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            switchPage(target, link.innerText.trim());
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            toggleMenu(false);
        };
    });
}

function switchPage(id, title) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    pageTitle.innerText = title;
}

// 3. WEB PUSH
async function setupPush(user) {
    try {
        const messaging = getMessaging();
        const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        const token = await getToken(messaging, { serviceWorkerRegistration: reg, vapidKey: VAPID_KEY });
        if (token) {
            await setDoc(doc(db, "users", user.uid), { fcmToken: token, name: user.displayName }, { merge: true });
        }
    } catch (e) { console.warn("Пуші не активні"); }
}

// 4. КОНТЕНТ (Пости / Чат)
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
        text: txt, image: imgData, uid: auth.currentUser.uid,
        name: auth.currentUser.displayName, createdAt: serverTimestamp()
    });
    document.getElementById('post-text').value = "";
    document.getElementById('post-file-input').value = "";
}

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

// 5. МОНІТОРИНГ СТАНУ
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
        setupPush(user);
        bindButtons(); // Переприв'язуємо кнопки після входу
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        bindButtons(); // Переприв'язуємо для кнопки входу
    }
});

// 6. ЗАВАНТАЖЕННЯ ДАНИХ
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
                        ${canDel ? `<i class="fas fa-trash" onclick="deleteItem('posts', '${d.id}')" style="cursor:pointer;color:#ec3942"></i>` : ''}
                    </div>
                    <div>${p.text}</div>
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
                        ${!isMe ? `<div style="font-size:12px;color:#40a7e3;font-weight:bold">${m.name}</div>` : ''}
                        <div>${m.text}</div>
                        ${canDel ? `<div class="msg-del" onclick="deleteItem('messages', '${d.id}')">Видалити</div>` : ''}
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}

// Запуск при завантаженні
bindButtons();
