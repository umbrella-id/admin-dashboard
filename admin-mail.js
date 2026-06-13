/**
 * admin-mail.js - Mailbox Manager (Dengan Pinned NEED_ACTION di atas)
 */

let currentMailFilter = "ALL";
let lastMailStatus = {
    lastTimestamp: 0,
    totalSurat: 0,
    unreadCount: 0,
    needActionCount: 0
};

window.setMailFilter = function(filter) {
    currentMailFilter = filter;
    refreshMailbox();
};

// Cek perubahan mailbox (panggil setiap 60 detik)
async function checkMailboxChanges() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=checkMailboxStatus`);
        const data = await res.json();
        
        if (data.status !== 'success') return false;
        
        const current = {
            lastTimestamp: data.lastTimestamp,
            totalSurat: data.totalSurat,
            unreadCount: data.unreadCount,
            needActionCount: data.needActionCount
        };
        
        const saved = lastMailStatus;
        
        // Bandingkan apakah ada perubahan
        const hasChanged = (
            current.lastTimestamp !== saved.lastTimestamp ||
            current.totalSurat !== saved.totalSurat ||
            current.unreadCount !== saved.unreadCount ||
            current.needActionCount !== saved.needActionCount
        );
        
        if (hasChanged) {
            // Update nilai tersimpan
            lastMailStatus = current;
            // Fetch data lengkap
            await fetchMailboxAndCache();
            return true;
        }
        
        return false;
    } catch(e) {
        console.error("Check mailbox changes error:", e);
        return false;
    }
}

// Fetch 50 surat lengkap dan simpan ke sessionStorage
async function fetchMailboxAndCache() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=fetchMailbox&limit=50`);
        const data = await res.json();
        
        if (data.status === 'success' && data.data) {
            // Simpan ke sessionStorage
            sessionStorage.setItem('umbrella_cached_mailbox', JSON.stringify(data.data));
            sessionStorage.setItem('umbrella_cached_mailbox_time', Date.now().toString());
            
            // Render jika tab sedang aktif
            const isMailboxActive = document.querySelector('.nav-item.active')?.dataset.nav === 'mailbox';
            if (isMailboxActive) {
                renderMailbox(data.data);
            }
        }
    } catch(e) {
        console.error("Fetch mailbox error:", e);
    }
}

// Render dari cache (untuk buka tab)
function renderMailboxFromCache() {
    const cached = sessionStorage.getItem('umbrella_cached_mailbox');
    if (cached) {
        try {
            renderMailbox(JSON.parse(cached));
        } catch(e) {
            console.error("Cache parse error:", e);
            refreshMailbox(); // fallback ke fetch langsung
        }
    } else {
        refreshMailbox(); // cache kosong, fetch langsung
    }
}

