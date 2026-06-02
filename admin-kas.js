// admin-kas.js - Start from working version
console.log("admin-kas.js loaded");

function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    alert("KAS Dashboard: " + admin?.nama);
}

function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

console.log("admin-kas.js loaded");

function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    alert("KAS Dashboard: " + admin?.nama);
}

window.initKasDashboard = initKasDashboard;

async function loadDashboardData() {
    console.log("loadDashboardData called");
    // Sementara kosong
}

function renderKasUI() {
    console.log("renderKasUI called");
    document.getElementById("kas-container").innerHTML = "<div>Test KAS UI</div>";
}

// TEST: apakah alert masih muncul?

window.initKasDashboard = initKasDashboard;
