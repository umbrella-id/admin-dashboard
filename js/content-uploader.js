/**
 * content-uploader.js — Compress WebP + upload ke GitHub via GAS 4
 * Dipakai WYSIWYG (headline/openmember) dan gallery
 */

(function() {
  const UPLOAD_CONFIG = {
    MAX_SIZE: 5 * 1024 * 1024,
    ALLOWED_EXTS: ['jpg', 'jpeg', 'jfif', 'jpe', 'png', 'webp', 'gif', 'avif', 'svg']
  };
  
  const COMPRESS_SETTINGS = {
    headline: { maxWidth: 1280, maxHeight: 720, quality: 0.75 },
    openmember: { maxWidth: 1280, maxHeight: 720, quality: 0.75 },
    gallery: { maxWidth: 1600, maxHeight: 1600, quality: 0.80 },
    profil: { maxWidth: 1280, maxHeight: 1280, quality: 0.80 }
  };
  
  function isValidImageFile(file) {
    if (!file) return false;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    return UPLOAD_CONFIG.ALLOWED_EXTS.indexOf(ext) !== -1;
  }
  
  function compressToWebP(file, options) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let w = img.width;
          let h = img.height;
          const ratio = Math.min(options.maxWidth / w, options.maxHeight / h, 1);
          if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
          
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
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
  
  async function uploadToGitHub(base64, filename) {
    const res = await adminFetch(window.GAS_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'uploadImage',
        adminId: currentAdmin.id,
        base64: base64,
        filename: filename
      })
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Upload gagal');
    return data.url;
  }
  
  async function uploadImage(file, context) {
    context = context || 'gallery';
    if (!isValidImageFile(file)) throw new Error('Format tidak didukung');
    if (file.size > UPLOAD_CONFIG.MAX_SIZE) throw new Error('File terlalu besar (max 5MB)');
    
    let uploadBlob = file;
    let ext = 'webp';
    
    if (file.type === 'image/svg+xml') {
      ext = 'svg';
    } else {
      const settings = COMPRESS_SETTINGS[context] || COMPRESS_SETTINGS.gallery;
      try {
        uploadBlob = await compressToWebP(file, settings);
      } catch (e) {
        console.warn('[UPLOAD] compress gagal, pakai asli:', e);
        uploadBlob = file;
        ext = (file.type.split('/')[1] || 'jpeg');
      }
    }
    
    const filename = 'img-' + Date.now() + '.' + ext;
    const base64 = await blobToBase64(uploadBlob);
    return await uploadToGitHub(base64, filename);
  }
  
  window.contentUploader = {
    uploadImage: uploadImage,
    isValidImageFile: isValidImageFile
  };
  
  console.log('✅ content-uploader.js loaded');
})();
