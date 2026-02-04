import { auth, db, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАЛАШТУВАННЯ ТА ІНІЦІАЛІЗАЦІЯ ---

// Заповнення дат народження
const daySelect = document.getElementById('birth-day');
const yearSelect = document.getElementById('birth-year');
for (let i = 1; i <= 31; i++) daySelect.innerHTML += `<option value="${i}">${i}</option>`;
for (let i = 2020; i >= 1990; i--) yearSelect.innerHTML += `<option value="${i}">${i}</option>`;

// Генерація аватарок
let selectedAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";
const avatarList = document.getElementById('avatar-list');
['Aneka', 'Felix', 'Luna', 'Max', 'Buddy', 'Jack', 'Misty', 'Leo'].forEach(seed => {
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    const img = document.createElement('img');
    img.src = url;
    img.className = 'avatar-opt';
    img.onclick = () => {
        document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
        img.classList.add('selected');
        selectedAvatar = url;
    };
    avatarList.appendChild(img);
});

// --- ЛОГІКА АВТОРИЗАЦІЇ ---

// Перемикання кроків реєстрації
window.showStep = (step) => {
    document.getElementById('auth-initial').classList.add('hidden');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    
    if (step === 1) document.getElementById('step-1').classList.remove('hidden');
    else if (step === 2) document.getElementById('step-2').classList.remove('hidden');
};

// Вхід
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) { alert("Помилка входу: " + err.message); }
};

// Реєстрація (Фінальний крок)
document.getElementById('btn-finish-reg').onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('reg-pass').value;
    const name = document.getElementById('reg-name').value;

    if (pass.length < 6) return alert("Пароль занадто короткий!");

    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        const userData = {
            uid: res.user.uid,
            name: name,
            city: document.getElementById('reg-city').value,
            school: document.getElementById('reg-school').value,
            class: document.getElementById('reg-class').value,
            avatar: selectedAvatar,
            birthday: `${document.getElementById('birth-day').value}.${document.getElementById('birth-month').value}.${document.getElementById('birth-year').value}`
        };

        // Зберігаємо профіль у Firestore
        await setDoc(doc(db, "users", res.user.uid), userData);
        await updateProfile(res.user, { displayName: name, photoURL: selectedAvatar });
        
        location.reload();
    } catch (err) { alert("Помилка реєстрації: " + err.message); }
};

// Вхід через Google
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);

// Вихід
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());

// --- ОСНОВНИЙ ФУНКЦІОНАЛ ---

onAuthStateChanged(auth, async (user) => {
    const authCont = document.getElementById('auth-container');
    const appCont = document.getElementById('app-container');

    if (user) {
        authCont.classList.add('hidden');
        appCont.classList.remove('hidden');
        
        // Завантажуємо дані користувача для UI
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.querySelectorAll('.current-user-av').forEach(img => img.src = data.avatar);
            document.getElementById('prof-avatar').src = data.avatar;
            document.getElementById('prof-name').textContent = data.name;
            document.getElementById('prof-info').textContent = `${data.city} • Школа №${data.school} • Клас ${data.class}`;
        }
        loadFeed();
    } else {
        authCont.classList.remove('hidden');
        appCont.classList.add('hidden');
    }
});

// Навігація
window.switchPage = (pageId, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const titles = { feed: 'Головна', messages: 'Повідомлення', profile: 'Профіль' };
    document.getElementById('page-title').textContent = titles[pageId];
};

// Створення поста
document.getElementById('btn-post').onclick = async () => {
    const text = document.getElementById('post-text').value;
    if (!text.trim()) return;

    const btn = document.getElementById('btn-post');
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        await addDoc(collection(db, "posts"), {
            uid: user.uid,
            userName: userData.name,
            avatar: userData.avatar,
            school: userData.school,
            text: text,
            createdAt: serverTimestamp()
        });

        document.getElementById('post-text').value = '';
    } catch (e) { alert(e.message); }
    btn.disabled = false;
};

// Завантаження стрічки
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            feed.innerHTML += `
                <div class="feed-item" style="border-bottom: 1px solid #2f3336; display: flex; padding: 15px; gap: 12px;">
                    <img src="${p.avatar}" style="width: 48px; height: 48px; border-radius: 50%;">
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <span style="font-weight: bold;">${p.userName}</span>
                            <span style="color: #71767b; font-size: 14px;">• Школа №${p.school}</span>
                        </div>
                        <div style="margin-top: 5px; line-height: 1.4; white-space: pre-wrap;">${p.text}</div>
                        <div style="margin-top: 12px; color: #71767b; display: flex; gap: 20px;">
                            <span>💬 0</span>
                            <span>❤️ 0</span>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}
// 1. Функція для кроків реєстрації (Крок 1, Крок 2...)
window.showStep = (step) => {
    console.log("Перемикаємо на крок реєстрації:", step);
    document.getElementById('auth-initial').classList.add('hidden');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    
    if (step === 1) document.getElementById('step-1').classList.remove('hidden');
    else if (step === 2) document.getElementById('step-2').classList.remove('hidden');
};

// 2. Функція для перемикання сторінок (Головна, Повідомлення, Профіль)
window.switchPage = (pageId, btn) => {
    console.log("Відкриваємо сторінку:", pageId);
    
    // Ховаємо всі сторінки (секції з класом .page)
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    
    // Показуємо ту, на яку натиснули
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Робимо активною кнопку в нижньому меню
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    }
    
    // Оновлюємо заголовок зверху
    const titles = { 
        feed: 'Головна', 
        messages: 'Повідомлення', 
        profile: 'Профіль' 
    };
    document.getElementById('page-title').textContent = titles[pageId] || 'SchoolSpace';
};
