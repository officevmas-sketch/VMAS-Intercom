const admin = require("firebase-admin");
const { onValueCreated } = require("firebase-functions/v2/database");

admin.initializeApp();

exports.sendIntercomPush = onValueCreated(
  {
    ref: "/pushQueue/{id}",
    instance: "vmas-intercom-default-rtdb",
    region: "asia-southeast1"
  },
  async (event) => {
    const data = event.data.val();
    if (!data || !data.token) return null;

    try {
      await admin.messaging().send({
        token: data.token,
        notification: {
          title: data.title || "Office Intercom Call",
          body: data.body || "You are being called"
        },
        webpush: {
          notification: {
            icon: "/assets/icon-192.png",
            badge: "/assets/icon-192.png",
            vibrate: [500, 200, 500],
            requireInteraction: true
          },
          fcmOptions: {
            link: "https://officevmas-sketch.github.io/"
          }
        }
      });
    } catch (error) {
      console.error("Push send failed:", error);
    }

    await event.data.ref.remove();
    return null;
  }
);
