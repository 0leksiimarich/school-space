import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАВІГАЦІЯ (ПРАЦЮЄ ЗАВЖДИ) ---
window.toggleMenu = (open) => {
    const side = document.getElementById('sidebar');
    const over = document.getElementById('menu-overlay');
    if (open) {
        side.classList.add('active');
        over.classList.add('active');
    } else {
        side.classList.remove('active');
        over.classList.remove('active');
    }
};

window.goToPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${id}`);
    if (target) target.classList.remove('hidden');
    window.toggleMenu(false);
    
    if (id === 'profile') loadPosts('my-posts-container', auth.currentUser.uid);
};

// --- ОСНОВНА ЛОГІКА КОРУСТУВАЧА ---
onAuthStateChanged(auth, async (user) => {
    const authBox = document.getElementById('auth-container');
    const appBox = document.getElementById('app-container');

    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            let snap = await getDoc(userRef);
            
            if (!snap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL || 'https://via.placeholder.com/150'
                });
                snap = await getDoc(userRef);
            }
            
            const data = snap.data();
            document.getElementById('menu-avatar').src = data.photoURL;
            document.getElementById('profile-avatar-big').src = data.photoURL;
            document.getElementById('menu-username').innerText = data.displayName;
            document.getElementById('profile-name-big').innerText = data.displayName;

            authBox.classList.add('hidden');
            appBox.classList.remove('hidden');
            loadPosts('feed-container');
        } catch (err) {
            console.error("Помилка БД:", err);
        }
    } else {
        authBox.classList.remove('hidden');
        appBox.classList.add('hidden');
    }
});

// --- РОБОТА З ПОСТАМИ ---
function loadPosts(containerId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(containerId);
        if (!cont) return;
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (filterUid && p.uid !== filterUid) return;
            
            cont.innerHTML += `
                <div class="post-card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.authorAv}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <b style="font-size:14px;">${p.name}</b>
                    </div>
                    <div style="font-size:15px; line-height:1.4; word-wrap:break-word;">${p.text}</div>
                </div>`;
        });
    });
}

// Подія публікації
document.getElementById('btn-publish').onclick = async () => {
    const input = document.getElementById('post-text');
    if (!input.value.trim()) return;

    try {
        await addDoc(collection(db, "posts"), {
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            authorAv: document.getElementById('menu-avatar').src,
            text: input.value,
            createdAt: serverTimestamp()
        });
        input.value = '';
    } catch (e) {
        alert("Помилка публікації");
    }
};

// Зміна аватара
document.getElementById('av-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: reader.result });
        location.reload();
    };
    reader.readAsDataURL(file);
};

// Вхід / Вихід
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider).catch(e => alert(e.message));
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
