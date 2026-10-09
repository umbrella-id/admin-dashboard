window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
window.GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbwqsSUeVxPg4V5hMc9ph92eMQ2cFqTQI7SJZOG9f-FDlPii4IaXGEfOZ7zdRG35zbIhnw/exec";

let isLoggingOut = false;
let currentAdmin = null;
let standbyInterval = null;
let isWindowFocused = true;
let notificationEnabled = localStorage.getItem('umbrella_notif_enabled') !== 'false';
let toastTimeout = null;

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

// ==========================================
// CLOSE MODAL — Pakai router
// ==========================================
function closeModal() {
    // Konsisten dengan back button: pakai closeCurrentView
    if (typeof closeCurrentView === 'function') {
        closeCurrentView();
    } else {
        // Fallback kalau router belum load
        document.getElementById('modal-overlay').style.display = 'none';
    }
}

// ==========================================
// CONFIRM MODAL — Dengan pushView
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
    
    // Push view confirm
    if (typeof pushView === 'function') {
        pushView('confirm');
    }
    
    document.getElementById('confirm-yes').onclick = () => {
        // Pop view confirm dulu
        if (typeof closeCurrentView === 'function') {
            closeCurrentView();
        } else {
            modal.style.display = 'none';
        }
        // Callback setelah pop selesai
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
// STANDBY — Cek chat & mail tiap 60s
// ==========================================
async function sendStandbyAndUpdateAll() {
    if (!currentAdmin) return;
    
    console.log("🟡 [STANDBY] Mulai pengecekan...");
    
    await window.sendPresence('standby');
    
    if (!notificationEnabled) {
        console.log("🔕 Notifikasi dimatikan, skip pengecekan");
        return;
    }
    
    // CEK CHAT LOG
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        const logs = data.logs || [];
        
        const guestMessages = logs.filter(msg => {
            if (msg.type === 'command') return false;
            if (msg.uid === currentAdmin.id) return false;
            return true;
        });
        
        let lastTimestamp = 0;
        let newestMessage = null;
        
        for (const msg of guestMessages) {
            let msgTime = typeof msg.timestamp === 'number' 
                ? msg.timestamp 
                : new Date(msg.timestamp).getTime();
            if (msgTime > lastTimestamp) {
                lastTimestamp = msgTime;
                newestMessage = msg;
            }
        }
        
        const savedTimestamp = parseInt(localStorage.getItem('umbrella_last_chat_timestamp') || '0');
        
        if (lastTimestamp > savedTimestamp) {
            localStorage.setItem('umbrella_last_chat_timestamp', lastTimestamp.toString());
        }
        
        if (lastTimestamp > savedTimestamp && savedTimestamp > 0 && newestMessage) {
            const sender = newestMessage?.username || 'Guest';
            const message = newestMessage?.message || '';
            const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
            
            const isChatActive = window.isChatOpen && window.isChatOpen();
            
            if (!isWindowFocused) {
                showBrowserNotification(`💬 Pesan dari ${sender}`, preview, 'chat');
                playNotificationSound();
            } else if (!isChatActive) {
                showToast(`💬 Pesan baru dari ${sender}: ${preview}`);
            }
        }
    } catch(e) { 
        console.error("❌ Check chat error:", e); 
    }
    
    // CEK MAILBOX
    try {
        if (typeof window.checkMailboxChanges === 'function') {
            const hasChanged = await window.checkMailboxChanges();
            
            if (hasChanged) {
                const cached = sessionStorage.getItem('umbrella_cached_mailbox');
                if (cached) {
                    const dataMail = JSON.parse(cached);
                    const savedMailTimestamp = parseInt(localStorage.getItem('umbrella_last_mail_timestamp') || '0');
                    const lastMailTimestamp = dataMail[0]?.timestamp ? new Date(dataMail[0].timestamp).getTime() : 0;
                    const isMailTabActive = document.querySelector('.nav-item.active')?.dataset.nav === 'mailbox';
                    
                    if (lastMailTimestamp > savedMailTimestamp && savedMailTimestamp > 0) {
                        const newestMail = dataMail[0];
                        const sender = newestMail?.ign || 'Guest';
                        const subject = newestMail?.category || 'Umum';
                        const message = newestMail?.message || '';
                        const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
                        
                        if (!isWindowFocused) {
                            showBrowserNotification(`📬 Surat dari ${sender} [${subject}]`, preview, 'mail');
                            playNotificationSound();
                            localStorage.setItem('umbrella_last_mail_timestamp', lastMailTimestamp.toString());
                        } else if (!isMailTabActive) {
                            showToast(`📬 Surat baru dari ${sender}: ${preview}`);
                            localStorage.setItem('umbrella_last_mail_timestamp', lastMailTimestamp.toString());
                        } else {
                            localStorage.setItem('umbrella_last_mail_timestamp', lastMailTimestamp.toString());
                        }
                    }
                }
            }
        }
    } catch(e) { 
        console.error("❌ Check mailbox error:", e); 
    }
    
    console.log("🟡 [STANDBY] Selesai pengecekan\n");
}

