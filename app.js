import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// --- Пуш-сповіщення ---
async function setupPush(user) {
    try {
        const messaging = getMessaging();
        const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        const token = await getToken(messaging, { serviceWorkerRegistration: reg, vapidKey: VAPID_KEY });
        if (token) await setDoc(doc(db, "users", user.uid), { fcmToken: token }, { merge: true });
    } catch (e) { console.warn("Push-сповіщення не підключені"); }
}

// --- Управління інтерфейсом ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menu-overlay');

document.getElementById('burger-btn').onclick = () => { sidebar.classList.toggle('active'); overlay.classList.toggle('active'); };
overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };

document.querySelectorAll('.nav-item').forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        const target = link.dataset.target;
        document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${target}`).classList.remove('hidden');
        document.getElementById('page-title').innerText = link.innerText.trim();
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        sidebar.classList.remove('active'); overlay.classList.remove('active');
        if (target === 'profile') loadMyPosts();
    };
});

// --- Тема ---
document.getElementById('theme-toggle').onclick = () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
};
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');

// --- Стан користувача ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const av = (userDoc.exists() && userDoc.data().customAvatar) ? userDoc.data().customAvatar : user.photoURL;
        
        document.getElementById('menu-avatar').src = av;
        document.getElementById('profile-avatar-big').src = av;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-name-big').innerText = user.displayName;

        loadFeed(); loadChat(); setupPush(user);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- Пости ---
async function publishPost() {
    const text = document.getElementById('post-text').value;
    const file = document.getElementById('post-file-input').files[0];
    if (!text && !file) return;

    let imgBase64 = null;
    if (file) {
        const reader = new FileReader();
        imgBase64 = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
    }

    await addDoc(collection(db, "posts"), {
        text, image: imgBase64, uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || "Користувач", createdAt: serverTimestamp()
    });
    document.getElementById('post-text').value = "";
    document.getElementById('post-file-input').value = "";
}

function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const isAdmin = ADMINS.includes(auth.currentUser?.uid);
            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <span>${p.name || "Гість"}</span>
                        ${isAdmin ? `<i class="fas fa-trash" onclick="deleteItem('posts', '${d.id}')" style="cursor:pointer; color:red"></i>` : ''}
                    </div>
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

function loadChat() {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = auth.currentUser && m.uid === auth.currentUser.uid;
            chat.innerHTML += `
                <div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; 
                            background: ${isMe ? 'var(--msg-out)' : 'var(--msg-in)'}; 
                            padding: 10px 15px; border-radius: 15px; max-width: 80%;">
                    ${!isMe ? `<small style="color:var(--accent); font-weight:bold">${m.name || 'Анон'}</small><br>` : ''}
                    ${m.text}
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}

window.deleteItem = async (col, id) => { if(confirm("Видалити?")) await deleteDoc(doc(db, col, id)); };

// --- Кнопки ---
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout-menu').onclick = () => signOut(auth);
document.getElementById('btn-publish').onclick = publishPost;
document.getElementById('btn-send-msg').onclick = async () => {
    const input = document.getElementById('msg-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "messages"), { text: input.value, uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp() });
    input.value = "";
};
document.getElementById('btn-edit-avatar').onclick = () => document.getElementById('emoji-picker').classList.toggle('hidden');
document.querySelectorAll('.emoji-opt').forEach(el => {
    el.onclick = async () => {
        const url = `https://ui-avatars.com/api/?name=${el.innerText}&background=random&size=128`;
        await setDoc(doc(db, "users", auth.currentUser.uid), { customAvatar: url }, { merge: true });
        location.reload();
    };
});
