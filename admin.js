window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
window.GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbwqsSUeVxPg4V5hMc9ph92eMQ2cFqTQI7SJZOG9f-FDlPii4IaXGEfOZ7zdRG35zbIhnw/exec";

let currentAdmin = null;
let standbyInterval = null;
let notificationEnabled = localStorage.getItem('umbrella_notif_enabled') !== 'false';

// ==========================================
// UTILITY
// ==========================================
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.borderColor = isError ? '#ff4444' : 'var(--color-primary)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function closeModal() { 
    document.getElementById('modal-overlay').style.display = 'none'; 
}

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
    document.getElementById('confirm-yes').onclick = () => { modal.style.display = 'none'; if(onConfirm) onConfirm(); };
    document.getElementById('confirm-no').onclick = () => { modal.style.display = 'none'; if(onCancel) onCancel(); };
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
    if (!document.hidden) return;
    
    console.log(`🔔 Menampilkan notifikasi: ${title} (type: ${type})`);
    
    const notification = new Notification(title, { body: body, icon: '/favicon.ico' });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
        
        if (type === 'chat') {
            console.log("👉 Klik notifikasi chat, buka chat widget");
            const widget = document.getElementById('chat-widget');
            if (widget && !widget.classList.contains('show')) {
                if (typeof window.toggleChatWidget === 'function') {
                    window.toggleChatWidget();
                }
            }
        } else if (type === 'mail') {
            console.log("👉 Klik notifikasi mail, buka tab mailbox");
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
    await fetch(`${window.GAS_SYNC_URL}?role=admin&uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}&mode=${mode}`);
};

