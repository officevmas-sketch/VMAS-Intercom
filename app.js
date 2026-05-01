/* VMAS Mobile Intercom - Android + iPhone installable PWA */
if (!window.firebaseConfig) alert('Firebase config missing. Check firebase-config.js');
firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();
let messaging = null;
try { if (firebase.messaging && window.firebaseVapidKey && !window.firebaseVapidKey.includes('PASTE_')) messaging = firebase.messaging(); } catch(e) { console.warn(e); }

let employees = {};
let currentUser = null;
let currentFilter = 'All';
let deferredInstallPrompt = null;
let callListenerRef = null;

const $ = id => document.getElementById(id);

window.addEventListener('load', async () => {
  registerServiceWorker();
  setupInstallPrompt();
  bindEvents();
  await loadEmployees();
  const saved = localStorage.getItem('intercom_user');
  if (saved && employees[saved]) enterApp(saved);
});

function bindEvents(){
  $('loginBtn').onclick = login;
  $('logoutBtn').onclick = logout;
  $('ackBtn').onclick = acknowledgeCall;
  $('searchBox').oninput = renderEmployees;
  $('enableNotifyBtn').onclick = enableNotifications;
  $('saveEmployeeBtn').onclick = saveEmployee;
  $('installBtn').onclick = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $('installBtn').classList.add('hidden');
    }
  };
}

async function registerServiceWorker(){
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./service-worker.js'); } catch(e){ console.warn('SW failed', e); }
  }
}

function setupInstallPrompt(){
  const ua = navigator.userAgent.toLowerCase();
  const isiOS = /iphone|ipad|ipod/.test(ua);
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $('installCard')?.classList.remove('hidden');
    $('installBtn')?.classList.remove('hidden');
    $('installText').textContent = 'Tap Install to add this app to your mobile home screen.';
  });
  if (isiOS) {
    setTimeout(() => {
      if (!window.navigator.standalone) {
        $('installCard')?.classList.remove('hidden');
        $('installText').textContent = 'iPhone: open in Safari → Share button → Add to Home Screen.';
      }
    }, 900);
  }
}

async function loadEmployees(){
  const snap = await db.ref('employees').once('value');
  if (snap.exists()) {
    employees = snap.val();
  } else {
    const res = await fetch('users.json');
    employees = await res.json();
    await db.ref('employees').set(employees);
  }
}

function login(){
  const username = $('username').value.trim().toLowerCase();
  const pin = $('pin').value.trim();
  if (employees[username] && employees[username].pin === pin) {
    localStorage.setItem('intercom_user', username);
    enterApp(username);
  } else alert('Invalid username or PIN');
}

function enterApp(username){
  currentUser = username;
  $('loginView').classList.add('hidden');
  $('mainView').classList.remove('hidden');
  $('currentUserName').textContent = employees[username].name || username;
  $('adminPanel').classList.toggle('hidden', employees[username].role !== 'admin');
  renderDepartments();
  renderEmployees();
  listenForIncomingCalls();
  listenLogs();
  updatePresence();
  setInterval(updatePresence, 30000);
}

function logout(){
  if (callListenerRef) callListenerRef.off();
  currentUser = null;
  localStorage.removeItem('intercom_user');
  location.reload();
}

function renderDepartments(){
  const depts = ['All', ...new Set(Object.values(employees).map(e => e.department || 'General'))];
  $('departmentFilters').innerHTML = '';
  depts.forEach(d => {
    const b = document.createElement('button');
    b.textContent = d;
    b.className = 'chip' + (d === currentFilter ? ' active' : '');
    b.onclick = () => { currentFilter = d; renderDepartments(); renderEmployees(); };
    $('departmentFilters').appendChild(b);
  });
}

