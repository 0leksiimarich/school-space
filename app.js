import { auth, db } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, updateDoc, setDoc, getDoc, deleteDoc, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; // Твій UID

// --- НАВІГАЦІЯ ТА ВКЛАДКИ ---
window.toggleMenu = (o) => {
    document.getElementById('sidebar').classList.toggle('active', o);
    document.getElementById('menu-overlay').classList.toggle('active', o);
};

window.goToPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    window.toggleMenu(false);
    if(id === 'profile') loadPosts('my-posts-container', auth.currentUser.uid);
    if(id === 'search') loadUsers();
};

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

// --- СТИСКАННЯ ЗОБРАЖЕНЬ (ФІКС ВІДПРАВКИ) ---
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
                canvas.width = 800;
                canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// --- РЕЄСТРАЦІЯ ТА ВХІД ---
document.getElementById('btn-do-reg').onclick = async () => {
    const name = document.getElementById('reg-name').value;
    const city = document.getElementById('reg-city').value;
    const school = document.getElementById('reg-school').value;
    const klass = document.getElementById('reg-class').value;
    const email = document.getElementById('reg-email').value;
    const pass1 = document.getElementById('reg-pass1').value; // Onepassword
    const pass2 = document.getElementById('reg-pass2').value; // 2Password

    if(!name || !email || !pass1) return alert("Заповніть основні поля!");
    if(pass1 !== pass2) return alert("Паролі не збігаються!");

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass1);
        await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            displayName: name,
            city, school, class: klass,
            photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            isAdmin: cred.user.uid === ADMIN_UID
        });
        location.reload();
    } catch (e) { alert("Помилка реєстрації: " + e.message); }
};

document.getElementById('btn-do-login').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Помилка входу: " + e.message); }
};

// --- СТАН АВТОРИЗАЦІЇ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        
        document.getElementById('menu-avatar').src = data.photoURL;
        document.getElementById('profile-avatar-big').src = data.photoURL;
        document.getElementById('menu-username').innerText = data.displayName;
        document.getElementById('profile-name-big').innerText = data.displayName;
        document.getElementById('profile-info').innerText = `${data.school}, ${data.class} клас (${data.city})`;
        
        if(data.isAdmin) document.getElementById('admin-tag').classList.remove('hidden');

        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadPosts('feed-container');
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- ПОШУК УЧАСНИКІВ ---
async function loadUsers() {
    onSnapshot(collection(db, "users"), (snap) => {
        const cont = document.getElementById('search-results');
        cont.innerHTML = '';
        snap.forEach(u => {
            const d = u.data();
            cont.innerHTML += `
                <div class="post-card" style="display:flex; align-items:center; gap:15px;">
                    <img src="${d.photoURL}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div>
                        <b>${d.displayName}</b><br>
                        <small style="color:var(--accent)">${d.school}, ${d.class}</small>
                    </div>
                </div>`;
        });
    });
}

// --- ПОСТИ (З АДМІН-ФУНКЦІЯМИ) ---
function loadPosts(contId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(contId);
        if(!cont) return;
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if(filterUid && p.uid !== filterUid) return;
            
            const canDelete = (auth.currentUser.uid === p.uid) || (auth.currentUser.uid === ADMIN_UID);

            cont.innerHTML += `
                <div class="post-card">
                    ${canDelete ? `<i class="fas fa-trash" onclick="deletePost('${d.id}')" style="position:absolute; right:15px; top:15px; color:var(--danger); cursor:pointer; opacity:0.5;"></i>` : ''}
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

window.deletePost = async (id) => { if(confirm("Видалити пост?")) await deleteDoc(doc(db, "posts", id)); };

document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text');
    const file = document.getElementById('post-file-input').files[0];
    if(!txt.value.trim() && !file) return;

    let base64 = file ? await compressImage(file) : null;
    const userData = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();

    await addDoc(collection(db, "posts"), {
        uid: auth.currentUser.uid,
        name: userData.displayName,
        authorAv: userData.photoURL,
        text: txt.value,
        image: base64,
        createdAt: serverTimestamp()
    });
    txt.value = ''; document.getElementById('post-file-input').value = '';
};

document.getElementById('av-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const base64 = await compressImage(file);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: base64 });
    location.reload();
};

document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