async function refreshMailbox() {
    const container = document.getElementById('mailbox-list');
    if (!container) return;
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=fetchMailbox&limit=50`);
        const data = await res.json();
        if (data.status === 'success' && data.data) {
            // Simpan ke cache
            sessionStorage.setItem('umbrella_cached_mailbox', JSON.stringify(data.data));
            sessionStorage.setItem('umbrella_cached_mailbox_time', Date.now().toString());
            
            // Update status tersimpan
            lastMailStatus = {
                lastTimestamp: data.data[0]?.timestamp ? new Date(data.data[0].timestamp).getTime() : 0,
                totalSurat: data.data.length,
                unreadCount: data.data.filter(m => m.status === 'UNREAD').length,
                needActionCount: data.data.filter(m => m.status === 'NEED_ACTION').length
            };
            
            // Render
            renderMailbox(data.data);
        } else {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat</div>';
        }
    } catch(e) { 
        console.error("Refresh error:", e);
        container.innerHTML = '<div class="empty-state">⚠️ Koneksi gagal</div>';
    }
}

function renderMailbox(allMails) {
    const container = document.getElementById('mailbox-list');
    if (!container) return;
    
    // STEP 1: Filter dulu
    let filtered = allMails;
    if (currentMailFilter === 'UNREAD') {
        filtered = allMails.filter(m => m.status === 'UNREAD');
    } else if (currentMailFilter === 'NEED_ACTION') {
        filtered = allMails.filter(m => m.status === 'NEED_ACTION');
    } else if (currentMailFilter === 'REQUEST_JOIN') {
        filtered = allMails.filter(m => m.category === 'Request Join');
    } else if (currentMailFilter === 'SARAN') {
        filtered = allMails.filter(m => m.category === 'Saran');
    } else if (currentMailFilter === 'UMUM') {
        filtered = allMails.filter(m => m.category === 'Umum');
    }
    
    if (!filtered.length) {
        let msg = '📭 Tidak ada surat';
        if (currentMailFilter === 'UNREAD') msg = '📭 Tidak ada surat belum dibaca';
        else if (currentMailFilter === 'NEED_ACTION') msg = '⚠️ Tidak ada surat perlu tindakan';
        container.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }
    
    // STEP 2: Pisahkan NEED_ACTION dan lainnya, lalu gabung (NEED_ACTION di atas)
    const needAction = filtered.filter(m => m.status === 'NEED_ACTION');
    const others = filtered.filter(m => m.status !== 'NEED_ACTION');
    const sortedMails = [...needAction, ...others];
    
    let html = '';
    for (const mail of sortedMails) {
        let statusClass = 'badge-unread', statusText = '📬 BELUM DIBACA';
        if (mail.status === 'READ') { 
            statusClass = 'badge-read'; 
            statusText = '📄 SUDAH DIBACA'; 
        } else if (mail.status === 'NEED_ACTION') { 
            statusClass = 'badge-need-action'; 
            statusText = '⚠️ PERLU TINDAKAN'; 
        }
        
        let catIcon = 'fa-comment', catColor = '#64748b', catLabel = 'Umum';
        if (mail.category === 'Request Join') { 
            catIcon = 'fa-user-plus'; 
            catColor = '#f59e0b'; 
            catLabel = 'Join';
        } else if (mail.category === 'Saran') { 
            catIcon = 'fa-lightbulb'; 
            catColor = '#22c55e'; 
            catLabel = 'Saran';
        }
        
        const ign = escapeHtml(mail.ign || 'Tidak dikenal');
        const uid = escapeHtml(mail.uid || '-');
        const message = escapeHtml(mail.message || '').trim();
        const timestamp = mail.timestamp ? new Date(mail.timestamp) : new Date();
        const tanggal = timestamp.toLocaleDateString('id-ID');
        const jam = timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        html += `
            <div class="list-item ${mail.status === 'NEED_ACTION' ? 'pinned' : ''}" data-rowid="${mail.rowId}" style="${mail.status === 'NEED_ACTION' ? 'border-left: 3px solid #f59e0b;' : ''}">
                <div class="mail-content" data-rowid="${mail.rowId}">
                    <div class="mail-header">
                        <div class="mail-sender"><b>${ign}</b> <span class="mail-uid">${uid}</span></div>
                        <div class="mail-status"><span class="${statusClass}">${statusText}</span></div>
                    </div>
                    <div class="mail-meta">
                        <span><i class="far fa-calendar-alt"></i> ${tanggal} ${jam}</span>
                        <span style="color:${catColor};"><i class="fas ${catIcon}"></i> ${catLabel}</span>
                    </div>
                    <div class="mail-message-preview">${message.substring(0, 80)}${message.length > 80 ? '...' : ''}</div>
                </div>
                <button class="delete-mail-btn" data-rowid="${mail.rowId}"><i class="fas fa-trash-alt"></i> Hapus</button>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    container.querySelectorAll('.mail-content').forEach(el => {
        el.onclick = () => {
            const rowId = parseInt(el.dataset.rowid);
            const mail = sortedMails.find(m => m.rowId === rowId);
            if (mail) showMailDetail(mail);
        };
    });
    
    container.querySelectorAll('.delete-mail-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const rowId = parseInt(btn.dataset.rowid);
            if (rowId) window.deleteMail(rowId);
        };
    });
}

