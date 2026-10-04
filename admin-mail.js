/**
 * admin-mail.js — Mailbox Manager
 * 
 * Update dari V6:
 * - Tombol History sejajar dengan nama client (satu baris)
 * - Tombol History muncul di semua tipe pesan (termasuk surat keluar)
 * - History popup: tanpa background, dengan garis pemisah
 * - History popup: label [ADMIN] Nama Admin untuk surat keluar
 */

let currentMailFilter = "all";
let currentMailList = [];
let currentMailDetail = null;

// State untuk cek update
let lastMailStatus = {
    lastTimestamp: 0,
    totalSurat: 0,
    unreadCount: 0
};

// ==========================================
// SET FILTER
// ==========================================
window.setMailFilter = function(filter) {
    currentMailFilter = filter;
    refreshMailbox();
};

// ==========================================
// FETCH LIST (dengan filter)
// ==========================================
async function refreshMailbox() {
    const container = document.getElementById('mailbox-list');
    if (!container) return;
    
    // Cache
    const cacheKey = `umbrella_mail_${currentMailFilter}`;
    const cached = sessionStorage.getItem(cacheKey);
    
    if (cached) {
        try {
            const data = JSON.parse(cached);
            currentMailList = data;
            renderMailbox(data);
        } catch(e) {}
    }
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getMailList&filter=${currentMailFilter}`);
        const data = await res.json();
        
        if (data.status === 'success' && data.mails) {
            currentMailList = data.mails;
            sessionStorage.setItem(cacheKey, JSON.stringify(data.mails));
            renderMailbox(data.mails);
        } else if (!cached) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat</div>';
        }
    } catch(e) {
        console.error("Refresh mailbox error:", e);
        if (!cached) {
            container.innerHTML = '<div class="empty-state">⚠️ Koneksi gagal</div>';
        }
    }
}

// ==========================================
// RENDER MAILBOX (List Card)
// ==========================================
function renderMailbox(mails) {
    const container = document.getElementById('mailbox-list');
    if (!container) return;
    
    if (!mails || mails.length === 0) {
        let msg = '📭 Tidak ada surat';
        if (currentMailFilter === 'unread') msg = '📩 Tidak ada surat belum terbaca';
        else if (currentMailFilter === 'read') msg = '📖 Tidak ada surat sudah dibaca';
        else if (currentMailFilter === 'replied') msg = '💬 Tidak ada surat sudah dibalas';
        else if (currentMailFilter === 'done') msg = '✅ Tidak ada surat selesai';
        else if (currentMailFilter === 'sent') msg = '📤 Tidak ada surat keluar';
        container.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }
    
    let html = '';
    for (const mail of mails) {
        if (currentMailFilter === 'sent') {
            html += buildSentCardHTML(mail);
        } else {
            html += buildInboxCardHTML(mail);
        }
    }
    
    container.innerHTML = html;
    
    // Event klik card
    container.querySelectorAll('.mail-content').forEach(el => {
        el.onclick = () => {
            const rowId = parseInt(el.dataset.rowid);
            const mail = currentMailList.find(m => m.rowId === rowId);
            if (mail) openMailDetail(mail);
        };
    });
    
    // Event hapus
    container.querySelectorAll('.delete-mail-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const rowId = parseInt(btn.dataset.rowid);
            if (rowId) window.deleteMail(rowId);
        };
    });
}

// ==========================================
// BUILD INBOX CARD (Surat Masuk)
// ==========================================
function buildInboxCardHTML(mail) {
    const ign = escapeHtml(mail.ign || 'Tidak dikenal');
    const uid = escapeHtml(mail.uid || '-');
    const message = escapeHtml(mail.message || '').trim();
    const timestamp = mail.timestamp ? new Date(mail.timestamp) : new Date();
    const tanggal = timestamp.toLocaleDateString('id-ID');
    const jam = timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const preview = message.substring(0, 80) + (message.length > 80 ? '...' : '');
    
    // Badge status
    let badgeClass = 'badge-unread';
    let badgeText = 'UNREAD';
    if (mail.status === 'READ') {
        badgeClass = 'badge-read';
        badgeText = 'DIBACA';
    } else if (mail.status === 'REPLIED') {
        badgeClass = 'badge-replied';
        badgeText = 'DIBALAS';
    } else if (mail.status === 'DONE') {
        badgeClass = 'badge-done';
        badgeText = 'SELESAI';
    }
    
    // Icon kategori
    let catIcon = 'fa-comment', catColor = '#64748b', catLabel = 'Umum';
    if (mail.category === 'Request Join') {
        catIcon = 'fa-user-plus'; catColor = '#f59e0b'; catLabel = 'Join';
    } else if (mail.category === 'Saran') {
        catIcon = 'fa-lightbulb'; catColor = '#22c55e'; catLabel = 'Saran';
    }
    
    return `
        <div class="list-item" data-rowid="${mail.rowId}">
            <div class="mail-content" data-rowid="${mail.rowId}">
                <div class="mail-header">
                    <div class="mail-sender">
                        <b>${ign}</b> 
                        <span class="mail-uid">${uid}</span>
                    </div>
                    <div class="mail-status">
                        <span class="mail-card-badge ${badgeClass}">${badgeText}</span>
                    </div>
                </div>
                <div class="mail-meta">
                    <span><i class="far fa-calendar-alt"></i> ${tanggal} ${jam}</span>
                    <span style="color:${catColor};"><i class="fas ${catIcon}"></i> ${catLabel}</span>
                </div>
                <div class="mail-message-preview">${preview}</div>
            </div>
            <button class="delete-mail-btn" data-rowid="${mail.rowId}"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
}

