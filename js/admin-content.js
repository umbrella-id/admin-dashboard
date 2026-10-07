/**
 * admin-content.js - Kelola Konten Web (V8)
 * 
 * Fitur:
 * - CRUD konten (headline, openmember, profil, gallery, running_text, sosmed)
 * - Upload gambar ke GitHub (via GAS 4)
 * - Background dynamic (dual file: bg.json + bg-img)
 * - Support multi-format: JPEG, PNG, WebP, GIF, AVIF, SVG
 */

let currentContentData = [];
let hasUnsavedChanges = false;

// ==========================================
// KONFIG UPLOAD
// ==========================================
const UPLOAD_CONFIG = {
    MAX_SIZE: 5 * 1024 * 1024,   // 5MB
    ALLOWED_TYPES: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
        'image/svg+xml'
    ],
    ALLOWED_EXTS: ['jpg', 'jpeg', 'jfif', 'jpe', 'png', 'webp', 'gif', 'avif', 'svg']
};

const BG_JSON_URL = 'https://raw.githubusercontent.com/umbrella-id/umbrella-id.github.io/main/upload/bg.json';
const BG_IMG_URL  = 'https://raw.githubusercontent.com/umbrella-id/umbrella-id.github.io/main/upload/bg-img';

// ==========================================
// UPLOAD GAMBAR KE GITHUB (untuk gallery/konten)
// ==========================================
async function uploadToGitHub(file) {
    if (!isValidImageFile(file)) {
        const allowed = UPLOAD_CONFIG.ALLOWED_EXTS.map(x => x.toUpperCase()).join(', ');
        throw new Error(`Format tidak didukung. Gunakan: ${allowed}`);
    }
    
    if (file.size > UPLOAD_CONFIG.MAX_SIZE) {
        const maxMB = (UPLOAD_CONFIG.MAX_SIZE / 1024 / 1024).toFixed(0);
        throw new Error(`File terlalu besar. Maksimal ${maxMB}MB.`);
    }
    
    const ext = file.name.split('.').pop().toLowerCase();
    const filename = `img-${Date.now()}.${ext}`;
    
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    
    const payload = {
        action: 'uploadImage',
        adminId: currentAdmin.id,
        base64: base64,
        filename: filename,
        mimeType: file.type
    };
    
    const res = await fetch(window.GAS_ADMIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error('❌ Response bukan JSON:', text.substring(0, 500));
        throw new Error('Server return bukan JSON. Cek deployment GAS.');
    }
    
    const data = await res.json();
    
    if (data.status !== 'success') {
        throw new Error(data.message || 'Upload gagal');
    }
    
    return data.url;
}

// ==========================================
// TRIGGER UPLOAD (untuk field URL gambar)
// ==========================================
window.triggerUpload = function(btn) {
    const input = btn.previousElementSibling;
    if (!input) return;
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.jfif,.jpe,.svg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        document.body.removeChild(fileInput);
        if (!file) return;
        
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const url = await uploadToGitHub(file);
            if (url) {
                input.value = url;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                updateImagePreview(input);
                window.showToast('✅ Upload berhasil');
            }
        } catch(e) {
            console.error('Upload error:', e);
            window.showToast('❌ ' + e.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };
    
    fileInput.click();
};

// ==========================================
// PREVIEW GAMBAR
// ==========================================
function updateImagePreview(input) {
    const wrapper = input.closest('div[style*="display:flex"]');
    if (!wrapper) return;
    
    let previewEl = wrapper.parentElement.querySelector('.img-preview');
    
    if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.className = 'img-preview';
        previewEl.style.cssText = 'margin-top: 8px; margin-bottom: 8px;';
        wrapper.insertAdjacentElement('afterend', previewEl);
    }
    
    const url = input.value.trim();
    
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        previewEl.innerHTML = `
            <img src="${escapeHtml(url)}" 
                 style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid var(--border-line); object-fit: cover;"
                 onerror="this.parentElement.innerHTML='<div style=\\'color:#ff8888;font-size:0.7rem;\\'>⚠️ Gambar tidak bisa dimuat</div>'">
        `;
    } else {
        previewEl.innerHTML = '';
    }
}

