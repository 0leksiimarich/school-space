import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАЛАШТУВАННЯ АДМІНІВ ---
// Встав сюди свій UID без пробілів!
const ADMINS = ['ТВІЙ_UID_СЮДИ']; 

window.deleteMsg = async (id) => {
    if (confirm("Видалити повідомлення?")) {
        await deleteDoc(doc(db, "messages", id));
    }
};

const showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    // Навігація
    document.getElementById('nav-feed').onclick = () => showPage('feed');
    document.getElementById('nav-messages').onclick = () => showPage('messages');
    document.getElementById('nav-profile').onclick = () => showPage('profile');

    // Вхід/Вихід
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    // Чат
    document.getElementById('btn-send-msg').onclick = async () => {
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
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // ПЕРЕВІРКА АДМІНКИ В КОНСОЛІ
        console.log("Ваш UID:", user.uid);
        const isAdmin = ADMINS.includes(user.uid.trim());
        console.log("Ви адмін?", isAdmin ? "ТАК ✅" : "НІ ❌");

        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        loadData();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadData() {
    // Чат (Telegram Style)
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            const isAdmin = ADMINS.includes(auth.currentUser.uid.trim());
            const time = m.createdAt ? new Date(m.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

            chat.innerHTML += `
                <div class="msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}">
                    <img src="${m.avatar}" class="chat-av">
                    <div class="msg-bubble">
                        <div class="msg-info">${m.name} ${isAdmin ? '<span class="admin-badge">адмін</span>' : ''}</div>
                        <div class="msg-text">${m.text}</div>
                        <div class="msg-meta" style="text-align:right; margin-top:4px;">
                            <span style="font-size:10px; color:#aaa;">${time}</span>
                            ${(isMe || isAdmin) ? `<span onclick="deleteMsg('${d.id}')" style="color:red; cursor:pointer; margin-left:8px;">×</span>` : ''}
                        </div>
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });

    // Стрічка
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="msg-info">${p.userName}</div>
                    <div>${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img-display">` : ''}
                </div>`;
        });
    });
}
