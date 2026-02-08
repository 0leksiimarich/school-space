import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; // Твій UID

// --- СТИСНЕННЯ (Важливо для стабільності!) ---
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
                resolve(canvas.toDataURL('image/jpeg', 0.6)); // Якість 60%
            };
        };
    });
}

// --- НАВІГАЦІЯ ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
    if(pageId === 'contacts') loadAllUsers();
};

document.getElementById('burger-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('menu-overlay').classList.add('active');
};

// --- ФУНКЦІЇ АДМІНА ---
window.banUser = async (uid) => {
    if(confirm("Ви впевнені, що хочете забанити цього користувача?")) {
        await updateDoc(doc(db, "users", uid), { banned: true });
        alert("Користувача забанено!");
    }
};

window.deletePost = async (id) => {
    if(confirm("Видалити цей пост?")) {
        await deleteDoc(doc(db, "posts", id));
    }
};

// --- ЗАВАНТАЖЕННЯ ЛЮДЕЙ ---
function loadAllUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('all-users-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const u = d.data();
            if (d.id === auth.currentUser.uid) return;
            const isAdmin = auth.currentUser.uid === ADMIN_UID;
            cont.innerHTML += `
                <div class="contact-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${u.customAvatar || 'https://ui-avatars.com/api/?name='+u.displayName}" style="width:40px; height:40px; border-radius:50%">
                        <span>${u.displayName} ${u.banned ? '<b style="color:red">[BAN]</b>' : ''}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="tg-btn-small" onclick="toggleFollow('${d.id}')">Підписка</button>
                        ${isAdmin ? `<button class="tg-btn-small btn-danger" onclick="banUser('${d.id}')">БАН</button>` : ''}
                    </div>
                </div>`;
        });
    });
}

// --- ЗАВАНТАЖЕННЯ СТРІЧКИ ---
function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const isAdmin = auth.currentUser.uid === ADMIN_UID;
            cont.innerHTML += `
                <div class="post-card">
                    <div style="display:flex; justify-content:space-between">
                        <b>${p.name}</b>
                        ${isAdmin ? `<i class="fas fa-trash" style="color:red; cursor:pointer" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

// --- ПЕРЕВІРКА СТАНУ АКАУНТА ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        // Перевірка на бан або видалення
        if (userDoc.exists() && userDoc.data().banned) {
            document.getElementById('ban-screen').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            signOut(auth);
            return;
        }

        // Якщо акаунт нормальний
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        // Створення/оновлення профілю
        if (!userDoc.exists()) {
            await setDoc(userRef, { displayName: user.displayName, email: user.email, banned: false, following: [] });
        }

        const av = userDoc.data()?.customAvatar || user.photoURL;
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

// --- ПУБЛІКАЦІЯ (З захистом від дублів) ---
document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text').value;
    const file = document.getElementById('post-file-input').files[0];
    const btn = document.getElementById('btn-publish');
    
    if (!txt && !file) return;
    btn.disabled = true;
    
    try {
        let img = file ? await compressImage(file) : null;
        await addDoc(collection(db, "posts"), {
            text: txt, image: img, uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = "";
    } catch (e) { alert("Помилка! Можливо, фото завелике."); }
    
    btn.disabled = false;
};

// Решта кнопок
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider).catch(() => alert("Помилка входу! Перевірте інтернет."));
document.getElementById('btn-logout').onclick = () => signOut(auth);
document.getElementById('menu-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};
