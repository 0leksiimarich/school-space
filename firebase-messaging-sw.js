// Це фоновий скрипт для сповіщень
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "ТВІЙ_API_KEY",
  projectId: "ТВІЙ_PROJECT_ID",
  messagingSenderId: "ТВІЙ_SENDER_ID",
  appId: "ТВІЙ_APP_ID"
});

const messaging = firebase.messaging();

// Обробка повідомлень, коли додаток у фоні
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png' // Можеш додати іконку свого SchoolSpace
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
