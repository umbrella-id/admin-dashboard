window.GAS_ADMIN_URL = "https://script.google.com/macros/s/AKfycbx1VqwGfC0Bz_tXNacdEe6s3Lu7USX9uRy7JbrOet4qu_bjA6PR9r780Ne7LP73UwUs/exec";
window.GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbwqsSUeVxPg4V5hMc9ph92eMQ2cFqTQI7SJZOG9f-FDlPii4IaXGEfOZ7zdRG35zbIhnw/exec";

let currentAdmin = null;
let standbyInterval = null;
let notificationEnabled = localStorage.getItem('umbrella_notif_enabled') !== 'false';

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

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

window.showConfirmModal = function(pesan, onConfirm, onCancel) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 300px;">
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

function showBrowserNotification(title, body) {
    if (!notificationEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    const notification = new Notification(title, { body: body, icon: '/favicon.ico' });
    notification.onclick = () => { window.focus(); notification.close(); };
}

window.sendPresence = async function(mode) {
    if (!currentAdmin) return;
    await fetch(`${window.GAS_SYNC_URL}?role=admin&uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}&mode=${mode}`);
};

async function sendStandbyAndUpdateAll() {
    if (!currentAdmin) return;
    
    console.log("🟡 Standby: cek event baru (chat + mail)");
    
    // 1. Kirim presence standby
    await window.sendPresence('standby');
    
    if (!notificationEnabled) return;
    
    // 2. CEK CHAT LOG (pesan baru)
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${currentAdmin.id}&ign=${encodeURIComponent(currentAdmin.nama)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        const logs = data.logs || [];
        
        // ✅ TAMBAHKAN: simpan ke cache
        sessionStorage.setItem('umbrella_cached_chat_logs', JSON.stringify(logs));
        sessionStorage.setItem('umbrella_cached_chat_timestamp', Date.now().toString());
        
        const guestMessages = logs.filter(msg => {
            if (msg.type === 'command') return false;
            if (msg.uid === currentAdmin.id) return false;
            return true;
        });
        
        const currentCount = guestMessages.length;
        const lastCount = parseInt(localStorage.getItem('umbrella_last_chat_count') || '0');
        
        localStorage.setItem('umbrella_last_chat_count', currentCount.toString());
        
        if (currentCount > lastCount && lastCount > 0) {
            const newCount = currentCount - lastCount;
            const lastMsg = guestMessages[guestMessages.length - 1];
            console.log(`💬 Ada ${newCount} pesan chat baru!`);
            
            if (document.hidden) {
                showBrowserNotification('💬 Pesan Chat Baru', `${newCount} pesan baru dari ${lastMsg?.username || 'Guest'}`);
                playNotificationSound();
            } else {
                showToast(`💬 Ada ${newCount} pesan chat baru!`);
            }
        }
    } catch(e) { console.error("Check chat error:", e); }
    
    // 3. CEK MAILBOX (surat baru)
    try {
        const resMail = await fetch(`${window.GAS_ADMIN_URL}?action=fetchMailbox`);
        const dataMail = await resMail.json();
        
        if (dataMail.status === 'success' && dataMail.data) {
            const unreadMails = dataMail.data.filter(mail => mail.status === 'UNREAD');
            const currentUnread = unreadMails.length;
            const lastUnread = parseInt(localStorage.getItem('umbrella_last_unread_mail') || '0');
            
            localStorage.setItem('umbrella_last_unread_mail', currentUnread.toString());
            
            // ✅ PINDAHKAN KE SINI (refresh UI tetap jalan meskipun tidak ada notif)
            if (typeof window.renderMailboxData === 'function') {
                window.renderMailboxData(dataMail.data);
            }
            
            if (currentUnread > lastUnread && lastUnread > 0) {
                const newCount = currentUnread - lastUnread;
                const newestMail = unreadMails[0];
                console.log(`📬 Ada ${newCount} surat baru!`);
                
                if (document.hidden) {
                    showBrowserNotification('📬 Surat Baru', `${newCount} surat baru dari ${newestMail?.ign || 'Guest'}`);
                    playNotificationSound();
                } else {
                    showToast(`📬 Ada ${newCount} surat baru!`);
                }
            }
        }
    } catch(e) { console.error("Check mailbox error:", e); }
}

// REFRESH UI SAAT TAB AKTIF KEMBALI
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && currentAdmin) {
        console.log("🟢 Tab aktif kembali, refresh UI...");
        
        // Refresh mailbox
        if (typeof window.refreshMailbox === 'function') {
            window.refreshMailbox();
        }
        
        // Refresh chat jika sedang terbuka
        if (window.isChatOpen && window.isChatOpen()) {
            if (typeof window.loadChatMessages === 'function') {
                window.loadChatMessages();
            }
            if (typeof window.fetchOnlineUsers === 'function') {
                window.fetchOnlineUsers();
            }
        }
    }
});

