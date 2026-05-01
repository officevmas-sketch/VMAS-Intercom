# VMAS Mobile Intercom App

Installable mobile app for Android and iPhone using PWA technology.

## What it does

- Employee PIN login
- Tap to call another employee
- Incoming call screen with ringtone and vibration
- Works on Android and iPhone as an installable home-screen app
- Department-wise employee list
- Admin can add/update employees
- Recent call logs
- Firebase Realtime Database support
- Push-notification-ready files included

## Default login

- admin / 9999
- vivek / 1234
- reception / 1111
- accounts / 2222
- tax / 3333

## Install on Android

1. Open the hosted app link in Chrome.
2. Tap the three-dot menu.
3. Tap **Add to Home Screen** or **Install App**.

## Install on iPhone

1. Open the hosted app link in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.

## Firebase setup

Your Firebase config is already added in `firebase-config.js`.

You must enable Realtime Database:

1. Open Firebase Console.
2. Select project: `vmas-intercom`.
3. Go to **Build > Realtime Database**.
4. Click **Create Database**.
5. Select **Start in test mode** for initial testing.

For testing, use these Realtime Database rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

For office live use, make rules stricter later.

## Change ringtone

Replace this file:

```text
assets/alert.mp3
```

Use a short MP3 file and keep the same name.

## GitHub Pages upload

1. Create a GitHub repository.
2. Upload all extracted files, not the ZIP.
3. Go to **Settings > Pages**.
4. Select branch: `main` and folder `/root`.
5. Open the GitHub Pages link on mobile.
6. Install to home screen.

## Lock-screen push notifications

In-app ringing works immediately when the app is open.

For phone locked/app closed notifications, Firebase Cloud Messaging requires:

1. Generate Web Push certificate key in Firebase Console.
2. Paste the key in `firebase-config.js`:

```js
window.firebaseVapidKey = "YOUR_KEY_HERE";
```

3. Deploy the Cloud Function in the `functions` folder using Firebase CLI.

Commands:

```bash
npm install -g firebase-tools
firebase login
firebase init functions
firebase deploy --only functions
```

Note: Android supports web push well. iPhone requires the app to be installed from Safari to the Home Screen and notification permission to be allowed.
