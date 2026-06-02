// ==========================================
// admin-kas.js - KAS System (Dengan Cache)
// ==========================================

console.log("🟢 admin-kas.js loaded - With Cache");

// Pastikan URL GAS tersedia
if (typeof window.GAS_ADMIN_URL === 'undefined') {
    window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
    console.log("✅ GAS_ADMIN_URL manually set");
}

// Cache untuk menyimpan data Kas
window.kasDataCache = null;
window.kasDataLoading = false;

// ==========================================
// PRELOAD DATA (dipanggil saat halaman load)
// ==========================================
async function preloadKasData(admin) {
    if (window.kasDataCache || window.kasDataLoading) {
        console.log("📥 Kas data already cached or loading");
        return;
    }
    
    window.kasDataLoading = true;
    console.log("📥 Preloading Kas data...");
    
    try {
        const url = window.GAS_ADMIN_URL + "?action=getDashboardData";
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === "success") {
            window.kasDataCache = result.data;
            console.log("✅ Kas data cached, members:", window.kasDataCache.members?.length);
        } else {
            console.error("❌ Preload Kas failed:", result.message);
        }
    } catch(e) {
        console.error("❌ Preload Kas error:", e);
    } finally {
        window.kasDataLoading = false;
    }
}

// ==========================================
// LOAD DATA (fallback jika cache kosong)
// ==========================================
async function loadKasData() {
    console.log("📥 loadKasData START (fallback)");
    const container = document.getElementById("kas-container");
    if (container) container.innerHTML = '<div class="loading-state">Memuat data KAS...</div>';
    
    try {
        const url = window.GAS_ADMIN_URL + "?action=getDashboardData";
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === "success") {
            window.kasDataCache = result.data;
            renderKasUI(window.kasDataCache);
        } else {
            if (container) container.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
        }
    } catch(e) {
        console.error("Load Kas error:", e);
        if (container) container.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
    }
}

// ==========================================
// RENDER UI (dari cache)
// ==========================================
function renderKasUI(data) {
    console.log("🎨 renderKasUI called");
    const container = document.getElementById("kas-container");
    if (!container) return;
    
    if (!data) {
        container.innerHTML = '<div class="empty-state">Belum ada data</div>';
        return;
    }
    
    const { members, saldo, history } = data;
    
    // Format saldo cards
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
    
    // Sederhanakan dulu untuk test
    container.innerHTML = `
        ${saldoHtml}
        <div style="background:#1a1a2c; border:1px solid #22c55e; border-radius:12px; padding:20px; margin-top:20px;">
            <h3 style="color:#22c55e;">✅ KAS System Siap!</h3>
            <p><strong>Member:</strong> ${members?.length || 0} orang</p>
            <p><strong>History:</strong> ${history?.length || 0} transaksi</p>
            <details>
                <summary>Lihat Detail</summary>
                <pre style="color:#ccc;font-size:11px;">${JSON.stringify(data, null, 2)}</pre>
            </details>
        </div>
    `;
}

// ==========================================
// INIT KAS (dipanggil saat tab diklik)
// ==========================================
async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard called for:", admin?.nama);
    
    if (window.kasDataCache) {
        console.log("📦 Using cached Kas data");
        renderKasUI(window.kasDataCache);
    } else {
        console.log("🔄 No cache, loading Kas data...");
        await loadKasData();
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
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

// ==========================================
// EXPORT
// ==========================================
window.preloadKasData = preloadKasData;
window.initKasDashboard = initKasDashboard;
window.kasDataCache = null;

console.log("🟢 admin-kas.js ready - dengan cache system");
