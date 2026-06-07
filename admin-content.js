/**
 * admin-content.js - Kelola Konten Web
 * - Profil & Galery: bisa tambah/hapus (dengan badge)
 * - Headline & Openmember: slot tetap, bisa edit + URL gambar
 * - Running Text: slot tetap, hanya edit Body
 * - Sosmed: slot tetap (3 platform), hanya edit URL
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

//function escapeHtml

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
            <!-- HEADLINE (slot tetap, dengan URL gambar) -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item" data-rowid="${headline?.rowId || 2}" data-status="normal" style="position:relative;">
                    <div class="item-badge" style="display:none;"></div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <input type="text" class="content-image-url" placeholder="URL Gambar (opsional)" value="${escapeHtml(extractImageUrlFromBody(headline?.Body || ''))}" data-rowid="${headline?.rowId || 2}" data-field="ImageUrl">
                    <textarea class="content-caption" placeholder="Caption / Teks" data-rowid="${headline?.rowId || 2}" data-field="Caption">${escapeHtml(extractCaptionFromBody(headline?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER (slot tetap, dengan URL gambar) -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item" data-rowid="${openmember?.rowId || 3}" data-status="normal" style="position:relative;">
                    <div class="item-badge" style="display:none;"></div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-rowid="${openmember?.rowId || 3}" data-field="Header">
                    <input type="text" class="content-image-url" placeholder="URL Gambar (opsional)" value="${escapeHtml(extractImageUrlFromBody(openmember?.Body || ''))}" data-rowid="${openmember?.rowId || 3}" data-field="ImageUrl">
                    <textarea class="content-caption" placeholder="Caption / Teks" data-rowid="${openmember?.rowId || 3}" data-field="Caption">${escapeHtml(extractCaptionFromBody(openmember?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- PROFIL (bisa tambah/hapus) -->
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
            
            <!-- GALERY (bisa tambah/hapus) -->
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
            
            <!-- RUNNING TEXT (slot tetap, hanya body) -->
            <div class="content-category">
                <h4><i class="fas fa-scroll"></i> RUNNING TEXT</h4>
                <div id="runningtext-list">
                    ${runningTexts.map(item => `
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal" style="position:relative;">
                            <div class="item-badge" style="display:none;"></div>
                            <textarea class="content-body" placeholder="Text" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- SOSMED (slot tetap, 3 platform, hanya edit URL) -->
            <div class="content-category">
                <h4><i class="fas fa-share-alt"></i> SOSMED</h4>
                <div id="sosmed-list">
                    ${sosmedList.map(item => {
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
                            <div class="content-item" data-rowid="${item.rowId}" data-status="normal" style="position:relative;">
                                <div class="item-badge" style="display:none;"></div>
                                <div class="platform-label" style="margin-bottom:8px; color:var(--color-primary); font-weight:bold;">
                                    <i class="${iconClass}"></i> ${label}
                                </div>
                                <input type="text" class="content-body" placeholder="URL" value="${escapeHtml(item.Body || '')}" data-rowid="${item.rowId}" data-field="Body">
                            </div>
                        `;
                    }).join('')}
                </div>
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
    
    // ========== 1. CARI ITEM BARU (rowId negatif) ==========
    document.querySelectorAll('#profil-list .content-item, #galery-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId < 0) {
            if (item.closest('#profil-list')) {
                newItems.push({ category: 'profil', rowId });
            } else if (item.closest('#galery-list')) {
                newItems.push({ category: 'galery', rowId });
            }
        }
    });
    
    // ========== 2. CARI ITEM YANG DIHAPUS ==========
    document.querySelectorAll('.content-item[data-status="deleted"]').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId > 0) deletedRows.push(rowId);
    });
    
    // ========== 3. HEADLINE ==========
    const headlineItem = document.querySelector('.content-category:first-child .content-item');
    if (headlineItem) {
        const rowId = parseInt(headlineItem.dataset.rowid);
        if (rowId > 0) {
            const headerInput = headlineItem.querySelector('.content-header');
            const imageUrlInput = headlineItem.querySelector('.content-image-url');
            const captionInput = headlineItem.querySelector('.content-caption');
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
        }
    }
    
    // ========== 4. OPEN MEMBER ==========
    const openmemberItem = document.querySelector('.content-category:nth-child(2) .content-item');
    if (openmemberItem) {
        const rowId = parseInt(openmemberItem.dataset.rowid);
        if (rowId > 0) {
            const headerInput = openmemberItem.querySelector('.content-header');
            const imageUrlInput = openmemberItem.querySelector('.content-image-url');
            const captionInput = openmemberItem.querySelector('.content-caption');
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
        }
    }
    
    // ========== 5. PROFIL ==========
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
    
    // ========== 6. GALERY ==========
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
    
    // ========== 7. RUNNING TEXT ==========
    document.querySelectorAll('#runningtext-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const bodyInput = item.querySelector('.content-body');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
        if (bodyInput && originalData.Body !== bodyInput.value) {
            changes.push({ rowId, field: 'Body', value: bodyInput.value });
        }
    });
    
    // ========== 8. SOSMED ==========
    document.querySelectorAll('#sosmed-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        if (rowId <= 0) return;
        
        const bodyInput = item.querySelector('.content-body');
        const originalData = currentContentData.find(d => d.rowId === rowId) || {};
        
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
    
    // 1. Tambah item baru (profil/galery)
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
// TAMBAH ITEM (hanya untuk profil dan galery)
// ==========================================
window.addContentItem = async function(category) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    // Tampilkan form loading (sementara)
    const tempRowId = -Date.now();
    const loadingHtml = `
        <div class="content-item" data-rowid="${tempRowId}" style="opacity:0.5;">
            <div class="item-actions"><button disabled>⏳ Menyimpan...</button></div>
            <input type="text" class="content-header" placeholder="Header" disabled>
            <textarea class="content-body" placeholder="Body" disabled></textarea>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', loadingHtml);
    
    try {
        // Kirim ke server
        const url = `${window.GAS_ADMIN_URL}?action=addContentItem&category=${category}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success' && data.rowId) {
            // Ganti loading form dengan form aktif (pakai rowId asli dari server)
            const tempItem = container.querySelector(`.content-item[data-rowid="${tempRowId}"]`);
            const newItemHtml = getNewItemHtml(category, data.rowId);
            tempItem.outerHTML = newItemHtml;
            
            // Tambahkan ke currentContentData
            currentContentData.push({
                rowId: data.rowId,
                ID: category,
                Header: "",
                Body: "",
                _status: "new"
            });
            
            // Pasang listener untuk item baru
            const newItem = container.querySelector(`.content-item[data-rowid="${data.rowId}"]`);
            attachItemListeners(newItem, data.rowId);
            
            window.showToast(`Item ${category} berhasil ditambahkan`);
        } else {
            // Gagal: hapus loading form
            const tempItem = container.querySelector(`.content-item[data-rowid="${tempRowId}"]`);
            if (tempItem) tempItem.remove();
            window.showToast("Gagal menambahkan item", true);
        }
    } catch(e) {
        console.error("Add item error:", e);
        const tempItem = container.querySelector(`.content-item[data-rowid="${tempRowId}"]`);
        if (tempItem) tempItem.remove();
        window.showToast("Gagal koneksi", true);
    }
    
    hasUnsavedChanges = true;
};

// ==========================================
// FUNGSI BANTU UNTUK ITEM BARU
// ==========================================
function getNewItemHtml(category, rowId) {
    if (category === 'profil') {
        return `
            <div class="content-item" data-rowid="${rowId}" data-status="normal" style="position:relative;">
                <div class="item-badge" style="display:none;"></div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('profil', ${rowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Header" data-rowid="${rowId}" data-field="Header">
                <textarea class="content-body" placeholder="Body" data-rowid="${rowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'galery') {
        return `
            <div class="content-item" data-rowid="${rowId}" data-status="normal" style="position:relative;">
                <div class="item-badge" style="display:none;"></div>
                <div class="item-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
                    <button class="btn-delete-item" onclick="deleteContentItem('galery', ${rowId})" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; border-radius:8px; padding:6px 12px; color:#ff8888; cursor:pointer; font-size:0.7rem;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Judul Event" data-rowid="${rowId}" data-field="Header">
                <input type="text" class="content-image-url" placeholder="URL Gambar" data-rowid="${rowId}" data-field="ImageUrl">
                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${rowId}" data-field="Caption"></textarea>
            </div>
        `;
    }
    return '';
}

function attachItemListeners(item, rowId) {
    const badge = item.querySelector('.item-badge');
    const originalData = { Header: "", Body: "", ImageUrl: "", Caption: "" };
    const inputs = item.querySelectorAll('input, textarea, select');
    
    const checkChanges = () => {
        let hasChanged = false;
        inputs.forEach(input => {
            const field = input.dataset.field;
            const originalValue = originalData[field] || '';
            if (input.value !== originalValue) hasChanged = true;
        });
        
        if (hasChanged) {
            badge.textContent = 'DIEDIT';
            badge.style.background = '#f59e0b';
            badge.style.display = 'block';
            item.style.background = 'rgba(245, 158, 11, 0.1)';
            item.style.borderLeft = '3px solid #f59e0b';
            item.dataset.status = 'edited';
            hasUnsavedChanges = true;
        } else {
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
}

// ==========================================
// HAPUS ITEM (hanya untuk profil dan galery)
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
// BATAL HAPUS (hanya untuk profil dan galery)
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
window.addContentItem = addContentItem;
window.deleteContentItem = deleteContentItem;
window.undoDelete = undoDelete;

console.log("✅ admin-content.js loaded (final stabil)");
