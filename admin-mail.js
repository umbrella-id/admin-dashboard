let currentMailFilter = "ALL", mailboxInterval = null;

window.setMailFilter = function(filter) { currentMailFilter = filter; refreshMailbox(); };

async function refreshMailbox() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=fetchMailbox`);
        const data = await res.json();
        if (data.status === 'success' && data.data) {
            let filtered = data.data;
            switch(currentMailFilter) {
                case 'UNREAD': filtered = data.data.filter(m => m.status === 'UNREAD'); break;
                case 'NEED_ACTION': filtered = data.data.filter(m => m.status === 'NEED_ACTION'); break;
                case 'COMPLETED': filtered = data.data.filter(m => m.status === 'COMPLETED'); break;
                case 'REQUEST_JOIN': filtered = data.data.filter(m => m.category === 'Request Join'); break;
                case 'SARAN': filtered = data.data.filter(m => m.category === 'Saran'); break;
                case 'UMUM': filtered = data.data.filter(m => m.category === 'Umum'); break;
            }
            renderMailbox(filtered);
            const dropdown = document.getElementById('mail-filter');
            if (dropdown && dropdown.value !== currentMailFilter) dropdown.value = currentMailFilter;
        }
    } catch(e) { console.error(e); }
}

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
        let statusClass = 'badge-unread', statusText = '📬 BELUM DIBACA';
        if (mail.status === 'READ') { statusClass = 'badge-read'; statusText = '📄 SUDAH DIBACA'; }
        else if (mail.status === 'NEED_ACTION') { statusClass = 'badge-need-action'; statusText = '⚠️ PERLU TINDAKAN'; }
        else if (mail.status === 'COMPLETED') { statusClass = 'badge-completed'; statusText = '✅ SELESAI'; }
        let catIcon = 'fa-comment', catColor = '#64748b', catLabel = 'Umum';
        if (mail.category === 'Request Join') { catIcon = 'fa-user-plus'; catColor = '#f59e0b'; catLabel = 'Permintaan Bergabung'; }
        else if (mail.category === 'Saran') { catIcon = 'fa-lightbulb'; catColor = '#22c55e'; catLabel = 'Saran'; }
        return `<div class="list-item" data-rowid="${mail.rowId}"><div style="display:flex;justify-content:space-between;"><div><b>${escapeHtml(mail.ign || 'Tidak dikenal')}</b><span style="font-size:0.6rem;color:${catColor};margin-left:8px;"><i class="fas ${catIcon}"></i> ${catLabel}</span><div style="font-size:0.6rem;color:var(--text-muted);">${mail.uid} • ${new Date(mail.timestamp).toLocaleString('id-ID')}</div><div class="mail-message">${escapeHtml(mail.message).substring(0, 100)}${mail.message.length > 100 ? '...' : ''}</div></div><div style="text-align:right;"><span class="${statusClass}">${statusText}</span><button class="delete-mail-btn" onclick="event.stopPropagation(); window.deleteMail(${mail.rowId})" style="display:block;margin-top:8px;background:transparent;border:none;color:#ff8888;cursor:pointer;opacity:0.5;"><i class="fas fa-trash-alt"></i> Hapus</button></div></div></div>`;
    }).join('');
    document.querySelectorAll('#mailbox-list .list-item').forEach(item => {
        const rowId = parseInt(item.dataset.rowid);
        const mail = mails.find(m => m.rowId === rowId);
        if (mail) item.onclick = (e) => { if(!e.target.closest('.delete-mail-btn')) showMailDetail(mail); };
    });
}

window.deleteMail = async function(rowId) {
    showConfirmModal('Hapus surat ini?', async () => {
        try {
            const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteMail&rowId=${rowId}`);
            const data = await res.json();
            if (data.status === 'success') { showToast('✅ Surat dihapus'); refreshMailbox(); }
            else showToast(data.message || 'Gagal', true);
        } catch(e) { showToast('Gagal koneksi', true); }
    });
};

async function updateMailStatus(rowId, newStatus, closeAfter = false) {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=updateMailStatus&rowId=${rowId}&status=${newStatus}`);
        const data = await res.json();
        if (data.status === 'success') {
            if (newStatus !== 'READ') showToast(`Status: ${newStatus === 'NEED_ACTION' ? 'Perlu Tindakan' : 'Selesai'}`);
            refreshMailbox();
            if (closeAfter) closeModal();
        } else showToast(data.message || "Gagal", true);
    } catch(e) { showToast("Gagal", true); }
}

function showMailDetail(mail) {
    if (mail.status === 'UNREAD') updateMailStatus(mail.rowId, 'READ', false);
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `<div class="modal-content"><div style="display:flex;justify-content:space-between;"><h3><i class="fas fa-envelope-open-text"></i> Detail Surat</h3><button onclick="closeModal()" style="background:transparent;border:none;color:var(--text-muted);font-size:1.2rem;">✕</button></div><div><p><strong>Dari:</strong> ${escapeHtml(mail.ign || 'Tidak dikenal')} (${mail.uid})</p><p><strong>Kategori:</strong> ${mail.category === 'Request Join' ? 'Permintaan Bergabung' : (mail.category === 'Saran' ? 'Saran' : 'Umum')}</p><p><strong>Tanggal:</strong> ${new Date(mail.timestamp).toLocaleString('id-ID')}</p><p><strong>Status:</strong> <span class="${mail.status === 'UNREAD' ? 'badge-unread' : (mail.status === 'NEED_ACTION' ? 'badge-need-action' : (mail.status === 'COMPLETED' ? 'badge-completed' : 'badge-read'))}">${mail.status === 'UNREAD' ? '📬 BELUM DIBACA' : (mail.status === 'NEED_ACTION' ? '⚠️ PERLU TINDAKAN' : (mail.status === 'COMPLETED' ? '✅ SELESAI' : '📄 SUDAH DIBACA'))}</span></p><hr><p><strong>Pesan:</strong></p><p style="background:var(--bg-solid-form);padding:12px;border-radius:12px;white-space:pre-wrap;">${escapeHtml(mail.message)}</p></div><div class="modal-buttons" style="margin-top:15px;">${mail.status !== 'NEED_ACTION' ? `<button onclick="updateMailStatus(${mail.rowId}, 'NEED_ACTION', true)" style="background:#f59e0b;">⚠️ Butuh Tindakan</button>` : ''}${mail.status !== 'COMPLETED' ? `<button onclick="updateMailStatus(${mail.rowId}, 'COMPLETED', true)" style="background:#22c55e;">✅ Selesai</button>` : ''}<button onclick="window.deleteMail(${mail.rowId});closeModal();" style="background:#ff4444;">🗑️ Hapus</button><button onclick="closeModal()" style="background:#333;">Tutup</button></div></div>`;
    modal.style.display = 'flex';
}

function startMailboxRefresh() { if(mailboxInterval) clearInterval(mailboxInterval); refreshMailbox(); mailboxInterval = setInterval(() => { if(window.currentAdmin) refreshMailbox(); }, 60000); }
function stopMailboxRefresh() { if(mailboxInterval) { clearInterval(mailboxInterval); mailboxInterval = null; } }

window.refreshMailbox = refreshMailbox;
window.startMailboxRefresh = startMailboxRefresh;
window.stopMailboxRefresh = stopMailboxRefresh;
