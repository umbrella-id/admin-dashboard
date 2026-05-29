/**
 * admin-content.js - Kelola Konten Web (Hanya LEADER)
 */

let currentContentData = [];

async function loadContentData() {
    console.log("loadContentData dipanggil");
    const container = document.getElementById('content-editor-container');
    if (!container) {
        console.log("Container content-editor-container tidak ditemukan");
        return;
    }
    
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data konten...</div>';
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getAllContent`);
        const data = await res.json();
        
        if (data.status === 'success' && data.data) {
            currentContentData = data.data;
            renderContentEditor(currentContentData);
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
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-rowid="${headline?.rowId || 2}" data-field="Body">${escapeHtml(headline?.Body || '')}</textarea>
                </div>
            </div>
            
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-rowid="${openmember?.rowId || 3}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-rowid="${openmember?.rowId || 3}" data-field="Body">${escapeHtml(openmember?.Body || '')}</textarea>
                </div>
            </div>
            
            <div class="content-category">
                <h4><i class="fas fa-address-card"></i> PROFIL</h4>
                <div id="profil-list">
                    ${profilList.map(item => `
                        <div class="content-item">
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-rowid="${item.rowId}" data-field="Header">
                            <textarea class="content-body" placeholder="Body" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('profil', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('profil')"><i class="fas fa-plus"></i> Tambah Profil</button>
            </div>
            
            <div class="content-category">
                <h4><i class="fas fa-images"></i> GALERY</h4>
                <div id="galery-list">
                    ${galeryList.map(item => `
                        <div class="content-item">
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-rowid="${item.rowId}" data-field="Header">
                            <textarea class="content-body" placeholder="Body (HTML)" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('galery', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('galery')"><i class="fas fa-plus"></i> Tambah Galery</button>
            </div>
            
            <div class="content-category">
                <h4><i class="fas fa-scroll"></i> RUNNING TEXT</h4>
                <div id="runningtext-list">
                    ${runningTexts.map(item => `
                        <div class="content-item">
                            <textarea class="content-body" placeholder="Text" data-rowid="${item.rowId}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('running_text', ${item.rowId})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('running_text')"><i class="fas fa-plus"></i> Tambah Running Text</button>
            </div>
            
            <div class="content-category">
                <h4><i class="fas fa-share-alt"></i> SOSMED</h4>
                <div id="sosmed-list">
                    ${sosmedList.map(item => `
                        <div class="content-item">
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
}

function collectChangedFields() {
    const changes = [];
    
    document.querySelectorAll('.content-header, .content-body, .content-platform').forEach(el => {
        const rowId = parseInt(el.dataset.rowid);
        const field = el.dataset.field;
        const newValue = el.value;
        
        const oldItem = currentContentData.find(item => item.rowId === rowId);
        if (oldItem) {
            const oldValue = oldItem[field] || '';
            if (oldValue !== newValue) {
                changes.push({ rowId, field, value: newValue });
            }
        }
    });
    
    return changes;
}

window.updateAllContent = async function() {
    const changes = collectChangedFields();
    
    if (changes.length === 0) {
        window.showToast("Tidak ada perubahan", true);
        return;
    }
    
    const btn = document.getElementById('refresh-cache-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
    btn.disabled = true;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const change of changes) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=updateContent&rowId=${change.rowId}&field=${change.field}&value=${encodeURIComponent(change.value)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success') {
                successCount++;
            } else {
                failCount++;
                console.error("Gagal update:", change, data);
            }
        } catch(e) {
            failCount++;
            console.error("Error update:", change, e);
        }
    }
    
    if (successCount > 0) {
        await fetch(`${window.GAS_ADMIN_URL}?action=refreshContentCache`);
        window.showToast(`✅ ${successCount} item berhasil diperbarui${failCount > 0 ? `, ${failCount} gagal` : ''}`);
        await loadContentData();
    } else {
        window.showToast("❌ Gagal memperbarui konten", true);
    }
    
    btn.innerHTML = originalHtml;
    btn.disabled = false;
};

window.addContentItem = async function(category) {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=addContentItem&category=${category}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast("Item ditambahkan");
            await loadContentData();
        } else {
            window.showToast("Gagal tambah item", true);
        }
    } catch(e) {
        console.error("Add item error:", e);
        window.showToast("Gagal koneksi", true);
    }
};

window.deleteContentItem = async function(category, rowId) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteContentItem&rowId=${rowId}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast("Item dihapus");
            await loadContentData();
        } else {
            window.showToast("Gagal hapus item", true);
        }
    } catch(e) {
        console.error("Delete item error:", e);
        window.showToast("Gagal koneksi", true);
    }
};

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

console.log("✅ admin-content.js loaded");
