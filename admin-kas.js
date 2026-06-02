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

function initKasDashboard(admin) {
    alert("KAS Dashboard: " + admin?.nama);
    let test = escapeHtml("<test>");
    document.getElementById("kas-container").innerHTML = "<h2>Test escapeHtml: " + test + "</h2>";
}

window.initKasDashboard = initKasDashboard;
