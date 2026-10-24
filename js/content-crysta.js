/**
 * content-crysta.js — Crysta Management
 * List grouped by end xtal (final/max), chain detail view, delete per-chain.
 */

(function() {
  const state = {
    items: [],
    chains: [],
    loaded: false,
    currentChain: null,
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
  
  // ==========================================
  // API HELPER
  // ==========================================
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
  
  // ==========================================
  // BUILD CHAINS
  // ==========================================
  function buildChains(items) {
    const map = {};
    items.forEach(function(i) { map[i.name] = i; });
    
    // Kumpulkan semua parent yang dipakai
    const targets = new Set();
    items.forEach(function(i) {
      if (i.upgrade_for && i.upgrade_for !== '') targets.add(i.upgrade_for);
    });
    
    // Max nodes = xtal yang TIDAK punya child (bukan parent untuk siapapun)
    const maxNodes = items.filter(function(i) { return !targets.has(i.name); });
    
    const chains = [];
    maxNodes.forEach(function(maxNode) {
      const chain = [];
      let current = maxNode;
      const visited = new Set();
      
      while (current) {
        if (visited.has(current.name)) break;
        visited.add(current.name);
        chain.push(current);
        if (!current.upgrade_for) break;
        current = map[current.upgrade_for];
        if (!current) break;
      }
      
      // Cek branched: apakah ada node di chain ini punya child di luar chain?
      const chainNames = new Set(chain.map(function(c) { return c.name; }));
      let hasShared = false;
      for (let i = 0; i < chain.length; i++) {
        const node = chain[i];
        const outsideChildren = items.filter(function(x) {
          return x.upgrade_for === node.name && !chainNames.has(x.name);
        });
        if (outsideChildren.length > 0) { hasShared = true; break; }
      }
      
      chains.push({
        endNode: maxNode,
        chain: chain,
        chainLength: chain.length,
        baseNode: chain[chain.length - 1],
        hasShared: hasShared
      });
    });
    
    return chains;
  }
  
  // ==========================================
  // FETCH DATA
  // ==========================================
  async function fetchCrystaItems(force) {
    if (!force && state.loaded) return state.items;
    const data = await gasCall('getAllCrysta');
    if (data.status !== 'success') throw new Error(data.message || 'Gagal load');
    state.items = data.data || [];
    state.chains = buildChains(state.items);
    state.loaded = true;
    return state.items;
  }
  
  // ==========================================
  // RENDER LIST — GRID OF CHAINS
  // ==========================================
  window.renderCrystaList = async function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">Crysta <small id="crysta-count" style="color:var(--text-muted);font-weight:400;"></small></div>' +
      '  <div class="content-sub-actions">' +
      '    <button class="content-sub-btn primary" onclick="window.crystaOpenAdd()"><i class="fas fa-plus"></i> Tambah</button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body" id="crysta-body">' +
      '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
      '</div>';
    
    try {
      await fetchCrystaItems(false);
      renderChainsGrid();
    } catch (e) {
      console.error('[CRYSTA] load error:', e);
      document.getElementById('crysta-body').innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-exclamation-triangle" style="color:#f87171;"></i>' +
        '<p>Gagal memuat: ' + window.escapeHtml(e.message) + '</p></div>';
    }
  };
  
  function renderChainsGrid() {
    const body = document.getElementById('crysta-body');
    const countEl = document.getElementById('crysta-count');
    if (!body) return;
    
    if (countEl) countEl.textContent = '(' + state.chains.length + ' chain)';
    
    if (state.chains.length === 0) {
      body.innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-gem"></i>' +
        '<p>Belum ada crysta</p>' +
        '<p style="font-size:0.75rem;opacity:0.7;margin-top:8px;">Klik "Tambah" untuk membuat item pertama</p></div>';
      return;
    }
    
    const sorted = state.chains.slice().sort(function(a, b) {
      return a.endNode.name.localeCompare(b.endNode.name);
    });
    
    let html = '<div class="crysta-chain-grid">';
    for (let i = 0; i < sorted.length; i++) {
      const chain = sorted[i];
      const type = chain.endNode.type;
      const typeLabel = TYPE_LABELS[type] || type;
      const typeIcon = TYPE_ICONS[type] || 'fa-circle';
      const sharedMark = chain.hasShared ? ' <span class="crysta-chain-shared">⚠️</span>' : '';
      
      html += '<div class="crysta-chain-card" data-maxname="' + window.escapeHtml(chain.endNode.name) + '">';
      html += '  <div class="crysta-chain-icon"><i class="fas ' + typeIcon + '"></i></div>';
      html += '  <div class="crysta-chain-body">';
      html += '    <div class="crysta-chain-name">' + window.escapeHtml(chain.endNode.name) + '</div>';
      html += '    <div class="crysta-chain-meta">' + chain.chainLength + ' xtal • ' + typeLabel + '</div>';
      html += '    <div class="crysta-chain-base">base: ' + window.escapeHtml(chain.baseNode.name) + sharedMark + '</div>';
      html += '  </div>';
      html += '</div>';
    }
    html += '</div>';
    
    body.innerHTML = html;
    
    // Attach click listeners
    body.querySelectorAll('.crysta-chain-card').forEach(function(card) {
      card.addEventListener('click', function() {
        window.crystaOpenChainDetail(card.dataset.maxname);
      });
    });
  }
  
  // ==========================================
  // RENDER CHAIN DETAIL (Menu 2)
  // ==========================================
  window.crystaOpenChainDetail = function(maxNodeName) {
    const chain = state.chains.find(function(c) { return c.endNode.name === maxNodeName; });
    if (!chain) {
      window.showToast('❌ Chain tidak ditemukan', true);
      return;
    }
    
    state.currentChain = chain;
    renderChainDetail();
    
    if (typeof pushView === 'function') {
      pushView('content-crysta-chain', { maxNodeName: maxNodeName });
    }
  };
  
  window.renderCrystaChainDetail = function() {
    if (!state.currentChain) return;
    renderChainDetail();
  };
  
  function renderChainDetail() {
    const subView = document.getElementById('content-view-sub');
    if (!subView || !state.currentChain) return;
    
    const chain = state.currentChain;
    const maxNodeName = chain.endNode.name;
    const items = chain.chain;
    const allItems = state.items;
    const chainNames = new Set(items.map(function(i) { return i.name; }));
    
    let html = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.crystaBackFromChain()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">' +
      '    ' + window.escapeHtml(maxNodeName) +
      '    <small style="color:var(--text-muted);font-weight:400;"> • ' + chain.chainLength + ' xtal</small>' +
      '  </div>' +
      '  <div class="content-sub-actions">' +
      '    <button class="content-sub-btn danger" onclick="window.crystaDeleteChain()"><i class="fas fa-trash"></i> Hapus Chain</button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body">';
    
    for (let i = 0; i < items.length; i++) {
      const node = items[i];
      const isMax = i === 0;
      const isBase = i === items.length - 1;
      const type = node.type;
      const typeLabel = TYPE_LABELS[type] || type;
      const typeIcon = TYPE_ICONS[type] || 'fa-circle';
      
      // Cek shared
      const outsideChildren = allItems.filter(function(x) {
        return x.upgrade_for === node.name && !chainNames.has(x.name);
      });
      const isShared = outsideChildren.length > 0;
      
      let markers = '';
      if (isMax) markers += '<span class="crysta-chain-badge max">MAX</span>';
      if (isBase) markers += '<span class="crysta-chain-badge base">BASE</span>';
      if (isShared) markers += '<span class="crysta-chain-badge shared">SHARED</span>';
      
      let sharedInfo = '';
      if (isShared) {
        sharedInfo = '<div class="crysta-chain-shared-info">⚠️ Dipakai juga oleh: ' + 
          outsideChildren.map(function(c) { return window.escapeHtml(c.name); }).join(', ') + '</div>';
      }
      
      const statPreview = (node.stat || '').replace(/\n/g, ' • ');
      const statTrunc = statPreview.length > 100 ? statPreview.substring(0, 100) + '...' : statPreview;
      
      html += 
        '<div class="crysta-chain-node">' +
        '  <div class="crysta-chain-node-header">' +
        '    <div class="crysta-chain-node-icon"><i class="fas ' + typeIcon + '"></i></div>' +
        '    <div class="crysta-chain-node-title">' + window.escapeHtml(node.name) + ' ' + markers + '</div>' +
        '    <button class="profil-icon-btn" onclick="window.crystaOpenEdit(' + node.rowId + ')" title="Edit"><i class="fas fa-pen"></i></button>' +
        '  </div>' +
        '  <div class="crysta-chain-node-type">' + typeLabel + '</div>' +
        '  <div class="crysta-chain-node-stat">' + window.escapeHtml(statTrunc) + '</div>' +
        '  ' + sharedInfo +
        '</div>';
      
      if (i < items.length - 1) {
        html += '<div class="crysta-chain-arrow"><i class="fas fa-arrow-up"></i> upgrade dari</div>';
      }
    }
    
    html += '</div>';
    subView.innerHTML = html;
  }
  
  window.crystaBackFromChain = function() {
    state.currentChain = null;
    if (typeof closeCurrentView === 'function') {
      closeCurrentView();
    } else {
      window.renderCrystaList();
    }
  };
  
  // ==========================================
  // DELETE CHAIN (with skip logic)
  // ==========================================
  window.crystaDeleteChain = async function() {
    if (!state.currentChain) return;
    
    const maxNodeName = state.currentChain.endNode.name;
    const items = state.items;
    const map = {};
    items.forEach(function(i) { map[i.name] = i; });
    
    // Build chain lagi (fresh)
    const chain = [];
    let current = map[maxNodeName];
    const visited = new Set();
    while (current) {
      if (visited.has(current.name)) break;
      visited.add(current.name);
      chain.push(current);
      if (!current.upgrade_for) break;
      current = map[current.upgrade_for];
      if (!current) break;
    }
    
    // Tentukan safe vs kept
    const chainNames = new Set(chain.map(function(c) { return c.name; }));
    const safe = [];
    const kept = [];
    
    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const outsideChildren = items.filter(function(x) {
        return x.upgrade_for === node.name && !chainNames.has(x.name);
      });
      
      if (outsideChildren.length > 0) {
        kept.push({ name: node.name, usedBy: outsideChildren.map(function(c) { return c.name; }) });
      } else {
        safe.push(node.name);
      }
    }
    
    if (safe.length === 0) {
      window.showToast('⚠️ Tidak ada yang bisa dihapus (semua dipakai chain lain)', true);
      return;
    }
    
    let desc = '';
    if (safe.length > 0) {
      desc += '<strong>Akan DIHAPUS (' + safe.length + '):</strong><br>';
      desc += safe.map(function(n) { return '• ' + window.escapeHtml(n); }).join('<br>');
    }
    if (kept.length > 0) {
      desc += '<br><br><strong>Akan DIPERTAHANKAN (' + kept.length + '):</strong><br>';
      desc += kept.map(function(k) {
        return '• ' + window.escapeHtml(k.name) + ' <em>(dipakai: ' + window.escapeHtml(k.usedBy.join(', ')) + ')</em>';
      }).join('<br>');
    }
    
    const choice = await window.contentModal.show({
      title: 'Hapus Chain "' + window.escapeHtml(maxNodeName) + '"?',
      desc: desc,
      buttons: [
        { label: 'Ya, Hapus ' + safe.length, style: 'danger', value: 'yes' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (choice !== 'yes') return;
    
    try {
      const result = await gasCall('deleteCrystaBatch', {
        names: JSON.stringify(safe)
      });
      
      if (result.status === 'success') {
        window.showToast('✅ ' + safe.length + ' xtal dihapus');
        state.loaded = false;
        state.currentChain = null;
        if (typeof closeCurrentView === 'function') closeCurrentView();
        else window.renderCrystaList();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
      }
    } catch(e) {
      console.error('[CRYSTA] delete error:', e);
      window.showToast('❌ Koneksi gagal', true);
    }
  };
  
  // ==========================================
  // FORM BUILD (edit / add)
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
      '    <button type="button" id="crysta-fetch-btn" class="content-sub-btn" onclick="window.crystaFetchFromCoryn()" style="flex-shrink:0;">' +
      '      <i class="fas fa-search"></i> <span id="crysta-fetch-label">Cari di Coryn</span>' +
      '    </button>' +
      '  </div>' +
      '  <label class="content-form-label" style="margin-top:8px;">Coryn ID (opsional)</label>' +
      '  <input type="number" id="crysta-input-coryn-id" class="content-form-input" placeholder="Isi kalau nama tidak ketemu">' +
      '  <small id="crysta-fetch-info" style="display:none;font-size:0.68rem;color:var(--text-muted);margin-top:4px;"></small>' +
      '  ' +
      '  <label class="content-form-label">Tipe <span style="color:#ef4444;">*</span></label>' +
      '  <select id="crysta-input-type" class="content-form-input">' + typeOptions + '</select>' +
      '  ' +
      '  <label class="content-form-label">Upgrade Untuk (kosongkan kalau base)</label>' +
      '  <input type="text" id="crysta-input-upgrade" class="content-form-input" list="crysta-names-list" placeholder="Nama parent crysta" autocomplete="off">' +
      '  <datalist id="crysta-names-list">' + datalistOptions + '</datalist>' +
      '  ' +
      '  <label class="content-form-label">Stat <span style="color:#ef4444;">*</span></label>' +
      '  <textarea id="crysta-input-stat" class="content-form-textarea" rows="6" placeholder="Satu baris = satu stat"></textarea>' +
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
    
    if (nameInput) {
      nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); window.crystaFetchFromCoryn(); }
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
    const idInput = document.getElementById('crysta-input-coryn-id');
    const btn = document.getElementById('crysta-fetch-btn');
    const btnLabel = document.getElementById('crysta-fetch-label');
    const infoEl = document.getElementById('crysta-fetch-info');
    
    if (!nameInput || !btn) return;
    
    const name = nameInput.value.trim();
    const corynId = idInput ? idInput.value.trim() : '';
    
    if (!name && !corynId) {
      window.showToast('❌ Isi nama atau Coryn ID dulu', true);
      nameInput.focus();
      return;
    }
    
    const originalLabel = btnLabel.textContent;
    btn.disabled = true;
    btnLabel.textContent = 'Mencari...';
    if (infoEl) infoEl.style.display = 'none';
    
    try {
      const result = await gasCall('fetchCrystaFromCoryn', { name: name, corynId: corynId });
      
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
            : ' • Base';
          infoEl.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> ' +
            'Ditemukan: <strong>' + window.escapeHtml(d.name) + '</strong> (' + window.escapeHtml(d.typeLabel) + ')' + parentInfo;
        }
        
        window.showToast('✅ Data berhasil diambil dari Coryn');
        checkDirty();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal mencari'), true);
        if (infoEl) {
          infoEl.style.display = 'block';
          infoEl.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + window.escapeHtml(result.message || 'Tidak ditemukan');
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
  // EDIT
  // ==========================================
  window.crystaOpenEdit = function(rowId) {
    const item = state.items.find(function(x) { return x.rowId === rowId; });
    if (!item) return;
    
    state.currentItem = item;
    state.isAddMode = false;
    state.originalForm = {
      type: item.type, name: item.name, upgrade_for: item.upgrade_for, stat: item.stat
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
      '    <button id="crysta-save-btn" class="content-sub-btn primary" onclick="window.crystaSaveEdit()" disabled><i class="fas fa-save"></i> <span id="crysta-save-label">Tersimpan</span></button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body">' + buildCrystaFormHTML(false) + '</div>';
    
    wireCrystaForm(false);
  };
  
  // ==========================================
  // ADD
  // ==========================================
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
      '    <button id="crysta-save-btn" class="content-sub-btn primary" onclick="window.crystaSaveAdd()" disabled><i class="fas fa-plus"></i> <span id="crysta-save-label">Simpan</span></button>' +
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
        rowId: state.currentItem.rowId, type: type, name: name, upgrade_for: upgradeFor, stat: stat
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Tersimpan');
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
        window.showToast('✅ Ditambahkan');
        state.loaded = false;
        closeCurrentView();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        document.getElementById('crysta-save-label').textContent = 'Simpan';
      }
    } catch(e) {
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      document.getElementById('crysta-save-label').textContent = 'Simpan';
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
  
  console.log('✅ content-crysta.js loaded (chain-grouped)');
})();
