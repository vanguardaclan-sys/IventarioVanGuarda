// ============================================
// SKINVANGUARDA — Standoff 2 Inventory Tracker
// ============================================

const ADMIN_EMAIL = 'ssantosmattheuss@gmail.com';

function isAdmin() {
  return currentUser && currentUser.email === ADMIN_EMAIL;
}

// --- CATEGORIES & WEAPONS ---
const CATEGORIES = {
  'Armas': {
    subcategories: {
      'Pistolas': ['G22', 'USP', 'P350', 'Berettas', 'TEC-9', 'F/S', 'Desert Eagle'],
      'SMGs': ['MAC10', 'UMP45', 'MP5', 'MP7', 'Akimbo Uzi', 'P90'],
      'Fuzis': ['FN FAL', 'FAMAS', 'VAL', 'M4', 'M4A1', 'AKR', 'AKR12', 'M16'],
      'Shotguns': ['FabM', 'SM1014', 'SPAS'],
      'LMGs': ['M60'],
      'Snipers': ['M40', 'Mallard', 'M110', 'AWM']
    }
  },
  'Facas': {
    items: ['M9 Bayonet', 'Karambit', 'jKommando', 'Butterfly', 'Flip', 'Kunai', 'Scorpion', 'Tanto', 'Dual Daggers', 'Kukri', 'Stiletto', 'Mantis', 'Fang', 'Sting']
  },
  'Granada': { items: ['Granada'] },
  'Contêineres': { items: ['Contêineres'] },
  'CT Agentes': { items: ['CT Agentes'] },
  'T Agentes': { items: ['T Agentes'] },
  'Luvas': { items: ['Luvas'] },
  'Adesivos': { items: ['Adesivos'] },
  'Amuletos': { items: ['Amuletos'] },
  'Grafite': { items: ['Grafite'] },
  'Fragmentos': { items: ['Fragmentos'] },
  'Outro': { items: ['Outro'] }
};

// --- STATE ---
let currentUser = null;
let currentUserData = null;
let allUsers = [];
let adminAllUsers = [];
let inventoryItems = [];
let subInventoryItems = [];
let currentPhotoBase64 = null;
let editPhotoBase64 = null;
let currentInventoryTab = 'main';
let editingItemId = null;
let sellingItem = null;

// --- DOM ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================
// AUTH
// ============================================

$$('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.auth-form').forEach(f => f.classList.remove('active'));
    $(`#${tab.dataset.tab}-form`).classList.add('active');
  });
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errorEl = $('#login-error');
  errorEl.textContent = '';
  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Login realizado!', 'success');
  } catch (err) {
    errorEl.textContent = translateFirebaseError(err.code);
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#register-name').value.trim();
  const email = $('#register-email').value.trim();
  const phone = $('#register-phone').value.trim();
  const gameId = $('#register-gameid').value.trim();
  const password = $('#register-password').value;
  const confirm = $('#register-confirm').value;
  const errorEl = $('#register-error');
  errorEl.textContent = '';

  if (password !== confirm) {
    errorEl.textContent = 'As senhas não coincidem.';
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      email: email,
      phone: phone,
      gameId: gameId,
      status: 'pending',
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Conta criada! Aguarde aprovação.', 'success');
  } catch (err) {
    errorEl.textContent = translateFirebaseError(err.code);
  }
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdminUser = user.email === ADMIN_EMAIL;

    if (!userDoc.exists) {
      await db.collection('users').doc(user.uid).set({
        displayName: user.displayName || (isAdminUser ? 'Admin' : 'Player'),
        email: user.email,
        phone: '',
        gameId: '',
        status: isAdminUser ? 'approved' : 'pending',
        role: isAdminUser ? 'admin' : 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentUserData = (await db.collection('users').doc(user.uid).get()).data();
    } else {
      currentUserData = userDoc.data();
      if (isAdminUser && currentUserData.role !== 'admin') {
        await db.collection('users').doc(user.uid).update({ role: 'admin', status: 'approved' });
        currentUserData.role = 'admin';
        currentUserData.status = 'approved';
      }
    }

    if (!isAdminUser) {
      if (currentUserData.status === 'pending') {
        showPending();
        return;
      }
      if (currentUserData.status === 'rejected') {
        showToast('Sua conta foi rejeitada.', 'error');
        auth.signOut();
        return;
      }
    }

    showApp();

    const adminNav = $('#nav-admin');
    const mobileAdminNav = $('#mobile-nav-admin');
    if (isAdmin()) {
      adminNav.style.display = '';
      mobileAdminNav.style.display = '';
    } else {
      adminNav.style.display = 'none';
      mobileAdminNav.style.display = 'none';
    }
  } else {
    currentUser = null;
    currentUserData = null;
    showAuth();
  }
});

$('#btn-logout').addEventListener('click', () => {
  auth.signOut();
  showToast('Você saiu da conta.', 'success');
});

$('#btn-pending-logout').addEventListener('click', () => {
  auth.signOut();
});

function showAuth() {
  $('#auth-screen').classList.add('active');
  $('#app-screen').classList.remove('active');
  $('#pending-screen').classList.remove('active');
}

function showApp() {
  $('#auth-screen').classList.remove('active');
  $('#app-screen').classList.add('active');
  $('#pending-screen').classList.remove('active');
  updateUserBadge();
  loadInventory();
  loadSettings();
}

function showPending() {
  $('#auth-screen').classList.remove('active');
  $('#app-screen').classList.remove('active');
  $('#pending-screen').classList.add('active');
}

function updateUserBadge() {
  const name = currentUser.displayName || currentUserData?.displayName || 'Player';
  $('#user-display-name').textContent = name;
  const avatar = $('#user-avatar');
  
  // Show profile photo if available
  const photoData = currentUserData?.profilePhoto;
  if (photoData) {
    avatar.innerHTML = `<img src="${photoData}" alt="${name}">`;
  } else {
    avatar.textContent = name.charAt(0).toUpperCase();
  }
  
  if (isAdmin()) avatar.classList.add('admin-avatar');
  else avatar.classList.remove('admin-avatar');
}

// ============================================
// NAVIGATION
// ============================================

