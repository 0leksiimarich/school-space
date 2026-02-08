import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// !!! ВСТАВ СВІЙ UID ТУТ !!!
const ADMINS = ['v5DxqguPUjTi1vtgtzgjZyyrlUf2']; 

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        // Лог для перевірки адмінки
        console.log("Твій UID:", user.uid);
        const isAdmin = ADMINS.includes(user.uid);
        console.log("Адмін статус:", isAdmin);

        loadMessages(user.uid, isAdmin);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// Функція відправки
document.getElementById('btn-send-msg').onclick = async () => {
    const input = document.getElementById('msg-input');
    if (!input.value.trim() || !auth.currentUser) return;
    
    await addDoc(collection(db, "messages"), {
        text: input.value,
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || "Гість",
        avatar: auth.currentUser.photoURL || "",
        createdAt: serverTimestamp()
    });
    input.value = "";
};

// Видалення
window.deleteMsg = async (id) => {
    if(confirm("Видалити?")) await deleteDoc(doc(db, "messages", id));
};

function loadMessages(currentUid, iAmAdmin) {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === currentUid;
            const isSenderAdmin = ADMINS.includes(m.uid);
            
            chat.innerHTML += `
                <div class="msg-row ${isMe ? 'my-msg' : 'other-msg'}">
                    <div class="bubble">
                        <div class="sender-name">
                            ${m.name} ${isSenderAdmin ? '<span class="admin-badge">👑</span>' : ''}
                        </div>
                        <div class="text">${m.text}</div>
                        ${(isMe || iAmAdmin) ? `<span onclick="deleteMsg('${d.id}')" style="color:red; cursor:pointer; font-size:10px;">видалити</span>` : ''}
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
