import { auth, db, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ HTML ---
window.showStep = (step) => {
    document.getElementById('auth-initial').classList.add('hidden');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    if (step === 1) document.getElementById('step-1').classList.remove('hidden');
    if (step === 2) document.getElementById('step-2').classList.remove('hidden');
};

window.switchPage = (pageId, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('page-title').textContent = pageId === 'feed' ? 'Головна' : pageId === 'messages' ? 'Чати' : 'Профіль';
};

// --- АВАТАРКИ ---
let selectedAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";
const avatarList = document.getElementById('avatar-list');
if(avatarList) {
    ['Aneka', 'Felix', 'Luna', 'Max', 'Buddy', 'Jack', 'Misty', 'Leo'].forEach(seed => {
        const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
        const img = document.createElement('img');
        img.src = url; img.className = 'avatar-opt';
        img.onclick = () => {
            document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected'); selectedAvatar = url;
        };
        avatarList.appendChild(img);
    });
}

// --- АВТОРИЗАЦІЯ ---
document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert(e.message); }
};

document.getElementById('btn-finish-reg').onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('reg-pass').value;
    const name = document.getElementById('reg-name').value;
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        const data = {
            name, avatar: selectedAvatar,
            city: document.getElementById('reg-city').value,
            school: document.getElementById('reg-school').value,
            class: document.getElementById('reg-class').value
        };
        await setDoc(doc(db, "users", res.user.uid), data);
        await updateProfile(res.user, { displayName: name, photoURL: selectedAvatar });
        location.reload();
    } catch (e) { alert(e.message); }
};

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());

// --- СТАН КОРИСТУВАЧА ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.querySelectorAll('.current-user-av').forEach(i => i.src = data.avatar);
            document.getElementById('prof-avatar').src = data.avatar;
            document.getElementById('prof-name').textContent = data.name;
            document.getElementById('prof-info').textContent = `${data.city}, Школа №${data.school}, ${data.class}`;
        }
        loadFeed();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- ПОСТИ ---
document.getElementById('btn-post').onclick = async () => {
    const text = document.getElementById('post-text').value;
    if (!text.trim()) return;
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.data();
        await addDoc(collection(db, "posts"), {
            userName: userData.name, avatar: userData.avatar, school: userData.school,
            text, createdAt: serverTimestamp()
        });
        document.getElementById('post-text').value = '';
    } catch (e) { alert(e.message); }
};

function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (s) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        s.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div style="padding:15px; border-bottom:1px solid #2f3336; display:flex; gap:10px;">
                    <img src="${p.avatar}" style="width:40px; height:40px; border-radius:50%;">
                    <div>
                        <b>${p.userName}</b> <span style="color:gray; font-size:12px;">Школа ${p.school}</span>
                        <p style="margin:5px 0;">${p.text}</p>
                    </div>
                </div>`;
        });
    });
}
