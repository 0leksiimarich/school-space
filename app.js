import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === НАЛАШТУВАННЯ IMGBB (Працює без реєстрації акаунта) ===
const IMGBB_API_KEY = '706037759a2245d6775f46e852957e8d'; // Це відкритий ключ, він має працювати

async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        return data.data.url; // Отримуємо пряме посилання на фото
    } catch (e) {
        console.error("Помилка завантаження на ImgBB:", e);
        alert("Не вдалося завантажити фото. Спробуй ще раз.");
        return null;
    }
}

// === НАВІГАЦІЯ ТА КНОПКИ (СИЛОВЕ ПІДКЛЮЧЕННЯ) ===
const showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${id}`);
    if (target) target.classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    // Навігація
    document.getElementById('nav-feed').onclick = () => showPage('feed');
    document.getElementById('nav-search').onclick = () => showPage('search');
    document.getElementById('nav-messages').onclick = () => showPage('messages');
    document.getElementById('nav-profile').onclick = () => showPage('profile');
    
    // Вхід/Вихід
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    // Вибір файлу
    const fileInput = document.getElementById('post-file');
    const fileNameDisplay = document.getElementById('file-name');
    let selectedFile = null;

    document.getElementById('btn-add-photo').onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            fileNameDisplay.innerText = "📎 " + selectedFile.name;
        }
    };

    // ПУБЛІКАЦІЯ ПОСТА
    document.getElementById('btn-post').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        const btn = document.getElementById('btn-post');
        
        if (!txt.trim() && !selectedFile) return;

        btn.disabled = true;
        btn.innerText = "Публікуємо...";

        let finalImageUrl = null;
        if (selectedFile) {
            finalImageUrl = await uploadToImgBB(selectedFile);
        }

        try {
            await addDoc(collection(db, "posts"), {
                text: txt,
                image: finalImageUrl,
                userName: auth.currentUser.displayName,
                avatar: auth.currentUser.photoURL,
                createdAt: serverTimestamp()
            });

            // Очищення полів
            document.getElementById('post-text').value = "";
            selectedFile = null;
            fileNameDisplay.innerText = "";
            btn.disabled = false;
            btn.innerText = "Опублікувати";
            console.log("Пост додано успішно!");
        } catch (error) {
            console.error("Помилка Firebase:", error);
            btn.disabled = false;
            btn.innerText = "Опублікувати";
        }
    };

    // ЧАТ
    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value,
            senderId: auth.currentUser.uid,
            senderName: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        input.value = "";
    };
});

// СЛУХАЧ АВТОРИЗАЦІЇ
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        startUpdates();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function startUpdates() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snap.forEach(doc => {
            const p = doc.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.avatar}" class="nav-thumb">
                        <b>${p.userName}</b>
                    </div>
                    <div class="post-content-text">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img-display">` : ''}
                </div>`;
        });
    });

    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const mine = m.senderId === auth.currentUser.uid;
            chat.innerHTML += `
                <div class="msg-wrapper ${mine ? 'my-msg' : 'other-msg'}">
                    <div class="msg-bubble"><small>${m.senderName}</small><p>${m.text}</p></div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
