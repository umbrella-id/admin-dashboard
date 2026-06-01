/**
 * admin-content.js - Kelola Konten Web
 * - Update hanya field yang berubah
 * - Tambah/hapus slot DOM only
 * - Tanda untuk item yang diedit (badge)
 * - Tombol batal hapus untuk item yang ditandai hapus
 */

let currentContentData = [];
let hasUnsavedChanges = false;

// Fungsi bantu
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

// Load data
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

// Render form
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
            <!-- HEADLINE -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item" data-rowid="${headline?.rowId || 2}" data-original='${JSON.stringify(headline || {})}'>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-rowid="${headline?.rowId || 2}" data-field="Body">${escapeHtml(headline?.Body || '')}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item" data-rowid="${openmember?.rowId || 3}" data-original='${JSON.stringify(openmember || {})}'>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-rowid="${openmember?.rowId || 3}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-rowid="${openmember?.rowId || 3}" data-field="Body">${escapeHtml(openmember?.Body || '')}</textarea>
                </div>
            </div>
            
            <!-- PROFIL -->
            <div class="content-category">
                <h4><i class="fas fa-address-card"></i> PROFIL</h4>
                <div id="profil-list">
                    ${profilList.map(item => `
                        <div class="content-item" data-rowid="${item.rowId}" data-original='${JSON.stringify(item)}'>
                            <div class="item-actions">
                                <button class="btn-undo" onclick="undoDelete('profil', ${item.rowId})" style="display:none;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('profil', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
                            <div class="content-item" data-rowid="${item.rowId}" data-original='${JSON.stringify(item)}'>
                                <div class="item-actions">
                                    <button class="btn-undo" onclick="undoDelete('galery', ${item.rowId})" style="display:none;">↩️ Batal</button>
                                    <button class="btn-delete-item" onclick="deleteContentItem('galery', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
                        <div class="content-item" data-rowid="${item.rowId}" data-original='${JSON.stringify(item)}'>
                            <div class="item-actions">
                                <button class="btn-undo" onclick="undoDelete('running_text', ${item.rowId})" style="display:none;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('running_text', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
                        <div class="content-item" data-rowid="${item.rowId}" data-original='${JSON.stringify(item)}'>
                            <div class="item-actions">
                                <button class="btn-undo" onclick="undoDelete('sosmed', ${item.rowId})" style="display:none;">↩️ Batal</button>
                                <button class="btn-delete-item" onclick="deleteContentItem('sosmed', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
    
    // Pasang listener deteksi perubahan untuk badge "DIEDIT"
    document.querySelectorAll('.content-item').forEach(item => {
        const inputs = item.querySelectorAll('input, textarea, select');
        const originalData = JSON.parse(item.dataset.original || '{}');
        const badge = document.createElement('div');
        badge.className = 'edit-badge';
        badge.textContent = 'DIEDIT';
        badge.style.display = 'none';
        badge.style.cssText = 'position:absolute; top:-8px; right:10px; background:#f59e0b; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px;';
        item.style.position = 'relative';
        item.appendChild(badge);
        
        const checkChanges = () => {
            let hasChanged = false;
            inputs.forEach(input => {
                const field = input.dataset.field;
                const originalValue = originalData[field] || '';
                if (input.value !== originalValue) hasChanged = true;
            });
            badge.style.display = hasChanged ? 'block' : 'none';
            if (hasChanged) hasUnsavedChanges = true;
        };
        
        inputs.forEach(input => {
            input.addEventListener('input', checkChanges);
        });
    });
}

// Kumpulkan perubahan (hanya field yang berubah)
function collectChangedFields() {
    const changes = [];
    const newItems = [];
    const deletedRows = [];
    
    // Cari item baru (rowId negatif)
    document.querySelectorAll('.content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId < 0) {
            const category = item.closest('.content-category')?.id?.replace('-list', '');
            newItems.push({ category, rowId, item });
        }
    });
    
    // Cari item yang dihapus (ditandai)
    document.querySelectorAll('.content-item[data-deleted="true"]').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId > 0) deletedRows.push(rowId);
    });
    
    // Cari perubahan field
    document.querySelectorAll('.content-item:not([data-deleted="true"])').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const originalData = JSON.parse(item.dataset.original || '{}');
        
        // Header
        const headerInput = item.querySelector('.content-header');
        if (headerInput && originalData.Header !== headerInput.value) {
            changes.push({ rowId, field: 'Header', value: headerInput.value });
        }
        
        // Body (untuk running text, profil, headline, openmember)
        const bodyInput = item.querySelector('.content-body');
        if (bodyInput && originalData.Body !== bodyInput.value) {
            changes.push({ rowId, field: 'Body', value: bodyInput.value });
        }
        
        // ImageUrl & Caption untuk galery
        const imageUrlInput = item.querySelector('.content-image-url');
        const captionInput = item.querySelector('.content-caption');
        if (imageUrlInput && captionInput) {
            const newBody = buildGalleryBody(imageUrlInput.value, captionInput.value);
            if (originalData.Body !== newBody) {
                changes.push({ rowId, field: 'Body', value: newBody });
            }
        }
        
        // Platform untuk sosmed
        const platformSelect = item.querySelector('.content-platform');
        if (platformSelect && originalData.Header !== platformSelect.value) {
            changes.push({ rowId, field: 'Header', value: platformSelect.value });
        }
    });
    
    return { changes, newItems, deletedRows };
}

// Update semua konten
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
    
    // Tambah item baru
    for (const newItem of newItems) {
        const category = newItem.category;
        try {
            const url = `${window.GAS_ADMIN_URL}?action=addContentItem&category=${category}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) { failCount++; }
    }
    
    // Hapus item yang ditandai
    for (const rowId of deletedRows) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=deleteContentItem&rowId=${rowId}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) { failCount++; }
    }
    
    // Update perubahan
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

