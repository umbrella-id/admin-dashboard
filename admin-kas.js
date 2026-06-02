// ==========================================
// admin-kas.js - NO CONFLICT VERSION
// ==========================================

console.log("🚀 admin-kas.js loaded");

// HANYA fungsi yang TIDAK ADA di file lain
function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// Jangan deklarasi ulang escapeHtml dan showToast - sudah ada di admin.js

let currentMode = "setoran";
let currentAdmin = null;
let kasData = null;

async function loadDashboardData() {
    console.log("📥 loadDashboardData START");
    const container = document.getElementById("kas-container");
    if (container) container.innerHTML = '<div class="loading-state">Memuat...</div>';
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
        const result = await res.json();
        
        if (result.status === "success") {
            kasData = result.data;
            renderKasUI();
        } else {
            container.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
        }
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state">Gagal koneksi</div>';
    }
}

function renderKasUI() {
    console.log("🎨 renderKasUI called");
    const container = document.getElementById("kas-container");
    if (!container || !kasData) return;
    
    // Tampilkan JSON dulu untuk test
    container.innerHTML = `<pre>${JSON.stringify(kasData, null, 2)}</pre>`;
}

async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard called", admin?.nama);
    currentAdmin = admin;
    await loadDashboardData();
}

window.initKasDashboard = initKasDashboard;
