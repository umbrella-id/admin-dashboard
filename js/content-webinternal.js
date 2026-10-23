/**
 * content-webinternal.js — Sub-view Web Internal (Gate Settings)
 * Hanya 2 field: pertanyaan + jawaban gate
 * Khusus leader (server-side sudah dibatasi ACTION_ROLES)
 */

(function() {
  const state = {
    loaded: false,
    question: '',
    code: '',
    originalQuestion: '',
    originalCode: '',
    isDirty: false
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
  // FETCH SETTINGS
  // ==========================================
  async function fetchSettings(force) {
    if (!force && state.loaded) return;
    
    const data = await gasCall('getGateSettings');
    if (data.status !== 'success') throw new Error(data.message || 'Gagal load');
    
    const d = data.data || {};
    state.question = (d.question || '').toString();
    state.code = (d.code || '').toString();
    state.originalQuestion = state.question;
    state.originalCode = state.code;
    state.loaded = true;
    state.isDirty = false;
  }
  
  // ==========================================
  // RENDER
  // ==========================================
  window.renderWebInternalView = async function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">' +
      '    <i class="fas fa-arrow-left"></i>' +
      '  </button>' +
      '  <div class="content-sub-title">Web Internal</div>' +
      '  <div class="content-sub-actions">' +
      '    <button id="wi-save-btn" class="content-sub-btn primary" onclick="window.wiSaveSettings()" disabled>' +
      '      <i class="fas fa-save"></i> <span id="wi-save-label">Tersimpan</span>' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body" id="wi-body">' +
      '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
      '</div>';
    
    try {
      await fetchSettings(false);
      renderForm();
    } catch (e) {
      console.error('[WEBINTERNAL] load error:', e);
      const body = document.getElementById('wi-body');
      if (body) {
        body.innerHTML = 
          '<div class="content-placeholder">' +
          '<i class="fas fa-exclamation-triangle" style="color:#f87171;"></i>' +
          '<p>Gagal memuat: ' + escapeHtml(e.message) + '</p></div>';
      }
    }
  };
  
  function renderForm() {
    const body = document.getElementById('wi-body');
    if (!body) return;
    
    body.innerHTML = 
      '<div class="info-section">' +
      '  <div class="info-section-header">' +
      '    <div class="info-section-title">Gate Settings</div>' +
      '  </div>' +
      '  <div class="info-section-desc" style="font-size:0.75rem;color:var(--text-muted);line-height:1.5;margin-bottom:8px;">' +
      '    Pertanyaan dan jawaban yang akan ditampilkan saat member membuka web internal.' +
      '  </div>' +
      '  <label class="content-form-label">Pertanyaan</label>' +
      '  <input type="text" id="wi-input-question" class="content-form-input" ' +
      '         placeholder="Contoh: Siapa nama leader saat ini?" maxlength="100">' +
      '  <label class="content-form-label">Jawaban</label>' +
      '  <input type="text" id="wi-input-code" class="content-form-input" ' +
      '         placeholder="Contoh: Umbrella2025" maxlength="50">' +
      '  <div id="wi-hint" style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;opacity:0.7;">' +
      '    💡 Jawaban bersifat case-insensitive. Ganti jawaban = member lama tetap butuh verifikasi ulang.' +
      '  </div>' +
      '</div>';
    
    const questionInput = document.getElementById('wi-input-question');
    const codeInput = document.getElementById('wi-input-code');
    
    questionInput.value = state.question;
    codeInput.value = state.code;
    
    questionInput.addEventListener('input', checkDirty);
    codeInput.addEventListener('input', checkDirty);
  }
  
  function checkDirty() {
    const q = document.getElementById('wi-input-question')?.value || '';
    const c = document.getElementById('wi-input-code')?.value || '';
    
    const dirty = q !== state.originalQuestion || c !== state.originalCode;
    state.isDirty = dirty;
    
    const btn = document.getElementById('wi-save-btn');
    const label = document.getElementById('wi-save-label');
    if (btn) btn.disabled = !dirty;
    if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
  }
  
  // ==========================================
  // SAVE
  // ==========================================
  window.wiSaveSettings = async function() {
    const btn = document.getElementById('wi-save-btn');
    const label = document.getElementById('wi-save-label');
    if (!btn || btn.disabled) return;
    
    const question = document.getElementById('wi-input-question').value.trim();
    const code = document.getElementById('wi-input-code').value.trim();
    
    // Validasi
    if (!question) {
      window.showToast('❌ Pertanyaan wajib diisi', true);
      return;
    }
    if (question.length < 4) {
      window.showToast('❌ Pertanyaan minimal 4 karakter', true);
      return;
    }
    if (!code) {
      window.showToast('❌ Jawaban wajib diisi', true);
      return;
    }
    if (code.length < 4) {
      window.showToast('❌ Jawaban minimal 4 karakter', true);
      return;
    }
    
    // Konfirmasi kalau jawaban berubah (member lama akan perlu verifikasi ulang)
    if (code !== state.originalCode) {
      const choice = await window.contentModal.show({
        title: 'Ubah jawaban gate?',
        desc: 'Member yang sudah terverifikasi dengan jawaban lama tidak akan terpengaruh (session tetap valid 7 hari). Tapi setelah itu, mereka harus pakai jawaban baru.',
        buttons: [
          { label: 'Ya, Simpan', style: 'confirm', value: 'yes' },
          { label: 'Batal', style: 'cancel', value: 'cancel' }
        ]
      });
      if (choice !== 'yes') return;
    }
    
    btn.disabled = true;
    if (label) label.textContent = 'Menyimpan...';
    
    try {
      const result = await gasCall('setGateSettings', {
        newQuestion: question,
        newCode: code
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Gate settings tersimpan');
        state.originalQuestion = question;
        state.originalCode = code;
        state.question = question;
        state.code = code;
        state.isDirty = false;
        if (label) label.textContent = 'Tersimpan';
        // Note: TIDAK panggil refreshPublishBanner karena gate bukan konten publik
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        if (label) label.textContent = 'Simpan';
      }
    } catch (e) {
      console.error('[WEBINTERNAL] save error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      if (label) label.textContent = 'Simpan';
    }
  };
  
  // ==========================================
  // BACK HANDLER (dengan dirty check)
  // ==========================================
  // Karena tombol back di header pakai contentBackFromSub (dari home),
  // kita intercept via override kalau dirty.
  // Pola: monkey-patch contentBackFromSub saat webinternal aktif.
  
  // Simpan original
  const originalBackFromSub = window.contentBackFromSub;
  
  window.contentBackFromSub = async function() {
    // Cek apakah sub-view yang aktif adalah webinternal
    const subView = document.getElementById('content-view-sub');
    const isWebInternal = subView && subView.querySelector('#wi-input-question');
    
    if (isWebInternal && state.isDirty) {
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
        await window.wiSaveSettings();
        if (state.isDirty) return;  // save gagal
        if (typeof originalBackFromSub === 'function') originalBackFromSub();
      } else if (choice === 'discard') {
        state.isDirty = false;
        if (typeof originalBackFromSub === 'function') originalBackFromSub();
      }
      return;
    }
    
    // Tidak dirty → jalankan back normal
    if (typeof originalBackFromSub === 'function') {
      originalBackFromSub();
    } else if (typeof closeCurrentView === 'function') {
      closeCurrentView();
    }
  };
  
  console.log('✅ content-webinternal.js loaded');
})();
