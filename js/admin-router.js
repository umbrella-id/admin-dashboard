/**
 * admin-router.js — Router & History State Manager
 * 
 * Tujuan:
 * - Satu view = satu state history
 * - Back button Android → kembali ke view sebelumnya
 * - Base view = 'dashboard' → back = konfirmasi keluar
 * 
 * Cara pakai:
 *   pushView('mail-detail', { mail }) → render view + push history
 *   closeCurrentView() → tutup view manual (tombol X) + history.back()
 */

// ==========================================
// STATE
// ==========================================
let viewStack = [];           // stack view aktif (mirror dari history)
let isHandlingPopstate = false; // guard biar tidak double-handle

// ==========================================
// PUSH VIEW — Buka view baru
// ==========================================
function pushView(viewName, data = {}) {
    // Simpan ke stack
    viewStack.push({ view: viewName, data });
    
    // Push history
    history.pushState({
        view: viewName,
        data: data,
        depth: viewStack.length
    }, "");
    
    console.log(`📌 pushView: ${viewName} (depth: ${viewStack.length})`);
    return viewStack.length;
}

// ==========================================
// POP VIEW — Kembali ke view sebelumnya
// ==========================================
function popView() {
    if (viewStack.length > 0) {
        const popped = viewStack.pop();
        console.log(`⬅️ popView: ${popped.view} (sisa: ${viewStack.length})`);
        return popped;
    }
    return null;
}

// ==========================================
// CURRENT VIEW — View yang sedang aktif
// ==========================================
function getCurrentView() {
    return viewStack.length > 0 
        ? viewStack[viewStack.length - 1] 
        : { view: 'dashboard', data: {} };
}

// ==========================================
// CLOSE VIEW — Tutup view manual (tombol X)
// ==========================================
function closeCurrentView() {
    if (viewStack.length > 0) {
        // Trigger back, akan memicu popstate
        history.back();
    } else {
        // Tidak ada view → tutup semua modal langsung
        forceCloseAllModals();
    }
}

// ==========================================
// FORCE CLOSE ALL — Darurat
// ==========================================
function forceCloseAllModals() {
    document.getElementById('modal-overlay').style.display = 'none';
    const chatWidget = document.getElementById('chat-widget');
    if (chatWidget && chatWidget.classList.contains('show')) {
        chatWidget.classList.remove('show');
        if (typeof stopAllTimers === 'function') stopAllTimers();
    }
    viewStack = [];
}

// ==========================================
// POPSTATE HANDLER — Tangkap back button
// ==========================================
window.addEventListener('popstate', function(event) {
    // Guard: hindari double handle
    if (isHandlingPopstate) return;
    isHandlingPopstate = true;
    
    setTimeout(() => { isHandlingPopstate = false; }, 100);
    
    console.log('🔙 popstate, state:', event.state);
    
    // Prioritas 1: Ada state dari browser
    if (event.state && event.state.view) {
        // Reset stack sampai depth yang cocok
        while (viewStack.length > event.state.depth) {
            viewStack.pop();
        }
        
        // Render view yang diminta
        routeToView(event.state.view, event.state.data || {});
        return;
    }
    
    // Prioritas 2: Tidak ada state (keluar dari history)
    // → User di base dashboard
    handleBackFromBase();
});

// ==========================================
// ROUTE TO VIEW — Render view sesuai nama
// ==========================================
function routeToView(viewName, data) {
    console.log(`🎯 routeToView: ${viewName}`);
    
    // Default: tutup semua modal dulu
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
    
    // Kalau view = chat, jangan tutup chat widget
    const chatWidget = document.getElementById('chat-widget');
    const keepChatOpen = (viewName === 'chat' || viewName.startsWith('chat-'));
    if (!keepChatOpen && chatWidget && chatWidget.classList.contains('show')) {
        chatWidget.classList.remove('show');
        if (typeof stopAllTimers === 'function') stopAllTimers();
        if (typeof window.sendPresence === 'function') window.sendPresence('standby');
    }
    
    // Render view target
    switch (viewName) {
        case 'dashboard':
            // Base — tidak ada aksi, sudah bersih
            break;
        
        case 'chat':
            // Chat dibuka langsung oleh toggleChatWidget
            // Ini cuma base state, tidak perlu render
            break;
        
        case 'mail-list':
            if (typeof renderMailbox === 'function') {
                renderMailbox(currentMailList);
            }
            break;
        
        case 'mail-detail':
            if (data.mail && typeof openMailDetail === 'function') {
                // Panggil internal tanpa push
                renderMailDetailInternal(data.mail);
            }
            break;
        
        case 'mail-reply':
            if (data.mail && typeof renderMailReplyInternal === 'function') {
                renderMailReplyInternal(data.mail);
            }
            break;
        
        case 'mail-history':
            if (data.uid && typeof openHistory === 'function') {
                renderMailHistoryInternal(data.uid);
            }
            break;
        
        case 'member-add':
            if (typeof renderAddMemberInternal === 'function') {
                renderAddMemberInternal();
            }
            break;
        
        case 'member-edit':
            if (data.member && typeof renderEditMemberInternal === 'function') {
                renderEditMemberInternal(data.member);
            }
            break;
        
        case 'kas-notif':
            // Notif kas — modal sudah ditutup, tidak perlu render ulang
            break;
        
        case 'kas-tarif':
            if (typeof renderTarifModalInternal === 'function') {
                renderTarifModalInternal();
            }
            break;
        
        case 'kas-edit':
            if (data.log && typeof renderEditTransactionInternal === 'function') {
                renderEditTransactionInternal(data.log);
            }
            break;
        
        case 'settings':
            if (typeof renderSettingsModalInternal === 'function') {
                renderSettingsModalInternal();
            }
            break;
        
        case 'change-passkey':
            if (typeof renderChangePasskeyInternal === 'function') {
                renderChangePasskeyInternal();
            }
            break;
        
        default:
            console.warn(`⚠️ Unknown view: ${viewName}`);
    }
}

// ==========================================
// HANDLE BACK FROM BASE
// ==========================================
function handleBackFromBase() {
    console.log('🏠 Back dari base dashboard → konfirmasi keluar');
    
    // Push state lagi biar tetap di dashboard
    history.pushState({ view: 'dashboard', depth: 0 }, "");
    
    // Tanya user
    if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal(
            'Keluar dari panel admin?',
            () => { window.logout(); },
            () => { /* batal — tetap di dashboard */ }
        );
    }
}

// ==========================================
// SETUP BASE STATE — Dipanggil setelah login
// ==========================================
function setupBaseState() {
    // Reset stack
    viewStack = [];
    
    // Push base state
    history.pushState({ view: 'dashboard', depth: 0 }, "");
    
    console.log('✅ Base state disiapkan');
}

// ==========================================
// EXPOSE
// ==========================================
window.pushView = pushView;
window.popView = popView;
window.getCurrentView = getCurrentView;
window.closeCurrentView = closeCurrentView;
window.setupBaseState = setupBaseState;
window.forceCloseAllModals = forceCloseAllModals;

console.log('✅ admin-router.js loaded');