// ==========================================
// HEARTBEAT CHECK
// ==========================================
function shouldEnableHeartbeat() {
    if (!currentAdmin) return false;
    
    const hasHeartbeat = (currentAdmin.role1 === 'LEADER' || 
                          currentAdmin.role1 === 'CO-LEAD' || 
                          currentAdmin.role2 === 'CO-LEAD');
    
    return hasHeartbeat;
}

// ==========================================
// BLUR — Standby
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
// FOCUS — Refresh
// ==========================================
window.addEventListener('focus', function() {
    if (!currentAdmin) return;
    isWindowFocused = true;
    
    console.log("🟢 Window mendapat fokus");
    validateSessionInBackground(currentAdmin);
    
    const chatIsOpen = window.isChatOpen && window.isChatOpen();
    const activeTab = document.querySelector('.nav-item.active')?.dataset.nav;
    
    // Update presence
    if (chatIsOpen && shouldEnableHeartbeat()) {
        window.sendPresence('active');
    } else if (shouldEnableHeartbeat()) {
        window.sendPresence('standby');
    }
    
    // Refresh tab aktif
    if (activeTab === 'kas') {
        const hasKasAccess = (currentAdmin.role1 === 'LEADER' || 
                              currentAdmin.role1 === 'BENDAHARA' || 
                              currentAdmin.role2 === 'BENDAHARA');
        if (hasKasAccess && typeof window.loadKasDashboard === 'function') {
            window.loadKasDashboard();
        }
    }
    
    if (activeTab === 'mailbox') {
        const hasMailAccess = (currentAdmin.role1 === 'LEADER' || 
                               currentAdmin.role1 === 'CO-LEAD' || 
                               currentAdmin.role2 === 'CO-LEAD');
        if (hasMailAccess && typeof window.renderMailboxFromCache === 'function') {
            window.renderMailboxFromCache();
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
// SETUP DASHBOARD — dipakai login & session
// ==========================================
function setupDashboardAfterLogin() {
    document.getElementById('admin-name-display').innerText = currentAdmin.nama;
    const roleText = currentAdmin.role2 ? `${currentAdmin.role1} + ${currentAdmin.role2}` : currentAdmin.role1;
    document.getElementById('admin-role-display').innerText = roleText;
    
    renderBottomNav();
    
    // Chat widget
    const hasChat = (currentAdmin.role1 === 'LEADER' || 
                     currentAdmin.role1 === 'CO-LEAD' || 
                     currentAdmin.role2 === 'CO-LEAD');
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
    
    const hasKas = (currentAdmin.role1 === 'LEADER' || 
                    currentAdmin.role1 === 'BENDAHARA' || 
                    currentAdmin.role2 === 'BENDAHARA');
    if (hasKas) {
        setTimeout(() => {
            if (typeof window.loadKasDashboard === 'function') window.loadKasDashboard();
        }, 1000);
    }
    
    if (currentAdmin.role1 === 'LEADER' && typeof window.refreshAdminList === 'function') {
        window.refreshAdminList();
    }
    
    if (currentAdmin.role1 === 'LEADER' && typeof window.loadContentData === 'function') {
        window.loadContentData();
    }
    
    // Heartbeat
    if (shouldEnableHeartbeat()) {
        startStandbyPresence();
    } else {
        console.log("🔕 Silent login (BENDAHARA only)");
    }
    
    // Setup router base state
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
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=login&passkey=${encodeURIComponent(passkey)}`);
        const data = await res.json();
        if (data.status === 'success') {
            currentAdmin = data.admin;
            localStorage.setItem('umbrella_admin_session', JSON.stringify({
                admin: currentAdmin,
                adminPasskey: passkey,
                loggedInAt: Date.now()
            }));
            
            // 🎯 Simpan WebUID admin sebagai "member" di web publik
            if (currentAdmin.webUid) {
                localStorage.setItem('u_uid', currentAdmin.webUid);
                localStorage.setItem('u_class', 'member');
                localStorage.setItem('u_ign', currentAdmin.nama);
                console.log('✅ Admin juga member:', currentAdmin.webUid);
            }
            
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
// CHECK SESSION
// ==========================================
async function checkSession() {
    const session = localStorage.getItem('umbrella_admin_session');
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    
    if (!session) {
        loginScreen.style.display = 'flex';
        dashboard.style.display = 'none';
        return;
    }
    
    try {
        const data = JSON.parse(session);
        currentAdmin = data.admin;
        
        loginScreen.style.display = 'none';
        dashboard.style.display = 'flex';
        
        setupDashboardAfterLogin();
        
        validateSessionInBackground(currentAdmin);
        
    } catch(e) {
        console.error("Session error:", e);
        localStorage.removeItem('umbrella_admin_session');
        location.reload();
    }
}

// ==========================================
// VALIDASI SESSION DI BACKGROUND
// ==========================================
async function validateSessionInBackground(admin) {
    try {
        const session = JSON.parse(localStorage.getItem('umbrella_admin_session'));
        const adminPasskey = session.adminPasskey;
        
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=validateSession&adminId=${admin.id}&adminPasskey=${encodeURIComponent(adminPasskey)}`);
        const data = await res.json();
        
        if (!data.valid) {
            console.log("🔴 Session tidak valid, logout otomatis");
            // Ganti alert dengan modal
            window.showConfirmModal(
                '⚠️ Session tidak valid. Silakan login ulang.',
                () => { logout(); }
            );
            return;
        }
        
        if (data.admin && JSON.stringify(data.admin) !== JSON.stringify(currentAdmin)) {
            console.log("🔄 Update data admin terbaru");
            currentAdmin = data.admin;
            
            const oldPasskey = session.adminPasskey;
            
            localStorage.setItem('umbrella_admin_session', JSON.stringify({
                admin: currentAdmin,
                adminName: currentAdmin.nama, 
                adminPasskey: oldPasskey,
                loggedInAt: Date.now()
            }));
            
            // 🎯 Sync WebUID ke localStorage (kalau berubah)
            if (currentAdmin.webUid) {
                localStorage.setItem('u_uid', currentAdmin.webUid);
                localStorage.setItem('u_class', 'member');
                localStorage.setItem('u_ign', currentAdmin.nama);
            }
            
            document.getElementById('admin-name-display').innerText = currentAdmin.nama;
            const roleText = currentAdmin.role2 ? `${currentAdmin.role1} + ${currentAdmin.role2}` : currentAdmin.role1;
            document.getElementById('admin-role-display').innerText = roleText;
            renderBottomNav();
        }
        
        console.log("✅ Session valid");
        
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
    const hasMember = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'CO-LEAD' || currentAdmin.role2 === 'CO-LEAD');
    const hasMail = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'CO-LEAD' || currentAdmin.role2 === 'CO-LEAD');
    const hasKas = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'BENDAHARA' || currentAdmin.role2 === 'BENDAHARA');
    const hasAdmin = (currentAdmin.role1 === 'LEADER');
    const hasContent = (currentAdmin.role1 === 'LEADER');

    if (hasMember) tabs.push({ id: 'member', icon: 'fa-users', label: 'Member' });
    if (hasMail) tabs.push({ id: 'mailbox', icon: 'fa-envelope', label: 'Surat' });
    if (hasKas) tabs.push({ id: 'kas', icon: 'fa-coins', label: 'Kas' });
    if (hasAdmin) tabs.push({ id: 'manage-admin', icon: 'fa-users-cog', label: 'Admin' });
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
            
            if (tabId === 'manage-content' && typeof window.loadContentData === 'function') {
                window.loadContentData();
            }
            if (tabId === 'kas' && typeof window.loadKasDashboard === 'function') {
                window.loadKasDashboard();
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
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=changeMyPasskey&adminId=${currentAdmin.id}&oldPasskey=${encodeURIComponent(oldPasskey)}&newKey=${encodeURIComponent(newPasskey)}`);
        const data = await res.json();
        if (data.status === 'success') { 
            showToast("Passkey berhasil diubah!");
            currentAdmin.passkey = newPasskey;
            localStorage.setItem('umbrella_admin_session', JSON.stringify({ 
                admin: currentAdmin, 
                adminPasskey: newPasskey,
                loggedInAt: Date.now() 
            }));
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
            fetch(`${window.GAS_SYNC_URL}?role=admin&uid=${currentAdmin.id}&mode=offline`);
        } catch(e) {}
    }
    
    // Clear session storage (privacy)
    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('umbrella_')) {
            sessionStorage.removeItem(key);
        }
    });
    
    // 🎯 Hapus session admin SAJA
    localStorage.removeItem('umbrella_admin_session');
    currentAdmin = null;
    
    // 🎯 u_uid, u_class, u_ign TETAP (akun web tidak logout)
    
    if (typeof forceCloseAllModals === 'function') {
        forceCloseAllModals();
    }
    
    location.reload();
}

// ==========================================
// MANAGE ADMIN (LEADER ONLY)
// ==========================================
async function refreshAdminList() {
    if (currentAdmin?.role1 !== 'LEADER') {
        return;
    }
    try {
        const url = `${window.GAS_ADMIN_URL}?action=getAdminList&adminId=${currentAdmin.id}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success' && data.data) {
            renderAdminList(data.data);
        } else {
            document.getElementById('admin-list-container').innerHTML = '<div class="empty-state">Gagal memuat data admin</div>';
        }
    } catch(e) {
        console.error("Refresh admin list error:", e);
        document.getElementById('admin-list-container').innerHTML = '<div class="empty-state">Gagal koneksi</div>';
    }
}

