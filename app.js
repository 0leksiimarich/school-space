import { auth, db, storage, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const authSection = document.getElementById('auth-container');
const appSection = document.getElementById('app-container');
const feed = document.getElementById('feed');
const loginForm = document.getElementById('login-form');

// Перевірка стану авторизації
onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        const name = user.displayName || user.email;
        document.getElementById('user-display').textContent = name;
        document.querySelectorAll('.avatar-placeholder').forEach(av => av.textContent = name.charAt(0).toUpperCase());
        loadPosts();
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
    }
});

// Вхід через Email/Пароль
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        alert("Помилка входу: " + err.message);
    }
};

// Реєстрація через Email/Пароль
document.getElementById('btn-register').onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    if (pass.length < 6) {
        alert("Пароль має бути не менше 6 символів");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        // Можна додати запит імені користувача тут
        await updateProfile(userCredential.user, {
            displayName: email.split('@')[0]
        });
    } catch (err) {
        alert("Помилка реєстрації: " + err.message);
    }
};

// Вхід через Google
document.getElementById('btn-google').onclick = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        alert("Помилка Google: " + err.message);
    }
};

// Вихід
document.getElementById('btn-logout').onclick = () => signOut(auth);

// Створення поста
document.getElementById('btn-post').onclick = async () => {
    const text = document.getElementById('post-text').value;
    const file = document.getElementById('post-file').files[0];
    const btn = document.getElementById('btn-post');
    
    if (!text && !file) return;
    
    btn.disabled = true;
    btn.textContent = "Завантаження...";

    let fileUrl = null;
    let fileType = null;

    try {
        if (file) {
            const fileRef = ref(storage, `posts/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            fileUrl = await getDownloadURL(fileRef);
            fileType = file.type.startsWith('image') ? 'image' : 'video';
        }

        await addDoc(collection(db, "posts"), {
            uid: auth.currentUser.uid,
            userName: auth.currentUser.displayName || auth.currentUser.email,
            text,
            fileUrl,
            fileType,
            likes: [],
            comments: [],
            createdAt: serverTimestamp()
        });

        document.getElementById('post-text').value = '';
        document.getElementById('post-file').value = '';
    } catch (e) { 
        alert("Помилка публікації: " + e.message); 
    } finally {
        btn.disabled = false;
        btn.textContent = "Опублікувати";
    }
};

// Стрічка постів
function loadPosts() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        feed.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const id = docSnap.id;
            const initials = (post.userName || "U").charAt(0).toUpperCase();
            
            const postEl = document.createElement('div');
            postEl.className = 'card post';
            
            let mediaHtml = '';
            if (post.fileUrl) {
                mediaHtml = post.fileType === 'image' 
                    ? `<img src="${post.fileUrl}" loading="lazy">` 
                    : `<video src="${post.fileUrl}" controls></video>`;
            }

            postEl.innerHTML = `
                <div class="post-header">
                    <div class="avatar-placeholder">${initials}</div>
                    <div style="font-weight: 700;">${post.userName}</div>
                </div>
                <div class="post-content">
                    <p style="white-space: pre-wrap;">${post.text}</p>
                    ${mediaHtml}
                </div>
                <div class="post-actions">
                    <button class="action-btn" onclick="window.likePost('${id}')">❤️ ${post.likes?.length || 0}</button>
                </div>
                <div class="comments-section">
                    ${(post.comments || []).map(c => `
                        <div class="comment">
                            <small style="font-weight: 700; color: var(--primary);">${c.user}</small>
                            <div>${c.text}</div>
                        </div>
                    `).join('')}
                    <input type="text" placeholder="Напишіть коментар..." 
                           style="width: 100%; margin-top: 15px; box-sizing: border-box;" 
                           onkeydown="if(event.key==='Enter') window.addComment('${id}', this)">
                </div>
            `;
            feed.appendChild(postEl);
        });
    });
}

// Лайки
window.likePost = async (id) => {
    const postRef = doc(db, "posts", id);
    const userId = auth.currentUser.uid;
    await updateDoc(postRef, { likes: arrayUnion(userId) });
};

// Коментарі
window.addComment = async (id, input) => {
    const text = input.value.trim();
    if (!text) return;
    const postRef = doc(db, "posts", id);
    try {
        await updateDoc(postRef, {
            comments: arrayUnion({
                user: auth.currentUser.displayName || auth.currentUser.email,
                text,
                at: Date.now()
            })
        });
        input.value = '';
    } catch (err) {
        alert("Помилка коментаря: " + err.message);
    }
};
