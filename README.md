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

Your Web Push Certificate Key is already added in `firebase-config.js`.

No manual key paste is required for this build.

## Deploy Cloud Function for push notifications

From the app folder, run:

```bash
npm install -g firebase-tools
firebase login
firebase use vmas-intercom
cd functions
npm install
cd ..
firebase deploy --only functions,database
```

Do **not** run `firebase init functions` for this ZIP because the function files are already prepared.

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


## New Upgrade: Walkie-Talkie + Reports

### Walkie-Talkie
- Login on mobile.
- Select an employee in the Walkie-Talkie section.
- Press and hold **🎤 Hold to Talk**.
- Speak and release to send.
- The receiving employee hears the voice message inside the app.

Notes:
- Microphone permission is required.
- Keep each voice note short, ideally below 20 seconds.
- For iPhone, audio playback may require the user to tap once in the app because of iOS browser restrictions.

### Reports
- Recent logs now include normal calls and voice messages.
- Admin/user can export logs to CSV from the **Export CSV** button.
- Summary cards show total entries, today's activity, call count, voice count, and top caller.

### Firebase Data Used
- `calls/` for normal calls.
- `voiceMessages/` for walkie-talkie messages.
- `callLogs/` for reports and export.
- `pushQueue/` for background notifications if Firebase Functions are deployed.
