import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАВІГАЦІЯ ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${id}`);
    if (target) target.classList.remove('hidden');
    
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');

    if (id === 'profile') loadPosts('my-posts-container', auth.currentUser.uid);
}

// Прив'язка кнопок меню
document.getElementById('nav-feed').addEventListener('click', () => showPage('feed'));
document.getElementById('nav-profile').addEventListener('click', () => showPage('profile'));
document.getElementById('nav-help').addEventListener('click', () => showPage('help'));
document.getElementById('nav-chat').addEventListener('click', () => showPage('chat'));
document.getElementById('nav-users').addEventListener('click', () => showPage('users'));

document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};
document.getElementById('menu-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};

// --- ФОТО ---
async function compress(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 400; canvas.height = img.height * (400 / img.width);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- БАЗА ДАНИХ ---
async function handleUser(u) {
    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL });
    }
    const data = (await getDoc(userRef)).data();
    document.getElementById('menu-avatar').src = data.photoURL;
    document.getElementById('profile-avatar-big').src = data.photoURL;
    document.getElementById('menu-username').innerText = data.displayName;
    document.getElementById('profile-name-big').innerText = data.displayName;
    
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    loadPosts('feed-container');
}

function loadPosts(contId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(contId);
        if (!cont) return;
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (filterUid && p.uid !== filterUid) return;
            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv}" class="post-author-av">
                        <b>${p.name}</b>
                    </div>
                    <div class="post-content">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

// Події кнопок публікації
document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text');
    const file = document.getElementById('post-file-input').files[0];
    if (!txt.value.trim() && !file) return;

    const imgBase64 = file ? await compress(file) : null;
    const userData = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();

    await addDoc(collection(db, "posts"), {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName,
        authorAv: userData.photoURL,
        text: txt.value,
        image: imgBase64,
        createdAt: serverTimestamp()
    });
    txt.value = ''; document.getElementById('post-file-input').value = '';
};

document.getElementById('btn-add-img').onclick = () => document.getElementById('post-file-input').click();

// Зміна аватара
document.getElementById('profile-avatar-click').onclick = () => document.getElementById('av-upload').click();
document.getElementById('av-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await compress(file);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: base64 });
    location.reload(); // Перезавантаження для оновлення всюди
};

// Auth Listeners
onAuthStateChanged(auth, u => { if(u) handleUser(u); });
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
