// ==========================================
// admin-kas.js - KAS System (Final Version)
// ==========================================

console.log("🟢 admin-kas.js loaded - Final Version");

// Pastikan URL GAS tersedia
if (typeof window.GAS_ADMIN_URL === 'undefined') {
    window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
    console.log("✅ GAS_ADMIN_URL manually set");
}

// Fungsi utama saat tab Kas diklik
async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard DIPANGGIL untuk:", admin?.nama);
    
    const container = document.getElementById("kas-container");
    if (!container) {
        console.error("❌ Element kas-container tidak ditemukan!");
        return;
    }
    
    container.innerHTML = '<div style="padding:20px;text-align:center;">📡 Menghubungi server...</div>';
    
    try {
        const url = window.GAS_ADMIN_URL + "?action=getDashboardData";
        console.log("📡 Fetching:", url);
        
        const response = await fetch(url);
        console.log("📡 Response status:", response.status);
        
        const result = await response.json();
        console.log("📡 Result:", result);
        
        if (result.status === "success") {
            const data = result.data;
            container.innerHTML = `
                <div style="background:#1a1a2c; border:1px solid #22c55e; border-radius:12px; padding:20px;">
                    <h3 style="color:#22c55e; margin:0 0 15px 0;">✅ KAS System Berhasil!</h3>
                    <p><strong>Status:</strong> ${result.status}</p>
                    <p><strong>Member Terdaftar:</strong> ${data.members?.length || 0} orang</p>
                    <p><strong>Saldo Bendahara:</strong></p>
                    <ul>
                        ${Object.entries(data.saldo || {}).map(([nama, nilai]) => `<li><strong>${nama}:</strong> ${nilai.toLocaleString()} Spina</li>`).join('')}
                    </ul>
                    <p><strong>Total Transaksi:</strong> ${data.history?.length || 0} record</p>
                    <hr>
                    <details>
                        <summary>Lihat Detail JSON</summary>
                        <pre style="color:#ccc;font-size:11px;margin-top:10px;">${JSON.stringify(data, null, 2)}</pre>
                    </details>
                </div>
            `;
        } else {
            container.innerHTML = `<div style="background:#1a1a2c; border:1px solid #ff4444; border-radius:12px; padding:20px;color:#ff8888;">
                ❌ Gagal: ${result.message || "Unknown error"}
            </div>`;
        }
    } catch(e) {
        console.error("❌ Fetch error:", e);
        container.innerHTML = `<div style="background:#1a1a2c; border:1px solid #ff4444; border-radius:12px; padding:20px;color:#ff8888;">
            ❌ Error: ${e.message}
        </div>`;
    }
}

// Export ke global
window.initKasDashboard = initKasDashboard;

console.log("🟢 admin-kas.js ready - window.initKasDashboard tersedia");
console.log("🟢 GAS_ADMIN_URL:", window.GAS_ADMIN_URL);
