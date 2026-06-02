/**
 * admin-kas.js - KAS System UI
 */

let currentMode = "setoran"; // setoran / transfer
let currentAdmin = null;

// ==========================================
// INIT KAS DASHBOARD
// ==========================================

async function initKasDashboard(admin) {
  currentAdmin = admin;
  await loadDashboardData();
  renderKasUI();
  attachKasEventListeners();
}

async function loadDashboardData() {
  const container = document.getElementById("kas-container");
  if (container) container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat...</div>';
  
  try {
    const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
    const result = await res.json();
    
    if (result.status === "success") {
      window.kasData = result.data;
      renderKasUI();
    } else {
      showToast("Gagal memuat data KAS", true);
    }
  } catch (e) {
    console.error("Load KAS error:", e);
    showToast("Gagal koneksi", true);
  }
}

// ==========================================
// RENDER UI
// ==========================================

function renderKasUI() {
  const container = document.getElementById("kas-container");
  if (!container) return;
  
  if (!window.kasData) {
    container.innerHTML = '<div class="empty-state">Belum ada data</div>';
    return;
  }
  
  const { members, saldo, history } = window.kasData;
  
  // Build HTML
  let html = `
    <div class="kas-dashboard">
      <!-- SALDO CARDS -->
      <div class="kas-saldo-grid">
        ${Object.keys(saldo).map(nama => `
          <div class="kas-saldo-card">
            <div class="kas-saldo-name">${escapeHtml(nama)}</div>
            <div class="kas-saldo-amount">${formatNumber(saldo[nama])} <span class="kas-saldo-unit">Spina</span></div>
          </div>
        `).join('')}
      </div>
      
      <!-- MODE SELECTOR -->
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
        <div class="kas-form-group">
          <label>IGN</label>
          <div class="kas-ign-selector">
            <select id="kas-ign-select" class="kas-input">
              <option value="">-- Pilih Member --</option>
              ${members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
            </select>
            <div class="kas-ign-new">
              <input type="text" id="kas-ign-new" class="kas-input" placeholder="Atau masukkan IGN baru" style="display:none;">
            </div>
            <label class="kas-checkbox">
              <input type="checkbox" id="kas-ign-isnew"> Member Baru
            </label>
          </div>
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
        <div class="kas-form-group">
          <label>Mode Transfer</label>
          <div class="kas-radio-group">
            <label><input type="radio" name="transfer-mode" value="setor" checked> SETOR (saya memberikan ke)</label>
            <label><input type="radio" name="transfer-mode" value="terima"> TERIMA (saya menerima dari)</label>
          </div>
        </div>
        <div class="kas-form-group">
          <label>Bendahara</label>
          <select id="kas-transfer-target" class="kas-input">
            <option value="">-- Pilih Bendahara --</option>
            ${Object.keys(saldo).filter(n => n !== currentAdmin?.nama).map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
          </select>
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
        <h4><i class="fas fa-history"></i> History Transaksi</h4>
        <div class="kas-table-wrapper">
          <table class="kas-table">
            <thead>
              <tr><th>Tanggal</th><th>IGN</th><th>Spina</th><th>Notes</th><th>Admin</th></tr>
            </thead>
            <tbody>
              ${history.map(row => `
                <tr>
                  <td>${formatDate(row.timestamp)}</td>
                  <td>${escapeHtml(row.ign || '-')}</td>
                  <td class="${row.spina >= 0 ? 'kas-positive' : 'kas-negative'}">${formatNumber(row.spina)}</td>
                  <td>${escapeHtml(row.notes || '-')}</td>
                  <td>${escapeHtml(row.adm || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Setup checkbox IGN baru
  const chkNew = document.getElementById("kas-ign-isnew");
  const selectIgn = document.getElementById("kas-ign-select");
  const inputNew = document.getElementById("kas-ign-new");
  
  if (chkNew && selectIgn && inputNew) {
    chkNew.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectIgn.style.display = "none";
        inputNew.style.display = "block";
        inputNew.focus();
      } else {
        selectIgn.style.display = "block";
        inputNew.style.display = "none";
        selectIgn.value = "";
      }
    });
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function attachKasEventListeners() {
  // Mode selector
  document.querySelectorAll(".kas-mode-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      currentMode = btn.dataset.mode;
      document.querySelectorAll(".kas-mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      document.getElementById("kas-form-setoran").style.display = currentMode === "setoran" ? "block" : "none";
      document.getElementById("kas-form-transfer").style.display = currentMode === "transfer" ? "block" : "none";
    });
  });
  
  // Submit setoran
  const btnSetoran = document.getElementById("kas-btn-setoran");
  if (btnSetoran) btnSetoran.addEventListener("click", submitSetoran);
  
  // Submit transfer
  const btnTransfer = document.getElementById("kas-btn-transfer");
  if (btnTransfer) btnTransfer.addEventListener("click", submitTransfer);
}

