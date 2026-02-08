import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// --- ТВОЇ НАЛАШТУВАННЯ ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// --- 1. СИСТЕМА СПОВІЩЕНЬ (PUSH) ---
async function setupNotifications(user) {
    try {
        const messaging = getMessaging();
        
        // Реєстрація сервіс-воркера
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        
        // Отримання токена
        const token = await getToken(messaging, { 
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY 
        });

        if (token) {
            console.log("Токен сповіщень отримано ✅");
            await setDoc(doc(db, "users", user.uid), {
                fcmToken: token,
                lastSeen: serverTimestamp()
            }, { merge: true });
        }

        // Слухач повідомлень, коли сайт відкритий
        onMessage(messaging, (payload) => {
            alert(`SchoolSpace: ${payload.notification.body}`);
        });

    } catch (error) {
        console.warn("Сповіщення не активовано (можливо, заборонено в браузері):", error);
    }
}

// --- 2. ЛОГІКА ТЕМИ (СВІТЛА/ТЕМНА) ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.className = savedTheme;
    
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = () => {
            const newTheme = document.body.classList.contains('dark-theme') ? 'light-theme' : 'dark-theme';
            document.body.className = newTheme;
            localStorage.setItem('theme', newTheme);
        };
    }
}

// --- 3. НАВІГАЦІЯ ТА МЕНЮ ---
function bindNav() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menu-overlay');
    const burgerBtn = document.getElementById('burger-btn');

    if (burgerBtn) burgerBtn.onclick = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
    if (overlay) overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };

    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.getElementById(`page-${target}`).classList.remove('hidden');
            document.getElementById('page-title').innerText = link.innerText.trim();
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            sidebar.classList.remove('active');
            overlay.classList.remove('active');

            if (target === 'profile') loadMyPosts();
        };
    });
}

// --- 4. АВАТАРКИ ТА ПРОФІЛЬ ---
window.setEmojiAvatar = async (emoji) => {
    const user = auth.currentUser;
    const url = `https://ui-avatars.com/api/?name=${emoji}&background=random&size=128`;
    await setDoc(doc(db, "users", user.uid), { customAvatar: url }, { merge: true });
    updateUserInfo(user);
    document.getElementById('emoji-picker').classList.add('hidden');
};

async function updateUserInfo(user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const avatar = (userDoc.exists() && userDoc.data().customAvatar) ? userDoc.data().customAvatar : user.photoURL;
    
    document.getElementById('menu-avatar').src = avatar;
    document.getElementById('profile-avatar-big').src = avatar;
    document.getElementById('menu-username').innerText = user.displayName;
    document.getElementById('profile-name-big').innerText = user.displayName;
}

// --- 5. КОНТЕНТ (ПОСТИ ТА ЧАТ) ---
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
        text: input.value, 
        uid: auth.currentUser.uid, 
        name: auth.currentUser.displayName, 
        createdAt: serverTimestamp() 
    });
    input.value = "";
}

window.deleteItem = async (col, id) => {
    if (confirm("Видалити цей запис?")) await deleteDoc(doc(db, col, id));
};

// --- 6. МОНІТОРИНГ ТА ЗАВАНТАЖЕННЯ ДАНИХ ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        updateUserInfo(user);
        setupNotifications(user); // Активуємо пуші
        loadFeed(ADMINS.includes(user.uid));
        loadChat();
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
            const canDel = isAdmin || (auth.currentUser && p.uid === auth.currentUser.uid);
            container.innerHTML += `
                <div class="post-card">
                    <div style="display:flex; justify-content:space-between">
                        <strong>${p.name}</strong>
                        ${canDel ? `<i class="fas fa-trash" onclick="deleteItem('posts', '${d.id}')" style="color:red; cursor:pointer"></i>` : ''}
                    </div>
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

function loadMyPosts() {
    const container = document.getElementById('my-posts-container');
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        container.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (auth.currentUser && p.uid === auth.currentUser.uid) {
                container.innerHTML += `
                    <div class="post-card">
                        <p>${p.text}</p>
                        ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                        <div style="text-align:right; color:red; font-size:12px; cursor:pointer" onclick="deleteItem('posts', '${d.id}')">Видалити</div>
                    </div>`;
            }
        });
    });
}

function loadChat() {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = auth.currentUser && m.uid === auth.currentUser.uid;
            chat.innerHTML += `
                <div class="msg-bubble ${isMe ? 'my-msg' : 'other-msg'}">
                    ${!isMe ? `<small style="color:var(--blue); font-weight:bold">${m.name}</small><br>` : ''}
                    ${m.text}
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}

// Прив'язка кнопок
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout-menu').onclick = () => signOut(auth);
document.getElementById('btn-publish').onclick = publishPost;
document.getElementById('btn-send-msg').onclick = sendMessage;
document.getElementById('msg-input').onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };
document.getElementById('btn-edit-avatar').onclick = () => document.getElementById('emoji-picker').classList.toggle('hidden');

document.querySelectorAll('.emoji-item').forEach(el => {
    el.onclick = () => window.setEmojiAvatar(el.innerText);
});

// Ініціалізація
initTheme();
bindNav();
