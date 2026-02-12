import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2";

// --- УТИЛІТИ ---
async function compressImage(file, size = 500) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = size / img.width;
                canvas.width = size;
                canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- СИНХРОНІЗАЦІЯ ПРОФІЛЮ (ФІКС ДУБЛІКАТІВ) ---
async function syncUserProfile(u) {
    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        await setDoc(userRef, {
            uid: u.uid,
            displayName: u.displayName,
            photoURL: u.photoURL,
            banned: false
        });
    }

    const currentData = (await getDoc(userRef)).data();
    updateUI(currentData);
}

function updateUI(data) {
    document.getElementById('menu-avatar').src = data.photoURL;
    document.getElementById('profile-avatar-big').src = data.photoURL;
    document.getElementById('menu-username').innerText = data.displayName;
    document.getElementById('profile-name-big').innerText = data.displayName;
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

// --- ВІДОБРАЖЕННЯ ПОСТІВ (УНІВЕРСАЛЬНЕ) ---
function loadPosts(containerId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(containerId);
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (filterUid && p.uid !== filterUid) return;

            const isLiked = p.likes?.includes(auth.currentUser.uid);
            const cmnts = (p.comments || []).map(c => `
                <div class="comment-item"><b>${c.name}:</b> ${c.text}</div>
            `).join('');

            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv}" class="post-author-av">
                        <b>${p.name}</b>
                        ${(p.uid === auth.currentUser.uid || auth.currentUser.uid === ADMIN_UID) ? 
                          `<i class="fas fa-trash" style="margin-left:auto; opacity:0.4; cursor:pointer;" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <div class="post-content">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                    <div style="margin-top:12px; display:flex; gap:15px; border-top:1px solid var(--border); padding-top:10px;">
                        <span onclick="toggleLike('${d.id}', ${isLiked})" style="cursor:pointer; color:${isLiked ? '#ff5959' : ''}">
                            <i class="fa${isLiked ? 's' : 'r'} fa-heart"></i> ${p.likes?.length || 0}
                        </span>
                    </div>
                    <div style="margin-top:10px;">${cmnts}</div>
                    <input type="text" class="comment-input" placeholder="Напишіть коментар..." onkeydown="if(event.key==='Enter') sendComment('${d.id}', this)">
                </div>`;
        });
    });
}

// --- ЗМІНА АВАТАРКИ ---
document.getElementById('av-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await compressImage(file, 300);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: base64 });
    alert("Аватарку оновлено!");
};

// --- СИСТЕМНІ ФУНКЦІЇ ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
    
    if (id === 'feed') loadPosts('feed-container');
    if (id === 'profile') loadPosts('my-posts-container', auth.currentUser.uid);
};

window.deletePost = async (id) => { if(confirm("Видалити пост?")) await deleteDoc(doc(db, "posts", id)); };

window.toggleLike = async (id, liked) => {
    const ref = doc(db, "posts", id);
    await updateDoc(ref, { likes: liked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid) });
};

window.sendComment = async (id, el) => {
    if (!el.value.trim()) return;
    await updateDoc(doc(db, "posts", id), {
        comments: arrayUnion({ name: auth.currentUser.displayName, text: el.value, at: Date.now() })
    });
    el.value = '';
};

// --- КНОПКИ ---
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};
document.getElementById('menu-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};

document.getElementById('btn-publish').onclick = async () => {
    const t = document.getElementById('post-text');
    const f = document.getElementById('post-file-input');
    if (!t.value.trim() && !f.files[0]) return;
    
    const img = f.files[0] ? await compressImage(f.files[0]) : null;
    const userData = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();

    await addDoc(collection(db, "posts"), {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName,
        authorAv: userData.photoURL,
        text: t.value,
        image: img,
        createdAt: serverTimestamp(),
        likes: [],
        comments: []
    });
    t.value = ''; f.value = '';
};

onAuthStateChanged(auth, u => {
    if (u) {
        syncUserProfile(u);
        loadPosts('feed-container');
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});
   