function renderAdminList(admins) {
    const container = document.getElementById('admin-list-container');
    if (!container) return;
    
    container.innerHTML = admins.map(admin => `
        <div class="admin-row">
            <div class="admin-info-row">
                <div>
                    <strong>${escapeHtml(admin.nama)}</strong><br>
                    <span style="font-size:0.7rem; color:var(--text-muted);">ID: ${admin.id}</span>
                </div>
                <div style="font-size:0.7rem;">
                    ${admin.role1} ${admin.role2 ? `+ ${admin.role2}` : ''}
                </div>
            </div>
            <div class="admin-buttons">
                <button class="btn-small" onclick="editAdminName('${admin.id}', '${escapeHtml(admin.nama)}')"><i class="fas fa-user-edit"></i> Edit Nama</button>
                <button class="btn-small" onclick="editAdminRole('${admin.id}', '${admin.role1}', '${admin.role2 || ''}')"><i class="fas fa-tag"></i> Edit Role</button>
                <button class="btn-small btn-warning" onclick="resetPasskey('${admin.id}')"><i class="fas fa-key"></i> Reset Passkey</button>
                ${currentAdmin.id !== admin.id ? `<button class="btn-small btn-danger" onclick="promoteToLeader('${admin.id}')"><i class="fas fa-crown"></i> Lantik Leader</button>` : ''}
            </div>
        </div>
    `).join('');
}

