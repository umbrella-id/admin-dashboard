// admin-kas.js - Start from working version
console.log("admin-kas.js loaded");

function formatDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

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
