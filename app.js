/* VMAS Mobile Intercom - FINAL FIXED PUSH VERSION */

if (!window.firebaseConfig) alert('Firebase config missing');
firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();

let messaging = null;
try {
  if (firebase.messaging && window.firebaseVapidKey) {
    messaging = firebase.messaging();
  }
} catch(e){ console.warn(e); }

let employees = {};
let currentUser = null;

const $ = id => document.getElementById(id);

/* ---------------- INIT ---------------- */

window.onload = async () => {
  await loadEmployees();
  bindEvents();

  const saved = localStorage.getItem('intercom_user');
  if (saved && employees[saved]) enterApp(saved);
};

function bindEvents(){
  $('loginBtn').onclick = login;
  $('logoutBtn').onclick = logout;
  $('enableNotifyBtn').onclick = enableNotifications;
}

/* ---------------- LOGIN ---------------- */

async function loadEmployees(){
  const snap = await db.ref('employees').once('value');
  employees = snap.val() || {};
}

function login(){
  const u = $('username').value.trim().toLowerCase();
  const p = $('pin').value.trim();

  if (employees[u] && employees[u].pin === p) {
    localStorage.setItem('intercom_user', u);
    enterApp(u);
  } else alert('Invalid login');
}

function enterApp(u){
  currentUser = u;
  $('loginView').classList.add('hidden');
  $('mainView').classList.remove('hidden');
  listenCalls();
}

function logout(){
  localStorage.removeItem('intercom_user');
  location.reload();
}

/* ---------------- CALL ---------------- */

async function callUser(to){

  const call = {
    from: currentUser,
    fromName: employees[currentUser]?.name || currentUser,
    to,
    time: Date.now(),
    status: "ringing"
  };

  // Save call
  await db.ref(`calls/${to}`).set(call);
  await db.ref('callLogs').push(call);

  // ✅ IMPORTANT FIX: always fetch latest token
  const tokenSnap = await db.ref(`employees/${to}/fcmToken`).once('value');
  const token = tokenSnap.val();

  if (token) {
    await db.ref('pushQueue').push({
      token: token,
      title: "Office Intercom Call",
      body: `${call.fromName} is calling you`,
      time: Date.now()
    });
  }

  alert("Calling " + to);
}

/* ---------------- INCOMING ---------------- */

function listenCalls(){
  db.ref(`calls/${currentUser}`).on('value', snap => {
    const call = snap.val();
    if (!call) return;

    showIncoming(call);
  });
}

function showIncoming(call){

  alert(`${call.fromName} is calling you`);

  // play sound
  const audio = new Audio("assets/alert.mp3");
  audio.loop = true;
  audio.play().catch(()=>{});

  // stop after 10 sec auto
  setTimeout(()=> audio.pause(), 10000);
}

/* ---------------- PUSH ENABLE ---------------- */

async function enableNotifications(){

  if (!messaging) {
    alert("Push not configured. Add VAPID key.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    alert("Notification permission denied");
    return;
  }

  try {
    const token = await messaging.getToken({
      vapidKey: window.firebaseVapidKey
    });

    if (token) {
      await db.ref(`employees/${currentUser}/fcmToken`).set(token);

      alert("Push enabled successfully ✅");
    }

  } catch(e){
    console.error(e);
    alert("Push failed. Check VAPID key.");
  }
}