// ==========================================
// BUILD INPUT URL + TOMBOL UPLOAD
// ==========================================
function buildImageUrlInput(timestamp, field, value, placeholder) {
    const id = `img-input-${timestamp}-${field}-${Math.random().toString(36).substring(2, 8)}`;
    return `
        <div style="margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" 
                       class="content-image-url" 
                       id="${id}"
                       placeholder="${placeholder || 'URL Gambar'}" 
                       value="${escapeHtml(value || '')}" 
                       data-timestamp="${timestamp}" 
                       data-field="${field || 'ImageUrl'}"
                       oninput="updateImagePreview(this)"
                       style="flex:1;">
                <button class="btn-upload-img" 
                        onclick="window.triggerUpload(this)" 
                        title="Upload gambar ke GitHub"
                        style="background:var(--color-primary); color:white; border:none; border-radius:8px; padding:10px 14px; cursor:pointer; font-size:1rem; flex-shrink:0;">
                    <i class="fas fa-cloud-upload-alt"></i>
                </button>
            </div>
            ${value ? `<div class="img-preview" style="margin-top:8px;">
                <img src="${escapeHtml(value)}" 
                     style="max-width:200px; max-height:150px; border-radius:8px; border:1px solid var(--border-line); object-fit:cover;"
                     onerror="this.parentElement.innerHTML='<div style=\\'color:#ff8888;font-size:0.7rem;\\'>⚠️ Gambar tidak bisa dimuat</div>'">
            </div>` : '<div class="img-preview" style="margin-top:8px;"></div>'}
        </div>
    `;
}

// ==========================================
// FUNGSI BANTU
// ==========================================
function extractImageUrlFromBody(body) {
    if (!body) return '';
    const match = body.match(/<img[^>]*src="([^"]+)"/);
    return match ? match[1] : '';
}

function extractCaptionFromBody(body) {
    if (!body) return '';
    let text = body.replace(/<img[^>]*>/g, '');
    text = text.replace(/<\/?p>/g, '').trim();
    return text;
}

function buildGalleryBody(imageUrl, caption) {
    let html = '';
    if (imageUrl && imageUrl.trim()) {
        html += `<img src="${escapeHtml(imageUrl.trim())}" style="max-width:100%; border-radius:12px; margin-bottom:10px;">`;
    }
    if (caption && caption.trim()) {
        html += `<p>${escapeHtml(caption.trim())}</p>`;
    }
    return html;
}

function getItemTs(item) {
    if (!item) return 0;
    return parseTimestamp(item.Timestamp);
}

function parseTimestamp(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    if (typeof raw === 'number') return raw > 0 ? raw : 0;
    if (raw instanceof Date) {
        const t = raw.getTime();
        return isNaN(t) ? 0 : t;
    }
    const str = String(raw).trim();
    if (!str) return 0;
    let t = new Date(str).getTime();
    if (!isNaN(t) && t > 0) return t;
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
        t = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]),
                     parseInt(m[4] || 0), parseInt(m[5] || 0), parseInt(m[6] || 0)).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    if (/^\d+$/.test(str)) {
        const num = parseInt(str);
        if (num > 1000000000000) return num;
        if (num > 1000000000) return num * 1000;
    }
    return 0;
}

function isValidImageFile(file) {
    if (file.type && UPLOAD_CONFIG.ALLOWED_TYPES.includes(file.type)) return true;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (UPLOAD_CONFIG.ALLOWED_EXTS && UPLOAD_CONFIG.ALLOWED_EXTS.includes(ext)) return true;
    return false;
}

function detectMimeFromExt(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const MIME_MAP = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'jfif': 'image/jpeg',
        'jpe': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'avif': 'image/avif',
        'svg': 'image/svg+xml'
    };
    return MIME_MAP[ext] || 'image/jpeg';
}

