// 1. ІМПОРТ (Тільки з одного місця)
import { auth, db, googleProvider } from './firebase.js';
import { 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp, 
    doc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАЛАШТУВАННЯ АДМІНІВ ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; // Встав свій UID з консолі, щоб отримати права адміна

// 2. ГЛОБАЛЬНІ ФУНКЦІЇ
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
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
};

// 3. ПІДКЛЮЧЕННЯ КНОПОК
document.addEventListener('DOMContentLoaded', () => {
    // Навігація внизу (Home, Messages, Profile)
    const navButtons = {
        'nav-feed': 'feed',
        'nav-messages': 'messages',
        'nav-profile': 'profile',
        'logo-home': 'feed'
    };

    Object.entries(navButtons).forEach(([id, page]) => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = () => showPage(page);
    });

    // Вибір фото для поста
    const fileInput = document.getElementById('post-file');
    const btnPhoto = document.getElementById('btn-add-photo');
    if (btnPhoto) btnPhoto.onclick = () => fileInput.click();

    // Створення поста
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

    // Відправка в чат
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

    // Google Вхід / Вихід
    const btnLogin = document.getElementById('btn-google');
    if (btnLogin) btnLogin.onclick = () => signInWithPopup(auth, googleProvider);

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => signOut(auth);
});

// 4. ПЕРЕВІРКА СТАНУ АВТОРИЗАЦІЇ
onAuthStateChanged(auth, (user) => {
    const authBox = document.getElementById('auth-container');
    const appBox = document.getElementById('app-container');

    if (user) {
        console.log("Твій UID для ADMINS:", user.uid);
        authBox.classList.add('hidden');
        appBox.classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        loadRealtimeData();
    } else {
        authBox.classList.remove('hidden');
        appBox.classList.add('hidden');
    }
});

// 5. ОНОВЛЕННЯ ДАНИХ У РЕАЛЬНОМУ ЧАСІ
function loadRealtimeData() {
    // Стрічка постів
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        if (!feed) return;
        feed.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            let media = p.image ? `<img src="${p.image}" class="post-img-display">` : '';
            if (p.videoUrl) {
                media += `<video src="${p.videoUrl}" controls class="post-img-display"></video>`;
            }
            
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><img src="${p.avatar}" class="nav-thumb"> <b>${p.userName}</b></div>
                    <div class="post-content-text">${p.text}</div>
                    ${media}
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
            const time = m.createdAt ? new Date(m.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

            chat.innerHTML += `
                <div class="msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}">
                    <img src="${m.avatar}" class="chat-av">
                    <div class="msg-bubble">
                        <div class="msg-info">
                            ${m.name} ${isAdmin ? '<span class="admin-badge">адмін</span>' : ''}
                        </div>
                        <div class="msg-text">${m.text}</div>
                        <div class="msg-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 5px;">
                            <span style="font-size: 10px; color: #aaa;">${time}</span>
                            ${(isMe || isAdmin) ? `<span class="del-btn" onclick="deleteMsg('${d.id}')" style="cursor:pointer; color:#ff5a5a;">×</span>` : ''}
                        </div>
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
