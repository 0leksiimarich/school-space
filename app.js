import { auth, db, googleProvider } from './firebase.js';
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signInWithPopup, onAuthStateChanged, signOut, sendPasswordResetEmail,
    setPersistence, browserLocalPersistence, browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, updateDoc, setDoc, getDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2";

// --- ГЛОБАЛЬНІ ФУНКЦІЇ (Тепер кнопки їх побачать!) ---

window.toggleMenu = (open) => {
    document.getElementById('sidebar').classList.toggle('active', open);
    document.getElementById('menu-overlay').classList.toggle('active', open);
};

window.goToPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${id}`);
    if (target) target.classList.remove('hidden');
    window.toggleMenu(false);
    if(id === 'profile') loadPosts('my-posts-container', auth.currentUser?.uid);
    if(id === 'search') loadUsers();
};

window.switchAuthTab = (type) => {
    const isLogin = type === 'login';
    document.getElementById('form-login').classList.toggle('hidden', !isLogin);
    document.getElementById('form-reg').classList.toggle('hidden', isLogin);
    document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
    document.getElementById('tab-reg-btn').classList.toggle('active', !isLogin);
};

// --- СТИСКАННЯ ФОТО ---
async function compressImage(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 800 / img.width;
                canvas.width = 800; canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// --- ПРИВ'ЯЗКА ПОДІЙ ---
document.addEventListener('DOMContentLoaded', () => {
    // Вкладки
    document.getElementById('tab-login-btn').onclick = () => window.switchAuthTab('login');
    document.getElementById('tab-reg-btn').onclick = () => window.switchAuthTab('reg');

    // Вхід
    document.getElementById('btn-do-login').onclick = async () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const remember = document.getElementById('remember-checkbox').checked;
        try {
            await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) { alert("Помилка: " + e.message); }
    };

    // Реєстрація
    document.getElementById('btn-do-reg').onclick = async () => {
        const p1 = document.getElementById('reg-pass1').value;
        const p2 = document.getElementById('reg-pass2').value;
        if(p1 !== p2) return alert("Паролі Onepassword та 2Password не збігаються!");
        try {
            const cred = await createUserWithEmailAndPassword(auth, document.getElementById('reg-email').value, p1);
            await setDoc(doc(db, "users", cred.user.uid), {
                uid: cred.user.uid,
                displayName: document.getElementById('reg-name').value,
                city: document.getElementById('reg-city').value,
                school: document.getElementById('reg-school').value,
                class: document.getElementById('reg-class').value,
                photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                isAdmin: cred.user.uid === ADMIN_UID
            });
        } catch (e) { alert(e.message); }
    };

    // Інші кнопки
    document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('burger-btn').onclick = () => window.toggleMenu(true);
    document.getElementById('menu-overlay').onclick = () => window.toggleMenu(false);
    document.getElementById('nav-feed').onclick = () => window.goToPage('feed');
    document.getElementById('nav-search').onclick = () => window.goToPage('search');
    document.getElementById('nav-profile').onclick = () => window.goToPage('profile');
    document.getElementById('nav-help').onclick = () => window.goToPage('help');
    document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
    document.getElementById('btn-pick-photo').onclick = () => document.getElementById('post-file-input').click();
    document.getElementById('btn-publish').onclick = handlePublish;
    
    document.getElementById('btn-reset-pass').onclick = async () => {
        const email = document.getElementById('login-email').value;
        if(!email) return alert("Введіть email!");
        await sendPasswordResetEmail(auth, email);
        alert("Лист для зміни пароля надіслано!");
    };
});

// --- ПУБЛІКАЦІЯ ---
async function handlePublish() {
    const txt = document.getElementById('post-text');
    const file = document.getElementById('post-file-input').files[0];
    if(!txt.value.trim() && !file) return;
    const btn = document.getElementById('btn-publish');
    btn.disabled = true;
    try {
        let b64 = file ? await compressImage(file) : null;
        const u = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();
        await addDoc(collection(db, "posts"), {
            uid: u.uid, name: u.displayName, authorAv: u.photoURL,
            text: txt.value, image: b64, createdAt: serverTimestamp()
        });
        txt.value = ''; document.getElementById('post-file-input').value = '';
    } catch(e) { alert("Помилка"); }
    finally { btn.disabled = false; }
}

// --- СТАН AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if(snap.exists()){
            const d = snap.data();
            document.getElementById('menu-avatar').src = d.photoURL;
            document.getElementById('menu-username').innerText = d.displayName;
            document.getElementById('profile-avatar-big').src = d.photoURL;
            document.getElementById('profile-name-big').innerText = d.displayName;
            document.getElementById('profile-info').innerText = `${d.school}, ${d.class} клас`;
            if(d.isAdmin) document.getElementById('admin-tag').classList.remove('hidden');
        }
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadPosts('feed-container');
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- ЗАВАНТАЖЕННЯ ДАНИХ ---
function loadPosts(contId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(contId);
        if(!cont) return; cont.innerHTML = '';
        snap.forEach(s => {
            const p = s.data();
            if(filterUid && p.uid !== filterUid) return;
            const isMe = auth.currentUser && (auth.currentUser.uid === p.uid || auth.currentUser.uid === ADMIN_UID);
            cont.innerHTML += `
                <div class="post-card">
                    ${isMe ? `<i class="fas fa-trash" onclick="window.delP('${s.id}')" style="position:absolute; right:15px; top:15px; color:var(--danger); cursor:pointer;"></i>` : ''}
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.authorAv}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <b>${p.name}</b>
                    </div>
                    <p style="margin:10px 0;">${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

window.delP = async (id) => { if(confirm("Видалити?")) await deleteDoc(doc(db, "posts", id)); };

function loadUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('search-results');
        cont.innerHTML = '<h3>Учасники</h3>';
        snap.forEach(u => {
            const d = u.data();
            cont.innerHTML += `
                <div class="post-card" style="display:flex; align-items:center; gap:15px;">
                    <img src="${d.photoURL}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <div><b>${d.displayName}</b><br><small>${d.school}</small></div>
                </div>`;
        });
    });
}
