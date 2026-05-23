/**
 * admin-mail.js - Mailbox Manager (Final)
 */

let currentMailFilter = "ALL";

// ==========================================
// SET FILTER
// ==========================================
window.setMailFilter = function(filter) {
    currentMailFilter = filter;
    refreshMailbox();
};

// ==========================================
// REFRESH MAILBOX (ambil dari server)
// ==========================================
async function refreshMailbox() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=fetchMailbox`);
        const data = await res.json();
        
        if (data.status === 'success' && data.data) {
            window.renderMailboxData(data.data);
        }
    } catch(e) { 
        console.error("Refresh mailbox error:", e);
    }
}

// ==========================================
// RENDER MAILBOX DATA (dipanggil dari admin.js juga)
// ==========================================
window.renderMailboxData = function(allMails) {
    if (!allMails) return;
    
    // Filter berdasarkan currentMailFilter
    let filteredData = allMails;
    const categoryMap = {
        'REQUEST_JOIN': 'Request Join',
        'SARAN': 'Saran', 
        'UMUM': 'Umum'
    };
    
    if (categoryMap[currentMailFilter]) {
        filteredData = allMails.filter(mail => mail.category === categoryMap[currentMailFilter]);
    } else if (currentMailFilter === 'UNREAD') {
        filteredData = allMails.filter(mail => mail.status === 'UNREAD');
    } else if (currentMailFilter === 'NEED_ACTION') {
        filteredData = allMails.filter(mail => mail.status === 'NEED_ACTION');
    } else if (currentMailFilter === 'COMPLETED') {
        filteredData = allMails.filter(mail => mail.status === 'COMPLETED');
    }
    
    renderMailbox(filteredData);
    
    // Update dropdown value
    const dropdown = document.getElementById('mail-filter');
    if (dropdown && dropdown.value !== currentMailFilter) {
        dropdown.value = currentMailFilter;
    }
};

// ==========================================
// RENDER MAILBOX LIST
// ==========================================
function renderMailbox(mails) {
    const container = document.getElementById('mailbox-list');
    if (!container) return;
    
    if (!mails.length) {
        let msg = '📭 Tidak ada surat';
        if (currentMailFilter === 'UNREAD') msg = '📭 Tidak ada surat belum dibaca';
        else if (currentMailFilter === 'NEED_ACTION') msg = '⚠️ Tidak ada surat perlu tindakan';
        else if (currentMailFilter === 'COMPLETED') msg = '✅ Tidak ada surat selesai';
        else if (currentMailFilter === 'REQUEST_JOIN') msg = '🛡️ Tidak ada permintaan bergabung';
        else if (currentMailFilter === 'SARAN') msg = '💡 Tidak ada saran';
        container.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }
    
    container.innerHTML = mails.map(mail => {
        // Status badge
        let statusClass = 'badge-unread', statusText = '📬 BELUM DIBACA';
        if (mail.status === 'READ') { 
            statusClass = 'badge-read'; 
            statusText = '📄 SUDAH DIBACA'; 
        } else if (mail.status === 'NEED_ACTION') { 
            statusClass = 'badge-need-action'; 
            statusText = '⚠️ PERLU TINDAKAN'; 
        } else if (mail.status === 'COMPLETED') { 
            statusClass = 'badge-completed'; 
            statusText = '✅ SELESAI'; 
        }
        
        // Kategori
        let catIcon = 'fa-comment', catColor = '#64748b', catLabel = 'Umum';
        if (mail.category === 'Request Join') { 
            catIcon = 'fa-user-plus'; 
            catColor = '#f59e0b'; 
            catLabel = 'Permintaan Bergabung';
        } else if (mail.category === 'Saran') { 
            catIcon = 'fa-lightbulb'; 
            catColor = '#22c55e'; 
            catLabel = 'Saran';
        }
        
        const ign = mail.ign || 'Tidak dikenal';
        const uid = mail.uid || '-';
        const message = mail.message || '';
        const timestamp = mail.timestamp || new Date();
        
        return `
            <div class="list-item" data-rowid="${mail.rowId}">
                <div style="display:flex; justify-content:space-between;">
                    <div style="flex:1;">
                        <b>${escapeHtml(ign)}</b>
                        <span style="font-size:0.6rem;color:${catColor};margin-left:8px;">
                            <i class="fas ${catIcon}"></i> ${catLabel}
                        </span>
                        <div style="font-size:0.6rem;color:var(--text-muted);">
                            ${escapeHtml(uid)} • ${new Date(timestamp).toLocaleString('id-ID')}
                        </div>
                        <div class="mail-message" style="margin-top:6px; font-size:0.75rem;">
                            ${escapeHtml(message).substring(0, 120)}${message.length > 120 ? '...' : ''}
                        </div>
                    </div>
                    <div style="text-align:right; margin-left:10px;">
                        <span class="${statusClass}">${statusText}</span>
                        <button class="delete-mail-btn" onclick="event.stopPropagation(); window.deleteMail(${mail.rowId})" 
                                style="display:block; margin-top:8px; background:transparent; border:none; color:#ff8888; cursor:pointer; opacity:0.5; font-size:0.7rem;">
                            <i class="fas fa-trash-alt"></i> Hapus
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach click event untuk buka detail
    document.querySelectorAll('#mailbox-list .list-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const mail = mails.find(m => m.rowId === rowId);
        if (mail) {
            item.onclick = (e) => { 
                if(!e.target.closest('.delete-mail-btn')) showMailDetail(mail); 
            };
        }
    });
}

