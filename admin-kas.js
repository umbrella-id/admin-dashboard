// admin-kas.js - Start from working version
console.log("admin-kas.js loaded");

function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    alert("KAS Dashboard: " + admin?.nama);
}

// TEST: apakah alert masih muncul?

window.initKasDashboard = initKasDashboard;