// ==========================================
// EDIT ADMIN — PUBLIC + INTERNAL
// ==========================================
function editAdminName(adminId, currentName) {
    renderAdminEditNameInternal(adminId, currentName);
    if (typeof pushView === 'function') pushView('admin-edit-name', { adminId, currentName });
}

function renderAdminEditNameInternal(adminId, currentName) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-user-edit"></i> Edit Nama Admin</h3>
            <input type="text" id="edit-name" value="${currentName}" placeholder="Nama baru" style="width:100%; padding:10px; margin-bottom:15px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
            <div class="modal-buttons">
                <button onclick="saveAdminName('${adminId}')" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function saveAdminName(adminId) {
    const newName = document.getElementById('edit-name').value.trim();
    if (!newName) { showToast("Nama tidak boleh kosong", true); return; }
    try {
        const url = `${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${currentAdmin.id}&targetAdminId=${adminId}&field=nama&value=${encodeURIComponent(newName)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
            showToast("Nama admin berhasil diubah");
            closeModal();
            refreshAdminList();
            if (adminId === currentAdmin.id) currentAdmin.nama = newName;
        } else {
            showToast(data.message || "Gagal", true);
        }
    } catch(e) { showToast("Gagal koneksi", true); }
}

function editAdminRole(adminId, role1, role2) {
    renderAdminEditRoleInternal(adminId, role1, role2);
    if (typeof pushView === 'function') pushView('admin-edit-role', { adminId, role1, role2 });
}

function renderAdminEditRoleInternal(adminId, role1, role2) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-tag"></i> Edit Role</h3>
            <select id="edit-role1" style="width:100%; padding:10px; margin-bottom:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <option value="LEADER" ${role1 === 'LEADER' ? 'selected' : ''} ${adminId === currentAdmin.id ? 'disabled' : ''}>LEADER</option>
                <option value="CO-LEAD" ${role1 === 'CO-LEAD' ? 'selected' : ''}>CO-LEAD</option>
                <option value="BENDAHARA" ${role1 === 'BENDAHARA' ? 'selected' : ''}>BENDAHARA</option>
                <option value="">(Kosong)</option>
            </select>
            <select id="edit-role2" style="width:100%; padding:10px; margin-bottom:15px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <option value="">(Tidak ada)</option>
                <option value="CO-LEAD" ${role2 === 'CO-LEAD' ? 'selected' : ''}>CO-LEAD</option>
                <option value="BENDAHARA" ${role2 === 'BENDAHARA' ? 'selected' : ''}>BENDAHARA</option>
            </select>
            <div class="modal-buttons">
                <button onclick="saveAdminRole('${adminId}')" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function saveAdminRole(adminId) {
    const role1 = document.getElementById('edit-role1').value;
    const role2 = document.getElementById('edit-role2').value;
    try {
        if (role1) {
            await fetch(`${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${currentAdmin.id}&targetAdminId=${adminId}&field=role1&value=${role1}`);
        }
        await fetch(`${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${currentAdmin.id}&targetAdminId=${adminId}&field=role2&value=${role2}`);
        showToast("Role berhasil diubah");
        closeModal();
        refreshAdminList();
    } catch(e) { showToast("Gagal", true); }
}

function resetPasskey(adminId) {
  // Buka modal input passkey baru
  renderResetPasskeyModal(adminId);
  if (typeof pushView === 'function') {
    pushView('admin-reset-passkey', { adminId });
  }
}

function renderResetPasskeyModal(adminId) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <button class="modal-close-x" onclick="window.closeModal()">✕</button>
      <h3 style="text-align:center; margin-bottom:20px;"><i class="fas fa-key"></i> Reset Passkey</h3>
      
      <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:16px;">
        Masukkan passkey baru untuk admin <strong>${escapeHtml(adminId)}</strong>.
        Passkey akan ditampilkan setelah reset — catat & kirim ke admin tersebut.
      </p>
      
      <div class="passkey-input-group">
        <label><i class="fas fa-key"></i> Passkey Baru</label>
        <input type="text" id="reset-passkey-new" placeholder="Min 6 char, huruf + angka" autocomplete="off">
        <small style="color:#64748b; font-size:0.65rem;">Minimal 6 karakter, mengandung huruf dan angka</small>
      </div>
      
      <div class="modal-buttons" style="margin-top: 20px;">
        <button onclick="submitResetPasskey('${adminId}')" style="background:var(--color-primary); flex:1;">Reset</button>
        <button onclick="closeModal()" style="background:#333; flex:1;">Batal</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  
  setTimeout(() => {
    const input = document.getElementById('reset-passkey-new');
    if (input) input.focus();
  }, 200);
}

async function submitResetPasskey(adminId) {
  const input = document.getElementById('reset-passkey-new');
  const newKey = input ? input.value.trim() : '';
  
  if (!newKey) {
    showToast("Passkey tidak boleh kosong", true);
    return;
  }
  
  if (newKey.length < 6) {
    showToast("Passkey minimal 6 karakter", true);
    return;
  }
  
  if (!/[A-Za-z]/.test(newKey) || !/\d/.test(newKey)) {
    showToast("Passkey harus mengandung huruf & angka", true);
    return;
  }
  
  const btn = document.querySelector('#modal-overlay .modal-buttons button:first-child');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reset...';
  }
  
  try {
    const url = `${window.GAS_ADMIN_URL}?action=resetPasskey&adminId=${currentAdmin.id}&targetAdminId=${adminId}&newKey=${encodeURIComponent(newKey)}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status === 'success') {
      // Tampilkan passkey baru
      showToast(`✅ Passkey direset: ${data.newPasskey || newKey}`);
      setTimeout(() => {
        renderPasskeyResultModal(adminId, data.newPasskey || newKey);
      }, 300);
    } else {
      showToast(data.message || "Gagal reset", true);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Reset';
      }
    }
  } catch(e) {
    showToast("Gagal koneksi", true);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Reset';
    }
  }
}