function renderEmployees(){
  const q = ($('searchBox').value || '').toLowerCase();
  const list = $('employeeList');
  list.innerHTML = '';
  Object.entries(employees).forEach(([username, e]) => {
    if (username === currentUser) return;
    const dept = e.department || 'General';
    const text = `${username} ${e.name} ${dept}`.toLowerCase();
    if (currentFilter !== 'All' && dept !== currentFilter) return;
    if (q && !text.includes(q)) return;
    const div = document.createElement('div');
    div.className = 'employee';
    div.innerHTML = `<div><div class="emp-name">${escapeHtml(e.name || username)}</div><div class="emp-dept">${escapeHtml(dept)}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'call-btn';
    btn.textContent = 'Call';
    btn.onclick = () => callUser(username);
    div.appendChild(btn);
    list.appendChild(div);
  });
}

async function callUser(to){
  const call = { from: currentUser, fromName: employees[currentUser].name || currentUser, to, toName: employees[to].name || to, status:'ringing', time: Date.now() };
  await db.ref(`calls/${to}`).set(call);
  await db.ref('callLogs').push(call);
  if (employees[to].fcmToken) await db.ref('pushQueue').push({ to, token: employees[to].fcmToken, title:'Office Intercom Call', body:`${call.fromName} is calling you`, time: Date.now() });
  toast(`Calling ${call.toName}...`);
}

function listenForIncomingCalls(){
  if (callListenerRef) callListenerRef.off();
  callListenerRef = db.ref(`calls/${currentUser}`);
  callListenerRef.on('value', snap => {
    const call = snap.val();
    if (!call) return;
    showIncoming(call);
  });
}

function showIncoming(call){
  $('incomingBox').classList.remove('hidden');
  $('incomingTitle').textContent = 'Incoming Call';
  $('incomingMessage').textContent = `${call.fromName || call.from} is calling you`;
  playRingtone();
  if (navigator.vibrate) navigator.vibrate([500,200,500,200,500]);
  if (Notification.permission === 'granted') new Notification('Office Intercom Call', { body: `${call.fromName || call.from} is calling you`, icon: 'assets/icon-192.png' });
}

async function acknowledgeCall(){
  stopRingtone();
  $('incomingBox').classList.add('hidden');
  await db.ref(`calls/${currentUser}`).remove();
}

function playRingtone(){
  const a = $('ringtone');
  a.currentTime = 0; a.loop = true; a.play().catch(()=>{});
}
function stopRingtone(){ const a = $('ringtone'); a.pause(); a.currentTime = 0; }

async function enableNotifications(){
  if (!('Notification' in window)) return alert('Notifications are not supported on this browser.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return alert('Notification permission not allowed.');
  if (messaging) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({ vapidKey: window.firebaseVapidKey, serviceWorkerRegistration: reg });
      if (token) await db.ref(`employees/${currentUser}/fcmToken`).set(token);
    } catch(e){ console.warn(e); }
  }
  alert('Notifications enabled. For iPhone, install from Safari using Add to Home Screen.');
}

async function saveEmployee(){
  const username = $('newUsername').value.trim().toLowerCase();
  if (!username) return alert('Enter username');
  const data = { pin: $('newPin').value.trim() || '1234', name: $('newName').value.trim() || username, department: $('newDept').value.trim() || 'General', role: 'employee' };
  await db.ref(`employees/${username}`).update(data);
  employees[username] = {...(employees[username]||{}), ...data};
  renderDepartments(); renderEmployees();
  $('newUsername').value = $('newPin').value = $('newName').value = $('newDept').value = '';
  toast('Employee saved');
}

function listenLogs(){
  db.ref('callLogs').limitToLast(20).on('value', snap => {
    const logs = [];
    snap.forEach(s => logs.push(s.val()));
    $('logs').innerHTML = logs.reverse().map(l => `<div class="log"><b>${escapeHtml(l.fromName||l.from)}</b> called <b>${escapeHtml(l.toName||l.to)}</b><br><span class="muted">${new Date(l.time).toLocaleString()}</span></div>`).join('') || '<p class="muted">No calls yet.</p>';
  });
}

async function updatePresence(){ if(currentUser) await db.ref(`presence/${currentUser}`).set({online:true,lastSeen:Date.now()}); }
function toast(msg){ alert(msg); }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
