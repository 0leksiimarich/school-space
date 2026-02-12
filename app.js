import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- КОНСТАНТИ ---
const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2";

// --- СТИСНЕННЯ ФОТО ---
async function compress(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 500; canvas.height = img.height * (500 / img.width);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- АВТОРИЗАЦІЯ (ФІКС ДУБЛІКАТІВ) ---
async function handleUser(u) {
    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, banned: false });
    }
    
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const data = (await getDoc(userRef)).data();
    document.getElementById('menu-avatar').src = data.photoURL;
    document.getElementById('profile-avatar-big').src = data.photoURL;
    document.getElementById('menu-username').innerText = data.displayName;
    document.getElementById('profile-name-big').innerText = data.displayName;

    loadFeed();
}

// --- СТРІЧКА ТА ПРОФІЛЬ ---
function renderPosts(snap, containerId, filterUid = null) {
    const cont = document.getElementById(containerId);
    cont.innerHTML = '';
    snap.forEach(d => {
        const p = d.data();
        if (filterUid && p.uid !== filterUid) return;
        
        const isLiked = p.likes?.includes(auth.currentUser.uid);
        const cmnts = (p.comments || []).map(c => `<div class="comment-item"><b>${c.name}:</b> ${c.text}</div>`).join('');

        cont.innerHTML += `
            <div class="post-card">
                <div class="post-header">
                    <img src="${p.authorAv}" class="post-author-av">
                    <b>${p.name}</b>
                    ${(p.uid === auth.currentUser.uid || auth.currentUser.uid === ADMIN_UID) ? `<i class="fas fa-trash" style="margin-left:auto; cursor:pointer; opacity:0.5;" onclick="deletePost('${d.id}')"></i>` : ''}
                </div>
                <div class="post-content">${p.text}</div>
                ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                <div style="margin-top:10px; display:flex; gap:15px; font-size:14px; color:var(--text-sec)">
                    <span onclick="toggleLike('${d.id}', ${isLiked})" style="cursor:pointer; color:${isLiked ? 'red' : ''}"><i class="fa${isLiked ? 's' : 'r'} fa-heart"></i> ${p.likes?.length || 0}</span>
                </div>
                <div style="margin-top:10px;">${cmnts}</div>
                <input type="text" class="comment-input" placeholder="Коментар..." onkeydown="if(event.key==='Enter') addComment('${d.id}', this)">
            </div>`;
    });
}

function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), s => renderPosts(s, 'feed-container'));
}

function loadMyPosts() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), s => renderPosts(s, 'my-posts-container', auth.currentUser.uid));
}

// --- ФУНКЦІЇ ВЗАЄМОДІЇ ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
    if(id === 'profile') loadMyPosts();
};

window.deletePost = async (id) => { if(confirm("Видалити?")) await deleteDoc(doc(db, "posts", id)); };

window.toggleLike = async (id, liked) => {
    await updateDoc(doc(db, "posts", id), { likes: liked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid) });
};

window.addComment = async (id, el) => {
    if (!el.value.trim()) return;
    await updateDoc(doc(db, "posts", id), { comments: arrayUnion({ name: auth.currentUser.displayName, text: el.value, at: Date.now() }) });
    el.value = '';
};

// --- ЗМІНА АВАТАРКИ ---
document.getElementById('av-change-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await compress(file);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: base64 });
    document.getElementById('profile-avatar-big').src = base64;
    document.getElementById('menu-avatar').src = base64;
    alert("Аватар оновлено!");
};

// --- СИСТЕМНІ ---
onAuthStateChanged(auth, u => { if(u) handleUser(u); else { document.getElementById('auth-container').classList.remove('hidden'); document.getElementById('app-container').classList.add('hidden'); }});
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('burger-btn').onclick = () => { document.getElementById('sidebar').classList.add('active'); document.getElementById('menu-overlay').classList.add('active'); };

document.getElementById('btn-publish').onclick = async () => {
    const t = document.getElementById('post-text');
    const f = document.getElementById('post-file-input');
    if(!t.value.trim() && !f.files[0]) return;
    const img = f.files[0] ? await compress(f.files[0]) : null;
    const uData = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();
    await addDoc(collection(collection(db, "posts")), {
        text: t.value, image: img, uid: auth.currentUser.uid, name: auth.currentUser.displayName, 
        authorAv: uData.photoURL, createdAt: serverTimestamp(), likes: [], comments: []
    });
    t.value = ''; f.value = '';
};
