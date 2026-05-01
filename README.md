# VMAS Mobile Intercom - Android & iPhone PWA

This version keeps the existing app features and adds:

- Background / lock-screen push notification support using Firebase Cloud Messaging
- Replaceable ringtone: `assets/alert.mp3`
- Admin user activation / deactivation
- Admin user deletion
- Admin edit / update employee details

## Important background notification note

A website/PWA cannot continuously run in the background like a native Android service. The correct and battery-safe method is **push notifications**.

The app will work in two modes:

1. **App open:** incoming call rings inside the app with sound and vibration.
2. **App closed / phone locked:** incoming call appears as a mobile push notification after Firebase Cloud Messaging and Firebase Function are configured.

## Firebase config

Your Firebase config is already added in `firebase-config.js`.

For closed-app notifications, also add your Web Push Certificate Key:

1. Firebase Console
2. Project Settings
3. Cloud Messaging
4. Web Push certificates
5. Generate key pair
6. Copy the key into `firebase-config.js`:

```js
window.firebaseVapidKey = "PASTE_KEY_HERE";
```

## Deploy Cloud Function for push notifications

From the app folder:

```bash
cd functions
npm install
firebase login
firebase init functions
firebase deploy --only functions
```

The function listens to `/pushQueue` in Realtime Database and sends the notification to the called employee.

## Enable notifications on each phone

Each employee must:

1. Login once
2. Tap **Enable Notifications**
3. Allow notification permission
4. On iPhone: install from Safari using **Add to Home Screen** first

## Admin user management

Login as admin, then open Admin section:

- Add employee
- Update employee
- Deactivate employee
- Activate employee
- Delete employee

Deactivated employees cannot login and will not appear in the call list.
Deleted employees are fully removed from Firebase.

## Install on mobile

### Android
Open hosted app link in Chrome → menu → Add to Home Screen.

### iPhone
Open hosted app link in Safari → Share → Add to Home Screen.

## Change ringtone

Replace this file with any short MP3:

```text
assets/alert.mp3
```

Keep the same file name.

## Admin delete / deactivate fix

This build has an updated Admin Manage Employees section.

If delete/deactivate still does not work after upload, check Firebase Realtime Database rules:

1. Firebase Console → Realtime Database → Rules
2. For testing/internal office use, paste:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

3. Click Publish.

Then refresh the app on mobile and login again as admin.
