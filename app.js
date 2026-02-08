import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// --- НАЛАШТУВАННЯ ---
const ADMINS = ['ТВІЙ_UID_ЯКИЙ_ТИ_ЗНАЙШОВ']; 
const VAPID_KEY = "ТВІЙ_VAPID_КЛЮЧ_З_FIREBASE"; // Знайди в Cloud Messaging -> Web Push certificates

// Перемикання сторінок
window.showPage = (id, title) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('page-title').innerText = title;
};

// Видалення
window.deleteItem = async (col, id) => {
    if (confirm("Видалити?")) await deleteDoc(doc(db, col, id));
};

// --- ФУНКЦІЯ СПОВІЩЕНЬ ---
async function setupNotifications(user) {
    try {
        const messaging = getMessaging();
        
        // Реєструємо Service Worker
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        
        // Отримуємо токен пристрою
        const token = await getToken(messaging, { 
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY 
        });

        if (token) {
            console.log("Токен отримано успішно!");
            // Зберігаємо токен у Firestore, щоб знати, куди слати пуші
            await setDoc(doc(db, "users", user.uid), {
                fcmToken: token,
                name: user.displayName
            }, { merge: true });
        }

        // Слухаємо сповіщення, коли сайт ВІДКРИТИЙ
        onMessage(messaging, (payload) => {
            alert(`Нове повідомлення: ${payload.notification.body}`);
        });

    } catch (error) {
        console.error("Помилка налаштування пушів:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    // Пости
    document.getElementById('btn-publish').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        const file = document.getElementById('post-file').files[0];
        if (!txt && !file) return;

        let imgData = null;
        if (file) {
            const reader = new FileReader();
            imgData = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
        }

        await addDoc(collection(db, "posts"), {
            text: txt, image: imgData,
            uid: auth.currentUser.uid, name: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL, createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
    };

    // Чат
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;
        
        const isAdmin = ADMINS.includes(user.uid);
        loadFeed(isAdmin);
        loadChat(isAdmin);
        setupNotifications(user); // ЗАПУСК ПУШІВ
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
                    <div class="post-content">
                        <strong>${p.name}</strong>
                        <p>${p.text}</p>
                        ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                        ${canDel ? `<span class="del-btn" onclick="deleteItem('posts', '${d.id}')">Видалити</span>` : ''}
                    </div>
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
            chat.innerHTML += `
                <div class="msg-row ${isMe ? 'my-msg' : 'other-msg'}">
                    <div class="bubble">
                        ${!isMe ? `<div class="sender-name">${m.name}</div>` : ''}
                        <div>${m.text}</div>
                        ${(isAdmin || isMe) ? `<span class="del-btn" onclick="deleteItem('messages', '${d.id}')">×</span>` : ''}
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
