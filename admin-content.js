/**
 * admin-content.js - Kelola Konten Web
 * Dengan Image URL untuk Headline, Openmember, Profil, Galery
 * Tambah/hapus slot hanya di DOM (ditandai, tidak langsung ke server)
 */

let currentContentData = [];
let hasUnsavedChanges = false;

// Fungsi bantu ekstrak URL gambar dari Body
function extractImageUrlFromBody(body) {
    if (!body) return '';
    const match = body.match(/<img[^>]*src="([^"]+)"/);
    return match ? match[1] : '';
}

// Fungsi bantu ekstrak caption dari Body
function extractCaptionFromBody(body) {
    if (!body) return '';
    let text = body.replace(/<img[^>]*>/g, '');
    text = text.replace(/<\/?p>/g, '').trim();
    return text;
}

// Fungsi build Body dari imageUrl + caption
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

// Ambil data dari server (hanya sekali saat load)
async function loadContentData() {
    console.log("loadContentData dipanggil");
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

// Render form editor
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
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <input type="text" class="content-image-url" placeholder="URL Gambar (opsional)" value="${escapeHtml(extractImageUrlFromBody(headline?.Body || ''))}" data-rowid="${headline?.rowId || 2}" data-field="ImageUrl">
                    <textarea class="content-caption" placeholder="Caption / Teks" data-rowid="${headline?.rowId || 2}" data-field="Caption">${escapeHtml(extractCaptionFromBody(headline?.Body || ''))}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item">
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
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-rowid="${item.rowId}" data-field="Header">
                            <textarea class="content-body" placeholder="Body" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('profil', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
                                <input type="text" class="content-header" placeholder="Judul Event" value="${escapeHtml(item.Header || '')}" data-rowid="${item.rowId}" data-field="Header">
                                <input type="text" class="content-image-url" placeholder="URL Gambar" value="${escapeHtml(imageUrl)}" data-rowid="${item.rowId}" data-field="ImageUrl">
                                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${item.rowId}" data-field="Caption">${escapeHtml(caption)}</textarea>
                                <button class="btn-delete-item" onclick="deleteContentItem('galery', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
                            <textarea class="content-body" placeholder="Text" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('running_text', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
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
                            <select class="content-platform" data-rowid="${item.rowId}" data-field="Header">
                                <option value="whatsapp" ${item.Header === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                                <option value="facebook" ${item.Header === 'facebook' ? 'selected' : ''}>Facebook</option>
                                <option value="discord" ${item.Header === 'discord' ? 'selected' : ''}>Discord</option>
                            </select>
                            <input type="text" class="content-body" placeholder="URL" value="${escapeHtml(item.Body || '')}" data-rowid="${item.rowId}" data-field="Body">
                            <button class="btn-delete-item" onclick="deleteContentItem('sosmed', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('sosmed')"><i class="fas fa-plus"></i> Tambah Sosmed</button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    attachChangeListeners();
}

// Pasang listener untuk menandai ada perubahan
function attachChangeListeners() {
    document.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('change', () => { hasUnsavedChanges = true; });
        el.addEventListener('input', () => { hasUnsavedChanges = true; });
    });
}

// Tambah item (hanya di DOM, tidak ke server)
window.addContentItem = function(category) {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const newRowId = -Date.now(); // ID sementara (negatif)
    
    let newItemHtml = '';
    if (category === 'profil') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-badge badge-new">BARU</div>
                <input type="text" class="content-header" placeholder="Header" data-rowid="${newRowId}" data-field="Header">
                <textarea class="content-body" placeholder="Body" data-rowid="${newRowId}" data-field="Body"></textarea>
                <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
            </div>
        `;
    } else if (category === 'galery') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-badge badge-new">BARU</div>
                <input type="text" class="content-header" placeholder="Judul Event" data-rowid="${newRowId}" data-field="Header">
                <input type="text" class="content-image-url" placeholder="URL Gambar" data-rowid="${newRowId}" data-field="ImageUrl">
                <textarea class="content-caption" placeholder="Deskripsi / Caption" data-rowid="${newRowId}" data-field="Caption"></textarea>
                <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
            </div>
        `;
    } else if (category === 'running_text') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-badge badge-new">BARU</div>
                <textarea class="content-body" placeholder="Text" data-rowid="${newRowId}" data-field="Body"></textarea>
                <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
            </div>
        `;
    } else if (category === 'sosmed') {
        newItemHtml = `
            <div class="content-item content-item-new" data-rowid="${newRowId}" data-status="new">
                <div class="item-badge badge-new">BARU</div>
                <select class="content-platform" data-rowid="${newRowId}" data-field="Header">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="facebook">Facebook</option>
                    <option value="discord">Discord</option>
                </select>
                <input type="text" class="content-body" placeholder="URL" data-rowid="${newRowId}" data-field="Body">
                <button class="btn-delete-item" onclick="deleteContentItem('${category}', ${newRowId})"><i class="fas fa-trash"></i> Hapus</button>
            </div>
        `;
    }
    
    container.insertAdjacentHTML('beforeend', newItemHtml);
    currentContentData.push({
        rowId: newRowId,
        ID: category,
        Header: "",
        Body: "",
        ImageUrl: "",
        _status: "new"
    });
    hasUnsavedChanges = true;
    window.showToast(`Item ${category} ditambahkan (belum disimpan) - klik PERBARUI KONTEN untuk menyimpan`);
    
    attachChangeListeners();
};

// Hapus item (hanya di DOM, tidak ke server)
window.deleteContentItem = function(category, rowId) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    const item = container.querySelector(`.content-item[data-rowid="${rowId}"]`);
    if (item) {
        // Jika item sudah dalam status deleted, jangan dihapus lagi
        if (item.dataset.status === 'deleted') return;
        
        item.classList.add('content-item-deleted');
        item.dataset.status = 'deleted';
        
        // Tambahkan badge
        const existingBadge = item.querySelector('.item-badge');
        if (existingBadge) existingBadge.remove();
        item.insertAdjacentHTML('afterbegin', '<div class="item-badge badge-deleted">DIHAPUS</div>');
        
        // Nonaktifkan semua input di dalamnya
        item.querySelectorAll('input, textarea, select, button').forEach(el => {
            if (el.classList && el.classList.contains('btn-delete-item')) {
                // Tombol hapus jangan dinonaktifkan, tapi sembunyikan saja
                el.style.display = 'none';
            } else {
                el.disabled = true;
            }
        });
        
        // Tandai di currentContentData
        const index = currentContentData.findIndex(d => d.rowId === rowId);
        if (index !== -1) {
            currentContentData[index]._status = 'deleted';
        }
    }
    
    hasUnsavedChanges = true;
    window.showToast(`Item ${category} ditandai dihapus (belum permanen) - klik PERBARUI KONTEN untuk menyimpan`);
};

// Kumpulkan semua perubahan
function collectChangedFields() {
    const changes = [];
    const newItems = [];
    const deletedRows = [];
    
    // Handle headline & openmember (ImageUrl + Caption → Body)
    document.querySelectorAll('.content-category:first-child .content-item, .content-category:nth-child(2) .content-item').forEach(item => {
        const rowId = parseInt(item.querySelector('.content-header')?.dataset.rowid);
        const header = item.querySelector('.content-header')?.value || '';
        const imageUrl = item.querySelector('.content-image-url')?.value || '';
        const caption = item.querySelector('.content-caption')?.value || '';
        
        if (rowId && rowId > 0) {
            const oldItem = currentContentData.find(d => d.rowId === rowId);
            const newBody = buildBody(imageUrl, caption);
            
            if (oldItem) {
                if (oldItem.Header !== header) changes.push({ rowId, field: 'Header', value: header });
                if ((oldItem.Body || '') !== newBody) changes.push({ rowId, field: 'Body', value: newBody });
            }
        }
    });
    
    // Handle profil
    document.querySelectorAll('#profil-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const status = item.dataset.status;
        
        if (status === 'new') {
            newItems.push({ category: 'profil', rowId });
        } else if (status === 'deleted') {
            if (rowId > 0) deletedRows.push(rowId);
        } else if (rowId > 0) {
            const header = item.querySelector('.content-header')?.value || '';
            const body = item.querySelector('.content-body')?.value || '';
            const oldItem = currentContentData.find(d => d.rowId === rowId);
            if (oldItem) {
                if (oldItem.Header !== header) changes.push({ rowId, field: 'Header', value: header });
                if ((oldItem.Body || '') !== body) changes.push({ rowId, field: 'Body', value: body });
            }
        }
    });
    
    // Handle galery
    document.querySelectorAll('#galery-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const status = item.dataset.status;
        
        if (status === 'new') {
            newItems.push({ category: 'galery', rowId });
        } else if (status === 'deleted') {
            if (rowId > 0) deletedRows.push(rowId);
        } else if (rowId > 0) {
            const header = item.querySelector('.content-header')?.value || '';
            const imageUrl = item.querySelector('.content-image-url')?.value || '';
            const caption = item.querySelector('.content-caption')?.value || '';
            const newBody = buildBody(imageUrl, caption);
            const oldItem = currentContentData.find(d => d.rowId === rowId);
            if (oldItem) {
                if (oldItem.Header !== header) changes.push({ rowId, field: 'Header', value: header });
                if ((oldItem.Body || '') !== newBody) changes.push({ rowId, field: 'Body', value: newBody });
            }
        }
    });
    
    // Handle running text
    document.querySelectorAll('#runningtext-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const status = item.dataset.status;
        
        if (status === 'new') {
            newItems.push({ category: 'running_text', rowId });
        } else if (status === 'deleted') {
            if (rowId > 0) deletedRows.push(rowId);
        } else if (rowId > 0) {
            const body = item.querySelector('.content-body')?.value || '';
            const oldItem = currentContentData.find(d => d.rowId === rowId);
            if (oldItem && (oldItem.Body || '') !== body) changes.push({ rowId, field: 'Body', value: body });
        }
    });
    
    // Handle sosmed
    document.querySelectorAll('#sosmed-list .content-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const status = item.dataset.status;
        
        if (status === 'new') {
            newItems.push({ category: 'sosmed', rowId });
        } else if (status === 'deleted') {
            if (rowId > 0) deletedRows.push(rowId);
        } else if (rowId > 0) {
            const header = item.querySelector('.content-platform')?.value || '';
            const body = item.querySelector('.content-body')?.value || '';
            const oldItem = currentContentData.find(d => d.rowId === rowId);
            if (oldItem) {
                if ((oldItem.Header || '') !== header) changes.push({ rowId, field: 'Header', value: header });
                if ((oldItem.Body || '') !== body) changes.push({ rowId, field: 'Body', value: body });
            }
        }
    });
    
    return { changes, newItems, deletedRows };
}

// Update semua konten ke server
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
        } catch(e) {
            failCount++;
        }
    }
    
    // 2. Hapus item yang ditandai
    for (const rowId of deletedRows) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=deleteContentItem&rowId=${rowId}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) {
            failCount++;
        }
    }
    
    // 3. Update perubahan
    for (const change of changes) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=updateContent&rowId=${change.rowId}&field=${change.field}&value=${encodeURIComponent(change.value)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') successCount++;
            else failCount++;
        } catch(e) {
            failCount++;
        }
    }
    
    if (successCount > 0) {
        await fetch(`${window.GAS_ADMIN_URL}?action=refreshContentCache`);
        window.showToast(`✅ ${successCount} item berhasil diperbarui${failCount > 0 ? `, ${failCount} gagal` : ''}`);
        await loadContentData(); // reload data fresh
        hasUnsavedChanges = false;
    } else {
        window.showToast("❌ Gagal memperbarui konten", true);
    }
    
    btn.innerHTML = originalHtml;
    btn.disabled = false;
};

// Warning sebelum refresh jika ada perubahan
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

window.loadContentData = loadContentData;
window.updateAllContent = updateAllContent;
window.addContentItem = addContentItem;
window.deleteContentItem = deleteContentItem;

console.log("✅ admin-content.js loaded (dengan status BARU/DIHAPUS)");