// ==========================================
// BUILD SENT CARD (Surat Keluar)
// ==========================================
function buildSentCardHTML(mail) {
    const targetIgn = escapeHtml(mail.ign || 'Unknown');       // nama user (kolom C)
    const targetUid = escapeHtml(mail.uid || '-');
    const adminName = escapeHtml(mail.adminName || 'Admin');   // nama admin (lookup)
    const message = escapeHtml(mail.message || '').trim();
    const timestamp = mail.timestamp ? new Date(mail.timestamp) : new Date();
    const tanggal = timestamp.toLocaleDateString('id-ID');
    const jam = timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const preview = message.substring(0, 80) + (message.length > 80 ? '...' : '');
    
    // Icon kategori
    let catIcon = 'fa-comment', catColor = '#64748b', catLabel = 'Umum';
    if (mail.category === 'Request Join') {
        catIcon = 'fa-user-plus'; catColor = '#f59e0b'; catLabel = 'Join';
    } else if (mail.category === 'Saran') {
        catIcon = 'fa-lightbulb'; catColor = '#22c55e'; catLabel = 'Saran';
    }
    
    return `
        <div class="list-item" data-rowid="${mail.rowId}">
            <div class="mail-content" data-rowid="${mail.rowId}">
                <div class="mail-header">
                    <div class="mail-sender">
                        📤 <b>Kepada: ${targetIgn}</b>
                        <span class="mail-uid">${targetUid}</span>
                    </div>
                    <div class="mail-status">
                        <span class="mail-card-badge badge-sent">${adminName}</span>
                    </div>
                </div>
                <div class="mail-meta">
                    <span><i class="far fa-calendar-alt"></i> ${tanggal} ${jam}</span>
                    <span style="color:${catColor};"><i class="fas ${catIcon}"></i> ${catLabel}</span>
                </div>
                <div class="mail-message-preview">${preview}</div>
            </div>
            <button class="delete-mail-btn" data-rowid="${mail.rowId}"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
}

// ==========================================
// BUKA DETAIL PESAN
// ==========================================
async function openMailDetail(mail) {
    currentMailDetail = mail;
    
    // 🎯 OPTIMISTIC: Update lokal DULU (hanya kalau dari user & UNREAD)
    const originalStatus = mail.status;
    
    if (mail.status === 'UNREAD' && !mail.isFromAdmin) {
        mail.status = 'READ';
        
        const mailInList = currentMailList.find(m => m.rowId === mail.rowId);
        if (mailInList) mailInList.status = 'READ';
        
        renderMailbox(currentMailList);
        
        // Fetch GAS (background) — feedback
        fetch(`${window.GAS_ADMIN_URL}?action=mailMarkRead&rowId=${mail.rowId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.feedback) {
                    updateFromFeedback(data.feedback);
                    console.log('✅ Status READ tersimpan di GAS');
                } else {
                    console.warn('⚠️ Gagal update, revert');
                    mail.status = originalStatus;
                    const m = currentMailList.find(x => x.rowId === mail.rowId);
                    if (m) m.status = originalStatus;
                    updateCache();
                    renderMailbox(currentMailList);
                }
            })
            .catch(e => {
                console.error('❌ Error update status:', e);
                mail.status = originalStatus;
                const m = currentMailList.find(x => x.rowId === mail.rowId);
                if (m) m.status = originalStatus;
                updateCache();
                renderMailbox(currentMailList);
            });
    }
    
    const isFromAdmin = mail.isFromAdmin;
    const status = mail.status || 'UNREAD';
    
    const catLabel = mail.category || 'Umum';
    const timestamp = mail.timestamp ? new Date(mail.timestamp) : new Date();
    const tanggal = timestamp.toLocaleDateString('id-ID');
    const jam = timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const pesan = escapeHtml(mail.message || '').trim();
    
    // 🎯 Label pengirim
    let senderLabel;
    if (isFromAdmin) {
        senderLabel = `<span style="color:#c9a55a; font-weight:700;">[ADMIN]</span> ${escapeHtml(mail.ign)}`;
    } else {
        senderLabel = `<b>${escapeHtml(mail.ign)}</b>`;
    }
    
    // Balasan admin (kalau REPLIED atau DONE)
    let adminReplyHTML = '';
    if (status === 'REPLIED' || status === 'DONE') {
        const adminReply = findAdminReply(mail);
        if (adminReply) {
            const replyTime = new Date(adminReply.timestamp);
            const replyTanggal = replyTime.toLocaleDateString('id-ID');
            const replyJam = replyTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const replyText = escapeHtml(adminReply.message).trim();
            
            adminReplyHTML = `
                <div class="modal-reply-section">
                    <div class="modal-reply-label">💬 Balasan Anda (${replyTanggal} ${replyJam}):</div>
                    <div class="modal-reply-body">${replyText}</div>
                </div>
            `;
        }
    }
    
    // Footer tombol
    let footerHTML = '';
    if (isFromAdmin) {
        footerHTML = '';
    } else if (status === 'DONE') {
        footerHTML = '';
    } else {
        footerHTML = `
            <div class="modal-buttons">
                <button onclick="openReplyForm()" style="background:var(--color-primary); color:white;">
                    <i class="fas fa-reply"></i> BALAS
                </button>
                <button onclick="markAsDone(${mail.rowId})" style="background:#22c55e; color:white;">
                    <i class="fas fa-check"></i> SELESAI
                </button>
            </div>
        `;
    }
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            
            <h3 style="margin:0 0 12px 0; padding-right: 40px;">📄 PESAN</h3>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:10px;">
                <div class="modal-sender-row" style="margin:0; flex:1; min-width:0;">
                    ${senderLabel}
                    <span class="modal-uid">${escapeHtml(mail.uid)}</span>
                </div>
                <button onclick="openHistory('${escapeHtml(mail.uid)}')" 
                        style="background:transparent; border:1px solid var(--border-line); border-radius:6px; padding:4px 10px; color:#c9a55a; cursor:pointer; font-size:0.65rem; flex-shrink:0;">
                    📜 HISTORY
                </button>
            </div>
            
            <div class="modal-meta-row">
                <span><i class="far fa-calendar-alt"></i> ${tanggal} ${jam}</span>
                <span><i class="fas fa-tag"></i> ${catLabel}</span>
            </div>
            
            <div class="modal-message">${pesan}</div>
            
            ${adminReplyHTML}
            
            ${footerHTML}
        </div>
    `;
    modal.style.display = 'flex';
    history.pushState({ modal: true }, "");
}

// ==========================================
// CARI BALASAN ADMIN
// ==========================================
function findAdminReply(userMessage) {
    const adminReplies = currentMailList.filter(m => 
        m.isFromAdmin &&
        m.uid === userMessage.uid &&
        m.category === userMessage.category &&
        m.timestamp > userMessage.timestamp
    );
    
    if (adminReplies.length === 0) return null;
    
    adminReplies.sort((a, b) => a.timestamp - b.timestamp);
    return adminReplies[0];
}

// ==========================================
// BUKA HISTORY (Lazy Load) — Tampilan Log
// ==========================================
async function openHistory(uid) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3 style="margin-bottom:15px;">📜 HISTORY — ${escapeHtml(uid)}</h3>
            <div id="history-content" style="max-height:400px; overflow-y:auto; padding-right:6px;">
                <div style="text-align:center; padding:20px; color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Memuat...
                </div>
            </div>
            <div class="modal-buttons" style="margin-top:15px;">
                <button onclick="window.closeModal()" style="background:#333;">Tutup</button>
            </div>
        </div>
    `;
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getMailHistory&uid=${encodeURIComponent(uid)}`);
        const data = await res.json();
        
        if (data.status === 'success' && data.history) {
            const container = document.getElementById('history-content');
            if (!data.history.length) {
                container.innerHTML = '<div class="empty-state">Belum ada history</div>';
                return;
            }
            
            let html = '';
            for (let i = 0; i < data.history.length; i++) {
                const h = data.history[i];
                const ts = new Date(h.timestamp);
                const tgl = ts.toLocaleDateString('id-ID');
                const jam = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const fromAdmin = h.isFromAdmin;
                
                // 🎯 Label pengirim
                let senderLabel;
                if (fromAdmin) {
                    senderLabel = `<span style="color:#c9a55a; font-weight:700;">[ADMIN]</span> ${escapeHtml(h.ign)}`;
                } else {
                    senderLabel = `<b>${escapeHtml(h.ign)}</b>`;
                }
                
                html += `
                    <div style="padding:10px 0;">
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">
                            ${fromAdmin ? '📤' : '📩'} ${senderLabel} • ${tgl} ${jam}
                        </div>
                        <div style="font-size:0.85rem; white-space:pre-wrap; color:var(--text-main); line-height:1.5;">${escapeHtml(h.message)}</div>
                    </div>
                `;
                
                // 🎯 Garis pemisah (kecuali pesan terakhir)
                if (i < data.history.length - 1) {
                    html += `<div style="border-top:1px solid rgba(255,255,255,0.08); margin: 4px 0;"></div>`;
                }
            }
            container.innerHTML = html;
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) {
        document.getElementById('history-content').innerHTML = 
            '<div class="empty-state">⚠️ Gagal memuat history</div>';
    }
}

// ==========================================
// BUKA FORM BALASAN
// ==========================================
function openReplyForm() {
    if (!currentMailDetail) return;
    
    const mail = currentMailDetail;
    const pesanAsli = escapeHtml(mail.message || '').trim();
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3 style="margin-bottom:15px;">✏️ BALAS — ${escapeHtml(mail.ign)}</h3>
            
            <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:10px; margin-bottom:15px; font-size:0.75rem; border-left:3px solid #64748b;">
                <div style="color:var(--text-muted); margin-bottom:4px; font-size:0.65rem;">Pesan asli:</div>
                <div style="white-space:pre-wrap;">${pesanAsli}</div>
            </div>
            
            <div style="margin-bottom:10px;">
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:5px;">BALASAN ANDA:</label>
                <textarea id="admin-reply-input" 
                          placeholder="Tulis balasan..." 
                          style="width:100%; min-height:100px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; padding:10px; color:white; font-family:inherit; resize:vertical;"
                          maxlength="1000"></textarea>
            </div>
            
            <div class="modal-buttons">
                <button onclick="submitMailReply()" style="background:var(--color-primary); color:white; flex:2;">
                    <i class="fas fa-paper-plane"></i> KIRIM
                </button>
                <button onclick="openMailDetail(currentMailDetail)" style="background:#333; flex:1;">Batal</button>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        const ta = document.getElementById('admin-reply-input');
        if (ta) ta.focus();
    }, 200);
}

// ==========================================
// KIRIM BALASAN
// ==========================================
async function submitMailReply() {
    if (!currentMailDetail) return;
    
    const input = document.getElementById('admin-reply-input');
    const reply = input ? input.value.trim() : '';
    
    if (!reply) {
        window.showToast("Balasan tidak boleh kosong", true);
        return;
    }
    
    const btn = document.querySelector('#modal-overlay .modal-buttons button:first-child');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGIRIM...';
        btn.disabled = true;
    }
    
    const adminUid = currentAdmin?.id || '';
    const adminIgn = currentAdmin?.nama || 'Admin';
    const rowId = currentMailDetail.rowId;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=mailReply&rowId=${rowId}&adminUid=${encodeURIComponent(adminUid)}&adminIgn=${encodeURIComponent(adminIgn)}&adminReply=${encodeURIComponent(reply)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast("✅ Balasan terkirim");
            
            if (data.feedback) {
                updateFromFeedback(data.feedback);
            }
            
            currentMailDetail.status = 'REPLIED';
            
            updateCache();
            renderMailbox(currentMailList);
            
            setTimeout(() => openMailDetail(currentMailDetail), 300);
        } else {
            window.showToast(data.message || "Gagal mengirim", true);
            if (btn) {
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> KIRIM';
                btn.disabled = false;
            }
        }
    } catch(e) {
        console.error("Reply error:", e);
        window.showToast("Koneksi gagal", true);
        if (btn) {
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> KIRIM';
            btn.disabled = false;
        }
    }
}

// ==========================================
// TANDAI SELESAI
// ==========================================
async function markAsDone(rowId) {
    if (!rowId) return;
    
    window.showConfirmModal('Tandai pesan ini sebagai SELESAI?', async () => {
        const originalStatus = currentMailDetail?.status;
        
        if (currentMailDetail) currentMailDetail.status = 'DONE';
        const mailInList = currentMailList.find(m => m.rowId === rowId);
        if (mailInList) mailInList.status = 'DONE';
        
        updateCache();
        renderMailbox(currentMailList);
        window.closeModal();
        
        try {
            const res = await fetch(`${window.GAS_ADMIN_URL}?action=mailClose&rowId=${rowId}`);
            const data = await res.json();
            
            if (data.status === 'success') {
                window.showToast("✅ Pesan ditandai selesai");
                
                if (data.feedback) {
                    updateFromFeedback(data.feedback);
                }
            } else {
                if (currentMailDetail) currentMailDetail.status = originalStatus;
                if (mailInList) mailInList.status = originalStatus;
                updateCache();
                renderMailbox(currentMailList);
                window.showToast(data.message || "Gagal", true);
            }
        } catch(e) {
            console.error('Error:', e);
            if (currentMailDetail) currentMailDetail.status = originalStatus;
            if (mailInList) mailInList.status = originalStatus;
            updateCache();
            renderMailbox(currentMailList);
            window.showToast("Koneksi gagal", true);
        }
    });
}

// ==========================================
// PAKAI FEEDBACK DARI GAS
// ==========================================
function updateFromFeedback(feedback) {
    if (!feedback) return;
    
    if (feedback.rowId && feedback.newStatus) {
        const mailInList = currentMailList.find(m => m.rowId === feedback.rowId);
        if (mailInList) mailInList.status = feedback.newStatus;
        
        if (currentMailDetail && currentMailDetail.rowId === feedback.rowId) {
            currentMailDetail.status = feedback.newStatus;
        }
    }
    
    if (feedback.mailboxStatus) {
        lastMailStatus = feedback.mailboxStatus;
        updateMailboxBadge(feedback.mailboxStatus);
    }
    
    updateCache();
}

// ==========================================
// UPDATE BADGE
// ==========================================
function updateMailboxBadge(mailboxStatus) {
    if (!mailboxStatus) return;
    
    const badge = document.getElementById('mail-badge');
    if (badge) {
        if (mailboxStatus.unreadCount > 0) {
            badge.innerText = mailboxStatus.unreadCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ==========================================
// UPDATE CACHE SESSION
// ==========================================
function updateCache() {
    const cacheKey = `umbrella_mail_${currentMailFilter}`;
    sessionStorage.setItem(cacheKey, JSON.stringify(currentMailList));
}

// ==========================================
// DELETE MAIL
// ==========================================
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

// ==========================================
// CHECK MAILBOX CHANGES
// ==========================================
async function checkMailboxChanges() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=checkMailboxStatus`);
        const data = await res.json();
        
        if (data.status !== 'success') return false;
        
        const current = {
            lastTimestamp: data.lastTimestamp,
            totalSurat: data.totalSurat,
            unreadCount: data.unreadCount
        };
        
        const saved = lastMailStatus;
        
        const hasChanged = (
            current.lastTimestamp !== saved.lastTimestamp ||
            current.totalSurat !== saved.totalSurat ||
            current.unreadCount !== saved.unreadCount
        );
        
        if (hasChanged) {
            lastMailStatus = current;
            
            sessionStorage.removeItem('umbrella_mail_all');
            sessionStorage.removeItem('umbrella_mail_unread');
            sessionStorage.removeItem('umbrella_mail_read');
            sessionStorage.removeItem('umbrella_mail_replied');
            sessionStorage.removeItem('umbrella_mail_done');
            sessionStorage.removeItem('umbrella_mail_sent');
            
            const isMailboxActive = document.querySelector('.nav-item.active')?.dataset.nav === 'mailbox';
            if (isMailboxActive) {
                refreshMailbox();
            }
            return true;
        }
        return false;
    } catch(e) {
        console.error("Check mailbox error:", e);
        return false;
    }
}

// ==========================================
// EXPOSE
// ==========================================
window.refreshMailbox = refreshMailbox;
window.setMailFilter = setMailFilter;
window.deleteMail = deleteMail;
window.openMailDetail = openMailDetail;
window.openHistory = openHistory;
window.openReplyForm = openReplyForm;
window.submitMailReply = submitMailReply;
window.markAsDone = markAsDone;
window.checkMailboxChanges = checkMailboxChanges;
window.updateFromFeedback = updateFromFeedback;

console.log("✅ admin-mail.js loaded (Mail 2 Arah V7 — History Fix)");
