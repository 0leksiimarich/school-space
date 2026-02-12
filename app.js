import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_UID = "v5DxqguPUjTi1vtgtzgjZyyrlUf2"; 

// --- ФУНКЦІЯ АВТОРИЗАЦІЇ (ФІКС ДУБЛІКАТІВ) ---
async function handleUserAuth(u) {
    const userRef = doc(db, "users", u.uid); // Використовуємо UID як ID документа
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        // Якщо такого документа немає в базі, тільки тоді створюємо
        await setDoc(userRef, {
            uid: u.uid,
            displayName: u.displayName,
            photoURL: u.photoURL,
            email: u.email,
            banned: false,
            createdAt: serverTimestamp()
        });
        console.log("Створено новий профіль");
    } else {
        // Якщо профіль є, просто оновлюємо фото та ім'я (про всяк випадок)
        await updateDoc(userRef, {
            photoURL: u.photoURL,
            displayName: u.displayName
        });
        console.log("Профіль знайдено, вхід виконано");
    }

    // Перевірка на бан
    const userData = (await getDoc(userRef)).data();
    if (userData?.banned) {
        document.getElementById('ban-screen').classList.remove('hidden');
        return;
    }

    setupUI(u);
}

function setupUI(u) {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('menu-avatar').src = u.photoURL;
    document.getElementById('menu-username').innerText = u.displayName;
    document.getElementById('profile-avatar-big').src = u.photoURL;
    document.getElementById('profile-name-big').innerText = u.displayName;

    if (u.uid === ADMIN_UID) document.getElementById('admin-link').style.display = 'flex';
    
    loadFeed(); 
    loadChat();
    loadUsers();
}

// Слухач стану входу
onAuthStateChanged(auth, (u) => {
    if (u) {
        handleUserAuth(u);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- СТРІЧКА ТА КОМЕНТАРІ (ФІКС СТИЛІВ) ---
function loadFeed(search = "") {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            if (search && !p.text.toLowerCase().includes(search.toLowerCase())) return;

            const isLiked = p.likes?.includes(auth.currentUser?.uid);
            const isAdmin = auth.currentUser?.uid === ADMIN_UID;
            const cmnts = (p.comments || []).map(c => `
                <div class="comment-item">
                    <span class="comment-author">${c.name}:</span>
                    <span class="comment-text">${c.text}</span>
                </div>
            `).join('');

            cont.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorAv}" class="post-author-av">
                        <b>${p.name}</b>
                        ${isAdmin ? `<i class="fas fa-trash delete-btn" onclick="deletePost('${d.id}')"></i>` : ''}
                    </div>
                    <div class="post-content">${p.text}</div>
                    ${p.image ? `<img src="${p.image}" class="post-img">` : ''}
                    <div class="post-actions">
                        <div class="action-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${d.id}', ${isLiked})">
                            <i class="fa${isLiked ? 's' : 'r'} fa-heart"></i> ${p.likes?.length || 0}
                        </div>
                    </div>
                    <div class="comment-section">
                        <div class="comment-list">${cmnts}</div>
                        <input type="text" id="in-${d.id}" class="comment-input" placeholder="Коментувати..." onkeydown="if(event.key==='Enter') addComment('${d.id}')">
                    </div>
                </div>`;
        });
    });
}

// Решта функцій (showPage, loadChat, loadUsers, deletePost, toggleLike, addComment) залишаються без змін...
// Додай їх сюди зі свого минулого коду.
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${id}`).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('menu-overlay').classList.remove('active');
};
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);

