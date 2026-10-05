/**
 * admin-kas.js - Modul Kas Lengkap (V4 — XSS Fix + Polish)
 * 
 * Perubahan dari V3:
 * - 🛡️ FIX XSS: Hapus onclick inline dengan data user, ganti data-attribute + event delegation
 * - Rapikan render tombol edit transaksi
 * - Konsisten dengan pola V3 (router, tanpa hardcoded)
 */

let kasData = {
    members: [],
    bendahara: [],
    saldo: {},
    history: [],
    incomingRequests: [],
    outgoingRequests: [],
    notifications: [],
    unreadNotifCount: 0,
    totalSaldo: 0,
    currentTarif: null,
    currentTarifDate: null,
    tarifLogs: []
};

let kasLoading = false;
let kasCurrentForm = 'setoran';

// ==========================================
// UTILITY
// ==========================================
function formatSpina(angka) {
    if (angka === undefined || angka === null) return '0 S';
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(angka) + ' S';
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = new Date(timestamp);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch(e) {
        return timestamp.toString();
    }
}

// ==========================================
// UPDATE DATA DARI RESPONSE
// ==========================================
function updateKasDataFromResponse(responseData) {
    if (!responseData) return false;
    
    kasData.members = responseData.members || [];
    kasData.saldo = responseData.saldo || {};
    kasData.history = responseData.history || [];
    kasData.incomingRequests = responseData.incomingRequests || [];
    kasData.outgoingRequests = (responseData.myRequests || []).filter(r => r.status === 'PENDING');
    kasData.bendahara = Object.keys(kasData.saldo);
    kasData.totalSaldo = kasData.bendahara.reduce((sum, nama) => sum + (kasData.saldo[nama] || 0), 0);
    kasData.unreadNotifCount = responseData.pendingCount?.notifications || 0;
    
    kasData.currentTarif = responseData.currentTarif || null;
    kasData.currentTarifDate = responseData.currentTarifDate || null;
    kasData.tarifLogs = responseData.tarifLogs || [];
    
    renderKasDashboard();
    updateNotifBadge();
    return true;
}

