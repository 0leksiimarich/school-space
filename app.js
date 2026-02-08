import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 
const VAPID_KEY = "BGoAZAFZGj7h_2UmeYawbzieb1Z5DWMPY_XDvNCQlm3_OpjEX1Jx_rL8trsZ9zZQ06CeOqXTeD6WEKIidp6YfFA";

// --- НАВІГАЦІЯ ---
window.showPage = (pageId) => {
    // Ховаємо всі сторінки
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    // Показуємо потрібну
    const target = document.getElementById(`page-${pageId}`);
    if(target) target.classList.remove('hidden');
    
    // Оновлюємо заголовок
    const titles = { feed: 'Стрічка', chat: 'Чат', contacts: 'Контакти', profile: 'Профіль' };
    document.getElementById('page-title').innerText = titles[pageId] || 'SchoolSpace';

    // Оновлюємо активний клас в меню
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Закриваємо меню
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');

    if(pageId === 'contacts') loadContacts();
    if(pageId === 'profile') loadMyPosts();
};

// --- МЕНЮ (БУРГЕР) ---
document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};
document.getElementById('menu-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};

// --- АВАТАРКА ---
document.getElementById('btn-edit-avatar').onclick = () => document.getElementById('avatar-upload').click();
document.getElementById('avatar-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result;
        await setDoc(doc(db, "users", auth.currentUser.uid), { customAvatar: base64 }, { merge: true });
        document.getElementById('profile-avatar-big').src = base64;
        document.getElementById('menu-avatar').src = base64;
    };
    reader.readAsDataURL(file);
};

// --- ТЕМА ---
document.getElementById('theme-toggle').onclick = () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
};
if(localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');

// --- КОНТАКТИ ---
function loadContacts() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('contacts-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            cont.innerHTML += `
                <div class="contact-item">
                    <img src="${u.customAvatar || 'https://ui-avatars.com/api/?name='+u.displayName}" class="contact-avatar">
                    <div>
                        <div style="font-weight:bold">${u.displayName || 'Користувач'}</div>
                        <div style="font-size:12px; color:var(--accent)">онлайн</div>
                    </div>
                </div>`;
        });
    });
}

// --- СТРІЧКА ТА ПОСТИ ---
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
                        <b style="color:var(--accent)">${p.name}</b>
                        ${isAdmin ? `<i class="fas fa-trash" onclick="deleteItem('posts', '${d.id}')" style="color:red; cursor:pointer"></i>` : ''}
                    </div>
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

function loadMyPosts() {
    const cont = document.getElementById('my-posts-container');
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        cont.innerHTML = '';
        snap.forEach(d => {
            if(d.data().uid === auth.currentUser.uid) {
                cont.innerHTML += `<div class="post-card"><p>${d.data().text}</p>${d.data().image ? `<img src="${d.data().image}" class="post-img">` : ''}</div>`;
            }
        });
    });
}

// --- ЧАТ ---
document.getElementById('btn-send-msg').onclick = async () => {
    const inp = document.getElementById('msg-input');
    if(!inp.value.trim()) return;
    await addDoc(collection(db, "messages"), { text: inp.value, uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp() });
    inp.value = "";
};

function loadChat() {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = auth.currentUser && m.uid === auth.currentUser.uid;
            chat.innerHTML += `
                <div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? 'var(--msg-out)' : 'var(--msg-in)'}; padding: 10px 15px; border-radius: 15px; color: white; max-width: 80%; margin-bottom: 5px;">
                    ${!isMe ? `<small style="color:var(--accent); font-weight:bold">${m.name}</small><br>` : ''}
                    ${m.text}
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}

// --- СТАН AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        // Реєструємо/оновлюємо користувача в базі
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        let av = user.photoURL;
        if (userDoc.exists()) {
            if (userDoc.data().customAvatar) av = userDoc.data().customAvatar;
        } else {
            await setDoc(userRef, { displayName: user.displayName, email: user.email, customAvatar: user.photoURL });
        }

        document.getElementById('menu-avatar').src = av;
        document.getElementById('profile-avatar-big').src = av;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-name-big').innerText = user.displayName;

        loadFeed(); loadChat();
        
        // Push-сповіщення
        try {
            const m = getMessaging();
            const r = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            const t = await getToken(m, { serviceWorkerRegistration: r, vapidKey: VAPID_KEY });
            if(t) await setDoc(userRef, { fcmToken: t }, { merge: true });
        } catch(e) {}
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout-menu').onclick = () => signOut(auth);
document.getElementById('btn-publish').onclick = publishPost;
window.deleteItem = async (c, i) => { if(confirm("Видалити?")) await deleteDoc(doc(db, c, i)); };
