// ============================================
// SKINVAULT — Main Application Logic
// ============================================

// --- ADMIN CONFIG ---
const ADMIN_EMAIL = 'ssantosmattheuss@gmail.com';

function isAdmin() {
  return currentUser && currentUser.email === ADMIN_EMAIL;
}

// --- STATE ---
let currentUser = null;
let currentUserData = null;
let allUsers = [];
let adminAllUsers = [];

// --- WEAPON EMOJIS ---
const weaponIcons = {
  'AK-47': '🔫', 'M4A4': '🔫', 'M4A1-S': '🔫', 'AWP': '🎯',
  'Desert Eagle': '🔫', 'USP-S': '🔫', 'Glock-18': '🔫', 'P250': '🔫',
  'Five-SeveN': '🔫', 'Tec-9': '🔫', 'CZ75-Auto': '🔫',
  'FAMAS': '🔫', 'Galil AR': '🔫', 'SG 553': '🔫', 'AUG': '🔫',
  'SSG 08': '🎯', 'SCAR-20': '🎯', 'G3SG1': '🎯',
  'Nova': '🔫', 'XM1014': '🔫', 'MAG-7': '🔫', 'Sawed-Off': '🔫',
  'MP9': '🔫', 'MAC-10': '🔫', 'UMP-45': '🔫', 'P90': '🔫',
  'PP-Bizon': '🔫', 'MP7': '🔫', 'MP5-SD': '🔫',
  'Negev': '🔫', 'M249': '🔫',
  'Facas': '🗡️', 'Luvas': '🧤'
};

const wearNames = {
  'FN': 'Factory New', 'MW': 'Minimal Wear', 'FT': 'Field-Tested',
  'WW': 'Well-Worn', 'BS': 'Battle-Scarred'
};

const rarityNames = {
  'consumer': 'Consumer Grade', 'industrial': 'Industrial Grade',
  'milspec': 'Mil-Spec', 'restricted': 'Restricted',
  'classified': 'Classified', 'covert': 'Covert', 'contraband': 'Contraband'
};

const rarityOrder = ['consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'contraband'];

// --- DOM ELEMENTS ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- AUTH TABS ---
$$('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.auth-form').forEach(f => f.classList.remove('active'));
    $(`#${tab.dataset.tab}-form`).classList.add('active');
  });
});

// --- AUTH: LOGIN ---
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errorEl = $('#login-error');
  errorEl.textContent = '';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Login realizado com sucesso!', 'success');
  } catch (err) {
    errorEl.textContent = translateFirebaseError(err.code);
  }
});

// --- AUTH: REGISTER ---
$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#register-name').value.trim();
  const email = $('#register-email').value.trim();
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
    // Create user document in Firestore
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Conta criada com sucesso!', 'success');
  } catch (err) {
    errorEl.textContent = translateFirebaseError(err.code);
  }
});

// --- AUTH STATE LISTENER ---
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    // Ensure user doc exists
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      await db.collection('users').doc(user.uid).set({
        displayName: user.displayName || 'Player',
        email: user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    currentUserData = userDoc.data();
    showApp();
    // Show/hide admin nav
    const adminNav = $('#nav-admin');
    if (isAdmin()) {
      adminNav.style.display = '';
    } else {
      adminNav.style.display = 'none';
    }
  } else {
    currentUser = null;
    currentUserData = null;
    showAuth();
  }
});

// --- LOGOUT ---
$('#btn-logout').addEventListener('click', () => {
  auth.signOut();
  showToast('Você saiu da conta.', 'success');
});