function renderPasskeyResultModal(adminId, newPasskey) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <button class="modal-close-x" onclick="window.closeModal()">✕</button>
      <h3 style="text-align:center; margin-bottom:20px;"><i class="fas fa-check-circle" style="color:#4ade80;"></i> Berhasil</h3>
      
      <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px; text-align:center;">
        Passkey baru untuk <strong>${escapeHtml(adminId)}</strong>:
      </p>
      
      <div style="background:var(--bg-dark); border:1px solid var(--color-primary); border-radius:10px; padding:16px; text-align:center; margin-bottom:16px;">
        <code style="font-size:1.1rem; color:var(--color-primary); font-weight:bold; letter-spacing:1px; user-select:all;" id="passkey-result-text">${escapeHtml(newPasskey)}</code>
      </div>
      
      <p style="font-size:0.7rem; color:#ff8888; margin-bottom:16px; text-align:center;">
        ⚠️ Catat & kirim ke admin tersebut. Tidak akan ditampilkan lagi.
      </p>
      
      <div class="modal-buttons">
        <button onclick="copyPasskeyToClipboard('${escapeHtml(newPasskey)}')" style="background:var(--color-primary); flex:1;">
          <i class="fas fa-copy"></i> Copy
        </button>
        <button onclick="closeModal()" style="background:#333; flex:1;">Tutup</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function copyPasskeyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("✅ Passkey dicopy");
  }).catch(() => {
    showToast("❌ Gagal copy", true);
  });
}

