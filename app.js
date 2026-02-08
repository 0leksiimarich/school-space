import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; // Твій UID
let isInitialLoad = true;

// --- ПЛЮШКИ: Сповіщення ---
function sendPush(title, msg) {
    if (Notification.permission === "granted" && !isInitialLoad) {
        new Notification(title, { body: msg, icon: "https://cdn-icons-png.flaticon.com/512/1182/1182769.png" });
    }
}

// --- ПЛЮШКИ: Медіа ---
async function compress(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 600; canvas.height = img.height * (600 / img.width);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

function getVideo(text) {
    const m = text.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (m && m[2].length === 11) ? `<div class="video-container"><iframe src="https://www.youtube.com/embed/${m[2]}" frameborder="0" allowfullscreen></iframe></div>` : '';
}

// --- ЛОГІКА САЙТУ ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
    if(id === 'contacts') loadUsers();
};

window.deletePost = (id) => { if(confirm("Видалити?")) deleteDoc(doc(db, "posts", id)); };
window.banUser = (id) => { if(confirm("БАН?")) updateDoc(doc(db, "users", id), { banned: true }); };

function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const p = change.doc.data();
                sendPush(`Новий пост від ${p.name}`, p.text);
            }
        });

        snap.forEach(d => {
            const p = d.data();
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            cont.innerHTML += `
                <div class="post-card">
                    <div style="display:flex; justify-content:space-between">
                        <b>${p.name}</b>
                        ${isAdmin ? `<i class="fas fa-trash" style="color:var(--danger)" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <p style="white-space:pre-wrap">${p.text}</p>
                    ${getVideo(p.text || '')}
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
        isInitialLoad = false;
    });
}

function loadUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('all-users-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            if(d.id === auth.currentUser?.uid) return;
            cont.innerHTML += `<div class="post-card" style="display:flex; justify-content:space-between; align-items:center">
                <span>${u.displayName} ${u.banned ? '🔴' : '🟢'}</span>
                ${auth.currentUser?.uid === ADMIN_UID && !u.banned ? `<button class="tg-btn-small" style="background:red" onclick="banUser('${d.id}')">БАН</button>` : ''}
            </div>`;
        });
    });
}

// --- ОБРОБНИКИ ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('burger-btn').onclick = () => {
        document.getElementById('sidebar').classList.add('active');
        document.getElementById('menu-overlay').classList.add('active');
    };
    document.getElementById('menu-overlay').onclick = () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('menu-overlay').classList.remove('active');
    };

    document.getElementById('btn-publish').onclick = async () => {
        const btn = document.getElementById('btn-publish');
        const txt = document.getElementById('post-text').value;
        const file = document.getElementById('post-file-input').files[0];
        if(!txt.trim() && !file) return;
        btn.disabled = true;
        const img = file ? await compress(file) : null;
        await addDoc(collection(db, "posts"), { text: txt, image: img, name: auth.currentUser.displayName, createdAt: serverTimestamp() });
        document.getElementById('post-text').value = "";
        btn.disabled = false;
    };

    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    document.getElementById('avatar-upload').onchange = async (e) => {
        const file = e.target.files[0];
        if(file) {
            const base64 = await compress(file);
            await updateDoc(doc(db, "users", auth.currentUser.uid), { customAvatar: base64 });
            location.reload();
        }
    };
});

onAuthStateChanged(auth, async (u) => {
    if (u) {
        const d = await getDoc(doc(db, "users", u.uid));
        if (d.exists() && d.data().banned) {
            document.getElementById('ban-screen').classList.remove('hidden');
            return;
        }
        if (!d.exists()) await setDoc(doc(db, "users", u.uid), { displayName: u.displayName, banned: false });
        
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('menu-avatar').src = d.data()?.customAvatar || u.photoURL;
        document.getElementById('profile-avatar-big').src = d.data()?.customAvatar || u.photoURL;
        document.getElementById('menu-username').innerText = u.displayName;
        document.getElementById('profile-name-big').innerText = u.displayName;
        
        Notification.requestPermission();
        loadFeed();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});
