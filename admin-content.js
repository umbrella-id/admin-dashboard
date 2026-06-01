/**
 * admin-content.js - Kelola Konten Web
 * - 3 Badge: BARU (hijau), DIEDIT (kuning), DIHAPUS (merah)
 * - Running text bisa ditambah/dihapus
 * - Headline & Openmember bisa URL gambar
 * - Tombol batal hapus dengan styling rapi
 */

let currentContentData = [];
let hasUnsavedChanges = false;

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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ==========================================
// LOAD & RENDER DATA
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
    const galeryList = data.filter(item => item.ID?.toLowerCase() === 'galery');
    const runningTexts = data.filter(item => item.ID?.toLowerCase() === 'running_text');
    const sosmedList = data.filter(item => item.ID?.toLowerCase() === 'sosmed');
    
    let html = `
        <div class="content-editor">
            <!-- HEADLINE (dengan URL Gambar) -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item" data-rowid="${headline?.rowId || 2}" data-status="normal" style="position:relative;">
                    <div class="item-badge" style="display:none;"></div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <input type="text" class="content-image-url" placeholder="URL Gambar (opsional)" value="${escapeHtml(extractImageUrlFromBody(headline?.Body || ''))}" data-rowid="${headline?.rowId || 2}" data-field="ImageUrl">
                    <textarea class="content-caption" placeholder="Caption / Teks" data-rowid="${headline?.rowId || 2}" data-field="Caption">${escapeHtml(extractCaptionFromBody(headline?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER (dengan URL Gambar) -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item" data-rowid="${openmember?.rowId || 3}" data-status="normal" style="position:relative;">
                    <div class="item-badge" style="display:none;"></div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-rowid="${openmember?.rowId || 3}" data-field="Header">
                    <input type="text" class="content-image-url" placeholder="URL Gambar (opsional)" value="${escapeHtml(extractImageUrlFromBody(openmember?.Body || ''))}" data-rowid="${openmember?.rowId || 3}" data-field="ImageUrl">
                    <textarea class="content-caption" placeholder="Caption / Teks" data-rowid="${openmember?.rowId || 3}" data-field="Caption">${escapeHtml(extractCaptionFromBody(openmember?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- PROFIL -->
            <div class="content-category">
                <h4><i class="fas fa-address-card"></i> PROFIL</h4>
                <div id="profil-list">
                    ${profilList.map(item => `
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal" style="position:relative;">
                            <div class="item-badge" style="display:none;"></div>
                            <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                                <button class="btn-undo" onclick="undoDelete('profil', ${item.rowId})" style="display:none; background:rgba(34,197,94,0.2); border:1px solid #22c55e; border-radius:8px; padding:6px 12px; color:#4ade80; cursor:pointer; font-size:0.7rem;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('profil', ${item.rowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                            </div>
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-rowid="${item.rowId}" data-field="Header">
                            <textarea class="content-body" placeholder="Body" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('profil')"><i class="fas fa-plus"></i> Tambah Profil</button>
            </div>
            
            <!-- GALERY -->
            <div class="content-category">
                <h4><i class="fas fa-images"></i> GALERY</h4>
                <div id="galery-list">
                    ${galeryList.map(item => {
                        const imageUrl = extractImageUrlFromBody(item.Body || '');
                        const caption = extractCaptionFromBody(item.Body || '');
                        return `
                            <div class="content-item" data-rowid="${item.rowId}" data-status="normal" style="position:relative;">
                                <div class="item-badge" style="display:none;"></div>
                                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                                    <button class="btn-undo" onclick="undoDelete('galery', ${item.rowId})" style="display:none; background:rgba(34,197,94,0.2); border:1px solid #22c55e; border-radius:8px; padding:6px 12px; color:#4ade80; cursor:pointer; font-size:0.7rem;">↩️ Batal</button>
                                    <button class="btn-delete-item" onclick="deleteContentItem('galery', ${item.rowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                                </div>
                                <input type="text" class="content-header" placeholder="Judul Event" value="${escapeHtml(item.Header || '')}" data-rowid="${item.rowId}" data-field="Header">
                                <input type="text" class="content-image-url" placeholder="URL Gambar" value="${escapeHtml(imageUrl)}" data-rowid="${item.rowId}" data-field="ImageUrl">
                                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${item.rowId}" data-field="Caption">${escapeHtml(caption)}</textarea>
                            </div>
                        `;
                    }).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('galery')"><i class="fas fa-plus"></i> Tambah Galery</button>
            </div>
            
            <!-- RUNNING TEXT -->
            <div class="content-category">
                <h4><i class="fas fa-scroll"></i> RUNNING TEXT</h4>
                <div id="runningtext-list">
                    ${runningTexts.map(item => `
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal" style="position:relative;">
                            <div class="item-badge" style="display:none;"></div>
                            <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                                <button class="btn-undo" onclick="undoDelete('running_text', ${item.rowId})" style="display:none; background:rgba(34,197,94,0.2); border:1px solid #22c55e; border-radius:8px; padding:6px 12px; color:#4ade80; cursor:pointer; font-size:0.7rem;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('running_text', ${item.rowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                            </div>
                            <textarea class="content-body" placeholder="Text" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('running_text')"><i class="fas fa-plus"></i> Tambah Running Text</button>
            </div>
            
            <!-- SOSMED -->
            <div class="content-category">
                <h4><i class="fas fa-share-alt"></i> SOSMED</h4>
                <div id="sosmed-list">
                    ${sosmedList.map(item => `
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal" style="position:relative;">
                            <div class="item-badge" style="display:none;"></div>
                            <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                                <button class="btn-undo" onclick="undoDelete('sosmed', ${item.rowId})" style="display:none; background:rgba(34,197,94,0.2); border:1px solid #22c55e; border-radius:8px; padding:6px 12px; color:#4ade80; cursor:pointer; font-size:0.7rem;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('sosmed', ${item.rowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                            </div>
                            <select class="content-platform" data-rowid="${item.rowId}" data-field="Header">
                                <option value="whatsapp" ${item.Header === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                                <option value="facebook" ${item.Header === 'facebook' ? 'selected' : ''}>Facebook</option>
                                <option value="discord" ${item.Header === 'discord' ? 'selected' : ''}>Discord</option>
                            </select>
                            <input type="text" class="content-body" placeholder="URL" value="${escapeHtml(item.Body || '')}" data-rowid="${item.rowId}" data-field="Body">
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('sosmed')"><i class="fas fa-plus"></i> Tambah Sosmed</button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Pasang listener untuk badge
    document.querySelectorAll('.content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const isNewItem = rowId < 0;
        const badge = item.querySelector('.item-badge');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (isNewItem && !item.hasAttribute('data-processed')) {
            badge.textContent = 'BARU';
            badge.style.cssText = 'position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px; font-weight:bold; z-index:10;';
            badge.style.display = 'block';
            item.style.background = 'rgba(34, 197, 94, 0.1)';
            item.style.borderLeft = '3px solid #22c55e';
            item.setAttribute('data-processed', 'true');
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
}

// ==========================================
// KUMPULKAN PERUBAHAN
// ==========================================
function collectChangedFields() {
    const changes = [];
    const newItems = [];
    const deletedRows = [];
    
    // Cari item baru (rowId negatif)
    document.querySelectorAll('.content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId < 0) {
            const category = item.closest('.content-category')?.id?.replace('-list', '');
            newItems.push({ category, rowId });
        }
    });
    
    // Cari item yang dihapus
    document.querySelectorAll('.content-item[data-status="deleted"]').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId > 0) deletedRows.push(rowId);
    });
    
    // Handle HEADLINE & OPEN MEMBER (dengan ImageUrl + Caption)
    document.querySelectorAll('.content-category:first-child .content-item, .content-category:nth-child(2) .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const headerInput = item.querySelector('.content-header');
        const imageUrlInput = item.querySelector('.content-image-url');
        const captionInput = item.querySelector('.content-caption');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (headerInput && originalData.Header !== headerInput.value) {
            changes.push({ rowId, field: 'Header', value: headerInput.value });
        }
        
        if (imageUrlInput && captionInput) {
            const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
            if (originalData.Body !== newBody) {
                changes.push({ rowId, field: 'Body', value: newBody });
            }
        }
    });
    
    // Handle PROFIL
    document.querySelectorAll('#profil-list .content-item:not([data-status="deleted"])').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const headerInput = item.querySelector('.content-header');
        const bodyInput = item.querySelector('.content-body');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (headerInput && originalData.Header !== headerInput.value) {
            changes.push({ rowId, field: 'Header', value: headerInput.value });
        }
        if (bodyInput && originalData.Body !== bodyInput.value) {
            changes.push({ rowId, field: 'Body', value: bodyInput.value });
        }
    });
    
    // Handle GALERY
    document.querySelectorAll('#galery-list .content-item:not([data-status="deleted"])').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const headerInput = item.querySelector('.content-header');
        const imageUrlInput = item.querySelector('.content-image-url');
        const captionInput = item.querySelector('.content-caption');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (headerInput && originalData.Header !== headerInput.value) {
            changes.push({ rowId, field: 'Header', value: headerInput.value });
        }
        
        if (imageUrlInput && captionInput) {
            const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
            if (originalData.Body !== newBody) {
                changes.push({ rowId, field: 'Body', value: newBody });
            }
        }
    });
    
    // Handle RUNNING TEXT
    document.querySelectorAll('#runningtext-list .content-item:not([data-status="deleted"])').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const bodyInput = item.querySelector('.content-body');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (bodyInput && originalData.Body !== bodyInput.value) {
            changes.push({ rowId, field: 'Body', value: bodyInput.value });
        }
    });
    
    // Handle SOSMED
    document.querySelectorAll('#sosmed-list .content-item:not([data-status="deleted"])').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const platformSelect = item.querySelector('.content-platform');
        const bodyInput = item.querySelector('.content-body');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (platformSelect && originalData.Header !== platformSelect.value) {
            changes.push({ rowId, field: 'Header', value: platformSelect.value });
        }
        if (bodyInput && originalData.Body !== bodyInput.value) {
            changes.push({ rowId, field: 'Body', value: bodyInput.value });
        }
    });
    
    return { changes, newItems, deletedRows };
}