// ==========================================
// STANDBY (60 DETIK) - CEK CHAT & MAIL
// ==========================================
async function sendStandbyAndUpdateAll() {
    if (!currentAdmin) return;
    
    console.log("🟡 [STANDBY] Mulai pengecekan...");
    
    // 1. Kirim presence standby
    await window.sendPresence('standby');
    
    if (!notificationEnabled) {
        console.log("🔕 Notifikasi dimatikan, skip pengecekan");
        return;
    }
    
    // ==========================================
    // 2. CEK CHAT LOG (pesan baru)
    // ==========================================
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}`;
        console.log("📡 Fetch chat dari:", url);
        const res = await fetch(url);
        const data = await res.json();
        
        const logs = data.logs || [];
        console.log(`📥 Dapat ${logs.length} log chat`);
        
        // Filter pesan dari guest (bukan admin, bukan command)
        const guestMessages = logs.filter(msg => {
            if (msg.type === 'command') return false;
            if (msg.uid === currentAdmin.id) return false;
            return true;
        });
        
        console.log(`👥 Pesan guest: ${guestMessages.length}`);
        
        // Ambil timestamp pesan terbaru
        let lastTimestamp = 0;
        if (guestMessages.length > 0 && guestMessages[0].timestamp) {
            lastTimestamp = typeof guestMessages[0].timestamp === 'number' 
                ? guestMessages[0].timestamp 
                : new Date(guestMessages[0].timestamp).getTime();
        }
        
        const savedTimestamp = parseInt(localStorage.getItem('umbrella_last_chat_timestamp') || '0');
        
        console.log(`🔍 CHAT - lastTimestamp: ${lastTimestamp}, savedTimestamp: ${savedTimestamp}`);
        
        // Simpan timestamp terbaru
        if (lastTimestamp > savedTimestamp) {
            console.log(`✅ Simpan timestamp chat baru: ${lastTimestamp}`);
            localStorage.setItem('umbrella_last_chat_timestamp', lastTimestamp.toString());
        }
        
        // Kirim notifikasi jika ada pesan baru
        if (lastTimestamp > savedTimestamp && savedTimestamp > 0) {
            const newMsg = guestMessages[0];
            const sender = newMsg?.username || 'Guest';
            const message = newMsg?.message || '';
            const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
            
            console.log(`🔔 KIRIM NOTIFIKASI CHAT! dari ${sender}: ${preview}`);
            
            if (document.hidden) {
                showBrowserNotification(`💬 Pesan dari ${sender}`, preview, 'chat');
                playNotificationSound();
            } else {
                showToast(`💬 Pesan baru dari ${sender}: ${preview}`);
            }
        } else {
            console.log(`⏭️ Skip notifikasi chat (tidak ada pesan baru)`);
        }
        
    } catch(e) { 
        console.error("❌ Check chat error:", e); 
    }
    
    // ==========================================
    // 3. CEK MAILBOX (surat baru)
    // ==========================================
    try {
        const urlMail = `${window.GAS_ADMIN_URL}?action=fetchMailbox&limit=50`;
        console.log("📡 Fetch mailbox dari:", urlMail);
        const resMail = await fetch(urlMail);
        const dataMail = await resMail.json();
        
        if (dataMail.status === 'success' && dataMail.data) {
            console.log(`📥 Dapat ${dataMail.data.length} surat`);
            
            // Ambil timestamp surat terbaru
            let lastMailTimestamp = 0;
            if (dataMail.data.length > 0 && dataMail.data[0].timestamp) {
                lastMailTimestamp = new Date(dataMail.data[0].timestamp).getTime();
            }
            
            const savedMailTimestamp = parseInt(localStorage.getItem('umbrella_last_mail_timestamp') || '0');
            
            console.log(`🔍 MAIL - lastTimestamp: ${lastMailTimestamp}, savedTimestamp: ${savedMailTimestamp}`);
            
            // Simpan timestamp terbaru
            if (lastMailTimestamp > savedMailTimestamp) {
                console.log(`✅ Simpan timestamp mail baru: ${lastMailTimestamp}`);
                localStorage.setItem('umbrella_last_mail_timestamp', lastMailTimestamp.toString());
            }
            
            // Kirim notifikasi jika ada surat baru
            if (lastMailTimestamp > savedMailTimestamp && savedMailTimestamp > 0) {
                const newestMail = dataMail.data[0];
                const sender = newestMail?.ign || 'Guest';
                const subject = newestMail?.category || 'Umum';
                const message = newestMail?.message || '';
                const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
                
                console.log(`🔔 KIRIM NOTIFIKASI MAIL! dari ${sender} [${subject}]: ${preview}`);
                
                if (document.hidden) {
                    showBrowserNotification(`📬 Surat dari ${sender} [${subject}]`, preview, 'mail');
                    playNotificationSound();
                } else {
                    showToast(`📬 Surat baru dari ${sender}: ${preview}`);
                }
            } else {
                console.log(`⏭️ Skip notifikasi mail (tidak ada surat baru)`);
            }
            
            // Refresh UI mailbox (tetap dilakukan)
            if (typeof window.renderMailboxData === 'function') {
                window.renderMailboxData(dataMail.data);
            }
        } else {
            console.log("⚠️ Mailbox response error:", dataMail);
        }
        
    } catch(e) { 
        console.error("❌ Check mailbox error:", e); 
    }
    
    console.log("🟡 [STANDBY] Selesai pengecekan\n");
}
// ==========================================
// ANDROID BACK BUTTON
// ==========================================
window.addEventListener('popstate', function(event) {
    const modal = document.getElementById('modal-overlay');
    const chatWidget = document.getElementById('chat-widget');
    if (modal && modal.style.display === 'flex') {
        closeModal();
        event.preventDefault();
    } else if (chatWidget && chatWidget.classList.contains('show')) {
        window.toggleChatWidget();
        event.preventDefault();
    }
});

// ==========================================
// TAB AKTIF KEMBALI
// ==========================================
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && currentAdmin) {
        if (typeof window.refreshMailbox === 'function') window.refreshMailbox();
        if (window.isChatOpen && window.isChatOpen()) {
            if (typeof window.loadChatMessages === 'function') window.loadChatMessages();
            if (typeof window.fetchOnlineUsers === 'function') window.fetchOnlineUsers();
        }
    }
});

// ==========================================
// STANDBY TIMER
// ==========================================
function startStandbyPresence() {
    if (standbyInterval) clearInterval(standbyInterval);
    sendStandbyAndUpdateAll();
    standbyInterval = setInterval(() => {
        if (currentAdmin && (!window.isChatOpen || !window.isChatOpen())) {
            sendStandbyAndUpdateAll();
        }
    }, 60000);
}

function stopStandbyPresence() { 
    if(standbyInterval) { clearInterval(standbyInterval); standbyInterval = null; } 
}
window.stopStandbyPresence = stopStandbyPresence;

// ==========================================
// LOGIN (DENGAN SESSION)
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
                loggedInAt: Date.now()
            }));
            
            document.getElementById('admin-name-display').innerText = currentAdmin.nama;
            const roleText = currentAdmin.role2 ? `${currentAdmin.role1} + ${currentAdmin.role2}` : currentAdmin.role1;
            document.getElementById('admin-role-display').innerText = roleText;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            
            if (notificationEnabled && Notification.permission !== 'granted') {
                await Notification.requestPermission();
            }
            
            const hasChat = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'CO-LEAD' || currentAdmin.role2 === 'CO-LEAD');
            if (hasChat) {
                document.getElementById('floating-chat').style.display = 'block';
                setTimeout(() => { if(typeof window.initChat === 'function') window.initChat(currentAdmin); }, 500);
            }
            
            renderBottomNav();
            if (typeof window.refreshMailbox === 'function') window.refreshMailbox();
            if (currentAdmin.role1 === 'LEADER' && typeof window.refreshAdminList === 'function') window.refreshAdminList();
            startStandbyPresence();
            history.pushState({ dashboard: true }, "");
        } else {
            document.getElementById('login-error').innerText = data.message || 'Login gagal!';
        }
    } catch(err) { 
        document.getElementById('login-error').innerText = 'Koneksi gagal!'; 
    }
}

function checkSession() {
    const session = localStorage.getItem('umbrella_admin_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            currentAdmin = data.admin;
            document.getElementById('admin-name-display').innerText = currentAdmin.nama;
            const roleText = currentAdmin.role2 ? `${currentAdmin.role1} + ${currentAdmin.role2}` : currentAdmin.role1;
            document.getElementById('admin-role-display').innerText = roleText;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            
            if (notificationEnabled && Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
            
            const hasChat = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'CO-LEAD' || currentAdmin.role2 === 'CO-LEAD');
            if (hasChat) {
                document.getElementById('floating-chat').style.display = 'block';
                setTimeout(() => { if(typeof window.initChat === 'function') window.initChat(currentAdmin); }, 500);
            }
            
            renderBottomNav();
            
            // ✅ TAMBAHKAN JEDA 500ms SEBELUM REFRESH MAILBOX
            setTimeout(() => {
                if (typeof window.refreshMailbox === 'function') window.refreshMailbox();
            }, 500);
            
            if (currentAdmin.role1 === 'LEADER' && typeof window.refreshAdminList === 'function') window.refreshAdminList();
            startStandbyPresence();
            history.pushState({ dashboard: true }, "");
        } catch(e) {
            localStorage.removeItem('umbrella_admin_session');
        }
    }
}

// ==========================================
// BOTTOM NAVIGATION
// ==========================================
function renderBottomNav() {
    const navContainer = document.getElementById('bottom-nav');
    const swipeArea = document.getElementById('tab-swipe-area');
    const tabs = [];
    const hasMail = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'CO-LEAD' || currentAdmin.role2 === 'CO-LEAD');
    const hasKas = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'BENDAHARA' || currentAdmin.role2 === 'BENDAHARA');
    const hasAdmin = (currentAdmin.role1 === 'LEADER');
    
    if (hasMail) tabs.push({ id: 'mailbox', icon: 'fa-envelope', label: 'Surat' });
    if (hasKas) tabs.push({ id: 'kas', icon: 'fa-coins', label: 'Kas' });
    if (hasAdmin) tabs.push({ id: 'manage-admin', icon: 'fa-users-cog', label: 'Admin' });
    
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
// SETTINGS
// ==========================================
function openSettingsModal() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-cog"></i> Pengaturan</h3>
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; padding:10px; background:var(--bg-solid-form); border-radius:12px;">
                <span>🔔 Notifikasi Browser</span>
                <label class="toggle-switch"><input type="checkbox" id="notif-toggle" ${notificationEnabled ? 'checked' : ''} onchange="toggleNotificationSetting()"><span class="toggle-slider"></span></label>
            </div>
            <button onclick="openChangePasskey()" style="width:100%; margin-bottom:10px; background:var(--color-primary); border:none; border-radius:12px; padding:12px; color:white;">🔑 Ganti Passkey</button>
            <button onclick="logout()" style="width:100%; background:#ff4444; border:none; border-radius:12px; padding:12px; color:white;">🚪 Keluar</button>
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
    showToast(isChecked ? "Notifikasi aktif" : "Notifikasi nonaktif");
}

function openChangePasskey() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-key"></i> Ganti Passkey</h3>
            <input type="password" id="old-passkey" placeholder="Passkey lama">
            <input type="password" id="new-passkey" placeholder="Passkey baru (huruf+angka)">
            <input type="password" id="confirm-passkey" placeholder="Konfirmasi">
            <div class="modal-buttons"><button onclick="changeMyPasskey()" style="background:var(--color-primary);">Ganti</button><button onclick="closeModal()" style="background:#333;">Batal</button></div>
        </div>
    `;
}