// --- NAVIGATION ---
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${btn.dataset.view}`).classList.add('active');

    if (btn.dataset.view === 'players') loadPlayers();
    if (btn.dataset.view === 'ranking') loadRanking();
    if (btn.dataset.view === 'admin') loadAdminPanel();
  });
});

// --- SHOW/HIDE SCREENS ---
function showAuth() {
  $('#auth-screen').classList.add('active');
  $('#app-screen').classList.remove('active');
}

function showApp() {
  $('#auth-screen').classList.remove('active');
  $('#app-screen').classList.add('active');
  updateUserBadge();
  loadInventory();
}

function updateUserBadge() {
  const name = currentUser.displayName || currentUserData?.displayName || 'Player';
  $('#user-display-name').textContent = name;
  const avatar = $('#user-avatar');
  avatar.textContent = name.charAt(0).toUpperCase();
  if (isAdmin()) {
    avatar.classList.add('admin-avatar');
  } else {
    avatar.classList.remove('admin-avatar');
  }
}

// ============================================
// INVENTORY MANAGEMENT
// ============================================

let currentFilter = 'all';

// Filter buttons
$$('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.rarity;
    renderInventory();
  });
});

// Add item modal
$('#btn-add-item').addEventListener('click', () => {
  $('#add-item-modal').classList.remove('hidden');
});

// Close modals
$$('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal').classList.add('hidden');
  });
});

$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', () => {
    overlay.closest('.modal').classList.add('hidden');
  });
});

// Add item form
$('#add-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const item = {
    name: $('#item-name').value.trim(),
    weapon: $('#item-weapon').value,
    wear: $('#item-wear').value,
    rarity: $('#item-rarity').value,
    price: parseFloat($('#item-price').value) || 0,
    stattrak: $('#item-stattrak').value === 'true',
    float: parseFloat($('#item-float').value) || null,
    addedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('items').add(item);
    showToast(`"${item.name}" adicionado ao inventário!`, 'success');
    $('#add-item-form').reset();
    $('#add-item-modal').classList.add('hidden');
    loadInventory();
  } catch (err) {
    showToast('Erro ao adicionar item: ' + err.message, 'error');
  }
});

// Load inventory
let inventoryItems = [];

async function loadInventory() {
  if (!currentUser) return;

  try {
    const snapshot = await db.collection('users').doc(currentUser.uid)
      .collection('items').orderBy('addedAt', 'desc').get();

    inventoryItems = [];
    snapshot.forEach(doc => {
      inventoryItems.push({ id: doc.id, ...doc.data() });
    });

    updateInventoryStats();
    renderInventory();
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function updateInventoryStats() {
  const totalItems = inventoryItems.length;
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.price || 0), 0);

  let rarestItem = '—';
  let highestRarity = -1;
  inventoryItems.forEach(item => {
    const idx = rarityOrder.indexOf(item.rarity);
    if (idx > highestRarity) {
      highestRarity = idx;
      rarestItem = item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name;
    }
  });

  $('#stat-items').textContent = totalItems;
  $('#stat-value').textContent = '$' + totalValue.toFixed(2);
  $('#stat-rarest').textContent = rarestItem;
}

function renderInventory() {
  const grid = $('#inventory-grid');
  let items = inventoryItems;

  if (currentFilter !== 'all') {
    items = items.filter(item => item.rarity === currentFilter);
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
        <p>${currentFilter === 'all' ? 'Seu inventário está vazio' : 'Nenhum item nesta categoria'}</p>
        <span>${currentFilter === 'all' ? 'Adicione skins para começar' : 'Tente outra categoria'}</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => createItemCard(item, true)).join('');

  // Attach delete handlers
  grid.querySelectorAll('.item-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.id;
      if (confirm('Remover este item do inventário?')) {
        try {
          await db.collection('users').doc(currentUser.uid)
            .collection('items').doc(itemId).delete();
          showToast('Item removido.', 'success');
          loadInventory();
        } catch (err) {
          showToast('Erro ao remover item.', 'error');
        }
      }
    });
  });
}

function createItemCard(item, showDelete = false) {
  const icon = weaponIcons[item.weapon] || '🔫';
  const wearLabel = wearNames[item.wear] || item.wear;
  const fullName = item.stattrak ? `StatTrak™ ${item.name}` : item.name;

  return `
    <div class="item-card" data-rarity="${item.rarity}">
      ${showDelete ? `<button class="item-delete-btn" data-id="${item.id}" title="Remover">&times;</button>` : ''}
      ${item.stattrak ? '<div class="item-stattrak-badge">STATTRAK</div>' : ''}
      <div class="item-card-image">
        <span class="item-weapon-icon">${icon}</span>
      </div>
      <div class="item-card-info">
        <div class="item-card-name" title="${fullName}">${fullName}</div>
        <div class="item-card-wear">${wearLabel}</div>
        <div class="item-card-bottom">
          <span class="item-card-price">$${(item.price || 0).toFixed(2)}</span>
          ${item.float !== null ? `<span class="item-card-float">${item.float.toFixed(6)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// PLAYERS VIEW
// ============================================

async function loadPlayers() {
  const grid = $('#players-grid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando jogadores...</p></div>';

  try {
    const snapshot = await db.collection('users').get();
    allUsers = [];

    for (const doc of snapshot.docs) {
      if (doc.id === currentUser.uid) continue; // Skip self
      const userData = doc.data();
      // Get items count and total value
      const itemsSnap = await db.collection('users').doc(doc.id).collection('items').get();
      let totalValue = 0;
      let itemCount = 0;
      itemsSnap.forEach(itemDoc => {
        const d = itemDoc.data();
        totalValue += d.price || 0;
        itemCount++;
      });

      allUsers.push({
        uid: doc.id,
        displayName: userData.displayName || 'Player',
        createdAt: userData.createdAt,
        itemCount,
        totalValue,
        isAdmin: userData.email === ADMIN_EMAIL
      });
    }

    renderPlayers(allUsers);
  } catch (err) {
    console.error('Error loading players:', err);
    grid.innerHTML = '<div class="empty-state"><p>Erro ao carregar jogadores</p></div>';
  }
}

function renderPlayers(players) {
  const grid = $('#players-grid');

  if (players.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
        <p>Nenhum outro jogador encontrado</p>
        <span>Convide amigos para se cadastrarem</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = players.map(player => `
    <div class="player-card" data-uid="${player.uid}">
      <div class="player-card-avatar">${player.displayName.charAt(0).toUpperCase()}</div>
      <div class="player-card-info">
        <div class="player-card-name">${player.displayName}${player.isAdmin ? ' <span class="admin-tag">ADMIN</span>' : ''}</div>
        <div class="player-card-meta">${player.itemCount} ${player.itemCount === 1 ? 'item' : 'itens'}</div>
      </div>
      <div class="player-card-stats">
        <div>
          <div class="player-card-stat-value">$${player.totalValue.toFixed(0)}</div>
          <div class="player-card-stat-label">VALOR</div>
        </div>
      </div>
    </div>
  `).join('');

  // Attach click handlers
  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => openPlayerProfile(card.dataset.uid));
  });
}

// Search players
$('#search-players').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderPlayers(allUsers);
    return;
  }
  const filtered = allUsers.filter(p =>
    p.displayName.toLowerCase().includes(query)
  );
  renderPlayers(filtered);
});

// Player profile modal
async function openPlayerProfile(uid) {
  const modal = $('#player-modal');
  modal.classList.remove('hidden');

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const itemsSnap = await db.collection('users').doc(uid)
      .collection('items').orderBy('addedAt', 'desc').get();

    const items = [];
    let totalValue = 0;
    itemsSnap.forEach(doc => {
      const d = doc.data();
      items.push(d);
      totalValue += d.price || 0;
    });

    $('#profile-avatar').textContent = (userData.displayName || 'P').charAt(0).toUpperCase();
    $('#profile-name').textContent = userData.displayName || 'Player';

    const createdDate = userData.createdAt?.toDate();
    $('#profile-since').textContent = createdDate
      ? `Membro desde ${createdDate.toLocaleDateString('pt-BR')}`
      : 'Membro recente';

    $('#profile-items').textContent = items.length;
    $('#profile-value').textContent = '$' + totalValue.toFixed(2);

    const profileGrid = $('#profile-inventory');
    if (items.length === 0) {
      profileGrid.innerHTML = '<div class="empty-state"><p>Inventário vazio</p></div>';
    } else {
      profileGrid.innerHTML = items.map(item => `
        <div class="profile-item-card" data-rarity="${item.rarity}">
          <div class="profile-item-name">${item.stattrak ? 'StatTrak™ ' : ''}${item.name}</div>
          <div class="profile-item-wear">${wearNames[item.wear] || item.wear}</div>
          <div class="profile-item-price">$${(item.price || 0).toFixed(2)}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading player profile:', err);
    showToast('Erro ao carregar perfil.', 'error');
  }
}

