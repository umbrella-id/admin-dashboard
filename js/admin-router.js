/**
 * admin-router.js — Router & History State Manager
 * 
 * Prinsip:
 * - Satu view = satu state history (seimbang)
 * - Back button Android → kembali ke view sebelumnya
 * - Base view = 'dashboard' → back = konfirmasi keluar
 * - Tombol X (PC) → panggil closeCurrentView() → sama seperti back
 * 
 * Cara pakai:
 *   pushView('mail-detail', { mail }) → render + push history
 *   closeCurrentView() → tutup view manual (X / back button)
 */

// ==========================================
// STATE
// ==========================================
let viewStack = [];
let isHandlingPopstate = false;

// ==========================================
// PUSH VIEW — Buka view baru
// ==========================================
function pushView(viewName, data = {}) {
    viewStack.push({ view: viewName, data });
    
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
// CURRENT VIEW
// ==========================================
function getCurrentView() {
    return viewStack.length > 0 
        ? viewStack[viewStack.length - 1] 
        : { view: 'dashboard', data: {} };
}

// ==========================================
// CLOSE VIEW — Tutup view manual (X / back)
// ==========================================
function closeCurrentView() {
    if (viewStack.length > 0) {
        history.back();
    } else {
        forceCloseAllModals();
    }
}

// ==========================================
// FORCE CLOSE ALL — Darurat
// ==========================================
function forceCloseAllModals() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
    
    const chatWidget = document.getElementById('chat-widget');
    if (chatWidget && chatWidget.classList.contains('show')) {
        chatWidget.classList.remove('show');
        if (typeof stopAllTimers === 'function') stopAllTimers();
    }
    
    viewStack = [];
    console.log('🧹 Force close all modals');
}

// ==========================================
// HIDE MODAL (tanpa history)
// ==========================================
function hideModalOnly() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// POPSTATE — Tangkap back button
// ==========================================
window.addEventListener('popstate', function(event) {
    if (isHandlingPopstate) return;
    isHandlingPopstate = true;
    setTimeout(() => { isHandlingPopstate = false; }, 150);
    
    console.log('🔙 popstate:', event.state);
    
    // Sinkronisasi stack dengan depth di state
    if (event.state && typeof event.state.depth === 'number') {
        while (viewStack.length > event.state.depth) {
            viewStack.pop();
        }
    } else {
        viewStack = [];
    }
    
    // Render view target
    if (event.state && event.state.view) {
        routeToView(event.state.view, event.state.data || {});
    } else {
        // Tidak ada state → base dashboard
        handleBackFromBase();
    }
});

// ==========================================
// ROUTE TO VIEW
// ==========================================
function routeToView(viewName, data) {
    console.log(`🎯 routeToView: ${viewName}`);
    
    // Tutup modal by default
    hideModalOnly();
    
    // Kecuali kalau view target = chat, jangan tutup chat widget
    const keepChatOpen = (viewName === 'chat' || viewName.startsWith('chat-'));
    const chatWidget = document.getElementById('chat-widget');
    
    if (!keepChatOpen && chatWidget && chatWidget.classList.contains('show')) {
        chatWidget.classList.remove('show');
        if (typeof stopAllTimers === 'function') stopAllTimers();
        if (typeof window.sendPresence === 'function') window.sendPresence('standby');
    }
    
    // Render sesuai view
    switch (viewName) {
        case 'dashboard':
            // Base, tidak perlu render
            break;
        
        case 'chat':
            // Chat dibuka oleh toggleChatWidget, state hanya penanda
            break;
        
        case 'mail-list':
            if (typeof renderMailbox === 'function' && typeof currentMailList !== 'undefined') {
                renderMailbox(currentMailList);
            }
            break;
        
        case 'mail-detail':
            if (data.mail && typeof renderMailDetailInternal === 'function') {
                renderMailDetailInternal(data.mail);
            }
            break;
        
        case 'mail-reply':
            if (data.mail && typeof renderMailReplyInternal === 'function') {
                renderMailReplyInternal(data.mail);
            }
            break;
        
        case 'mail-history':
            if (data.uid && typeof renderMailHistoryInternal === 'function') {
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
            // Modal notif sudah ditutup, tidak render ulang
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
        
        case 'admin-edit-name':
            if (data.adminId && typeof renderAdminEditNameInternal === 'function') {
                renderAdminEditNameInternal(data.adminId, data.currentName);
            }
            break;
        
        case 'admin-edit-role':
            if (data.adminId && typeof renderAdminEditRoleInternal === 'function') {
                renderAdminEditRoleInternal(data.adminId, data.role1, data.role2);
            }
            break;
        
        case 'admin-promote':
            if (data.targetId && typeof renderPromoteLeaderInternal === 'function') {
                renderPromoteLeaderInternal(data.targetId);
            }
            break;
        case 'verif-code':
            if (data && typeof renderVerifCodeModal === 'function') {
                renderVerifCodeModal(data);
            }
            break;
        
        case 'confirm':
            // Confirm modal sudah ditutup, tidak render ulang
            // (karena confirm = keputusan sudah diambil saat back)
            break;
        
        default:
            console.warn(`⚠️ Unknown view: ${viewName}`);
    }
}

// ==========================================
// BACK FROM BASE
// ==========================================
function handleBackFromBase() {
    console.log('🏠 Back dari base dashboard');
    
    // Push state lagi biar tetap di dashboard
    history.pushState({ view: 'dashboard', depth: 0 }, "");
    
    // Konfirmasi keluar
    if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal(
            'Keluar dari panel admin?',
            () => { 
                if (typeof window.logout === 'function') window.logout(); 
            },
            () => { 
                // Batal — tetap di dashboard
                console.log('↩️ Batal keluar');
            }
        );
    }
}

// ==========================================
// SETUP BASE STATE — Setelah login
// ==========================================
function setupBaseState() {
    viewStack = [];
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
window.hideModalOnly = hideModalOnly;

console.log('✅ admin-router.js loaded');
