importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Встав сюди дані зі свого Firebase (ті самі, що в firebase.js)
firebase.initializeApp({
 apiKey: "AIzaSyCAy9JPvV3v7J8mhqa7K1cotTWebmURgtI",
  authDomain: "schoolspace-53f0d.firebaseapp.com",
  projectId: "schoolspace-53f0d",
  storageBucket: "schoolspace-53f0d.firebasestorage.app",
  messagingSenderId: "832888496203",
  appId: "1:832888496203:web:3377bfcd63cc277c86edce",
  measurementId: "G-CCD219H76Y"
});

const messaging = firebase.messaging();

// Обробка фонових сповіщень
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Отримано фонове повідомлення:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/906/906377.png' // Можеш замінити на свою іконку
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
