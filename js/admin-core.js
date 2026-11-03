/**
 * admin-core.js — Core Admin Runtime
 *
 * Fondasi seluruh web admin:
 * - Utility: escapeHtml, sanitizeHtml
 * - UI: showToast, closeModal, showConfirmModal
 * - Auth: doLogin, checkSession, validateSession, logout
 * - Presence: sendPresence, standby heartbeat
 * - Notification: browser notif + sound
 * - Layout: renderBottomNav, setupDashboard
 * - Bootstrap: checkSession() di bottom
 *
 * Load SETELAH admin-router.js, SEBELUM modul lain.
 */

window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
window.GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbwqsSUeVxPg4V5hMc9ph92eMQ2cFqTQI7SJZOG9f-FDlPii4IaXGEfOZ7zdRG35zbIhnw/exec";
window.GAS5_URL = "https://script.google.com/macros/s/AKfycbzTP1-9KuQ2iz4ffTfhujqkSIQqQxXWMXY-BHljCVU_Zzm0Ept8j4AJUCBHqB-ZSZk/exec";

let currentAdmin = null;
let standbyInterval = null;
let isWindowFocused = true;
let notificationEnabled = localStorage.getItem('umbrella_notif_enabled') !== 'false';
let toastTimeout = null;

let lastRefreshAt = 0;
const REFRESH_THROTTLE_MS = 30 * 1000;

// ==========================================
// 🧹 CLEANUP STALE STORAGE
// ==========================================
function cleanupStaleStorage() {
  const staleKeys = [
    // Legacy / deprecated
    'u_last_verify',              // Pindah ke sessionStorage (Internal)
    'u_class',                    // Legacy
    'u_ign_changed_at',           // Legacy
    'umbrella_member_session',    // Digantikan umbrella_session_token
    'umbrella_last_chat_stamp',   // Digantikan server state
    'umbrella_last_chat_timestamp', // Digantikan server state (chat read)
    'umbrella_last_mail_timestamp', // Akan digantikan server state (0.2b)
    'umbrella_chat_last_notified' // Pindah ke sessionStorage (0.2c)
  ];
  
  let cleaned = 0;
  staleKeys.forEach(k => {
    if (localStorage.getItem(k) !== null) {
      localStorage.removeItem(k);
      cleaned++;
      console.log('🧹 Cleanup stale:', k);
    }
  });
  
  if (cleaned > 0) {
    console.log(`✅ Total ${cleaned} stale key dibersihkan`);
  }
}

// ==========================================
// UTILITY
// ==========================================
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
    
    toast.innerText = msg;
    toast.style.borderColor = isError ? '#ff4444' : 'var(--color-primary)';
    toast.classList.add('show');
    
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeout = null;
    }, 3000);
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    if (typeof str !== 'string') str = String(str);
    if (!str) return '';
    
    return str.replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#39;';
        return m;
    });
}

function escapeJs(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

function sanitizeHtml(html) {
    if (!html) return '';
    
    let cleaned = String(html);
    
    // 1. Hapus elemen berbahaya (script, iframe, embed, object, form)
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    cleaned = cleaned.replace(/<embed\b[^>]*>/gi, '');
    cleaned = cleaned.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    cleaned = cleaned.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
    
    // 2. Hapus event handler (onclick=, onerror=, onload=, ...)
    cleaned = cleaned.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    cleaned = cleaned.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
    cleaned = cleaned.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
    
    // 3. Netralkan javascript: URL di href/src
    cleaned = cleaned.replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1=$2#$2');
    
    // 4. Hapus <style> dan <link> yang bisa inject CSS global
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    cleaned = cleaned.replace(/<link\b[^>]*>/gi, '');
    
    return cleaned;
}

// ==========================================
// TAMPILAN ROLE — Format gabungan role1 + role2 (uppercase)
// ==========================================
function formatRoleDisplay(admin) {
    if (!admin) return '-';
    const parts = [];
    if (admin.role1) parts.push(admin.role1.toUpperCase());
    if (admin.role2) parts.push(admin.role2.toUpperCase());
    return parts.join(' + ') || '(no role)';
}

// ==========================================
// CLOSE MODAL
// ==========================================
function closeModal() {
    if (typeof closeCurrentView === 'function') {
        closeCurrentView();
    } else {
        document.getElementById('modal-overlay').style.display = 'none';
    }
}

// ==========================================
// CONFIRM MODAL
// ==========================================
window.showConfirmModal = function(pesan, onConfirm, onCancel) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 300px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-question-circle"></i> Konfirmasi</h3>
            <p style="margin-bottom:20px;">${pesan}</p>
            <div class="modal-buttons">
                <button id="confirm-yes" style="background:var(--color-primary);">Ya</button>
                <button id="confirm-no" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    if (typeof pushView === 'function') {
        pushView('confirm');
    }
    
    document.getElementById('confirm-yes').onclick = () => {
        if (typeof closeCurrentView === 'function') {
            closeCurrentView();
        } else {
            modal.style.display = 'none';
        }
        setTimeout(() => { if (onConfirm) onConfirm(); }, 150);
    };
    document.getElementById('confirm-no').onclick = () => {
        if (typeof closeCurrentView === 'function') {
            closeCurrentView();
        } else {
            modal.style.display = 'none';
        }
        setTimeout(() => { if (onCancel) onCancel(); }, 150);
    };
};

