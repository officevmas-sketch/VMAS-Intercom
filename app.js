/* VMAS Mobile Intercom - Android + iPhone installable PWA with background push notifications */
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
let presenceTimer = null;

const $ = id => document.getElementById(id);

window.addEventListener('load', async () => {
  await registerServiceWorker();
  setupInstallPrompt();
  bindEvents();
  await loadEmployees();
  const saved = localStorage.getItem('intercom_user');
  if (saved && employees[saved] && employees[saved].active !== false) enterApp(saved);
});

function bindEvents(){
  $('loginBtn').onclick = login;
  $('logoutBtn').onclick = logout;
  $('ackBtn').onclick = acknowledgeCall;
  $('searchBox').oninput = renderEmployees;
  $('enableNotifyBtn').onclick = enableNotifications;
  $('saveEmployeeBtn').onclick = saveEmployee;
  $('adminEmployeeSearch').oninput = renderAdminEmployees;
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
    try { await navigator.serviceWorker.register('./service-worker.js'); } catch(e){ console.warn('App SW failed', e); }
  }
}

async function registerMessagingServiceWorker(){
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('./firebase-messaging-sw.js'); }
  catch(e){ console.warn('Messaging SW failed', e); return null; }
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
    // Add active=true to old records without changing inactive employees.
    Object.entries(employees).forEach(([u,e]) => { if (e.active === undefined) employees[u].active = true; });
  } else {
    const res = await fetch('users.json');
    employees = await res.json();
    Object.values(employees).forEach(e => { if (e.active === undefined) e.active = true; });
    await db.ref('employees').set(employees);
  }
}

function login(){
  const username = $('username').value.trim().toLowerCase();
  const pin = $('pin').value.trim();
  if (employees[username] && employees[username].active === false) return alert('This user is deactivated. Please contact admin.');
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
  renderAdminEmployees();
  listenForIncomingCalls();
  listenEmployees();
  listenLogs();
  updatePresence();
  clearInterval(presenceTimer);
  presenceTimer = setInterval(updatePresence, 30000);
}

function logout(){
  if (callListenerRef) callListenerRef.off();
  currentUser = null;
  localStorage.removeItem('intercom_user');
  location.reload();
}

function listenEmployees(){
  db.ref('employees').on('value', snap => {
    if (!snap.exists()) return;
    employees = snap.val();
    Object.entries(employees).forEach(([u,e]) => { if (e.active === undefined) employees[u].active = true; });
    if (currentUser && (!employees[currentUser] || employees[currentUser].active === false)) {
      alert('Your user has been deactivated or deleted by admin.');
      logout();
      return;
    }
    renderDepartments();
    renderEmployees();
    renderAdminEmployees();
  });
}

function renderDepartments(){
  const activeEmployees = Object.values(employees).filter(e => e.active !== false);
  const depts = ['All', ...new Set(activeEmployees.map(e => e.department || 'General'))];
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
    if (username === currentUser || e.active === false) return;
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
  if (!list.innerHTML) list.innerHTML = '<p class="muted">No active employees found.</p>';
}

async function callUser(to){
  if (!employees[to] || employees[to].active === false) return alert('This employee is not active.');
  const call = { from: currentUser, fromName: employees[currentUser].name || currentUser, to, toName: employees[to].name || to, status:'ringing', time: Date.now() };
  await db.ref(`calls/${to}`).set(call);
  await db.ref('callLogs').push(call);
  if (employees[to].fcmToken) {
    await db.ref('pushQueue').push({ to, token: employees[to].fcmToken, title:'Office Intercom Call', body:`${call.fromName} is calling you`, time: Date.now() });
  }
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
  if ('Notification' in window && Notification.permission === 'granted') new Notification('Office Intercom Call', { body: `${call.fromName || call.from} is calling you`, icon: 'assets/icon-192.png' });
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
  if (!messaging) return alert('Basic notifications enabled. For closed-app notifications, paste Web Push Certificate key in firebase-config.js and deploy Firebase Functions.');
  try {
    const reg = await registerMessagingServiceWorker();
    const token = await messaging.getToken({ vapidKey: window.firebaseVapidKey, serviceWorkerRegistration: reg || await navigator.serviceWorker.ready });
    if (token) {
      await db.ref(`employees/${currentUser}/fcmToken`).set(token);
      await db.ref(`employees/${currentUser}/notificationEnabled`).set(true);
      alert('Notifications enabled. Closed-app alerts will work after Firebase Function is deployed. For iPhone, install the app from Safari first.');
    }
  } catch(e){ console.warn(e); alert('Could not enable push notifications. Check Web Push key, HTTPS hosting, and browser permissions.'); }
}

