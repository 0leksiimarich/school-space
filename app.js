import { auth, db, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ЕКСПОРТ ФУНКЦІЙ ДЛЯ HTML (ОБОВ'ЯЗКОВО) ---
window.showStep = (step) => {
    console.log("Крок реєстрації:", step);
    document.getElementById('auth-initial').classList.add('hidden');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    
    if (step === 1) document.getElementById('step-1').classList.remove('hidden');
    if (step === 2) document.getElementById('step-2').classList.remove('hidden');
};

window.switchPage = (pageId, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

// --- ЛОГІКА ВХОДУ ТА РЕЄСТРАЦІЇ ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Вхід через Email
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.onclick = async () => {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                console.log("Вхід успішний!");
            } catch (e) { alert("Помилка входу: " + e.message); }
        };
    }

    // 2. Вхід через Google
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
        btnGoogle.onclick = async () => {
            try {
                const result = await signInWithPopup(auth, googleProvider);
                const user = result.user;
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (!userDoc.exists()) {
                    await setDoc(doc(db, "users", user.uid), {
                        name: user.displayName, avatar: user.photoURL,
                        city: "Не вказано", school: "0", class: "Н/Д"
                    });
                }
            } catch (e) { console.error(e); alert("Google Auth Error"); }
        };
    }

    // 3. Завершення реєстрації
    const btnFinish = document.getElementById('btn-finish-reg');
    if (btnFinish) {
        btnFinish.onclick = async () => {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('reg-pass').value;
            const name = document.getElementById('reg-name').value;
            try {
                const res = await createUserWithEmailAndPassword(auth, email, pass);
                await setDoc(doc(db, "users", res.user.uid), {
                    name: name,
                    avatar: selectedAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                    city: document.getElementById('reg-city').value,
                    school: document.getElementById('reg-school').value,
                    class: document.getElementById('reg-class').value
                });
                location.reload();
            } catch (e) { alert(e.message); }
        };
    }
});

// Стан користувача
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadFeed();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snapshot.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.avatar}" class="user-thumb">
                        <b>${p.userName}</b>
                    </div>
                    <div class="post-content-text">${p.text}</div>
                </div>`;
        });
    });
}
