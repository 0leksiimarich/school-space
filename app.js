import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("Файл app.js завантажено успішно!");

// Глобальна функція для перемикання сторінок
window.switchPage = (pageId) => {
    console.log("Спроба перейти на сторінку:", pageId);
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.add('hidden'));
    
    const target = document.getElementById(`page-${pageId}`);
    if (target) {
        target.classList.remove('hidden');
        console.log("Сторінку активовано:", pageId);
    } else {
        console.error("Помилка: Сторінку не знайдено за ID:", `page-${pageId}`);
    }
};

// --- ПРИВ'ЯЗКА ПОДІЙ ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM завантажено. Починаємо прив'язку кнопок...");

    // 1. Кнопка Google
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
        btnGoogle.onclick = async () => {
            console.log("Натиснуто кнопку Google");
            try {
                await signInWithPopup(auth, googleProvider);
            } catch (e) {
                console.error("Помилка Google Auth:", e);
                alert("Помилка входу Google: " + e.message);
            }
        };
    }

    // 2. Кнопка Поста
    const btnPost = document.getElementById('btn-post');
    if (btnPost) {
        btnPost.onclick = async () => {
            console.log("Спроба опублікувати пост...");
            const txt = document.getElementById('post-text').value;
            if (!txt.trim()) return;
            try {
                await addDoc(collection(db, "posts"), {
                    text: txt,
                    userName: auth.currentUser.displayName,
                    avatar: auth.currentUser.photoURL,
                    createdAt: serverTimestamp()
                });
                document.getElementById('post-text').value = "";
                console.log("Пост опубліковано!");
            } catch (e) {
                console.error("Помилка публікації:", e);
            }
        };
    }

    // 3. Кнопка Повідомлення
    const btnSendMsg = document.getElementById('btn-send-msg');
    if (btnSendMsg) {
        btnSendMsg.onclick = async () => {
            const input = document.getElementById('msg-input');
            if (!input.value.trim()) return;
            try {
                await addDoc(collection(db, "messages"), {
                    text: input.value,
                    senderName: auth.currentUser.displayName,
                    senderId: auth.currentUser.uid,
                    avatar: auth.currentUser.photoURL,
                    createdAt: serverTimestamp()
                });
                input.value = "";
                console.log("Повідомлення відправлено");
            } catch (e) {
                console.error("Помилка повідомлення:", e);
            }
        };
    }

    // 4. Кнопка Виходу
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            console.log("Вихід...");
            signOut(auth);
        };
    }
});

// --- ВІДСТЕЖЕННЯ АВТОРИЗАЦІЇ ---
onAuthStateChanged(auth, (user) => {
    const authCont = document.getElementById('auth-container');
    const appCont = document.getElementById('app-container');

    if (user) {
        console.log("Користувач авторизований:", user.displayName);
        authCont.classList.add('hidden');
        appCont.classList.remove('hidden');
        
        const profName = document.getElementById('prof-name');
        const profAv = document.getElementById('prof-avatar');
        if (profName) profName.innerText = user.displayName;
        if (profAv) profAv.src = user.photoURL;

        loadFeed();
        listenMessages();
    } else {
        console.log("Користувач НЕ авторизований");
        authCont.classList.remove('hidden');
        appCont.classList.add('hidden');
    }
});

// Завантаження постів
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const feed = document.getElementById('feed');
        if (!feed) return;
        feed.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><img src="${p.avatar}" class="nav-thumb"> <b>${p.userName}</b></div>
                    <p>${p.text}</p>
                </div>`;
        });
    });
}

// Завантаження чату
function listenMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
        const area = document.getElementById('chat-messages');
        if (!area) return;
        area.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMine = m.senderId === auth.currentUser?.uid;
            area.innerHTML += `
                <div class="msg-wrapper ${isMine ? 'my-msg' : 'other-msg'}">
                    <div class="msg-bubble"><small>${m.senderName}</small><p>${m.text}</p></div>
                </div>`;
        });
        area.scrollTop = area.scrollHeight;
    });
}
