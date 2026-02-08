// ІМПОРТ ФУНКЦІЙ FIREBASE
import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ГОЛОВНА ФУНКЦІЯ ЗАПУСКУ (Щоб кнопки точно ожили) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Додаток запущено. Підключаємо кнопки...");
    
    // Знаходимо елементи
    const btnLogin = document.getElementById('btn-google');
    const btnLogout = document.getElementById('btn-logout');
    const btnSend = document.getElementById('btn-send-msg');
    const msgInput = document.getElementById('msg-input');

    // Підключаємо дії до кнопок
    if (btnLogin) btnLogin.onclick = () => signInWithPopup(auth, googleProvider);
    if (btnLogout) btnLogout.onclick = () => signOut(auth);
    if (btnSend) btnSend.onclick = sendMessage;

    // Відправка по Enter
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

// --- ФУНКЦІЯ ВІДПРАВКИ ПОВІДОМЛЕННЯ ---
async function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    
    // Якщо тексту немає або користувач не увійшов - нічого не робимо
    if (!text || !auth.currentUser) return;

    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            uid: auth.currentUser.uid,
            // Якщо імені немає, пишемо "Анонім", щоб не було undefined
            name: auth.currentUser.displayName || "Анонім", 
            createdAt: serverTimestamp()
        });
        input.value = ""; // Очищаємо поле після відправки
    } catch (error) {
        console.error("Помилка відправки:", error);
        alert("Не вдалося відправити повідомлення.");
    }
}

// --- СЛІДКУЄМО ЗА СТАНОМ ВХОДУ (Вхід/Вихід) ---
onAuthStateChanged(auth, (user) => {
    const authUI = document.getElementById('auth-container');
    const appUI = document.getElementById('app-container');

    if (user) {
        // Користувач увійшов
        authUI.classList.add('hidden');
        appUI.classList.remove('hidden');
        loadMessages(); // Завантажуємо чат
    } else {
        // Користувач вийшов
        authUI.classList.remove('hidden');
        appUI.classList.add('hidden');
    }
});

// --- ЗАВАНТАЖЕННЯ ПОВІДОМЛЕНЬ У РЕАЛЬНОМУ ЧАСІ ---
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = ''; // Очищаємо перед оновленням

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = auth.currentUser && msg.uid === auth.currentUser.uid;
            
            // Форматуємо час
            let timeString = "..:..";
            if (msg.createdAt) {
                const date = msg.createdAt.toDate();
                timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            // Створюємо HTML повідомлення
            chatBox.innerHTML += `
                <div class="msg-row ${isMe ? 'my-msg' : 'other-msg'}">
                    <div class="bubble">
                        ${!isMe ? `<div class="sender-name">${msg.name}</div>` : ''}
                        <div class="msg-text">${msg.text}</div>
                        <div class="msg-time">${timeString}</div>
                    </div>
                </div>
            `;
        });
        
        // Прокручуємо вниз до нових повідомлень
        chatBox.parentElement.scrollTop = chatBox.parentElement.scrollHeight;
    });
}
