import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; // ТВІЙ UID
let isInitialLoad = true;

// --- ПЛЮШКИ ---
function sendPush(title, msg) {
    if (Notification.permission === "granted" && !isInitialLoad) {
        new Notification(title, { body: msg, icon: "https://i.ibb.co/mF7mXyS/logo.png" });
    }
}

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

// --- ЛОГІКА ПОСТІВ (ЛАЙКИ, КОМЕНТАРІ) ---
window.toggleLike = async (postId, isLiked) => {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
    });
};

window.addComment = async (postId) => {
    const input = document.getElementById(`cmnt-in-${postId}`);
    if (!input.value.trim()) return;
    await updateDoc(doc(db, "posts", postId), {
        comments: arrayUnion({
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            text: input.value,
            at: Date.now()
        })
    });
    input.value = '';
};

// --- АДМІН ФУНКЦІЇ ---
window.banUser = (id) => { if(confirm("ЗАТИРАЄМО?")) updateDoc(doc(db, "users", id), { banned: true }); };
window.unbanUser = (id) => { if(confirm("ПРОБАЧАЄМО?")) updateDoc(doc(db, "users", id), { banned: false }); };
window.deletePost = (id) => { if(confirm("ВИДАЛИТИ?")) deleteDoc(doc(db, "posts", id)); };

// --- ЗАВАНТАЖЕННЯ ДАНИХ ---
function loadFeed(filter = "") {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (filter && !p.text.toLowerCase().includes(filter.toLowerCase())) return;
            
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            const liked = p.likes?.includes(auth.currentUser.uid);
            const commentsHtml = (p.comments || []).map(c => `<div style="font-size:13px; margin:3px 0;"><b>${c.name}:</b> ${c.text}</div>`).join('');

            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv || 'https://ui-avatars.com/api/?name='+p.name}" class="post-author-av">
                        <div style="flex-grow:1"><b>${p.name}</b></div>
                        ${isAdmin ? `<i class="fas fa-trash-alt" style="color:var(--danger); cursor:pointer" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <div style="white-space:pre-wrap">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                    <div class="post-actions">
                        <div class="action-btn ${liked ? 'active' : ''}" onclick="toggleLike('${d.id}', ${liked})">
                            <i class="fa${liked ? 's' : 'r'} fa-heart"></i> ${p.likes?.length || 0}
                        </div>
                        <div class="action-btn"><i class="far fa-comment"></i> ${p.comments?.length || 0}</div>
                    </div>
                    <div class="comment-section">
                        ${commentsHtml}
                        <input type="text" id="cmnt-in-${d.id}" class="comment-input" placeholder="Коментувати..." onkeydown="if(event.key==='Enter') addComment('${d.id}')">
                    </div>
                </div>`;
        });
        isInitialLoad = false;
    });
}

function loadBanned() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('banned-users-list');
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            if(u.banned) {
                cont.innerHTML += `<div class="post-card" style="display:flex; justify-content:space-between">
                    <span>${u.displayName}</span>
                    <button class="tg-btn-small" onclick="unbanUser('${d.id}')">РОЗБАН</button>
                </div>`;
            }
        });
    });
}

// --- СИСТЕМНІ ПОДІЇ ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('burger-btn').onclick = () => {
        document.getElementById('sidebar').classList.add('active');
        document.getElementById('menu-overlay').classList.add('active');
    };
    document.getElementById('menu-overlay').onclick = () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('menu-overlay').classList.remove('active');
    };
    document.getElementById('search-input').oninput = (e) => loadFeed(e.target.value);

    document.getElementById('btn-publish').onclick = async () => {
        const txt = document.getElementById('post-text').value;
        const file = document.getElementById('post-file-input').files[0];
        if(!txt.trim() && !file) return;
        const img = file ? await compress(file) : null;
        await addDoc(collection(db, "posts"), {
            text: txt, image: img, uid: auth.currentUser.uid, name: auth.currentUser.displayName,
            authorAv: auth.currentUser.photoURL, createdAt: serverTimestamp(), likes: [], comments: []
        });
        document.getElementById('post-text').value = "";
    };

    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists() && uDoc.data().banned) {
            document.getElementById('ban-screen').classList.remove('hidden');
            return;
        }
        if (!uDoc.exists()) await setDoc(doc(db, "users", user.uid), { displayName: user.displayName, banned: false });
        
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('menu-avatar').src = user.photoURL;
        document.getElementById('profile-avatar-big').src = user.photoURL;
        document.getElementById('menu-username').innerText = user.displayName;
        document.getElementById('profile-name-big').innerText = user.displayName;
        
        if(user.uid === ADMIN_UID) {
            document.getElementById('admin-link').style.display = 'flex';
            loadBanned();
        }
        Notification.requestPermission();
        loadFeed();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};