// ============================================
// RANKING VIEW
// ============================================

async function loadRanking() {
  const container = $('#ranking-container');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando ranking...</p></div>';

  try {
    const snapshot = await db.collection('users').get();
    const rankings = [];

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const itemsSnap = await db.collection('users').doc(doc.id).collection('items').get();
      let totalValue = 0;
      let itemCount = 0;
      itemsSnap.forEach(itemDoc => {
        const d = itemDoc.data();
        totalValue += d.price || 0;
        itemCount++;
      });

      rankings.push({
        uid: doc.id,
        displayName: userData.displayName || 'Player',
        itemCount,
        totalValue,
        isCurrentUser: doc.id === currentUser.uid,
        isAdmin: userData.email === ADMIN_EMAIL
      });
    }

    // Sort by total value descending
    rankings.sort((a, b) => b.totalValue - a.totalValue);
    renderRanking(rankings);
  } catch (err) {
    console.error('Error loading ranking:', err);
    container.innerHTML = '<div class="empty-state"><p>Erro ao carregar ranking</p></div>';
  }
}

function renderRanking(rankings) {
  const container = $('#ranking-container');

  if (rankings.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum jogador no ranking</p></div>';
    return;
  }

  let html = '';

  // Podium for top 3
  if (rankings.length >= 1) {
    html += '<div class="ranking-podium">';
    const top3 = rankings.slice(0, 3);

    // Render order: 2nd, 1st, 3rd
    const order = [1, 0, 2];
    order.forEach(idx => {
      if (top3[idx]) {
        const p = top3[idx];
        const pos = idx + 1;
        html += `
          <div class="podium-item podium-${pos}" data-uid="${p.uid}">
            <div class="podium-rank">#${pos}</div>
            <div class="podium-avatar">${p.displayName.charAt(0).toUpperCase()}</div>
            <div class="podium-name">${p.displayName}${p.isAdmin ? ' <span class="admin-tag">ADMIN</span>' : ''}${p.isCurrentUser ? ' (Você)' : ''}</div>
            <div class="podium-value">$${p.totalValue.toFixed(2)}</div>
          </div>
        `;
      }
    });
    html += '</div>';
  }

  // Full table
  html += `
    <table class="ranking-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Jogador</th>
          <th>Itens</th>
          <th>Valor Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  rankings.forEach((player, idx) => {
    const pos = idx + 1;
    const rankClass = pos <= 3 ? `rank-${pos}` : '';
    html += `
      <tr class="${rankClass}" data-uid="${player.uid}">
        <td><span class="rank-position">${pos}</span></td>
        <td>
          <div class="rank-player">
            <div class="rank-avatar">${player.displayName.charAt(0).toUpperCase()}</div>
            <span class="rank-name">${player.displayName}${player.isAdmin ? ' <span class="admin-tag">ADMIN</span>' : ''}${player.isCurrentUser ? ' (Você)' : ''}</span>
          </div>
        </td>
        <td><span class="rank-items-count">${player.itemCount}</span></td>
        <td><span class="rank-value">$${player.totalValue.toFixed(2)}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Click on ranking rows to view profile
  container.querySelectorAll('tr[data-uid], .podium-item[data-uid]').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      if (uid !== currentUser.uid) {
        // Switch to players view and open profile
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        $('[data-view="players"]').classList.add('active');
        $$('.view').forEach(v => v.classList.remove('active'));
        $('#view-players').classList.add('active');
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
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando usuários...</p></div>';

  try {
    const snapshot = await db.collection('users').get();
    adminAllUsers = [];
    let globalItems = 0;
    let globalValue = 0;

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const itemsSnap = await db.collection('users').doc(doc.id).collection('items').get();
      let totalValue = 0;
      let itemCount = 0;
      itemsSnap.forEach(itemDoc => {
        const d = itemDoc.data();
        totalValue += d.price || 0;
        itemCount++;
      });

      const isAdminUser = userData.email === ADMIN_EMAIL;
      adminAllUsers.push({
        uid: doc.id,
        displayName: userData.displayName || 'Player',
        email: userData.email || '',
        createdAt: userData.createdAt,
        itemCount,
        totalValue,
        isAdmin: isAdminUser
      });

      globalItems += itemCount;
      globalValue += totalValue;
    }

    // Update stats
    $('#admin-stat-users').textContent = adminAllUsers.length;
    $('#admin-stat-items').textContent = globalItems;
    $('#admin-stat-value').textContent = '$' + globalValue.toFixed(0);

    renderAdminUsers(adminAllUsers);
  } catch (err) {
    console.error('Error loading admin panel:', err);
    list.innerHTML = '<div class="empty-state"><p>Erro ao carregar painel admin</p></div>';
  }
}

