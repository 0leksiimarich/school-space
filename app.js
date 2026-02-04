import { auth, db, storage, googleProvider } from './firebase.js';
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const authSection = document.getElementById('auth-container');
const appSection = document.getElementById('app-container');
const feed = document.getElementById('feed');

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        document.getElementById('user-display').textContent = user.displayName || user.email;
        loadPosts();
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
    }
});

// Auth Logic
document.getElementById('btn-login').onclick = (e) => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(alert);
};

document.getElementById('btn-register').onclick = () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    createUserWithEmailAndPassword(auth, email, pass).catch(alert);
};

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('btn-logout').onclick = () => signOut(auth);

// Post Creation
document.getElementById('btn-post').onclick = async () => {
    const text = document.getElementById('post-text').value;
    const file = document.getElementById('post-file').files[0];
    const btn = document.getElementById('btn-post');
    
    if (!text && !file) return;
    btn.disabled = true;

    let fileUrl = null;
    let fileType = null;

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
    btn.disabled = false;
};

// Feed & Interaction
function loadPosts() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        feed.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const id = docSnap.id;
            const postEl = document.createElement('div');
            postEl.className = 'card post';
            
            let mediaHtml = '';
            if (post.fileUrl) {
                mediaHtml = post.fileType === 'image' 
                    ? `<img src="${post.fileUrl}">` 
                    : `<video src="${post.fileUrl}" controls></video>`;
            }

            postEl.innerHTML = `
                <strong>${post.userName}</strong>
                <p>${post.text}</p>
                ${mediaHtml}
                <div class="post-actions">
                    <button onclick="window.likePost('${id}')">❤️ ${post.likes?.length || 0}</button>
                </div>
                <div class="comments-section">
                    ${(post.comments || []).map(c => `<div class="comment"><b>${c.user}:</b> ${c.text}</div>`).join('')}
                    <input type="text" placeholder="Коментувати..." onkeydown="if(event.key==='Enter') window.addComment('${id}', this.value)">
                </div>
            `;
            feed.appendChild(postEl);
        });
    });
}

window.likePost = async (id) => {
    const postRef = doc(db, "posts", id);
    await updateDoc(postRef, { likes: arrayUnion(auth.currentUser.uid) });
};

window.addComment = async (id, text) => {
    if (!text.trim()) return;
    const postRef = doc(db, "posts", id);
    await updateDoc(postRef, {
        comments: arrayUnion({
            user: auth.currentUser.displayName || auth.currentUser.email,
            text: text,
            at: Date.now()
        })
    });
};
