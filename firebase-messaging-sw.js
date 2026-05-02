// Firebase Messaging service worker placeholder.
// For full lock-screen Firebase Cloud Messaging, paste Firebase compat scripts here if required by your hosting setup.
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');
firebase.initializeApp({
  apiKey: "AIzaSyBbh9bAUg21T3i94pVD50Ak8diV0qFvRCE",
  authDomain: "vmas-intercom.firebaseapp.com",
  databaseURL: "https://vmas-intercom-default-rtdb.firebaseio.com",
  projectId: "vmas-intercom",
  storageBucket: "vmas-intercom.firebasestorage.app",
  messagingSenderId: "430555520466",
  appId: "1:430555520466:web:39873293db290696bfbc0b"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification?.title || 'Office Intercom Call', { body: payload.notification?.body || 'You are being called', icon: 'assets/icon-192.png' });
});
