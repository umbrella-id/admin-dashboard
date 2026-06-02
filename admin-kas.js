// admin-kas.js - Clean version
console.log("admin-kas.js loaded");

// Helper functions
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

// KAS Functions
async function loadDashboardData() {
    console.log("loadDashboardData called");
    // Sementara kosong, nanti diisi
}

function renderKasUI() {
    console.log("renderKasUI called");
    const container = document.getElementById("kas-container");
    if (container) {
        container.innerHTML = "<div>Test KAS UI</div>";
    }
}

// MAIN - hanya SATU deklarasi
function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    alert("KAS Dashboard: " + admin?.nama);
    console.log("Test formatDate:", formatDate(new Date()));
    console.log("Test escapeHtml:", escapeHtml("<test>"));
    showToast("Test toast from KAS");
    loadDashboardData();
    renderKasUI();
}

// Export
window.initKasDashboard = initKasDashboard;