// DELETE, UPDATE STATUS, SHOW DETAIL (sama seperti sebelumnya)
window.deleteMail = async function(rowId) {
    if (!rowId) return;
    window.showConfirmModal('Hapus surat ini?', async () => {
        try {
            window.showToast("⏳ Menghapus...");
            const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteMail&rowId=${rowId}`);
            const data = await res.json();
            if (data.status === 'success') {
                window.showToast('✅ Surat dihapus');
                refreshMailbox();
            } else {
                window.showToast(data.message || 'Gagal', true);
            }
        } catch(e) { 
            window.showToast('Gagal koneksi', true);
        }
    });
};

async function updateMailStatus(rowId, newStatus, closeAfter = false) {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=updateMailStatus&rowId=${rowId}&status=${newStatus}`);
        const data = await res.json();
        if (data.status === 'success') {
            if (newStatus !== 'READ') {
                window.showToast(newStatus === 'NEED_ACTION' ? '⚠️ Perlu Tindakan' : '✅ Selesai');
            }
            refreshMailbox();
            if (closeAfter) window.closeModal();
        } else {
            window.showToast(data.message || "Gagal", true);
        }
    } catch(e) { 
        window.showToast("Gagal", true);
    }
}

function showMailDetail(mail) {
    if (mail.status === 'UNREAD') {
        updateMailStatus(mail.rowId, 'READ', false);
        mail.status = 'READ';
    }
    
    const isNeedAction = mail.status === 'NEED_ACTION';
    let statusBadge = '';
    if (mail.status === 'UNREAD') statusBadge = '<span class="badge-unread">📬 BELUM DIBACA</span>';
    else if (mail.status === 'READ') statusBadge = '<span class="badge-read">📄 SUDAH DIBACA</span>';
    else if (mail.status === 'NEED_ACTION') statusBadge = '<span class="badge-need-action">⚠️ PERLU TINDAKAN</span>';
    
    let catLabel = 'Umum', catIcon = 'fa-comment';
    if (mail.category === 'Request Join') { catLabel = 'Permintaan Bergabung'; catIcon = 'fa-user-plus'; }
    else if (mail.category === 'Saran') { catLabel = 'Saran'; catIcon = 'fa-lightbulb'; }
    
    const tanggal = new Date(mail.timestamp).toLocaleDateString('id-ID');
    const jam = new Date(mail.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const pesan = escapeHtml(mail.message || '').trim();
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <div class="modal-sender-row"><i class="fas fa-user-circle"></i> ${escapeHtml(mail.ign)} <span class="modal-uid">${escapeHtml(mail.uid)}</span></div>
            <div class="modal-status-row">${statusBadge}</div>
            <div class="modal-meta-row"><span><i class="far fa-calendar-alt"></i> ${tanggal} ${jam}</span><span><i class="fas ${catIcon}"></i> ${catLabel}</span></div>
            <div class="modal-message">${pesan}</div>
            <div class="modal-buttons">
                ${!isNeedAction ? `<button onclick="updateMailStatus(${mail.rowId}, 'NEED_ACTION', true)" class="btn-need-action">⚠️ Perlu Tindakan</button>` : ''}
                ${isNeedAction ? `<button onclick="updateMailStatus(${mail.rowId}, 'READ', true)" class="btn-complete">✅ Selesai</button>` : ''}
                <button onclick="window.closeModal()" class="btn-close">Tutup</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex
    history.pushState({ modal: true }, "");
}

window.refreshMailbox = refreshMailbox;
window.setMailFilter = setMailFilter;
window.updateMailStatus = updateMailStatus;
window.deleteMail = deleteMail;
window.showMailDetail = showMailDetail;
window.checkMailboxChanges = checkMailboxChanges;
window.renderMailboxFromCache = renderMailboxFromCache;
window.fetchMailboxAndCache = fetchMailboxAndCache;

console.log("✅ admin-mail.js loaded (Dengan Pinned)");
