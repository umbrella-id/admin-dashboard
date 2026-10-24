// ============================================================
// CRYSTA ICONS - Custom Icon Library .
// ============================================================

// ==================== 1 SVG BASE 16px ====================
function makeCrystaIcon16(glowColor, bodyColor, glowOpacity) {
    var id = Math.random().toString(36).substring(2, 6);
    
    return '<svg class="crysta-svg-icon" viewBox="0 0 16 16" width="16" height="16" style="display:inline-block;vertical-align:middle;flex-shrink:0;">' +
        '<defs>' +
        '  <radialGradient id="g' + id + '" cx="8" cy="8" r="10" gradientTransform="matrix(0.8 0 0 0.8 1.6 1.6)" gradientUnits="userSpaceOnUse">' +
        '    <stop offset="0.5" stop-color="' + glowColor + '" stop-opacity="' + glowOpacity + '"/>' +
        '    <stop offset="1" stop-color="' + glowColor + '" stop-opacity="0"/>' +
        '  </radialGradient>' +
        '</defs>' +
        '<circle fill="url(#g' + id + ')" cx="8" cy="8" r="8"/>' +
        '<path fill="' + bodyColor + '" d="M0,0c0,0,9.735,4.534,12.602,6.486c3.432,2.336,4.236,5.904,2.542,7.712c-2.156,2.301-7.308-0.516-8.737-2.462C4.92,9.712,0,0,0,0z"/>' +
        '<g opacity="0.5">' +
        '  <path fill="#FFFFFF" d="M0.704,0.683c2.423,1.145,9.398,4.486,11.719,6.066c1.839,1.252,3.048,3.009,3.235,4.699c0.109,1.002-0.155,1.901-0.746,2.533c-0.475,0.505-1.147,0.762-2.001,0.762c-2.346,0-5.314-1.923-6.249-3.195C5.461,9.913,1.927,3.07,0.704,0.683 M0,0c0,0,4.92,9.712,6.406,11.736c1.049,1.428,4.102,3.325,6.505,3.325c0.872,0,1.658-0.25,2.232-0.863c1.694-1.808,0.89-5.375-2.542-7.712C9.735,4.534,0,0,0,0L0,0z"/>' +
        '</g>' +
        '<path opacity="0.5" fill="#FFFFFF" d="M7.002,4.355c0,0,3.138,2.303,4.051,3.058c0.914,0.754,0.646,2.005,0.646,2.005s-2.11,0.333-2.847-0.382C8.114,8.321,2.753,2.92,2.753,2.92s5.291,6.679,5.719,7.108c1.271,1.276,3.981,0.433,4.349,0.641c0.841,0.477,1.212,1.479,1.37,1.98c0.344,1.091-0.079,1.329-0.079,1.329s1.164-0.662,0.845-2.595c-0.259-1.567-1.69-3.305-2.95-4.13C10.432,6.222,7.002,4.355,7.002,4.355z"/>' +
        '</svg>';
}

// ==================== 2 WARNA PER TIPE ====================
var COLORS = {
    weapon:   { base: '#b91c1c', glow: '#ef4444' },
    armor:    { base: '#15803d', glow: '#22c55e' },
    additional: { base: '#bfbf00', glow: '#ffff00' },
    special:  { base: '#b324b3', glow: '#ff66ff' },
    normal:   { base: '#1d4ed8', glow: '#3b82f6' }
};

// ==================== 3 FUNGSI ====================

// 🔥 MENU: base 16px
function ciMenu() { 
    return makeCrystaIcon16('currentColor', 'currentColor', '0.3'); 
}

// HEADER: base 16px (tapi diperbesar via scale atau ukuran terpisah)
function ciHeader() { 
    return makeCrystaIcon16('#a855f7', '#a855f7', '0.3'); 
}

// CRYSTA: ukuran bisa diatur (tapi pakai base 16px)
function ciCrysta(type, isBase, size) {
    size = size || 16;
    var c = COLORS[type] || COLORS.normal;
    
    // Pakai base 16px, sesuaikan ukuran via viewBox scale
    var svg = makeCrystaIcon16(
        isBase ? c.base : c.glow,
        isBase ? c.base : '#222222',
        isBase ? '0' : '0.7'
    );
    
    // Ubah ukuran sesuai parameter size
    if (size !== 16) {
        svg = svg.replace('width="16" height="16"', 'width="' + size + '" height="' + size + '"');
    }
    
    return svg;
}

// ==================== 4 SHORTCUT ====================
function ci(name, isBase, size) {
    if (name === 'menu') return ciMenu();
    if (name === 'header') return ciHeader();
    return ciCrysta(name, isBase, size);
}

// ==================== 5 EXPOSE ====================
window.ci = ci;
window.ciMenu = ciMenu;
window.ciHeader = ciHeader;
window.ciCrysta = ciCrysta;
