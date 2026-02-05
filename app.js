import { auth, db, googleProvider } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ГЛОБАЛЬНІ ФУНКЦІЇ (Для HTML)
window.showStep = (step) => {
    document.getElementById('auth-initial').classList.add('hidden');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById(`step-${step}`).classList.remove('hidden');
};

window.switchPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
};

// ПРИВ'ЯЗКА КНОПОК
document.addEventListener('DOMContentLoaded', () => {
    // Вхід через Google
    document.getElementById('btn-google').onclick = async () => {
        try { await signInWithPopup(auth, googleProvider); } 
        catch (e) { alert("Помилка Google: " + e.message); }
    };

    // Вхід через Пошту
    document.getElementById('btn-login').onclick = async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        try { await signInWithEmailAndPassword(auth, email, pass); } 
        catch (e) { alert("Помилка: " + e.message); }
    };

    // Опублікувати пост
    document.getElementById('btn-post').onclick = async () => {
        const text = document.getElementById('post-text').value;
        if (!text) return;
        try {
            await addDoc(collection(db, "posts"), {
                text: text,
                userName: auth.currentUser.displayName || "Учень",
                createdAt: serverTimestamp()
            });
            document.getElementById('post-text').value = "";
        } catch (e) { alert("Помилка поста: " + e.message); }
    };
});

// МОНІТОРИНГ СТАНУ
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadFeed();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snapshot.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><b>${p.userName}</b></div>
                    <div class="post-content-text">${p.text}</div>
                </div>`;
        });
    });
}

