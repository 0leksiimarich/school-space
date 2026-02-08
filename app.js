// 1. ІМПОРТ (Тільки один раз!)
import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАЛАШТУВАННЯ АДМІНІВ ---
const ADMINS = ['']; // Сюди впишеш свій UID з консолі

// Глобальні функції (щоб працювали з HTML)
window.deleteMsg = async (id) => {
    if (confirm("Видалити це повідомлення?")) {
        try {
            await deleteDoc(doc(db, "messages", id));
        } catch (e) { console.error("Помилка видалення:", e); }
    }
};

const fileToText = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
});

const showPage = (pageId) => {
    console.log("Відкриваю сторінку:", pageId);
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
};

// 2. ОЖИВЛЕННЯ КНОПОК
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM завантажено. Підключаю кнопки...");

    // Навігація
    const navs = {
        'nav-feed': 'feed',
        'nav-messages': 'messages',
        'nav-profile': 'profile',
        'logo-home': 'feed'
    };

    Object.entries(navs).forEach(([id, page]) => {
        const el = document.getElementById(id);
        if (el) el.onclick = () => showPage(page);
    });

    // Вибір фото
    const fileInput = document.getElementById('post-file');
    const btnAddPhoto = document.getElementById('btn-add-photo');
    if (btnAddPhoto && fileInput) {
        btnAddPhoto.onclick = () => fileInput.click();
    }

    // Публікація поста
    const btnPost = document.getElementById('btn-post');
    if (btnPost) {
        btnPost.onclick = async () => {
            const txt = document.getElementById('post-text').value;
            const vidUrl = document.getElementById('post-video-url').value;
            const file = fileInput.files[0];

            if (!txt.trim() && !file && !vidUrl) return;
            
            btnPost.disabled = true;
            btnPost.innerText = "...";

            let photoData = file ? await fileToText(file) : null;

            try {
                await addDoc(collection(db, "posts"), {
                    text: txt,
                    image: photoData,
                    videoUrl: vidUrl || null,
                    userName: auth.currentUser.displayName,
                    avatar: auth.currentUser.photoURL,
                    createdAt: serverTimestamp()
                });
                document.getElementById('post-text').value = "";
                document.getElementById('post-video-url').value = "";
                fileInput.value = "";
            } catch (e) { console.error(e); }
            
            btnPost.disabled = false;
            btnPost.innerText = "Опублікувати";
        };
    }

    // Чат
    const btnSend = document.getElementById('btn-send-msg');
    if (btnSend) {
        btnSend.onclick = async () => {
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
    }

    // Авторизація
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) btnGoogle.onclick = () => signInWithPopup(auth, googleProvider);

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => signOut(auth);
});

// 3. СЛУХАЧ FIREBASE
onAuthStateChanged(auth, (user) => {
    const authUI = document.getElementById('auth-container');
    const appUI = document.getElementById('app-container');

    if (user) {
        console.log("Твій UID для списку ADMINS:", user.uid);
        authUI.classList.add('hidden');
        appUI.classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        loadContent();
    } else {
        authUI.classList.remove('hidden');
        appUI.classList.add('hidden');
    }
});

function loadContent() {
    // Стрічка (Медіа)
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        if (!feed) return;
        feed.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><img src="${p.avatar}" class="nav-thumb"> <b>${p.userName}</b></div>
                    <div class="post-content-text">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img-display">` : ''}
                </div>`;
        });
    });

    // Чат (Telegram Style)
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        if (!chat) return;
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            const isAdmin = ADMINS.includes(auth.currentUser.uid);
            
            chat.innerHTML += `
                <div class="msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}">
                    <img src="${m.avatar}" class="chat-av">
                    <div class="msg-bubble">
                        <div class="msg-info">${m.name}</div>
                        <p>${m.text}</p>
                        <div class="msg-meta">
                            ${(isMe || isAdmin) ? `<span class="del-btn" onclick="deleteMsg('${d.id}')">×</span>` : ''}
                        </div>
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
