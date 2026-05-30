/**
 * admin-content.js - Kelola Konten Web
 * Dengan fitur Image URL untuk Galery (otomatis jadi <img>)
 */

let currentContentData = [];

// Fungsi bantu ekstrak URL gambar dari Body
function extractImageUrlFromBody(body) {
    if (!body) return '';
    const match = body.match(/<img[^>]*src="([^"]+)"/);
    return match ? match[1] : '';
}

// Fungsi bantu ekstrak caption (teks setelah img) dari Body
function extractCaptionFromBody(body) {
    if (!body) return '';
    // Hapus semua tag img
    let text = body.replace(/<img[^>]*>/g, '');
    // Hapus tag p jika kosong
    text = text.replace(/<\/?p>/g, '').trim();
    return text;
}

// Fungsi build Body dari imageUrl + caption
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
            <!-- HEADLINE -->
            <div class="content-category">
                <h4><i class="fas fa-heading"></i> HEADLINE</h4>
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(headline?.Header || '')}" data-rowid="${headline?.rowId || 2}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-rowid="${headline?.rowId || 2}" data-field="Body">${escapeHtml(headline?.Body || '')}</textarea>
                </div>
            </div>
            
            <!-- OPEN MEMBER -->
            <div class="content-category">
                <h4><i class="fas fa-users"></i> OPEN MEMBER</h4>
                <div class="content-item">
                    <input type="text" class="content-header" placeholder="Header" value="${escapeHtml(openmember?.Header || '')}" data-rowid="${openmember?.rowId || 3}" data-field="Header">
                    <textarea class="content-body" placeholder="Body" data-rowid="${openmember?.rowId || 3}" data-field="Body">${escapeHtml(openmember?.Body || '')}</textarea>
                </div>
            </div>
            
            <!-- PROFIL -->
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
            
            <!-- GALERY (dengan Image URL terpisah) -->
            <div class="content-category">
                <h4><i class="fas fa-images"></i> GALERY</h4>
                <div id="galery-list">
                    ${galeryList.map(item => {
                        const imageUrl = extractImageUrlFromBody(item.Body || '');
                        const caption = extractCaptionFromBody(item.Body || '');
                        return `
                            <div class="content-item">
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
                        <div class="content-item">
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
    
    // Handle GALERY khusus (gabungkan ImageUrl + Caption jadi Body)
    document.querySelectorAll('#galery-list .content-item').forEach(item => {
        const rowId = parseInt(item.querySelector('.content-header')?.dataset.rowid);
        const header = item.querySelector('.content-header')?.value || '';
        const imageUrl = item.querySelector('.content-image-url')?.value || '';
        const caption = item.querySelector('.content-caption')?.value || '';
        
        const oldItem = currentContentData.find(d => d.rowId === rowId);
        if (oldItem) {
            const newBody = buildGalleryBody(imageUrl, caption);
            
            if (oldItem.Header !== header) {
                changes.push({ rowId, field: 'Header', value: header });
            }
            if ((oldItem.Body || '') !== newBody) {
                changes.push({ rowId, field: 'Body', value: newBody });
            }
        }
    });
    
    // Handle PROFIL
    document.querySelectorAll('#profil-list .content-item').forEach(item => {
        const rowId = parseInt(item.querySelector('.content-header')?.dataset.rowid);
        const header = item.querySelector('.content-header')?.value || '';
        const body = item.querySelector('.content-body')?.value || '';
        
        const oldItem = currentContentData.find(d => d.rowId === rowId);
        if (oldItem) {
            if (oldItem.Header !== header) {
                changes.push({ rowId, field: 'Header', value: header });
            }
            if ((oldItem.Body || '') !== body) {
                changes.push({ rowId, field: 'Body', value: body });
            }
        }
    });
    
    // Handle HEADLINE & OPEN MEMBER
    document.querySelectorAll('.content-category:not(:has(#profil-list)):not(:has(#galery-list)) .content-item').forEach(item => {
        const rowId = parseInt(item.querySelector('.content-header, .content-body')?.dataset.rowid);
        if (!rowId) return;
        
        const headerInput = item.querySelector('.content-header');
        const bodyInput = item.querySelector('.content-body');
        
        const oldItem = currentContentData.find(d => d.rowId === rowId);
        if (oldItem) {
            if (headerInput && oldItem.Header !== headerInput.value) {
                changes.push({ rowId, field: 'Header', value: headerInput.value });
            }
            if (bodyInput && (oldItem.Body || '') !== bodyInput.value) {
                changes.push({ rowId, field: 'Body', value: bodyInput.value });
            }
        }
    });
    
    // Handle RUNNING TEXT
    document.querySelectorAll('#runningtext-list .content-item').forEach(item => {
        const rowId = parseInt(item.querySelector('.content-body')?.dataset.rowid);
        const body = item.querySelector('.content-body')?.value || '';
        
        const oldItem = currentContentData.find(d => d.rowId === rowId);
        if (oldItem && (oldItem.Body || '') !== body) {
            changes.push({ rowId, field: 'Body', value: body });
        }
    });
    
    // Handle SOSMED
    document.querySelectorAll('#sosmed-list .content-item').forEach(item => {
        const rowId = parseInt(item.querySelector('.content-platform')?.dataset.rowid);
        const header = item.querySelector('.content-platform')?.value || '';
        const body = item.querySelector('.content-body')?.value || '';
        
        const oldItem = currentContentData.find(d => d.rowId === rowId);
        if (oldItem) {
            if ((oldItem.Header || '') !== header) {
                changes.push({ rowId, field: 'Header', value: header });
            }
            if ((oldItem.Body || '') !== body) {
                changes.push({ rowId, field: 'Body', value: body });
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

console.log("✅ admin-content.js loaded (dengan Image URL untuk Galery)");
