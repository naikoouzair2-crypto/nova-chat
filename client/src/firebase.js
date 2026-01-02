import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_URL } from './config';

// TODO: Replace with your config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCUpLBnpha_e2pdLv83DPuv3Jj4sWMgkXs",
    authDomain: "nova-chat-e141d.firebaseapp.com",
    projectId: "nova-chat-e141d",
    storageBucket: "nova-chat-e141d.firebasestorage.app",
    messagingSenderId: "63491828540",
    appId: "1:63491828540:web:123ebf80902fbd202acc39",
    measurementId: "G-9VKCYE2KL6"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const sendTokenToServer = async (username, token) => {
    if (!token || !username) return;
    try {
        await fetch(`${API_URL}/register-device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, token })
        });
        console.log('Token generated and sent to server:', token);
    } catch (err) {
        console.error('Error sending token to server:', err);
    }
};

export const requestForToken = async (currentUser) => {
    try {
        if (Capacitor.isNativePlatform()) {
            // --- NATIVE (ANDROID/IOS) LOGIC ---
            const permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                const newStatus = await PushNotifications.requestPermissions();
                if (newStatus.receive !== 'granted') {
                    throw new Error('User denied permissions!');
                }
            }

            if (permStatus.receive !== 'granted') {
                // Double check if initial check was already denied
                if (permStatus.receive === 'denied') return;
            }

            await PushNotifications.register();

            // Listen for registration to get token
            PushNotifications.addListener('registration', (token) => {
                console.log('Push Registration Token: ', token.value);
                sendTokenToServer(currentUser.username, token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Error on registration: ', error);
            });

            // Handle foreground notifications
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ', notification);
                // Toast or Alert is usually handled by presentationOptions in config, 
                // but you can add custom UI logic here if needed.
            });

            // Handle notification tap
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push action performed: ', notification);
                // Navigate to chat screen if needed
            });

        } else {
            // --- WEB / PWA LOGIC ---
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // Register Service Worker explicitly
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

                const token = await getToken(messaging, {
                    vapidKey: "BB8HOexqlAEboiqnHYuaJdyO0prLBcxjFH3EmrKMLUxKtk1mC6rxdTflnamJ82GrAC6vxyNgg_dtWx4YZUlmwsc",
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    await sendTokenToServer(currentUser.username, token);
                }
            }
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        // This works for foreground Web messages
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
