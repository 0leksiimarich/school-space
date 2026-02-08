import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- АДМІН ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; // ВСТАВ СВІЙ UID

// ФУНКЦІЯ ВІДПРАВКИ
async function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    
    if (text !== "" && auth.currentUser) {
        try {
            await addDoc(collection(db, "messages"), {
                text: text,
                uid: auth.currentUser.uid,
                name: auth.currentUser.displayName,
                avatar: auth.currentUser.photoURL,
                createdAt: serverTimestamp()
            });
            input.value = ""; // Очистити поле
        } catch (e) {
            console.error("Помилка відправки:", e);
        }
    }
}

// ПРИВ'ЯЗКА КНОПОК ПІСЛЯ ЗАВАНТАЖЕННЯ
document.addEventListener('DOMContentLoaded', () => {
    const btnSend = document.getElementById('btn-send-msg');
    const btnGoogle = document.getElementById('btn-google');
    const btnLogout = document.getElementById('btn-logout');
    const msgInput = document.getElementById('msg-input');

    if (btnSend) btnSend.onclick = sendMessage;
    if (btnGoogle) btnGoogle.onclick = () => signInWithPopup(auth, googleProvider);
    if (btnLogout) btnLogout.onclick = () => signOut(auth);

    // Відправка по клавіші Enter
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

// ПЕРЕВІРКА ВХОДУ
onAuthStateChanged(auth, (user) => {
    const authUI = document.getElementById('auth-container');
    const appUI = document.getElementById('app-container');

    if (user) {
        authUI.classList.add('hidden');
        appUI.classList.remove('hidden');
        console.log("Твій UID:", user.uid);
        loadChat();
    } else {
        authUI.classList.remove('hidden');
        appUI.classList.add('hidden');
    }
});

// ЗАВАНТАЖЕННЯ ПОВІДОМЛЕНЬ
function loadChat() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snap) => {
        const chatContainer = document.getElementById('chat-messages');
        if (!chatContainer) return;
        
        chatContainer.innerHTML = '';
        snap.forEach((d) => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            const time = m.createdAt ? new Date(m.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            
            chatContainer.innerHTML += `
                <div class="msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}">
                    <div class="bubble">
                        ${!isMe ? `<div class="sender-name">${m.name || 'Анонім'}</div>` : ''}
                        <div class="msg-text">${m.text}</div>
                        <div class="msg-time">${time}</div>
                    </div>
                </div>
            `;
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
