/**
 * admin-kas.js - Modul Kas (Setoran Member & Transfer Request)
 * Terintegrasi dengan GAS 4 yang sudah di-deploy
 */

let kasData = {
    members: [],
    bendahara: [],
    saldo: {},
    history: [],
    incomingRequests: [],
    myRequests: [],
    pendingIncomingCount: 0,
    pendingMyCount: 0
};

let kasCurrentTab = 'setoran';
let kasLoading = false;

// ==========================================
// LOAD ALL KAS DATA
// ==========================================
async function loadKasDashboard() {
    if (!currentAdmin) return;
    
    const container = document.getElementById('kas-container');
    if (!container) return;
    
    if (kasLoading) return;
    kasLoading = true;
    
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data kas...</div>';
    
    try {
        // Load semua data secara paralel
        const [dashboardRes, incomingRes, myRequestsRes, pendingCountRes] = await Promise.all([
            fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`),
            fetch(`${window.GAS_ADMIN_URL}?action=getIncomingRequests&adminId=${currentAdmin.id}`),
            fetch(`${window.GAS_ADMIN_URL}?action=getMyRequestHistory&adminId=${currentAdmin.id}`),
            fetch(`${window.GAS_ADMIN_URL}?action=getAllPendingCount&adminId=${currentAdmin.id}`)
        ]);
        
        const dashboard = await dashboardRes.json();
        const incoming = await incomingRes.json();
        const myRequests = await myRequestsRes.json();
        const pendingCount = await pendingCountRes.json();
        
        if (dashboard.status === 'success' && dashboard.data) {
            kasData.saldo = dashboard.data.saldo || {};
            kasData.members = dashboard.data.members || [];
            kasData.history = dashboard.data.history || [];
            kasData.bendahara = Object.keys(kasData.saldo);
        }
        
        if (incoming.status === 'success') {
            kasData.incomingRequests = incoming.data || [];
        }
        
        if (myRequests.status === 'success') {
            kasData.myRequests = myRequests.data || [];
        }
        
        if (pendingCount.status === 'success') {
            kasData.pendingIncomingCount = pendingCount.data?.incomingCount || 0;
            kasData.pendingMyCount = pendingCount.data?.myPendingCount || 0;
        }
        
        renderKasDashboard();
        
    } catch(e) {
        console.error("Load kas error:", e);
        container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data kas</div>';
    } finally {
        kasLoading = false;
    }
}

// ==========================================
// RENDER DASHBOARD KAS
// ==========================================
function renderKasDashboard() {
    const container = document.getElementById('kas-container');
    if (!container) return;
    
    const { bendahara, saldo, members, history, incomingRequests, myRequests, pendingIncomingCount, pendingMyCount } = kasData;
    
    const canEdit = (currentAdmin.role1 === 'LEADER' || 
                     currentAdmin.role1 === 'BENDAHARA' || 
                     currentAdmin.role2 === 'BENDAHARA');
    
    let html = `
        <!-- SALDO BENDAHARA -->
        <div class="kas-section">
            <h4><i class="fas fa-wallet"></i> Saldo Bendahara</h4>
            <div class="kas-saldo-grid">
                ${bendahara.map(nama => `
                    <div class="kas-saldo-card">
                        <div class="kas-saldo-name">${escapeHtml(nama)}</div>
                        <div class="kas-saldo-amount ${(saldo[nama] || 0) < 0 ? 'negative' : ''}">
                            ${formatRupiah(saldo[nama] || 0)}
                        </div>
                    </div>
                `).join('')}
                ${bendahara.length === 0 ? '<div class="empty-state">Belum ada data bendahara</div>' : ''}
            </div>
        </div>
    `;
    
    // Form Transaksi (hanya untuk bendahara & leader)
    if (canEdit) {
        html += `
            <div class="kas-section">
                <h4><i class="fas fa-plus-circle"></i> Tambah Transaksi</h4>
                <div class="kas-tabs">
                    <button class="kas-tab-btn ${kasCurrentTab === 'setoran' ? 'active' : ''}" data-kas-tab="setoran">📥 Setoran Member</button>
                    <button class="kas-tab-btn ${kasCurrentTab === 'transfer' ? 'active' : ''}" data-kas-tab="transfer">🔄 Transfer Bendahara</button>
                </div>
                
                <!-- FORM SETORAN -->
                <div id="kas-form-setoran" class="kas-form ${kasCurrentTab === 'setoran' ? 'active' : ''}">
                    <div class="kas-mode-selector">
                        <label class="kas-radio-label">
                            <input type="radio" name="member-mode" value="list" checked> 
                            <i class="fas fa-list"></i> List Member
                        </label>
                        <label class="kas-radio-label">
                            <input type="radio" name="member-mode" value="new"> 
                            <i class="fas fa-plus-circle"></i> New Member
                        </label>
                    </div>
                    
                    <div class="kas-form-group" id="kas-member-input-group">
                        <label><i class="fas fa-user"></i> Nama Member</label>
                        <input type="text" id="kas-member-name" list="member-list" 
                               placeholder="Ketik atau pilih dari daftar..." 
                               autocomplete="off">
                        <datalist id="member-list">
                            ${members.map(m => `<option value="${escapeHtml(m)}">`).join('')}
                        </datalist>
                    </div>
                    
                    <div class="kas-form-group">
                        <label><i class="fas fa-coins"></i> Spina (Jumlah Kas)</label>
                        <input type="number" id="kas-spina" placeholder="Contoh: 50000" step="1">
                    </div>
                    
                    <div class="kas-form-group">
                        <label><i class="fas fa-sticky-note"></i> Notes (Opsional)</label>
                        <input type="text" id="kas-notes-setoran" placeholder="Keterangan...">
                    </div>
                    
                    <button class="kas-submit-btn" onclick="submitSetoran()">
                        <i class="fas fa-save"></i> INPUT
                    </button>
                </div>
                
                <!-- FORM TRANSFER (REQUEST) -->
                <div id="kas-form-transfer" class="kas-form ${kasCurrentTab === 'transfer' ? 'active' : ''}">
                    <div class="kas-form-group">
                        <label><i class="fas fa-user-check"></i> Penerima Dana</label>
                        <select id="kas-transfer-to">
                            <option value="">Pilih Bendahara</option>
                            ${bendahara.filter(nama => nama !== currentAdmin.nama).map(nama => `
                                <option value="${escapeHtml(nama)}">${escapeHtml(nama)} (${formatRupiah(saldo[nama] || 0)})</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="kas-form-group">
                        <label><i class="fas fa-coins"></i> Jumlah Dipindahkan</label>
                        <input type="number" id="kas-transfer-amount" placeholder="Contoh: 100000" step="1">
                    </div>
                    
                    <div class="kas-form-group">
                        <label><i class="fas fa-sticky-note"></i> Notes (Opsional)</label>
                        <input type="text" id="kas-notes-transfer" placeholder="Keterangan...">
                    </div>
                    
                    <button class="kas-submit-btn" onclick="submitTransferRequest()">
                        <i class="fas fa-paper-plane"></i> AJUKAN
                    </button>
                </div>
            </div>
        `;
    }
    
    // REQUEST MASUK (Incoming)
    html += `
        <div class="kas-section">
            <h4>
                <i class="fas fa-inbox"></i> Request Masuk 
                ${pendingIncomingCount > 0 ? `<span class="kas-badge">${pendingIncomingCount}</span>` : ''}
            </h4>
            <div class="kas-request-list">
                ${incomingRequests.length === 0 ? '<div class="empty-state">Tidak ada request masuk</div>' : ''}
                ${incomingRequests.map(req => `
                    <div class="kas-request-item ${req.status.toLowerCase()}">
                        <div class="kas-request-header">
                            <span class="kas-request-from">📤 Dari: ${escapeHtml(req.fromName)}</span>
                            <span class="kas-request-amount">${formatRupiah(req.amount)}</span>
                        </div>
                        <div class="kas-request-detail">
                            <div class="kas-request-notes">📝 ${escapeHtml(req.notes) || '-'}</div>
                            <div class="kas-request-time">⏱️ ${formatDate(req.timestamp)}</div>
                        </div>
                        <div class="kas-request-actions">
                            <button class="kas-btn-approve" onclick="approveTransferRequest('${req.id}')">✅ Setujui</button>
                            <button class="kas-btn-reject" onclick="rejectTransferRequest('${req.id}')">❌ Tolak</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // REQUEST SAYA (My Requests)
    html += `
        <div class="kas-section">
            <h4>
                <i class="fas fa-paper-plane"></i> Request Saya 
                ${pendingMyCount > 0 ? `<span class="kas-badge kas-badge-warning">${pendingMyCount}</span>` : ''}
            </h4>
            <div class="kas-request-list">
                ${myRequests.length === 0 ? '<div class="empty-state">Belum ada request</div>' : ''}
                ${myRequests.map(req => `
                    <div class="kas-request-item ${req.status.toLowerCase()}">
                        <div class="kas-request-header">
                            <span class="kas-request-to">📥 Ke: ${escapeHtml(req.toName)}</span>
                            <span class="kas-request-amount">${formatRupiah(req.amount)}</span>
                            <span class="kas-request-status status-${req.status.toLowerCase()}">${getStatusLabel(req.status)}</span>
                        </div>
                        <div class="kas-request-detail">
                            <div class="kas-request-notes">📝 ${escapeHtml(req.notes) || '-'}</div>
                            <div class="kas-request-time">⏱️ ${formatDate(req.timestamp)}</div>
                            ${req.processed_at ? `<div class="kas-request-processed">🕒 Diproses: ${formatDate(req.processed_at)}</div>` : ''}
                        </div>
                        ${req.status === 'PENDING' ? `
                            <div class="kas-request-actions">
                                <button class="kas-btn-cancel" onclick="cancelTransferRequest('${req.id}')">🗑️ Batalkan</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // RIWAYAT TRANSAKSI
    html += `
        <div class="kas-section">
            <h4><i class="fas fa-history"></i> Riwayat Transaksi (50 terakhir)</h4>
            <div class="kas-history-list">
                ${history.length === 0 ? '<div class="empty-state">Belum ada transaksi</div>' : ''}
                ${history.map(log => `
                    <div class="kas-history-item">
                        <div class="kas-history-time">${formatDate(log.timestamp)}</div>
                        <div class="kas-history-detail">
                            <span class="kas-history-ign">${escapeHtml(log.ign || 'SISTEM')}</span>
                            <span class="kas-history-amount ${log.spina > 0 ? 'positive' : 'negative'}">
                                ${log.spina > 0 ? '+' : ''}${formatRupiah(log.spina)}
                            </span>
                            <span class="kas-history-notes">${escapeHtml(log.notes || '-')}</span>
                            <span class="kas-history-adm"><i class="fas fa-user-shield"></i> ${escapeHtml(log.adm || '?')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Event listener untuk tab
    document.querySelectorAll('.kas-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            kasCurrentTab = btn.dataset.kasTab;
            document.querySelectorAll('.kas-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.kas-form').forEach(form => form.classList.remove('active'));
            document.getElementById(`kas-form-${kasCurrentTab}`).classList.add('active');
        });
    });
    
    // Event listener untuk radio mode member
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
// SUBMIT SETORAN
// ==========================================
async function submitSetoran() {
    const radioList = document.querySelector('input[name="member-mode"][value="list"]');
    const isListMode = radioList ? radioList.checked : true;
    
    let memberName = document.getElementById('kas-member-name')?.value.trim();
    const spina = parseInt(document.getElementById('kas-spina')?.value);
    const notes = document.getElementById('kas-notes-setoran')?.value || "";
    
    if (!memberName) {
        window.showToast("Nama member harus diisi", true);
        return;
    }
    
    if (isListMode) {
        const members = kasData.members;
        if (!members.includes(memberName)) {
            window.showToast(`"${memberName}" tidak terdaftar. Pilih dari daftar atau ganti ke mode "New Member"`, true);
            return;
        }
    }
    
    if (isNaN(spina) || spina <= 0) {
        window.showToast("Spina harus diisi dengan bilangan bulat positif", true);
        return;
    }
    
    const btn = document.querySelector('#kas-form-setoran .kas-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=addSetoran&ign=${encodeURIComponent(memberName)}&spina=${spina}&notes=${encodeURIComponent(notes)}&adm=${encodeURIComponent(currentAdmin.nama)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast(`✅ Setoran ${formatRupiah(spina)} untuk ${memberName} berhasil`);
            document.getElementById('kas-member-name').value = '';
            document.getElementById('kas-spina').value = '';
            document.getElementById('kas-notes-setoran').value = '';
            await loadKasDashboard();
        } else {
            window.showToast(data.message || "Gagal menyimpan", true);
        }
    } catch(e) {
        console.error("Submit setoran error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// SUBMIT TRANSFER REQUEST
// ==========================================
async function submitTransferRequest() {
    const to = document.getElementById('kas-transfer-to')?.value;
    const amount = parseInt(document.getElementById('kas-transfer-amount')?.value);
    const notes = document.getElementById('kas-notes-transfer')?.value || "";
    
    if (!to) {
        window.showToast("Pilih penerima dana terlebih dahulu", true);
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        window.showToast("Jumlah transfer harus diisi dengan bilangan bulat positif", true);
        return;
    }
    
    const from = currentAdmin.nama;
    const fromId = currentAdmin.id;
    
    // Cari ID penerima dari daftar bendahara (perlu mapping)
    // Untuk sementara, kita kirim nama dulu, ID akan dicari di backend
    // Tapi lebih baik kita punya mapping nama → id
    
    const btn = document.querySelector('#kas-form-transfer .kas-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim request...';
    btn.disabled = true;
    
    try {
        // Cari toId dari nama penerima (perlu endpoint tambahan atau mapping)
        // Sementara kirim dengan nama, backend akan cari sendiri
        const url = `${window.GAS_ADMIN_URL}?action=requestTransfer&fromId=${fromId}&fromName=${encodeURIComponent(from)}&toName=${encodeURIComponent(to)}&amount=${amount}&notes=${encodeURIComponent(notes)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast(`✅ Request transfer ${formatRupiah(amount)} ke ${to} terkirim, menunggu persetujuan`);
            document.getElementById('kas-transfer-to').value = '';
            document.getElementById('kas-transfer-amount').value = '';
            document.getElementById('kas-notes-transfer').value = '';
            await loadKasDashboard();
        } else {
            window.showToast(data.message || "Gagal mengirim request", true);
        }
    } catch(e) {
        console.error("Submit transfer request error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// APPROVE TRANSFER REQUEST
// ==========================================
async function approveTransferRequest(requestId) {
    window.showConfirmModal('Setujui transfer ini? Setelah disetujui, saldo akan langsung berubah.', async () => {
        const btn = event?.target;
        const originalHtml = btn?.innerHTML || 'Setujui';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
        }
        
        try {
            const url = `${window.GAS_ADMIN_URL}?action=approveTransfer&requestId=${requestId}&approvedBy=${currentAdmin.id}&approvedByName=${encodeURIComponent(currentAdmin.nama)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success') {
                window.showToast(data.message || "Transfer disetujui");
                await loadKasDashboard();
            } else {
                window.showToast(data.message || "Gagal menyetujui", true);
            }
        } catch(e) {
            console.error("Approve transfer error:", e);
            window.showToast("Gagal koneksi", true);
        } finally {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    });
}

// ==========================================
// REJECT TRANSFER REQUEST
// ==========================================
async function rejectTransferRequest(requestId) {
    window.showConfirmModal('Tolak transfer ini?', async () => {
        const btn = event?.target;
        const originalHtml = btn?.innerHTML || 'Tolak';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
        }
        
        try {
            const url = `${window.GAS_ADMIN_URL}?action=rejectTransfer&requestId=${requestId}&rejectedBy=${currentAdmin.id}&rejectedByName=${encodeURIComponent(currentAdmin.nama)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success') {
                window.showToast(data.message || "Transfer ditolak");
                await loadKasDashboard();
            } else {
                window.showToast(data.message || "Gagal menolak", true);
            }
        } catch(e) {
            console.error("Reject transfer error:", e);
            window.showToast("Gagal koneksi", true);
        } finally {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    });
}

// ==========================================
// CANCEL TRANSFER REQUEST
// ==========================================
async function cancelTransferRequest(requestId) {
    window.showConfirmModal('Batalkan request transfer ini?', async () => {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=cancelTransfer&requestId=${requestId}&cancelledBy=${currentAdmin.id}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success') {
                window.showToast(data.message || "Request dibatalkan");
                await loadKasDashboard();
            } else {
                window.showToast(data.message || "Gagal membatalkan", true);
            }
        } catch(e) {
            console.error("Cancel transfer error:", e);
            window.showToast("Gagal koneksi", true);
        }
    });
}

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

function getStatusLabel(status) {
    const labels = {
        'PENDING': '⏳ Menunggu',
        'APPROVED': '✅ Disetujui',
        'REJECTED': '❌ Ditolak',
        'EXPIRED': '⏰ Kadaluarsa',
        'CANCELLED': '🗑️ Dibatalkan'
    };
    return labels[status] || status;
}

// ==========================================
// REFRESH KAS
// ==========================================
window.refreshKas = function() {
    loadKasDashboard();
};

function getPendingCountForAdmin() {
  // Implementasi sederhana
  return 0;
}

// ==========================================
// EXPOSE GLOBAL FUNCTIONS
// ==========================================
window.loadKasDashboard = loadKasDashboard;
window.submitSetoran = submitSetoran;
window.submitTransferRequest = submitTransferRequest;
window.approveTransferRequest = approveTransferRequest;
window.rejectTransferRequest = rejectTransferRequest;
window.cancelTransferRequest = cancelTransferRequest;
window.getPendingCountForAdmin = getPendingCountForAdmin;

console.log("✅ admin-kas.js loaded");
