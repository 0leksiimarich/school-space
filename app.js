import { auth, db, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ФУНКЦІЯ GOOGLE ВХОДУ ---
const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Перевіряємо, чи є користувач у базі, якщо ні — створюємо профіль
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), {
                name: user.displayName,
                avatar: user.photoURL,
                city: "Не вказано",
                school: "0",
                class: "Н/Д"
            });
        }
        console.log("Успішний вхід через Google");
    } catch (error) {
        console.error("Помилка Google Auth:", error.message);
        alert("Не вдалося увійти через Google. Перевір консоль (F12).");
    }
};

// Прив'язуємо подію до кнопки Google (після завантаження сторінки)
document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById('btn-google');
    if (googleBtn) {
        googleBtn.addEventListener('click', loginWithGoogle);
    }
});

// --- ІНША ЛОГІКА (Перемикання кроків) ---
window.showStep = (step) => {
    document.getElementById('auth-initial').classList.add('hidden');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById(`step-${step}`).classList.remove('hidden');
};

window.switchPage = (pageId, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
};

// Стан авторизації
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadFeed();
        
        // Оновлюємо аватарки в інтерфейсі
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.querySelectorAll('.current-user-av').forEach(img => img.src = data.avatar);
        }
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// Завантаження постів
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.avatar}" class="user-thumb">
                        <b>${p.userName}</b>
                    </div>
                    <div class="post-content-text">${p.text}</div>
                    <div class="post-actions">
                        <i class="far fa-heart"></i>
                        <i class="far fa-comment"></i>
                    </div>
                </div>`;
        });
    });
}
