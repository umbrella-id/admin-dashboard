// ==========================================
// admin-kas.js - KAS System
// ==========================================

console.log("🟢 KAS System loading...");

function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

let currentAdminKas = null;
let kasData = null;

async function loadKasData() {
    console.log("📥 loadKasData START");
    const container = document.getElementById("kas-container");
    if (container) container.innerHTML = '<div class="loading-state">Memuat data KAS...</div>';
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
        const result = await res.json();
        
        if (result.status === "success") {
            kasData = result.data;
            console.log("✅ KasData loaded, members:", kasData.members?.length);
            renderKasUI();
        } else {
            if (container) container.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
        }
    } catch(e) {
        console.error("Load Kas error:", e);
        const container = document.getElementById("kas-container");
        if (container) container.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
    }
}

function renderKasUI() {
    console.log("🎨 renderKasUI called");
    const container = document.getElementById("kas-container");
    if (!container || !kasData) return;
    
    // Tampilkan JSON untuk sementara (nanti bisa diubah jadi UI cantik)
    container.innerHTML = `<pre style="color:#fff;background:#1a1a2c;padding:10px;border-radius:8px;overflow:auto;max-height:400px;">${JSON.stringify(kasData, null, 2)}</pre>`;
}

async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard called for:", admin?.nama);
    currentAdminKas = admin;
    await loadKasData();
}

window.initKasDashboard = initKasDashboard;

console.log("🟢 KAS System ready");
