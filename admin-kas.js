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
    
    const res = await fetch(`${window.GAS_ADMIN_URL}?action=getDashboardData`);
    const result = await res.json();
    console.log("Fetch result:", result);
    
    if (result.status === "success") {
        document.getElementById("kas-container").innerHTML = "<pre>" + JSON.stringify(result.data, null, 2) + "</pre>";
        alert("Data loaded! " + result.data.members.length + " members");
    } else {
        document.getElementById("kas-container").innerHTML = "Gagal load data";
    }
}

window.initKasDashboard = initKasDashboard;
