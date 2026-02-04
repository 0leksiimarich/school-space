import { auth, db, storage } from './firebase.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Глобальні змінні
let selectedAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";

// Налаштування кроків реєстрації
window.showStep = (n) => {
    document.getElementById('step-1').classList.toggle('hidden', n !== 1);
    document.getElementById('step-2').classList.toggle('hidden', n !== 2);
};

// Генерація аватарок
const avatarList = document.getElementById('avatar-list');
['Aneka', 'Felix', 'Luna', 'Max', 'Buddy', 'Jack', 'Misty', 'Leo'].forEach(seed => {
    const img = document.createElement('img');
    img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    img.className = 'avatar-opt';
    img.onclick = () => {
        document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
        img.classList.add('selected');
        selectedAvatar = img.src;
    };
    avatarList.appendChild(img);
});

// Реєстрація
document.getElementById('btn-finish-reg').onclick = async () => {
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const name = document.getElementById('reg-name').value;
    
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        // Зберігаємо додаткові дані в Firestore
        await setDoc(doc(db, "users", res.user.uid), {
            name,
            city: document.getElementById('reg-city').value,
            school: document.getElementById('reg-school').value,
            class: document.getElementById('reg-class').value,
            avatar: selectedAvatar,
            birthday: `${document.getElementById('birth-day').value}.${document.getElementById('birth-month').value}`
        });
        
        await updateProfile(res.user, { displayName: name, photoURL: selectedAvatar });
        location.reload();
    } catch (e) { alert(e.message); }
};

// Пости та Стрічка (спрощено)
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (s) => {
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        s.forEach(d => {
            const p = d.data();
            feed.innerHTML += `
                <div style="padding:15px; border-bottom:1px solid #2f3336; display:flex; gap:12px;">
                    <img src="${p.avatar}" style="width:40px; height:40px; border-radius:50%;">
                    <div>
                        <b>${p.userName}</b> <span style="color:#71767b">@${p.school}</span>
                        <p>${p.text}</p>
                    </div>
                </div>`;
        });
    });
}

// Перевірка входу
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadFeed();
    }
});
