// ==========================================
// admin-finance.js - TEST CACHE BYPASS
// ==========================================

console.log("🟢 admin-finance.js LOADED - TEST VERSION");

// Pastikan URL GAS tersedia
if (typeof window.GAS_ADMIN_URL === 'undefined') {
    window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
    console.log("✅ GAS_ADMIN_URL manually set in admin-finance.js");
}

async function initFinanceDashboard(admin) {
    console.log("🎯 initFinanceDashboard called for:", admin?.nama);
    
    const container = document.getElementById("kas-container");
    if (!container) {
        console.error("❌ kas-container not found!");
        return;
    }
    
    container.innerHTML = '<div class="loading-state">📡 Mengetes koneksi ke GAS...</div>';
    
    try {
        const url = window.GAS_ADMIN_URL + "?action=getDashboardData";
        console.log("📡 Fetching:", url);
        
        const res = await fetch(url);
        console.log("📡 Response status:", res.status);
        
        const result = await res.json();
        console.log("📡 Result:", result);
        
        if (result.status === "success") {
            container.innerHTML = `
                <div style="background:#1a1a2c; border:1px solid #22c55e; border-radius:8px; padding:15px;">
                    <h3 style="color:#22c55e;">✅ TEST BERHASIL!</h3>
                    <p><strong>Status:</strong> ${result.status}</p>
                    <p><strong>Members:</strong> ${result.data.members?.length || 0} orang</p>
                    <p><strong>Saldo:</strong> ${JSON.stringify(result.data.saldo)}</p>
                    <p><strong>History:</strong> ${result.data.history?.length || 0} transaksi</p>
                    <hr>
                    <details>
                        <summary>Lihat JSON lengkap</summary>
                        <pre style="color:#fff;font-size:11px;">${JSON.stringify(result.data, null, 2)}</pre>
                    </details>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="empty-state" style="color:#ff8888;">❌ Gagal: ${result.message}</div>`;
        }
    } catch(e) {
        console.error("❌ Fetch error:", e);
        container.innerHTML = `<div class="empty-state" style="color:#ff8888;">❌ Error: ${e.message}</div>`;
    }
}

// Export ke global dengan nama baru
window.initFinanceDashboard = initFinanceDashboard;

console.log("🟢 admin-finance.js ready - window.initFinanceDashboard tersedia");
console.log("🟢 GAS_ADMIN_URL:", window.GAS_ADMIN_URL);
