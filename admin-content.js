/**
 * admin-content.js - Kelola Konten Web (Hanya LEADER)
 */

let currentContentData = [];

// Ambil semua data konten dari GAS 4
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
        } else {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data konten</div>';
        }
    } catch(e) {
        console.error("Load content error:", e);
        container.innerHTML = '<div class="empty-state">⚠️ Koneksi gagal</div>';
    }
}

// Render form editor konten
function renderContentEditor(data) {
    const container = document.getElementById('content-editor-container');
    if (!container) return;
    
    // Kelompokkan data berdasarkan kategori
    const headline = data.find(item => item.ID?.toLowerCase() === 'headline');
    const openmember = data.find(item => item.ID?.toLowerCase() === 'openmember');
    const profilList = data.filter(item => item.ID?.toLowerCase() === 'profil');
    const galeryList = data.filter(item => item.ID?.toLowerCase() === 'galery');
    const runningTexts = data.filter(item => item.ID?.toLowerCase() === 'running_text');
    const sosmedList = data.filter(item => item.ID?.toLowerCase() === 'sosmed');
    
    let html = `
        <div class="content-editor">
            <!-- HEADLINE (1 slot) -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-id="${headline?.ID || 'headline'}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-id="${headline?.ID || 'headline'}" data-field="Body">${escapeHtml(headline?.Body || '')}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER (1 slot) -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-id="${openmember?.ID || 'openmember'}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-id="${openmember?.ID || 'openmember'}" data-field="Body">${escapeHtml(openmember?.Body || '')}</textarea>
                </div>
            </div>
            
            <!-- PROFIL (bisa tambah/hapus) -->
            <div class="content-category">
                <h4><i class="fas fa-address-card"></i> PROFIL</h4>
                <div id="profil-list">
                    ${profilList.map((item, idx) => `
                        <div class="content-item" data-idx="${idx}">
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Header">
                            <textarea class="content-body" placeholder="Body" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('profil', ${item.rowId || idx})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('profil')"><i class="fas fa-plus"></i> Tambah Profil</button>
            </div>
            
            <!-- GALERY (bisa tambah/hapus) -->
            <div class="content-category">
                <h4><i class="fas fa-images"></i> GALERY</h4>
                <div id="galery-list">
                    ${galeryList.map((item, idx) => `
                        <div class="content-item" data-idx="${idx}">
                            <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(item.Header || '')}" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Header">
                            <textarea class="content-body" placeholder="Body" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <input type="text" class="content-image" placeholder="Image URL" value="${escapeHtml(item.ImageURL || '')}" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="ImageURL">
                            <button class="btn-delete-item" onclick="deleteContentItem('galery', ${item.rowId || idx})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('galery')"><i class="fas fa-plus"></i> Tambah Galery</button>
            </div>
            
            <!-- RUNNING TEXT (bisa tambah/hapus) -->
            <div class="content-category">
                <h4><i class="fas fa-scroll"></i> RUNNING TEXT</h4>
                <div id="runningtext-list">
                    ${runningTexts.map((item, idx) => `
                        <div class="content-item" data-idx="${idx}">
                            <textarea class="content-body" placeholder="Text" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Body">${escapeHtml(item.Body || '')}</textarea>
                            <button class="btn-delete-item" onclick="deleteContentItem('running_text', ${item.rowId || idx})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('running_text')"><i class="fas fa-plus"></i> Tambah Running Text</button>
            </div>
            
            <!-- SOSMED (bisa tambah/hapus) -->
            <div class="content-category">
                <h4><i class="fas fa-share-alt"></i> SOSMED</h4>
                <div id="sosmed-list">
                    ${sosmedList.map((item, idx) => `
                        <div class="content-item" data-idx="${idx}">
                            <select class="content-platform" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Header">
                                <option value="whatsapp" ${item.Header === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                                <option value="facebook" ${item.Header === 'facebook' ? 'selected' : ''}>Facebook</option>
                                <option value="discord" ${item.Header === 'discord' ? 'selected' : ''}>Discord</option>
                            </select>
                            <input type="text" class="content-body" placeholder="URL" value="${escapeHtml(item.Body || '')}" data-id="${item.ID}" data-rowid="${item.rowId || idx}" data-field="Body">
                            <button class="btn-delete-item" onclick="deleteContentItem('sosmed', ${item.rowId || idx})"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-add-item" onclick="addContentItem('sosmed')"><i class="fas fa-plus"></i> Tambah Sosmed</button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Tambah item baru
window.addContentItem = function(category) {
    // TODO: Kirim request ke GAS 4 untuk tambah item baru
    console.log("Tambah", category);
    loadContentData(); // refresh
};

// Hapus item
window.deleteContentItem = function(category, rowId) {
    if (!confirm('Hapus item ini?')) return;
    // TODO: Kirim request ke GAS 4 untuk hapus
    console.log("Hapus", category, rowId);
    loadContentData(); // refresh
};

// Kumpulkan semua perubahan dari form
function collectContentChanges() {
    const changes = [];
    
    // Scan semua input dan textarea dengan atribut data-id
    document.querySelectorAll('.content-header, .content-body, .content-image, .content-platform').forEach(el => {
        const id = el.dataset.id;
        const field = el.dataset.field;
        const rowId = el.dataset.rowid;
        const value = el.value;
        
        if (id && field) {
            changes.push({ id, rowId, field, value });
        }
    });
    
    return changes;
}

// Perbarui semua konten (tombol utama)
window.updateAllContent = async function() {
    const changes = collectContentChanges();
    if (changes.length === 0) {
        window.showToast("Tidak ada perubahan", true);
        return;
    }
    
    const btn = document.getElementById('refresh-cache-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
    btn.disabled = true;
    
    try {
        for (const change of changes) {
            const url = `${window.GAS_ADMIN_URL}?action=updateContent&rowId=${change.rowId}&field=${change.field}&value=${encodeURIComponent(change.value)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status !== 'success') {
                throw new Error(`Gagal update ${change.field}`);
            }
        }
        
        // Refresh cache setelah semua update
        await fetch(`${window.GAS_ADMIN_URL}?action=refreshContentCache`);
        
        window.showToast("✅ Konten berhasil diperbarui!");
        await loadContentData();
        
    } catch(e) {
        console.error("Update error:", e);
        window.showToast("❌ Gagal: " + (e.message || "Error"), true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

// Helper escapeHtml
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Tambah item baru
window.addContentItem = async function(category) {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=addContentItem&category=${category}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast("Item ditambahkan");
            loadContentData(); // refresh
        } else {
            window.showToast("Gagal tambah item", true);
        }
    } catch(e) {
        console.error("Add item error:", e);
        window.showToast("Gagal koneksi", true);
    }
};

// Hapus item
window.deleteContentItem = async function(category, rowId) {
    if (!confirm(`Hapus item ${category} ini?`)) return;
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteContentItem&rowId=${rowId}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast("Item dihapus");
            loadContentData(); // refresh
        } else {
            window.showToast("Gagal hapus item", true);
        }
    } catch(e) {
        console.error("Delete item error:", e);
        window.showToast("Gagal koneksi", true);
    }
};

// Ekspos fungsi
window.loadContentData = loadContentData;
window.updateAllContent = updateAllContent;

console.log("✅ admin-content.js loaded");