function switchView(viewName) {
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  $(`.nav-btn[data-view="${viewName}"]`)?.classList.add('active');
  $$('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
  $(`.mobile-nav-btn[data-view="${viewName}"]`)?.classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${viewName}`).classList.add('active');
  if (viewName === 'players') loadPlayers();
  if (viewName === 'ranking') loadRanking();
  if (viewName === 'admin') loadAdminPanel();
  if (viewName === 'settings') loadSettings();
  if (viewName === 'raffle') loadRaffle();
}

$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

$$('.mobile-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ============================================
// INVENTORY TABS
// ============================================

$$('.inventory-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.inventory-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentInventoryTab = tab.dataset.invTab;
    
    if (currentInventoryTab === 'main') {
      $('#inventory-grid').style.display = '';
      $('#sub-inventory-grid').style.display = 'none';
    } else {
      $('#inventory-grid').style.display = 'none';
      $('#sub-inventory-grid').style.display = '';
    }
  });
});

// ============================================
// SETTINGS
// ============================================

function loadSettings() {
  if (!currentUser || !currentUserData) return;
  $('#settings-nickname').value = currentUserData.displayName || '';
  $('#settings-email').value = currentUserData.email || '';
  $('#settings-phone').value = currentUserData.phone || '';
  $('#settings-gameid').value = currentUserData.gameId || '';

  const statusEl = $('#settings-status');
  const status = currentUserData.status || 'pending';
  statusEl.innerHTML = `<span class="status-badge status-${status}">${status === 'approved' ? 'APROVADO' : status === 'pending' ? 'PENDENTE' : 'REJEITADO'}</span>`;

  const roleEl = $('#settings-role');
  const role = currentUserData.role || 'user';
  roleEl.textContent = role === 'admin' ? 'ADMINISTRADOR' : 'MEMBRO';

  const sinceEl = $('#settings-since');
  const createdDate = currentUserData.createdAt?.toDate();
  sinceEl.textContent = createdDate ? createdDate.toLocaleDateString('pt-BR') : '—';

  // Load profile photo
  loadProfilePhoto();
}

function loadProfilePhoto() {
  const photoData = currentUserData?.profilePhoto;
  const img = $('#profile-photo-img');
  const placeholder = $('#profile-photo-placeholder');
  const removeBtn = $('#btn-remove-photo');

  if (photoData) {
    img.src = photoData;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = '';
  } else {
    img.style.display = 'none';
    placeholder.style.display = '';
    removeBtn.style.display = 'none';
  }
}

// Profile photo upload
$('#btn-upload-photo').addEventListener('click', () => {
  $('#profile-photo-input').click();
});

$('#profile-photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const MAX = 200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.7);

      try {
        await db.collection('users').doc(currentUser.uid).update({ profilePhoto: photoBase64 });
        currentUserData.profilePhoto = photoBase64;
        loadProfilePhoto();
        updateUserBadge();
        showToast('Foto de perfil atualizada!', 'success');
      } catch (err) {
        showToast('Erro ao salvar foto: ' + err.message, 'error');
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

$('#btn-remove-photo').addEventListener('click', async () => {
  try {
    await db.collection('users').doc(currentUser.uid).update({ profilePhoto: firebase.firestore.FieldValue.delete() });
    currentUserData.profilePhoto = null;
    loadProfilePhoto();
    updateUserBadge();
    showToast('Foto de perfil removida.', 'success');
  } catch (err) {
    showToast('Erro ao remover foto.', 'error');
  }
});

$('#settings-profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = $('#settings-profile-msg');
  const name = $('#settings-nickname').value.trim();
  const email = $('#settings-email').value.trim();
  const phone = $('#settings-phone').value.trim();
  const gameId = $('#settings-gameid').value.trim();

  try {
    if (name !== currentUser.displayName) {
      await currentUser.updateProfile({ displayName: name });
    }
    if (email !== currentUser.email) {
      await currentUser.updateEmail(email);
    }
    await db.collection('users').doc(currentUser.uid).update({
      displayName: name,
      email: email,
      phone: phone,
      gameId: gameId
    });

    currentUserData.displayName = name;
    currentUserData.email = email;
    currentUserData.phone = phone;
    currentUserData.gameId = gameId;

    updateUserBadge();
    msgEl.className = 'form-msg success';
    msgEl.textContent = 'Perfil atualizado com sucesso!';
    setTimeout(() => { msgEl.className = 'form-msg'; msgEl.textContent = ''; }, 3000);
  } catch (err) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = translateFirebaseError(err.code);
  }
});

$('#settings-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = $('#settings-password-msg');
  const currentPassword = $('#settings-current-password').value;
  const newPassword = $('#settings-new-password').value;
  const confirmPassword = $('#settings-confirm-password').value;

  if (newPassword !== confirmPassword) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = 'As senhas não coincidem.';
    return;
  }

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(newPassword);
    msgEl.className = 'form-msg success';
    msgEl.textContent = 'Senha alterada com sucesso!';
    $('#settings-password-form').reset();
    setTimeout(() => { msgEl.className = 'form-msg'; msgEl.textContent = ''; }, 3000);
  } catch (err) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = err.code === 'auth/wrong-password' ? 'Senha atual incorreta.' : translateFirebaseError(err.code);
  }
});

// ============================================
// ADD ITEM
// ============================================

function populateCategories() {
  const sel = $('#item-category');
  sel.innerHTML = '<option value="">Selecionar categoria...</option>';
  Object.keys(CATEGORIES).forEach(cat => {
    sel.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}
populateCategories();

$('#item-category').addEventListener('change', (e) => {
  const cat = e.target.value;
  const weaponGroup = $('#weapon-group');
  const weaponSel = $('#item-weapon');

  $('#skin-name-group').style.display = 'none';
  $('#skin-price-group').style.display = 'none';
  $('#skin-photo-group').style.display = 'none';
  $('#btn-submit-item').style.display = 'none';
  currentPhotoBase64 = null;
  resetPhotoUpload();

  if (!cat) { weaponGroup.style.display = 'none'; return; }

  const catData = CATEGORIES[cat];
  weaponSel.innerHTML = '<option value="">Selecionar...</option>';

  if (catData.subcategories) {
    Object.entries(catData.subcategories).forEach(([subcat, weapons]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = subcat;
      weapons.forEach(w => { optgroup.innerHTML += `<option value="${w}">${w}</option>`; });
      weaponSel.appendChild(optgroup);
    });
  } else {
    catData.items.forEach(item => { weaponSel.innerHTML += `<option value="${item}">${item}</option>`; });
  }
  weaponGroup.style.display = '';
});

$('#item-weapon').addEventListener('change', (e) => {
  if (e.target.value) {
    $('#skin-name-group').style.display = '';
    $('#skin-price-group').style.display = '';
    $('#skin-photo-group').style.display = '';
    $('#btn-submit-item').style.display = '';
  } else {
    $('#skin-name-group').style.display = 'none';
    $('#skin-price-group').style.display = 'none';
    $('#skin-photo-group').style.display = 'none';
    $('#btn-submit-item').style.display = 'none';
  }
});

const photoUploadArea = $('#photo-upload-area');
const photoInput = $('#item-photo');
const photoPreview = $('#photo-preview');
const photoPlaceholder = $('#photo-placeholder');

photoUploadArea.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1920;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.95);
      photoPreview.src = currentPhotoBase64;
      photoPreview.style.display = 'block';
      photoPlaceholder.style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function resetPhotoUpload() {
  photoInput.value = '';
  photoPreview.style.display = 'none';
  photoPreview.src = '';
  photoPlaceholder.style.display = '';
  currentPhotoBase64 = null;
}

$('#add-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const inventory = $('#item-inventory').value;
  const category = $('#item-category').value;
  const weapon = $('#item-weapon').value;
  const name = $('#item-name').value.trim();
  const price = parseGold($('#item-price').value);

  if (!category || !weapon || !name) { showToast('Preencha todos os campos.', 'error'); return; }

  const item = {
    category, weapon, name, price,
    photo: currentPhotoBase64 || null,
    addedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (inventory === 'sub') {
      // Add to sub-inventory
      item.soldAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('users').doc(currentUser.uid).collection('subItems').add(item);
      showToast(`"${name}" adicionado ao sub-inventário!`, 'success');
    } else {
      // Add to main inventory
      await db.collection('users').doc(currentUser.uid).collection('items').add(item);
      showToast(`"${name}" adicionado!`, 'success');
    }
    
    $('#add-item-form').reset();
    $('#weapon-group').style.display = 'none';
    $('#skin-name-group').style.display = 'none';
    $('#skin-price-group').style.display = 'none';
    $('#skin-photo-group').style.display = 'none';
    $('#btn-submit-item').style.display = 'none';
    resetPhotoUpload();
    $('#add-item-modal').classList.add('hidden');
    loadInventory();
  } catch (err) { showToast('Erro: ' + err.message, 'error'); }
});

$('#btn-add-item').addEventListener('click', () => { $('#add-item-modal').classList.remove('hidden'); });

// ============================================
// EDIT ITEM
// ============================================

function openEditModal(item) {
  editingItemId = item.id;
  editPhotoBase64 = item.photo || null;
  
  $('#edit-item-name').value = item.name;
  $('#edit-item-price').value = item.price;
  
  const editPhotoPreview = $('#edit-photo-preview');
  const editPhotoPlaceholder = $('#edit-photo-placeholder');
  
  if (item.photo) {
    editPhotoPreview.src = item.photo;
    editPhotoPreview.style.display = 'block';
    editPhotoPlaceholder.style.display = 'none';
  } else {
    editPhotoPreview.style.display = 'none';
    editPhotoPlaceholder.style.display = '';
  }
  
  $('#edit-item-modal').classList.remove('hidden');
}

const editPhotoUploadArea = $('#edit-photo-upload-area');
const editPhotoInput = $('#edit-item-photo');
const editPhotoPreview = $('#edit-photo-preview');
const editPhotoPlaceholder = $('#edit-photo-placeholder');

editPhotoUploadArea.addEventListener('click', () => editPhotoInput.click());

editPhotoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1920;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      editPhotoBase64 = canvas.toDataURL('image/jpeg', 0.95);
      editPhotoPreview.src = editPhotoBase64;
      editPhotoPreview.style.display = 'block';
      editPhotoPlaceholder.style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

$('#edit-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#edit-item-name').value.trim();
  const price = parseGold($('#edit-item-price').value);

  try {
    await db.collection('users').doc(currentUser.uid).collection('items').doc(editingItemId).update({
      name,
      price,
      photo: editPhotoBase64
    });
    showToast('Item atualizado!', 'success');
    $('#edit-item-modal').classList.add('hidden');
    loadInventory();
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  }
});

// ============================================
// SELL ITEM
// ============================================

function openSellModal(item) {
  sellingItem = item;
  
  const preview = $('#sell-item-preview');
  if (item.photo) {
    preview.innerHTML = `<img src="${item.photo}" alt="${item.name}">`;
  } else {
    preview.innerHTML = '<span style="font-size:2rem">🔫</span>';
  }
  
  $('#sell-item-name').textContent = item.name;
  $('#sell-item-original-price').textContent = formatGold(item.price);
  $('#sell-item-price').value = '';
  
  $('#sell-item-modal').classList.remove('hidden');
}

$('#sell-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const sellPrice = parseGold($('#sell-item-price').value);

  try {
    // Move to sub-inventory with sold price
    await db.collection('users').doc(currentUser.uid).collection('subItems').add({
      ...sellingItem,
      originalPrice: sellingItem.price,
      soldPrice: sellPrice,
      soldAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Remove from main inventory
    await db.collection('users').doc(currentUser.uid).collection('items').doc(sellingItem.id).delete();
    
    showToast(`"${sellingItem.name}" vendido por ${formatGold(sellPrice)}!`, 'success');
    $('#sell-item-modal').classList.add('hidden');
    loadInventory();
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  }
});

// ============================================
// DELETE ITEM
// ============================================

async function deleteItem(itemId, itemName) {
  if (!confirm(`Excluir "${itemName}"?`)) return;
  
  try {
    await db.collection('users').doc(currentUser.uid).collection('items').doc(itemId).delete();
    showToast('Item excluído.', 'success');
    loadInventory();
  } catch (err) {
    showToast('Erro ao excluir.', 'error');
  }
}

// ============================================
// LOAD INVENTORY
// ============================================

async function loadInventory() {
  if (!currentUser) return;
  try {
    // Load main inventory
    const snapshot = await db.collection('users').doc(currentUser.uid)
      .collection('items').orderBy('addedAt', 'desc').get();
    inventoryItems = [];
    snapshot.forEach(doc => inventoryItems.push({ id: doc.id, ...doc.data() }));
    // Sort by price descending (maior → menor)
    inventoryItems.sort((a, b) => (b.price || 0) - (a.price || 0));
    
    // Load sub-inventory
    const subSnapshot = await db.collection('users').doc(currentUser.uid)
      .collection('subItems').orderBy('soldAt', 'desc').get();
    subInventoryItems = [];
    subSnapshot.forEach(doc => subInventoryItems.push({ id: doc.id, ...doc.data() }));
    // Sort sub-inventory by soldPrice descending
    subInventoryItems.sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
    
    updateInventoryStats();
    renderInventory();
    renderSubInventory();
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function updateInventoryStats() {
  const totalItems = inventoryItems.length;
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const subValue = subInventoryItems.reduce((sum, item) => sum + (item.soldPrice || 0), 0);
  
  $('#stat-items').textContent = totalItems;
  $('#stat-value').textContent = formatGold(totalValue);
  $('#stat-sub-value').textContent = formatGold(subValue);
}

function renderInventory() {
  const grid = $('#inventory-grid');
  if (inventoryItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        <p>Seu inventário está vazio</p>
        <span>Adicione skins para começar</span>
      </div>`;
    return;
  }
  grid.innerHTML = inventoryItems.map(item => createItemCard(item)).join('');
  attachItemActions(grid);
}

