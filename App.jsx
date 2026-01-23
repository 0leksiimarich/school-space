import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getDoc,
  setDoc,
  increment
} from 'firebase/firestore';
import { 
  Home, 
  User, 
  LogOut, 
  Heart, 
  ShieldAlert, 
  CheckCircle2, 
  ShieldCheck,
  Search,
  MoreHorizontal,
  Mail,
  ShieldQuestion,
  Trash2,
  AlertCircle,
  Image as ImageIcon,
  Film,
  Music,
  Settings,
  X,
  Save
} from 'lucide-react';

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'school-space-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('none'); 
  const [view, setView] = useState('feed'); 
  const [error, setError] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [editForm, setEditForm] = useState({
    displayName: '',
    school: '',
    grade: '',
    photoURL: ''
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) { console.error(err); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (currUser) {
        const profileRef = doc(db, 'artifacts', appId, 'users', currUser.uid, 'profile', 'data');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfile(data);
          setEditForm(data);
        } else {
          const newProfile = {
            uid: currUser.uid,
            displayName: currUser.displayName || "Учень",
            email: currUser.email || "anonymous@school.space",
            role: 'student', 
            school: "Не вказано",
            grade: "Не вказано",
            photoURL: currUser.photoURL || `https://ui-avatars.com/api/?name=${currUser.displayName || 'U'}`
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
          setEditForm(newProfile);
        }
        setUser(currUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const postsQuery = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const sorted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(sorted);
    });
    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) { 
      console.error("Login failed:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError("Цей домен не додано до дозволених у Firebase Console. Додайте 'usercontent.goog' у налаштуваннях Authentication.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Браузер заблокував спливаюче вікно. Дозвольте pop-ups для цього сайту.");
      } else {
        setError(`Помилка: ${err.message}`);
      }
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setError("Гостьовий вхід не вдався. Перевірте конфігурацію Firebase.");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await updateDoc(profileRef, editForm);
      setProfile(editForm);
      setIsEditingProfile(false);
    } catch (err) { setError("Не вдалося оновити профіль."); }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postText.trim() && !mediaUrl) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
        text: postText,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        authorId: user.uid,
        authorName: profile.displayName,
        authorRole: profile.role,
        authorPhoto: profile.photoURL,
        school: profile.school,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp()
      });
      setPostText('');
      setMediaUrl('');
      setMediaType('none');
    } catch (err) { setError("Помилка публікації."); }
  };

  const renderMedia = (post) => {
    if (!post.mediaUrl) return null;
    switch (post.mediaType) {
      case 'image':
        return <img src={post.mediaUrl} className="mt-3 rounded-xl max-h-96 w-full object-cover border" alt="media" />;
      case 'video':
        return <video src={post.mediaUrl} controls className="mt-3 rounded-xl w-full border" />;
      case 'audio':
        return <audio src={post.mediaUrl} controls className="mt-3 w-full" />;
      default:
        return null;
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-bold">SchoolSpace...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
        <ShieldCheck size={48} className="mx-auto text-blue-600" />
        <h1 className="text-2xl font-bold">Вітаємо у SchoolSpace</h1>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm flex items-start gap-2 text-left border border-red-100">
              <AlertCircle size={20} className="shrink-0" />
              <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 border p-3 rounded-xl hover:bg-slate-50 transition-all font-semibold">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Увійти через Google
          </button>
          
          <button onClick={handleGuestLogin} className="w-full flex items-center justify-center gap-3 bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-900 transition-all font-semibold shadow-md">
              Зайти як Гість (тест)
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
           <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} id="rem" />
           <label htmlFor="rem" className="cursor-pointer">Запам'ятати мене</label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex justify-center font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r p-4 space-y-2">
        <div className="flex items-center gap-2 px-4 text-blue-600 font-black text-2xl mb-6">
          <ShieldCheck size={32} /> SchoolSpace
        </div>
        <button onClick={() => setView('feed')} className={`flex items-center gap-4 p-3 rounded-xl transition ${view === 'feed' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-50'}`}><Home /> Головна</button>
        <button onClick={() => setView('profile')} className={`flex items-center gap-4 p-3 rounded-xl transition ${view === 'profile' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-50'}`}><User /> Профіль</button>
        <button onClick={() => setView('admin_info')} className={`flex items-center gap-4 p-3 rounded-xl transition ${view === 'admin_info' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-50'}`}><ShieldQuestion /> Допомога</button>
        
        <div className="mt-auto border-t pt-4">
          <div className="flex items-center gap-3 p-2 mb-4">
            <img src={profile?.photoURL} className="w-10 h-10 rounded-full border object-cover" alt="avatar" />
            <div className="overflow-hidden text-left">
                <p className="font-bold truncate text-sm">{profile?.displayName}</p>
                <p className="text-xs text-slate-400 truncate">{profile?.school}</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 p-3 text-slate-500 hover:text-red-500 w-full rounded-lg hover:bg-red-50 transition-colors"><LogOut size={20} /> Вийти</button>
        </div>
      </aside>

      {/* Main Feed */}
      <main className="w-full max-w-2xl border-r min-h-screen relative">
        <header className="sticky top-0 bg-white/80 backdrop-blur p-4 border-b font-bold text-xl z-20 flex justify-between items-center">
            {view === 'feed' ? 'Стрічка' : view === 'profile' ? 'Мій Профіль' : 'Інформація'}
            {view === 'profile' && <button onClick={() => setIsEditingProfile(true)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><Settings size={20} /></button>}
        </header>

        {view === 'feed' && (
          <div className="pb-20">
            <div className="p-4 border-b space-y-4">
              <div className="flex gap-4">
                <img src={profile?.photoURL} className="w-12 h-12 rounded-full border shadow-sm object-cover" alt="me" />
                <textarea 
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Розкажи, що цікавого?"
                  className="flex-1 border-none focus:ring-0 text-lg resize-none pt-2"
                />
              </div>
              
              {mediaUrl && (
                <div className="relative bg-slate-100 p-2 rounded-xl flex items-center justify-between border border-dashed border-slate-300">
                    <span className="text-xs font-mono truncate mr-8">{mediaUrl}</span>
                    <button onClick={() => {setMediaUrl(''); setMediaType('none');}} className="bg-white rounded-full p-1 shadow-sm"><X size={14} /></button>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex gap-2">
                    <button onClick={() => {setMediaType('image'); setMediaUrl(prompt("Вставте посилання на .png або .jpg зображення:"));}} className={`p-2 rounded-full transition ${mediaType === 'image' ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><ImageIcon size={20} /></button>
                    <button onClick={() => {setMediaType('video'); setMediaUrl(prompt("Вставте посилання на .mp4 відео:"));}} className={`p-2 rounded-full transition ${mediaType === 'video' ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><Film size={20} /></button>
                    <button onClick={() => {setMediaType('audio'); setMediaUrl(prompt("Вставте посилання на .mp3 аудіо:"));}} className={`p-2 rounded-full transition ${mediaType === 'audio' ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><Music size={20} /></button>
                </div>
                <button onClick={handleCreatePost} disabled={!postText.trim() && !mediaUrl} className="bg-blue-600 text-white px-8 py-2 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">Post</button>
              </div>
            </div>

            <div className="divide-y">
              {posts.map(post => (
                <article key={post.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex gap-4">
                    <img src={post.authorPhoto} className="w-12 h-12 rounded-full border object-cover" alt="author" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <span className="font-bold flex items-center gap-1">
                            {post.authorName} 
                            {post.authorRole === 'admin' && <ShieldCheck size={14} className="text-red-500" />}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">{post.school} • {new Date(post.createdAt?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-slate-800 text-left">{post.text}</p>
                      {renderMedia(post)}
                      <div className="mt-4 flex gap-6 text-slate-400">
                        <button className="flex items-center gap-1 hover:text-rose-500 transition"><Heart size={18} /> {post.likes}</button>
                        <button className="hover:text-orange-500 transition"><ShieldAlert size={18} /></button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="p-8">
            <div className="flex flex-col items-center">
              <img src={profile?.photoURL} className="w-32 h-32 rounded-full border-4 border-blue-50 shadow-xl object-cover" alt="profile" />
              <h2 className="text-2xl font-black mt-4">{profile?.displayName}</h2>
              <div className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-bold mt-2 uppercase tracking-widest">{profile?.role}</div>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-2xl border text-left">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Навчальний заклад</p>
                    <p className="text-lg font-bold">{profile?.school}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border text-left">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Клас / Посада</p>
                    <p className="text-lg font-bold">{profile?.grade}</p>
                </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Налаштування профілю</h3>
              <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Аватарка (URL)</label>
                <input type="text" value={editForm.photoURL} onChange={e => setEditForm({...editForm, photoURL: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 ring-blue-500" placeholder="https://..." />
              </div>
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Ім'я</label>
                <input type="text" value={editForm.displayName} onChange={e => setEditForm({...editForm, displayName: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 ring-blue-500" />
              </div>
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Школа</label>
                <input type="text" value={editForm.school} onChange={e => setEditForm({...editForm, school: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 ring-blue-500" />
              </div>
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Клас</label>
                <input type="text" value={editForm.grade} onChange={e => setEditForm({...editForm, grade: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 ring-blue-500" />
              </div>
              <button onClick={handleUpdateProfile} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 mt-4">
                <Save size={20} /> Зберегти зміни
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
