// app.js
import { auth, provider, db, storage } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const authBox = document.getElementById("auth");
const appBox = document.getElementById("app");
const feed = document.getElementById("feed");

login.onclick = () =>
  signInWithEmailAndPassword(auth, email.value, password.value);

register.onclick = () =>
  createUserWithEmailAndPassword(auth, email.value, password.value);

google.onclick = () =>
  signInWithPopup(auth, provider);

logout.onclick = () => signOut(auth);

post.onclick = async () => {
  let media = "";
  if (file.files[0]) {
    const r = ref(storage, Date.now() + file.files[0].name);
    await uploadBytes(r, file.files[0]);
    media = await getDownloadURL(r);
  }
  await addDoc(collection(db, "posts"), {
    text: text.value,
    media,
    uid: auth.currentUser.uid,
    likes: [],
    comments: [],
    created: serverTimestamp()
  });
  text.value = "";
  file.value = "";
};

onAuthStateChanged(auth, user => {
  authBox.hidden = !!user;
  appBox.hidden = !user;
  if (user) loadFeed();
});

function loadFeed() {
  onSnapshot(collection(db, "posts"), snap => {
    feed.innerHTML = "";
    snap.docs.reverse().forEach(d => {
      const p = d.data();
      const div = document.createElement("div");
      div.className = "post";
      div.innerHTML = `
        <div>${p.text}</div>
        ${p.media ? (p.media.includes(".mp4") ? `<video controls src="${p.media}"></video>` : `<img src="${p.media}"/>`) : ""}
        <div class="actions">
          <button>❤️ ${p.likes.length}</button>
          <input placeholder="Коментар"/>
        </div>
      `;
      const likeBtn = div.querySelector("button");
      likeBtn.onclick = () =>
        updateDoc(doc(db, "posts", d.id), {
          likes: arrayUnion(auth.currentUser.uid)
        });
      feed.appendChild(div);
    });
  });
}
