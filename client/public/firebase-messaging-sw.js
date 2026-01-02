// Scripts for firebase messaging
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing the public config keys.
const firebaseConfig = {
    apiKey: "AIzaSyCUpLBnpha_e2pdLv83DPuv3Jj4sWMgkXs",
    authDomain: "nova-chat-e141d.firebaseapp.com",
    projectId: "nova-chat-e141d",
    storageBucket: "nova-chat-e141d.firebasestorage.app",
    messagingSenderId: "63491828540",
    appId: "1:63491828540:web:123ebf80902fbd202acc39",
    measurementId: "G-9VKCYE2KL6"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/nova_logo_transparent.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