function renderSubInventory() {
  const grid = $('#sub-inventory-grid');
  if (subInventoryItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        <p>Sub-inventário vazio</p>
        <span>Itens vendidos aparecerão aqui</span>
      </div>`;
    return;
  }
  grid.innerHTML = subInventoryItems.map(item => createSubItemCard(item)).join('');
  attachSubItemActions(grid);
}

function createItemCard(item) {
  const imageHtml = item.photo
    ? `<img src="${item.photo}" alt="${item.name}" class="skin-clickable-img" data-fullscreen="true">`
    : `<span class="item-weapon-icon">🔫</span>`;

  return `
    <div class="item-card">
      <div class="item-card-actions">
        <button class="item-action-btn edit" data-action="edit" data-id="${item.id}" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="item-action-btn sell" data-action="sell" data-id="${item.id}" title="Vender">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </button>
        <button class="item-action-btn delete" data-action="delete" data-id="${item.id}" title="Excluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="item-card-image">${imageHtml}</div>
      <div class="item-card-info">
        <div class="item-card-category">${item.category || ''}</div>
        <div class="item-card-name" title="${item.name}">${item.name}</div>
        <div class="item-card-weapon">${item.weapon || ''}</div>
        <div class="item-card-bottom">
          <span class="item-card-price">${formatGold(item.price)}</span>
        </div>
      </div>
    </div>`;
}

function createSubItemCard(item) {
  const imageHtml = item.photo
    ? `<img src="${item.photo}" alt="${item.name}" class="skin-clickable-img" data-fullscreen="true">`
    : `<span class="item-weapon-icon">🔫</span>`;

  return `
    <div class="sub-item-card">
      <div class="item-sold-badge">VENDIDO</div>
      <button class="sub-item-delete" data-action="delete-sub" data-id="${item.id}" title="Excluir">&times;</button>
      <div class="item-card-image">${imageHtml}</div>
      <div class="item-card-info">
        <div class="item-card-category">${item.category || ''}</div>
        <div class="item-card-name" title="${item.name}">${item.name}</div>
        <div class="item-card-weapon">${item.weapon || ''}</div>
        <div class="item-card-bottom">
          <span class="item-sold-price">${formatGold(item.soldPrice)}</span>
        </div>
      </div>
    </div>`;
}

function attachItemActions(grid) {
  grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = inventoryItems.find(i => i.id === btn.dataset.id);
      if (item) openEditModal(item);
    });
  });
  
  grid.querySelectorAll('[data-action="sell"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = inventoryItems.find(i => i.id === btn.dataset.id);
      if (item) openSellModal(item);
    });
  });
  
  grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = inventoryItems.find(i => i.id === btn.dataset.id);
      if (item) deleteItem(item.id, item.name);
    });
  });

  // Fullscreen image on click
  grid.querySelectorAll('.skin-clickable-img').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      showFullscreenImage(img.src);
    });
  });
}

function attachSubItemActions(grid) {
  grid.querySelectorAll('[data-action="delete-sub"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.id;
      const item = subInventoryItems.find(i => i.id === itemId);
      if (!item) return;
      if (!confirm(`Excluir "${item.name}" do sub-inventário?`)) return;
      try {
        await db.collection('users').doc(currentUser.uid).collection('subItems').doc(itemId).delete();
        showToast('Item removido do sub-inventário.', 'success');
        loadInventory();
      } catch (err) {
        showToast('Erro ao excluir.', 'error');
      }
    });
  });

  // Fullscreen image on click
  grid.querySelectorAll('.skin-clickable-img').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      showFullscreenImage(img.src);
    });
  });
}

// Close modals
$$('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
});
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', () => overlay.closest('.modal').classList.add('hidden'));
});

// ============================================
// PLAYERS
// ============================================

async function loadPlayers() {
  const grid = $('#players-grid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  try {
    const snapshot = await db.collection('users').where('status', '==', 'approved').get();
    allUsers = [];
    for (const doc of snapshot.docs) {
      if (doc.id === currentUser.uid) continue;
      const userData = doc.data();
      
      // Get main inventory
      const itemsSnap = await db.collection('users').doc(doc.id).collection('items').get();
      let totalValue = 0, itemCount = 0;
      itemsSnap.forEach(itemDoc => { const d = itemDoc.data(); totalValue += d.price || 0; itemCount++; });
      
      // Get sub-inventory
      const subItemsSnap = await db.collection('users').doc(doc.id).collection('subItems').get();
      let subValue = 0, subItemCount = 0;
      subItemsSnap.forEach(itemDoc => { const d = itemDoc.data(); subValue += d.soldPrice || 0; subItemCount++; });
      
      allUsers.push({
        uid: doc.id, displayName: userData.displayName || 'Player',
        gameId: userData.gameId || '', phone: userData.phone || '',
        createdAt: userData.createdAt, itemCount, totalValue,
        subItemCount, subValue,
        isAdmin: userData.role === 'admin',
        profilePhoto: userData.profilePhoto || null
      });
    }
    renderPlayers(allUsers);
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="empty-state"><p>Erro ao carregar</p></div>';
  }
}

function renderPlayers(players) {
  const grid = $('#players-grid');
  if (players.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <p>Nenhum jogador encontrado</p><span>Convide amigos para se cadastrarem</span>
      </div>`;
    return;
  }
  grid.innerHTML = players.map(p => `
    <div class="player-card" data-uid="${p.uid}">
      <div class="player-card-avatar">${p.profilePhoto ? `<img src="${p.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : p.displayName.charAt(0).toUpperCase()}</div>
      <div class="player-card-info">
        <div class="player-card-name">${p.displayName}${p.isAdmin ? ' <span class="admin-tag">ADMIN</span>' : ''}</div>
        <div class="player-card-meta">${p.itemCount} ${p.itemCount === 1 ? 'item' : 'itens'}</div>
      </div>
      <div class="player-card-stats">
        <div>
          <div class="player-card-stat-value">${formatGold(p.totalValue + p.subValue)}</div>
          <div class="player-card-stat-label">VALOR TOTAL</div>
        </div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => openPlayerProfile(card.dataset.uid));
  });
}

