// ==========================================
// admin-kas.js - KAS SYSTEM FULL VERSION
// ==========================================

console.log("🟢 KAS System Full Version loading...");

// Helper functions (sudah ada di admin.js, tapi kita deklarasi ulang agar aman)
function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, function(m) {
        if (m === "&") return "&amp;";
        if (m === "<") return "&lt;";
        if (m === ">") return "&gt;";
        return m;
    });
}

// Variables
let currentMode = "setoran";
let currentAdmin = null;
let kasData = null;

// Load data from GAS
async function loadKasData() {
    console.log("📥 loadKasData START");
    const container = document.getElementById("kas-container");
    if (container) container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data KAS...</div>';
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
        const result = await res.json();
        
        if (result.status === "success") {
            kasData = result.data;
            console.log("✅ KasData loaded, members:", kasData.members?.length);
            renderKasUI();
        } else {
            if (container) container.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
            showToast("Gagal memuat data KAS", true);
        }
    } catch(e) {
        console.error("Load Kas error:", e);
        const container = document.getElementById("kas-container");
        if (container) container.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
        showToast("Gagal koneksi ke server", true);
    }
}

// Render Full UI
function renderKasUI() {
    console.log("🎨 renderKasUI FULL called");
    const container = document.getElementById("kas-container");
    if (!container || !kasData) return;
    
    const { members, saldo, history } = kasData;
    
    // ========== SALDO CARDS ==========
    let saldoHtml = '<div class="kas-saldo-grid">';
    for (const [nama, nilai] of Object.entries(saldo)) {
        saldoHtml += `
            <div class="kas-saldo-card">
                <div class="kas-saldo-name">${escapeHtml(nama)}</div>
                <div class="kas-saldo-amount">${formatNumber(nilai)} <span class="kas-saldo-unit">Spina</span></div>
            </div>
        `;
    }
    saldoHtml += '</div>';
    
    // ========== MEMBER OPTIONS ==========
    let memberOptions = '<option value="">-- Pilih Member --</option>';
    if (members && members.length) {
        memberOptions += members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    }
    
    // ========== BENDAHARA OPTIONS ==========
    let bendaharaOptions = '<option value="">-- Pilih Bendahara --</option>';
    if (saldo) {
        bendaharaOptions += Object.keys(saldo)
            .filter(n => n !== currentAdmin?.nama)
            .map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
            .join('');
    }
    
    // ========== HISTORY TABLE ==========
    let historyHtml = '';
    if (history && history.length) {
        for (const row of history) {
            const spinaClass = row.spina >= 0 ? 'kas-positive' : 'kas-negative';
            historyHtml += `
                <tr>
                    <td>${formatDate(row.timestamp)}</td>
                    <td>${escapeHtml(row.ign || '-')}</td>
                    <td class="${spinaClass}">${formatNumber(row.spina)}</td>
                    <td>${escapeHtml(row.notes || '-')}</td>
                    <td>${escapeHtml(row.adm || '-')}</td>
                </tr>
            `;
        }
    } else {
        historyHtml = '<tr><td colspan="5" class="empty-state">Belum ada transaksi</td></tr>';
    }
    
    // ========== FULL HTML ==========
    const html = `
        ${saldoHtml}
        
        <div class="kas-mode-selector">
            <button class="kas-mode-btn ${currentMode === 'setoran' ? 'active' : ''}" data-mode="setoran">
                <i class="fas fa-hand-holding-usd"></i> Setoran Member
            </button>
            <button class="kas-mode-btn ${currentMode === 'transfer' ? 'active' : ''}" data-mode="transfer">
                <i class="fas fa-exchange-alt"></i> Transfer Bendahara
            </button>
        </div>
        
        <!-- FORM SETORAN -->
        <div id="kas-form-setoran" class="kas-form" style="display: ${currentMode === 'setoran' ? 'block' : 'none'}">
            <h3><i class="fas fa-hand-holding-usd"></i> Setoran Member</h3>
            <div class="kas-form-group">
                <label>IGN</label>
                <div class="kas-ign-selector">
                    <select id="kas-ign-select" class="kas-input">${memberOptions}</select>
                    <input type="text" id="kas-ign-new" class="kas-input" placeholder="Atau masukkan IGN baru" style="display:none;">
                </div>
                <label class="kas-checkbox">
                    <input type="checkbox" id="kas-ign-isnew"> Member Baru
                </label>
            </div>
            <div class="kas-form-group">
                <label>Spina <span class="required">*</span></label>
                <input type="number" id="kas-spina" class="kas-input" placeholder="Masukkan jumlah spina" step="1000">
            </div>
            <div class="kas-form-group">
                <label>Notes (opsional)</label>
                <textarea id="kas-notes" class="kas-input" rows="2" placeholder="Keterangan..."></textarea>
            </div>
            <div class="kas-form-group">
                <label>Admin</label>
                <input type="text" class="kas-input" value="${escapeHtml(currentAdmin?.nama || '-')}" disabled>
            </div>
            <button id="kas-btn-setoran" class="kas-btn-submit"><i class="fas fa-save"></i> Simpan Setoran</button>
        </div>
        
        <!-- FORM TRANSFER -->
        <div id="kas-form-transfer" class="kas-form" style="display: ${currentMode === 'transfer' ? 'block' : 'none'}">
            <h3><i class="fas fa-exchange-alt"></i> Transfer Bendahara</h3>
            <div class="kas-form-group">
                <label>Mode Transfer</label>
                <div class="kas-radio-group">
                    <label><input type="radio" name="transfer-mode" value="setor" checked> SETOR (saya memberikan ke)</label>
                    <label><input type="radio" name="transfer-mode" value="terima"> TERIMA (saya menerima dari)</label>
                </div>
            </div>
            <div class="kas-form-group">
                <label>Bendahara</label>
                <select id="kas-transfer-target" class="kas-input">${bendaharaOptions}</select>
            </div>
            <div class="kas-form-group">
                <label>Jumlah Spina <span class="required">*</span></label>
                <input type="number" id="kas-transfer-amount" class="kas-input" placeholder="Masukkan jumlah spina" step="1000">
            </div>
            <div class="kas-form-group">
                <label>Notes (opsional)</label>
                <textarea id="kas-transfer-notes" class="kas-input" rows="2" placeholder="Keterangan..."></textarea>
            </div>
            <div class="kas-form-group">
                <label>Admin</label>
                <input type="text" class="kas-input" value="${escapeHtml(currentAdmin?.nama || '-')}" disabled>
            </div>
            <button id="kas-btn-transfer" class="kas-btn-submit"><i class="fas fa-exchange-alt"></i> Proses Transfer</button>
        </div>
        
        <!-- HISTORY TABLE -->
        <div class="kas-history">
            <h3><i class="fas fa-history"></i> History Transaksi</h3>
            <div class="kas-table-wrapper">
                <table class="kas-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>IGN</th>
                            <th>Spina</th>
                            <th>Notes</th>
                            <th>Admin</th>
                        </tr>
                    </thead>
                    <tbody>${historyHtml}</tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Attach event listeners
    attachKasEventListeners();
}

// Event Listeners
function attachKasEventListeners() {
    // Mode selector
    document.querySelectorAll(".kas-mode-btn").forEach(btn => {
        btn.onclick = () => {
            currentMode = btn.dataset.mode;
            document.querySelectorAll(".kas-mode-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById("kas-form-setoran").style.display = currentMode === "setoran" ? "block" : "none";
            document.getElementById("kas-form-transfer").style.display = currentMode === "transfer" ? "block" : "none";
        };
    });
    
    // Member baru checkbox
    const chkNew = document.getElementById("kas-ign-isnew");
    const selectIgn = document.getElementById("kas-ign-select");
    const inputNew = document.getElementById("kas-ign-new");
    if (chkNew && selectIgn && inputNew) {
        chkNew.onchange = (e) => {
            if (e.target.checked) {
                selectIgn.style.display = "none";
                inputNew.style.display = "block";
                inputNew.focus();
            } else {
                selectIgn.style.display = "block";
                inputNew.style.display = "none";
                selectIgn.value = "";
            }
        };
    }
    
    // Submit setoran
    const btnSetoran = document.getElementById("kas-btn-setoran");
    if (btnSetoran) btnSetoran.onclick = () => submitSetoran();
    
    // Submit transfer
    const btnTransfer = document.getElementById("kas-btn-transfer");
    if (btnTransfer) btnTransfer.onclick = () => submitTransfer();
}

// Submit Setoran
async function submitSetoran() {
    const isNew = document.getElementById("kas-ign-isnew")?.checked;
    let ign = isNew ? document.getElementById("kas-ign-new")?.value.trim() : document.getElementById("kas-ign-select")?.value;
    const spina = parseInt(document.getElementById("kas-spina")?.value);
    const notes = document.getElementById("kas-notes")?.value || "";
    
    if (!ign) { showToast("IGN harus diisi", true); return; }
    if (!spina || isNaN(spina)) { showToast("Spina harus diisi angka", true); return; }
    
    const btn = document.getElementById("kas-btn-setoran");
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=addSetoran&adm=${encodeURIComponent(currentAdmin.nama)}&spina=${spina}&ign=${encodeURIComponent(ign)}&notes=${encodeURIComponent(notes)}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.status === "success") {
            kasData = result.data;
            renderKasUI();
            showToast("Setoran berhasil disimpan");
            document.getElementById("kas-spina").value = "";
            document.getElementById("kas-notes").value = "";
            if (document.getElementById("kas-ign-isnew")?.checked) {
                document.getElementById("kas-ign-isnew").checked = false;
                document.getElementById("kas-ign-select").style.display = "block";
                document.getElementById("kas-ign-new").style.display = "none";
                document.getElementById("kas-ign-new").value = "";
            }
            document.getElementById("kas-ign-select").value = "";
        } else {
            showToast(result.message || "Gagal menyimpan", true);
        }
    } catch(e) {
        console.error(e);
        showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// Submit Transfer
async function submitTransfer() {
    const mode = document.querySelector('input[name="transfer-mode"]:checked')?.value;
    const target = document.getElementById("kas-transfer-target")?.value;
    const amount = parseInt(document.getElementById("kas-transfer-amount")?.value);
    const notes = document.getElementById("kas-transfer-notes")?.value || "";
    
    if (!target) { showToast("Pilih bendahara", true); return; }
    if (!amount || isNaN(amount) || amount <= 0) { showToast("Jumlah harus diisi angka positif", true); return; }
    
    let from = mode === "setor" ? currentAdmin.nama : target;
    let to = mode === "setor" ? target : currentAdmin.nama;
    
    const btn = document.getElementById("kas-btn-transfer");
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=addTransfer&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}&notes=${encodeURIComponent(notes)}&adm=${encodeURIComponent(currentAdmin.nama)}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.status === "success") {
            kasData = result.data;
            renderKasUI();
            showToast("Transfer berhasil diproses");
            document.getElementById("kas-transfer-target").value = "";
            document.getElementById("kas-transfer-amount").value = "";
            document.getElementById("kas-transfer-notes").value = "";
        } else {
            showToast(result.message || "Gagal transfer", true);
        }
    } catch(e) {
        console.error(e);
        showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// Main entry point
async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard FULL called for:", admin?.nama);
    currentAdmin = admin;
    await loadKasData();
}

// Show toast (fallback if not exists in admin.js)
window.showToast = window.showToast || function(msg, isError) {
    alert(msg);
};

// Export
window.initKasDashboard = initKasDashboard;

console.log("🟢 KAS System Full Version ready");