function renderAdminUsers(users) {
  const list = $('#admin-users-list');

  if (users.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Nenhum usuário encontrado</p></div>';
    return;
  }

  // Sort: admin first, then by value descending
  users.sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return b.totalValue - a.totalValue;
  });

  list.innerHTML = users.map(user => `
    <div class="admin-user-row ${user.isAdmin ? 'is-admin' : ''}" data-uid="${user.uid}">
      <div class="admin-user-avatar">${user.displayName.charAt(0).toUpperCase()}</div>
      <div class="admin-user-info">
        <div class="admin-user-name">
          ${user.displayName}
          ${user.isAdmin ? '<span class="admin-tag">ADMIN</span>' : ''}
        </div>
        <div class="admin-user-email">${user.email}</div>
      </div>
      <div class="admin-user-stats">
        <div class="admin-user-stat">
          <div class="admin-user-stat-value">${user.itemCount}</div>
          <div class="admin-user-stat-label">ITENS</div>
        </div>
        <div class="admin-user-stat">
          <div class="admin-user-stat-value">$${user.totalValue.toFixed(0)}</div>
          <div class="admin-user-stat-label">VALOR</div>
        </div>
      </div>
      <div class="admin-user-actions">
        <button class="btn-admin-action" data-action="view" data-uid="${user.uid}" title="Ver detalhes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${!user.isAdmin ? `
        <button class="btn-admin-action danger" data-action="delete-user" data-uid="${user.uid}" title="Excluir usuário">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Attach handlers
  list.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAdminUserDetail(btn.dataset.uid);
    });
  });

  list.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uid = btn.dataset.uid;
      const user = adminAllUsers.find(u => u.uid === uid);
      if (confirm(`Tem certeza que deseja excluir o usuário "${user.displayName}"?\n\nIsso removerá todos os itens do inventário e os dados do usuário.`)) {
        try {
          // Delete all items first
          const itemsSnap = await db.collection('users').doc(uid).collection('items').get();
          const batch = db.batch();
          itemsSnap.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          // Delete user document
          await db.collection('users').doc(uid).delete();
          showToast(`Usuário "${user.displayName}" excluído.`, 'success');
          loadAdminPanel();
        } catch (err) {
          showToast('Erro ao excluir usuário: ' + err.message, 'error');
        }
      }
    });
  });

  // Click row to view detail
  list.querySelectorAll('.admin-user-row').forEach(row => {
    row.addEventListener('click', () => {
      openAdminUserDetail(row.dataset.uid);
    });
  });
}

