import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// --- НАЛАШТУВАННЯ ---
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// Елементи
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menu-overlay');
const burgerBtn = document.getElementById('burger-btn');

// --- 1. ОЖИВЛЯЄМО КНОПКИ ---
function bindAllButtons() {
    if (burgerBtn) burgerBtn.onclick = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
    if (overlay) overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };

    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout-menu').onclick = () => signOut(auth);
    document.getElementById('btn-publish').onclick = publishPost;
    document.getElementById('btn-send-msg').onclick = sendMessage;
    document.getElementById('btn-edit-avatar').onclick = () => document.getElementById('emoji-picker').classList.toggle('hidden');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            showPage(target, link.innerText.trim());
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        };
    });

    document.querySelectorAll('.emoji-item').forEach(el => {
        el.onclick = () => setEmojiAvatar(el.innerText);
    });
}

function showPage(id, title) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('page-title').innerText = title;
    if (id === 'profile') loadMyPosts();
}

// --- 2. АВАТАРКИ ТА ПРОФІЛЬ ---
async function setEmojiAvatar(emoji) {
    const user = auth.currentUser;
    const customUrl = `https://ui-avatars.com/api/?name=${emoji}&background=random&size=128`;
    await setDoc(doc(db, "users", user.uid), { customAvatar: customUrl }, { merge: true });
    updateUI(user); // Миттєво оновити картинку
    document.getElementById('emoji-picker').classList.add('hidden');
}

async function updateUI(user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const finalAvatar = userDoc.exists() && userDoc.data().customAvatar ? userDoc.data().customAvatar : user.photoURL;
    
    document.getElementById('menu-avatar').src = finalAvatar;
    document.getElementById('profile-avatar-big').src = finalAvatar;
    document.getElementById('menu-username').innerText = user.displayName;
    document.getElementById('profile-name-big').innerText = user.displayName;
}

// --- 3. ПОСТИ ТА ЧАТ ---
async function publishPost() {
    const txt = document.getElementById('post-text').value;
    const file = document.getElementById('post-file-input').files[0];
    if (!txt && !file) return;

    let imgData = null;
    if (file) {
        const reader = new FileReader();
        imgData = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
    }

    await addDoc(collection(db, "posts"), {
        text: txt, image: imgData, uid: auth.currentUser.uid,
        name: auth.currentUser.displayName, createdAt: serverTimestamp()
    });
    document.getElementById('post-text').value = "";
    document.getElementById('post-file-input').value = "";
}

async function sendMessage() {
    const input = document.getElementById('msg-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "messages"), {
        text: input.value, uid: auth.currentUser.uid,
        name: auth.currentUser.displayName, createdAt: serverTimestamp()
    });
    input.value = "";
}

window.deleteItem = async (col, id) => {
    if (confirm("Видалити?")) await deleteDoc(doc(db, col, id));
};

// --- 4. МОНІТОРИНГ ТА ЗАВАНТАЖЕННЯ ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        updateUI(user);
        loadFeed(ADMINS.includes(user.uid));
        loadChat(ADMINS.includes(user.uid));
        bindAllButtons();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        bindAllButtons();
    }
});

function loadFeed(isAdmin) {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const container = document.getElementById('feed-container');
        container.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const canDel = isAdmin || p.uid === auth.currentUser.uid;
            container.innerHTML += `
                <div class="post-card">
                    <strong>${p.name}</strong> ${canDel ? `<span onclick="deleteItem('posts', '${d.id}')" style="color:red; float:right; cursor:pointer;">×</span>` : ''}
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

function loadMyPosts() {
    const container = document.getElementById('my-posts-container');
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        container.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (p.uid === auth.currentUser.uid) {
                container.innerHTML += `<div class="post-card"><p>${p.text}</p>${p.image ? `<img src="${p.image}" class="post-img">` : ''}</div>`;
            }
        });
    });
}

function loadChat(isAdmin) {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            chat.innerHTML += `
                <div class="msg-bubble ${isMe ? 'my-msg' : 'other-msg'}">
                    ${!isMe ? `<small style="color:#40a7e3">${m.name}</small><br>` : ''}
                    ${m.text}
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}

bindAllButtons();