// ==========================================
// PROMOTE LEADER
// ==========================================
function promoteToLeader(targetId) {
    renderPromoteLeaderInternal(targetId);
    if (typeof pushView === 'function') pushView('admin-promote', { targetId });
}

function renderPromoteLeaderInternal(targetId) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-crown"></i> Lantik Leader Baru</h3>
            <p style="margin-bottom:10px;">Anda akan turun menjadi CO-LEAD</p>
            <input type="password" id="confirm-passkey" placeholder="Masukkan passkey Anda" style="width:100%; padding:10px; margin-bottom:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
            <div class="modal-buttons">
                <button onclick="executePromoteLeader('${targetId}')" style="background:var(--color-primary);">Lantik</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function executePromoteLeader(targetId) {
    const passkey = document.getElementById('confirm-passkey').value.trim();
    if (!passkey) { showToast("Passkey wajib diisi", true); return; }
    try {
        const url = `${window.GAS_ADMIN_URL}?action=promoteLeader&passkey=${encodeURIComponent(passkey)}&targetId=${targetId}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
            showToast("Leader baru dilantik! Silakan login ulang.");
            localStorage.removeItem('umbrella_admin_session');
            setTimeout(() => logout(), 2000);
        } else {
            showToast(data.message || "Gagal", true);
        }
    } catch(e) { showToast("Gagal koneksi", true); }
}

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
window.toggleNotificationSetting = toggleNotificationSetting;
window.openChangePasskey = openChangePasskey;
window.changeMyPasskey = changeMyPasskey;
window.openSettingsModal = openSettingsModal;
window.refreshAdminList = refreshAdminList;
window.editAdminName = editAdminName;
window.saveAdminName = saveAdminName;
window.editAdminRole = editAdminRole;
window.saveAdminRole = saveAdminRole;
window.resetPasskey = resetPasskey;
window.renderResetPasskeyModal = renderResetPasskeyModal;
window.submitResetPasskey = submitResetPasskey;
window.renderPasskeyResultModal = renderPasskeyResultModal;
window.copyPasskeyToClipboard = copyPasskeyToClipboard;
window.promoteToLeader = promoteToLeader;
window.executePromoteLeader = executePromoteLeader;
window.renderSettingsModalInternal = renderSettingsModalInternal;
window.renderChangePasskeyInternal = renderChangePasskeyInternal;
window.renderAdminEditNameInternal = renderAdminEditNameInternal;
window.renderAdminEditRoleInternal = renderAdminEditRoleInternal;
window.renderPromoteLeaderInternal = renderPromoteLeaderInternal;

checkSession();
console.log("✅ admin.js loaded (V3 — With Router Integration)");
