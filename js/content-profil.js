/**
 * content-profil.js — Sub-view Profil (CRUD)
 * Fase E — Proof of Concept
 */

// ==========================================
// STATE
// ==========================================
const profilState = {
  items: [],
  loaded: false,
  currentItem: null,        // untuk EDIT
  isDirty: false,
  originalForm: { Header: '', Body: '' }
};

// ==========================================
// HELPER: API CALL
// ==========================================
async function profilGasCall(action, params) {
  params = params || {};
  const url = new URL(window.GAS_ADMIN_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('adminId', currentAdmin.id);
  for (const k in params) {
    if (params[k] !== undefined && params[k] !== null) {
      url.searchParams.set(k, params[k]);
    }
  }
  const res = await fetch(url.toString());
  return res.json();
}

// ==========================================
// HELPER: FETCH ITEMS
// ==========================================
async function fetchProfilItems(force) {
  force = force || false;
  if (!force && profilState.loaded) return profilState.items;
  
  const data = await profilGasCall('getAllContent');
  if (data.status !== 'success') {
    throw new Error(data.message || 'Gagal memuat konten');
  }
  
  const all = data.data || [];
  profilState.items = all
    .filter(function(item) { return item.ID && item.ID.toString().toLowerCase() === 'profil'; })
    .sort(function(a, b) {
      const ta = new Date(a.Timestamp).getTime() || 0;
      const tb = new Date(b.Timestamp).getTime() || 0;
      return tb - ta;  // terbaru dulu
    })
    .map(function(item) {
      return {
        timestamp: new Date(item.Timestamp).getTime(),
        header: (item.Header || '').toString(),
        body: (item.Body || '').toString()
      };
    });
  
  profilState.loaded = true;
  return profilState.items;
}

// ==========================================
// RENDER LIST
// ==========================================
window.renderProfilList = async function() {
  const subView = document.getElementById('content-view-sub');
  if (!subView) return;
  
  // Render skeleton
  subView.innerHTML = 
    '<div class="content-sub-header">' +
    '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">' +
    '    <i class="fas fa-arrow-left"></i>' +
    '  </button>' +
    '  <div class="content-sub-title">Profil</div>' +
    '  <div class="content-sub-actions">' +
    '    <button class="content-sub-btn primary" onclick="window.profilOpenAdd()">' +
    '      <i class="fas fa-plus"></i> Tambah' +
    '    </button>' +
    '  </div>' +
    '</div>' +
    '<div class="content-sub-body" id="profil-list-body">' +
    '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
    '</div>';
  
  // Fetch items
  try {
    await fetchProfilItems(false);
    renderProfilListHTML();
  } catch (e) {
    console.error('[PROFIL] fetch error:', e);
    document.getElementById('profil-list-body').innerHTML = 
      '<div class="content-placeholder"><i class="fas fa-exclamation-triangle" style="color:#f87171;"></i><p>Gagal memuat: ' + 
      (e.message || 'Koneksi error') + '</p></div>';
  }
};

function renderProfilListHTML() {
  const body = document.getElementById('profil-list-body');
  if (!body) return;
  
  if (!profilState.items.length) {
    body.innerHTML = 
      '<div class="content-placeholder">' +
      '<i class="fas fa-folder-open"></i>' +
      '<p>Belum ada item profil</p>' +
      '<p style="font-size:0.75rem;opacity:0.7;margin-top:8px;">Klik "Tambah" untuk membuat item baru</p>' +
      '</div>';
    return;
  }
  
  let html = '<div class="profil-list">';
  for (let i = 0; i < profilState.items.length; i++) {
    const item = profilState.items[i];
    const preview = (item.body || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    html += 
      '<div class="profil-item">' +
      '  <div class="profil-item-main">' +
      '    <div class="profil-item-header">' + escapeProfil(item.header || '(tanpa judul)') + '</div>' +
      '    <div class="profil-item-preview">' + (preview || '(kosong)') + '</div>' +
      '  </div>' +
      '  <div class="profil-item-actions">' +
      '    <button class="profil-icon-btn" onclick="window.profilOpenEdit(' + i + ')" title="Edit">' +
      '      <i class="fas fa-pen"></i>' +
      '    </button>' +
      '    <button class="profil-icon-btn danger" onclick="window.profilOpenDelete(' + i + ')" title="Hapus">' +
      '      <i class="fas fa-trash"></i>' +
      '    </button>' +
      '  </div>' +
      '</div>';
  }
  html += '</div>';
  
  body.innerHTML = html;
}

// ==========================================
// EDIT
// ==========================================
window.profilOpenEdit = function(index) {
  const item = profilState.items[index];
  if (!item) return;
  
  profilState.currentItem = item;
  profilState.originalForm = { Header: item.header, Body: item.body };
  profilState.isDirty = false;
  
  if (typeof pushView === 'function') {
    pushView('content-profil-edit', { item: item });
  } else {
    renderProfilEditForm();
  }
};

window.renderProfilEditForm = function() {
  const subView = document.getElementById('content-view-sub');
  if (!subView || !profilState.currentItem) return;
  
  const item = profilState.currentItem;
  
  subView.innerHTML = 
    '<div class="content-sub-header">' +
    '  <button class="content-sub-back-btn" onclick="window.profilBackFromEdit()">' +
    '    <i class="fas fa-arrow-left"></i>' +
    '  </button>' +
    '  <div class="content-sub-title">Edit Profil</div>' +
    '  <div class="content-sub-actions">' +
    '    <button id="profil-save-btn" class="content-sub-btn primary" onclick="window.profilSaveEdit()" disabled>' +
    '      <i class="fas fa-save"></i> <span id="profil-save-label">Tersimpan</span>' +
    '    </button>' +
    '  </div>' +
    '</div>' +
    '<div class="content-sub-body">' +
    '  <div class="content-form">' +
    '    <label class="content-form-label">Judul</label>' +
    '    <input type="text" id="profil-input-header" class="content-form-input" placeholder="Judul profil">' +
    '    <label class="content-form-label">Isi</label>' +
    '    <textarea id="profil-input-body" class="content-form-textarea" rows="8" placeholder="Isi profil..."></textarea>' +
    '  </div>' +
    '</div>';
  
  // Isi form
  document.getElementById('profil-input-header').value = item.header;
  document.getElementById('profil-input-body').value = item.body;
  
  // Wire event dirty
  document.getElementById('profil-input-header').addEventListener('input', checkProfilDirty);
  document.getElementById('profil-input-body').addEventListener('input', checkProfilDirty);
};

function checkProfilDirty() {
  const header = document.getElementById('profil-input-header').value;
  const body = document.getElementById('profil-input-body').value;
  
  const dirty = header !== profilState.originalForm.Header || body !== profilState.originalForm.Body;
  profilState.isDirty = dirty;
  
  const btn = document.getElementById('profil-save-btn');
  const label = document.getElementById('profil-save-label');
  if (btn) btn.disabled = !dirty;
  if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
}

window.profilSaveEdit = async function() {
  const header = document.getElementById('profil-input-header').value;
  const body = document.getElementById('profil-input-body').value;
  const btn = document.getElementById('profil-save-btn');
  const label = document.getElementById('profil-save-label');
  
  if (!btn || btn.disabled) return;
  
  btn.disabled = true;
  if (label) label.textContent = 'Menyimpan...';
  
  try {
    const fields = JSON.stringify({ Header: header, Body: body });
    const result = await profilGasCall('updateContent', {
      timestamp: profilState.currentItem.timestamp,
      fields: fields
    });
    
    if (result.status === 'success') {
      window.showToast('✅ Tersimpan (belum tayang)');
      profilState.originalForm = { Header: header, Body: body };
      profilState.isDirty = false;
      // Update item di state
      profilState.currentItem.header = header;
      profilState.currentItem.body = body;
      // Invalidate cache agar list refresh
      profilState.loaded = false;
      // Update banner
      if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      
      if (label) label.textContent = 'Tersimpan';
      btn.disabled = true;
    } else {
      window.showToast('❌ ' + (result.message || 'Gagal'), true);
      if (label) label.textContent = 'Simpan';
      btn.disabled = false;
    }
  } catch (e) {
    console.error('[PROFIL] save error:', e);
    window.showToast('❌ Koneksi gagal', true);
    if (label) label.textContent = 'Simpan';
    btn.disabled = false;
  }
};

window.profilBackFromEdit = async function() {
  if (profilState.isDirty) {
    const choice = await window.contentModal.show({
      title: 'Ada perubahan belum disimpan',
      desc: 'Pilih tindakan:',
      buttons: [
        { label: '💾 Simpan & Kembali', style: 'confirm', value: 'save' },
        { label: '🗑️ Buang Perubahan', style: 'danger', value: 'discard' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (choice === 'save') {
      await window.profilSaveEdit();
      if (profilState.isDirty) return;  // save gagal, stay
      closeCurrentView();
    } else if (choice === 'discard') {
      profilState.isDirty = false;
      closeCurrentView();
    }
    // cancel: stay
  } else {
    closeCurrentView();
  }
};

// ==========================================
// ADD
// ==========================================
window.profilOpenAdd = function() {
  profilState.currentItem = null;
  profilState.originalForm = { Header: '', Body: '' };
  profilState.isDirty = false;
  
  if (typeof pushView === 'function') {
    pushView('content-profil-add', {});
  } else {
    renderProfilAddForm();
  }
};

window.renderProfilAddForm = function() {
  const subView = document.getElementById('content-view-sub');
  if (!subView) return;
  
  subView.innerHTML = 
    '<div class="content-sub-header">' +
    '  <button class="content-sub-back-btn" onclick="window.profilBackFromAdd()">' +
    '    <i class="fas fa-arrow-left"></i>' +
    '  </button>' +
    '  <div class="content-sub-title">Tambah Profil</div>' +
    '  <div class="content-sub-actions">' +
    '    <button id="profil-add-save-btn" class="content-sub-btn primary" onclick="window.profilSaveAdd()" disabled>' +
    '      <i class="fas fa-plus"></i> <span id="profil-add-save-label">Simpan</span>' +
    '    </button>' +
    '  </div>' +
    '</div>' +
    '<div class="content-sub-body">' +
    '  <div class="content-form">' +
    '    <label class="content-form-label">Judul <span style="color:#ef4444;">*</span></label>' +
    '    <input type="text" id="profil-add-header" class="content-form-input" placeholder="Judul profil baru">' +
    '    <label class="content-form-label">Isi</label>' +
    '    <textarea id="profil-add-body" class="content-form-textarea" rows="8" placeholder="Isi profil..."></textarea>' +
    '  </div>' +
    '</div>';
  
  document.getElementById('profil-add-header').addEventListener('input', checkProfilAddDirty);
  document.getElementById('profil-add-body').addEventListener('input', checkProfilAddDirty);
};

function checkProfilAddDirty() {
  const header = document.getElementById('profil-add-header').value.trim();
  const btn = document.getElementById('profil-add-save-btn');
  if (btn) btn.disabled = !header;
}

window.profilSaveAdd = async function() {
  const header = document.getElementById('profil-add-header').value.trim();
  const body = document.getElementById('profil-add-body').value;
  const btn = document.getElementById('profil-add-save-btn');
  const label = document.getElementById('profil-add-save-label');
  
  if (!header) {
    window.showToast('❌ Judul wajib diisi', true);
    return;
  }
  if (!btn || btn.disabled) return;
  
  btn.disabled = true;
  if (label) label.textContent = 'Menyimpan...';
  
  try {
    const result = await profilGasCall('addContentItem', {
      category: 'profil',
      header: header,
      body: body
    });
    
    if (result.status === 'success') {
      window.showToast('✅ Ditambahkan (belum tayang)');
      profilState.loaded = false;
      if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      closeCurrentView();  // kembali ke list
    } else {
      window.showToast('❌ ' + (result.message || 'Gagal'), true);
      if (label) label.textContent = 'Simpan';
      btn.disabled = false;
    }
  } catch (e) {
    console.error('[PROFIL] add error:', e);
    window.showToast('❌ Koneksi gagal', true);
    if (label) label.textContent = 'Simpan';
    btn.disabled = false;
  }
};

window.profilBackFromAdd = async function() {
  const header = document.getElementById('profil-add-header').value.trim();
  const body = document.getElementById('profil-add-body').value;
  
  if (header || body) {
    const choice = await window.contentModal.show({
      title: 'Batal menambah?',
      desc: 'Data yang sudah diisi akan hilang.',
      buttons: [
        { label: 'Buang', style: 'danger', value: 'discard' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (choice === 'discard') {
      closeCurrentView();
    }
  } else {
    closeCurrentView();
  }
};

// ==========================================
// DELETE
// ==========================================
window.profilOpenDelete = async function(index) {
  const item = profilState.items[index];
  if (!item) return;
  
  const choice = await window.contentModal.show({
    title: 'Hapus "' + escapeProfil(item.header || 'item') + '"?',
    desc: 'Tindakan ini tidak bisa dibatalkan. Item akan dihapus dari sheet, tapi belum tayang sampai Anda klik PUBLISH.',
    buttons: [
      { label: 'Ya, Hapus', style: 'danger', value: 'yes' },
      { label: 'Batal', style: 'cancel', value: 'cancel' }
    ]
  });
  
  if (choice !== 'yes') return;
  
  try {
    const result = await profilGasCall('deleteContentItem', { timestamp: item.timestamp });
    if (result.status === 'success') {
      window.showToast('✅ Item dihapus (belum tayang)');
      profilState.loaded = false;
      if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      await renderProfilList();
    } else {
      window.showToast('❌ ' + (result.message || 'Gagal hapus'), true);
    }
  } catch (e) {
    console.error('[PROFIL] delete error:', e);
    window.showToast('❌ Koneksi gagal', true);
  }
};

// ==========================================
// HELPER: ESCAPE HTML
// ==========================================
function escapeProfil(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

console.log('✅ content-profil.js loaded');
