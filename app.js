import { auth, db, googleProvider } from './firebase.js';
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signInWithPopup, onAuthStateChanged, signOut, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, updateDoc, setDoc, getDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; // ПЕРЕВІР СВІЙ UID В КОНСОЛІ!

// --- НАВІГАЦІЯ ---
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

// --- СТИСКАННЯ ФОТО (ЩОБ ПРАЦЮВАЛО НА ВСІХ ПРИСТРОЯХ) ---
async function compressImage(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 800;
                const scale = MAX_W / img.width;
                canvas.width = MAX_W;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// --- ПРИВ'ЯЗКА ПОДІЙ (ОЖИВЛЯЄМО КНОПКИ) ---
function init() {
    // Вкладки
    document.getElementById('tab-login-btn').onclick = () => {
        document.getElementById('form-login').classList.remove('hidden');
        document.getElementById('form-reg').classList.add('hidden');
        document.getElementById('tab-login-btn').classList.add('active');
        document.getElementById('tab-reg-btn').classList.remove('active');
    };
    document.getElementById('tab-reg-btn').onclick = () => {
        document.getElementById('form-login').classList.add('hidden');
        document.getElementById('form-reg').classList.remove('hidden');
        document.getElementById('tab-reg-btn').classList.add('active');
        document.getElementById('tab-login-btn').classList.remove('active');
    };

    // Авторизація
    document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, googleProvider);
    
    document.getElementById('btn-do-login').onclick = async () => {
        const e = document.getElementById('login-email').value;
        const p = document.getElementById('login-pass').value;
        try { await signInWithEmailAndPassword(auth, e, p); } catch(err) { alert("Помилка: " + err.message); }
    };

    document.getElementById('btn-do-reg').onclick = async () => {
        const name = document.getElementById('reg-name').value;
        const e = document.getElementById('reg-email').value;
        const p1 = document.getElementById('reg-pass1').value;
        const p2 = document.getElementById('reg-pass2').value;

        if (p1 !== p2) return alert("Паролі не збігаються!");
        if (p1.length < 6) return alert("Пароль має бути мін. 6 символів!");

        try {
            const cred = await createUserWithEmailAndPassword(auth, e, p1);
            await setDoc(doc(db, "users", cred.user.uid), {
                uid: cred.user.uid,
                displayName: name,
                city: document.getElementById('reg-city').value,
                school: document.getElementById('reg-school').value,
                class: document.getElementById('reg-class').value,
                photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                isAdmin: cred.user.uid === ADMIN_UID
            });
        } catch(err) { alert(err.message); }
    };

    document.getElementById('btn-reset-pass').onclick = async () => {
        const e = document.getElementById('login-email').value;
        if(!e) return alert("Введіть Email у поле вище!");
        try { 
            await sendPasswordResetEmail(auth, e); 
            alert("Лист для зміни пароля надіслано!");
        } catch(err) { alert(err.message); }
    };

    // Меню та Навігація
    document.getElementById('burger-btn').onclick = () => toggleMenu(true);
    document.getElementById('menu-overlay').onclick = () => toggleMenu(false);
    document.getElementById('nav-feed').onclick = () => goToPage('feed');
    document.getElementById('nav-chat').onclick = () => goToPage('chat');
    document.getElementById('nav-search').onclick = () => goToPage('search');
    document.getElementById('nav-profile').onclick = () => goToPage('profile');
    document.getElementById('nav-help').onclick = () => goToPage('help');
    document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());

    // Пости та Профіль
    document.getElementById('btn-pick-photo').onclick = () => document.getElementById('post-file-input').click();
    document.getElementById('btn-publish').onclick = handlePublish;
    document.getElementById('profile-avatar-big').onclick = () => document.getElementById('av-upload').click();
    document.getElementById('av-upload').onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const b64 = await compressImage(file);
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: b64 });
        location.reload();
    };
}

// --- ЛОГІКА ПУБЛІКАЦІЇ ---
async function handlePublish() {
    const txt = document.getElementById('post-text');
    const file = document.getElementById('post-file-input').files[0];
    if(!txt.value.trim() && !file) return;

    const btn = document.getElementById('btn-publish');
    btn.innerText = "...";
    btn.disabled = true;

    try {
        let b64 = file ? await compressImage(file) : null;
        const u = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();
        await addDoc(collection(db, "posts"), {
            uid: u.uid,
            name: u.displayName,
            authorAv: u.photoURL,
            text: txt.value,
            image: b64,
            createdAt: serverTimestamp()
        });
        txt.value = '';
        document.getElementById('post-file-input').value = '';
    } catch(e) { alert("Помилка публікації"); }
    finally { btn.innerText = "Опублікувати"; btn.disabled = false; }
}

// --- СТАН АВТОРИЗАЦІЇ ---
onAuthStateChanged(auth, async (user) => {
    const authCont = document.getElementById('auth-container');
    const appCont = document.getElementById('app-container');

    if (user) {
        const uRef = doc(db, "users", user.uid);
        let snap = await getDoc(uRef);
        
        if (!snap.exists()) {
            await setDoc(uRef, {
                uid: user.uid,
                displayName: user.displayName || "Учень",
                photoURL: user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                city: "Не вказано", school: "Школа", class: "?",
                isAdmin: user.uid === ADMIN_UID
            });
            snap = await getDoc(uRef);
        }

        const d = snap.data();
        document.getElementById('menu-avatar').src = d.photoURL;
        document.getElementById('profile-avatar-big').src = d.photoURL;
        document.getElementById('menu-username').innerText = d.displayName;
        document.getElementById('profile-name-big').innerText = d.displayName;
        document.getElementById('profile-info').innerText = `${d.school}, ${d.class} кл. (${d.city})`;
        
        if(d.isAdmin) document.getElementById('admin-tag').classList.remove('hidden');

        authCont.classList.add('hidden');
        appCont.classList.remove('hidden');
        loadPosts('feed-container');
    } else {
        authCont.classList.remove('hidden');
        appCont.classList.add('hidden');
    }
});

// --- ЗАВАНТАЖЕННЯ ДАНИХ ---
function loadPosts(contId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(contId);
        if(!cont) return;
        cont.innerHTML = '';
        snap.forEach(docSnap => {
            const p = docSnap.data();
            if(filterUid && p.uid !== filterUid) return;
            const isBoss = auth.currentUser && (auth.currentUser.uid === p.uid || auth.currentUser.uid === ADMIN_UID);
            
            cont.innerHTML += `
                <div class="post-card">
                    ${isBoss ? `<i class="fas fa-trash" onclick="window.delP('${docSnap.id}')" style="position:absolute; right:15px; top:15px; color:var(--danger); cursor:pointer; opacity:0.6;"></i>` : ''}
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.authorAv}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <b style="font-size:14px;">${p.name}</b>
                    </div>
                    <p style="white-space:pre-wrap; margin:0; line-height:1.4;">${p.text}</p>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                </div>`;
        });
    });
}

window.delP = async (id) => { if(confirm("Видалити цей запис?")) await deleteDoc(doc(db, "posts", id)); };

function loadUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('search-results');
        cont.innerHTML = '';
        snap.forEach(u => {
            const d = u.data();
            cont.innerHTML += `
                <div class="post-card" style="display:flex; align-items:center; gap:15px;">
                    <img src="${d.photoURL}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-weight:bold;">${d.displayName}</div>
                        <div style="font-size:12px; color:var(--accent);">${d.school}, ${d.class}</div>
                    </div>
                </div>`;
        });
    });
}

// Запуск
init();
