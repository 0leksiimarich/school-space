import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// СПОВІЩЕННЯ
async function setupPush(user) {
    try {
        const messaging = getMessaging();
        const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        const token = await getToken(messaging, { serviceWorkerRegistration: reg, vapidKey: VAPID_KEY });
        if (token) await setDoc(doc(db, "users", user.uid), { fcmToken: token }, { merge: true });
    } catch (e) { console.log("Пуші не активовано"); }
}

// МЕНЮ ТА НАВІГАЦІЯ
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menu-overlay');
document.getElementById('burger-btn').onclick = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };

document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-target');
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${target}`).classList.remove('hidden');
        document.getElementById('page-title').innerText = link.innerText.trim();
        sidebar.classList.remove('active'); overlay.classList.remove('active');
        if (target === 'profile') loadMyPosts();
    };
});

// АВТЕНТИФІКАЦІЯ
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const avatar = (userDoc.exists() && userDoc.data().customAvatar) ? userDoc.data().customAvatar : user.photoURL;
        
        document.getElementById('menu-avatar').src = avatar;
        document.getElementById('profile-avatar-big').src = avatar;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-name-big').innerText = user.displayName;

        loadFeed(); loadChat(); setupPush(user);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// ФУНКЦІЇ КОНТЕНТУ
async function publishPost() {
    const txt = document.getElementById('post-text').value;
    const fileInput = document.getElementById('post-file-input');
    const file = fileInput.files[0];
    if (!txt && !file) return;

    let imgData = null;
    if (file) {
        const reader = new FileReader();
        imgData = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
    }

    await addDoc(collection(db, "posts"), {
        text: txt, image: imgData, uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || "Користувач", createdAt: serverTimestamp()
    });
    document.getElementById('post-text').value = "";
    fileInput.value = "";
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
                    <div style="display:flex; justify-content:space-between">
                        <b>${p.name || "Користувач"}</b>
                        ${isAdmin ? `<span onclick="deleteItem('posts', '${d.id}')" style="color:red; cursor:pointer">×</span>` : ''}
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
                            background: ${isMe ? '#2b5278' : '#182533'}; 
                            padding: 10px; border-radius: 12px; color: white; max-width: 80%;">
                    ${!isMe ? `<small style="color:#40a7e3">${m.name || 'Анон'}</small><br>` : ''}
                    ${m.text}
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}

window.deleteItem = async (col, id) => {
    if (confirm("Видалити?")) await deleteDoc(doc(db, col, id));
};

// ОБРОБНИКИ
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout-menu').onclick = () => signOut(auth);
document.getElementById('btn-publish').onclick = publishPost;
document.getElementById('theme-toggle').onclick = () => document.body.classList.toggle('light-theme');
document.getElementById('btn-send-msg').onclick = async () => {
    const input = document.getElementById('msg-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "messages"), { text: input.value, uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp() });
    input.value = "";
};