// ==========================================
// DELETE MAIL
// ==========================================
window.deleteMail = async function(rowId) {
    window.showConfirmModal('Hapus surat ini?', async () => {
        try {
            const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteMail&rowId=${rowId}`);
            const data = await res.json();
            if (data.status === 'success') {
                window.showToast('✅ Surat dihapus');
                refreshMailbox();
            } else {
                window.showToast(data.message || 'Gagal hapus', true);
            }
        } catch(e) { 
            window.showToast('Gagal koneksi', true);
        }
    });
};

// ==========================================
// UPDATE MAIL STATUS
// ==========================================
async function updateMailStatus(rowId, newStatus, closeAfter = false) {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=updateMailStatus&rowId=${rowId}&status=${newStatus}`);
        const data = await res.json();
        if (data.status === 'success') {
            if (newStatus !== 'READ') {
                const pesan = newStatus === 'NEED_ACTION' ? '⚠️ Perlu Tindakan' : '✅ Selesai';
                window.showToast(pesan);
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

// ==========================================
// SHOW DETAIL MODAL
// ==========================================
function showMailDetail(mail) {
    if (mail.status === 'UNREAD') {
        updateMailStatus(mail.rowId, 'READ', false);
        mail.status = 'READ';
    }
    
    const modal = document.getElementById('modal-overlay');
    let statusHtml = '';
    if (mail.status === 'UNREAD') statusHtml = '<span class="badge-unread">📬 BELUM DIBACA</span>';
    else if (mail.status === 'READ') statusHtml = '<span class="badge-read">📄 SUDAH DIBACA</span>';
    else if (mail.status === 'NEED_ACTION') statusHtml = '<span class="badge-need-action">⚠️ PERLU TINDAKAN</span>';
    else statusHtml = '<span class="badge-completed">✅ SELESAI</span>';
    
    let catLabel = 'Umum';
    if (mail.category === 'Request Join') catLabel = 'Permintaan Bergabung';
    else if (mail.category === 'Saran') catLabel = 'Saran';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <h3 style="margin:0;"><i class="fas fa-envelope-open-text"></i> Detail Surat</h3>
                <button onclick="window.closeModal()" style="background:transparent; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">✕</button>
            </div>
            <div style="margin-bottom: 15px; font-size:0.8rem;">
                <p><strong>Dari:</strong> ${escapeHtml(mail.ign)} (${mail.uid})</p>
                <p><strong>Kategori:</strong> <span style="color:#f59e0b;">${catLabel}</span></p>
                <p><strong>Tanggal:</strong> ${new Date(mail.timestamp).toLocaleString('id-ID')}</p>
                <p><strong>Status:</strong> ${statusHtml}</p>
                <hr style="border-color:var(--border-line); margin: 10px 0;">
                <p><strong>Pesan:</strong></p>
                <p style="background:var(--bg-solid-form); padding:12px; border-radius:12px; white-space:pre-wrap; max-height:300px; overflow-y:auto;">
                    ${escapeHtml(mail.message)}
                </p>
            </div>
            <div class="modal-buttons" style="display:flex; gap:8px; flex-wrap:wrap;">
                ${mail.status !== 'NEED_ACTION' ? `<button onclick="updateMailStatus(${mail.rowId}, 'NEED_ACTION', true)" style="background:#f59e0b; border:none; border-radius:12px; padding:8px 12px; color:white;">⚠️ Butuh Tindakan</button>` : ''}
                ${mail.status !== 'COMPLETED' ? `<button onclick="updateMailStatus(${mail.rowId}, 'COMPLETED', true)" style="background:#22c55e; border:none; border-radius:12px; padding:8px 12px; color:white;">✅ Tandai Selesai</button>` : ''}
                <button onclick="window.deleteMail(${mail.rowId}); window.closeModal();" style="background:#ff4444; border:none; border-radius:12px; padding:8px 12px; color:white;">🗑️ Hapus</button>
                <button onclick="window.closeModal()" style="background:#333; border:none; border-radius:12px; padding:8px 12px; color:white;">Tutup</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

// ==========================================
// EXPOSE GLOBAL FUNCTIONS
// ==========================================
window.refreshMailbox = refreshMailbox;
window.setMailFilter = setMailFilter;
window.updateMailStatus = updateMailStatus;
window.deleteMail = deleteMail;
window.showMailDetail = showMailDetail;

console.log("✅ admin-mail.js loaded");