// ==========================================
// NOTIFICATION
// ==========================================
function isNotificationEnabled() { return notificationEnabled; }
function saveNotificationPreference(enabled) { notificationEnabled = enabled; localStorage.setItem('umbrella_notif_enabled', enabled); }

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.3;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
        setTimeout(() => audioContext.close(), 600);
    } catch(e) {}
}

function showBrowserNotification(title, body, type = '') {
    if (!notificationEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (isWindowFocused) return;
    
    console.log(`🔔 Menampilkan notifikasi: ${title} (type: ${type})`);
    
    const notification = new Notification(title, { body: body, icon: '/favicon.ico' });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
        
        if (type === 'chat') {
            const widget = document.getElementById('chat-widget');
            if (widget && !widget.classList.contains('show')) {
                if (typeof window.toggleChatWidget === 'function') {
                    window.toggleChatWidget();
                }
            }
        } else if (type === 'mail') {
            const mailboxTab = document.querySelector('.nav-item[data-nav="mailbox"]');
            if (mailboxTab) {
                mailboxTab.click();
            }
        }
    };
}

// ==========================================
// PRESENCE
// ==========================================
window.sendPresence = async function(mode) {
    if (!currentAdmin) return;
    try {
        await fetch(`${window.GAS_SYNC_URL}?role=admin&uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}&mode=${mode}`);
    } catch(e) {
        console.warn('Presence error:', e);
    }
};

