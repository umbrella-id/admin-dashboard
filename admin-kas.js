/**
 * admin-kas.js - Modul Kas Lengkap
 * Semua operasi AJAX, update cache, tanpa reload halaman
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
    totalSaldo: 0
};

let kasLoading = false;
let kasCurrentForm = 'setoran';

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatRupiah(angka) {
    if (angka === undefined || angka === null) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(angka);
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
// CORE FUNCTIONS - UPDATE CACHE & RENDER
// ==========================================
function updateKasDataFromResponse(responseData) {
    console.log("🟢 updateKasDataFromResponse dipanggil", responseData);
    if (!responseData) {
        console.log("⚠️ responseData kosong!");
        return false;
    }
    
    kasData.members = responseData.members || [];
    kasData.saldo = responseData.saldo || {};
    kasData.history = responseData.history || [];
    kasData.incomingRequests = responseData.incomingRequests || [];
    kasData.outgoingRequests = (responseData.myRequests || []).filter(r => r.status === 'PENDING');
    kasData.bendahara = Object.keys(kasData.saldo);
    kasData.totalSaldo = kasData.bendahara.reduce((sum, nama) => sum + (kasData.saldo[nama] || 0), 0);
    kasData.unreadNotifCount = responseData.pendingCount?.notifications || 0;
    
    renderKasDashboard();
    updateNotifBadge();
    return true;
}

async function loadKasDashboard(forceRefresh = false) {
    console.log("🔄 loadKasDashboard DIPANGGIL");
    
    if (!currentAdmin || kasLoading) return;
    
    const container = document.getElementById('kas-container');
    if (!container) return;
    console.trace();
    // 🔄 BACA DARI CACHE DULU (kecuali forceRefresh)
    if (!forceRefresh) {
        const cached = sessionStorage.getItem('umbrella_cached_kas');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                updateKasDataFromResponse(data);  // update global
                renderKasDashboard();
                console.log("📦 Render kas dari cache");
            } catch(e) {}
        }
    }
    
    kasLoading = true;
    
    // Tampilkan loading hanya jika tidak ada cache
    const hasCache = !forceRefresh && sessionStorage.getItem('umbrella_cached_kas');
    if (!hasCache) {
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data kas...</div>';
    }
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=getKasFullData&adminId=${currentAdmin.id}`);
        const result = await response.json();
        console.log("📡 loadKasDashboard response:", result);
        
        if (result.status === 'success' && result.data) {
            // 💾 SIMPAN KE CACHE
            sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(result.data));
            sessionStorage.setItem('umbrella_cached_kas_time', Date.now().toString());
            
            updateKasDataFromResponse(result.data);
            renderKasDashboard();
        } else if (!hasCache) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data kas</div>';
        }
    } catch(e) {
        console.error("Load kas error:", e);
        if (!hasCache) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal koneksi</div>';
        }
    } finally {
        kasLoading = false;
    }
}

async function loadNotifCount() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getUnreadKasNotificationsCount&adminId=${currentAdmin.id}`);
        const data = await res.json();
        kasData.unreadNotifCount = data.count || 0;
        updateNotifBadge();
    } catch(e) {
        console.error("Load notif count error:", e);
    }
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

window.refreshKas = async function() {
    const btn = document.querySelector('#kas-container .btn-small');
    if (!btn) return;
    
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refresh';
    btn.disabled = true;
    
    try {
        await loadKasDashboard(true);
        window.showToast("✅ Data kas diperbarui");
    } catch(e) {
        window.showToast("❌ Gagal refresh", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

// ==========================================
// RENDER DASHBOARD
// ==========================================
function renderKasDashboard() {
    console.log("🎨 renderKasDashboard DIPANGGIL");
    const container = document.getElementById('kas-container');
    if (!container) return;
    
    const { bendahara, saldo, totalSaldo, incomingRequests, outgoingRequests, history, unreadNotifCount } = kasData;
    
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
                        <span class="kas-saldo-value">${formatRupiah(saldo[nama] || 0)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="kas-total-box">
                <div class="kas-total-label">TOTAL KAS GUILD</div>
                <div class="kas-total-value">${formatRupiah(totalSaldo)}</div>
            </div>
        </div>
    `;
    
    if (totalPending > 0) {
        html += `
            <div class="kas-pending-section">
                <div class="kas-pending-header">
                    <span><i class="fas fa-exchange-alt"></i> REQUEST TRANSFER</span>
                    <span class="kas-pending-badge">${totalPending}</span>
                </div>
                <div class="kas-pending-list">
                    ${allPending.map(req => `
                        <div class="kas-pending-item ${req.type}">
                            <div class="kas-pending-info">
                                <span class="kas-pending-icon">${req.type === 'incoming' ? '📥' : '📤'}</span>
                                <span class="kas-pending-desc">
                                    ${req.type === 'incoming' ? `Dari ${escapeHtml(req.fromName)}` : `Ke ${escapeHtml(req.toName)}`}
                                    <span class="kas-pending-amount">${formatRupiah(req.amount)}</span>
                                </span>
                            </div>
                            <div class="kas-pending-actions">
                                ${req.type === 'incoming' ? `
                                    <button class="kas-btn-approve" onclick="approveTransferRequest('${req.id}')">✅ Setujui</button>
                                    <button class="kas-btn-reject" onclick="rejectTransferRequest('${req.id}')">❌ Tolak</button>
                                ` : `
                                    <button class="kas-btn-cancel" onclick="cancelTransferRequest('${req.id}')">🗑️ Batalkan</button>
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
                            <option value="${escapeHtml(nama)}">${escapeHtml(nama)} (${formatRupiah(saldo[nama] || 0)})</option>
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
        </div>
        
        <div class="kas-history-section">
            <div class="kas-history-header"><span><i class="fas fa-history"></i> RIWAYAT TRANSAKSI (50 terakhir)</span></div>
            <div class="kas-history-list">
                ${history.length === 0 ? '<div class="empty-state">Belum ada transaksi</div>' : ''}
                ${history.map(log => `
                    <div class="kas-history-row">
                        <div class="kas-history-date">${formatDate(log.timestamp)}</div>
                        <div class="kas-history-ign">${escapeHtml(log.ign || 'SISTEM')}</div>
                        <div class="kas-history-amount ${log.spina > 0 ? 'positive' : 'negative'}">${log.spina > 0 ? '+' : ''}${formatRupiah(log.spina)}</div>
                        <div class="kas-history-notes">${escapeHtml(log.notes || '-')}</div>
                        <div class="kas-history-adm">${escapeHtml(log.adm || '?')}</div>
                        ${log.adm === currentAdmin.nama ? `
                            <div class="kas-history-actions">
                                <button class="kas-edit-btn" onclick="editTransaction(${log.rowId}, '${escapeHtml(log.notes)}', ${log.spina})" title="Edit">✏️</button>
                            </div>
                        ` : '<div class="kas-history-actions"></div>'}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Event listeners
    document.querySelectorAll('.kas-form-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            kasCurrentForm = btn.dataset.form;
            document.querySelectorAll('.kas-form-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.kas-form-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`kas-form-${kasCurrentForm}`).classList.add('active');
        });
    });
    
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
// NOTIFIKASI
// ==========================================
async function openKasNotification() {
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getKasNotifications&adminId=${currentAdmin.id}`);
        const data = await res.json();
        
        if (data.status === 'success' && data.data && data.data.length > 0) {
            showNotificationModal(data.data);
        } else {
            window.showToast("Tidak ada notifikasi baru");
        }
        
        await fetch(`${window.GAS_ADMIN_URL}?action=clearKasNotifications&adminId=${currentAdmin.id}`);
        kasData.unreadNotifCount = 0;
        updateNotifBadge();
    } catch(e) {
        console.error("Open notifikasi error:", e);
        window.showToast("Gagal memuat notifikasi", true);
    }
}

function showNotificationModal(notifications) {
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
                            <div class="kas-notif-modal-desc">${formatRupiah(notif.amount)} dari ${escapeHtml(notif.fromName)} ke ${escapeHtml(notif.toName)}</div>
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
// OPERASI KAS
// ==========================================
async function submitSetoran() {
    console.log("🔵 submitSetoran DIPANGGIL");
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
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=addSetoran&ign=${encodeURIComponent(memberName)}&spina=${spina}&notes=${encodeURIComponent(notes)}&adm=${encodeURIComponent(currentAdmin.nama)}`);
        const data = await response.json();
        console.log("📡 submitSetoran response:", data);
        
        if (data.status === 'success') {
            window.showToast("✅ Setoran berhasil");
            if (data.data) {
                // 💾 UPDATE CACHE & DATA GLOBAL
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                console.log("⚠️ Tidak ada data.data, refresh manual...");
                await loadKasDashboard();
            }
            document.getElementById('kas-member-name').value = '';
            document.getElementById('kas-spina').value = '';
            document.getElementById('kas-notes-setoran').value = '';
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

async function submitTransferRequest() {
    console.log("🔵 submitTransferRequest DIPANGGIL");
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
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=requestTransfer&fromId=${currentAdmin.id}&fromName=${encodeURIComponent(currentAdmin.nama)}&toName=${encodeURIComponent(to)}&amount=${amount}&notes=${encodeURIComponent(notes)}`);
        const data = await response.json();
        console.log("📡 submitTransferRequest response:", data);
        
        if (data.status === 'success') {
            window.showToast(data.message || `✅ Request transfer ${formatRupiah(amount)} ke ${to} terkirim`);
            if (data.data) {
                // 💾 UPDATE CACHE & DATA GLOBAL
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                console.log("⚠️ Tidak ada data.data, refresh manual...");
                await loadKasDashboard();
            }
            document.getElementById('kas-transfer-to').value = '';
            document.getElementById('kas-transfer-amount').value = '';
            document.getElementById('kas-notes-transfer').value = '';
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

async function approveTransferRequest(requestId) {
    console.log("🔵 approveTransferRequest DIPANGGIL", requestId);
    window.showConfirmModal('Setujui transfer ini?', async () => {
        try {
            const response = await fetch(`${window.GAS_ADMIN_URL}?action=approveTransfer&requestId=${requestId}&approvedBy=${currentAdmin.id}&approvedByName=${encodeURIComponent(currentAdmin.nama)}`);
            const data = await response.json();
            console.log("📡 approveTransferRequest response:", data);
            
            if (data.status === 'success') {
                window.showToast(data.message || "Transfer disetujui");
                if (data.data) {
                    // 💾 UPDATE CACHE & DATA GLOBAL
                    sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                    updateKasDataFromResponse(data.data);
                } else {
                    console.log("⚠️ Tidak ada data.data, refresh manual...");
                    await loadKasDashboard();
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

async function rejectTransferRequest(requestId) {
    console.log("🔵 rejectTransferRequest DIPANGGIL", requestId);
    window.showConfirmModal('Tolak transfer ini?', async () => {
        try {
            const response = await fetch(`${window.GAS_ADMIN_URL}?action=rejectTransfer&requestId=${requestId}&rejectedBy=${currentAdmin.id}&rejectedByName=${encodeURIComponent(currentAdmin.nama)}`);
            const data = await response.json();
            console.log("📡 rejectTransferRequest response:", data);
            
            if (data.status === 'success') {
                window.showToast(data.message || "Transfer ditolak");
                if (data.data) {
                    // 💾 UPDATE CACHE & DATA GLOBAL
                    sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                    updateKasDataFromResponse(data.data);
                } else {
                    console.log("⚠️ Tidak ada data.data, refresh manual...");
                    await loadKasDashboard();
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

async function cancelTransferRequest(requestId) {
    console.log("🔵 cancelTransferRequest DIPANGGIL", requestId);
    window.showConfirmModal('Batalkan request transfer ini?', async () => {
        try {
            const response = await fetch(`${window.GAS_ADMIN_URL}?action=cancelTransfer&requestId=${requestId}&cancelledBy=${currentAdmin.id}`);
            const data = await response.json();
            console.log("📡 cancelTransferRequest response:", data);
            
            if (data.status === 'success') {
                window.showToast(data.message || "Request dibatalkan");
                if (data.data) {
                    // 💾 UPDATE CACHE & DATA GLOBAL
                    sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                    updateKasDataFromResponse(data.data);
                } else {
                    console.log("⚠️ Tidak ada data.data, refresh manual...");
                    await loadKasDashboard();
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
// EDIT TRANSACTION
// ==========================================
async function editTransaction(rowId, oldNotes, oldAmount) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-edit"></i> Edit Transaksi</h3>
            
            <div class="kas-form-group">
                <label>Nominal Baru</label>
                <input type="number" id="edit-amount" value="${Math.abs(oldAmount)}" step="1">
                <small>Isi 0 untuk menghapus transaksi ini</small>
            </div>
            
            <!-- ❌ Notes TIDAK ditampilkan -->
            
            <div class="modal-buttons">
                <button id="save-edit-btn" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    document.getElementById('save-edit-btn').onclick = () => saveEditTransaction(rowId);
}

async function saveEditTransaction(rowId) {
    console.log("🔵 saveEditTransaction DIPANGGIL", rowId);
    const parsedRowId = parseInt(rowId);
    if (isNaN(parsedRowId) || parsedRowId <= 0) {
        window.showToast("Error: ID transaksi tidak valid", true);
        return;
    }
    
    const newAmount = parseInt(document.getElementById('edit-amount')?.value);
    const newNotes = document.getElementById('edit-notes')?.value || "";
    
    if (!currentAdmin || !currentAdmin.nama) return window.showToast("Error: Data admin tidak ditemukan", true);
    
    closeModal();
    
    try {
        const response = await fetch(`${window.GAS_ADMIN_URL}?action=updateTransaction&rowId=${parsedRowId}&amount=${newAmount}&notes=${encodeURIComponent(newNotes)}&adminName=${encodeURIComponent(currentAdmin.nama)}`);
        const data = await response.json();
        console.log("📡 saveEditTransaction response:", data);
        
        if (data.status === 'success') {
            window.showToast(data.message || "✅ Transaksi diperbarui");
            if (data.data) {
                // 💾 UPDATE CACHE & DATA GLOBAL
                sessionStorage.setItem('umbrella_cached_kas', JSON.stringify(data.data));
                updateKasDataFromResponse(data.data);
            } else {
                console.log("⚠️ Tidak ada data.data, refresh manual...");
                await loadKasDashboard();
            }
        } else {
            window.showToast(data.message || "Gagal mengupdate", true);
        }
    } catch(e) {
        console.error("❌ saveEditTransaction error:", e);
        window.showToast("Gagal koneksi", true);
    }
}

// ==========================================
// REFRESH & EXPOSE
// ==========================================
window.refreshKas = () => { loadKasDashboard(); loadNotifCount(); };
window.loadKasDashboard = loadKasDashboard;
window.submitSetoran = submitSetoran;
window.submitTransferRequest = submitTransferRequest;
window.approveTransferRequest = approveTransferRequest;
window.rejectTransferRequest = rejectTransferRequest;
window.cancelTransferRequest = cancelTransferRequest;
window.openKasNotification = openKasNotification;
window.editTransaction = editTransaction;
window.saveEditTransaction = saveEditTransaction;

console.log("✅ admin-kas.js loaded");
