// admin-kas.js - Start from working version
console.log("admin-kas.js loaded");

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

function initKasDashboard(admin) {
    console.log("initKasDashboard called", admin);
    alert("KAS Dashboard: " + admin?.nama);
    console.log("Test formatDate:", formatDate(new Date()));
    console.log("Test escapeHtml:", escapeHtml("<test>"));
}

window.initKasDashboard = initKasDashboard;
