import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Перетворення картинки в Base64 текст
const fileToText = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
});

// Функція для отримання ID відео з YouTube
function getYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

const showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    let selectedFile = null;
    const fileInput = document.getElementById('post-file');
    const fileName = document.getElementById('file-name');

    // Кнопки навігації
    document.getElementById('nav-feed').onclick = () => showPage('feed');
    document.getElementById('nav-messages').onclick = () => showPage('messages');
    document.getElementById('nav-profile').onclick = () => showPage('profile');
    document.getElementById('logo-home').onclick = () => showPage('feed');

    // Фото
    document.getElementById('btn-add-photo').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) fileName.innerText = "📎 Фото";
    };

    // Опублікувати пост
    document.getElementById('btn-post').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        const vidUrl = document.getElementById('post-video-url').value;
        const btn = document.getElementById('btn-post');

        if (!txt.trim() && !selectedFile && !vidUrl.trim()) return;

        btn.disabled = true;
        btn.innerText = "...";

        let photoData = null;
        if (selectedFile) photoData = await fileToText(selectedFile);

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
            selectedFile = null;
            fileName.innerText = "";
        } catch (e) { console.error(e); }
        btn.disabled = false;
        btn.innerText = "Опублікувати";
    };

    // Вхід/Вихід
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    // Чат
    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value,
            senderId: auth.currentUser.uid,
            senderName: auth.currentUser.displayName,
            createdAt: serverTimestamp()
        });
        input.value = "";
    };
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName;
        document.getElementById('prof-avatar').src = user.photoURL;
        loadContent();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadContent() {
    // Пости
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snap.forEach(doc => {
            const p = doc.data();
            let media = '';
            if (p.image) media = `<img src="${p.image}" class="post-img-display">`;
            
            const ytId = p.videoUrl ? getYouTubeID(p.videoUrl) : null;
            if (ytId) {
                media = `<iframe width="100%" height="250" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:8px;"></iframe>`;
            } else if (p.videoUrl) {
                media = `<video src="${p.videoUrl}" controls class="post-img-display"></video>`;
            }

            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><img src="${p.avatar}" class="nav-thumb"> <b>${p.userName}</b></div>
                    <div class="post-content-text">${p.text}</div>
                    ${media}
                </div>`;
        });
    });

    // Чат
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const isMine = m.senderId === auth.currentUser.uid;
            chat.innerHTML += `<div class="msg-wrapper ${isMine ? 'my-msg' : 'other-msg'}">
                <div class="msg-bubble"><small>${m.senderName}</small><p>${m.text}</p></div>
            </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
