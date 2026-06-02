// admin-kas.js - Start from working version
console.log("admin-kas.js loaded");

function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    alert("KAS Dashboard: " + admin?.nama);
}

// TEST: apakah alert masih muncul?

window.initKasDashboard = initKasDashboard;
