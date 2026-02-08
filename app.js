import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ВСТАВ СВІЙ UID СЮДИ ---
const ADMINS = ['DcfDbD...твоє_id_повністю']; 

window.deleteMsg = async (id) => {
    if (confirm("Видалити повідомлення?")) {
        await deleteDoc(doc(db, "messages", id));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Навігація
    const showPage = (id) => {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${id}`).classList.remove('hidden');
    };
    
    document.getElementById('nav-messages').onclick = () => showPage('messages');
    document.getElementById('nav-profile').onclick = () => showPage('profile');

    // Кнопки
    document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    document.getElementById('btn-logout').onclick = () => signOut(auth);

    document.getElementById('btn-send-msg').onclick = async () => {
        const input = document.getElementById('msg-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "messages"), {
            text: input.value,
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        input.value = "";
    };
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Очищаємо ID від можливих пробілів
        const currentUID = user.uid.trim();
        const isAdmin = ADMINS.some(id => id.trim() === currentUID);

        console.log("Твій UID:", currentUID);
        console.log("Статус адміна:", isAdmin ? "АКТИВОВАНО ✅" : "НЕМАЄ ПРАВ ❌");

        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('prof-name').innerText = user.displayName + (isAdmin ? " (Admin)" : "");
        document.getElementById('prof-avatar').src = user.photoURL;
        
        loadChat(isAdmin);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function loadChat(isAdminUser) {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        const chat = document.getElementById('chat-messages');
        chat.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.uid === auth.currentUser.uid;
            // Перевіряємо чи автор повідомлення - адмін
            const senderIsAdmin = ADMINS.some(id => id.trim() === m.uid.trim());

            chat.innerHTML += `
                <div class="msg-row ${isMe ? 'my-msg' : 'other-msg'}">
                    <img src="${m.avatar}" class="msg-avatar">
                    <div class="bubble">
                        <div class="sender-name">${m.name} ${senderIsAdmin ? '<span class="admin-badge">адмін</span>' : ''}</div>
                        <div class="text">${m.text}</div>
                        <div style="text-align:right; margin-top:4px;">
                            ${(isMe || isAdminUser) ? `<span onclick="deleteMsg('${d.id}')" style="color:#ff5a5a; cursor:pointer; font-size:12px;">Видалити</span>` : ''}
                        </div>
                    </div>
                </div>`;
        });
        chat.scrollTop = chat.scrollHeight;
    });
}
