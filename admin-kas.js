console.log("admin-kas.js loaded");

function initKasDashboard(admin) {
    alert("KAS Dashboard: " + admin?.nama);
    document.getElementById("kas-container").innerHTML = "<h2>KAS Berhasil Dipanggil</h2>";
}

window.initKasDashboard = initKasDashboard;