$('#search-players').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  renderPlayers(q ? allUsers.filter(p => p.displayName.toLowerCase().includes(q)) : allUsers);
});

async function openPlayerProfile(uid) {
  const modal = $('#player-modal');
  modal.classList.remove('hidden');
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    // Main inventory
    const itemsSnap = await db.collection('users').doc(uid).collection('items').orderBy('addedAt', 'desc').get();
    const items = []; let totalValue = 0;
    itemsSnap.forEach(doc => { const d = doc.data(); items.push(d); totalValue += d.price || 0; });
    
    // Sub-inventory
    const subItemsSnap = await db.collection('users').doc(uid).collection('subItems').orderBy('soldAt', 'desc').get();
    const subItems = []; let subValue = 0;
    subItemsSnap.forEach(doc => { const d = doc.data(); subItems.push(d); subValue += d.soldPrice || 0; });

    $('#profile-avatar').textContent = (userData.displayName || 'P').charAt(0).toUpperCase();
    // Show profile photo if available
    if (userData.profilePhoto) {
      $('#profile-avatar').innerHTML = `<img src="${userData.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
    $('#profile-name').textContent = userData.displayName || 'Player';
    const createdDate = userData.createdAt?.toDate();
    $('#profile-since').textContent = createdDate ? `Membro desde ${createdDate.toLocaleDateString('pt-BR')}` : 'Membro recente';
    $('#profile-items').textContent = items.length + subItems.length;
    $('#profile-value').textContent = formatGold(totalValue + subValue);

    const profileGrid = $('#profile-inventory');
    let html = '';
    
    if (items.length > 0) {
      html += items.map(item => `
        <div class="profile-item-card">
          ${item.photo ? `<img src="${item.photo}" alt="${item.name}">` : '<div style="height:80px;display:flex;align-items:center;justify-content:center;background:var(--bg-base)">🔫</div>'}
          <div class="profile-item-info">
            <div class="profile-item-name">${item.name}</div>
            <div class="profile-item-weapon">${item.weapon || ''}</div>
            <div class="profile-item-price">${formatGold(item.price)}</div>
          </div>
        </div>`).join('');
    }
    
    if (subItems.length > 0) {
      html += subItems.map(item => `
        <div class="profile-item-card" style="opacity:0.7">
          ${item.photo ? `<img src="${item.photo}" alt="${item.name}">` : '<div style="height:80px;display:flex;align-items:center;justify-content:center;background:var(--bg-base)">🔫</div>'}
          <div class="profile-item-info">
            <div class="profile-item-name">${item.name} <span style="color:var(--success);font-size:0.6rem">VENDIDO</span></div>
            <div class="profile-item-weapon">${item.weapon || ''}</div>
            <div class="profile-item-price" style="color:var(--success)">${formatGold(item.soldPrice)}</div>
          </div>
        </div>`).join('');
    }
    
    profileGrid.innerHTML = html || '<div class="empty-state"><p>Inventário vazio</p></div>';

    // Fullscreen image on click in profile
    profileGrid.querySelectorAll('img').forEach(img => {
      img.style.cursor = 'pointer';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        showFullscreenImage(img.src);
      });
    });
  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar perfil.', 'error');
  }
}

// ============================================
// RANKING
// ============================================

async function loadRanking() {
  const container = $('#ranking-container');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  try {
    const snapshot = await db.collection('users').where('status', '==', 'approved').get();
    const rankings = [];
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      // Main inventory
      const itemsSnap = await db.collection('users').doc(doc.id).collection('items').get();
      let totalValue = 0, itemCount = 0;
      itemsSnap.forEach(itemDoc => { const d = itemDoc.data(); totalValue += d.price || 0; itemCount++; });
      
      // Sub-inventory
      const subItemsSnap = await db.collection('users').doc(doc.id).collection('subItems').get();
      let subValue = 0, subItemCount = 0;
      subItemsSnap.forEach(itemDoc => { const d = itemDoc.data(); subValue += d.soldPrice || 0; subItemCount++; });
      
      rankings.push({
        uid: doc.id, displayName: userData.displayName || 'Player',
        itemCount, totalValue, subItemCount, subValue,
        totalCombined: totalValue + subValue,
        isCurrentUser: doc.id === currentUser.uid,
        isAdmin: userData.role === 'admin'
      });
    }
    rankings.sort((a, b) => b.totalCombined - a.totalCombined);
    renderRanking(rankings);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state"><p>Erro ao carregar</p></div>';
  }
}

function renderRanking(rankings) {
  const container = $('#ranking-container');
  if (rankings.length === 0) { container.innerHTML = '<div class="empty-state"><p>Nenhum jogador no ranking</p></div>'; return; }
  
  let html = '';
  if (rankings.length >= 1) {
    html += '<div class="ranking-podium">';
    const top3 = rankings.slice(0, 3);
    [1, 0, 2].forEach(idx => {
      if (top3[idx]) {
        const p = top3[idx]; const pos = idx + 1;
        html += `
          <div class="podium-item podium-${pos}" data-uid="${p.uid}">
            <div class="podium-rank">#${pos}</div>
            <div class="podium-avatar">${p.displayName.charAt(0).toUpperCase()}</div>
            <div class="podium-name">${p.displayName}${p.isAdmin ? ' <span class="admin-tag">ADM</span>' : ''}${p.isCurrentUser ? ' (Você)' : ''}</div>
            <div class="podium-value">${formatGold(p.totalCombined)}</div>
          </div>`;
      }
    });
    html += '</div>';
  }
  
  html += `<table class="ranking-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Jogador</th>
        <th>Itens</th>
        <th>Valor Total</th>
      </tr>
    </thead>
    <tbody>`;
  
  rankings.forEach((player, idx) => {
    const pos = idx + 1;
    const rankClass = pos <= 3 ? `rank-${pos}` : '';
    html += `
      <tr class="${rankClass}" data-uid="${player.uid}">
        <td><span class="rank-position">${pos}</span></td>
        <td>
          <div class="rank-player">
            <div class="rank-avatar">${player.displayName.charAt(0).toUpperCase()}</div>
            <span class="rank-name">${player.displayName}${player.isAdmin ? ' <span class="admin-tag">ADM</span>' : ''}${player.isCurrentUser ? ' (Você)' : ''}</span>
          </div>
        </td>
        <td><span class="rank-items-count">${player.itemCount + player.subItemCount}</span></td>
        <td>
          <div class="rank-values">
            <span class="rank-value-main">${formatGold(player.totalCombined)}</span>
            <div class="rank-value-sub">
              <span class="rank-value-current">Atual: ${formatGold(player.totalValue)}</span>
              <span class="rank-value-sold">Vendido: ${formatGold(player.subValue)}</span>
            </div>
          </div>
        </td>
      </tr>`;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('tr[data-uid], .podium-item[data-uid]').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      if (uid !== currentUser.uid) {
        switchView('players');
        loadPlayers().then(() => openPlayerProfile(uid));
      }
    });
  });
}

// ============================================
// ADMIN PANEL
// ============================================

let adminCurrentTargetUid = null;

async function loadAdminPanel() {
  if (!isAdmin()) return;
  const list = $('#admin-users-list');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  try {
    const snapshot = await db.collection('users').get();
    adminAllUsers = [];
    let globalItems = 0, globalValue = 0;
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      const itemsSnap = await db.collection('users').doc(doc.id).collection('items').get();
      let totalValue = 0, itemCount = 0;
      itemsSnap.forEach(itemDoc => { const d = itemDoc.data(); totalValue += d.price || 0; itemCount++; });
      
      adminAllUsers.push({
        uid: doc.id, displayName: userData.displayName || 'Player',
        email: userData.email || '', phone: userData.phone || '',
        gameId: userData.gameId || '',
        createdAt: userData.createdAt,
        itemCount, totalValue,
        status: userData.status || 'pending',
        role: userData.role || 'user'
      });
      if (userData.status === 'approved') { globalItems += itemCount; globalValue += totalValue; }
    }
    $('#admin-stat-users').textContent = adminAllUsers.length;
    $('#admin-stat-items').textContent = globalItems;
    $('#admin-stat-value').textContent = formatGold(globalValue);
    renderAdminUsers(adminAllUsers);
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div class="empty-state"><p>Erro ao carregar</p></div>';
  }
}

function renderAdminUsers(users) {
  const list = $('#admin-users-list');
  if (users.length === 0) { list.innerHTML = '<div class="empty-state"><p>Nenhum usuário</p></div>'; return; }

  users.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return b.totalValue - a.totalValue;
  });

  list.innerHTML = users.map(user => {
    const statusClass = user.status === 'pending' ? 'status-pending' : user.status === 'approved' ? 'status-approved' : 'status-rejected';
    const statusText = user.status === 'pending' ? 'PENDENTE' : user.status === 'approved' ? 'APROVADO' : 'REJEITADO';
    const isSelf = user.uid === currentUser.uid;

    return `
    <div class="admin-user-row ${user.role === 'admin' ? 'is-admin' : ''} ${user.status === 'pending' ? 'is-pending' : ''}" data-uid="${user.uid}">
      <div class="admin-user-avatar">${user.displayName.charAt(0).toUpperCase()}</div>
      <div class="admin-user-info">
        <div class="admin-user-name">
          ${user.displayName}
          ${user.role === 'admin' ? '<span class="admin-tag">ADMIN</span>' : ''}
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="admin-user-email">${user.email} ${user.gameId ? '• ID: ' + user.gameId : ''}</div>
        <div class="admin-user-email">${user.phone || 'Sem telefone'}</div>
      </div>
      <div class="admin-user-stats">
        <div class="admin-user-stat"><div class="admin-user-stat-value">${user.itemCount}</div><div class="admin-user-stat-label">ITENS</div></div>
        <div class="admin-user-stat"><div class="admin-user-stat-value">${formatGold(user.totalValue)}</div><div class="admin-user-stat-label">VALOR</div></div>
      </div>
      <div class="admin-user-actions">
        ${user.status === 'pending' && !isSelf ? `
          <button class="btn-approve" data-action="approve-user" data-uid="${user.uid}" title="Aprovar como membro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
            MEMBRO
          </button>
          <button class="btn-approve-admin" data-action="approve-admin" data-uid="${user.uid}" title="Aprovar como admin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ADMIN
          </button>
          <button class="btn-reject" data-action="reject-user" data-uid="${user.uid}" title="Rejeitar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ` : ''}
        <button class="btn-admin-action" data-action="view" data-uid="${user.uid}" title="Ver inventário">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${!isSelf && user.status === 'approved' ? `
        <button class="btn-admin-action danger" data-action="delete-user" data-uid="${user.uid}" title="Excluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        ` : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-action="approve-user"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await db.collection('users').doc(btn.dataset.uid).update({ status: 'approved', role: 'user' });
        showToast('Usuário aprovado como membro.', 'success');
        loadAdminPanel();
      } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    });
  });

  list.querySelectorAll('[data-action="approve-admin"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await db.collection('users').doc(btn.dataset.uid).update({ status: 'approved', role: 'admin' });
        showToast('Usuário aprovado como ADMIN.', 'success');
        loadAdminPanel();
      } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    });
  });

  list.querySelectorAll('[data-action="reject-user"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Rejeitar este usuário?')) {
        try {
          await db.collection('users').doc(btn.dataset.uid).update({ status: 'rejected' });
          showToast('Usuário rejeitado.', 'success');
          loadAdminPanel();
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
      }
    });
  });

  list.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openAdminUserDetail(btn.dataset.uid); });
  });

  list.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = btn.dataset.uid;
      openDeleteReasonModal(uid);
    });
  });

  list.querySelectorAll('.admin-user-row').forEach(row => {
    row.addEventListener('click', () => openAdminUserDetail(row.dataset.uid));
  });
}

