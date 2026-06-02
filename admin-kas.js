// ==========================================
// admin-kas.js - KAS SYSTEM (STANDALONE)
// ==========================================

// DEFINISI URL GAS (TIDAK BERGANTUNG PADA admin.js)
window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
window.GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbwqsSUeVxPg4V5hMc9ph92eMQ2cFqTQI7SJZOG9f-FDlPii4IaXGEfOZ7zdRG35zbIhnw/exec";

console.log("✅ URLs defined:", window.GAS_ADMIN_URL);

console.log("admin-kas.js loaded");

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

let currentAdmin = null;

async function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    currentAdmin = admin;
    alert("Loading data...");
    
    try {
        const url = window.GAS_ADMIN_URL + "?action=getDashboardData";
        console.log("Fetching:", url);
        
        const res = await fetch(url);
        console.log("Response status:", res.status);
        
        const result = await res.json();
        console.log("Fetch result:", result);
        
        if (result.status === "success") {
            document.getElementById("kas-container").innerHTML = "<pre>" + JSON.stringify(result.data, null, 2) + "</pre>";
            alert("Data loaded! " + result.data.members.length + " members");
        } else {
            document.getElementById("kas-container").innerHTML = "Gagal load data: " + result.message;
        }
    } catch(e) {
        console.error("Fetch error:", e);
        document.getElementById("kas-container").innerHTML = "Error: " + e.message;
        alert("Error: " + e.message);
    }
}

window.initKasDashboard = initKasDashboard;

console.log("admin-kas.js ready");
