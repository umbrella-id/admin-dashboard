/**
 * content-crysta.js — Crysta Management
 * - Grouped by type → chains
 * - Icons SVG berwarna per tipe
 * - Batch import by end xtal name
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
    originalForm: { type: 'weapon', name: '', upgrade_for: '', stat: '' },
    batchPreview: null
  };
  
  const TYPE_LABELS = {
    weapon: 'Weapon', armor: 'Armor', additional: 'Additional',
    special: 'Special', normal: 'Normal'
  };
  const TYPE_ORDER = ['weapon', 'armor', 'additional', 'special', 'normal'];
  
  // ==========================================
  // ICON HELPER
  // ==========================================
  function getTypeIcon(type, isBase, size) {
    if (typeof window.ciCrysta === 'function') {
      return window.ciCrysta(type, isBase, size || 20);
    }
    return '<i class="fas fa-gem"></i>';
  }
  
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
    
    const targets = new Set();
    items.forEach(function(i) {
      if (i.upgrade_for && i.upgrade_for !== '') targets.add(i.upgrade_for);
    });
    
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
      
      const chainNames = new Set(chain.map(function(c) { return c.name; }));
      let hasShared = false;
      for (let i = 0; i < chain.length; i++) {
        const outside = items.filter(function(x) {
          return x.upgrade_for === chain[i].name && !chainNames.has(x.name);
        });
        if (outside.length > 0) { hasShared = true; break; }
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
  // FETCH
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
  // RENDER LIST — grouped by type
  // ==========================================
  window.renderCrystaList = async function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">Crysta <small id="crysta-count" style="color:var(--text-muted);font-weight:400;"></small></div>' +
      '  <div class="content-sub-actions">' +
      '    <button class="content-sub-btn" onclick="window.crystaOpenAdd()"><i class="fas fa-plus"></i> Xtal</button>' +
      '    <button class="content-sub-btn primary" onclick="window.crystaOpenBatchImport()"><i class="fas fa-layer-group"></i> Import Chain</button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body" id="crysta-body">' +
      '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
      '</div>';
    
    try {
      await fetchCrystaItems(false);
      renderChainsGrouped();
    } catch (e) {
      console.error('[CRYSTA] load error:', e);
      document.getElementById('crysta-body').innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-exclamation-triangle" style="color:#f87171;"></i>' +
        '<p>Gagal memuat: ' + window.escapeHtml(e.message) + '</p></div>';
    }
  };
  
  function renderChainsGrouped() {
    const body = document.getElementById('crysta-body');
    const countEl = document.getElementById('crysta-count');
    if (!body) return;
    
    if (countEl) countEl.textContent = '(' + state.chains.length + ' chain)';
    
    if (state.chains.length === 0) {
      body.innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-gem"></i>' +
        '<p>Belum ada crysta</p>' +
        '<p style="font-size:0.75rem;opacity:0.7;margin-top:8px;">Klik "Import Chain" untuk mulai, atau "Xtal" untuk tambah satu-satu</p></div>';
      return;
    }
    
    const groups = {};
    TYPE_ORDER.forEach(function(t) { groups[t] = []; });
    state.chains.forEach(function(c) {
      const t = c.endNode.type;
      if (!groups[t]) groups[t] = [];
      groups[t].push(c);
    });
    
    let html = '';
    for (let ti = 0; ti < TYPE_ORDER.length; ti++) {
      const type = TYPE_ORDER[ti];
      const chains = groups[type];
      if (!chains || chains.length === 0) continue;
      
      chains.sort(function(a, b) { return a.endNode.name.localeCompare(b.endNode.name); });
      
      html += '<div class="crysta-type-section">';
      html += '  <div class="crysta-type-header">';
      html += '    <span class="crysta-type-title">' + getTypeIcon(type, true, 16) + ' ' + TYPE_LABELS[type] + '</span>';
      html += '    <span class="crysta-type-count">' + chains.length + '</span>';
      html += '  </div>';
      html += '  <div class="crysta-chain-grid">';
      
      for (let i = 0; i < chains.length; i++) {
        const chain = chains[i];
        const sharedMark = chain.hasShared ? ' <span class="crysta-chain-shared">⚠️</span>' : '';
        
        html += '<div class="crysta-chain-card" data-maxname="' + window.escapeHtml(chain.endNode.name) + '">';
        html += '  <div class="crysta-chain-icon">' + getTypeIcon(chain.endNode.type, false, 24) + '</div>';
        html += '  <div class="crysta-chain-body">';
        html += '    <div class="crysta-chain-name">' + window.escapeHtml(chain.endNode.name) + '</div>';
        html += '    <div class="crysta-chain-meta">' + chain.chainLength + ' xtal</div>';
        html += '    <div class="crysta-chain-base">base: ' + window.escapeHtml(chain.baseNode.name) + sharedMark + '</div>';
        html += '  </div>';
        html += '</div>';
      }
      
      html += '  </div>';
      html += '</div>';
    }
    
    body.innerHTML = html;
    
    body.querySelectorAll('.crysta-chain-card').forEach(function(card) {
      card.addEventListener('click', function() {
        window.crystaOpenChainDetail(card.dataset.maxname);
      });
    });
  }
  
  // ==========================================
  // CHAIN DETAIL
  // ==========================================
  window.crystaOpenChainDetail = function(maxNodeName) {
    const chain = state.chains.find(function(c) { return c.endNode.name === maxNodeName; });
    if (!chain) { window.showToast('❌ Chain tidak ditemukan', true); return; }
    state.currentChain = chain;
    renderChainDetail();
    if (typeof pushView === 'function') pushView('content-crysta-chain', { maxNodeName: maxNodeName });
  };
  
  window.renderCrystaChainDetail = function() {
    if (state.currentChain) renderChainDetail();
  };
  
  function renderChainDetail() {
    const subView = document.getElementById('content-view-sub');
    if (!subView || !state.currentChain) return;
    
    const chain = state.currentChain;
    const items = chain.chain;
    const allItems = state.items;
    const chainNames = new Set(items.map(function(i) { return i.name; }));
    
    let html = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.crystaBackFromChain()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">' +
      '    ' + window.escapeHtml(chain.endNode.name) +
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
      const typeLabel = TYPE_LABELS[node.type] || node.type;
      
      const outside = allItems.filter(function(x) {
        return x.upgrade_for === node.name && !chainNames.has(x.name);
      });
      const isShared = outside.length > 0;
      
      let markers = '';
      if (isMax) markers += '<span class="crysta-chain-badge max">MAX</span>';
      if (isBase) markers += '<span class="crysta-chain-badge base">BASE</span>';
      if (isShared) markers += '<span class="crysta-chain-badge shared">SHARED</span>';
      
      let sharedInfo = '';
      if (isShared) {
        sharedInfo = '<div class="crysta-chain-shared-info">⚠️ Dipakai juga oleh: ' + 
          outside.map(function(c) { return window.escapeHtml(c.name); }).join(', ') + '</div>';
      }
      
      const statPreview = (node.stat || '').replace(/\n/g, ' • ');
      const statTrunc = statPreview.length > 100 ? statPreview.substring(0, 100) + '...' : statPreview;
      
      html += 
        '<div class="crysta-chain-node">' +
        '  <div class="crysta-chain-node-header">' +
        '    <div class="crysta-chain-node-icon">' + getTypeIcon(node.type, isBase, 20) + '</div>' +
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
    closeCurrentView();
  };
  
  // ==========================================
  // DELETE CHAIN
  // ==========================================
  window.crystaDeleteChain = async function() {
    if (!state.currentChain) return;
    
    const maxNodeName = state.currentChain.endNode.name;
    const items = state.items;
    const map = {};
    items.forEach(function(i) { map[i.name] = i; });
    
    // Rebuild chain fresh (end → base)
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
    
    const chainNames = new Set(chain.map(function(c) { return c.name; }));
    
    // === Step 1: Cari node yang punya outside child (harus keep) ===
    const mustKeep = new Set();
    const usedByMap = {};
    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const outside = items.filter(function(x) {
        return x.upgrade_for === node.name && !chainNames.has(x.name);
      });
      if (outside.length > 0) {
        mustKeep.add(node.name);
        usedByMap[node.name] = outside.map(function(c) { return c.name; });
      }
    }
    
    // === Step 2: Propagate → semua ancestor dari mustKeep juga harus keep ===
    const keptSet = new Set();
    for (let i = 0; i < chain.length; i++) {
      if (mustKeep.has(chain[i].name)) {
        // Mark node ini + semua ancestor (parent-side = index lebih besar)
        for (let j = i; j < chain.length; j++) {
          keptSet.add(chain[j].name);
        }
      }
    }
    
    // === Step 3: Build safe & kept ===
    const safe = [];
    const kept = [];
    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      if (!keptSet.has(node.name)) {
        safe.push(node.name);
        continue;
      }
      const ownOutside = usedByMap[node.name] || [];
      const inChainChild = (i > 0 && keptSet.has(chain[i - 1].name)) ? chain[i - 1].name : null;
      
      let reason = '';
      if (ownOutside.length > 0 && inChainChild) {
        reason = ownOutside.join(', ') + ', ' + inChainChild;
      } else if (ownOutside.length > 0) {
        reason = ownOutside.join(', ');
      } else if (inChainChild) {
        reason = inChainChild;
      }
      kept.push({ name: node.name, reason: reason });
    }
    
    if (safe.length === 0) {
      window.showToast('⚠️ Semua dipakai chain lain (tidak ada yang bisa dihapus)', true);
      return;
    }
    
    let desc = '<strong>Akan DIHAPUS (' + safe.length + '):</strong><br>' +
      safe.map(function(n) { return '• ' + window.escapeHtml(n); }).join('<br>');
    if (kept.length > 0) {
      desc += '<br><br><strong>DIPERTAHANKAN (' + kept.length + '):</strong><br>' +
        kept.map(function(k) {
          return '• ' + window.escapeHtml(k.name) + ' <em>(dibutuhkan: ' + window.escapeHtml(k.reason) + ')</em>';
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
      const result = await gasCall('deleteCrystaBatch', { names: JSON.stringify(safe) });
      if (result.status === 'success') {
        window.showToast('✅ ' + safe.length + ' xtal dihapus');
        state.loaded = false;
        state.currentChain = null;
        closeCurrentView();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
      }
    } catch(e) {
      window.showToast('❌ Koneksi gagal', true);
    }
  };
  
  // ==========================================
  // BATCH IMPORT — SUB-VIEW
  // ==========================================
  window.crystaOpenBatchImport = function() {
    state.batchPreview = null;
    renderBatchImportForm();
    if (typeof pushView === 'function') pushView('content-crysta-batch', {});
  };
  
  window.renderCrystaBatchImportForm = function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.crystaBackFromBatch()"><i class="fas fa-arrow-left"></i></button>' +
      '  <div class="content-sub-title">Import Chain</div>' +
      '</div>' +
      '<div class="content-sub-body">' +
      '  <div class="content-form">' +
      '    <label class="content-form-label">Nama Xtal Akhir <span style="color:#ef4444;">*</span></label>' +
      '    <input type="text" id="crysta-batch-name" class="content-form-input" placeholder="Contoh: Wiltileaf, Diark, Ganglef" autocomplete="off">' +
      '    <label class="content-form-label" style="margin-top:8px;">Coryn ID (opsional)</label>' +
      '    <input type="number" id="crysta-batch-coryn-id" class="content-form-input" placeholder="Isi kalau nama tidak ketemu">' +
      '    <small style="font-size:0.68rem;color:var(--text-muted);margin-top:4px;">Sistem akan melacak chain dari Xtal akhir ini sampai base, lalu import semua yang belum ada.</small>' +
      '    <button type="button" id="crysta-batch-preview-btn" class="content-sub-btn primary" onclick="window.crystaPreviewBatch()" style="margin-top:12px;justify-content:center;">' +
      '      <i class="fas fa-search"></i> <span id="crysta-batch-preview-label">Preview Chain</span>' +
      '    </button>' +
      '    <div id="crysta-batch-preview-area" style="margin-top:16px;"></div>' +
      '  </div>' +
      '</div>';
  };
  
  window.crystaPreviewBatch = async function() {
    const nameInput = document.getElementById('crysta-batch-name');
    const idInput = document.getElementById('crysta-batch-coryn-id');
    const btn = document.getElementById('crysta-batch-preview-btn');
    const label = document.getElementById('crysta-batch-preview-label');
    const area = document.getElementById('crysta-batch-preview-area');
    
    const name = nameInput.value.trim();
    const corynId = idInput.value.trim();
    
    if (!name && !corynId) {
      window.showToast('❌ Isi nama xtal akhir', true);
      nameInput.focus();
      return;
    }
    
    const origLabel = label.textContent;
    btn.disabled = true;
    label.textContent = 'Mencari...';
    area.innerHTML = '<div class="content-placeholder" style="padding:20px;"><i class="fas fa-spinner fa-spin"></i> Memuat chain...</div>';
    
    try {
      const result = await gasCall('fetchCrystaChainFromCoryn', { name: name, corynId: corynId });
      
      if (result.status !== 'success' || !result.data || !result.data.chain) {
        area.innerHTML = '<div class="content-placeholder" style="padding:20px;"><i class="fas fa-times-circle" style="color:#f87171;"></i><p>' + window.escapeHtml(result.message || 'Gagal') + '</p></div>';
        return;
      }
      
      state.batchPreview = result.data.chain;
      const reversed = state.batchPreview.slice().reverse();
      const existingNames = new Set(state.items.map(function(i) { return i.name; }));
      
      let newCount = 0, existingCount = 0;
      let previewHtml = '<div style="background:rgba(168,85,247,0.08);border:1px solid var(--border-line);border-radius:10px;padding:12px;">';
      previewHtml += '<div style="font-size:0.8rem;font-weight:600;color:white;margin-bottom:10px;">Chain ' + state.batchPreview.length + ' xtal (base → end)</div>';
      
      for (let i = 0; i < reversed.length; i++) {
        const node = reversed[i];
        const isExisting = existingNames.has(node.name);
        if (isExisting) existingCount++; else newCount++;
        
        const isBase = i === 0;
        const isEnd = i === reversed.length - 1;
        let badge = '';
        if (isExisting) badge = '<span style="background:rgba(100,116,139,0.3);color:#94a3b8;padding:2px 8px;border-radius:10px;font-size:0.6rem;margin-left:6px;">SUDAH ADA</span>';
        else if (isBase) badge = '<span style="background:rgba(100,116,139,0.3);color:#94a3b8;padding:2px 8px;border-radius:10px;font-size:0.6rem;margin-left:6px;">BASE</span>';
        else if (isEnd) badge = '<span style="background:rgba(168,85,247,0.2);color:#c084fc;padding:2px 8px;border-radius:10px;font-size:0.6rem;margin-left:6px;">END</span>';
        
        previewHtml += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);' + (isExisting ? 'opacity:0.5;' : '') + '">';
        previewHtml += getTypeIcon(node.type, isBase, 18);
        previewHtml += '<span style="color:white;font-size:0.82rem;">' + window.escapeHtml(node.name) + '</span>';
        previewHtml += badge;
        previewHtml += '</div>';
      }
      previewHtml += '</div>';
      
      if (newCount === 0) {
        previewHtml += '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:0.8rem;">Semua xtal sudah ada di database.</div>';
      } else {
        previewHtml += '<div style="text-align:center;margin-top:12px;">';
        previewHtml += '<button class="content-sub-btn primary" onclick="window.crystaConfirmBatchImport()" style="justify-content:center;width:100%;">';
        previewHtml += '<i class="fas fa-download"></i> Import ' + newCount + ' Xtal' + (existingCount > 0 ? ' (skip ' + existingCount + ')' : '');
        previewHtml += '</button></div>';
      }
      
      area.innerHTML = previewHtml;
      
    } catch(e) {
      console.error('[CRYSTA BATCH] preview error:', e);
      area.innerHTML = '<div class="content-placeholder" style="padding:20px;color:#f87171;">Koneksi gagal</div>';
    } finally {
      btn.disabled = false;
      label.textContent = origLabel;
    }
  };
  
  window.crystaConfirmBatchImport = async function() {
    if (!state.batchPreview || !state.batchPreview.length) return;
    
    const btn = document.querySelector('#crysta-batch-preview-area button.content-sub-btn.primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengimport...'; }
    
    try {
      const result = await gasCall('addCrystaChainBatch', {
        chain: JSON.stringify(state.batchPreview)
      });
      
      if (result.status === 'success') {
        window.showToast('✅ ' + result.message);
        state.loaded = false;
        state.batchPreview = null;
        closeCurrentView();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Coba Lagi'; }
      }
    } catch(e) {
      window.showToast('❌ Koneksi gagal', true);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Coba Lagi'; }
    }
  };
  
  window.crystaBackFromBatch = function() {
    state.batchPreview = null;
    closeCurrentView();
  };
  
  // ==========================================
  // FORM (single add/edit)
  // ==========================================
  function buildCrystaFormHTML(isAdd) {
    let typeOptions = '';
    for (let i = 0; i < TYPE_ORDER.length; i++) {
      typeOptions += '<option value="' + TYPE_ORDER[i] + '">' + TYPE_LABELS[TYPE_ORDER[i]] + '</option>';
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
      '      <i class="fas fa-search"></i> <span id="crysta-fetch-label">Cari</span>' +
      '    </button>' +
      '  </div>' +
      '  <label class="content-form-label" style="margin-top:8px;">Coryn ID (opsional)</label>' +
      '  <input type="number" id="crysta-input-coryn-id" class="content-form-input" placeholder="Isi kalau nama tidak ketemu">' +
      '  <small id="crysta-fetch-info" style="display:none;font-size:0.68rem;color:var(--text-muted);margin-top:4px;"></small>' +
      '  <label class="content-form-label">Tipe <span style="color:#ef4444;">*</span></label>' +
      '  <select id="crysta-input-type" class="content-form-input">' + typeOptions + '</select>' +
      '  <label class="content-form-label">Upgrade Untuk (kosongkan kalau base)</label>' +
      '  <input type="text" id="crysta-input-upgrade" class="content-form-input" list="crysta-names-list" placeholder="Nama parent crysta" autocomplete="off">' +
      '  <datalist id="crysta-names-list">' + datalistOptions + '</datalist>' +
      '  <label class="content-form-label">Stat <span style="color:#ef4444;">*</span></label>' +
      '  <textarea id="crysta-input-stat" class="content-form-textarea" rows="6"></textarea>' +
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
  
  window.crystaFetchFromCoryn = async function() {
    const nameInput = document.getElementById('crysta-input-name');
    const idInput = document.getElementById('crysta-input-coryn-id');
    const btn = document.getElementById('crysta-fetch-btn');
    const btnLabel = document.getElementById('crysta-fetch-label');
    const infoEl = document.getElementById('crysta-fetch-info');
    
    const name = nameInput.value.trim();
    const corynId = idInput ? idInput.value.trim() : '';
    
    if (!name && !corynId) {
      window.showToast('❌ Isi nama atau Coryn ID', true);
      nameInput.focus();
      return;
    }
    
    const origLabel = btnLabel.textContent;
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
            ? ' • Parent: <strong>' + window.escapeHtml(d.upgradeFor || '?') + '</strong>' 
            : ' • Base';
          infoEl.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> ' +
            'Ditemukan: <strong>' + window.escapeHtml(d.name) + '</strong>' + parentInfo;
        }
        window.showToast('✅ Data dari Coryn');
        checkDirty();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        if (infoEl) {
          infoEl.style.display = 'block';
          infoEl.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + window.escapeHtml(result.message || 'Tidak ditemukan');
        }
      }
    } catch(e) {
      window.showToast('❌ Koneksi gagal', true);
    } finally {
      btn.disabled = false;
      btnLabel.textContent = origLabel;
    }
  };
  
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
  
  window.crystaSaveEdit = async function() {
    if (!state.currentItem) return;
    const btn = document.getElementById('crysta-save-btn');
    if (!btn || btn.disabled) return;
    
    const type = document.getElementById('crysta-input-type').value;
    const name = document.getElementById('crysta-input-name').value.trim();
    const upgradeFor = document.getElementById('crysta-input-upgrade').value.trim();
    const stat = document.getElementById('crysta-input-stat').value.trim();
    
    if (!name || !stat) { window.showToast('❌ Nama & stat wajib', true); return; }
    
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
    
    if (!name || !stat) { window.showToast('❌ Nama & stat wajib', true); return; }
    
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
  
  window.crystaBackFromForm = async function() {
    if (state.isDirty) {
      const choice = await window.contentModal.show({
        title: 'Ada perubahan belum disimpan',
        buttons: [
          { label: '💾 Simpan & Kembali', style: 'confirm', value: 'save' },
          { label: '🗑️ Buang', style: 'danger', value: 'discard' },
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
  
  console.log('✅ content-crysta.js loaded (grouped + SVG icons + batch import)');
})();