async function openAdminUserDetail(uid) {
  if (!isAdmin()) return;

  const modal = $('#admin-user-modal');
  modal.classList.remove('hidden');
  adminCurrentTargetUid = uid;

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const itemsSnap = await db.collection('users').doc(uid)
      .collection('items').orderBy('addedAt', 'desc').get();

    const items = [];
    itemsSnap.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() });
    });

    const isAdminUser = userData.email === ADMIN_EMAIL;

    $('#admin-detail-avatar').textContent = (userData.displayName || 'P').charAt(0).toUpperCase();
    $('#admin-detail-name').innerHTML = userData.displayName + (isAdminUser ? ' <span class="admin-tag">ADMIN</span>' : '');
    $('#admin-detail-email').textContent = userData.email || '';

    const createdDate = userData.createdAt?.toDate();
    $('#admin-detail-since').textContent = createdDate
      ? `Membro desde ${createdDate.toLocaleDateString('pt-BR')}`
      : 'Membro recente';

    // Show/hide delete user button (can't delete admin or self)
    const deleteBtn = $('#admin-delete-user-btn');
    if (isAdminUser || uid === currentUser.uid) {
      deleteBtn.style.display = 'none';
    } else {
      deleteBtn.style.display = '';
    }

    // Show/hide clear inventory button
    const clearBtn = $('#admin-clear-inventory-btn');
    if (items.length === 0) {
      clearBtn.style.display = 'none';
    } else {
      clearBtn.style.display = '';
    }

    const itemsContainer = $('#admin-detail-items');
    if (items.length === 0) {
      itemsContainer.innerHTML = '<div class="empty-state" style="padding:2rem"><p>Inventário vazio</p></div>';
    } else {
      itemsContainer.innerHTML = items.map(item => `
        <div class="admin-item-card" data-rarity="${item.rarity}">
          <button class="admin-item-delete" data-item-id="${item.id}" title="Remover item">&times;</button>
          <div class="admin-item-name">${item.stattrak ? 'StatTrak™ ' : ''}${item.name}</div>
          <div class="admin-item-wear">${wearNames[item.wear] || item.wear}</div>
          <div class="admin-item-bottom">
            <span class="admin-item-price">$${(item.price || 0).toFixed(2)}</span>
          </div>
        </div>
      `).join('');

      // Attach delete item handlers
      itemsContainer.querySelectorAll('.admin-item-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const itemId = btn.dataset.itemId;
          if (confirm('Remover este item do inventário do usuário?')) {
            try {
              await db.collection('users').doc(uid).collection('items').doc(itemId).delete();
              showToast('Item removido.', 'success');
              openAdminUserDetail(uid); // Refresh
              loadAdminPanel(); // Refresh stats
            } catch (err) {
              showToast('Erro ao remover item.', 'error');
            }
          }
        });
      });
    }
  } catch (err) {
    console.error('Error loading admin user detail:', err);
    showToast('Erro ao carregar detalhes.', 'error');
  }
}

