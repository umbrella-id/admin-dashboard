/**
 * content-informasi.js — Sub-view Informasi
 * 3 section: Headline (WYSIWYG), Openmember (WYSIWYG), Running Text (batch)
 */

(function() {
  const state = {
    loaded: false,
    headline: { timestamp: 0, header: '', body: '', originalHeader: '', originalBody: '' },
    openmember: { timestamp: 0, header: '', body: '', originalHeader: '', originalBody: '' },
    runningText: [], 
    originalRunningSnapshot: [],
    wysiwygHeadline: null,
    wysiwygOpenmember: null
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
  // LOAD DATA
  // ==========================================
  async function loadData() {
    const data = await gasCall('getAllContent');
    if (data.status !== 'success') throw new Error(data.message || 'Gagal load');
    
    const all = data.data || [];
    
    // Headline
    const h = all.find(function(x) { return x.ID && x.ID.toLowerCase() === 'headline'; });
    if (h) {
      state.headline = {
        timestamp: new Date(h.Timestamp).getTime(),
        header: (h.Header || '').toString(),
        body: (h.Body || '').toString(),
        originalHeader: (h.Header || '').toString(),
        originalBody: (h.Body || '').toString()
      };
    }
    
    // Openmember
    const o = all.find(function(x) { return x.ID && x.ID.toLowerCase() === 'openmember'; });
    if (o) {
      state.openmember = {
        timestamp: new Date(o.Timestamp).getTime(),
        header: (o.Header || '').toString(),
        body: (o.Body || '').toString(),
        originalHeader: (o.Header || '').toString(),
        originalBody: (o.Body || '').toString()
      };
    }
    
    // Running text — hanya ambil yang ada isinya, urut terlama di atas (ASC)
    const rt = all
      .filter(function(x) { 
        return x.ID && x.ID.toLowerCase() === 'running_text' && 
               x.Body && x.Body.toString().trim() !== ''; 
      })
      .sort(function(a, b) {
        const ta = new Date(a.Timestamp).getTime() || 0;
        const tb = new Date(b.Timestamp).getTime() || 0;
        return ta - tb;
      })
      .map(function(x) { return (x.Body || '').toString().trim(); });
    
    state.originalRunningSnapshot = rt.slice(); // Simpan patokan awal
    state.runningText = rt.map(function(b) { return { body: b, originalBody: b }; });
    
    state.loaded = true;
  }
  
  // ==========================================
  // RENDER
  // ==========================================
  window.renderInfoView = async function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">' +
      '    <i class="fas fa-arrow-left"></i>' +
      '  </button>' +
      '  <div class="content-sub-title">Informasi</div>' +
      '</div>' +
      '<div class="content-sub-body" id="info-body">' +
      '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
      '</div>';
    
    try {
      if (!state.loaded) await loadData();
      renderInfoSections();
    } catch (e) {
      console.error('[INFO] load error:', e);
      document.getElementById('info-body').innerHTML = 
        '<div class="content-placeholder"><i class="fas fa-exclamation-triangle" style="color:#f87171;"></i>' +
        '<p>Gagal memuat: ' + escapeHtml(e.message) + '</p></div>';
    }
  };
  
  function renderInfoSections() {
    const body = document.getElementById('info-body');
    if (!body) return;
    
    let html = '';
    
    // === HEADLINE ===
    html += '<div class="info-section">';
    html += '  <div class="info-section-header">';
    html += '    <div class="info-section-title">Headline</div>';
    html += '    <button id="headline-save-btn" class="content-sub-btn primary" onclick="window.infoSaveHeadline()" disabled>';
    html += '      <i class="fas fa-save"></i> <span id="headline-save-label">Tersimpan</span>';
    html += '    </button>';
    html += '  </div>';
    if (!state.headline.timestamp) {
      html += '  <div class="info-section-error">Row headline tidak ditemukan di sheet CONTENT.</div>';
    } else {
      html += '  <label class="content-form-label">Judul Banner</label>';
      html += '  <input type="text" id="headline-header" class="content-form-input" placeholder="Judul banner">';
      html += '  <label class="content-form-label">Isi Banner (WYSIWYG)</label>';
      html += '  <div id="headline-wysiwyg" class="wysiwyg-wrapper"></div>';
    }
    html += '</div>';
    
    // === OPENMEMBER ===
    html += '<div class="info-section">';
    html += '  <div class="info-section-header">';
    html += '    <div class="info-section-title">Open Member</div>';
    html += '    <button id="openmember-save-btn" class="content-sub-btn primary" onclick="window.infoSaveOpenmember()" disabled>';
    html += '      <i class="fas fa-save"></i> <span id="openmember-save-label">Tersimpan</span>';
    html += '    </button>';
    html += '  </div>';
    if (!state.openmember.timestamp) {
      html += '  <div class="info-section-error">Row openmember tidak ditemukan di sheet CONTENT.</div>';
    } else {
      html += '  <label class="content-form-label">Judul Banner</label>';
      html += '  <input type="text" id="openmember-header" class="content-form-input" placeholder="Judul banner">';
      html += '  <label class="content-form-label">Isi Banner (WYSIWYG)</label>';
      html += '  <div id="openmember-wysiwyg" class="wysiwyg-wrapper"></div>';
    }
    html += '</div>';
    
    // === RUNNING TEXT ===
    html += '<div class="info-section">';
    html += '  <div class="info-section-header">';
    html += '    <div class="info-section-title">Running Text <small id="runningtext-count" style="color:var(--text-muted);font-weight:400;"></small></div>';
    html += '    <button id="runningtext-save-btn" class="content-sub-btn primary" onclick="window.infoSaveRunningText()" disabled>';
    html += '      <i class="fas fa-save"></i> <span id="runningtext-save-label">Tersimpan</span>';
    html += '    </button>';
    html += '  </div>';
    html += '  <div id="runningtext-list" class="running-text-list"></div>';
    html += '  <button id="runningtext-add-btn" class="content-sub-btn" onclick="window.infoAddRunningText()" style="width:100%;margin-top:8px;justify-content:center;">';
    html += '    <i class="fas fa-plus"></i> Tambah Running Text';
    html += '  </button>';
    html += '</div>';
    
    body.innerHTML = html;
    
    // Wire section events
    if (state.headline.timestamp) wireHeadlineSection();
    if (state.openmember.timestamp) wireOpenmemberSection();
    wireRunningTextSection();
  }
  
  // ==========================================
  // HEADLINE SECTION
  // ==========================================
  function wireHeadlineSection() {
    const headerInput = document.getElementById('headline-header');
    headerInput.value = state.headline.header;
    headerInput.addEventListener('input', checkHeadlineDirty);
    
    state.wysiwygHeadline = window.ContentWysiwyg.create(
      document.getElementById('headline-wysiwyg'),
      {
        initialHtml: state.headline.body,
        context: 'headline',
        placeholder: 'Tulis isi banner di sini...',
        onChange: checkHeadlineDirty
      }
    );
  }
  
  function checkHeadlineDirty() {
    if (!state.wysiwygHeadline) return;
    const header = document.getElementById('headline-header').value;
    const body = state.wysiwygHeadline.getHTML();
    const dirty = header !== state.headline.originalHeader || body !== state.headline.originalBody;
    
    const btn = document.getElementById('headline-save-btn');
    const label = document.getElementById('headline-save-label');
    if (btn) btn.disabled = !dirty;
    if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
  }
  
  window.infoSaveHeadline = async function() {
    const btn = document.getElementById('headline-save-btn');
    const label = document.getElementById('headline-save-label');
    if (!btn || btn.disabled) return;
    
    const header = document.getElementById('headline-header').value;
    const body = state.wysiwygHeadline.getHTML();
    
    btn.disabled = true;
    if (label) label.textContent = 'Menyimpan...';
    
    try {
      const fields = JSON.stringify({ Header: header, Body: body });
      const result = await gasCall('updateContent', {
        timestamp: state.headline.timestamp,
        fields: fields
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Headline tersimpan');
        state.headline.originalHeader = header;
        state.headline.originalBody = body;
        if (label) label.textContent = 'Tersimpan';
        if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        if (label) label.textContent = 'Simpan';
      }
    } catch (e) {
      console.error('[INFO] headline save error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      if (label) label.textContent = 'Simpan';
    }
  };
  
  // ==========================================
  // OPENMEMBER SECTION
  // ==========================================
  function wireOpenmemberSection() {
    const headerInput = document.getElementById('openmember-header');
    headerInput.value = state.openmember.header;
    headerInput.addEventListener('input', checkOpenmemberDirty);
    
    state.wysiwygOpenmember = window.ContentWysiwyg.create(
      document.getElementById('openmember-wysiwyg'),
      {
        initialHtml: state.openmember.body,
        context: 'openmember',
        placeholder: 'Tulis isi banner open member...',
        onChange: checkOpenmemberDirty
      }
    );
  }
  
  function checkOpenmemberDirty() {
    if (!state.wysiwygOpenmember) return;
    const header = document.getElementById('openmember-header').value;
    const body = state.wysiwygOpenmember.getHTML();
    const dirty = header !== state.openmember.originalHeader || body !== state.openmember.originalBody;
    
    const btn = document.getElementById('openmember-save-btn');
    const label = document.getElementById('openmember-save-label');
    if (btn) btn.disabled = !dirty;
    if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
  }
  
  window.infoSaveOpenmember = async function() {
    const btn = document.getElementById('openmember-save-btn');
    const label = document.getElementById('openmember-save-label');
    if (!btn || btn.disabled) return;
    
    const header = document.getElementById('openmember-header').value;
    const body = state.wysiwygOpenmember.getHTML();
    
    btn.disabled = true;
    if (label) label.textContent = 'Menyimpan...';
    
    try {
      const fields = JSON.stringify({ Header: header, Body: body });
      const result = await gasCall('updateContent', {
        timestamp: state.openmember.timestamp,
        fields: fields
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Open Member tersimpan');
        state.openmember.originalHeader = header;
        state.openmember.originalBody = body;
        if (label) label.textContent = 'Tersimpan';
        if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        if (label) label.textContent = 'Simpan';
      }
    } catch (e) {
      console.error('[INFO] openmember save error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      if (label) label.textContent = 'Simpan';
    }
  };
  
  // ==========================================
  // RUNNING TEXT SECTION
  // ==========================================
  function wireRunningTextSection() {
    renderRunningTextList();
    updateRunningTextCount();
  }
  
  function renderRunningTextList() {
    const list = document.getElementById('runningtext-list');
    if (!list) return;
    
    if (state.runningText.length === 0) {
      list.innerHTML = '<div class="content-placeholder" style="padding:20px;">' +
        '<i class="fas fa-scroll"></i><p>Belum ada running text</p></div>';
      return;
    }
    
    let html = '';
    for (let i = 0; i < state.runningText.length; i++) {
      const item = state.runningText[i];
      const filled = (item.body || '').trim() !== '';
      html += 
        '<div class="running-text-item" data-index="' + i + '">' +
        '  <div class="running-text-content">' +
        '    <input type="text" class="running-text-input" value="' + escapeHtml(item.body) + '" ' +
        '           placeholder="Isi running text..." maxlength="200" ' +
        '           oninput="window.infoRunningTextInput(' + i + ', this.value)">' +
        '  </div>' +
        '  <button class="profil-icon-btn danger" onclick="window.infoDeleteRunningText(' + i + ')" title="Hapus">' +
        '    <i class="fas fa-trash"></i>' +
        '  </button>' +
        '</div>';
    }
    list.innerHTML = html;
  }
  
  function updateRunningTextCount() {
    const count = document.getElementById('runningtext-count');
    const addBtn = document.getElementById('runningtext-add-btn');
    const filled = state.runningText.filter(function(x) { return (x.body || '').trim() !== ''; }).length;
    const total = state.runningText.length;
    
    if (count) count.textContent = '(' + filled + '/10)';
    
    if (addBtn) {
      if (total >= 10) {
        addBtn.disabled = true;
        addBtn.style.opacity = '0.5';
      } else {
        addBtn.disabled = false;
        addBtn.style.opacity = '1';
      }
    }
  }
  
  window.infoRunningTextInput = function(index, value) {
    if (!state.runningText[index]) return;
    state.runningText[index].body = value;
    updateRunningTextCount();
    checkRunningTextDirty();
  };
  
  window.infoAddRunningText = function() {
    if (state.runningText.length >= 10) return;
    state.runningText.push({ body: '', originalBody: '' });
    renderRunningTextList();
    updateRunningTextCount();
    checkRunningTextDirty();
  };
  
  window.infoDeleteRunningText = async function(index) {
    const item = state.runningText[index];
    if (!item) return;
    
    const choice = await window.contentModal.show({
      title: 'Hapus running text ini?',
      desc: item.body ? '"' + escapeHtml(item.body.substring(0, 60)) + '"' : '(kosong)',
      buttons: [
        { label: 'Ya, Hapus', style: 'danger', value: 'yes' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (choice !== 'yes') return;
    
    state.runningText.splice(index, 1);
    renderRunningTextList();
    updateRunningTextCount();
    checkRunningTextDirty();
  };
  
  function checkRunningTextDirty() {
    const current = state.runningText
      .map(function(x) { return (x.body || '').trim(); })
      .filter(function(x) { return x !== ''; });
      
    const original = state.originalRunningSnapshot;
    
    const dirty = JSON.stringify(current) !== JSON.stringify(original);
    
    const btn = document.getElementById('runningtext-save-btn');
    const label = document.getElementById('runningtext-save-label');
    if (btn) btn.disabled = !dirty;
    if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
  }
  
  window.infoSaveRunningText = async function() {
    const btn = document.getElementById('runningtext-save-btn');
    const label = document.getElementById('runningtext-save-label');
    if (!btn || btn.disabled) return;
    
    // Build bodies array: oldest first (reverse of display order), compact (no empty gaps)
    const bodies = state.runningText
      .slice()
      .reverse()
      .map(function(x) { return (x.body || '').trim(); })
      .filter(function(x) { return x !== ''; });
    
    btn.disabled = true;
    if (label) label.textContent = 'Menyimpan...';
    
    try {
      const result = await gasCall('updateRunningTextBatch', {
        bodies: JSON.stringify(bodies)
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Running text tersimpan (' + bodies.length + ' item)');
        
        // REBUILD STATE (Hapus slot yang kosong dari memori)
        state.originalRunningSnapshot = bodies.slice();
        state.runningText = bodies.map(function(b) { 
            return { body: b, originalBody: b }; 
        });
        
        renderRunningTextList();
        updateRunningTextCount();
        checkRunningTextDirty();
        
        if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        if (label) label.textContent = 'Simpan';
      }
    } catch (e) {
      console.error('[INFO] runningtext save error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      if (label) label.textContent = 'Simpan';
    }
  };
  
  console.log('✅ content-informasi.js loaded');
})();
