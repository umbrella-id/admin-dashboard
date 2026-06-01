/**
 * admin-content.js - Kelola Konten Web
 * Toggle Publish: ubah ID antara huruf kecil (published) dan huruf besar (draft)
 * Semua perubahan disimpan saat klik "PERBARUI KONTEN"
 */

let currentContentData = [];
let hasUnsavedChanges = false;
let originalValues = new Map();

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

function buildBody(imageUrl, caption) {
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
// DETEKSI PERUBAHAN & STATUS
// ==========================================
function detectChanges(itemElement, rowId, fields) {
    for (const [field, selector] of Object.entries(fields)) {
        const el = itemElement.querySelector(selector);
        if (el) {
            const original = originalValues.get(`${rowId}_${field}`);
            const current = el.value;
            if (original !== current) return true;
        }
    }
    return false;
}

function updateItemStatus(itemElement, rowId, status) {
    const existingBadge = itemElement.querySelector('.item-badge');
    if (existingBadge) existingBadge.remove();
    
    itemElement.classList.remove('content-item-new', 'content-item-edited', 'content-item-deleted');
    
    if (status === 'new') {
        itemElement.classList.add('content-item-new');
        itemElement.insertAdjacentHTML('afterbegin', '<div class="item-badge badge-new">BARU</div>');
        itemElement.dataset.status = 'new';
    } else if (status === 'edited') {
        itemElement.classList.add('content-item-edited');
        itemElement.insertAdjacentHTML('afterbegin', '<div class="item-badge badge-edited">DIEDIT</div>');
        itemElement.dataset.status = 'edited';
    } else if (status === 'deleted') {
        itemElement.classList.add('content-item-deleted');
        itemElement.insertAdjacentHTML('afterbegin', '<div class="item-badge badge-deleted">DIHAPUS</div>');
        itemElement.dataset.status = 'deleted';
    } else {
        itemElement.dataset.status = 'normal';
    }
}

function attachChangeListener(itemElement, rowId, fields) {
    for (const [field, selector] of Object.entries(fields)) {
        const el = itemElement.querySelector(selector);
        if (el) {
            el.addEventListener('input', () => {
                hasUnsavedChanges = true;
                const hasChanges = detectChanges(itemElement, rowId, fields);
                const currentStatus = itemElement.dataset.status;
                if (hasChanges && currentStatus !== 'new' && currentStatus !== 'deleted') {
                    updateItemStatus(itemElement, rowId, 'edited');
                } else if (!hasChanges && currentStatus === 'edited') {
                    updateItemStatus(itemElement, rowId, 'normal');
                }
            });
        }
    }
}

function storeOriginalValues(itemElement, rowId, fields) {
    for (const [field, selector] of Object.entries(fields)) {
        const el = itemElement.querySelector(selector);
        if (el) {
            originalValues.set(`${rowId}_${field}`, el.value);
        }
    }
    // Simpan juga ID asli untuk toggle publish
    const idEl = itemElement.querySelector('.publish-toggle');
    if (idEl) {
        originalValues.set(`${rowId}_publish`, idEl.checked);
    }
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
            originalValues.clear();
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
    
    // Gunakan includes() untuk mendeteksi kategori (case-insensitive)
    const headline = data.find(item => {
        const id = item.ID?.toLowerCase() || '';
        return id.includes('headline');
    });
    const openmember = data.find(item => {
        const id = item.ID?.toLowerCase() || '';
        return id.includes('openmember');
    });
    const profilList = data.filter(item => {
        const id = item.ID?.toLowerCase() || '';
        return id.includes('profil');
    });
    const galeryList = data.filter(item => {
        const id = item.ID?.toLowerCase() || '';
        return id.includes('galery');
    });
    const runningTexts = data.filter(item => {
        const id = item.ID?.toLowerCase() || '';
        return id.includes('running_text');
    });
    const sosmedList = data.filter(item => {
        const id = item.ID?.toLowerCase() || '';
        return id.includes('sosmed');
    });
    
    // Cek status publish (apakah ID huruf kecil = published, huruf besar = draft)
    const isPublished = (id) => {
        return id && id === id.toLowerCase();
    };
    
    let html = `
        <div class="content-editor">
            <!-- HEADLINE -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item" data-rowid="${headline?.rowId || 2}" data-status="normal">
                    <div class="item-actions">
                        <label class="toggle-publish">
                            <input type="checkbox" class="publish-toggle" data-rowid="${headline?.rowId || 2}" ${isPublished(headline?.ID) ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            <span class="toggle-label">Publish</span>
                        </label>
                    </div>
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <input type="text" class="content-image-url" placeholder="URL Gambar (opsional)" value="${escapeHtml(extractImageUrlFromBody(headline?.Body || ''))}" data-rowid="${headline?.rowId || 2}" data-field="ImageUrl">
                    <textarea class="content-caption" placeholder="Caption / Teks" data-rowid="${headline?.rowId || 2}" data-field="Caption">${escapeHtml(extractCaptionFromBody(headline?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item" data-rowid="${openmember?.rowId || 3}" data-status="normal">
                    <div class="item-actions">
                        <label class="toggle-publish">
                            <input type="checkbox" class="publish-toggle" data-rowid="${openmember?.rowId || 3}" ${isPublished(openmember?.ID) ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            <span class="toggle-label">Publish</span>
                        </label>
                    </div>
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
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal">
                            <div class="item-actions">
                                <label class="toggle-publish">
                                    <input type="checkbox" class="publish-toggle" data-rowid="${item.rowId}" ${isPublished(item.ID) ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                    <span class="toggle-label">Publish</span>
                                </label>
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
                            <div class="content-item" data-rowid="${item.rowId}" data-status="normal">
                                <div class="item-actions">
                                    <label class="toggle-publish">
                                        <input type="checkbox" class="publish-toggle" data-rowid="${item.rowId}" ${isPublished(item.ID) ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                        <span class="toggle-label">Publish</span>
                                    </label>
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
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal">
                            <div class="item-actions">
                                <label class="toggle-publish">
                                    <input type="checkbox" class="publish-toggle" data-rowid="${item.rowId}" ${isPublished(item.ID) ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                    <span class="toggle-label">Publish</span>
                                </label>
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
                        <div class="content-item" data-rowid="${item.rowId}" data-status="normal">
                            <div class="item-actions">
                                <label class="toggle-publish">
                                    <input type="checkbox" class="publish-toggle" data-rowid="${item.rowId}" ${isPublished(item.ID) ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                    <span class="toggle-label">Publish</span>
                                </label>
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
    
    // Simpan nilai asli dan pasang listener
    document.querySelectorAll('.content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const fields = {
            Header: '.content-header',
            Body: '.content-body',
            ImageUrl: '.content-image-url',
            Caption: '.content-caption',
            Platform: '.content-platform'
        };
        storeOriginalValues(item, rowId, fields);
        attachChangeListener(item, rowId, fields);
        
        // Listener untuk toggle publish (hanya update memory, tidak ke server)
        const toggle = item.querySelector('.publish-toggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                e.stopPropagation();
                const isChecked = toggle.checked;
                const rowId = parseInt(toggle.dataset.rowid);
                const currentId = currentContentData.find(d => d.rowId === rowId)?.ID || '';
                
                let newId;
                if (isChecked) {
                    // Publish: huruf kecil
                    newId = currentId.toLowerCase();
                } else {
                    // Draft: huruf besar
                    newId = currentId.toUpperCase();
                }
                
                if (currentId !== newId) {
                    // Tandai ada perubahan ID di memory
                    const index = currentContentData.findIndex(d => d.rowId === rowId);
                    if (index !== -1) {
                        currentContentData[index]._newId = newId;
                    }
                    hasUnsavedChanges = true;
                    updateItemStatus(item, rowId, 'edited');
                }
            });
        }
    });
}

// ==========================================
// TAMBAH & HAPUS ITEM (DOM ONLY)
// ==========================================
window.addContentItem = function(category) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const newRowId = -Date.now();
    const newId = category.toLowerCase(); // ID awal huruf kecil (published)
    
    let newItemHtml = '';
    if (category === 'profil') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-actions">
                    <label class="toggle-publish">
                        <input type="checkbox" class="publish-toggle" data-rowid="${newRowId}" checked>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Publish</span>
                    </label>
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Header" data-rowid="${newRowId}" data-field="Header">
                <textarea class="content-body" placeholder="Body" data-rowid="${newRowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'galery') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-actions">
                    <label class="toggle-publish">
                        <input type="checkbox" class="publish-toggle" data-rowid="${newRowId}" checked>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Publish</span>
                    </label>
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <input type="text" class="content-header" placeholder="Judul Event" data-rowid="${newRowId}" data-field="Header">
                <input type="text" class="content-image-url" placeholder="URL Gambar" data-rowid="${newRowId}" data-field="ImageUrl">
                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${newRowId}" data-field="Caption"></textarea>
            </div>
        `;
    } else if (category === 'running_text') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-actions">
                    <label class="toggle-publish">
                        <input type="checkbox" class="publish-toggle" data-rowid="${newRowId}" checked>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Publish</span>
                    </label>
                    <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
                </div>
                <textarea class="content-body" placeholder="Text" data-rowid="${newRowId}" data-field="Body"></textarea>
            </div>
        `;
    } else if (category === 'sosmed') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-actions">
                    <label class="toggle-publish">
                        <input type="checkbox" class="publish-toggle" data-rowid="${newRowId}" checked>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Publish</span>
                    </label>
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
    currentContentData.push({
        rowId: newRowId,
        ID: newId,
        Header: "",
        Body: "",
        _status: "new"
    });
    hasUnsavedChanges = true;
    window.showToast(`Item ${category} ditambahkan (belum disimpan)`);
    
    const newItem = container.lastElementChild;
    const fields = {
        Header: '.content-header',
        Body: '.content-body',
        ImageUrl: '.content-image-url',
        Caption: '.content-caption',
        Platform: '.content-platform'
    };
    storeOriginalValues(newItem, newRowId, fields);
    attachChangeListener(newItem, newRowId, fields);
    
    const toggle = newItem.querySelector('.publish-toggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            hasUnsavedChanges = true;
            updateItemStatus(newItem, newRowId, 'edited');
        });
    }
};

window.deleteContentItem = function(category, rowId) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const item = container.querySelector(`.content-item[data-rowid="${rowId}"]`);
    if (item && item.dataset.status !== 'deleted') {
        updateItemStatus(item, rowId, 'deleted');
        
        item.querySelectorAll('input, textarea, select, button').forEach(el => {
            if (el.classList && el.classList.contains('btn-delete-item')) {
                el.style.display = 'none';
            } else if (el.classList && el.classList.contains('publish-toggle')) {
                el.disabled = true;
            } else {
                el.disabled = true;
            }
        });
        
        const index = currentContentData.findIndex(d => d.rowId === rowId);
        if (index !== -1) currentContentData[index]._status = 'deleted';
        
        hasUnsavedChanges = true;
        window.showToast(`Item ${category} ditandai dihapus (belum permanen)`);
    }
};

// ==========================================
// KUMPULKAN PERUBAHAN
// ==========================================
function collectChangedFields() {
    const changes = [];
    const newItems = [];
    const deletedRows = [];
    
    document.querySelectorAll('.content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const status = item.dataset.status;
        
        if (status === 'new') {
            const category = item.closest('.content-category')?.id?.replace('-list', '') || 'profil';
            newItems.push({ category, rowId });
        } else if (status === 'deleted') {
            if (rowId > 0) deletedRows.push(rowId);
        } else if (rowId > 0) {
            const header = item.querySelector('.content-header')?.value || '';
            const body = item.querySelector('.content-body')?.value || '';
            const imageUrl = item.querySelector('.content-image-url')?.value || '';
            const caption = item.querySelector('.content-caption')?.value || '';
            const platform = item.querySelector('.content-platform')?.value || '';
            
            const oldItem = currentContentData.find(d => d.rowId === rowId);
            if (oldItem) {
                const newBody = buildBody(imageUrl, caption);
                if (oldItem.Header !== header) changes.push({ rowId, field: 'Header', value: header });
                if ((oldItem.Body || '') !== newBody) changes.push({ rowId, field: 'Body', value: newBody });
                if (platform && oldItem.Header !== platform) changes.push({ rowId, field: 'Header', value: platform });
                
                // Cek perubahan ID (publish/draft)
                if (oldItem._newId && oldItem.ID !== oldItem._newId) {
                    changes.push({ rowId, field: 'ID', value: oldItem._newId });
                }
            }
        }
    });
    
    return { changes, newItems, deletedRows };
}

// ==========================================
// SIMPAN SEMUA KE SERVER
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
    
    // 2. Hapus item
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
        originalValues.clear();
    } else {
        window.showToast("❌ Gagal memperbarui konten", true);
    }
    
    btn.innerHTML = originalHtml;
    btn.disabled = false;
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

console.log("✅ admin-content.js loaded (toggle publish hanya update memory)");