// ==========================================
// UPDATE KE SERVER
// ==========================================
window.updateAllContent = async function() {
    const { changes, newItems, deletedRows } = collectChangedFields();
    
    if (changes.length === 0 && newItems.length === 0 && deletedRows.length === 0) {
        window.showToast("Tidak ada perubahan", true);
        return;
    }
    
    const btn = document.getElementById('refresh-cache-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
    btn.disabled = true;
    
    let successCount = 0;
    let failCount = 0;
    
    // 1. Tambah item baru
    for (const newItem of newItems) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=addContentItem&category=${newItem.category}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) { failCount++; }
    }
    
    // 2. Hapus item yang ditandai
    for (const rowId of deletedRows) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=deleteContentItem&rowId=${rowId}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) { failCount++; }
    }
    
    // 3. Update perubahan
    for (const change of changes) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=updateContent&rowId=${change.rowId}&field=${change.field}&value=${encodeURIComponent(change.value)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) { failCount++; }
    }
    
    if (successCount > 0) {
        await fetch(`${window.GAS_ADMIN_URL}?action=refreshContentCache`);
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
// TAMBAH ITEM
// ==========================================
window.addContentItem = function(category) {
    const containerId = `${category}-list`;
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Container not found:", containerId);
        return;
    }
    
    const newRowId = -Date.now();
    let newItemHtml = '';
    
    if (category === 'profil') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" data-status="new" style="position:relative; background:rgba(34,197,94,0.1); border-left:3px solid #22c55e;">
                <div class="item-badge" style="position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px;">BARU</div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Header" data-rowid="${newRowId}" data-field="Header">
                <textarea class="content-body" placeholder="Body" data-rowid="${newRowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'galery') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" data-status="new" style="position:relative; background:rgba(34,197,94,0.1); border-left:3px solid #22c55e;">
                <div class="item-badge" style="position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px;">BARU</div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Judul Event" data-rowid="${newRowId}" data-field="Header">
                <input type="text" class="content-image-url" placeholder="URL Gambar" data-rowid="${newRowId}" data-field="ImageUrl">
                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${newRowId}" data-field="Caption"></textarea>
            </div>
        `;
    } else if (category === 'running_text') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" data-status="new" style="position:relative; background:rgba(34,197,94,0.1); border-left:3px solid #22c55e;">
                <div class="item-badge" style="position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px;">BARU</div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('running_text', ${newRowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <textarea class="content-body" placeholder="Text" data-rowid="${newRowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'sosmed') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" data-status="new" style="position:relative; background:rgba(34,197,94,0.1); border-left:3px solid #22c55e;">
                <div class="item-badge" style="position:absolute; top:-8px; right:10px; background:#22c55e; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px;">BARU</div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('sosmed', ${newRowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <select class="content-platform" data-rowid="${newRowId}" data-field="Header">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="facebook">Facebook</option>
                    <option value="discord">Discord</option>
                </select>
                <input type="text" class="content-body" placeholder="URL" data-rowid="${newRowId}" data-field="Body">
            </div>
        `;
    }
    
    container.insertAdjacentHTML('beforeend', newItemHtml);
    hasUnsavedChanges = true;
    window.showToast(`Item ${category} ditambahkan (belum disimpan)`);
};

