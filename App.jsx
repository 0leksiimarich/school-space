<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SchoolSpace - Шкільна мережа</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- Firebase SDKs -->
    <script src="https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/11.1.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore-compat.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .hide { display: none; }
        .post-card { transition: background-color 0.2s; }
        .modal-overlay { background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
    </style>
</head>
<body class="bg-white text-slate-900">

    <!-- Loading Screen -->
    <div id="loading-screen" class="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-slate-500 font-bold italic">SchoolSpace завантажується...</p>
    </div>

    <!-- Login Screen -->
    <div id="login-screen" class="min-h-screen bg-slate-50 flex items-center justify-center p-4 hide">
        <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div class="text-blue-600 flex justify-center"><i data-lucide="shield-check" class="w-12 h-12"></i></div>
            <h1 class="text-2xl font-bold">Вітаємо у SchoolSpace</h1>
            
            <div id="auth-error" class="bg-red-50 text-red-700 p-4 rounded-xl text-sm hide flex items-start gap-2 text-left border border-red-100">
                <i data-lucide="alert-circle" class="w-5 h-5 shrink-0"></i>
                <span id="error-message"></span>
            </div>

            <div class="space-y-3">
                <button onclick="handleGoogleLogin()" class="w-full flex items-center justify-center gap-3 border p-3 rounded-xl hover:bg-slate-50 transition-all font-semibold">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" alt="Google">
                    Увійти через Google
                </button>
                <button onclick="handleGuestLogin()" class="w-full flex items-center justify-center gap-3 bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-900 transition-all font-semibold shadow-md">
                    Зайти як Гість (тест)
                </button>
            </div>
        </div>
    </div>

    <!-- Main App Layout -->
    <div id="app-layout" class="min-h-screen flex justify-center hide">
        <!-- Sidebar -->
        <aside class="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r p-4 space-y-2">
            <div class="flex items-center gap-2 px-4 text-blue-600 font-black text-2xl mb-6">
                <i data-lucide="shield-check" class="w-8 h-8"></i> SchoolSpace
            </div>
            <nav class="space-y-1">
                <button onclick="switchView('feed')" class="nav-btn w-full flex items-center gap-4 p-3 rounded-xl transition hover:bg-slate-50" data-view="feed">
                    <i data-lucide="home"></i> Головна
                </button>
                <button onclick="switchView('profile')" class="nav-btn w-full flex items-center gap-4 p-3 rounded-xl transition hover:bg-slate-50" data-view="profile">
                    <i data-lucide="user"></i> Профіль
                </button>
                <button onclick="switchView('info')" class="nav-btn w-full flex items-center gap-4 p-3 rounded-xl transition hover:bg-slate-50" data-view="info">
                    <i data-lucide="shield-question"></i> Допомога
                </button>
            </nav>
            
            <div class="mt-auto border-t pt-4">
                <div class="flex items-center gap-3 p-2 mb-4">
                    <img id="side-avatar" src="" class="w-10 h-10 rounded-full border object-cover">
                    <div class="overflow-hidden text-left">
                        <p id="side-name" class="font-bold truncate text-sm">Користувач</p>
                        <p id="side-school" class="text-xs text-slate-400 truncate">Школа не вказана</p>
                    </div>
                </div>
                <button onclick="handleLogout()" class="flex items-center gap-2 p-3 text-slate-500 hover:text-red-500 w-full rounded-lg hover:bg-red-50 transition-colors">
                    <i data-lucide="log-out"></i> Вийти
                </button>
            </div>
        </aside>

        <!-- Main Feed -->
        <main class="w-full max-w-2xl border-r min-h-screen relative">
            <header class="sticky top-0 bg-white/80 backdrop-blur p-4 border-b font-bold text-xl z-20 flex justify-between items-center">
                <span id="view-title">Стрічка</span>
                <button id="settings-btn" onclick="openEditModal()" class="p-2 hover:bg-slate-100 rounded-full text-slate-500 hide">
                    <i data-lucide="settings"></i>
                </button>
            </header>

            <!-- Feed View -->
            <div id="view-feed" class="view-content pb-20">
                <div class="p-4 border-b space-y-4">
                    <div class="flex gap-4">
                        <img id="post-avatar" src="" class="w-12 h-12 rounded-full border shadow-sm object-cover">
                        <textarea id="post-input" placeholder="Розкажи, що цікавого?" class="flex-1 border-none focus:ring-0 text-lg resize-none pt-2 outline-none h-24"></textarea>
                    </div>
                    
                    <div id="media-preview" class="hide relative bg-slate-100 p-2 rounded-xl flex items-center justify-between border border-dashed border-slate-300">
                        <span id="media-preview-text" class="text-xs font-mono truncate mr-8"></span>
                        <button onclick="clearMedia()" class="bg-white rounded-full p-1 shadow-sm"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>

                    <div class="flex justify-between items-center pt-2 border-t">
                        <div class="flex gap-2">
                            <button onclick="addMedia('image')" class="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition"><i data-lucide="image"></i></button>
                            <button onclick="addMedia('video')" class="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition"><i data-lucide="film"></i></button>
                            <button onclick="addMedia('audio')" class="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition"><i data-lucide="music"></i></button>
                        </div>
                        <button onclick="createPost()" class="bg-blue-600 text-white px-8 py-2 rounded-full font-bold hover:bg-blue-700 transition-colors">Post</button>
                    </div>
                </div>
                <div id="posts-container" class="divide-y">
                    <!-- Posts will be injected here -->
                </div>
            </div>

            <!-- Profile View -->
            <div id="view-profile" class="view-content p-8 hide">
                <div class="flex flex-col items-center">
                    <img id="prof-avatar" src="" class="w-32 h-32 rounded-full border-4 border-blue-50 shadow-xl object-cover">
                    <h2 id="prof-name" class="text-2xl font-black mt-4">Ім'я</h2>
                    <div id="prof-role" class="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-bold mt-2 uppercase tracking-widest">Учень</div>
                </div>

                <div class="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div class="bg-slate-50 p-6 rounded-2xl border">
                        <p class="text-slate-400 text-xs font-bold uppercase mb-1">Навчальний заклад</p>
                        <p id="prof-school" class="text-lg font-bold">Не вказано</p>
                    </div>
                    <div class="bg-slate-50 p-6 rounded-2xl border">
                        <p class="text-slate-400 text-xs font-bold uppercase mb-1">Клас / Посада</p>
                        <p id="prof-grade" class="text-lg font-bold">Не вказано</p>
                    </div>
                </div>
            </div>

            <!-- Info View -->
            <div id="view-info" class="view-content p-8 hide">
                <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-left">
                    <h3 class="text-xl font-bold text-blue-900 mb-2">Підтримка</h3>
                    <p class="text-slate-600">Якщо у вас виникли питання або ви хочете отримати статус модератора, зверніться до розробника.</p>
                    <p class="mt-4 font-bold text-blue-600">oleksijmaric20@gmail.com</p>
                </div>
            </div>
        </main>
    </div>

    <!-- Edit Profile Modal -->
    <div id="edit-modal" class="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 hide">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div class="p-6 border-b flex justify-between items-center">
                <h3 class="text-xl font-bold">Налаштування профілю</h3>
                <button onclick="closeEditModal()" class="p-2 hover:bg-slate-100 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div class="p-6 space-y-4 text-left">
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Аватарка (URL)</label>
                    <input type="text" id="edit-photo" class="w-full bg-slate-50 border-none rounded-xl p-3 outline-blue-500" placeholder="https://...">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Ім'я</label>
                    <input type="text" id="edit-name" class="w-full bg-slate-50 border-none rounded-xl p-3 outline-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Школа</label>
                    <input type="text" id="edit-school" class="w-full bg-slate-50 border-none rounded-xl p-3 outline-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Клас</label>
                    <input type="text" id="edit-grade" class="w-full bg-slate-50 border-none rounded-xl p-3 outline-blue-500">
                </div>
                <button onclick="saveProfile()" class="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                    <i data-lucide="save"></i> Зберегти зміни
                </button>
            </div>
        </div>
    </div>

    <script>
        // --- Firebase Configuration ---
        const firebaseConfig = JSON.parse(__firebase_config);
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'school-space-html';
        firebase.initializeApp(firebaseConfig);
        
        const auth = firebase.auth();
        const db = firebase.firestore();
        
        let currentUser = null;
        let currentProfile = null;
        let currentMediaType = 'none';
        let currentMediaUrl = '';

        // --- Auth Logic ---
        async function handleGoogleLogin() {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
            } catch (err) {
                showError(err.message);
                if (err.code === 'auth/unauthorized-domain') {
                    showError("Додайте 'usercontent.goog' у дозволені домени в Firebase Console.");
                }
            }
        }

        async function handleGuestLogin() {
            try {
                await auth.signInAnonymously();
            } catch (err) { showError(err.message); }
        }

        function handleLogout() {
            auth.signOut();
        }

        function showError(msg) {
            const errBox = document.getElementById('auth-error');
            const errMsg = document.getElementById('error-message');
            errBox.classList.remove('hide');
            errMsg.innerText = msg;
        }

        // --- Profile & UI Logic ---
        auth.onAuthStateChanged(async (user) => {
            document.getElementById('loading-screen').classList.add('hide');
            if (user) {
                currentUser = user;
                document.getElementById('login-screen').classList.add('hide');
                document.getElementById('app-layout').classList.remove('hide');
                
                await syncProfile();
                listenToPosts();
                lucide.createIcons();
            } else {
                document.getElementById('app-layout').classList.add('hide');
                document.getElementById('login-screen').classList.remove('hide');
            }
        });

        async function syncProfile() {
            const profileRef = db.collection('artifacts').doc(appId).collection('users').doc(currentUser.uid).collection('profile').doc('data');
            const doc = await profileRef.get();
            
            if (doc.exists) {
                currentProfile = doc.data();
            } else {
                currentProfile = {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || "Учень",
                    school: "Не вказано",
                    grade: "Не вказано",
                    photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || 'U'}`,
                    role: 'student'
                };
                await profileRef.set(currentProfile);
            }
            updateUIWithProfile();
        }

        function updateUIWithProfile() {
            const avatarElems = ['side-avatar', 'post-avatar', 'prof-avatar'];
            avatarElems.forEach(id => document.getElementById(id).src = currentProfile.photoURL);
            
            document.getElementById('side-name').innerText = currentProfile.displayName;
            document.getElementById('side-school').innerText = currentProfile.school;
            document.getElementById('prof-name').innerText = currentProfile.displayName;
            document.getElementById('prof-school').innerText = currentProfile.school;
            document.getElementById('prof-grade').innerText = currentProfile.grade;
            document.getElementById('prof-role').innerText = currentProfile.role;
        }

        function switchView(view) {
            document.querySelectorAll('.view-content').forEach(el => el.classList.add('hide'));
            document.getElementById(`view-${view}`).classList.remove('hide');
            document.getElementById('view-title').innerText = view === 'feed' ? 'Стрічка' : view === 'profile' ? 'Мій Профіль' : 'Допомога';
            
            // Highlight nav buttons
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('bg-blue-50', 'text-blue-600', 'font-bold');
                if (btn.dataset.view === view) btn.classList.add('bg-blue-50', 'text-blue-600', 'font-bold');
            });

            // Show settings only on profile
            document.getElementById('settings-btn').classList.toggle('hide', view !== 'profile');
        }

        // --- Posts Logic ---
        function addMedia(type) {
            const url = prompt(`Вставте посилання на ваш ${type} файл:`);
            if (url) {
                currentMediaType = type;
                currentMediaUrl = url;
                document.getElementById('media-preview').classList.remove('hide');
                document.getElementById('media-preview-text').innerText = `${type.toUpperCase()}: ${url}`;
            }
        }

        function clearMedia() {
            currentMediaType = 'none';
            currentMediaUrl = '';
            document.getElementById('media-preview').classList.add('hide');
        }

        async function createPost() {
            const text = document.getElementById('post-input').value.trim();
            if (!text && !currentMediaUrl) return;

            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('posts').add({
                text: text,
                mediaUrl: currentMediaUrl,
                mediaType: currentMediaType,
                authorId: currentUser.uid,
                authorName: currentProfile.displayName,
                authorPhoto: currentProfile.photoURL,
                school: currentProfile.school,
                likes: 0,
                likedBy: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            document.getElementById('post-input').value = '';
            clearMedia();
        }

        function listenToPosts() {
            db.collection('artifacts').doc(appId).collection('public').doc('data').collection('posts')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snapshot => {
                    const container = document.getElementById('posts-container');
                    container.innerHTML = '';
                    snapshot.forEach(doc => renderPost(doc.id, doc.data(), container));
                    lucide.createIcons();
                });
        }

        function renderPost(id, post, container) {
            let mediaHtml = '';
            if (post.mediaUrl) {
                if (post.mediaType === 'image') mediaHtml = `<img src="${post.mediaUrl}" class="mt-3 rounded-xl max-h-96 w-full object-cover border">`;
                else if (post.mediaType === 'video') mediaHtml = `<video src="${post.mediaUrl}" controls class="mt-3 rounded-xl w-full border"></video>`;
                else if (post.mediaType === 'audio') mediaHtml = `<audio src="${post.mediaUrl}" controls class="mt-3 w-full"></audio>`;
            }

            const isLiked = post.likedBy?.includes(currentUser.uid);

            const postHtml = `
                <article class="p-4 hover:bg-slate-50 transition-colors text-left">
                    <div class="flex gap-4">
                        <img src="${post.authorPhoto}" class="w-12 h-12 rounded-full border object-cover">
                        <div class="flex-1">
                            <div>
                                <span class="font-bold">${post.authorName}</span>
                                <span class="text-xs text-slate-400 block">${post.school}</span>
                            </div>
                            <p class="mt-2 text-slate-800">${post.text}</p>
                            ${mediaHtml}
                            <div class="mt-4 flex gap-6 text-slate-400">
                                <button onclick="toggleLike('${id}', ${JSON.stringify(post.likedBy || [])})" class="flex items-center gap-1 hover:text-rose-500 transition ${isLiked ? 'text-rose-500 font-bold' : ''}">
                                    <i data-lucide="heart" class="w-5 h-5 ${isLiked ? 'fill-current' : ''}"></i> ${post.likes || 0}
                                </button>
                                <button class="hover:text-orange-500 transition"><i data-lucide="shield-alert" class="w-5 h-5"></i></button>
                            </div>
                        </div>
                    </div>
                </article>
            `;
            container.innerHTML += postHtml;
        }

        async function toggleLike(postId, likedBy) {
            const isLiked = likedBy.includes(currentUser.uid);
            const newLikedBy = isLiked ? likedBy.filter(u => u !== currentUser.uid) : [...likedBy, currentUser.uid];
            
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('posts').doc(postId).update({
                likes: newLikedBy.length,
                likedBy: newLikedBy
            });
        }

        // --- Modal Logic ---
        function openEditModal() {
            document.getElementById('edit-modal').classList.remove('hide');
            document.getElementById('edit-photo').value = currentProfile.photoURL;
            document.getElementById('edit-name').value = currentProfile.displayName;
            document.getElementById('edit-school').value = currentProfile.school;
            document.getElementById('edit-grade').value = currentProfile.grade;
        }

        function closeEditModal() {
            document.getElementById('edit-modal').classList.add('hide');
        }

        async function saveProfile() {
            const updated = {
                photoURL: document.getElementById('edit-photo').value,
                displayName: document.getElementById('edit-name').value,
                school: document.getElementById('edit-school').value,
                grade: document.getElementById('edit-grade').value
            };
            
            await db.collection('artifacts').doc(appId).collection('users').doc(currentUser.uid).collection('profile').doc('data').update(updated);
            currentProfile = { ...currentProfile, ...updated };
            updateUIWithProfile();
            closeEditModal();
        }

        // Init Lucide
        lucide.createIcons();
        switchView('feed');
    </script>
</body>
</html>
