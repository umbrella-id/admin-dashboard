/**
 * content-crysta.js — Sub-view Crysta (CRUD + Fetch Coryn)
 */

(function() {
  const state = {
    items: [],
    loaded: false,
    currentItem: null,
    isAddMode: false,
    isDirty: false,
    originalForm: { type: 'weapon', name: '', upgrade_for: '', stat: '' }
  };
  
  const TYPE_LABELS = {
    weapon: 'Weapon', armor: 'Armor', additional: 'Additional',
    special: 'Special', normal: 'Normal'
  };
  const TYPE_ICONS = {
    weapon: 'fa-sword', armor: 'fa-shield-alt', additional: 'fa-gem',
    special: 'fa-star', normal: 'fa-circle'
  };
  
  async function gasCall(action, params) {
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
  
  async function fetchCrystaItems(force) {
    if (!force && state.loaded) return state.items;
    const data = await gasCall('getAllCrysta');
    if (data.status !== 'success') throw new Error(data.message || 'Gagal load');
    state.items = data.data || [];
    state.loaded = true;
    return state.items;
  }
  
  // ==========================================
  // RENDER LIST
  // ==========================================
  window.renderCrystaList = async function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">' +
      '    <i class="fas fa-arrow-left"></i>' +
      '  </button>' +
      '  <div class="content-sub-title">Crysta <small id="crysta-count" style="color:var(--text-muted);font-weight:400;"></small></div>' +
      '  <div class="content-sub-actions">' +
      '    <button class="content-sub-btn primary" onclick="window.crystaOpenAdd()">' +
      '      <i class="fas fa-plus"></i> Tambah' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body" id="crysta-body">' +
      '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
      '</div>';
    
    try {
      await fetchCrystaItems(false);
      renderCrystaGrouped();
    } catch (e) {
      console.error('[CRYSTA] load error:', e);
      document.getElementById('crysta-body').innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-exclamation-triangle" style="color:#f87171;"></i>' +
        '<p>Gagal memuat: ' + window.escapeHtml(e.message) + '</p></div>';
    }
  };
  
  function renderCrystaGrouped() {
    const body = document.getElementById('crysta-body');
    const countEl = document.getElementById('crysta-count');
    if (!body) return;
    
    if (countEl) countEl.textContent = '(' + state.items.length + ' item)';
    
    if (state.items.length === 0) {
      body.innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-gem"></i>' +
        '<p>Belum ada crysta</p>' +
        '<p style="font-size:0.75rem;opacity:0.7;margin-top:8px;">Klik "Tambah" untuk membuat item pertama</p></div>';
      return;
    }
    
    const groups = {};
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    }
    
    const typeOrder = ['weapon', 'armor', 'additional', 'special', 'normal'];
    let html = '';
    
    for (let t = 0; t < typeOrder.length; t++) {
      const type = typeOrder[t];
      const items = groups[type];
      if (!items || items.length === 0) continue;
      
      items.sort(function(a, b) { return a.name.localeCompare(b.name); });
      
      html += '<div class="crysta-group">';
      html += '  <div class="crysta-group-header">';
      html += '    <span><i class="fas ' + TYPE_ICONS[type] + '"></i> ' + TYPE_LABELS[type] + '</span>';
      html += '    <span class="crysta-group-count">' + items.length + '</span>';
      html += '  </div>';
      html += '  <div class="crysta-group-list">';
      
      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        const hasParent = item.upgrade_for && item.upgrade_for !== '';
        const targetLabel = hasParent 
          ? '<span class="crysta-badge-upgrade">↑ ' + window.escapeHtml(item.upgrade_for) + '</span>' 
          : '<span class="crysta-badge-base">base</span>';
        
        html += '<div class="crysta-item">';
        html += '  <div class="crysta-item-main">';
        html += '    <div class="crysta-item-name">' + window.escapeHtml(item.name) + ' ' + targetLabel + '</div>';
        html += '    <div class="crysta-item-stat">' + window.escapeHtml(item.stat.replace(/\n/g, ' • ')) + '</div>';
        html += '  </div>';
        html += '  <div class="crysta-item-actions">';
        html += '    <button class="profil-icon-btn" onclick="window.crystaOpenEdit(' + item.rowId + ')" title="Edit"><i class="fas fa-pen"></i></button>';
        html += '    <button class="profil-icon-btn danger" onclick="window.crystaOpenDelete(' + item.rowId + ')" title="Hapus"><i class="fas fa-trash"></i></button>';
        html += '  </div>';
        html += '</div>';
      }
      
      html += '  </div>';
      html += '</div>';
    }
    
    body.innerHTML = html;
  }
  
  // ==========================================
  // FORM
  // ==========================================
  function buildCrystaFormHTML(isAdd) {
    let typeOptions = '';
    const typeOrder = ['weapon', 'armor', 'additional', 'special', 'normal'];
    for (let i = 0; i < typeOrder.length; i++) {
      typeOptions += '<option value="' + typeOrder[i] + '">' + TYPE_LABELS[typeOrder[i]] + '</option>';
    }
    
    let datalistOptions = '';
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (!isAdd && state.currentItem && item.rowId === state.currentItem.rowId) continue;
      datalistOptions += '<option value="' + window.escapeHtml(item.name) + '">';
    }
    
    return '' +
      '<div class="content-form">' +
      '  <label class="content-form-label">Nama Crysta <span style="color:#ef4444;">*</span></label>' +
      '  <div style="display:flex;gap:8px;align-items:stretch;">' +
      '    <input type="text" id="crysta-input-name" class="content-form-input" placeholder="Contoh: Ganglef" autocomplete="off" style="flex:1;">' +
      '    <button type="button" id="crysta-fetch-btn" class="content-sub-btn" onclick="window.crystaFetchFromCoryn()" style="flex-shrink:0;" title="Ambil stat otomatis dari Coryn Club">' +
      '      <i class="fas fa-search"></i> <span id="crysta-fetch-label">Cari di Coryn</span>' +
      '    </button>' +
      '  </div>' +
      '  <small id="crysta-fetch-info" style="display:none;font-size:0.68rem;color:var(--text-muted);margin-top:4px;"></small>' +
      '' +
      '  <label class="content-form-label">Tipe <span style="color:#ef4444;">*</span></label>' +
      '  <select id="crysta-input-type" class="content-form-input">' + typeOptions + '</select>' +
      '' +
      '  <label class="content-form-label">Upgrade Untuk (kosongkan kalau base)</label>' +
      '  <input type="text" id="crysta-input-upgrade" class="content-form-input" list="crysta-names-list" placeholder="Nama parent crysta" autocomplete="off">' +
      '  <datalist id="crysta-names-list">' + datalistOptions + '</datalist>' +
      '' +
      '  <label class="content-form-label">Stat <span style="color:#ef4444;">*</span></label>' +
      '  <textarea id="crysta-input-stat" class="content-form-textarea" rows="6" placeholder="Satu baris = satu stat&#10;Contoh:&#10;ATK +2%&#10;ASPD +1"></textarea>' +
      '  <small style="font-size:0.65rem;color:var(--text-muted);">Tekan Enter untuk baris baru.</small>' +
      '</div>';
  }
  
  function wireCrystaForm(isAdd) {
    const typeInput = document.getElementById('crysta-input-type');
    const nameInput = document.getElementById('crysta-input-name');
    const upgradeInput = document.getElementById('crysta-input-upgrade');
    const statInput = document.getElementById('crysta-input-stat');
    
    if (isAdd) {
      typeInput.value = 'weapon';
      nameInput.value = '';
      upgradeInput.value = '';
      statInput.value = '';
    } else {
      typeInput.value = state.currentItem.type;
      nameInput.value = state.currentItem.name;
      upgradeInput.value = state.currentItem.upgrade_for || '';
      statInput.value = state.currentItem.stat;
    }
    
    [typeInput, nameInput, upgradeInput, statInput].forEach(function(input) {
      input.addEventListener('input', checkDirty);
      input.addEventListener('change', checkDirty);
    });
    
    // Enter di field nama = trigger fetch Coryn
    if (nameInput) {
      nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.crystaFetchFromCoryn();
        }
      });
    }
  }
  
  function checkDirty() {
    const type = document.getElementById('crysta-input-type').value;
    const name = document.getElementById('crysta-input-name').value.trim();
    const upgrade = document.getElementById('crysta-input-upgrade').value.trim();
    const stat = document.getElementById('crysta-input-stat').value.trim();
    
    const btn = document.getElementById('crysta-save-btn');
    const label = document.getElementById('crysta-save-label');
    
    if (state.isAddMode) {
      const canSave = type && name && stat;
      if (btn) btn.disabled = !canSave;
      if (label) label.textContent = 'Simpan';
      return;
    }
    
    const dirty = 
      type !== state.originalForm.type ||
      name !== state.originalForm.name ||
      upgrade !== state.originalForm.upgrade_for ||
      stat !== state.originalForm.stat;
    
    state.isDirty = dirty;
    if (btn) btn.disabled = !dirty;
    if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
  }
  
  // ==========================================
  // FETCH CORYN
  // ==========================================
  window.crystaFetchFromCoryn = async function() {
    const nameInput = document.getElementById('crysta-input-name');
    const btn = document.getElementById('crysta-fetch-btn');
    const btnLabel = document.getElementById('crysta-fetch-label');
    const infoEl = document.getElementById('crysta-fetch-info');
    
    if (!nameInput || !btn) return;
    
    const name = nameInput.value.trim();
    if (!name) {
      window.showToast('❌ Isi nama crysta dulu', true);
      nameInput.focus();
      return;
    }
    
    const originalLabel = btnLabel.textContent;
    btn.disabled = true;
    btnLabel.textContent = 'Mencari...';
    if (infoEl) infoEl.style.display = 'none';
    
    try {
      const result = await gasCall('fetchCrystaFromCoryn', { name: name });
      
      if (result.status === 'success' && result.data) {
        const d = result.data;
        
        nameInput.value = d.name;
        document.getElementById('crysta-input-type').value = d.suggestedType;
        document.getElementById('crysta-input-upgrade').value = d.upgradeFor || '';
        document.getElementById('crysta-input-stat').value = d.statString;
        
        if (infoEl) {
          infoEl.style.display = 'block';
          const parentInfo = d.hasParent 
            ? ' • Parent: <strong>' + window.escapeHtml(d.upgradeFor || '(unknown)') + '</strong>'
            : ' • Base crysta';
          infoEl.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> ' +
            'Ditemukan: <strong>' + window.escapeHtml(d.name) + '</strong> (' + window.escapeHtml(d.typeLabel) + ')' + parentInfo;
        }
        
        window.showToast('✅ Data berhasil diambil dari Coryn');
        checkDirty();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal mencari'), true);
        if (infoEl) {
          infoEl.style.display = 'block';
          infoEl.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' +
            window.escapeHtml(result.message || 'Tidak ditemukan');
        }
      }
    } catch(e) {
      console.error('[CRYSTA] fetch error:', e);
      window.showToast('❌ Koneksi gagal', true);
    } finally {
      btn.disabled = false;
      btnLabel.textContent = originalLabel;
    }
  };
  
  // ==========================================
  // EDIT / ADD
  // ==========================================
  window.crystaOpenEdit = function(rowId) {
    const item = state.items.find(function(x) { return x.rowId === rowId; });
    if (!item) return;
    
    state.currentItem = item;
    state.isAddMode = false;
    state.originalForm = {
      type: item.type,
      name: item.name,
      upgrade_for: item.upgrade_for,
      stat: item.stat
    };
    state.isDirty = false;
    
    renderCrystaEditForm();
    if (typeof pushView === 'function') pushView('content-crysta-edit', { rowId: rowId });
  };
  
  window.renderCrystaEditForm = function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView || !state.currentItem) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.crystaBackFromForm()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">Edit Crysta</div>' +
      '  <div class="content-sub-actions">' +
      '    <button id="crysta-save-btn" class="content-sub-btn primary" onclick="window.crystaSaveEdit()" disabled>' +
      '      <i class="fas fa-save"></i> <span id="crysta-save-label">Tersimpan</span>' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body">' + buildCrystaFormHTML(false) + '</div>';
    
    wireCrystaForm(false);
  };
  
  window.crystaOpenAdd = function() {
    state.currentItem = null;
    state.isAddMode = true;
    state.originalForm = { type: 'weapon', name: '', upgrade_for: '', stat: '' };
    state.isDirty = false;
    
    renderCrystaAddForm();
    if (typeof pushView === 'function') pushView('content-crysta-add', {});
  };
  
  window.renderCrystaAddForm = function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.crystaBackFromForm()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">Tambah Crysta</div>' +
      '  <div class="content-sub-actions">' +
      '    <button id="crysta-save-btn" class="content-sub-btn primary" onclick="window.crystaSaveAdd()" disabled>' +
      '      <i class="fas fa-plus"></i> <span id="crysta-save-label">Simpan</span>' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body">' + buildCrystaFormHTML(true) + '</div>';
    
    wireCrystaForm(true);
  };
  
  // ==========================================
  // SAVE
  // ==========================================
  window.crystaSaveEdit = async function() {
    if (!state.currentItem) return;
    const btn = document.getElementById('crysta-save-btn');
    if (!btn || btn.disabled) return;
    
    const type = document.getElementById('crysta-input-type').value;
    const name = document.getElementById('crysta-input-name').value.trim();
    const upgradeFor = document.getElementById('crysta-input-upgrade').value.trim();
    const stat = document.getElementById('crysta-input-stat').value.trim();
    
    if (!name || !stat) { window.showToast('❌ Nama & stat wajib diisi', true); return; }
    
    btn.disabled = true;
    document.getElementById('crysta-save-label').textContent = 'Menyimpan...';
    
    try {
      const result = await gasCall('updateCrysta', {
        rowId: state.currentItem.rowId,
        type: type, name: name, upgrade_for: upgradeFor, stat: stat
      });
      
      if (result.status === 'success') {
        window.showToast('✅ ' + (result.message || 'Tersimpan'));
        state.originalForm = { type: type, name: name, upgrade_for: upgradeFor, stat: stat };
        state.isDirty = false;
        state.loaded = false;
        document.getElementById('crysta-save-label').textContent = 'Tersimpan';
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        document.getElementById('crysta-save-label').textContent = 'Simpan';
      }
    } catch(e) {
      console.error('[CRYSTA] save error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      document.getElementById('crysta-save-label').textContent = 'Simpan';
    }
  };
  
  window.crystaSaveAdd = async function() {
    const btn = document.getElementById('crysta-save-btn');
    if (!btn || btn.disabled) return;
    
    const type = document.getElementById('crysta-input-type').value;
    const name = document.getElementById('crysta-input-name').value.trim();
    const upgradeFor = document.getElementById('crysta-input-upgrade').value.trim();
    const stat = document.getElementById('crysta-input-stat').value.trim();
    
    if (!name || !stat) { window.showToast('❌ Nama & stat wajib diisi', true); return; }
    
    btn.disabled = true;
    document.getElementById('crysta-save-label').textContent = 'Menyimpan...';
    
    try {
      const result = await gasCall('addCrysta', {
        type: type, name: name, upgrade_for: upgradeFor, stat: stat
      });
      
      if (result.status === 'success') {
        window.showToast('✅ ' + (result.message || 'Ditambahkan'));
        state.loaded = false;
        closeCurrentView();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        document.getElementById('crysta-save-label').textContent = 'Simpan';
      }
    } catch(e) {
      console.error('[CRYSTA] add error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      document.getElementById('crysta-save-label').textContent = 'Simpan';
    }
  };
  
  // ==========================================
  // DELETE
  // ==========================================
  window.crystaOpenDelete = async function(rowId) {
    const item = state.items.find(function(x) { return x.rowId === rowId; });
    if (!item) return;
    
    const choice = await window.contentModal.show({
      title: 'Hapus crysta "' + window.escapeHtml(item.name) + '"?',
      desc: 'Item akan dihapus dari database. Kalau crysta ini parent dari crysta lain, penghapusan akan ditolak.',
      buttons: [
        { label: 'Ya, Hapus', style: 'danger', value: 'yes' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (choice !== 'yes') return;
    
    try {
      const result = await gasCall('deleteCrysta', { rowId: rowId });
      if (result.status === 'success') {
        window.showToast('✅ ' + result.message);
        state.loaded = false;
        await renderCrystaList();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal hapus'), true);
      }
    } catch(e) {
      console.error('[CRYSTA] delete error:', e);
      window.showToast('❌ Koneksi gagal', true);
    }
  };
  
  // ==========================================
  // BACK
  // ==========================================
  window.crystaBackFromForm = async function() {
    if (state.isDirty) {
      const choice = await window.contentModal.show({
        title: 'Ada perubahan belum disimpan',
        buttons: [
          { label: '💾 Simpan & Kembali', style: 'confirm', value: 'save' },
          { label: '🗑️ Buang Perubahan', style: 'danger', value: 'discard' },
          { label: 'Batal', style: 'cancel', value: 'cancel' }
        ]
      });
      
      if (choice === 'save') {
        if (state.isAddMode) await window.crystaSaveAdd();
        else await window.crystaSaveEdit();
        if (state.isDirty) return;
        closeCurrentView();
      } else if (choice === 'discard') {
        state.isDirty = false;
        closeCurrentView();
      }
    } else {
      closeCurrentView();
    }
  };
  
  console.log('✅ content-crysta.js loaded');
})();