// TAMBAH ITEM (DOM only)
window.addContentItem = function(category) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const newRowId = -Date.now();
    
    let newItemHtml = '';
    if (category === 'profil') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e;">
                <div class="item-actions">
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Header" data-rowid="${newRowId}" data-field="Header">
                <textarea class="content-body" placeholder="Body" data-rowid="${newRowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'galery') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e;">
                <div class="item-actions">
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Judul Event" data-rowid="${newRowId}" data-field="Header">
                <input type="text" class="content-image-url" placeholder="URL Gambar" data-rowid="${newRowId}" data-field="ImageUrl">
                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${newRowId}" data-field="Caption"></textarea>
            </div>
        `;
    } else if (category === 'running_text') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e;">
                <div class="item-actions">
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <textarea class="content-body" placeholder="Text" data-rowid="${newRowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'sosmed') {
        newItemHtml = `
            <div class="content-item" data-rowid="${newRowId}" style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e;">
                <div class="item-actions">
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
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

// HAPUS ITEM
window.deleteContentItem = function(category, rowId) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const item = container.querySelector(`.content-item[data-rowid="${rowId}"]`);
    if (!item) return;
    
    const isNewItem = rowId < 0;
    
    if (isNewItem) {
        item.remove();
        window.showToast(`Item ${category} dihapus (belum disimpan)`);
    } else {
        // Tandai dihapus
        item.style.background = 'rgba(255, 68, 68, 0.1)';
        item.style.borderLeft = '3px solid #ff4444';
        item.style.opacity = '0.7';
        item.querySelectorAll('input, textarea, select').forEach(el => el.disabled = true);
        item.setAttribute('data-deleted', 'true');
        
        // Sembunyikan tombol hapus, tampilkan tombol batal
        const deleteBtn = item.querySelector('.btn-delete-item');
        const undoBtn = item.querySelector('.btn-undo');
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (undoBtn) undoBtn.style.display = 'inline-block';
        
        window.showToast(`Item ${category} ditandai dihapus (klik Batal untuk membatalkan)`);
        hasUnsavedChanges = true;
    }
};

// BATAL HAPUS (UNDO)
window.undoDelete = function(category, rowId) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const item = container.querySelector(`.content-item[data-rowid="${rowId}"]`);
    if (!item) return;
    
    // Kembalikan ke tampilan normal
    item.style.background = '';
    item.style.borderLeft = '';
    item.style.opacity = '';
    item.querySelectorAll('input, textarea, select').forEach(el => el.disabled = false);
    item.removeAttribute('data-deleted');
    
    // Tampilkan tombol hapus, sembunyikan tombol batal
    const deleteBtn = item.querySelector('.btn-delete-item');
    const undoBtn = item.querySelector('.btn-undo');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
    if (undoBtn) undoBtn.style.display = 'none';
    
    // Hapus tanda _deleted dari currentContentData
    const index = currentContentData.findIndex(d => d.rowId === rowId);
    if (index !== -1) delete currentContentData[index]._deleted;
    
    window.showToast(`Hapus dibatalkan untuk item ${category}`);
    hasUnsavedChanges = true;
};

// Warning sebelum refresh
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

window.loadContentData = loadContentData;
window.updateAllContent = updateAllContent;
window.addContentItem = addContentItem;
window.deleteContentItem = deleteContentItem;
window.undoDelete = undoDelete;

console.log("✅ admin-content.js loaded (dengan edit badge, undo delete, running text fix)");
