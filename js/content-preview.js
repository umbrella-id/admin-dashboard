/**
 * content-preview.js — Preview stage + edit background
 * Fase F
 * 
 * Background disimpan terpisah dari Sheet CONTENT:
 *   - GitHub: upload/bg-img (file binary)
 *   - GitHub: upload/bg.json (metadata: status, format, size, version)
 * 
 * Tidak masuk siklus PENDING_PUBLISH — upload = langsung tayang
 */

(function() {
  const BG_JSON_URL = 'https://raw.githubusercontent.com/umbrella-id/umbrella-id.github.io/main/upload/bg.json';
  const BG_IMG_URL  = 'https://raw.githubusercontent.com/umbrella-id/umbrella-id.github.io/main/upload/bg-img';
  const BG_DEFAULT_URL = 'https://umbrella-id.github.io/Assets/Background.webp';
  const OVERLAY_URL = 'Assets/preview-overlay.webp';
  
  const state = {
    isUploading: false,
    isActive: false,
    currentVersion: 0,
    currentFormat: ''
  };
  
  // ==========================================
  // HELPER: POST ke GAS 4
  // ==========================================
  async function gasPost(payload) {
    const res = await fetch(window.GAS_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }
  
  // ==========================================
  // HELPER: COMPRESS WebP
  // ==========================================
  function compressToWebP(file, options) {
    options = options || { maxWidth: 1280, maxHeight: 1280, quality: 0.70 };
    
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let w = img.width;
          let h = img.height;
          const ratio = Math.min(options.maxWidth / w, options.maxHeight / h, 1);
          if (ratio < 1) {
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          
          canvas.toBlob(function(blob) {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob gagal'));
          }, 'image/webp', options.quality);
        };
        img.onerror = function() { reject(new Error('Gagal load gambar')); };
        img.src = e.target.result;
      };
      reader.onerror = function() { reject(new Error('Gagal baca file')); };
      reader.readAsDataURL(file);
    });
  }
  
  function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() { resolve(reader.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  // ==========================================
  // RENDER SKELETON (dipanggil dari content-home.js)
  // ==========================================
  window.renderPreviewStageSkeleton = function(stageEl) {
    if (!stageEl) return;
    
    stageEl.innerHTML = 
      '<img id="preview-bg-img" class="preview-bg" src="' + BG_DEFAULT_URL + '" alt="" ' +
      '     onerror="this.style.display=\'none\'">' +
      '<img class="preview-overlay-img" src="' + OVERLAY_URL + '" alt="" ' +
      '     onerror="this.style.display=\'none\'">' +
      '<div id="preview-loading" class="preview-loading-overlay" style="display:none;">' +
      '  <i class="fas fa-spinner fa-spin"></i> <span>Memproses...</span>' +
      '</div>' +
      '<button id="preview-edit-btn" class="preview-edit-btn" onclick="window.contentPreviewEdit()">' +
      '  <i class="fas fa-edit"></i> Edit' +
      '</button>';
    
    // Load actual background
    loadPreviewBackground();
  };
  
  // ==========================================
  // LOAD BACKGROUND (dari bg.json)
  // ==========================================
  async function loadPreviewBackground() {
    const imgEl = document.getElementById('preview-bg-img');
    if (!imgEl) return;
    
    try {
      const res = await fetch(BG_JSON_URL + '?t=' + Date.now());
      
      if (!res.ok) {
        // bg.json belum ada → default
        state.isActive = false;
        state.currentVersion = 0;
        state.currentFormat = '';
        imgEl.src = BG_DEFAULT_URL;
        return;
      }
      
      const config = await res.json();
      
      if (config.status === 'aktif') {
        state.isActive = true;
        state.currentVersion = config.version || Date.now();
        state.currentFormat = config.format || 'webp';
        imgEl.src = BG_IMG_URL + '?t=' + state.currentVersion;
      } else {
        state.isActive = false;
        state.currentVersion = 0;
        state.currentFormat = '';
        imgEl.src = BG_DEFAULT_URL;
      }
    } catch (e) {
      console.warn('[PREVIEW] load bg.json error:', e);
      imgEl.src = BG_DEFAULT_URL;
    }
  }
  
  // ==========================================
  // EDIT — Tampilkan modal pilihan
  // ==========================================
  window.contentPreviewEdit = async function() {
    if (state.isUploading) return;
    
    const choice = await window.contentModal.show({
      title: 'Background Stage',
      desc: state.isActive 
        ? 'Saat ini menggunakan background kustom.' 
        : 'Saat ini menggunakan background default.',
      buttons: [
        { label: '📤 Upload Baru', style: 'confirm', value: 'upload' },
        { label: '↺ Reset ke Default', style: 'danger', value: 'default' }
      ]
    });
    
    if (choice === 'upload') {
      contentPreviewUpload();
    } else if (choice === 'default') {
      contentPreviewResetToDefault();
    }
  };
  
  // ==========================================
  // UPLOAD BACKGROUND
  // ==========================================
  function contentPreviewUpload() {
    if (state.isUploading) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.jfif,.jpe,.svg';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = async function(e) {
      const file = e.target.files && e.target.files[0];
      document.body.removeChild(input);
      if (!file) return;
      
      // Validasi
      if (!window.contentUploader.isValidImageFile(file)) {
        window.showToast('❌ Format tidak didukung. Gunakan JPG, PNG, WebP, atau SVG.', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        window.showToast('❌ File terlalu besar (max 5MB)', true);
        return;
      }
      
      state.isUploading = true;
      showLoading(true);
      disableEditBtn(true);
      
      try {
        // Compress ke WebP (kecuali SVG)
        let uploadBlob = file;
        let formatStr = 'webp';
        
        if (file.type === 'image/svg+xml') {
          formatStr = 'svg';
        } else {
          try {
            uploadBlob = await compressToWebP(file);
          } catch (ce) {
            console.warn('[PREVIEW] compress error, pakai asli:', ce);
            uploadBlob = file;
            formatStr = (file.type.split('/')[1] || 'jpeg').toLowerCase();
          }
        }
        
        const base64 = await blobToBase64(uploadBlob);
        const version = Date.now();
        
        // 1. Upload binary ke bg-img
        const imgResult = await gasPost({
          action: 'uploadBgImg',
          adminId: currentAdmin.id,
          base64: base64
        });
        
        if (imgResult.status !== 'success') {
          throw new Error(imgResult.message || 'Upload gambar gagal');
        }
        
        // 2. Update bg.json
        const jsonResult = await gasPost({
          action: 'uploadBgJson',
          adminId: currentAdmin.id,
          status: 'aktif',
          format: formatStr,
          size: uploadBlob.size,
          version: version
        });
        
        if (jsonResult.status !== 'success') {
          throw new Error(jsonResult.message || 'Update bg.json gagal');
        }
        
        // 3. Update preview
        state.isActive = true;
        state.currentVersion = version;
        state.currentFormat = formatStr;
        
        const imgEl = document.getElementById('preview-bg-img');
        if (imgEl) {
          imgEl.style.display = '';
          imgEl.src = BG_IMG_URL + '?t=' + version;
        }
        
        window.showToast('✅ Background berhasil diperbarui');
        
      } catch (err) {
        console.error('[PREVIEW] upload error:', err);
        window.showToast('❌ ' + err.message, true);
      } finally {
        state.isUploading = false;
        showLoading(false);
        disableEditBtn(false);
      }
    };
    
    input.click();
  }
  
  // ==========================================
  // RESET KE DEFAULT
  // ==========================================
  async function contentPreviewResetToDefault() {
    if (state.isUploading) return;
    
    if (!state.isActive) {
      window.showToast('Background sudah default', true);
      return;
    }
    
    const confirmChoice = await window.contentModal.show({
      title: 'Reset ke Default?',
      desc: 'Background kustom akan dihapus dan diganti dengan background default web publik.',
      buttons: [
        { label: 'Ya, Reset', style: 'danger', value: 'yes' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (confirmChoice !== 'yes') return;
    
    state.isUploading = true;
    showLoading(true);
    disableEditBtn(true);
    
    try {
      const result = await gasPost({
        action: 'uploadBgJson',
        adminId: currentAdmin.id,
        status: 'nonaktif',
        format: '',
        size: 0,
        version: Date.now()
      });
      
      if (result.status !== 'success') {
        throw new Error(result.message || 'Reset gagal');
      }
      
      state.isActive = false;
      state.currentVersion = 0;
      state.currentFormat = '';
      
      const imgEl = document.getElementById('preview-bg-img');
      if (imgEl) {
        imgEl.style.display = '';
        imgEl.src = BG_DEFAULT_URL;
      }
      
      window.showToast('✅ Background direset ke default');
      
    } catch (err) {
      console.error('[PREVIEW] reset error:', err);
      window.showToast('❌ ' + err.message, true);
    } finally {
      state.isUploading = false;
      showLoading(false);
      disableEditBtn(false);
    }
  }
  
  // ==========================================
  // HELPER: Loading + Disable
  // ==========================================
  function showLoading(show) {
    const el = document.getElementById('preview-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
  }
  
  function disableEditBtn(disable) {
    const btn = document.getElementById('preview-edit-btn');
    if (btn) btn.disabled = disable;
  }
  
  // Expose untuk debugging
  window.contentPreviewState = state;
  
  console.log('✅ content-preview.js loaded');
})();
