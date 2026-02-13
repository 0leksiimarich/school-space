import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ФУНКЦІЯ СТИСКАННЯ ФОТО (ЩОБ ПРАЦЮВАЛО ВСЮДИ) ---
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Оптимальний розмір
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                // Якість 0.7 ідеальна для Firestore
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- НАВІГАЦІЯ ---
window.toggleMenu = (open) => {
    document.getElementById('sidebar').classList.toggle('active', open);
    document.getElementById('menu-overlay').classList.toggle('active', open);
};

window.goToPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    window.toggleMenu(false);
    if (id === 'profile') loadPosts('my-posts-container', auth.currentUser.uid);
};

// --- КОРИСТУВАЧ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        let snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL });
            snap = await getDoc(userRef);
        }
        const data = snap.data();
        document.getElementById('menu-avatar').src = data.photoURL;
        document.getElementById('profile-avatar-big').src = data.photoURL;
        document.getElementById('menu-username').innerText = data.displayName;
        document.getElementById('profile-name-big').innerText = data.displayName;
        
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadPosts('feed-container');
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- ПОСТИ ---
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
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.authorAv}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <b>${p.name}</b>
                    </div>
                    <p style="white-space:pre-wrap;">${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

// Кнопка публікації
document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text');
    const file = document.getElementById('post-file-input').files[0];
    if (!txt.value.trim() && !file) return;

    const btn = document.getElementById('btn-publish');
    btn.disabled = true;
    btn.innerText = "...";

    let base64 = null;
    if (file) base64 = await compressImage(file);

    try {
        await addDoc(collection(db, "posts"), {
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            authorAv: document.getElementById('menu-avatar').src,
            text: txt.value,
            image: base64,
            createdAt: serverTimestamp()
        });
        txt.value = '';
        document.getElementById('post-file-input').value = '';
    } catch (e) {
        alert("Помилка завантаження");
    } finally {
        btn.disabled = false;
        btn.innerText = "Опублікувати";
    }
};

// Зміна аватара
document.getElementById('av-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await compressImage(file);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: base64 });
    location.reload();
};

// Вхід / Вихід
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
