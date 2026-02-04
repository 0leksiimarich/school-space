import { auth, db } from './firebase.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, getDoc, updateDoc, arrayUnion, arrayRemove, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- НАВІГАЦІЯ ---
window.switchPage = (pageId, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if(target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
};

// --- СИСТЕМА ЛАЙКІВ ---
window.toggleLike = async (postId) => {
    const user = auth.currentUser;
    if (!user) return alert("Увійдіть, щоб ставити лайки!");

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);
    const postData = postSnap.data();

    // Якщо лайк уже є — прибираємо, якщо немає — додаємо
    if (postData.likes && postData.likes.includes(user.uid)) {
        await updateDoc(postRef, { likes: arrayRemove(user.uid) });
    } else {
        await updateDoc(postRef, { likes: arrayUnion(user.uid) });
    }
};

// --- ПОШУК (ЗА ШКОЛОЮ) ---
window.searchBySchool = async () => {
    const schoolNum = document.getElementById('search-input').value;
    if (!schoolNum) return loadFeed(); // Якщо порожньо — показуємо все

    const q = query(collection(db, "posts"), where("school", "==", schoolNum));
    const querySnapshot = await getDocs(q);
    renderPosts(querySnapshot);
};

// --- ВІДОБРАЖЕННЯ ПОСТІВ ---
function renderPosts(snapshot) {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const p = docSnap.data();
        const postId = docSnap.id;
        const isLiked = p.likes && p.likes.includes(auth.currentUser?.uid);
        const likesCount = p.likes ? p.likes.length : 0;

        feed.innerHTML += `
            <div class="post-card">
                <div class="post-header">
                    <div class="user-info">
                        <img src="${p.avatar}">
                        <b>${p.userName}</b>
                        <span style="color:gray; font-size:12px;">• Школа ${p.school}</span>
                    </div>
                </div>
                <div class="post-content-text">${p.text}</div>
                <div class="post-actions">
                    <i class="${isLiked ? 'fas fa-heart' : 'far fa-heart'}" 
                       style="color: ${isLiked ? '#ed4956' : 'inherit'}" 
                       onclick="toggleLike('${postId}')"></i>
                    <i class="far fa-comment"></i>
                    <i class="far fa-paper-plane"></i>
                </div>
                <div style="padding: 0 12px 12px; font-size: 13px; font-weight: 600;">
                    ${likesCount} вподобань
                </div>
            </div>`;
    });
}

// Завантаження стрічки в реальному часі
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        renderPosts(snapshot);
    });
}

// Виклик завантаження при старті (додай це в onAuthStateChanged)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ... твій існуючий код ...
        loadFeed();
    }
});
