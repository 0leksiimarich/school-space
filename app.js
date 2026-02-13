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

// --- ФУНКЦІЇ СИСТЕМИ ---
const toggleMenu = (o) => {
    document.getElementById('sidebar').classList.toggle('active', o);
    document.getElementById('menu-overlay').classList.toggle('active', o);
};

const goToPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    toggleMenu(false);
    if(id === 'profile') loadPosts('my-posts-container', auth.currentUser?.uid);
    if(id === 'search') loadUsers();
};

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

// --- ГОЛОВНА ІНІЦІАЛІЗАЦІЯ (ЩОБ КНОПКИ ПРАЦЮВАЛИ) ---
function setupEventListeners() {
    // Вкладки
    document.getElementById('tab-login-btn').addEventListener('click', () => {
        document.getElementById('form-login').classList.remove('hidden');
        document.getElementById('form-reg').classList.add('hidden');
        document.getElementById('tab-login-btn').classList.add('active');
        document.getElementById('tab-reg-btn').classList.remove('active');
    });

    document.getElementById('tab-reg-btn').addEventListener('click', () => {
        document.getElementById('form-login').classList.add('hidden');
        document.getElementById('form-reg').classList.remove('hidden');
        document.getElementById('tab-reg-btn').classList.add('active');
        document.getElementById('tab-login-btn').classList.remove('active');
    });

    // Авторизація
    document.getElementById('btn-do-login').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const remember = document.getElementById('remember-checkbox').checked;

        try {
            // Запам'ятати мене (Local = назавжди, Session = до закриття вкладки)
            await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) { alert("Помилка: " + e.message); }
    });

    document.getElementById('btn-do-reg').addEventListener('click', async () => {
        const p1 = document.getElementById('reg-pass1').value;
        const p2 = document.getElementById('reg-pass2').value;
        if(p1 !== p2) return alert("Паролі не збігаються!");

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
    });

    document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, googleProvider));
    
    document.getElementById('btn-reset-pass').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        if(!email) return alert("Впишіть Email!");
        await sendPasswordResetEmail(auth, email);
        alert("Лист надіслано!");
    });

    // Навігація
    document.getElementById('burger-btn').addEventListener('click', () => toggleMenu(true));
    document.getElementById('menu-overlay').addEventListener('click', () => toggleMenu(false));
    document.getElementById('nav-feed').addEventListener('click', () => goToPage('feed'));
    document.getElementById('nav-search').addEventListener('click', () => goToPage('search'));
    document.getElementById('nav-profile').addEventListener('click', () => goToPage('profile'));
    document.getElementById('nav-help').addEventListener('click', () => goToPage('help'));
    document.getElementById('btn-logout').addEventListener('click', () => signOut(auth).then(() => location.reload()));

    // Пости
    document.getElementById('btn-pick-photo').addEventListener('click', () => document.getElementById('post-file-input').click());
    document.getElementById('btn-publish').addEventListener('click', handlePublish);
    document.getElementById('profile-avatar-big').addEventListener('click', () => document.getElementById('av-upload').click());
}

// --- ЛОГІКА ПУБЛІКАЦІЇ ---
async function handlePublish() {
    const txt = document.getElementById('post-text');
    const file = document.getElementById('post-file-input').files[0];
    if(!txt.value.trim() && !file) return;

    const btn = document.getElementById('btn-publish');
    btn.disabled = true; btn.innerText = "...";

    try {
        let b64 = file ? await compressImage(file) : null;
        const u = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();
        await addDoc(collection(db, "posts"), {
            uid: u.uid, name: u.displayName, authorAv: u.photoURL,
            text: txt.value, image: b64, createdAt: serverTimestamp()
        });
        txt.value = ''; document.getElementById('post-file-input').value = '';
    } catch(e) { alert("Помилка"); }
    finally { btn.disabled = false; btn.innerText = "Опублікувати"; }
}

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
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.authorAv}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <b>${p.name}</b>
                    </div>
                    <p>${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

window.delP = async (id) => { if(confirm("Видалити?")) await deleteDoc(doc(db, "posts", id)); };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if(snap.exists()){
            const d = snap.data();
            document.getElementById('menu-avatar').src = d.photoURL;
            document.getElementById('profile-avatar-big').src = d.photoURL;
            document.getElementById('menu-username').innerText = d.displayName;
            document.getElementById('profile-name-big').innerText = d.displayName;
            document.getElementById('profile-info').innerText = `${d.school}, ${d.class} кл.`;
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

// Запуск подій
setupEventListeners();
