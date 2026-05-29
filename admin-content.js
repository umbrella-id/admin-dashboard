/**
 * admin-content.js - Kelola Konten Web
 * Update hanya field yang berubah (compare dengan currentContentData)
 */

let currentContentData = [];

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

function renderContentEditor(data) {
    // ... (sama seperti sebelumnya, dengan data-rowid dan data-field)
}

// Kumpulkan perubahan (bandingkan dengan currentContentData)
function collectChangedFields() {
    const changes = [];
    
    document.querySelectorAll('.content-header, .content-body, .content-platform').forEach(el => {
        const rowId = parseInt(el.dataset.rowid);
        const field = el.dataset.field;
        const newValue = el.value;
        
        // Cari data lama dari currentContentData
        const oldItem = currentContentData.find(item => item.rowId === rowId);
        if (oldItem) {
            const oldValue = oldItem[field] || '';
            if (oldValue !== newValue) {
                changes.push({ rowId, field, value: newValue });
                console.log(`🔄 Perubahan: rowId ${rowId}, field ${field}: "${oldValue}" → "${newValue}"`);
            }
        }
    });
    
    return changes;
}

// Update hanya yang berubah
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
    
    // Refresh cache jika ada yang berhasil
    if (successCount > 0) {
        await fetch(`${window.GAS_ADMIN_URL}?action=refreshContentCache`);
        window.showToast(`✅ ${successCount} item berhasil diperbarui${failCount > 0 ? `, ${failCount} gagal` : ''}`);
        await loadContentData(); // reload data terbaru
    } else {
        window.showToast("❌ Gagal memperbarui konten", true);
    }
    
    btn.innerHTML = originalHtml;
    btn.disabled = false;
};

// Tambah item
window.addContentItem = async function(category) {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=addContentItem&category=${category}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast("Item ditambahkan");
            await loadContentData(); // reload
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
            await loadContentData(); // reload
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

console.log("✅ admin-content.js loaded (Update only changed fields)");
