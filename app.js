import { auth, db } from './firebase.js';
import { 
    collection, query, where, getDocs, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. ПЕРЕМИКАННЯ СТОРІНОК ---
window.switchPage = (pageId, btn) => {
    // Ховаємо всі сторінки
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    
    // Показуємо потрібну
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Робимо кнопку в меню активною
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

// --- 2. ФУНКЦІЯ ПОШУКУ ШКОЛИ ---
window.searchBySchool = async () => {
    const schoolNum = document.getElementById('search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    if (!schoolNum) {
        resultsDiv.innerHTML = '<p class="empty-msg">Введіть номер школи</p>';
        return;
    }

    const q = query(collection(db, "posts"), where("school", "==", schoolNum));
    const querySnapshot = await getDocs(q);
    
    resultsDiv.innerHTML = ''; // Очищуємо старі результати

    if (querySnapshot.empty) {
        resultsDiv.innerHTML = '<p class="empty-msg">Нічого не знайдено для цієї школи</p>';
        return;
    }

    querySnapshot.forEach(doc => {
        const p = doc.data();
        resultsDiv.innerHTML += `
            <div class="post-card">
                <div class="post-header"><b>${p.userName}</b> (Школа ${p.school})</div>
                <div class="post-content-text">${p.text}</div>
            </div>`;
    });
};

// --- 3. ЗАПОВНЕННЯ ПРОФІЛЮ ---
const updateProfileUI = (user) => {
    const profName = document.getElementById('prof-name');
    const profAv = document.getElementById('prof-avatar');
    
    if (user) {
        profName.innerText = user.displayName || "Користувач";
        profAv.src = user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";
        // Можна також завантажити кількість постів з бази
    }
};
