import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Глобальна функція для перемикання сторінок
window.switchPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
};

// --- ОСНОВНА ЛОГІКА ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Вхід Google
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);

    // Створення поста
    document.getElementById('btn-post').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        if (!txt.trim()) return;
        await addDoc(collection(db, "posts"), {
            text: txt,
            userName: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
    };

    // Відправка повідомлення в чат
    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value,
            senderName: auth.currentUser.displayName,
            senderId: auth.currentUser.uid,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        input.value = "";
    };

    // Пошук
    document.getElementById('btn-search').onclick = async () => {
        const num = document.getElementById('search-input').value;
        const resDiv = document.getElementById('search-results');
        resDiv.innerHTML = "Пошук...";
        const q = query(collection(db, "posts"), where("school", "==", num));
        const snap = await getDocs(q);
        resDiv.innerHTML = snap.empty ? "Нічого не знайдено" : "";
        snap.forEach(d => {
            const p = d.data();
            resDiv.innerHTML += `<div class="post-card"><b>${p.userName}</b><p>${p.text}</p></div>`;
        });
    };

    // Вихід
    document.getElementById('btn-logout').onclick = () => signOut(auth);
});

// --- СТАН КОРИСТУВАЧА ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        loadFeed();
        listenMessages();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const feed = document.getElementById('feed');
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

function listenMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
        const area = document.getElementById('chat-messages');
        area.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMine = m.senderId === auth.currentUser.uid;
            area.innerHTML += `
                <div class="msg-wrapper ${isMine ? 'my-msg' : 'other-msg'}">
                    <div class="msg-bubble"><small>${m.senderName}</small><p>${m.text}</p></div>
                </div>`;
        });
        area.scrollTop = area.scrollHeight;
    });
}
