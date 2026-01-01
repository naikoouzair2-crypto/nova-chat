import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
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

export const requestForToken = async (currentUser) => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: "BB8HOexqlAEboiqnHYuaJdyO0prLBcxjFH3EmrKMLUxKtk1mC6rxdTflnamJ82GrAC6vxyNgg_dtWx4YZUlmwsc"
            });
            if (token) {
                // Send this token to server (and subscribe to topic/user)
                await fetch(`${API_URL}/register-device`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser.username, token })
                });
                console.log('Token generated and sent to server:', token);
            }
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