// Admin: Delete user button
$('#admin-delete-user-btn').addEventListener('click', async () => {
  if (!adminCurrentTargetUid || !isAdmin()) return;

  const user = adminAllUsers.find(u => u.uid === adminCurrentTargetUid);
  if (!user || user.isAdmin) return;

  if (confirm(`Tem certeza que deseja excluir "${user.displayName}"?\n\nEsta ação é irreversível.`)) {
    try {
      // Delete all items
      const itemsSnap = await db.collection('users').doc(adminCurrentTargetUid).collection('items').get();
      const batch = db.batch();
      itemsSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      // Delete user doc
      await db.collection('users').doc(adminCurrentTargetUid).delete();
      showToast(`Usuário "${user.displayName}" excluído.`, 'success');
      $('#admin-user-modal').classList.add('hidden');
      loadAdminPanel();
    } catch (err) {
      showToast('Erro ao excluir usuário: ' + err.message, 'error');
    }
  }
});

// Admin: Clear inventory button
$('#admin-clear-inventory-btn').addEventListener('click', async () => {
  if (!adminCurrentTargetUid || !isAdmin()) return;

  if (confirm('Tem certeza que deseja limpar TODO o inventário deste usuário?')) {
    try {
      const itemsSnap = await db.collection('users').doc(adminCurrentTargetUid).collection('items').get();
      const batch = db.batch();
      itemsSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      showToast('Inventário limpo.', 'success');
      openAdminUserDetail(adminCurrentTargetUid); // Refresh
      loadAdminPanel(); // Refresh stats
    } catch (err) {
      showToast('Erro ao limpar inventário.', 'error');
    }
  }
});

// Admin search
$('#admin-search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderAdminUsers(adminAllUsers);
    return;
  }
  const filtered = adminAllUsers.filter(u =>
    u.displayName.toLowerCase().includes(query) ||
    u.email.toLowerCase().includes(query)
  );
  renderAdminUsers(filtered);
});

// ============================================
// UTILITIES
// ============================================

function showToast(message, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
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
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.'
  };
  return errors[code] || 'Ocorreu um erro. Tente novamente.';
}