async function changeMyPasskey() {
    const oldPasskey = document.getElementById('old-passkey').value.trim();
    const newPasskey = document.getElementById('new-passkey').value.trim();
    const confirmPasskey = document.getElementById('confirm-passkey').value.trim();
    if (!oldPasskey || !newPasskey) { showToast("Isi semua field", true); return; }
    if (newPasskey !== confirmPasskey) { showToast("Passkey baru tidak cocok", true); return; }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPasskey)) { showToast("Harus huruf besar+kecil+angka", true); return; }
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=changeMyPasskey&adminId=${currentAdmin.id}&oldPasskey=${encodeURIComponent(oldPasskey)}&newKey=${encodeURIComponent(newPasskey)}`);
        const data = await res.json();
        if (data.status === 'success') { 
            showToast("Passkey berhasil diubah!");
            currentAdmin.passkey = newPasskey;
            localStorage.setItem('umbrella_admin_session', JSON.stringify({ admin: currentAdmin, loggedInAt: Date.now() }));
            setTimeout(() => location.reload(), 1500);
        }
        else showToast(data.message || "Gagal", true);
    } catch(e) { showToast("Gagal koneksi", true); }
}

function logout() {
    if (standbyInterval) clearInterval(standbyInterval);
    if (typeof window.stopActivePresence === 'function') window.stopActivePresence();
    localStorage.removeItem('umbrella_admin_session');
    currentAdmin = null;
    location.reload();
}

// ==========================================
// MANAGE ADMIN (LEADER ONLY)
// ==========================================
async function refreshAdminList() {
    if (currentAdmin?.role1 !== 'LEADER') {
        console.log("Bukan LEADER, skip refresh admin list");
        return;
    }
    try {
        const url = `${window.GAS_ADMIN_URL}?action=getAdminList`;
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

function editAdminName(adminId, currentName) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-user-edit"></i> Edit Nama Admin</h3>
            <input type="text" id="edit-name" value="${currentName}" placeholder="Nama baru">
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
        const url = `${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${adminId}&field=nama&value=${encodeURIComponent(newName)}`;
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
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-tag"></i> Edit Role</h3>
            <select id="edit-role1">
                <option value="LEADER" ${role1 === 'LEADER' ? 'selected' : ''} ${adminId === currentAdmin.id ? 'disabled' : ''}>LEADER</option>
                <option value="CO-LEAD" ${role1 === 'CO-LEAD' ? 'selected' : ''}>CO-LEAD</option>
                <option value="BENDAHARA" ${role1 === 'BENDAHARA' ? 'selected' : ''}>BENDAHARA</option>
                <option value="">(Kosong)</option>
            </select>
            <select id="edit-role2">
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
            await fetch(`${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${adminId}&field=role1&value=${role1}`);
        }
        await fetch(`${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${adminId}&field=role2&value=${role2}`);
        showToast("Role berhasil diubah");
        closeModal();
        refreshAdminList();
    } catch(e) { showToast("Gagal", true); }
}

async function resetPasskey(adminId) {
    const defaultKey = `Passkey_${adminId.split('_')[1] || '1'}`;
    try {
        const url = `${window.GAS_ADMIN_URL}?action=resetPasskey&adminId=${adminId}&newKey=${defaultKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`✅ Passkey direset menjadi: ${defaultKey}`);
        } else {
            showToast(data.message || "Gagal reset", true);
        }
    } catch(e) { showToast("Gagal koneksi", true); }
}

function promoteToLeader(targetId) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-crown"></i> Lantik Leader Baru</h3>
            <p style="margin-bottom:10px;">Anda akan turun menjadi CO-LEAD</p>
            <input type="password" id="confirm-passkey" placeholder="Masukkan passkey Anda" style="width:100%; padding:10px; margin-bottom:10px;">
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
// EXPOSE
// ==========================================
window.doLogin = doLogin;
window.logout = logout;
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
window.promoteToLeader = promoteToLeader;
window.executePromoteLeader = executePromoteLeader;

checkSession();
console.log("✅ admin.js loaded");
