import { auth, db, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, doc, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. ГЛОБАЛЬНІ ФУНКЦІЇ (щоб працювали onclick в HTML)
window.showStep = (step) => {
    console.log("Перехід на крок:", step);
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

// 2. ОБРОБКА КНОПОК ПРИ ЗАВАНТАЖЕННІ
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM завантажено, прив'язуємо кнопки...");

    // Кнопка Google
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
        btnGoogle.onclick = async () => {
            console.log("Натиснуто Google");
            try {
                await signInWithPopup(auth, googleProvider);
            } catch (e) { alert("Помилка Google: " + e.message); }
        };
    }

    // Кнопка Входу
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.onclick = async () => {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            try {
                await signInWithEmailAndPassword(auth, email, pass);
            } catch (e) { alert("Помилка: " + e.message); }
        };
    }
});

// 3. ПЕРЕВІРКА СТАНУ (Auth Observer)
onAuthStateChanged(auth, (user) => {
    const authCont = document.getElementById('auth-container');
    const appCont = document.getElementById('app-container');
    
    if (user) {
        authCont.style.display = 'none';
        appCont.classList.remove('hidden');
        console.log("Користувач увійшов:", user.email);
        loadFeed();
    } else {
        authCont.style.display = 'flex';
        appCont.classList.add('hidden');
    }
});

function loadFeed() {
    console.log("Завантаження стрічки...");
    // Тут твій код loadFeed
}
