import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// ... (existing imports)

export const requestForToken = async (currentUser) => {
    try {
        if (Capacitor.isNativePlatform()) {
            console.log("Initializing Native Push Notifications...");

            // Check & Request Permissions
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn("Push notifications permission denied");
                return;
            }

            // Register
            await PushNotifications.register();

            // Listeners (We add these once here or in App.jsx - cleaner here for token)
            // Ideally listeners should be in App.jsx to handle routing, but token registration is here.
            // We'll just register the token listener here.
            PushNotifications.addListener('registration', (token) => {
                console.log('Mobile Push Registration Token: ', token.value);
                sendTokenToServer(currentUser.username, token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push registration error: ', error);
            });

        } else {
            // ... (web logic remains)
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
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