// ==========================================
// SUBMIT HANDLERS
// ==========================================

async function submitSetoran() {
  const isNew = document.getElementById("kas-ign-isnew")?.checked;
  let ign = "";
  
  if (isNew) {
    ign = document.getElementById("kas-ign-new")?.value.trim();
  } else {
    ign = document.getElementById("kas-ign-select")?.value;
  }
  
  const spina = parseInt(document.getElementById("kas-spina")?.value);
  const notes = document.getElementById("kas-notes")?.value || "";
  
  if (!ign) {
    showToast("IGN harus diisi", true);
    return;
  }
  
  if (!spina || isNaN(spina)) {
    showToast("Spina harus diisi dengan angka", true);
    return;
  }
  
  // Disable button
  const btn = document.getElementById("kas-btn-setoran");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  btn.disabled = true;
  
  try {
    const url = `${window.GAS_ADMIN_URL}?action=addSetoran&adm=${encodeURIComponent(currentAdmin.nama)}&spina=${spina}&ign=${encodeURIComponent(ign)}&notes=${encodeURIComponent(notes)}`;
    const res = await fetch(url);
    const result = await res.json();
    
    if (result.status === "success") {
      window.kasData = result.data;
      renderKasUI();
      attachKasEventListeners();
      showToast("Setoran berhasil disimpan");
      
      // Reset form
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
  } catch (e) {
    console.error("Submit setoran error:", e);
    showToast("Gagal koneksi", true);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

async function submitTransfer() {
  const mode = document.querySelector('input[name="transfer-mode"]:checked')?.value;
  const target = document.getElementById("kas-transfer-target")?.value;
  const amount = parseInt(document.getElementById("kas-transfer-amount")?.value);
  const notes = document.getElementById("kas-transfer-notes")?.value || "";
  
  if (!target) {
    showToast("Pilih bendahara", true);
    return;
  }
  
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast("Jumlah harus diisi dengan angka positif", true);
    return;
  }
  
  let from = "", to = "";
  if (mode === "setor") {
    from = currentAdmin.nama;
    to = target;
  } else {
    from = target;
    to = currentAdmin.nama;
  }
  
  // Disable button
  const btn = document.getElementById("kas-btn-transfer");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  btn.disabled = true;
  
  try {
    const url = `${window.GAS_ADMIN_URL}?action=addTransfer&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}&notes=${encodeURIComponent(notes)}&adm=${encodeURIComponent(currentAdmin.nama)}`;
    const res = await fetch(url);
    const result = await res.json();
    
    if (result.status === "success") {
      window.kasData = result.data;
      renderKasUI();
      attachKasEventListeners();
      showToast("Transfer berhasil diproses");
      
      // Reset form
      document.getElementById("kas-transfer-target").value = "";
      document.getElementById("kas-transfer-amount").value = "";
      document.getElementById("kas-transfer-notes").value = "";
    } else {
      showToast(result.message || "Gagal transfer", true);
    }
  } catch (e) {
    console.error("Submit transfer error:", e);
    showToast("Gagal koneksi", true);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// ==========================================
// UTILITY
// ==========================================

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

function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = msg;
  toast.style.borderColor = isError ? "#ff4444" : "var(--color-primary)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// Export
window.initKasDashboard = initKasDashboard;