async function saveEmployee(){
  const username = $('newUsername').value.trim().toLowerCase();
  if (!username) return alert('Enter username');
  const data = {
    pin: $('newPin').value.trim() || (employees[username]?.pin || '1234'),
    name: $('newName').value.trim() || username,
    department: $('newDept').value.trim() || 'General',
    role: employees[username]?.role || 'employee',
    active: true
  };
  await db.ref(`employees/${username}`).update(data);
  employees[username] = {...(employees[username]||{}), ...data};
  renderDepartments(); renderEmployees(); renderAdminEmployees();
  $('newUsername').value = $('newPin').value = $('newName').value = $('newDept').value = '';
  toast('Employee saved');
}

function renderAdminEmployees(){
  if (!currentUser || employees[currentUser]?.role !== 'admin' || !$('adminEmployeeList')) return;
  const q = ($('adminEmployeeSearch').value || '').toLowerCase();
  const rows = Object.entries(employees).filter(([u,e]) => {
    const txt = `${u} ${e.name||''} ${e.department||''} ${e.role||''}`.toLowerCase();
    return !q || txt.includes(q);
  }).sort((a,b)=> (a[1].name||a[0]).localeCompare(b[1].name||b[0]));

  const list = $('adminEmployeeList');
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<p class="muted">No employees found.</p>';
    return;
  }

  rows.forEach(([username,e]) => {
    const isSelf = username === currentUser;
    const active = e.active !== false;
    const item = document.createElement('div');
    item.className = 'admin-employee' + (active ? '' : ' inactive');
    item.innerHTML = `
      <div>
        <div class="emp-name">${escapeHtml(e.name || username)} ${isSelf ? '<span class="badge">You</span>' : ''}</div>
        <div class="emp-dept">${escapeHtml(username)} • ${escapeHtml(e.department || 'General')} • ${escapeHtml(e.role || 'employee')} • ${active ? 'Active' : 'Deactivated'}</div>
      </div>
      <div class="admin-actions">
        <button class="secondary small-btn" data-action="edit" data-user="${escapeHtml(username)}">Edit</button>
        <button class="secondary small-btn" data-action="toggle" data-user="${escapeHtml(username)}" ${isSelf?'disabled':''}>${active ? 'Deactivate' : 'Activate'}</button>
        <button class="danger small-btn" data-action="delete" data-user="${escapeHtml(username)}" ${isSelf?'disabled':''}>Delete</button>
      </div>`;
    list.appendChild(item);
  });

  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const username = btn.dataset.user;
      if (action === 'edit') return prefillEmployee(username);
      if (action === 'toggle') return toggleEmployeeActive(username);
      if (action === 'delete') return deleteEmployee(username);
    });
  });
}

window.prefillEmployee = function(username){
  const e = employees[username]; if (!e) return alert('User not found.');
  $('newUsername').value = username;
  $('newPin').value = e.pin || '';
  $('newName').value = e.name || '';
  $('newDept').value = e.department || '';
  $('newUsername').scrollIntoView({behavior:'smooth', block:'center'});
}

window.toggleEmployeeActive = async function(username){
  if (employees[currentUser]?.role !== 'admin') return alert('Only admin can manage users.');
  if (username === currentUser) return alert('You cannot deactivate your own admin account.');
  const e = employees[username]; if (!e) return alert('User not found.');
  const makeActive = e.active === false;
  const actionText = makeActive ? 'activate' : 'deactivate';
  if (!confirm(`Do you want to ${actionText} ${e.name || username}?`)) return;
  try {
    await db.ref(`employees/${username}`).update({ active: makeActive });
    await db.ref(`presence/${username}`).set(null);
    if (!makeActive) await db.ref(`calls/${username}`).set(null);
    employees[username].active = makeActive;
    renderDepartments(); renderEmployees(); renderAdminEmployees();
    alert(makeActive ? 'Employee activated successfully.' : 'Employee deactivated successfully.');
  } catch (err) {
    console.error(err);
    alert('Unable to update user. Please check Firebase Realtime Database rules. For testing, set .read and .write to true.');
  }
}

window.deleteEmployee = async function(username){
  if (employees[currentUser]?.role !== 'admin') return alert('Only admin can manage users.');
  if (username === currentUser) return alert('You cannot delete your own admin account.');
  const e = employees[username]; if (!e) return alert('User not found.');
  if (!confirm(`Permanently delete ${e.name || username}? This cannot be undone.`)) return;
  try {
    await db.ref(`employees/${username}`).set(null);
    await db.ref(`presence/${username}`).set(null);
    await db.ref(`calls/${username}`).set(null);
    delete employees[username];
    renderDepartments(); renderEmployees(); renderAdminEmployees();
    alert('Employee deleted successfully.');
  } catch (err) {
    console.error(err);
    alert('Unable to delete user. Please check Firebase Realtime Database rules. For testing, set .read and .write to true.');
  }
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
function escapeJs(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
