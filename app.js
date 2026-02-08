// 1. ІМПОРТИ (Firebase)
import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 2. ОСЬ ТУТ ТВІЙ СПИСОК АДМІНІВ ---
// Скопіюй свій UID з консолі (F12) і встав замість тексту нижче
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 

// 3. ФУНКЦІЯ ВИДАЛЕННЯ (тільки для адмінів або авторів)
window.deleteMsg = async (id) => {
    if (confirm("Видалити це повідомлення?")) {
        try {
            await deleteDoc(doc(db, "messages", id));
        } catch (e) {
            console.error("Помилка видалення:", e);
        }
    }
};

// 4. ПІДКЛЮЧЕННЯ КНОПОК
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-google');
    const btnLogout = document.getElementById('btn-logout');
    const btnSend = document.getElementById('btn-send-msg');
    const msgInput = document.getElementById('msg-input');

    if (btnLogin) btnLogin.onclick = () => signInWithPopup(auth, googleProvider);
    if (btnLogout) btnLogout.onclick = () => signOut(auth);
    if (btnSend) btnSend.onclick = sendMessage;

    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

// 5. ВІДПРАВКА
async function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !auth.currentUser) return;

    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName || "Анонім",
            createdAt: serverTimestamp()
        });
        input.value = "";
    } catch (e) { console.error(e); }
}

// 6. ПЕРЕВІРКА ВХОДУ ТА СТАТУСУ АДМІНА
onAuthStateChanged(auth, (user) => {
    const authUI = document.getElementById('auth-container');
    const appUI = document.getElementById('app-container');

    if (user) {
        authUI.classList.add('hidden');
        appUI.classList.remove('hidden');
        
        // Перевіряємо, чи є поточний користувач у списку ADMINS
        const isAdmin = ADMINS.map(id => id.trim()).includes(user.uid.trim());
        
        console.log("Твій UID:", user.uid);
        console.log("Ти адмін?", isAdmin ? "ТАК ✅" : "НІ ❌");

        loadMessages(isAdmin); 
    } else {
        authUI.classList.remove('hidden');
        appUI.classList.add('hidden');
    }
});

// 7. ЗАВАНТАЖЕННЯ ЧАТУ
function loadMessages(currentUserIsAdmin) {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = '';

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = auth.currentUser && msg.uid === auth.currentUser.uid;
            
            // Кнопка видалення з'явиться тільки якщо ти адмін АБО це твоє повідомлення
            const canDelete = isMe || currentUserIsAdmin;

            let timeString = "..:..";
            if (msg.createdAt) {
                timeString = msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            chatBox.innerHTML += `
                <div class="msg-row ${isMe ? 'my-msg' : 'other-msg'}">
                    <div class="bubble">
                        ${!isMe ? `<div class="sender-name">${msg.name}</div>` : ''}
                        <div class="msg-text">${msg.text}</div>
                        <div class="msg-time">
                            ${timeString} 
                            ${canDelete ? `<i class="fas fa-trash" onclick="deleteMsg('${doc.id}')" style="margin-left:8px; cursor:pointer; color:#ff5e5e;"></i>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        chatBox.parentElement.scrollTop = chatBox.parentElement.scrollHeight;
    });
}
