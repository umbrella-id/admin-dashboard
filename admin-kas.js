// ==========================================
// admin-kas.js - DEBUG VERSION
// ==========================================

console.log("🚀 admin-kas.js loaded");

// Helper functions (formatNumber, formatDate, escapeHtml, showToast) tetap sama
// ... (salin dari versi yang berhasil) ...

let currentMode = "setoran";
let currentAdmin = null;
let kasData = null;

async function loadDashboardData() {
    console.log("📥 1. loadDashboardData START");
    const container = document.getElementById("kas-container");
    if (container) container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat...</div>';
    
    try {
        console.log("📥 2. Fetching GAS...");
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
        console.log("📥 3. Fetch response received, status:", res.status);
        
        const result = await res.json();
        console.log("📥 4. Result status:", result.status);
        
        if (result.status === "success") {
            console.log("📥 5. Setting kasData, members count:", result.data.members?.length);
            kasData = result.data;
            window.kasData = result.data; // backup
            console.log("📥 6. Calling renderKasUI...");
            renderKasUI();
        } else {
            console.log("📥 ERROR: result.status not success");
            if (container) container.innerHTML = '<div class="empty-state">Gagal memuat data KAS</div>';
            showToast("Gagal memuat data KAS", true);
        }
    } catch (e) {
        console.error("📥 FETCH ERROR:", e);
        const container = document.getElementById("kas-container");
        if (container) container.innerHTML = '<div class="empty-state">Gagal koneksi</div>';
        showToast("Gagal koneksi", true);
    }
}

function renderKasUI() {
    console.log("🎨 renderKasUI called, kasData:", kasData);
    console.log("🎨 kasData type:", typeof kasData);
    
    const container = document.getElementById("kas-container");
    console.log("🎨 container found:", !!container);
    
    if (!container) return;
    
    if (!kasData) {
        console.log("🎨 kasData is null, showing empty state");
        container.innerHTML = '<div class="empty-state">KasData null</div>';
        return;
    }
    
    console.log("🎨 Rendering JSON preview...");
    container.innerHTML = `<pre>${JSON.stringify(kasData, null, 2)}</pre>`;
    console.log("🎨 Render complete");
}

async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard START, admin:", admin?.nama);
    currentAdmin = admin;
    console.log("🎯 Calling loadDashboardData...");
    await loadDashboardData();
    console.log("🎯 initKasDashboard END");
}

// Export
window.initKasDashboard = initKasDashboard;

console.log("✅ admin-kas.js loaded complete");