function updateNotifBadge() {
    const badge = document.getElementById('kas-notif-badge');
    if (badge) {
        if (kasData.unreadNotifCount > 0) {
            badge.textContent = kasData.unreadNotifCount > 99 ? '99+' : kasData.unreadNotifCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ==========================================
// LOAD KAS DASHBOARD
// ==========================================
async function loadKasDashboard(forceRefresh = false) {
    if (!currentAdmin || kasLoading) return;
    
    const container = document.getElementById('kas-container');
    if (!container) return;
    
    const cached = sessionStorage.getItem('umbrella_cached_kas');
    if (cached && !forceRefresh) {
        try {
            const data = JSON.parse(cached);
            updateKasDataFromResponse(data);
        } catch(e) {}
    }
    
    kasLoading = true;
    
    const showLoading = !forceRefresh && !cached;
    if (showLoading) {
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data kas...</div>';
    }
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=getKasFullData&adminId=${currentAdmin.id}`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(result.data));
            sessionStorage.setItem('umbrella_cached_kas_time', Date.now().toString());
            updateKasDataFromResponse(result.data);
        } else if (showLoading) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data kas</div>';
        }
    } catch(e) {
        console.error("Load kas error:", e);
        if (showLoading) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal koneksi</div>';
        }
    } finally {
        kasLoading = false;
    }
}

// ==========================================
// REFRESH KAS
// ==========================================
window.refreshKas = async function() {
    const btn = document.querySelector('.tab-page[data-tab="kas"] .refresh-btn');
    if (!btn) return;
    
    const icon = btn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');
    btn.disabled = true;
    
    try {
        await loadKasDashboard(true);
        window.showToast("✅ Data kas diperbarui");
    } catch(e) {
        console.error("Refresh kas error:", e);
        window.showToast("❌ Gagal refresh", true);
    } finally {
        if (icon) icon.classList.remove('fa-spin');
        btn.disabled = false;
    }
};

// ==========================================
// RENDER DASHBOARD KAS
// ==========================================
function renderKasDashboard() {
    const container = document.getElementById('kas-container');
    if (!container) return;
    
    const { bendahara, saldo, totalSaldo, incomingRequests, outgoingRequests, history, unreadNotifCount, currentTarif, currentTarifDate, tarifLogs } = kasData;

    const today = new Date().toISOString().split('T')[0];
    
    const allPending = [
        ...incomingRequests.map(r => ({ ...r, type: 'incoming' })),
        ...outgoingRequests.map(r => ({ ...r, type: 'outgoing' }))
    ];
    allPending.sort((a, b) => a.timestamp - b.timestamp);
    const totalPending = allPending.length;
    
    let html = `
        <div class="kas-notif-bar" onclick="openKasNotification()">
            <div class="kas-notif-icon">
                <i class="fas fa-bell"></i>
                <span id="kas-notif-badge" class="kas-notif-badge" style="display: ${unreadNotifCount > 0 ? 'inline-flex' : 'none'};">${unreadNotifCount}</span>
            </div>
            <span class="kas-notif-label">Notifikasi</span>
        </div>
        
        <div class="kas-saldo-section">
            <div class="kas-saldo-list">
                ${bendahara.map(nama => `
                    <div class="kas-saldo-row">
                        <span class="kas-saldo-name">${escapeHtml(nama)}</span>
                        <span class="kas-saldo-value">${formatSpina(saldo[nama] || 0)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="kas-total-box">
                <div class="kas-total-label">TOTAL KAS GUILD</div>
                <div class="kas-total-value">${formatSpina(totalSaldo)}</div>
            </div>
        </div>
    `;
    
    if (currentAdmin.role1 === 'LEADER' || currentAdmin.role2 === 'LEADER') {
        html += `
            <div id="kas-tarif-section" class="kas-tarif-section">
                <div class="kas-tarif-header">
                    <span><i class="fas fa-tag"></i> TARIF KAS</span>
                    <button class="btn-small" onclick="openTarifModal()">
                        <i class="fas fa-edit"></i> Ubah
                    </button>
                </div>
                <div id="kas-tarif-current" class="kas-tarif-current">
                    ${currentTarif ? `
                        <div class="tarif-value">${formatSpina(currentTarif)} / minggu</div>
                        <div class="tarif-date">Berlaku sejak: ${currentTarifDate || '-'}</div>
                    ` : '<div class="tarif-value">Belum ada tarif</div>'}
                </div>
                <div id="kas-tarif-history" class="kas-tarif-history">
                    <div class="kas-tarif-history-header">Riwayat Perubahan</div>
                    <div id="kas-tarif-history-list" class="kas-tarif-history-list">
                        ${tarifLogs && tarifLogs.length > 0 ? tarifLogs.map(log => {
                            const isUpcoming = log.tanggal > today;
                            return `
                                <div class="tarif-history-row ${isUpcoming ? 'upcoming' : ''}">
                                    <span class="tarif-history-date">${escapeHtml(log.tanggal)}</span>
                                    <span class="tarif-history-value">${formatSpina(log.tarif)}</span>
                                    ${isUpcoming ? '<span class="tarif-history-badge">akan datang</span>' : ''}
                                </div>
                            `;
                        }).join('') : '<div class="empty-state">Belum ada perubahan tarif</div>'}
                    </div>
                </div>
            </div>
        `;
    }
    
    if (totalPending > 0) {
        html += `
            <div class="kas-pending-section">
                <div class="kas-pending-header">
                    <span><i class="fas fa-exchange-alt"></i> REQUEST TRANSFER</span>
                    <span class="kas-pending-badge">${totalPending}</span>
                </div>
                <div class="kas-pending-list">
                    ${allPending.map(req => `
                        <div class="kas-pending-item ${req.type}" data-req-id="${escapeHtml(req.id)}" data-req-type="${req.type}">
                            <div class="kas-pending-info">
                                <span class="kas-pending-icon">${req.type === 'incoming' ? '📥' : '📤'}</span>
                                <span class="kas-pending-desc">
                                    ${req.type === 'incoming' ? `Dari ${escapeHtml(req.fromName)}` : `Ke ${escapeHtml(req.toName)}`}
                                    <span class="kas-pending-amount">${formatSpina(req.amount)}</span>
                                </span>
                            </div>
                            <div class="kas-pending-actions">
                                ${req.type === 'incoming' ? `
                                    <button class="kas-btn-approve" data-action="approve">✅ Setujui</button>
                                    <button class="kas-btn-reject" data-action="reject">❌ Tolak</button>
                                ` : `
                                    <button class="kas-btn-cancel" data-action="cancel">🗑️ Batalkan</button>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    html += `
        <div class="kas-forms-section">
            <div class="kas-form-tabs">
                <button class="kas-form-tab ${kasCurrentForm === 'setoran' ? 'active' : ''}" data-form="setoran">📥 INPUT KAS</button>
                <button class="kas-form-tab ${kasCurrentForm === 'transfer' ? 'active' : ''}" data-form="transfer">🔄 TRANSFER BENDAHARA</button>
    `;
    
    if (currentAdmin.role1 === 'LEADER' || currentAdmin.role2 === 'LEADER') {
        html += `<button class="kas-form-tab ${kasCurrentForm === 'pengeluaran' ? 'active' : ''}" data-form="pengeluaran">📤 KAS KELUAR</button>`;
    }
    
    html += `
            </div>
            
            <div id="kas-form-setoran" class="kas-form-panel ${kasCurrentForm === 'setoran' ? 'active' : ''}">
                <div class="kas-mode-selector">
                    <label class="kas-radio-label"><input type="radio" name="member-mode" value="list" checked> <i class="fas fa-list"></i> List Member</label>
                    <label class="kas-radio-label"><input type="radio" name="member-mode" value="new"> <i class="fas fa-plus-circle"></i> New Member</label>
                </div>
                <div class="kas-form-group">
                    <label>Nama Member</label>
                    <input type="text" id="kas-member-name" list="member-list" placeholder="Ketik atau pilih dari daftar..." autocomplete="off">
                    <datalist id="member-list">${kasData.members.map(m => `<option value="${escapeHtml(m)}">`).join('')}</datalist>
                </div>
                <div class="kas-form-group">
                    <label>Jumlah Kas Diterima (Spina)</label>
                    <input type="number" id="kas-spina" placeholder="Contoh: 50000" step="1">
                </div>
                <div class="kas-form-group">
                    <label>Notes (Opsional)</label>
                    <input type="text" id="kas-notes-setoran" placeholder="Keterangan...">
                </div>
                <button class="kas-submit-btn" onclick="submitSetoran()"><i class="fas fa-save"></i> INPUT</button>
            </div>
            
            <div id="kas-form-transfer" class="kas-form-panel ${kasCurrentForm === 'transfer' ? 'active' : ''}">
                <div class="kas-form-group">
                    <label>Penerima Dana</label>
                    <select id="kas-transfer-to">
                        <option value="">Pilih Bendahara</option>
                        ${bendahara.filter(nama => nama !== currentAdmin.nama).map(nama => `
                            <option value="${escapeHtml(nama)}">${escapeHtml(nama)} (${formatSpina(saldo[nama] || 0)})</option>
                        `).join('')}
                    </select>
                </div>
                <div class="kas-form-group">
                    <label>Jumlah Dipindahkan</label>
                    <input type="number" id="kas-transfer-amount" placeholder="Contoh: 100000" step="1">
                </div>
                <div class="kas-form-group">
                    <label>Notes (Opsional)</label>
                    <input type="text" id="kas-notes-transfer" placeholder="Keterangan...">
                </div>
                <button class="kas-submit-btn" onclick="submitTransferRequest()"><i class="fas fa-paper-plane"></i> AJUKAN</button>
            </div>
    `;
    
    if (currentAdmin.role1 === 'LEADER' || currentAdmin.role2 === 'LEADER') {
        html += `
            <div id="kas-form-pengeluaran" class="kas-form-panel ${kasCurrentForm === 'pengeluaran' ? 'active' : ''}">
                <div class="kas-form-group">
                    <label>Keterangan <span style="color:#ff4444;">*</span></label>
                    <input type="text" id="kas-keterangan" placeholder="Contoh: Beli perlengkapan guild" autocomplete="off">
                </div>
                <div class="kas-form-group">
                    <label>Jumlah (Spina)</label>
                    <input type="number" id="kas-pengeluaran" placeholder="Contoh: 50000" step="1">
                </div>
                <div class="kas-form-group">
                    <label>Notes (Detail Pengeluaran)</label>
                    <textarea id="kas-notes-pengeluaran" rows="3" placeholder="Detail pengeluaran...&#10;Contoh:&#10;- Pembelian banner event 1 pcs = 25.000&#10;- Stiker guild 10 pcs = 25.000"></textarea>
                </div>
                <button class="kas-submit-btn" onclick="submitPengeluaran()">
                    <i class="fas fa-money-bill-wave"></i> Catat Pengeluaran
                </button>
            </div>
        `;
    }
    
    html += `
        </div>
        
        <div class="kas-history-section">
            <div class="kas-history-header"><span><i class="fas fa-history"></i> RIWAYAT TRANSAKSI (50 terakhir)</span></div>
            <div class="kas-history-list">
                ${history.length === 0 ? '<div class="empty-state">Belum ada transaksi</div>' : ''}
                ${history.map(log => `
                    <div class="kas-history-row">
                        <div class="kas-history-date">${formatDate(log.timestamp)}</div>
                        <div class="kas-history-ign">${escapeHtml(log.ign || 'SISTEM')}</div>
                        <div class="kas-history-amount ${log.spina > 0 ? 'positive' : 'negative'}">${log.spina > 0 ? '+' : ''}${formatSpina(log.spina)}</div>
                        <div class="kas-history-notes">${escapeHtml(log.notes || '-')}</div>
                        <div class="kas-history-adm">${escapeHtml(log.adm || '?')}</div>
                        ${log.adm === currentAdmin.nama ? `
                            <div class="kas-history-actions">
                                <button class="kas-edit-btn" 
                                        data-rowid="${log.rowId}" 
                                        data-notes="${escapeHtml(log.notes || '')}" 
                                        data-spina="${log.spina}"
                                        title="Edit">✏️</button>
                            </div>
                        ` : '<div class="kas-history-actions"></div>'}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // ==========================================
    // EVENT DELEGATION — Kas Form Tabs
    // ==========================================
    const formsSection = container.querySelector('.kas-forms-section');
    if (formsSection) {
        formsSection.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.kas-form-tab');
            if (!tabBtn) return;
            
            kasCurrentForm = tabBtn.dataset.form;
            formsSection.querySelectorAll('.kas-form-tab').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            formsSection.querySelectorAll('.kas-form-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById(`kas-form-${kasCurrentForm}`);
            if (panel) panel.classList.add('active');
        });
    }
    
    // ==========================================
    // EVENT DELEGATION — Kas Edit Button (XSS FIX)
    // ==========================================
    container.querySelectorAll('.kas-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const rowId = parseInt(btn.dataset.rowid);
            const notes = btn.dataset.notes;  // Sudah di-decode otomatis oleh browser
            const spina = parseInt(btn.dataset.spina);
            editTransaction(rowId, notes, spina);
        });
    });
    
    // ==========================================
    // EVENT DELEGATION — Transfer Request Buttons
    // ==========================================
    container.querySelectorAll('.kas-pending-item').forEach(item => {
        const reqId = item.dataset.reqId;
        const reqType = item.dataset.reqType;
        
        const approveBtn = item.querySelector('[data-action="approve"]');
        const rejectBtn = item.querySelector('[data-action="reject"]');
        const cancelBtn = item.querySelector('[data-action="cancel"]');
        
        if (approveBtn) {
            approveBtn.addEventListener('click', () => approveTransferRequest(reqId));
        }
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => rejectTransferRequest(reqId));
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => cancelTransferRequest(reqId));
        }
    });
    
    // ==========================================
    // Radio mode listener
    // ==========================================
    const radioList = document.querySelector('input[name="member-mode"][value="list"]');
    const radioNew = document.querySelector('input[name="member-mode"][value="new"]');
    const memberInput = document.getElementById('kas-member-name');
    
    if (radioList && radioNew && memberInput) {
        const toggleMemberMode = () => {
            if (radioList.checked) {
                memberInput.setAttribute('list', 'member-list');
                memberInput.placeholder = "Ketik atau pilih dari daftar member...";
                memberInput.style.borderColor = "var(--border-line)";
            } else {
                memberInput.removeAttribute('list');
                memberInput.placeholder = "Masukkan nama member baru...";
                memberInput.style.borderColor = "#22c55e";
            }
        };
        radioList.addEventListener('change', toggleMemberMode);
        radioNew.addEventListener('change', toggleMemberMode);
        toggleMemberMode();
    }
}

// ==========================================
// NOTIFIKASI — PUBLIC
// ==========================================
async function openKasNotification() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getKasNotifications&adminId=${currentAdmin.id}`);
        const data = await res.json();
        
        if (data.status === 'success' && data.data && data.data.length > 0) {
            renderKasNotificationInternal(data.data);
            if (typeof pushView === 'function') {
                pushView('kas-notif');
            }
        } else {
            window.showToast("Tidak ada notifikasi baru");
            return;
        }
        
        await fetch(`${window.GAS_ADMIN_URL}?action=clearKasNotifications&adminId=${currentAdmin.id}`);
        kasData.unreadNotifCount = 0;
        updateNotifBadge();
    } catch(e) {
        console.error("Open notifikasi error:", e);
        window.showToast("Gagal memuat notifikasi", true);
    }
}

// ==========================================
// NOTIFIKASI — INTERNAL
// ==========================================
function renderKasNotificationInternal(notifications) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-bell"></i> Notifikasi Kas</h3>
            <div class="kas-notif-modal-list">
                ${notifications.map(notif => `
                    <div class="kas-notif-modal-item ${notif.type.toLowerCase()}">
                        <div class="kas-notif-modal-icon">${notif.type === 'APPROVED' ? '✅' : '❌'}</div>
                        <div class="kas-notif-modal-content">
                            <div class="kas-notif-modal-title">${notif.type === 'APPROVED' ? 'Transfer Disetujui' : (notif.type === 'REJECTED' ? 'Transfer Ditolak' : 'Transfer Expired')}</div>
                            <div class="kas-notif-modal-desc">${formatSpina(notif.amount)} dari ${escapeHtml(notif.fromName)} ke ${escapeHtml(notif.toName)}</div>
                            <div class="kas-notif-modal-time">${formatDate(notif.timestamp)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="modal-buttons"><button onclick="closeModal()">Tutup</button></div>
        </div>
    `;
    modal.style.display = 'flex';
}

// ==========================================
// SUBMIT SETORAN
// ==========================================
async function submitSetoran() {
    const radioList = document.querySelector('input[name="member-mode"][value="list"]');
    const isListMode = radioList ? radioList.checked : true;
    let memberName = document.getElementById('kas-member-name')?.value.trim();
    const spina = parseInt(document.getElementById('kas-spina')?.value);
    const notes = document.getElementById('kas-notes-setoran')?.value || "";
    
    if (!memberName) return window.showToast("Nama member harus diisi", true);
    if (isListMode && !kasData.members.includes(memberName)) return window.showToast(`"${memberName}" tidak terdaftar.`, true);
    if (isNaN(spina) || spina <= 0) return window.showToast("Spina harus diisi dengan bilangan bulat positif", true);
    
    const btn = document.querySelector('#kas-form-setoran .kas-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    const isNewMember = !isListMode;
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=addSetoran&adminId=${currentAdmin.id}&ign=${encodeURIComponent(memberName)}&spina=${spina}&notes=${encodeURIComponent(notes)}&adm=${encodeURIComponent(currentAdmin.nama)}&isNewMember=${isNewMember}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            window.showToast(data.message || "✅ Setoran berhasil");
            if (data.data) {
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                await loadKasDashboard(true);
            }
            const mn = document.getElementById('kas-member-name');
            const sp = document.getElementById('kas-spina');
            const nt = document.getElementById('kas-notes-setoran');
            if (mn) mn.value = '';
            if (sp) sp.value = '';
            if (nt) nt.value = '';
        } else {
            window.showToast(data.message || "Gagal menyimpan", true);
        }
    } catch(e) {
        console.error("❌ submitSetoran error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// SUBMIT TRANSFER
// ==========================================
async function submitTransferRequest() {
    const to = document.getElementById('kas-transfer-to')?.value;
    const amount = parseInt(document.getElementById('kas-transfer-amount')?.value);
    const notes = document.getElementById('kas-notes-transfer')?.value || "";
    
    if (!to) return window.showToast("Pilih penerima dana terlebih dahulu", true);
    if (isNaN(amount) || amount <= 0) return window.showToast("Jumlah transfer harus diisi dengan bilangan bulat positif", true);
    
    const btn = document.querySelector('#kas-form-transfer .kas-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim request...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=requestTransfer&adminId=${currentAdmin.id}&fromId=${currentAdmin.id}&fromName=${encodeURIComponent(currentAdmin.nama)}&toName=${encodeURIComponent(to)}&amount=${amount}&notes=${encodeURIComponent(notes)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            window.showToast(data.message || `✅ Request transfer ${formatSpina(amount)} ke ${to} terkirim`);
            if (data.data) {
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                await loadKasDashboard(true);
            }
            const toEl = document.getElementById('kas-transfer-to');
            const amEl = document.getElementById('kas-transfer-amount');
            const ntEl = document.getElementById('kas-notes-transfer');
            if (toEl) toEl.value = '';
            if (amEl) amEl.value = '';
            if (ntEl) ntEl.value = '';
        } else {
            window.showToast(data.message || "Gagal mengirim request", true);
        }
    } catch(e) {
        console.error("❌ submitTransferRequest error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// SUBMIT PENGELUARAN
// ==========================================
async function submitPengeluaran() {
    if (currentAdmin.role1 !== 'LEADER' && currentAdmin.role2 !== 'LEADER') {
        window.showToast("Hanya Leader yang bisa mencatat pengeluaran", true);
        return;
    }
    
    const keterangan = document.getElementById('kas-keterangan')?.value.trim();
    const spina = parseInt(document.getElementById('kas-pengeluaran')?.value);
    const notes = document.getElementById('kas-notes-pengeluaran')?.value || "";
    
    if (!keterangan) {
        window.showToast("Keterangan harus diisi", true);
        return;
    }
    if (isNaN(spina) || spina <= 0) {
        window.showToast("Jumlah harus diisi dengan bilangan bulat positif", true);
        return;
    }
    
    const btn = document.querySelector('#kas-form-pengeluaran .kas-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=addPengeluaran&adminId=${currentAdmin.id}&adm=${encodeURIComponent(currentAdmin.nama)}&spina=${spina}&notes=${encodeURIComponent(notes)}&keterangan=${encodeURIComponent(keterangan)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            window.showToast("✅ Pengeluaran dicatat");
            if (data.data) {
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                await loadKasDashboard(true);
            }
            const kt = document.getElementById('kas-keterangan');
            const sp = document.getElementById('kas-pengeluaran');
            const nt = document.getElementById('kas-notes-pengeluaran');
            if (kt) kt.value = '';
            if (sp) sp.value = '';
            if (nt) nt.value = '';
        } else {
            window.showToast(data.message || "Gagal", true);
        }
    } catch(e) {
        console.error("Pengeluaran error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// APPROVE TRANSFER
// ==========================================
async function approveTransferRequest(requestId) {
    window.showConfirmModal('Setujui transfer ini?', async () => {
        try {
            const response = await fetch(`${window.GAS_ADMIN_URL}?action=approveTransfer&adminId=${currentAdmin.id}&requestId=${requestId}&approvedBy=${currentAdmin.id}&approvedByName=${encodeURIComponent(currentAdmin.nama)}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                window.showToast(data.message || "Transfer disetujui");
                if (data.data) {
                    sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                    updateKasDataFromResponse(data.data);
                } else {
                    await loadKasDashboard(true);
                }
            } else {
                window.showToast(data.message || "Gagal menyetujui", true);
            }
        } catch(e) {
            console.error("❌ approveTransferRequest error:", e);
            window.showToast("Gagal koneksi", true);
        }
    });
}

// ==========================================
// REJECT TRANSFER
// ==========================================
async function rejectTransferRequest(requestId) {
    window.showConfirmModal('Tolak transfer ini?', async () => {
        try {
            const response = await fetch(`${window.GAS_ADMIN_URL}?action=rejectTransfer&adminId=${currentAdmin.id}&requestId=${requestId}&rejectedBy=${currentAdmin.id}&rejectedByName=${encodeURIComponent(currentAdmin.nama)}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                window.showToast(data.message || "Transfer ditolak");
                if (data.data) {
                    sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                    updateKasDataFromResponse(data.data);
                } else {
                    await loadKasDashboard(true);
                }
            } else {
                window.showToast(data.message || "Gagal menolak", true);
            }
        } catch(e) {
            console.error("❌ rejectTransferRequest error:", e);
            window.showToast("Gagal koneksi", true);
        }
    });
}

// ==========================================
// CANCEL TRANSFER
// ==========================================
async function cancelTransferRequest(requestId) {
    window.showConfirmModal('Batalkan request transfer ini?', async () => {
        try {
            const response = await fetch(`${window.GAS_ADMIN_URL}?action=cancelTransfer&adminId=${currentAdmin.id}&requestId=${requestId}&cancelledBy=${currentAdmin.id}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                window.showToast(data.message || "Request dibatalkan");
                if (data.data) {
                    sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                    updateKasDataFromResponse(data.data);
                } else {
                    await loadKasDashboard(true);
                }
            } else {
                window.showToast(data.message || "Gagal membatalkan", true);
            }
        } catch(e) {
            console.error("❌ cancelTransferRequest error:", e);
            window.showToast("Gagal koneksi", true);
        }
    });
}

// ==========================================
// EDIT TRANSACTION — PUBLIC
// ==========================================
function editTransaction(rowId, oldNotes, oldAmount) {
    const log = { rowId, oldNotes, oldAmount };
    renderEditTransactionInternal(log);
    if (typeof pushView === 'function') {
        pushView('kas-edit', { log });
    }
}

// ==========================================
// EDIT TRANSACTION — INTERNAL
// ==========================================
function renderEditTransactionInternal(log) {
    const { rowId, oldNotes, oldAmount } = log;
    const isPengeluaran = oldAmount < 0 || (oldNotes && oldNotes.includes('[PENGELUARAN]'));
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-edit"></i> Edit Transaksi</h3>
            
            <div class="kas-form-group">
                <label>Nominal Baru</label>
                <input type="number" id="edit-amount" value="${Math.abs(oldAmount)}" step="1">
                <small>Isi 0 untuk menghapus transaksi ini.</small>
            </div>
            
            ${isPengeluaran ? `
            <div class="kas-form-group">
                <label>Notes (Detail Pengeluaran)</label>
                <textarea id="edit-notes" rows="3" placeholder="Detail pengeluaran...">${escapeHtml(oldNotes.replace('[PENGELUARAN]', '').trim())}</textarea>
                <small>Catatan: Pengeluaran akan tetap bertanda negatif.</small>
            </div>
            ` : ''}
            
            <div class="modal-buttons">
                <button id="save-transaction-btn" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    document.getElementById('save-transaction-btn').onclick = () => saveEditTransaction(rowId);
}

// ==========================================
// SAVE EDIT TRANSACTION
// ==========================================
async function saveEditTransaction(rowId) {
    try {
        const parsedRowId = parseInt(rowId);
        if (isNaN(parsedRowId) || parsedRowId <= 0) {
            window.showToast("Error: ID transaksi tidak valid", true);
            return;
        }
        
        let newAmount = parseInt(document.getElementById('edit-amount')?.value);
        if (isNaN(newAmount)) newAmount = 0;
        
        const notesTextarea = document.getElementById('edit-notes');
        let newNotes = '';
        if (notesTextarea) {
            newNotes = notesTextarea.value.trim();
        }
        
        if (!currentAdmin || !currentAdmin.nama) {
            window.showToast("Error: Data admin tidak ditemukan", true);
            return;
        }
        
        closeModal();
        
        let url = `${window.GAS_ADMIN_URL}?action=updateTransaction&adminId=${currentAdmin.id}&rowId=${parsedRowId}&amount=${newAmount}&adminName=${encodeURIComponent(currentAdmin.nama)}`;
        if (newNotes) {
            url += `&notes=${encodeURIComponent(newNotes)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success') {
            window.showToast(data.message || "✅ Transaksi diperbarui");
            if (data.data) {
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                await loadKasDashboard(true);
            }
        } else {
            window.showToast(data.message || "Gagal mengupdate", true);
        }
    } catch(e) {
        console.error("❌ CATCH ERROR:", e);
        window.showToast("Gagal koneksi", true);
    }
}

// ==========================================
// TARIF MODAL — PUBLIC
// ==========================================
function openTarifModal() {
    renderTarifModalInternal();
    if (typeof pushView === 'function') {
        pushView('kas-tarif');
    }
}

// ==========================================
// TARIF MODAL — INTERNAL
// ==========================================
function renderTarifModalInternal() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-tag"></i> Ubah Tarif Kas</h3>
            <div class="form-group" style="margin-bottom:16px;">
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">Tarif baru (Spina) per bulan</label>
                <input type="number" id="tarif-baru" placeholder="Contoh: 50000" step="1" value="0" style="width:100%; padding:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <small style="display:block; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">Tarif akan berlaku mulai awal bulan depan</small>
            </div>
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitUpdateTarif()" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function submitUpdateTarif() {
    const tarifBaru = parseInt(document.getElementById('tarif-baru')?.value);
    
    if (isNaN(tarifBaru) || tarifBaru <= 0) {
        window.showToast("Tarif harus lebih dari 0", true);
        return;
    }
    
    const modalContent = document.querySelector('#modal-overlay .modal-content');
    const btn = modalContent?.querySelector('button:first-of-type');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        btn.disabled = true;
    }
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=updateTarif&adminId=${currentAdmin.id}&tarif=${tarifBaru}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            await loadKasDashboard(true);
        } else {
            window.showToast(result.message || "Gagal", true);
        }
    } catch(e) {
        console.error("Update tarif error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

// ==========================================
// EXPOSE
// ==========================================
window.refreshKas = window.refreshKas;
window.loadKasDashboard = loadKasDashboard;
window.submitSetoran = submitSetoran;
window.submitTransferRequest = submitTransferRequest;
window.submitPengeluaran = submitPengeluaran;
window.approveTransferRequest = approveTransferRequest;
window.rejectTransferRequest = rejectTransferRequest;
window.cancelTransferRequest = cancelTransferRequest;
window.openKasNotification = openKasNotification;
window.editTransaction = editTransaction;
window.saveEditTransaction = saveEditTransaction;
window.openTarifModal = openTarifModal;
window.submitUpdateTarif = submitUpdateTarif;

// Expose internal untuk router
window.renderKasNotificationInternal = renderKasNotificationInternal;
window.renderEditTransactionInternal = renderEditTransactionInternal;
window.renderTarifModalInternal = renderTarifModalInternal;

console.log("✅ admin-kas.js loaded (V4 — XSS Fix + Polish)");