async function openAdminUserDetail(uid) {
  if (!isAdmin()) return;
  $('#admin-user-modal').classList.remove('hidden');
  adminCurrentTargetUid = uid;
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const itemsSnap = await db.collection('users').doc(uid).collection('items').orderBy('addedAt', 'desc').get();
    const items = [];
    itemsSnap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    const isAdminUser = userData.role === 'admin';
    const isSelf = uid === currentUser.uid;

    $('#admin-detail-avatar').textContent = (userData.displayName || 'P').charAt(0).toUpperCase();
    // Show profile photo if available
    if (userData.profilePhoto) {
      $('#admin-detail-avatar').innerHTML = `<img src="${userData.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
    $('#admin-detail-name').innerHTML = userData.displayName + (isAdminUser ? ' <span class="admin-tag">ADMIN</span>' : '');
    $('#admin-detail-email').textContent = userData.email || '';
    const createdDate = userData.createdAt?.toDate();
    $('#admin-detail-since').textContent = createdDate ? `Desde ${createdDate.toLocaleDateString('pt-BR')}` : 'Recente';

    $('#admin-delete-user-btn').style.display = (isSelf) ? 'none' : '';
    $('#admin-clear-inventory-btn').style.display = items.length === 0 ? 'none' : '';

    // Show account info for admin
    let accountInfoHtml = `
      <div class="admin-detail-account-info">
        <h4>INFORMAÇÕES DA CONTA</h4>
        <div class="admin-account-info-grid">
          <div class="admin-account-info-item">
            <span class="admin-account-info-label">Email</span>
            <span class="admin-account-info-value">${userData.email || '—'}</span>
          </div>
          <div class="admin-account-info-item">
            <span class="admin-account-info-label">Telefone</span>
            <span class="admin-account-info-value">${userData.phone || '—'}</span>
          </div>
          <div class="admin-account-info-item">
            <span class="admin-account-info-label">ID do Jogo</span>
            <span class="admin-account-info-value">${userData.gameId || '—'}</span>
          </div>
          <div class="admin-account-info-item">
            <span class="admin-account-info-label">Status</span>
            <span class="admin-account-info-value">${userData.status || '—'}</span>
          </div>
          <div class="admin-account-info-item">
            <span class="admin-account-info-label">Tipo de Conta</span>
            <span class="admin-account-info-value">${userData.role || 'user'}</span>
          </div>
          <div class="admin-account-info-item">
            <span class="admin-account-info-label">Membro desde</span>
            <span class="admin-account-info-value">${createdDate ? createdDate.toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        </div>
      </div>
    `;
    // Insert account info before items header
    const itemsHeader = $('#admin-user-modal').querySelector('.admin-detail-items-header');
    const existingInfo = $('#admin-user-modal').querySelector('.admin-detail-account-info');
    if (existingInfo) existingInfo.remove();
    itemsHeader.insertAdjacentHTML('beforebegin', accountInfoHtml);

    const itemsContainer = $('#admin-detail-items');
    if (items.length === 0) {
      itemsContainer.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>Inventário vazio</p></div>';
    } else {
      itemsContainer.innerHTML = items.map(item => `
        <div class="admin-item-card">
          <button class="admin-item-delete" data-item-id="${item.id}">&times;</button>
          ${item.photo ? `<img src="${item.photo}" alt="${item.name}" class="skin-clickable-img" data-fullscreen="true">` : '<div style="height:70px;display:flex;align-items:center;justify-content:center;background:var(--bg-base)">🔫</div>'}
          <div class="admin-item-info">
            <div class="admin-item-name">${item.name}</div>
            <div class="admin-item-price">${formatGold(item.price)}</div>
          </div>
        </div>`).join('');
      itemsContainer.querySelectorAll('.admin-item-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Remover este item?')) {
            try {
              await db.collection('users').doc(uid).collection('items').doc(btn.dataset.itemId).delete();
              showToast('Item removido.', 'success');
              openAdminUserDetail(uid);
              loadAdminPanel();
            } catch (err) { showToast('Erro.', 'error'); }
          }
        });
      });
      // Fullscreen image on click
      itemsContainer.querySelectorAll('.skin-clickable-img').forEach(img => {
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          showFullscreenImage(img.src);
        });
      });
    }
  } catch (err) { console.error(err); showToast('Erro ao carregar.', 'error'); }
}

$('#admin-delete-user-btn').addEventListener('click', () => {
  if (!adminCurrentTargetUid || !isAdmin()) return;
  openDeleteReasonModal(adminCurrentTargetUid);
});

$('#admin-clear-inventory-btn').addEventListener('click', async () => {
  if (!adminCurrentTargetUid || !isAdmin()) return;
  if (confirm('Limpar TODO o inventário?')) {
    try {
      const itemsSnap = await db.collection('users').doc(adminCurrentTargetUid).collection('items').get();
      const batch = db.batch();
      itemsSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      showToast('Inventário limpo.', 'success');
      openAdminUserDetail(adminCurrentTargetUid);
      loadAdminPanel();
    } catch (err) { showToast('Erro.', 'error'); }
  }
});

// ============================================
// DELETE USER WITH REASON
// ============================================

let deleteTargetUid = null;

function openDeleteReasonModal(uid) {
  deleteTargetUid = uid;
  const user = adminAllUsers.find(u => u.uid === uid);
  $('#delete-reason-username').textContent = user?.displayName || 'Usuário';
  $('#delete-reason-text').value = '';
  $('#delete-reason-modal').classList.remove('hidden');
}

$('#btn-confirm-delete-user').addEventListener('click', async () => {
  if (!deleteTargetUid || !isAdmin()) return;
  const reason = $('#delete-reason-text').value.trim();
  if (!reason) {
    showToast('Informe o motivo da exclusão.', 'error');
    return;
  }
  const user = adminAllUsers.find(u => u.uid === deleteTargetUid);
  try {
    // Delete all user items (main + sub)
    const itemsSnap = await db.collection('users').doc(deleteTargetUid).collection('items').get();
    const subItemsSnap = await db.collection('users').doc(deleteTargetUid).collection('subItems').get();
    const batch = db.batch();
    itemsSnap.forEach(doc => batch.delete(doc.ref));
    subItemsSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Save deletion record with reason
    await db.collection('deletedUsers').add({
      uid: deleteTargetUid,
      displayName: user?.displayName || 'Unknown',
      email: user?.email || '',
      reason: reason,
      deletedBy: currentUser.uid,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Delete user document
    await db.collection('users').doc(deleteTargetUid).delete();

    showToast(`"${user?.displayName}" excluído. Motivo: ${reason}`, 'success');
    $('#delete-reason-modal').classList.add('hidden');
    $('#admin-user-modal').classList.add('hidden');
    deleteTargetUid = null;
    loadAdminPanel();
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  }
});

$('#delete-reason-modal').querySelector('.modal-close').addEventListener('click', () => {
  $('#delete-reason-modal').classList.add('hidden');
});
$('#delete-reason-modal').querySelector('.modal-overlay').addEventListener('click', () => {
  $('#delete-reason-modal').classList.add('hidden');
});

$('#admin-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  renderAdminUsers(q ? adminAllUsers.filter(u => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : adminAllUsers);
});

// ============================================
// RAFFLE / SORTEIO
// ============================================

let raffleParticipants = [];
let selectedParticipants = [];
let isSpinning = false;

async function loadRaffle() {
  if (!currentUser) return;

  // Show admin controls only for admins
  const adminControls = $('#raffle-admin-controls');
  if (isAdmin()) {
    adminControls.style.display = '';
    await loadRaffleParticipants();
  } else {
    adminControls.style.display = 'none';
  }

  await loadRaffleHistory();
}

async function loadRaffleParticipants() {
  try {
    const snapshot = await db.collection('users').where('status', '==', 'approved').get();
    raffleParticipants = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      raffleParticipants.push({
        uid: doc.id,
        displayName: data.displayName || 'Player',
        email: data.email || ''
      });
    });
    renderParticipantsList();
  } catch (err) {
    console.error('Error loading participants:', err);
  }
}

function renderParticipantsList(filter = '') {
  const list = $('#participants-list');
  const filtered = raffleParticipants.filter(p => 
    p.displayName.toLowerCase().includes(filter.toLowerCase()) ||
    p.email.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Nenhum jogador encontrado</p></div>';
    return;
  }

  list.innerHTML = filtered.map(p => `
    <div class="participant-item ${selectedParticipants.includes(p.uid) ? 'selected' : ''}" data-uid="${p.uid}">
      <div class="participant-checkbox"></div>
      <span class="participant-name">${p.displayName}</span>
    </div>
  `).join('');

  // Attach click handlers
  list.querySelectorAll('.participant-item').forEach(item => {
    item.addEventListener('click', () => {
      const uid = item.dataset.uid;
      if (selectedParticipants.includes(uid)) {
        selectedParticipants = selectedParticipants.filter(id => id !== uid);
      } else {
        selectedParticipants.push(uid);
      }
      renderParticipantsList($('#participants-search').value);
      updateSelectedCount();
      updateSpinButton();
    });
  });
}

function updateSelectedCount() {
  $('#selected-count').textContent = selectedParticipants.length;
}

function updateSpinButton() {
  const spinBtn = $('#btn-spin-raffle');
  const prize = parseGold($('#raffle-prize').value);
  spinBtn.disabled = selectedParticipants.length < 2 || prize <= 0 || isSpinning;
}

// Search participants
$('#participants-search').addEventListener('input', (e) => {
  renderParticipantsList(e.target.value);
});

// Select all
$('#select-all-participants').addEventListener('click', () => {
  if (selectedParticipants.length === raffleParticipants.length) {
    selectedParticipants = [];
  } else {
    selectedParticipants = raffleParticipants.map(p => p.uid);
  }
  renderParticipantsList($('#participants-search').value);
  updateSelectedCount();
  updateSpinButton();
});

// Save raffle config
$('#btn-save-raffle').addEventListener('click', async () => {
  const name = $('#raffle-name').value.trim();
  const prize = parseGold($('#raffle-prize').value);

  if (!name) {
    showToast('Informe o nome do sorteio.', 'error');
    return;
  }
  if (prize <= 0) {
    showToast('Informe o valor do prêmio.', 'error');
    return;
  }
  if (selectedParticipants.length < 2) {
    showToast('Selecione pelo menos 2 participantes.', 'error');
    return;
  }

  try {
    // Save raffle config to Firestore
    await db.collection('raffles').add({
      name,
      prize,
      participants: selectedParticipants,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid
    });
    showToast('Sorteio configurado com sucesso!', 'success');
    renderRoulette();
    updateRaffleInfo();
  } catch (err) {
    showToast('Erro ao salvar sorteio: ' + err.message, 'error');
  }
});

// Update prize display
$('#raffle-prize').addEventListener('input', () => {
  const prize = parseGold($('#raffle-prize').value);
  $('#raffle-prize-display').textContent = formatGold(prize);
  updateSpinButton();
});

function updateRaffleInfo() {
  const prize = parseGold($('#raffle-prize').value);
  $('#raffle-prize-display').textContent = formatGold(prize);
  $('#raffle-participants-count').textContent = selectedParticipants.length;
}

// Render roulette wheel
function renderRoulette() {
  const wheel = $('#roulette-wheel');
  
  if (selectedParticipants.length === 0) {
    wheel.innerHTML = '<div class="roulette-empty"><p>Nenhum participante selecionado</p></div>';
    return;
  }

  const colors = ['#d4a84b', '#4a7cff', '#ff4a5e', '#3ddc84', '#8847ff', '#eb4b4b', '#5e98d9', '#b0c3d9'];
  const segmentAngle = 360 / selectedParticipants.length;
  
  let html = '';
  selectedParticipants.forEach((uid, index) => {
    const participant = raffleParticipants.find(p => p.uid === uid);
    const rotation = segmentAngle * index;
    const color = colors[index % colors.length];
    
    html += `
      <div class="roulette-segment" style="
        transform: rotate(${rotation}deg) skewY(-${90 - segmentAngle}deg);
        background: ${color};
      ">
        <div class="roulette-segment-content" style="transform: translate(-50%, 0) rotate(${45 + segmentAngle/2}deg);">
          ${participant?.displayName || 'Player'}
        </div>
      </div>
    `;
  });
  
  wheel.innerHTML = html;
}

// Spin roulette
$('#btn-spin-raffle').addEventListener('click', async () => {
  if (selectedParticipants.length < 2 || isSpinning) return;

  const prize = parseGold($('#raffle-prize').value);
  if (prize <= 0) {
    showToast('Informe o valor do prêmio.', 'error');
    return;
  }

  isSpinning = true;
  $('#btn-spin-raffle').disabled = true;
  $('#raffle-winner').style.display = 'none';

  // Random winner
  const winnerIndex = Math.floor(Math.random() * selectedParticipants.length);
  const winnerUid = selectedParticipants[winnerIndex];
  const winner = raffleParticipants.find(p => p.uid === winnerUid);

  // Calculate rotation
  const segmentAngle = 360 / selectedParticipants.length;
  const targetAngle = 360 - (segmentAngle * winnerIndex + segmentAngle / 2);
  const spins = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
  const finalRotation = spins * 360 + targetAngle;

  const wheel = $('#roulette-wheel');
  wheel.classList.add('spinning');
  wheel.style.transform = `rotate(${finalRotation}deg)`;

  // Wait for animation
  setTimeout(async () => {
    isSpinning = false;
    
    // Show winner
    $('#winner-name').textContent = winner?.displayName || 'Player';
    $('#winner-prize').textContent = formatGold(prize);
    $('#raffle-winner').style.display = '';

    // Save result to Firestore
    try {
      const raffleRef = await db.collection('raffles').add({
        name: $('#raffle-name').value.trim(),
        prize,
        participants: selectedParticipants,
        winnerUid,
        winnerName: winner?.displayName || 'Player',
        status: 'completed',
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid
      });
      showToast(`Parabéns ${winner?.displayName || 'Player'}!`, 'success');
      await loadRaffleHistory();

      // Scroll to history section
      setTimeout(() => {
        const historyEl = $('#raffle-history');
        if (historyEl) {
          historyEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } catch (err) {
      showToast('Erro ao salvar resultado: ' + err.message, 'error');
    }

    updateSpinButton();
  }, 4000);
});

// Load raffle history
async function loadRaffleHistory() {
  const historyContainer = $('#raffle-history');
  
  try {
    const snapshot = await db.collection('raffles')
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      historyContainer.innerHTML = '<div class="empty-state"><p>Nenhum sorteio realizado ainda</p></div>';
      return;
    }

    const history = [];
    snapshot.forEach(doc => {
      history.push({ id: doc.id, ...doc.data() });
    });

    historyContainer.innerHTML = history.map(raffle => {
      const date = raffle.completedAt?.toDate();
      const dateStr = date ? date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
      
      return `
        <div class="raffle-history-item">
          <div class="raffle-history-info">
            <div class="raffle-history-name">${raffle.name}</div>
            <div class="raffle-history-date">${dateStr} • ${raffle.participants?.length || 0} participantes</div>
          </div>
          <div class="raffle-history-winner">
            <div class="raffle-history-winner-name">${raffle.winnerName || '—'}</div>
            <div class="raffle-history-prize">${formatGold(raffle.prize)}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading raffle history:', err);
    historyContainer.innerHTML = '<div class="empty-state"><p>Erro ao carregar histórico</p></div>';
  }
}

// ============================================
// UTILITIES
// ============================================

function formatGold(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'G';
}

function parseGold(value) {
  if (!value) return 0;
  let str = String(value).trim();
  if (!str) return 0;
  // Remove dots (thousands separator) then replace comma with dot (decimal)
  str = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Allow digits, dots and commas on price inputs
['#item-price', '#edit-item-price', '#sell-item-price', '#raffle-prize'].forEach(sel => {
  const el = $(sel);
  if (el) {
    el.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9.,]/g, '');
    });
  }
});

function showFullscreenImage(src) {
  const modal = $('#fullscreen-image-modal');
  const img = $('#fullscreen-image');
  img.src = src;
  modal.classList.remove('hidden');
}

$('#fullscreen-image-modal').addEventListener('click', (e) => {
  if (e.target.classList.contains('fullscreen-overlay') || e.target.classList.contains('fullscreen-close')) {
    $('#fullscreen-image-modal').classList.add('hidden');
  }
});

$('#fullscreen-image-modal .fullscreen-close').addEventListener('click', () => {
  $('#fullscreen-image-modal').classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $('#fullscreen-image-modal')?.classList.add('hidden');
  }
});

function showToast(message, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function translateFirebaseError(code) {
  const errors = {
    'auth/email-already-in-use': 'Este email já está em uso.',
    'auth/invalid-email': 'Email inválido.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'Email ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde.',
    'auth/network-request-failed': 'Erro de conexão.',
    'auth/requires-recent-login': 'Faça login novamente para alterar a senha.'
  };
  return errors[code] || 'Ocorreu um erro. Tente novamente.';
}
