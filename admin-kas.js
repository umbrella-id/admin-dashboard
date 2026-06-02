// ==========================================
// admin-kas.js - TAHAP 1: Hanya Saldo Cards
// ==========================================

console.log("🟢 KAS Tahap 1: Loading...");

function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

let currentAdmin = null;
let kasData = null;

async function loadKasData() {
    console.log("📥 loadKasData START");
    const container = document.getElementById("kas-container");
    if (container) container.innerHTML = '<div class="loading-state">Memuat...</div>';
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
        const result = await res.json();
        
        if (result.status === "success") {
            kasData = result.data;
            console.log("✅ Data loaded");
            renderKasUI();
        } else {
            container.innerHTML = '<div class="empty-state">Gagal memuat</div>';
        }
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
    }
}

function renderKasUI() {
    console.log("🎨 renderKasUI TAHAP 1");
    const container = document.getElementById("kas-container");
    if (!container || !kasData) return;
    
    const { saldo } = kasData;
    
    let html = '<div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;">';
    for (const [nama, nilai] of Object.entries(saldo)) {
        html += `
            <div style="background:#1a1a2c; border:1px solid #a855f7; border-radius:16px; padding:15px; min-width:120px; text-align:center;">
                <div style="color:#888; font-size:0.8rem;">${escapeHtml(nama)}</div>
                <div style="color:#a855f7; font-size:1.3rem; font-weight:bold;">${formatNumber(nilai)}</div>
                <div style="color:#888; font-size:0.7rem;">Spina</div>
            </div>
        `;
    }
    html += '</div>';
    html += '<p style="color:green;">✅ TAHAP 1 BERHASIL - Saldo cards muncul</p>';
    
    container.innerHTML = html;
}

async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard called for:", admin?.nama);
    currentAdmin = admin;
    await loadKasData();
}

window.initKasDashboard = initKasDashboard;
console.log("🟢 KAS Tahap 1 Siap");