// ==========================================
// LOAD & RENDER KONTEN
// ==========================================
async function loadContentData() {
    const container = document.getElementById('content-editor-container');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data konten...</div>';
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getAllContent`);
        const data = await res.json();
        
        if (data.status === 'success' && data.data) {
            currentContentData = data.data;
            renderContentEditor(currentContentData);
            hasUnsavedChanges = false;
        } else {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data konten</div>';
        }
    } catch(e) {
        console.error("Load content error:", e);
        container.innerHTML = '<div class="empty-state">⚠️ Koneksi gagal</div>';
    }
}

function renderContentEditor(data) {
    const container = document.getElementById('content-editor-container');
    if (!container) return;
    
    const headline = data.find(item => item.ID?.toLowerCase() === 'headline');
    const openmember = data.find(item => item.ID?.toLowerCase() === 'openmember');
    const profilList = data.filter(item => item.ID?.toLowerCase() === 'profil');
    const galeryList = data.filter(item => item.ID?.toLowerCase() === 'gallery');
    const runningTexts = data.filter(item => item.ID?.toLowerCase() === 'running_text');
    const sosmedList = data.filter(item => item.ID?.toLowerCase() === 'sosmed');
    
    const headlineTs = getItemTs(headline);
    const openmemberTs = getItemTs(openmember);
    
    let html = `
        <div class="content-editor">
            <!-- BACKGROUND STAGE -->
            <div class="content-category">
                <h4><i class="fas fa-image"></i> BACKGROUND STAGE</h4>
                <div class="content-item" data-timestamp="0" data-category="background" style="position:relative;">
                    <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                        <button class="btn-upload-bg" onclick="uploadBackground(this)" style="background:var(--color-primary); color:white; border:none; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:0.75rem;">
                            <i class="fas fa-cloud-upload-alt"></i> Upload
                        </button>
                        <button class="btn-reset-bg" onclick="resetBackground()" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:8px 14px; color:#ff8888; cursor:pointer; font-size:0.75rem;">
                            <i class="fas fa-undo"></i> Reset Default
                        </button>
                    </div>
                    <div style="margin-bottom:8px; font-size:0.75rem; color:var(--text-muted);">
                        Status: <span id="bgStatusLabel">Memuat...</span>
                    </div>
                    <div id="bgPreview" style="border-radius:8px; overflow:hidden; margin-bottom:8px; max-height:200px; background:#0f0a06;">
                        <div style="padding:40px; text-align:center; color:var(--text-muted); font-size:0.75rem;">
                            <i class="fas fa-spinner fa-spin"></i> Memuat preview...
                        </div>
                    </div>
                    <small style="color:var(--text-muted); font-size:0.65rem; display:block;">
                        Format: JPG, PNG, WEBP, GIF, AVIF, SVG. Max 5MB.
                    </small>
                </div>
            </div>
            
            <!-- HEADLINE -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item" data-timestamp="${headlineTs}" data-status="normal" style="position:relative;">
                    <div class="item-badge" style="display:none;"></div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-timestamp="${headlineTs}" data-field="Header">
                    ${buildImageUrlInput(headlineTs, 'ImageUrl', extractImageUrlFromBody(headline?.Body || ''), 'URL Gambar (opsional)')}
                    <textarea class="content-caption" placeholder="Caption / Teks" data-timestamp="${headlineTs}" data-field="Caption">${escapeHtml(extractCaptionFromBody(headline?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item" data-timestamp="${openmemberTs}" data-status="normal" style="position:relative;">
                    <div class="item-badge" style="display:none;"></div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-timestamp="${openmemberTs}" data-field="Header">
                    ${buildImageUrlInput(openmemberTs, 'ImageUrl', extractImageUrlFromBody(openmember?.Body || ''), 'URL Gambar (opsional)')}
                    <textarea class="content-caption" placeholder="Caption / Teks" data-timestamp="${openmemberTs}" data-field="Caption">${escapeHtml(extractCaptionFromBody(openmember?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- PROFIL -->
            <div class="content-category">
                <h4><i class="fas fa-address-card"></i> PROFIL</h4>
                <div id="profil-list">
                    ${profilList.map(item => {
                        const ts = getItemTs(item);
                        return `
                        <div class="content-item" data-timestamp="${ts}" data-status="normal" style="position:relative;">
                            <div class="item-badge" style="display:none;"></div>
                            <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                                <button class="btn-undo" onclick="undoDelete('profil', ${ts})" style="display:none; background:rgba(34,197,94,0.2); border:1px solid #22c55e; border-radius:8px; padding:6px 12px; color:#4ade80; cursor:pointer; font-size:0.7rem;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('profil', ${ts})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                            </div>
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-timestamp="${ts}" data-field="Header">
                            <textarea class="content-body" placeholder="Body" data-timestamp="${ts}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                        </div>
                    `}).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('profil')"><i class="fas fa-plus"></i> Tambah Profil</button>
            </div>
            
            <!-- GALLERY -->
            <div class="content-category">
                <h4><i class="fas fa-images"></i> GALLERY</h4>
                <div id="gallery-list">
                    ${galeryList.map(item => {
                        const ts = getItemTs(item);
                        const imageUrl = extractImageUrlFromBody(item.Body || '');
                        const caption = extractCaptionFromBody(item.Body || '');
                        return `
                            <div class="content-item" data-timestamp="${ts}" data-status="normal" style="position:relative;">
                                <div class="item-badge" style="display:none;"></div>
                                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                                    <button class="btn-undo" onclick="undoDelete('gallery', ${ts})" style="display:none; background:rgba(34,197,94,0.2); border:1px solid #22c55e; border-radius:8px; padding:6px 12px; color:#4ade80; cursor:pointer; font-size:0.7rem;">↩️ Batal</button>
                                    <button class="btn-delete-item" onclick="deleteContentItem('gallery', ${ts})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                                </div>
                                <input type="text" class="content-header" placeholder="Judul Event" value="${escapeHtml(item.Header || '')}" data-timestamp="${ts}" data-field="Header">
                                ${buildImageUrlInput(ts, 'ImageUrl', imageUrl, 'URL Gambar')}
                                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-timestamp="${ts}" data-field="Caption">${escapeHtml(caption)}</textarea>
                            </div>
                        `;
                    }).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('gallery')"><i class="fas fa-plus"></i> Tambah Gallery</button>
            </div>
            
            <!-- RUNNING TEXT -->
            <div class="content-category">
                <h4><i class="fas fa-scroll"></i> RUNNING TEXT</h4>
                <div id="runningtext-list">
                    ${runningTexts.map(item => {
                        const ts = getItemTs(item);
                        return `
                        <div class="content-item" data-timestamp="${ts}" data-status="normal" style="position:relative;">
                            <div class="item-badge" style="display:none;"></div>
                            <textarea class="content-body" placeholder="Text" data-timestamp="${ts}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                        </div>
                    `}).join('')}
                </div>
            </div>
            
            <!-- SOSMED -->
            <div class="content-category">
                <h4><i class="fas fa-share-alt"></i> SOSMED</h4>
                <div id="sosmed-list">
                    ${sosmedList.map(item => {
                        const ts = getItemTs(item);
                        let iconClass = 'fa-brands fa-discord';
                        let label = 'Discord';
                        if (item.Header === 'whatsapp') {
                            iconClass = 'fa-brands fa-whatsapp';
                            label = 'WhatsApp';
                        } else if (item.Header === 'facebook') {
                            iconClass = 'fa-brands fa-facebook';
                            label = 'Facebook';
                        }
                        return `
                            <div class="content-item" data-timestamp="${ts}" data-status="normal" style="position:relative;">
                                <div class="item-badge" style="display:none;"></div>
                                <div class="platform-label" style="margin-bottom:8px; color:var(--color-primary); font-weight:bold;">
                                    <i class="${iconClass}"></i> ${label}
                                </div>
                                <input type="text" class="content-body" placeholder="URL" value="${escapeHtml(item.Body || '')}" data-timestamp="${ts}" data-field="Body">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Pasang listener perubahan
    document.querySelectorAll('.content-item').forEach(item => {
        const ts = parseInt(item.dataset.timestamp);
        const isNewItem = ts < 0;
        const badge = item.querySelector('.item-badge');
        const originalData = currentContentData.find(d => getItemTs(d) === ts) || {};
        
        if (isNewItem) {
            badge.textContent = 'BARU';
            badge.style.cssText = 'position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px; font-weight:bold; z-index:10;';
            badge.style.display = 'block';
            item.style.background = 'rgba(34, 197, 94, 0.1)';
            item.style.borderLeft = '3px solid #22c55e';
        }
        
        const inputs = item.querySelectorAll('input, textarea, select');
        const checkChanges = () => {
            if (item.dataset.status === 'deleted') return;
            
            let hasChanged = false;
            inputs.forEach(input => {
                const field = input.dataset.field;
                const originalValue = originalData[field] || '';
                if (input.value !== originalValue) hasChanged = true;
            });
            
            const imageUrlInput = item.querySelector('.content-image-url');
            const captionInput = item.querySelector('.content-caption');
            if (imageUrlInput && captionInput) {
                const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
                if (originalData.Body !== newBody) hasChanged = true;
            }
            
            if (hasChanged && !isNewItem && item.dataset.status !== 'edited') {
                badge.textContent = 'DIEDIT';
                badge.style.background = '#f59e0b';
                badge.style.display = 'block';
                item.style.background = 'rgba(245, 158, 11, 0.1)';
                item.style.borderLeft = '3px solid #f59e0b';
                item.dataset.status = 'edited';
                hasUnsavedChanges = true;
            } else if (!hasChanged && item.dataset.status === 'edited') {
                badge.style.display = 'none';
                item.style.background = '';
                item.style.borderLeft = '';
                item.dataset.status = 'normal';
            }
        };
        
        inputs.forEach(input => {
            input.addEventListener('input', checkChanges);
            if (input.tagName === 'SELECT') input.addEventListener('change', checkChanges);
        });
    });
    
    // Load preview background
    setTimeout(loadBackgroundPreview, 100);
}

// ==========================================
// BACKGROUND MANAGEMENT
// ==========================================

async function loadBackgroundPreview() {
    const statusEl = document.getElementById('bgStatusLabel');
    const previewEl = document.getElementById('bgPreview');
    
    if (!statusEl || !previewEl) return;
    
    try {
        const res = await fetch(BG_JSON_URL + '?t=' + Date.now());
        
        if (!res.ok) {
            statusEl.textContent = 'Default (belum ada bg.json)';
            statusEl.style.color = 'var(--text-muted)';
            previewEl.innerHTML = '<img src="/Assets/Background.png" style="width:100%; opacity:0.5; max-height:200px; object-fit:cover;">';
            return;
        }
        
        const config = await res.json();
        
        if (config.status === 'aktif') {
            const sizeKB = Math.round((config.size || 0) / 1024);
            statusEl.textContent = `Aktif — ${config.format || '?'}, ${sizeKB} KB`;
            statusEl.style.color = '#4ade80';
            previewEl.innerHTML = `<img src="${BG_IMG_URL}?t=${Date.now()}" style="width:100%; max-height:200px; object-fit:cover;">`;
        } else {
            statusEl.textContent = 'Default (nonaktif)';
            statusEl.style.color = 'var(--text-muted)';
            previewEl.innerHTML = '<img src="/Assets/Background.png" style="width:100%; opacity:0.7; max-height:200px; object-fit:cover;">';
        }
    } catch(e) {
        console.error('Load bg preview error:', e);
        statusEl.textContent = 'Error load';
        statusEl.style.color = '#ff8888';
    }
}

window.uploadBackground = async function(btn) {
    if (currentAdmin?.role1 !== 'LEADER') {
        window.showToast('❌ Hanya LEADER yang bisa upload', true);
        return;
    }
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.jfif,.jpe,.svg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        document.body.removeChild(fileInput);
        if (!file) return;
        
        console.log('📁 File:', { name: file.name, type: file.type, size: file.size });
        
        // Validasi format
        if (!isValidImageFile(file)) {
            const allowed = UPLOAD_CONFIG.ALLOWED_EXTS.map(x => x.toUpperCase()).join(', ');
            window.showToast(`❌ Format tidak didukung. Gunakan: ${allowed}`, true);
            return;
        }
        
        // Validasi ukuran
        if (file.size > UPLOAD_CONFIG.MAX_SIZE) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            const maxMB = (UPLOAD_CONFIG.MAX_SIZE / 1024 / 1024).toFixed(0);
            window.showToast(`❌ File ${sizeMB}MB terlalu besar (max ${maxMB}MB)`, true);
            return;
        }
        
        // Normalisasi MIME
        let actualMime = file.type;
        if (!actualMime || actualMime === 'application/octet-stream') {
            actualMime = detectMimeFromExt(file.name);
        }
        
        // Format string bersih
        let formatStr = 'jpeg';
        if (actualMime === 'image/svg+xml') {
            formatStr = 'svg';
        } else if (actualMime.startsWith('image/')) {
            formatStr = actualMime.split('/')[1];
        }
        
        console.log('📤 Upload:', actualMime, formatStr, (file.size / 1024).toFixed(0) + 'KB');
        
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload...';
        
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            const version = Date.now();
            
            // 1. Upload binary ke bg-img
            const imgRes = await fetch(window.GAS_ADMIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'uploadBgImg',
                    adminId: currentAdmin.id,
                    base64: base64
                })
            });
            
            const imgData = await imgRes.json();
            if (imgData.status !== 'success') {
                throw new Error('Upload gambar: ' + (imgData.message || 'gagal'));
            }
            
            // 2. Update bg.json
            const jsonRes = await fetch(window.GAS_ADMIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'uploadBgJson',
                    adminId: currentAdmin.id,
                    status: 'aktif',
                    format: formatStr,
                    size: file.size,
                    version: version
                })
            });
            
            const jsonData = await jsonRes.json();
            if (jsonData.status !== 'success') {
                throw new Error('Update info: ' + (jsonData.message || 'gagal'));
            }
            
            window.showToast('✅ Background diupdate!');
            await loadBackgroundPreview();
            
        } catch(e) {
            console.error('Upload error:', e);
            window.showToast('❌ ' + e.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };
    
    fileInput.click();
};

window.resetBackground = async function() {
    if (currentAdmin?.role1 !== 'LEADER') {
        window.showToast('❌ Hanya LEADER yang bisa reset', true);
        return;
    }
    
    if (!confirm('Reset background ke default?')) return;
    
    try {
        window.showToast('⏳ Reset...');
        
        const res = await fetch(window.GAS_ADMIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'uploadBgJson',
                adminId: currentAdmin.id,
                status: 'nonaktif',
                format: '',
                size: 0,
                version: Date.now()
            })
        });
        
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast('✅ Background direset ke default');
            await loadBackgroundPreview();
        } else {
            window.showToast('❌ ' + (data.message || 'Gagal'), true);
        }
    } catch(e) {
        console.error('Reset error:', e);
        window.showToast('❌ ' + e.message, true);
    }
};

// ==========================================
// UPDATE ALL CONTENT
// ==========================================
window.updateAllContent = async function() {
    const { changes, newItems, deletedTimestamps } = collectChangedFields();
    
    if (changes.length === 0 && newItems.length === 0 && deletedTimestamps.length === 0) {
        window.showToast("Tidak ada perubahan", true);
        return;
    }
    
    const btn = document.getElementById('refresh-cache-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
    btn.disabled = true;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const ts of deletedTimestamps) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=deleteContentItem&adminId=${currentAdmin.id}&timestamp=${ts}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++; else failCount++;
        } catch(e) { failCount++; }
    }
    
    for (const newItem of newItems) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=addContentItem&adminId=${currentAdmin.id}&category=${newItem.category}&header=${encodeURIComponent(newItem.header)}&body=${encodeURIComponent(newItem.body)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++; else failCount++;
        } catch(e) { failCount++; }
    }
    
    for (const change of changes) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=updateContent&adminId=${currentAdmin.id}&timestamp=${change.timestamp}&field=${change.field}&value=${encodeURIComponent(change.value)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++; else failCount++;
        } catch(e) { failCount++; }
    }
    
    if (successCount > 0) {
        await fetch(`${window.GAS_ADMIN_URL}?action=refreshContentCache&adminId=${currentAdmin.id}`);
        window.showToast(`✅ ${successCount} item berhasil diperbarui${failCount > 0 ? `, ${failCount} gagal` : ''}`);
        await loadContentData();
        hasUnsavedChanges = false;
    } else {
        window.showToast("❌ Gagal memperbarui konten", true);
    }
    
    btn.innerHTML = originalHtml;
    btn.disabled = false;
};

// ==========================================
// COLLECT CHANGED FIELDS
// ==========================================
function collectChangedFields() {
    const changes = [];
    const newItems = [];
    const deletedTimestamps = [];
    
    document.querySelectorAll('.content-item[data-status="normal"]').forEach(item => {
        const ts = parseInt(item.dataset.timestamp);
        if (ts >= 0) return;
        const category = item.dataset.category;
        if (category !== 'profil' && category !== 'gallery') return;
        
        if (category === 'profil') {
            newItems.push({
                category: 'profil',
                header: item.querySelector('.content-header')?.value || '',
                body: item.querySelector('.content-body')?.value || ''
            });
        } else if (category === 'gallery') {
            const imgUrl = item.querySelector('.content-image-url')?.value || '';
            const caption = item.querySelector('.content-caption')?.value || '';
            newItems.push({
                category: 'gallery',
                header: item.querySelector('.content-header')?.value || '',
                body: buildGalleryBody(imgUrl, caption)
            });
        }
    });
    
    document.querySelectorAll('.content-item[data-status="deleted"]').forEach(item => {
        const ts = parseInt(item.dataset.timestamp);
        if (ts > 0) deletedTimestamps.push(ts);
    });
    
    document.querySelectorAll('.content-item[data-status="edited"]').forEach(item => {
        const ts = parseInt(item.dataset.timestamp);
        if (ts <= 0) return;
        const category = item.dataset.category;
        const originalData = currentContentData.find(d => getItemTs(d) === ts) || {};
        
        if (category === 'headline' || category === 'openmember') {
            const headerInput = item.querySelector('.content-header');
            const imageUrlInput = item.querySelector('.content-image-url');
            const captionInput = item.querySelector('.content-caption');
            
            if (headerInput && originalData.Header !== headerInput.value) {
                changes.push({ timestamp: ts, field: 'Header', value: headerInput.value });
            }
            if (imageUrlInput && captionInput) {
                const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
                if (originalData.Body !== newBody) {
                    changes.push({ timestamp: ts, field: 'Body', value: newBody });
                }
            }
        } else {
            const inputs = item.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                const field = input.dataset.field;
                if (!field || field === 'Caption' || field === 'ImageUrl') return;
                const originalValue = originalData[field] || '';
                if (input.value !== originalValue) {
                    changes.push({ timestamp: ts, field, value: input.value });
                }
            });
            
            if (category === 'gallery') {
                const imageUrlInput = item.querySelector('.content-image-url');
                const captionInput = item.querySelector('.content-caption');
                if (imageUrlInput && captionInput) {
                    const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
                    if (originalData.Body !== newBody) {
                        const idx = changes.findIndex(c => c.timestamp === ts && c.field === 'Body');
                        if (idx === -1) changes.push({ timestamp: ts, field: 'Body', value: newBody });
                        else changes[idx].value = newBody;
                    }
                }
            }
        }
    });
    
    return { changes, newItems, deletedTimestamps };
}

// ==========================================
// ADD / DELETE / UNDO ITEM
// ==========================================
window.addContentItem = function(category) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const tempTs = -Date.now();
    const newItemHtml = getNewItemHtml(category, tempTs);
    container.insertAdjacentHTML('beforeend', newItemHtml);
    
    const newItem = container.querySelector(`.content-item[data-timestamp="${tempTs}"]`);
    if (newItem) {
        const badge = newItem.querySelector('.item-badge');
        badge.textContent = 'BARU';
        badge.style.cssText = 'position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px; font-weight:bold; z-index:10;';
        badge.style.display = 'block';
        newItem.style.background = 'rgba(34, 197, 94, 0.1)';
        newItem.style.borderLeft = '3px solid #22c55e';
        
        newItem.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', () => { hasUnsavedChanges = true; });
        });
    }
    
    hasUnsavedChanges = true;
    window.showToast(`Item ${category} baru (klik PERBARUI untuk simpan)`);
};

function getNewItemHtml(category, ts) {
    if (category === 'profil') {
        return `
            <div class="content-item" data-timestamp="${ts}" data-category="profil" data-status="normal" style="position:relative;">
                <div class="item-badge" style="display:none;"></div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('profil', ${ts})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Header" data-timestamp="${ts}" data-field="Header">
                <textarea class="content-body" placeholder="Body" data-timestamp="${ts}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'gallery') {
        return `
            <div class="content-item" data-timestamp="${ts}" data-category="gallery" data-status="normal" style="position:relative;">
                <div class="item-badge" style="display:none;"></div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('gallery', ${ts})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Judul Event" data-timestamp="${ts}" data-field="Header">
                ${buildImageUrlInput(ts, 'ImageUrl', '', 'URL Gambar')}
                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-timestamp="${ts}" data-field="Caption"></textarea>
            </div>
        `;
    }
    return '';
}

window.deleteContentItem = function(category, timestamp) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    const item = container.querySelector(`.content-item[data-timestamp="${timestamp}"]`);
    if (!item) return;
    
    const isNewItem = timestamp < 0;
    
    if (isNewItem) {
        item.remove();
        window.showToast(`Item ${category} dihapus (belum disimpan)`);
    } else {
        const badge = item.querySelector('.item-badge');
        badge.textContent = 'DIHAPUS';
        badge.style.background = '#ff4444';
        badge.style.display = 'block';
        item.style.background = 'rgba(255, 68, 68, 0.1)';
        item.style.borderLeft = '3px solid #ff4444';
        item.style.opacity = '0.8';
        item.querySelectorAll('input, textarea, select').forEach(el => el.disabled = true);
        item.dataset.status = 'deleted';
        
        const deleteBtn = item.querySelector('.btn-delete-item');
        const undoBtn = item.querySelector('.btn-undo');
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (undoBtn) undoBtn.style.display = 'inline-block';
        
        window.showToast(`Item ${category} ditandai dihapus`);
        hasUnsavedChanges = true;
    }
};

window.undoDelete = function(category, timestamp) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    const item = container.querySelector(`.content-item[data-timestamp="${timestamp}"]`);
    if (!item) return;
    
    const badge = item.querySelector('.item-badge');
    const originalData = currentContentData.find(d => getItemTs(d) === timestamp) || {};
    
    let hasChanges = false;
    const headerInput = item.querySelector('.content-header');
    const bodyInput = item.querySelector('.content-body');
    const imageUrlInput = item.querySelector('.content-image-url');
    const captionInput = item.querySelector('.content-caption');
    
    if (headerInput && originalData.Header !== headerInput.value) hasChanges = true;
    if (bodyInput && originalData.Body !== bodyInput.value) hasChanges = true;
    if (imageUrlInput && captionInput) {
        const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
        if (originalData.Body !== newBody) hasChanges = true;
    }
    
    item.style.background = '';
    item.style.borderLeft = '';
    item.style.opacity = '';
    item.querySelectorAll('input, textarea, select').forEach(el => el.disabled = false);
    item.dataset.status = hasChanges ? 'edited' : 'normal';
    
    if (hasChanges) {
        badge.textContent = 'DIEDIT';
        badge.style.background = '#f59e0b';
        badge.style.display = 'block';
        item.style.background = 'rgba(245, 158, 11, 0.1)';
        item.style.borderLeft = '3px solid #f59e0b';
    } else {
        badge.style.display = 'none';
    }
    
    const deleteBtn = item.querySelector('.btn-delete-item');
    const undoBtn = item.querySelector('.btn-undo');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
    if (undoBtn) undoBtn.style.display = 'none';
    
    window.showToast(`Hapus dibatalkan`);
    hasUnsavedChanges = true;
};

// ==========================================
// BEFORE UNLOAD
// ==========================================
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum disimpan.';
        return e.returnValue;
    }
});

// ==========================================
// EXPOSE
// ==========================================
window.loadContentData = loadContentData;
window.updateAllContent = updateAllContent;
window.addContentItem = addContentItem;
window.deleteContentItem = deleteContentItem;
window.undoDelete = undoDelete;
window.triggerUpload = triggerUpload;
window.updateImagePreview = updateImagePreview;
window.collectChangedFields = collectChangedFields;
window.loadBackgroundPreview = loadBackgroundPreview;
window.uploadBackground = uploadBackground;
window.resetBackground = resetBackground;

console.log("✅ admin-content.js loaded (V8 — Dual File Background + SVG)");
