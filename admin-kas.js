// ==========================================
// admin-kas.js - CLEAN VERSION
// ==========================================

console.log("🚀 admin-kas.js - mulai loading");

let currentMode = "setoran";
let currentAdmin = null;

console.log("✅ Variabel initialized");

// Utility functions
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

console.log("✅ Helper functions loaded");

// Dashboard functions
async function initKasDashboard(admin) {
    console.log("🎯 initKasDashboard dipanggil untuk:", admin?.nama);
    currentAdmin = admin;
    alert("KAS Dashboard Loaded untuk: " + admin?.nama);
    // Sementara tidak load data dulu
}

console.log("✅ initKasDashboard defined");

// Export
window.initKasDashboard = initKasDashboard;

console.log("🚀 admin-kas.js - selesai loading, window.initKasDashboard type:", typeof window.initKasDashboard);
