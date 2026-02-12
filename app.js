import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ HTML ---
window.toggleMenu = (open) => {
    document.getElementById('sidebar').classList.toggle('active', open);
    document.getElementById('menu-overlay').classList.toggle('active', open);
};

window.goToPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    window.toggleMenu(false);
    if(id === 'profile') loadPosts('my-posts-container', auth.currentUser.uid);
};

// --- ОСНОВНА ЛОГІКА ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL });
        }
        const data = (await getDoc(userRef)).data();
        
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

function loadPosts(contId, filterUid = null) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById(contId);
        if(!cont) return;
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if(filterUid && p.uid !== filterUid) return;
            cont.innerHTML += `
                <div class="post-card">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.authorAv}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <b>${p.name}</b>
                    </div>
                    <p style="word-wrap: break-word;">${p.text}</p>
                    ${p.image ? `<img src="${p.image}" style="width:100%; border-radius:8px;">` : ''}
                </div>`;
        });
    });
}

// Події кнопок
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);

document.getElementById('btn-publish').onclick = async () => {
    const txt = document.getElementById('post-text').value;
    if(!txt.trim()) return;
    
    const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userSnap.data();

    await addDoc(collection(db, "posts"), {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName,
        authorAv: userData.photoURL,
        text: txt,
        createdAt: serverTimestamp()
    });
    document.getElementById('post-text').value = '';
};

// Зміна аватара (спрощено)
document.getElementById('av-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: reader.result });
        location.reload();
    };
};
