/**
 * content-gallery.js — Sub-view Gallery (grid + CRUD + upload)
 */

(function() {
  const state = {
    items: [],
    loaded: false,
    currentItem: null,      // untuk EDIT (existing item)
    isAddMode: false,
    currentImageUrl: '',    // working value di form
    isDirty: false,
    isUploading: false,
    originalForm: { header: '', caption: '', imageUrl: '' }
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

  function extractImageUrl(body) {
    if (!body) return '';
    const match = html.toString().match(/<img[^>]*src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }
  
  function extractCaption(body) {
    if (!body) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = body.toString();
    tmp.querySelectorAll('img').forEach(function(el) { el.remove(); });
    return (tmp.textContent || '').trim();
  }
  
  function buildBody(imgUrl, caption) {
    let html = '';
    if (imgUrl && imgUrl.trim()) {
      const safeUrl = imgUrl.trim().replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += '<img src="' + safeUrl + '" style="max-width:100%; border-radius:12px; margin-bottom:10px;">';
    }
    if (caption && caption.trim()) {
      html += '<p>' + escapeHtml(caption.trim()) + '</p>';
    }
    return html;
  }
  
  // ==========================================
  // FETCH
  // ==========================================
  async function fetchGalleryItems(force) {
    if (!force && state.loaded) return state.items;
    
    const data = await gasCall('getAllContent');
    if (data.status !== 'success') throw new Error(data.message || 'Gagal load');
    
    const all = data.data || [];
    state.items = all
      .filter(function(x) { return x.ID && x.ID.toString().toLowerCase() === 'gallery'; })
      .sort(function(a, b) {
        const ta = new Date(a.Timestamp).getTime() || 0;
        const tb = new Date(b.Timestamp).getTime() || 0;
        return tb - ta;  // terbaru dulu
      })
      .map(function(x) {
        const body = (x.Body || '').toString();
        return {
          timestamp: new Date(x.Timestamp).getTime(),
          header: (x.Header || '').toString(),
          caption: extractCaption(body),
          imageUrl: extractImageUrl(body),
          rawBody: body
        };
      });
    
    state.loaded = true;
    return state.items;
  }
  
  // ==========================================
  // RENDER LIST (GRID)
  // ==========================================
  window.renderGalleryList = async function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">' +
      '    <i class="fas fa-arrow-left"></i>' +
      '  </button>' +
      '  <div class="content-sub-title">Gallery <small id="gallery-count" style="color:var(--text-muted);font-weight:400;"></small></div>' +
      '  <div class="content-sub-actions">' +
      '    <button class="content-sub-btn primary" onclick="window.galleryOpenAdd()">' +
      '      <i class="fas fa-plus"></i> Tambah' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body" id="gallery-body">' +
      '  <div class="content-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>' +
      '</div>';
    
    try {
      await fetchGalleryItems(false);
      renderGalleryGrid();
    } catch (e) {
      console.error('[GALLERY] load error:', e);
      document.getElementById('gallery-body').innerHTML = 
        '<div class="content-placeholder">' +
        '<i class="fas fa-exclamation-triangle" style="color:#f87171;"></i>' +
        '<p>Gagal memuat: ' + escapeHtml(e.message) + '</p></div>';
    }
  };
  
  function renderGalleryGrid() {
    const body = document.getElementById('gallery-body');
    const countEl = document.getElementById('gallery-count');
    if (!body) return;
    
    if (countEl) countEl.textContent = '(' + state.items.length + ')';
    
    if (state.items.length === 0) {
      body.innerHTML = 
        '<div class="content-placeholder">' +
        '<i class="fas fa-images"></i>' +
        '<p>Belum ada foto gallery</p>' +
        '<p style="font-size:0.75rem;opacity:0.7;margin-top:8px;">Klik "Tambah" untuk membuat item pertama</p>' +
        '</div>';
      return;
    }
    
    let html = '<div class="gallery-grid">';
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      const title = item.header || '(Tanpa Judul)';
      const imgSrc = item.imageUrl || '';
      const imgHtml = imgSrc 
        ? '<img class="gallery-card-img" src="' + escapeHtml(imgSrc) + '" alt="" loading="lazy" ' +
          'onerror="this.style.display=\'none\';this.parentElement.classList.add(\'img-error\')">'
        : '<div class="gallery-card-img-empty"><i class="fas fa-image"></i></div>';
      
      html += 
        '<div class="gallery-card" onclick="window.galleryOpenEdit(' + i + ')">' +
        '  ' + imgHtml +
        '  <div class="gallery-card-overlay">' +
        '    <div class="gallery-card-title">' + escapeHtml(title) + '</div>' +
        '    <div class="gallery-card-actions">' +
        '      <button class="gallery-card-btn edit" onclick="event.stopPropagation();window.galleryOpenEdit(' + i + ')" title="Edit">' +
        '        <i class="fas fa-pen"></i>' +
        '      </button>' +
        '      <button class="gallery-card-btn delete" onclick="event.stopPropagation();window.galleryOpenDelete(' + i + ')" title="Hapus">' +
        '        <i class="fas fa-trash"></i>' +
        '      </button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }
    html += '</div>';
    
    body.innerHTML = html;
  }
  
  // ==========================================
  // EDIT
  // ==========================================
  window.galleryOpenEdit = function(index) {
    const item = state.items[index];
    if (!item) return;
    
    state.currentItem = item;
    state.isAddMode = false;
    state.currentImageUrl = item.imageUrl;
    state.originalForm = {
      header: item.header,
      caption: item.caption,
      imageUrl: item.imageUrl
    };
    state.isDirty = false;
    state.isUploading = false;
    
    renderGalleryEditForm();
    
    if (typeof pushView === 'function') {
      pushView('content-gallery-edit', { index: index });
    }
  };
  
  window.renderGalleryEditForm = function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView || !state.currentItem) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.galleryBackFromEdit()">' +
      '    <i class="fas fa-arrow-left"></i>' +
      '  </button>' +
      '  <div class="content-sub-title">Edit Gallery</div>' +
      '  <div class="content-sub-actions">' +
      '    <button id="gallery-save-btn" class="content-sub-btn primary" onclick="window.gallerySaveEdit()" disabled>' +
      '      <i class="fas fa-save"></i> <span id="gallery-save-label">Tersimpan</span>' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body">' +
      buildGalleryFormHTML() +
      '</div>';
    
    wireGalleryForm();
  };
  
  // ==========================================
  // ADD
  // ==========================================
  window.galleryOpenAdd = function() {
    state.currentItem = null;
    state.isAddMode = true;
    state.currentImageUrl = '';
    state.originalForm = { header: '', caption: '', imageUrl: '' };
    state.isDirty = false;
    state.isUploading = false;
    
    renderGalleryAddForm();
    
    if (typeof pushView === 'function') {
      pushView('content-gallery-add', {});
    }
  };
  
  window.renderGalleryAddForm = function() {
    const subView = document.getElementById('content-view-sub');
    if (!subView) return;
    
    subView.innerHTML = 
      '<div class="content-sub-header">' +
      '  <button class="content-sub-back-btn" onclick="window.galleryBackFromAdd()">' +
      '    <i class="fas fa-arrow-left"></i>' +
      '  </button>' +
      '  <div class="content-sub-title">Tambah Gallery</div>' +
      '  <div class="content-sub-actions">' +
      '    <button id="gallery-save-btn" class="content-sub-btn primary" onclick="window.gallerySaveAdd()" disabled>' +
      '      <i class="fas fa-plus"></i> <span id="gallery-save-label">Simpan</span>' +
      '    </button>' +
      '  </div>' +
      '</div>' +
      '<div class="content-sub-body">' +
      buildGalleryFormHTML() +
      '</div>';
    
    wireGalleryForm();
  };
  
  // ==========================================
  // SHARED FORM HTML
  // ==========================================
  function buildGalleryFormHTML() {
    const hasImage = state.currentImageUrl && state.currentImageUrl.trim() !== '';
    
    let previewHtml = '';
    if (hasImage) {
      previewHtml = 
        '<img id="gallery-preview-img" src="' + escapeHtml(state.currentImageUrl) + '" alt="" ' +
        'onerror="this.style.display=\'none\'">';
    } else {
      previewHtml = 
        '<div class="gallery-edit-preview-empty">' +
        '  <i class="fas fa-image"></i>' +
        '  <span>Belum ada gambar</span>' +
        '</div>';
    }
    
    // STRUKTUR BARU: DIBAGI JADI 2 KOLOM (PREVIEW & FORM)
    return '<div class="gallery-edit-form">' +
      '<div class="gallery-edit-preview-col">' +
      '  <div class="gallery-edit-preview" id="gallery-preview">' +
      '    ' + previewHtml +
      '    <div class="gallery-edit-preview-overlay">' +
      '      <button id="gallery-upload-btn" type="button" onclick="window.galleryTriggerUpload()">' +
      '        <i class="fas fa-upload"></i> ' + (hasImage ? 'Ganti' : 'Upload') +
      '      </button>' +
      '    </div>' +
      '    <div class="gallery-edit-loading" id="gallery-upload-loading" style="display:none;">' +
      '      <i class="fas fa-spinner fa-spin"></i> Memproses...' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="gallery-edit-fields-col">' +
      '  <div class="content-form">' +
      '    <label class="content-form-label">Judul</label>' +
      '    <input type="text" id="gallery-input-header" class="content-form-input" placeholder="Judul foto">' +
      '    <label class="content-form-label">Deskripsi / Caption</label>' +
      '    <textarea id="gallery-input-caption" class="content-form-textarea" rows="5" placeholder="Keterangan singkat..."></textarea>' +
      '  </div>' +
      '</div>' +
      '</div>';
  }
  
  function wireGalleryForm() {
    const headerInput = document.getElementById('gallery-input-header');
    const captionInput = document.getElementById('gallery-input-caption');
    
    if (headerInput) {
      headerInput.value = state.isAddMode ? '' : state.originalForm.header;
      headerInput.addEventListener('input', checkGalleryDirty);
    }
    if (captionInput) {
      captionInput.value = state.isAddMode ? '' : state.originalForm.caption;
      captionInput.addEventListener('input', checkGalleryDirty);
    }
  }
  
  function checkGalleryDirty() {
    const header = document.getElementById('gallery-input-header').value;
    const caption = document.getElementById('gallery-input-caption').value;
    const btn = document.getElementById('gallery-save-btn');
    const label = document.getElementById('gallery-save-label');
    
    if (state.isAddMode) {
      // Add: butuh image
      const canSave = state.currentImageUrl && state.currentImageUrl.trim() !== '';
      if (btn) btn.disabled = !canSave;
      if (label) label.textContent = 'Simpan';
      return;
    }
    
    // Edit: bandingkan dengan original
    const dirty = 
      header !== state.originalForm.header ||
      caption !== state.originalForm.caption ||
      state.currentImageUrl !== state.originalForm.imageUrl;
    
    state.isDirty = dirty;
    if (btn) btn.disabled = !dirty;
    if (label) label.textContent = dirty ? 'Simpan' : 'Tersimpan';
  }
  
  // ==========================================
  // UPLOAD IMAGE
  // ==========================================
  window.galleryTriggerUpload = function() {
    if (state.isUploading) return;
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.jfif,.jpe,.svg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    fileInput.onchange = async function(e) {
      const file = e.target.files && e.target.files[0];
      document.body.removeChild(fileInput);
      if (!file) return;
      
      state.isUploading = true;
      const loadingEl = document.getElementById('gallery-upload-loading');
      const uploadBtn = document.getElementById('gallery-upload-btn');
      if (loadingEl) loadingEl.style.display = 'flex';
      if (uploadBtn) uploadBtn.disabled = true;
      
      try {
        const url = await window.contentUploader.uploadImage(file, 'gallery');
        state.currentImageUrl = url;
        state.isDirty = true;
        updateGalleryPreview();
        checkGalleryDirty();
        window.showToast('✅ Gambar diupload');
      } catch (err) {
        console.error('[GALLERY] upload error:', err);
        window.showToast('❌ ' + err.message, true);
      } finally {
        state.isUploading = false;
        if (loadingEl) loadingEl.style.display = 'none';
        if (uploadBtn) uploadBtn.disabled = false;
      }
    };
    
    fileInput.click();
  };
  
  function updateGalleryPreview() {
    const preview = document.getElementById('gallery-preview');
    if (!preview) return;
    
    const hasImage = state.currentImageUrl && state.currentImageUrl.trim() !== '';
    
    // Hapus img / empty yang lama
    const oldImg = preview.querySelector('#gallery-preview-img');
    const oldEmpty = preview.querySelector('.gallery-edit-preview-empty');
    if (oldImg) oldImg.remove();
    if (oldEmpty) oldEmpty.remove();
    
    // Insert yang baru
    if (hasImage) {
      const img = document.createElement('img');
      img.id = 'gallery-preview-img';
      img.src = state.currentImageUrl;
      img.onerror = function() { this.style.display = 'none'; };
      preview.insertBefore(img, preview.firstChild);
    } else {
      const empty = document.createElement('div');
      empty.className = 'gallery-edit-preview-empty';
      empty.innerHTML = '<i class="fas fa-image"></i><span>Belum ada gambar</span>';
      preview.insertBefore(empty, preview.firstChild);
    }
    
    // Update label tombol upload
    const uploadBtn = document.getElementById('gallery-upload-btn');
    if (uploadBtn) {
      uploadBtn.innerHTML = '<i class="fas fa-upload"></i> ' + (hasImage ? 'Ganti' : 'Upload');
    }
  }
  
  // ==========================================
  // SAVE EDIT
  // ==========================================
  window.gallerySaveEdit = async function() {
    if (!state.currentItem) return;
    const btn = document.getElementById('gallery-save-btn');
    const label = document.getElementById('gallery-save-label');
    if (!btn || btn.disabled) return;
    
    const header = document.getElementById('gallery-input-header').value;
    const caption = document.getElementById('gallery-input-caption').value;
    const imgUrl = state.currentImageUrl;
    
    if (!imgUrl || !imgUrl.trim()) {
      window.showToast('❌ Gambar wajib ada', true);
      return;
    }
    
    btn.disabled = true;
    if (label) label.textContent = 'Menyimpan...';
    
    try {
      const body = buildBody(imgUrl, caption);
      const fields = JSON.stringify({ Header: header, Body: body });
      const result = await gasCall('updateContent', {
        timestamp: state.currentItem.timestamp,
        fields: fields
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Tersimpan (belum tayang)');
        state.originalForm = { header: header, caption: caption, imageUrl: imgUrl };
        state.isDirty = false;
        state.loaded = false;
        if (label) label.textContent = 'Tersimpan';
        if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        if (label) label.textContent = 'Simpan';
      }
    } catch (e) {
      console.error('[GALLERY] save error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      if (label) label.textContent = 'Simpan';
    }
  };
  
  // ==========================================
  // SAVE ADD
  // ==========================================
  window.gallerySaveAdd = async function() {
    const btn = document.getElementById('gallery-save-btn');
    const label = document.getElementById('gallery-save-label');
    if (!btn || btn.disabled) return;
    
    const header = document.getElementById('gallery-input-header').value;
    const caption = document.getElementById('gallery-input-caption').value;
    const imgUrl = state.currentImageUrl;
    
    if (!imgUrl || !imgUrl.trim()) {
      window.showToast('❌ Upload gambar dulu', true);
      return;
    }
    
    btn.disabled = true;
    if (label) label.textContent = 'Menyimpan...';
    
    try {
      const body = buildBody(imgUrl, caption);
      const result = await gasCall('addContentItem', {
        category: 'gallery',
        header: header,
        body: body
      });
      
      if (result.status === 'success') {
        window.showToast('✅ Ditambahkan (belum tayang)');
        state.loaded = false;
        if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
        closeCurrentView();  // kembali ke list
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal'), true);
        btn.disabled = false;
        if (label) label.textContent = 'Simpan';
      }
    } catch (e) {
      console.error('[GALLERY] add error:', e);
      window.showToast('❌ Koneksi gagal', true);
      btn.disabled = false;
      if (label) label.textContent = 'Simpan';
    }
  };
  
  // ==========================================
  // DELETE
  // ==========================================
  window.galleryOpenDelete = async function(index) {
    const item = state.items[index];
    if (!item) return;
    
    const choice = await window.contentModal.show({
      title: 'Hapus foto ini?',
      desc: escapeHtml(item.header || '(tanpa judul)'),
      buttons: [
        { label: 'Ya, Hapus', style: 'danger', value: 'yes' },
        { label: 'Batal', style: 'cancel', value: 'cancel' }
      ]
    });
    
    if (choice !== 'yes') return;
    
    try {
      const result = await gasCall('deleteContentItem', { timestamp: item.timestamp });
      if (result.status === 'success') {
        window.showToast('✅ Item dihapus (belum tayang)');
        state.loaded = false;
        if (typeof window.refreshPublishBanner === 'function') window.refreshPublishBanner();
        await renderGalleryList();
      } else {
        window.showToast('❌ ' + (result.message || 'Gagal hapus'), true);
      }
    } catch (e) {
      console.error('[GALLERY] delete error:', e);
      window.showToast('❌ Koneksi gagal', true);
    }
  };
  
  // ==========================================
  // BACK HANDLERS
  // ==========================================
  window.galleryBackFromEdit = async function() {
    if (state.isDirty || state.currentImageUrl !== state.originalForm.imageUrl) {
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
        await window.gallerySaveEdit();
        if (state.isDirty) return;  // save gagal
        closeCurrentView();
      } else if (choice === 'discard') {
        state.isDirty = false;
        closeCurrentView();
      }
    } else {
      closeCurrentView();
    }
  };
  
  window.galleryBackFromAdd = async function() {
    const header = document.getElementById('gallery-input-header')?.value || '';
    const caption = document.getElementById('gallery-input-caption')?.value || '';
    const hasImage = state.currentImageUrl && state.currentImageUrl.trim() !== '';
    
    if (header || caption || hasImage) {
      const choice = await window.contentModal.show({
        title: 'Batal menambah?',
        desc: 'Data yang sudah diisi akan hilang.',
        buttons: [
          { label: 'Buang', style: 'danger', value: 'discard' },
          { label: 'Batal', style: 'cancel', value: 'cancel' }
        ]
      });
      if (choice === 'discard') closeCurrentView();
    } else {
      closeCurrentView();
    }
  };
  
  console.log('✅ content-gallery.js loaded');
})();
