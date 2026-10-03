/**
 * admin-mail.js — Mailbox Manager V2 (Mail 2 Arah)
 * Fitur: filter, list percakapan, detail, history, balas, done
 */

let currentMailFilter = "all"; // all | unread | waiting | done
let currentMailList = [];
let currentMailDetail = null;

window.setMailFilter = function(filter) {
  currentMailFilter = filter;
  refreshMailbox();
};

// ==========================================
// FETCH MAIL LIST (dengan filter)
// ==========================================
async function refreshMailbox() {
  const container = document.getElementById('mailbox-list');
  if (!container) return;
  
  // Cek cache dulu
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
// RENDER MAILBOX (List)
// ==========================================
function renderMailbox(mails) {
  const container = document.getElementById('mailbox-list');
  if (!container) return;
  
  if (!mails || mails.length === 0) {
    let msg = '📭 Tidak ada surat';
    if (currentMailFilter === 'unread') msg = '📭 Tidak ada surat belum dibaca';
    else if (currentMailFilter === 'waiting') msg = '✅ Tidak ada surat menunggu balasan';
    else if (currentMailFilter === 'done') msg = '📭 Belum ada surat selesai';
    container.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }
  
  let html = '';
  for (const mail of mails) {
    // Badge status
    let statusClass = 'badge-unread';
    let statusText = '📬 BELUM DIBACA';
    if (mail.status === 'READ') {
      statusClass = 'badge-read';
      statusText = '📄 SUDAH DIBACA';
    } else if (mail.status === 'DONE') {
      statusClass = 'badge-read';
      statusText = '✅ DONE';
    }
    
    // Icon kategori
    let catIcon = 'fa-comment', catColor = '#64748b', catLabel = 'Umum';
    if (mail.category === 'Request Join') {
      catIcon = 'fa-user-plus'; catColor = '#f59e0b'; catLabel = 'Join';
    } else if (mail.category === 'Saran') {
      catIcon = 'fa-lightbulb'; catColor = '#22c55e'; catLabel = 'Saran';
    }
    
    // Tanda: dari admin atau user
    const fromAdmin = mail.isFromAdmin;
    const senderIcon = fromAdmin ? '📤' : '📩';
    
    const ign = escapeHtml(mail.ign || 'Tidak dikenal');
    const uid = escapeHtml(mail.uid || '-');
    const message = escapeHtml(mail.message || '').trim();
    const timestamp = mail.timestamp ? new Date(mail.timestamp) : new Date();
    const tanggal = timestamp.toLocaleDateString('id-ID');
    const jam = timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    // Preview pesan
    const preview = message.substring(0, 80) + (message.length > 80 ? '...' : '');
    
    html += `
      <div class="list-item" data-rowid="${mail.rowId}">
        <div class="mail-content" data-rowid="${mail.rowId}">
          <div class="mail-header">
            <div class="mail-sender">
              <span>${senderIcon}</span>
              <b>${ign}</b>
              <span class="mail-uid">${uid}</span>
            </div>
            <div class="mail-status"><span class="${statusClass}">${statusText}</span></div>
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
  
  container.innerHTML = html;
  
  // Event: klik kartu → buka detail
  container.querySelectorAll('.mail-content').forEach(el => {
    el.onclick = () => {
      const rowId = parseInt(el.dataset.rowid);
      const mail = currentMailList.find(m => m.rowId === rowId);
      if (mail) openMailDetail(mail);
    };
  });
  
  // Event: hapus
  container.querySelectorAll('.delete-mail-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const rowId = parseInt(btn.dataset.rowid);
      if (rowId) window.deleteMail(rowId);
    };
  });
}

// ==========================================
// BUKA DETAIL PESAN (Pesan Tunggal)
// ==========================================
async function openMailDetail(mail) {
  currentMailDetail = mail;
  
  // Tandai sudah dibaca (kalau UNREAD)
  if (mail.status === 'UNREAD') {
    try {
      await fetch(`${window.GAS_ADMIN_URL}?action=mailMarkRead&rowId=${mail.rowId}`);
      mail.status = 'READ';
    } catch(e) {}
  }
  
  const catLabel = mail.category || 'Umum';
  const timestamp = mail.timestamp ? new Date(mail.timestamp) : new Date();
  const tanggal = timestamp.toLocaleDateString('id-ID');
  const jam = timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const pesan = escapeHtml(mail.message || '').trim();
  const senderIcon = mail.isFromAdmin ? '📤' : '📩';
  const senderRole = mail.isFromAdmin ? 'ADMIN' : 'USER';
  
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <button class="modal-close-x" onclick="window.closeModal()">✕</button>
      <div class="modal-sender-row">
        ${senderIcon} <b>${escapeHtml(mail.ign)}</b>
        <span class="modal-uid">${escapeHtml(mail.uid)}</span>
      </div>
      <div class="modal-status-row">
        <span style="font-size:0.65rem; color:var(--text-muted);">[${senderRole}] ${catLabel}</span>
      </div>
      <div class="modal-meta-row">
        <span><i class="far fa-calendar-alt"></i> ${tanggal} ${jam}</span>
      </div>
      <div class="modal-message">${pesan}</div>
      <div class="modal-buttons">
        <button onclick="openMailHistory('${escapeHtml(mail.uid)}')" style="background:#64748b; color:white;">📜 History</button>
        <button onclick="openReplyForm()" style="background:var(--color-primary); color:white;">✏️ Balas</button>
        <button onclick="markAsDone(${mail.rowId})" style="background:#22c55e; color:white;">✅ Done</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  history.pushState({ modal: true }, "");
}

// ==========================================
// BUKA HISTORY (Lazy Load)
// ==========================================
async function openMailHistory(uid) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <button class="modal-close-x" onclick="window.closeModal()">✕</button>
      <h3 style="margin-bottom:15px;"><i class="fas fa-history"></i> History dengan ${escapeHtml(uid)}</h3>
      <div id="history-content" style="max-height:400px; overflow-y:auto;">
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
      for (const h of data.history) {
        const ts = new Date(h.timestamp);
        const tgl = ts.toLocaleDateString('id-ID');
        const jam = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const fromAdmin = h.isFromAdmin;
        const icon = fromAdmin ? '📤' : '📩';
        const bgColor = fromAdmin ? 'rgba(168,85,247,0.1)' : 'rgba(100,116,139,0.1)';
        
        html += `
          <div style="background:${bgColor}; border-radius:8px; padding:10px; margin-bottom:8px; border-left:3px solid ${fromAdmin ? 'var(--color-primary)' : '#64748b'};">
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">
              ${icon} <b>${escapeHtml(h.ign)}</b> • ${tgl} ${jam}
            </div>
            <div style="font-size:0.85rem; white-space:pre-wrap;">${escapeHtml(h.message)}</div>
          </div>
        `;
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
      <h3 style="margin-bottom:15px;"><i class="fas fa-reply"></i> Balas ke ${escapeHtml(mail.ign)}</h3>
      
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
        <button onclick="window.closeModal()" style="background:#333; flex:1;">Batal</button>
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
      window.closeModal();
      refreshMailbox();
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
// TANDAI DONE
// ==========================================
async function markAsDone(rowId) {
  if (!rowId) return;
  
  window.showConfirmModal('Tandai pesan ini sebagai DONE?', async () => {
    try {
      const res = await fetch(`${window.GAS_ADMIN_URL}?action=mailClose&rowId=${rowId}`);
      const data = await res.json();
      
      if (data.status === 'success') {
        window.showToast("✅ Pesan ditandai selesai");
        window.closeModal();
        refreshMailbox();
      } else {
        window.showToast(data.message || "Gagal", true);
      }
    } catch(e) {
      window.showToast("Koneksi gagal", true);
    }
  });
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
// CHECK MAILBOX CHANGES (untuk notif standby)
// ==========================================
async function checkMailboxChanges() {
  try {
    const res = await fetch(`${window.GAS_ADMIN_URL}?action=checkMailboxStatus`);
    const data = await res.json();
    
    if (data.status !== 'success') return false;
    
    const savedTotal = parseInt(sessionStorage.getItem('umbrella_mail_total') || '0');
    const savedUnread = parseInt(sessionStorage.getItem('umbrella_mail_unread') || '0');
    
    const currentTotal = data.totalSurat || 0;
    const currentUnread = data.unreadCount || 0;
    
    const hasChanged = (currentTotal !== savedTotal || currentUnread !== savedUnread);
    
    sessionStorage.setItem('umbrella_mail_total', currentTotal.toString());
    sessionStorage.setItem('umbrella_mail_unread', currentUnread.toString());
    
    if (hasChanged && currentUnread > savedUnread) {
      return true; // Ada surat baru
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
window.openMailHistory = openMailHistory;
window.openReplyForm = openReplyForm;
window.submitMailReply = submitMailReply;
window.markAsDone = markAsDone;
window.checkMailboxChanges = checkMailboxChanges;

console.log("✅ admin-mail.js loaded (Mail 2 Arah V2)");