// ==========================================
// HAPUS ITEM
// ==========================================
window.deleteContentItem = function(category, rowId) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    
    const containerId = `${category}-list`;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const item = container.querySelector(`.content-item[data-rowid="${rowId}"]`);
    if (!item) return;
    
    const isNewItem = rowId < 0;
    
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
        
        window.showToast(`Item ${category} ditandai dihapus (klik Batal untuk membatalkan)`);
        hasUnsavedChanges = true;
    }
};

// ==========================================
// BATAL HAPUS
// ==========================================
window.undoDelete = function(category, rowId) {
    const containerId = `${category}-list`;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const item = container.querySelector(`.content-item[data-rowid="${rowId}"]`);
    if (!item) return;
    
    const badge = item.querySelector('.item-badge');
    const originalData = currentContentData.find(d => d.rowId === rowId) || {};
    
    let hasChanges = false;
    const headerInput = item.querySelector('.content-header');
    const bodyInput = item.querySelector('.content-body');
    const imageUrlInput = item.querySelector('.content-image-url');
    const captionInput = item.querySelector('.content-caption');
    const platformSelect = item.querySelector('.content-platform');
    
    if (headerInput && originalData.Header !== headerInput.value) hasChanges = true;
    if (bodyInput && originalData.Body !== bodyInput.value) hasChanges = true;
    if (imageUrlInput && captionInput) {
        const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
        if (originalData.Body !== newBody) hasChanges = true;
    }
    if (platformSelect && originalData.Header !== platformSelect.value) hasChanges = true;
    
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
    
    const index = currentContentData.findIndex(d => d.rowId === rowId);
    if (index !== -1) delete currentContentData[index]._deleted;
    
    window.showToast(`Hapus dibatalkan untuk item ${category}`);
    hasUnsavedChanges = true;
};

// ==========================================
// WARNING SEBELUM REFRESH
// ==========================================
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

// ==========================================
// EXPOSE
// ==========================================
window.loadContentData = loadContentData;
window.updateAllContent = updateAllContent;
window.addContentItem