function startStandbyPresence() {
    if (standbyInterval) clearInterval(standbyInterval);
    
    console.log("🟡 START STANDBY (60 detik) - cek event");
    sendStandbyAndUpdateAll();
    
    standbyInterval = setInterval(() => {
        if (currentAdmin && (!window.isChatOpen || !window.isChatOpen())) {
            sendStandbyAndUpdateAll();
        }
    }, 60000);
}

function stopStandbyPresence() { if(standbyInterval) { clearInterval(standbyInterval); standbyInterval = null; } }
window.stopStandbyPresence = stopStandbyPresence;

async function doLogin() {
    const passkey = document.getElementById('login-passkey').value.trim();
    if (!passkey) { document.getElementById('login-error').innerText = 'Passkey harus diisi!'; return; }
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=login&passkey=${encodeURIComponent(passkey)}`);
        const data = await res.json();
        if (data.status === 'success') {
            currentAdmin = data.admin;
            document.getElementById('admin-name-display').innerText = currentAdmin.nama;
            const roleText = currentAdmin.role2 ? `${currentAdmin.role1} + ${currentAdmin.role2}` : currentAdmin.role1;
            document.getElementById('admin-role-display').innerText = roleText;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            if (notificationEnabled && Notification.permission !== 'granted') await Notification.requestPermission();
            const hasChat = (currentAdmin.role1 === 'LEADER' || currentAdmin.role1 === 'CO-LEAD' || currentAdmin.role2 === 'CO-LEAD');
            if (hasChat) {
                document.getElementById('floating-chat').style.display = 'block';
                setTimeout(() => { if(typeof window.initChat === 'function') window.initChat(currentAdmin); }, 500);
            }
            renderBottomNav();
            if (typeof window.refreshMailbox === 'function') window.refreshMailbox();
            if (currentAdmin.role1 === 'LEADER' && typeof window.refreshAdminList === 'function') window.refreshAdminList();
            startStandbyPresence();
            if (typeof window.startMailboxRefresh === 'function') window.startMailboxRefresh();
        } else {
            document.getElementById('login-error').innerText = data.message || 'Login gagal!';
        }
    } catch(err) { document.getElementById('login-error').innerText = 'Koneksi gagal!'; }
}

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

function openSettingsModal() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <h3><i class="fas fa-cog"></i> Pengaturan</h3>
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; padding:10px; background:var(--bg-solid-form); border-radius:12px;">
                <span>🔔 Notifikasi Browser</span>
                <label class="toggle-switch"><input type="checkbox" id="notif-toggle" ${notificationEnabled ? 'checked' : ''} onchange="toggleNotificationSetting()"><span class="toggle-slider"></span></label>
            </div>
            <button onclick="openChangePasskey()" style="width:100%; margin-bottom:10px; background:var(--color-primary); border:none; border-radius:12px; padding:12px; color:white;">🔑 Ganti Passkey</button>
            <button onclick="logout()" style="width:100%; background:#ff4444; border:none; border-radius:12px; padding:12px; color:white;">🚪 Keluar</button>
            <div class="modal-buttons"><button onclick="closeModal()" style="background:#333;">Tutup</button></div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function toggleNotificationSetting() {
    const isChecked = document.getElementById('notif-toggle')?.checked || false;
    if (isChecked && Notification.permission !== 'granted') {
        const granted = await Notification.requestPermission();
        if (granted !== 'granted') { document.getElementById('notif-toggle').checked = false; saveNotificationPreference(false); showToast("Izin ditolak", true); return; }
    }
    saveNotificationPreference(isChecked);
    showToast(isChecked ? "Notifikasi aktif" : "Notifikasi nonaktif");
}

function openChangePasskey() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
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
        if (data.status === 'success') { showToast("Passkey berhasil diubah, login ulang"); setTimeout(() => logout(), 2000); }
        else showToast(data.message || "Gagal", true);
    } catch(e) { showToast("Gagal koneksi", true); }
}

function logout() {
    if (standbyInterval) clearInterval(standbyInterval);
    if (typeof window.stopActivePresence === 'function') window.stopActivePresence();
    if (typeof window.stopMailboxRefresh === 'function') window.stopMailboxRefresh();
    currentAdmin = null;
    location.reload();
}

window.doLogin = doLogin;
window.logout = logout;
window.closeModal = closeModal;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.toggleNotificationSetting = toggleNotificationSetting;
window.openChangePasskey = openChangePasskey;
window.changeMyPasskey = changeMyPasskey;
window.openSettingsModal = openSettingsModal;
