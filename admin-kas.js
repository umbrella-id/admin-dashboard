function renderKasUI() {
    console.log("🎨 renderKasUI called, kasData:", kasData);
    
    const container = document.getElementById("kas-container");
    if (!container) return;
    
    if (!kasData) {
        container.innerHTML = '<div class="empty-state">KasData null</div>';
        return;
    }
    
    // TEST 1: Hanya tampilkan JSON
    container.innerHTML = `<pre>${JSON.stringify(kasData, null, 2)}</pre>`;
}