// ==========================================
// STANDBY
// ==========================================
async function sendStandbyAndUpdateAll() {
    if (!currentAdmin) return;
    
    console.log("🟡 [STANDBY] Mulai pengecekan...");
    
    await window.sendPresence('standby');
    
    if (!notificationEnabled) {
        console.log("🔕 Notifikasi dimatikan, skip pengecekan");
        return;
    }
    
    // ========== FETCH SEKALI UNTUK CHAT + MAIL ==========
    let syncData = null;
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}`;
        const res = await fetch(url);
        syncData = await res.json();
    } catch(e) {
        console.error("❌ Sync fetch error:", e);
        return;
    }
    
    // ==================== CHAT ====================
    try {
        const logs = syncData.logs || [];
        const lastChatRead = parseInt(syncData.lastChatRead) || 0;
        let localLastNotified = parseInt(sessionStorage.getItem('umbrella_chat_last_notified') || '0');
        
        const guestMessages = logs.filter(msg => msg.type !== 'command' && msg.uid !== currentAdmin.id);
        let lastTimestamp = 0, newestMessage = null;
        
        for (const msg of guestMessages) {
            let msgTime = typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime();
            if (msgTime > lastTimestamp) { lastTimestamp = msgTime; newestMessage = msg; }
        }
        
        if (localLastNotified === 0) {
            const baseline = Math.max(lastChatRead, lastTimestamp);
            if (baseline > 0) {
                localLastNotified = baseline;
                sessionStorage.setItem('umbrella_chat_last_notified', baseline.toString());
                console.log('🔄 Chat baseline adopted:', new Date(baseline).toISOString());
                if (lastChatRead === 0 && lastTimestamp > 0) {
                    fetch(`${window.GAS_SYNC_URL}?action=markChatRead&uid=${encodeURIComponent(currentAdmin.id)}&timestamp=${lastTimestamp}`, { keepalive: true }).catch(()=>{});
                }
            }
        } else if (lastTimestamp > localLastNotified && newestMessage) {
            const sender = newestMessage.username || 'Guest';
            const message = newestMessage.message || '';
            const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
            const isChatActive = window.isChatOpen && window.isChatOpen();
            
            if (!isWindowFocused) {
                showBrowserNotification(`💬 Pesan dari ${sender}`, preview, 'chat');
                playNotificationSound();
            } else if (!isChatActive) {
                showToast(`💬 Pesan baru dari ${sender}: ${preview}`);
            }
            
            localLastNotified = lastTimestamp;
            sessionStorage.setItem('umbrella_chat_last_notified', localLastNotified.toString());
        }
        
        if (lastTimestamp > lastChatRead) {
            fetch(`${window.GAS_SYNC_URL}?action=markChatRead&uid=${encodeURIComponent(currentAdmin.id)}&timestamp=${lastTimestamp}`, { keepalive: true }).catch(()=>{});
        }
    } catch(e) {
        console.error("❌ Chat check error:", e);
    }
    
    // ==================== MAIL ====================
    try {
        const lastIncomingMail = parseInt(syncData.lastIncomingMail) || 0;
        const lastMailRead = parseInt(syncData.lastMailRead) || 0;
        let localLastNotified = parseInt(sessionStorage.getItem('umbrella_mail_last_notified') || '0');
        
        if (localLastNotified === 0) {
            const baseline = Math.max(lastMailRead, lastIncomingMail);
            if (baseline > 0) {
                localLastNotified = baseline;
                sessionStorage.setItem('umbrella_mail_last_notified', baseline.toString());
                console.log('🔄 Mail baseline adopted:', new Date(baseline).toISOString());
                if (lastMailRead === 0 && lastIncomingMail > 0) {
                    fetch(`${window.GAS_SYNC_URL}?action=markMailRead&uid=${encodeURIComponent(currentAdmin.id)}&timestamp=${lastIncomingMail}`, { keepalive: true }).catch(()=>{});
                }
            }
        } else if (lastIncomingMail > localLastNotified) {
            // Extract preview dari cache
            let sender = 'Guest', subject = 'Umum', preview = 'Ada surat baru masuk';
            const cached = sessionStorage.getItem('umbrella_mail_all');
            if (cached) {
                try {
                    const mails = JSON.parse(cached);
                    const newest = mails.find(m => !m.isFromAdmin && new Date(m.timestamp).getTime() === lastIncomingMail);
                    if (newest) {
                        sender = newest.ign || 'Guest';
                        subject = newest.category || 'Umum';
                        const msg = newest.message || '';
                        preview = msg.length > 50 ? msg.substring(0, 50) + '...' : msg;
                    }
                } catch(e) {}
            }
            
            const isMailTabActive = document.querySelector('.nav-item.active')?.dataset.nav === 'mailbox';
            
            if (!isWindowFocused) {
                showBrowserNotification(`📬 Surat dari ${sender} [${subject}]`, preview, 'mail');
                playNotificationSound();
            } else if (!isMailTabActive) {
                showToast(`📬 Surat baru dari ${sender}: ${preview}`);
            }
            
            localLastNotified = lastIncomingMail;
            sessionStorage.setItem('umbrella_mail_last_notified', localLastNotified.toString());
            
            // Auto-refresh mailbox kalau tab aktif
            if (isMailTabActive && typeof window.refreshMailbox === 'function') {
                window.refreshMailbox();
            }
        }
        
        if (lastIncomingMail > lastMailRead) {
            fetch(`${window.GAS_SYNC_URL}?action=markMailRead&uid=${encodeURIComponent(currentAdmin.id)}&timestamp=${lastIncomingMail}`, { keepalive: true }).catch(()=>{});
        }
    } catch(e) {
        console.error("❌ Mail check error:", e);
    }
    
    console.log("🟡 [STANDBY] Selesai pengecekan\n");
}

// ==========================================
// HEARTBEAT CHECK
// ==========================================
function shouldEnableHeartbeat() {
    if (!currentAdmin) return false;
    return (currentAdmin.role1 === 'leader' || currentAdmin.role1 === 'co-lead');
}

// ==========================================
// BLUR
// ==========================================
window.addEventListener('blur', function() {
    isWindowFocused = false;
    if (!currentAdmin) return;
    
    console.log("🔵 Window kehilangan fokus → standby");
    
    if (shouldEnableHeartbeat()) {
        window.sendPresence('standby');
    }
});

// ==========================================
// FOCUS
// ==========================================
window.addEventListener('focus', function() {
    if (!currentAdmin) return;
    isWindowFocused = true;
    
    console.log("🟢 Window mendapat fokus");
    validateSessionInBackground(currentAdmin);
    
    const chatIsOpen = window.isChatOpen && window.isChatOpen();
    const activeTab = document.querySelector('.nav-item.active')?.dataset.nav;
    
    if (chatIsOpen && shouldEnableHeartbeat()) {
        window.sendPresence('active');
    } else if (shouldEnableHeartbeat()) {
        window.sendPresence('standby');
    }
    
    if (activeTab === 'kas') {
        const hasKasAccess = (currentAdmin.role1 === 'leader' || currentAdmin.role2 === 'bendahara');
        if (hasKasAccess && typeof window.loadKasDashboard === 'function') {
            window.loadKasDashboard();
        }
    }
    
    if (activeTab === 'mailbox') {
        const hasMailAccess = (currentAdmin.role1 === 'leader' || currentAdmin.role1 === 'co-lead');
        if (hasMailAccess && typeof window.renderMailboxFromCache === 'function') {
            window.renderMailboxFromCache();
        }
    }
    
    if (activeTab === 'member') {
        const hasMemberAccess = (currentAdmin.role1 === 'leader' || currentAdmin.role1 === 'co-lead');
        if (hasMemberAccess && typeof window.renderMemberList === 'function') {
            // render dari cache (jika ada)
            if (typeof memberList !== 'undefined' && Array.isArray(memberList) && memberList.length > 0) {
                window.renderMemberList(memberList);
            }
        }
    }
    
    if (chatIsOpen && typeof window.renderChatLogsFromCache === 'function') {
        window.renderChatLogsFromCache();
    }
});

// ==========================================
// RENDER CHAT DARI CACHE
// ==========================================
window.renderChatLogsFromCache = function() {
    const cached = sessionStorage.getItem('umbrella_cached_chat_logs');
    if (cached) {
        const container = document.getElementById('admin-chat-logs');
        if (container) {
            try {
                const logs = JSON.parse(cached);
                if (typeof renderChatLogs === 'function') {
                    renderChatLogs(logs, container);
                }
            } catch(e) {
                console.error("Render chat dari cache error:", e);
            }
        }
    }
};

// ==========================================
// STANDBY TIMER
// ==========================================
function startStandbyPresence() {
    if (!shouldEnableHeartbeat()) {
        console.log("🔕 Role ini tidak memerlukan detak (silent login)");
        return;
    }
    
    if (standbyInterval) clearInterval(standbyInterval);
    sendStandbyAndUpdateAll();
    standbyInterval = setInterval(() => {
        if (currentAdmin) {
            sendStandbyAndUpdateAll();
        }
    }, 60000);
}

function stopStandbyPresence() { 
    if(standbyInterval) { clearInterval(standbyInterval); standbyInterval = null; } 
}
window.stopStandbyPresence = stopStandbyPresence;

// ==========================================
// SETUP DASHBOARD
// ==========================================
function setupDashboardAfterLogin() {
    document.getElementById('admin-name-display').innerText = currentAdmin.nama;
    document.getElementById('admin-role-display').innerText = formatRoleDisplay(currentAdmin);
    
    renderBottomNav();
    
    // Chat widget — leader & co-lead
    const hasChat = (currentAdmin.role1 === 'leader' || currentAdmin.role1 === 'co-lead');
    if (hasChat) {
        const floatingChat = document.getElementById('floating-chat');
        if (floatingChat) floatingChat.style.display = 'block';
        
        setTimeout(() => {
            if (typeof window.initChat === 'function') {
                window.initChat(currentAdmin);
                console.log("✅ Chat diinisialisasi");
            } else {
                setTimeout(() => {
                    if (typeof window.initChat === 'function') {
                        window.initChat(currentAdmin);
                    }
                }, 500);
            }
        }, 300);
    }
    
    // Load data awal
    if (hasChat) {
        setTimeout(() => {
            if (typeof window.loadMemberList === 'function') window.loadMemberList();
        }, 500);
        setTimeout(() => {
            if (typeof window.refreshMailbox === 'function') window.refreshMailbox();
        }, 750);
    }
    
    // Kas — leader atau bendahara
    const hasKas = (currentAdmin.role1 === 'leader' || currentAdmin.role2 === 'bendahara');
    if (hasKas) {
        setTimeout(() => {
            if (typeof window.loadKasDashboard === 'function') window.loadKasDashboard();
        }, 1000);
    }
    
    // Konten — leader only (tab load sendiri saat user buka tab)
    // Tidak perlu preload — initContentTab dipanggil saat tab dibuka
    
    // Heartbeat
    if (shouldEnableHeartbeat()) {
        startStandbyPresence();
    } else {
        console.log("🔕 Silent login");
    }
    
    if (typeof setupBaseState === 'function') {
        setupBaseState();
    }
}

// ==========================================
// LOGIN
// ==========================================
async function doLogin() {
    const passkey = document.getElementById('login-passkey').value.trim();
    if (!passkey) { 
        document.getElementById('login-error').innerText = 'Passkey harus diisi!'; 
        return; 
    }
    try {
        const res = await fetch(window.GAS_ADMIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'login',
                passkey: passkey
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            currentAdmin = data.admin;
            
            // 1. Simpan Admin Token (HANYA TOKEN, tanpa data profil)
            localStorage.setItem('umbrella_admin_session', JSON.stringify({
                sessionToken: data.sessionToken,
                expiresAt: data.expiresAt,
                loggedInAt: Date.now()
            }));
            
            // 2. Simpan Identitas Bersama (Format Web Publik)
            if (currentAdmin.webUid) {
                localStorage.setItem('u_uid', currentAdmin.webUid);
                localStorage.setItem('u_ign', currentAdmin.nama);
                
                // 3. Simpan Tiket Publik (agar tidak perlu login di web publik)
                if (data.memberToken) {
                    localStorage.setItem('umbrella_session_token', data.memberToken);
                    console.log('✅ SSO: Tiket Publik tersimpan');
                }
                console.log('✅ Admin juga member:', currentAdmin.webUid);
            }
            
            // Reset throttle supaya refresh pertama langsung jalan
            lastRefreshAt = 0;
            
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            
            if (notificationEnabled && Notification.permission !== 'granted') {
                await Notification.requestPermission();
            }
            
            setupDashboardAfterLogin();
            
        } else {
            document.getElementById('login-error').innerText = data.message || 'Login gagal!';
        }
    } catch(err) { 
        document.getElementById('login-error').innerText = 'Koneksi gagal!'; 
    }
}

// ==========================================
// CHECK SESSION (FASE 1.5 - SSO Ready)
// ==========================================
async function checkSession() {
    const session = localStorage.getItem('umbrella_admin_session');
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    
    // 1. Cek keberadaan session
    if (!session) {
        loginScreen.style.display = 'flex';
        dashboard.style.display = 'none';
        return;
    }
    
    try {
        const data = JSON.parse(session);
        
        // 2. MIGRASI: Sesi lama (tanpa sessionToken) → force relogin
        if (!data.sessionToken) {
            console.log('🔄 Migrasi: sesi lama tanpa token, force relogin');
            localStorage.removeItem('umbrella_admin_session');
            cleanupStaleStorage();
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            return;
        }
        
        // 3. CLIENT-SIDE EXPIRY CHECK (Fail-Fast, hemat request)
        if (data.expiresAt && data.expiresAt < Date.now()) {
            console.log('⏰ Sesi expired (client), force relogin');
            localStorage.removeItem('umbrella_admin_session');
            cleanupStaleStorage();
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            return;
        }
        
        // 4. ANTI FAKE LOGIN: cek u_uid ada di lokal
        const localUid = localStorage.getItem('u_uid');
        if (!localUid) {
            console.log('🔄 u_uid tidak ditemukan, force relogin');
            localStorage.removeItem('umbrella_admin_session');
            cleanupStaleStorage();
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            return;
        }
        
        // 5. AMBIL DATA SEGAR DARI SERVER (karena profil tidak disimpan di lokal)
        // Ini menggantikan 'currentAdmin = data.admin' di versi lama
        try {
            const res = await fetch(window.GAS_ADMIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'refreshSession',
                    sessionToken: data.sessionToken
                })
            });
            const freshData = await res.json();
            
            if (freshData.status !== 'success' || !freshData.admin) {
                console.log('🔒 Sesi tidak valid di server:', freshData.message);
                localStorage.removeItem('umbrella_admin_session');
                loginScreen.style.display = 'flex';
                dashboard.style.display = 'none';
                return;
            }
            
            // Validasi silang: apakah u_uid di lokal cocok dengan webUid admin?
            const serverWebUid = freshData.admin.webUid;
            if (serverWebUid && serverWebUid !== localUid) {
                console.log('⚠️ Mismatch: u_uid lokal tidak cocok dengan admin di server. Force relogin.');
                console.log('  Lokal:', localUid, '| Server:', serverWebUid);
                localStorage.removeItem('umbrella_admin_session');
                localStorage.removeItem('u_uid');
                localStorage.removeItem('u_ign');
                localStorage.removeItem('u_class');
                localStorage.removeItem('umbrella_session_token');
                loginScreen.style.display = 'flex';
                dashboard.style.display = 'none';
                return;
            }
            
            // Set currentAdmin dengan data segar dari server
            currentAdmin = freshData.admin;
            
            // Update expiresAt (sliding session)
            data.expiresAt = freshData.expiresAt;
            localStorage.setItem('umbrella_admin_session', JSON.stringify(data));
            
            // 🎯 SSO: Simpan Member Token baru ke localStorage
            if (freshData.memberToken) {
                localStorage.setItem('umbrella_session_token', freshData.memberToken);
                console.log('✅ SSO: Member token diperbarui saat refresh');
            }
            
            // 🎯 Pastikan u_uid & u_ign sinkron dengan data server
            if (freshData.admin.webUid) {
                localStorage.setItem('u_uid', freshData.admin.webUid);
                localStorage.setItem('u_ign', freshData.admin.nama);
            }
            
            // Reset throttle refresh (karena baru saja refresh)
            lastRefreshAt = Date.now();
            
        } catch(e) {
            console.error("Fetch fresh session error:", e);
            // Fail-safe: kalau server error, jangan render dashboard
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            return;
        }
        
        // 6. RENDER DASHBOARD (sekarang currentAdmin sudah lengkap)
        loginScreen.style.display = 'none';
        dashboard.style.display = 'flex';
        
        setupDashboardAfterLogin();
        
    } catch(e) {
        console.error("Session parse error:", e);
        localStorage.removeItem('umbrella_admin_session');
        location.reload();
    }
}

// ==========================================
// VALIDASI SESSION
// ==========================================
async function validateSessionInBackground(admin) {
    // Throttle: skip kalau baru < 30 detik
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_THROTTLE_MS) {
        return;
    }
    lastRefreshAt = now;
    
    try {
        const session = JSON.parse(localStorage.getItem('umbrella_admin_session') || '{}');
        if (!session.sessionToken) return;
        
        const res = await fetch(window.GAS_ADMIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'refreshSession',
                sessionToken: session.sessionToken
            })
        });
        const data = await res.json();
        
        if (data.status !== 'success') {
            console.log("🔴 Sesi tidak valid:", data.message);
            window.showConfirmModal(
                '⚠️ Sesi berakhir. Silakan login ulang.',
                () => { logout(); }
            );
            return;
        }
        
        // Update expiresAt (sliding session — token diperpanjang 30 hari)
        session.expiresAt = data.expiresAt;
        session.loggedInAt = Date.now();
        
        // Sinkronisasi nama + role dari server
        if (data.admin && JSON.stringify(data.admin) !== JSON.stringify(currentAdmin)) {
            console.log("🔄 Update data admin terbaru (nama/role)");
            currentAdmin = data.admin;
            session.admin = currentAdmin;
            
            if (currentAdmin.webUid) {
                localStorage.setItem('u_uid', currentAdmin.webUid);
                localStorage.setItem('u_class', 'member');
                localStorage.setItem('u_ign', currentAdmin.nama);
            }
            
            document.getElementById('admin-name-display').innerText = currentAdmin.nama;
            document.getElementById('admin-role-display').innerText = formatRoleDisplay(currentAdmin);
            renderBottomNav();
        }
        
        localStorage.setItem('umbrella_admin_session', JSON.stringify(session));
        console.log("✅ Session valid (expiresAt diperpanjang)");
        
    } catch(e) {
        console.error("Background validation error:", e);
    }
}

// ==========================================
// BOTTOM NAVIGATION
// ==========================================
function renderBottomNav() {
    const navContainer = document.getElementById('bottom-nav');
    const swipeArea = document.getElementById('tab-swipe-area');
    const tabs = [];
    
    const hasMember = (currentAdmin.role1 === 'leader' || currentAdmin.role1 === 'co-lead');
    const hasMail = (currentAdmin.role1 === 'leader' || currentAdmin.role1 === 'co-lead');
    const hasKas = (currentAdmin.role1 === 'leader' || currentAdmin.role2 === 'bendahara');
    const hasContent = (currentAdmin.role1 === 'leader');

    if (hasMember) tabs.push({ id: 'member', icon: 'fa-users', label: 'Member' });
    if (hasMail) tabs.push({ id: 'mailbox', icon: 'fa-envelope', label: 'Surat' });
    if (hasKas) tabs.push({ id: 'kas', icon: 'fa-coins', label: 'Kas' });
    if (hasContent) tabs.push({ id: 'manage-content', icon: 'fa-edit', label: 'Konten' });
    
    for (let i = 0; i < swipeArea.children.length; i++) {
        const page = swipeArea.children[i];
        if (!tabs.some(t => t.id === page.dataset.tab)) { page.remove(); i--; }
    }
    
    if (tabs.length <= 1) { navContainer.style.display = 'none'; return; }
    
    navContainer.style.display = 'flex';
    navContainer.innerHTML = tabs.map((tab, idx) => `<button class="nav-item ${idx === 0 ? 'active' : ''}" data-nav="${tab.id}"><i class="fas ${tab.icon}"></i><span>${tab.label}</span></button>`).join('');
    
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.nav;
            const pages = document.getElementById('tab-swipe-area').children;
            for (let p of pages) if (p.dataset.tab === tabId) p.scrollIntoView({ behavior: 'smooth', inline: 'start' });
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (tabId === 'manage-content' && typeof window.initContentTab === 'function') {
                window.initContentTab();
            }
            if (tabId === 'kas' && typeof window.loadKasDashboard === 'function') {
                window.loadKasDashboard();
            }
            if (tabId === 'mailbox' && typeof window.refreshMailbox === 'function') {
                window.refreshMailbox();
            }
            if (tabId === 'member' && typeof window.loadMemberList === 'function') {
                window.loadMemberList();
            }
        });
    });
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const tabId = entry.target.dataset.tab;
                document.querySelectorAll('.nav-item').forEach(btn => {
                    if (btn.dataset.nav === tabId) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
        });
    }, { threshold: 0.5 });
    for (let page of swipeArea.children) observer.observe(page);
}

// ==========================================
// SETTINGS MODAL
// ==========================================
function openSettingsModal() {
    renderSettingsModalInternal();
    if (typeof pushView === 'function') pushView('settings');
}

function renderSettingsModalInternal() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3 style="text-align:center; margin-bottom:20px;"><i class="fas fa-cog"></i> Pengaturan</h3>
            
            <div class="settings-item">
                <div class="settings-label">
                    <i class="fas fa-bell"></i> Notifikasi Browser
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="notif-toggle" ${notificationEnabled ? 'checked' : ''} onchange="toggleNotificationSetting()">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <button onclick="openChangePasskey()" class="settings-btn-action">
                <i class="fas fa-key"></i> Ganti Passkey
            </button>
            
            <button onclick="logoutWithConfirm()" class="settings-btn-logout">
                <i class="fas fa-sign-out-alt"></i> Keluar
            </button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function toggleNotificationSetting() {
    const isChecked = document.getElementById('notif-toggle')?.checked || false;
    if (isChecked && Notification.permission !== 'granted') {
        const granted = await Notification.requestPermission();
        if (granted !== 'granted') { 
            document.getElementById('notif-toggle').checked = false; 
            saveNotificationPreference(false); 
            showToast("Izin ditolak", true); 
            return; 
        }
    }
    saveNotificationPreference(isChecked);
    notificationEnabled = isChecked;
    showToast(isChecked ? "Notifikasi aktif" : "Notifikasi nonaktif");
}

// ==========================================
// CHANGE PASSKEY MODAL
// ==========================================
function openChangePasskey() {
    renderChangePasskeyInternal();
    if (typeof pushView === 'function') pushView('change-passkey');
}

function renderChangePasskeyInternal() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3 style="text-align:center; margin-bottom:20px;"><i class="fas fa-key"></i> Ganti Passkey</h3>
            
            <div class="passkey-input-group">
                <label><i class="fas fa-lock"></i> Passkey Lama</label>
                <input type="password" id="old-passkey" placeholder="Masukkan passkey lama">
            </div>
            
            <div class="passkey-input-group">
                <label><i class="fas fa-key"></i> Passkey Baru</label>
                <input type="password" id="new-passkey" placeholder="Masukan passkey baru">
                <small style="color:#64748b; font-size:0.65rem;">Minimal 6 karakter, mengandung huruf dan angka</small>
            </div>
            
            <div class="passkey-input-group">
                <label><i class="fas fa-check-circle"></i> Konfirmasi</label>
                <input type="password" id="confirm-passkey" placeholder="Ketik ulang passkey baru">
            </div>
            
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="changeMyPasskey()" style="background:var(--color-primary); flex:1;">Ganti Passkey</button>
                <button onclick="closeModal()" style="background:#333; flex:1;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function changeMyPasskey() {
    const oldPasskey = document.getElementById('old-passkey').value.trim();
    const newPasskey = document.getElementById('new-passkey').value.trim();
    const confirmPasskey = document.getElementById('confirm-passkey').value.trim();
    if (!oldPasskey || !newPasskey) { showToast("Isi semua field", true); return; }
    if (newPasskey !== confirmPasskey) { showToast("Passkey baru tidak cocok", true); return; }
    if (newPasskey.length < 6) { showToast("Passkey minimal 6 karakter", true); return; }
    if (/[^a-zA-Z0-9]/.test(newPasskey)) { showToast("Passkey hanya boleh huruf dan angka", true); return; }
    
    const session = JSON.parse(localStorage.getItem('umbrella_admin_session') || '{}');
    if (!session.sessionToken) {
        showToast("Sesi berakhir. Login ulang.", true);
        setTimeout(() => logout(), 1500);
        return;
    }
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=changeMyPasskey` +
            `&sessionToken=${encodeURIComponent(session.sessionToken)}` +
            `&oldPasskey=${encodeURIComponent(oldPasskey)}` +
            `&newKey=${encodeURIComponent(newPasskey)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') { 
            showToast("Passkey berhasil diubah!");
            setTimeout(() => location.reload(), 1500);
        }
        else showToast(data.message || "Gagal", true);
    } catch(e) { showToast("Gagal koneksi", true); }
}

// ==========================================
// LOGOUT
// ==========================================
function logoutWithConfirm() {
    window.showConfirmModal('Yakin ingin keluar dari panel?', () => {
        logout();
    });
}

function logout() {
    if (standbyInterval) clearInterval(standbyInterval);
    if (typeof window.stopActivePresence === 'function') window.stopActivePresence();
    
    if (shouldEnableHeartbeat() && currentAdmin) {
        try {
            fetch(`${window.GAS_SYNC_URL}?role=admin&uid=${currentAdmin.id}&mode=offline`, 
                  { keepalive: true }).catch(() => {});
        } catch(e) {}
    }
    
    // BARU: hapus token di server (fire-and-forget)
    try {
        const session = JSON.parse(localStorage.getItem('umbrella_admin_session') || '{}');
        if (session.sessionToken) {
            fetch(`${window.GAS_ADMIN_URL}?action=logout&sessionToken=${encodeURIComponent(session.sessionToken)}`,
                  { keepalive: true }).catch(() => {});
        }
    } catch(e) {}
    
    // Bersihkan Sesi Publik di Server (jika ada)
    const memberToken = localStorage.getItem('umbrella_session_token');
    if (memberToken) {
        fetch(`${window.GAS5_URL}?action=memberLogout&token=${encodeURIComponent(memberToken)}`, { keepalive: true }).catch(() => {});
    }

    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('umbrella_')) {
            sessionStorage.removeItem(key);
        }
    });
    
    // Bersihkan SEMUA jejak di localStorage
    localStorage.removeItem('umbrella_admin_session');
    localStorage.removeItem('u_uid');
    localStorage.removeItem('u_ign');
    localStorage.removeItem('u_class');
    localStorage.removeItem('umbrella_session_token');
    
    currentAdmin = null;
    
    if (typeof forceCloseAllModals === 'function') {
        forceCloseAllModals();
    }
    
    cleanupStaleStorage();
    location.reload();
}

// ==========================================
// ADMIN FETCH HELPER (BARU)
// Bungkus fetch agar otomatis inject sessionToken
// ==========================================
window.adminFetch = async function(url, options) {
    const session = JSON.parse(localStorage.getItem('umbrella_admin_session') || '{}');
    
    let finalUrl = url;
    let finalOptions = options || {};
    
    if (session.sessionToken) {
        if (!finalOptions.method || finalOptions.method === 'GET') {
            const sep = finalUrl.includes('?') ? '&' : '?';
            finalUrl = finalUrl + sep + 'sessionToken=' + encodeURIComponent(session.sessionToken);
        } else {
            try {
                const body = JSON.parse(finalOptions.body || '{}');
                body.sessionToken = session.sessionToken;
                finalOptions = Object.assign({}, finalOptions, { body: JSON.stringify(body) });
            } catch(e) {}
        }
    }
    
    const res = await fetch(finalUrl, finalOptions);
    
    // Deteksi "Sesi berakhir" — trigger relogin (sekali saja)
    if (!window.__reloginPending) {
        try {
            const cloned = res.clone();
            const data = await cloned.json();
            if (data.status === 'error' && (data.message || '').includes('Sesi berakhir')) {
                window.__reloginPending = true;
                if (typeof showToast === 'function') showToast('Sesi berakhir. Login ulang.', true);
                window.showConfirmModal(
                    '⚠️ Sesi berakhir. Silakan login ulang.',
                    () => { if (typeof logout === 'function') logout(); },
                    () => { window.__reloginPending = false; }
                );
            }
        } catch(e) {}
    }
    
    return res;
};

// ==========================================
// LOGIN DENGAN ENTER
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const passkeyInput = document.getElementById('login-passkey');
    if (passkeyInput) {
        passkeyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                doLogin();
            }
        });
    }
});

// ==========================================
// EXPOSE
// ==========================================
window.doLogin = doLogin;
window.logout = logout;
window.logoutWithConfirm = logoutWithConfirm;
window.closeModal = closeModal;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.escapeJs = escapeJs;
window.sanitizeHtml = sanitizeHtml;
window.formatRoleDisplay = formatRoleDisplay;
window.toggleNotificationSetting = toggleNotificationSetting;
window.openChangePasskey = openChangePasskey;
window.changeMyPasskey = changeMyPasskey;
window.openSettingsModal = openSettingsModal;
window.renderSettingsModalInternal = renderSettingsModalInternal;
window.renderChangePasskeyInternal = renderChangePasskeyInternal;

checkSession();
console.log("✅ admin-core.js loaded");
