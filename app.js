import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; // Твій UID для доступу до кнопок бану

// --- СТИСНЕННЯ МЕДІА ---
async function compressImage(file, maxWidth = 600) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = maxWidth / img.width;
                canvas.width = maxWidth; canvas.height = img.height * ratio;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// Функція розпізнавання YouTube посилань
function getYouTubeEmbed(text) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = text.match(regExp);
    if (match && match[2].length === 11) {
        return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${match[2]}" frameborder="0" allowfullscreen></iframe></div>`;
    }
    return '';
}

// --- НАВІГАЦІЯ ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
    
    const titles = {feed:'Стрічка', contacts:'Учасники', help:'Поміч', profile:'Мій Профіль'};
    document.getElementById('page-title').innerText = titles[pageId] || 'SchoolSpace';
    
    if(pageId === 'contacts') loadAllUsers();
};

document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};

// --- АДМІН-ФУНКЦІЇ ---
window.banUser = async (uid) => {
    if(confirm("ЗАБАННИТИ користувача назавжди?")) {
        await updateDoc(doc(db, "users", uid), { banned: true });
    }
};

window.deletePost = async (id) => {
    if(confirm("Видалити цей пост?")) await deleteDoc(doc(db, "posts", id));
};

// --- ЗАВАНТАЖЕННЯ ДАНИХ ---
function loadAllUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('all-users-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            if (d.id === auth.currentUser.uid) return;
            const isAdmin = auth.currentUser.uid === ADMIN_UID;
            cont.innerHTML += `
                <div class="post-card" style="display:flex; align-items:center; justify-content:space-between; padding:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${u.customAvatar || 'https://ui-avatars.com/api/?name='+u.displayName}" style="width:40px; height:40px; border-radius:50%">
                        <span>${u.displayName} ${u.banned ? '<b style="color:red">[BAN]</b>' : ''}</span>
                    </div>
                    ${isAdmin ? `<button class="tg-btn-small" style="background:var(--danger)" onclick="banUser('${d.id}')">БАН</button>` : ''}
                </div>`;
        });
    });
}

function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            const videoEmbed = getYouTubeEmbed(p.text || '');
            
            cont.innerHTML += `
                <div class="post-card">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <b style="color:var(--accent)">${p.name}</b>
                        ${isAdmin ? `<i class="fas fa-trash" style="color:var(--danger); cursor:pointer" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <div style="white-space: pre-wrap;">${p.text}</div>
                    ${videoEmbed}
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

// --- АВТОРИЗАЦІЯ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists() && userDoc.data().banned) {
            document.getElementById('ban-screen').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            signOut(auth); return;
        }

        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        if (!userDoc.exists()) {
            await setDoc(userRef, { displayName: user.displayName, email: user.email, banned: false });
        }

        const uData = (await getDoc(userRef)).data();
        const av = uData.customAvatar || user.photoURL;
        document.getElementById('menu-avatar').src = av;
        document.getElementById('profile-avatar-big').src = av;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-name-big').innerText = user.displayName;
        loadFeed();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- КНОПКИ ---
document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text').value;
    const file = document.getElementById('post-file-input').files[0];
    const btn = document.getElementById('btn-publish');
    if (!txt.trim() && !file) return;
    btn.disabled = true;
    try {
        let img = file ? await compressImage(file) : null;
        await addDoc(collection(db, "posts"), {
            text: txt, image: img, uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
        document.getElementById('post-file-input').value = "";
    } catch (e) { alert("Помилка завантаження!"); }
    btn.disabled = false;
};

document.getElementById('avatar-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(file) {
        const base64 = await compressImage(file, 400);
        await updateDoc(doc(doc(db, "users", auth.currentUser.uid)), { customAvatar: base64 });
        location.reload();
    }
};

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('menu-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};
