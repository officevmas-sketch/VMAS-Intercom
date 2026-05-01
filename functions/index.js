const admin = require('firebase-admin');
const functions = require('firebase-functions/v2/database');
admin.initializeApp();

exports.sendIntercomPush = functions.onValueCreated('/pushQueue/{id}', async (event) => {
  const data = event.data.val();
  if (!data || !data.token) return null;
  await admin.messaging().send({
    token: data.token,
    notification: {
      title: data.title || 'Office Intercom Call',
      body: data.body || 'You are being called'
    },
    webpush: {
      notification: {
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        vibrate: [500, 200, 500]
      },
      fcmOptions: { link: '/' }
    }
  });
  await event.data.ref.remove();
  return null;
});
