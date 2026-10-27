/**
 * admin-chat.js - Chat Widget (V4 — XSS Fix + Legacy UID)
 * 
 * Perubahan V4:
 * - 🛡️ Fix XSS di 3 onclick (deleteChatMessage, toggleMute, executeMute)
 * - 🔄 isMyMessage(): dukung legacy UID (ADMN_x / ADMIN_x → ADM-xxxx)
 * - 🎯 Bubble admin muncul di sisi "me" walau UID lama
 */

let activeInterval = null;
let chatPollingInterval = null;
let isChatOpen = false;
let adminData = null;
let currentChatTab = 'chat';
let isSending = false;
let onlineUsersCount = 0;

// ==========================================
// 🎯 LEGACY UID HELPER
// ==========================================
function normalizeDigits(s) {
    var d = String(s || '').replace(/\D/g, '');
    return d.replace(/^0+/, '') || '';
}

function isMyMessage(msgUid, adminData) {
    if (!msgUid || !adminData) return false;

    // 1. Exact match — UID saat ini
    if (msgUid === adminData.id) return true;

    // 2. Explicit legacy list (future-proof)
    if (Array.isArray(adminData.legacyIds) && adminData.legacyIds.indexOf(msgUid) !== -1) {
        return true;
    }

    // 3. Heuristic: digit match untuk migrasi ADMN_x / ADMIN_x → ADM-xxxx
    var currentDigits = normalizeDigits(adminData.id);
    if (!currentDigits) return false;

    var msgDigits = normalizeDigits(msgUid);
    if (!msgDigits || msgDigits !== currentDigits) return false;

    var msgStr = String(msgUid);
    var legacyPrefixes = ['ADMN_', 'ADMN-', 'ADMIN_', 'ADMIN-', 'ADM_'];
    for (var i = 0; i < legacyPrefixes.length; i++) {
        if (msgStr.indexOf(legacyPrefixes[i]) === 0) {
            console.log('🔄 Legacy UID match:', msgUid, '→', adminData.id);
            return true;
        }
    }

    return false;
}

function getLastChatStamp() {
    return localStorage.getItem('umbrella_last_chat_stamp') || '';
}

function setLastChatStamp(stamp) {
    localStorage.setItem('umbrella_last_chat_stamp', stamp);
}

function initChat(admin) {
    adminData = admin;
    console.log("✅ Chat diinisialisasi untuk:", adminData?.nama);
    const floatingChat = document.getElementById('floating-chat');
    if (floatingChat) floatingChat.style.display = 'block';
}

window.isChatOpen = () => isChatOpen;

// ==========================================
// TOGGLE CHAT WIDGET
// ==========================================
window.toggleChatWidget = async function() {
    if (!adminData) { 
        window.showToast("Chat belum siap, refresh halaman", true); 
        return; 
    }
    
    const widget = document.getElementById('chat-widget');
    if (!widget) return;
    
    const isOpening = !widget.classList.contains('show');
    
    if (isOpening) {
        widget.classList.add('show');
        isChatOpen = true;
        
        if (typeof window.sendPresence === 'function') await window.sendPresence('active');
        
        startAllTimers();
        renderChatTabs();
        switchChatTab('chat');
        await loadChatMessages();
        await fetchOnlineUsers();
        
        const input = document.getElementById('admin-chat-input');
        if (input) input.focus();
        
        if (typeof pushView === 'function') {
            pushView('chat');
        }
    } else {
        widget.classList.remove('show');
        isChatOpen = false;
        
        stopAllTimers();
        if (typeof window.sendPresence === 'function') await window.sendPresence('standby');
        
        if (typeof closeCurrentView === 'function') {
            closeCurrentView();
        }
    }
};

// ==========================================
// RENDER CHAT TABS
// ==========================================
function renderChatTabs() {
    const widget = document.getElementById('chat-widget');
    if (!widget) return;
    if (widget.querySelector('.chat-tabs')) return;
    
    const tabsHtml = `
        <div class="chat-tabs">
            <button class="chat-tab-btn active" data-tab="chat">
                <i class="fas fa-comments"></i> Obrolan
            </button>
            <button class="chat-tab-btn" data-tab="online">
                <i class="fas fa-users"></i> Online (<span id="online-count">0</span>)
            </button>
        </div>
    `;
    
    const header = widget.querySelector('.chat-header');
    if (header) {
        header.insertAdjacentHTML('afterend', tabsHtml);
    }
    
    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchChatTab(btn.dataset.tab));
    });
}

function switchChatTab(tab) {
    currentChatTab = tab;
    
    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    const onlineDiv = document.getElementById('online-users-list');
    const chatDiv = document.getElementById('admin-chat-logs');
    const inputArea = document.querySelector('.chat-input-area');
    
    if (tab === 'online') {
        if (onlineDiv) onlineDiv.style.display = 'block';
        if (chatDiv) chatDiv.style.display = 'none';
        if (inputArea) inputArea.style.display = 'none';
        fetchOnlineUsers();
    } else {
        if (onlineDiv) onlineDiv.style.display = 'none';
        if (chatDiv) {
            chatDiv.style.display = 'flex';
            setTimeout(() => chatDiv.scrollTop = chatDiv.scrollHeight, 100);
        }
        if (inputArea) inputArea.style.display = 'flex';
    }
}

// ==========================================
// TIMERS
// ==========================================
function startAllTimers() {
    if (activeInterval) clearInterval(activeInterval);
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    
    activeInterval = setInterval(async () => {
        if (isChatOpen && adminData && typeof window.sendPresence === 'function') {
            await window.sendPresence('active');
        }
    }, 4500);
    
    chatPollingInterval = setInterval(async () => {
        if (isChatOpen && adminData) {
            await loadChatMessages();
            if (currentChatTab === 'online') await fetchOnlineUsers();
        }
    }, 4500);
}

function stopAllTimers() {
    if (activeInterval) { clearInterval(activeInterval); activeInterval = null; }
    if (chatPollingInterval) { clearInterval(chatPollingInterval); chatPollingInterval = null; }
}
window.stopActivePresence = stopAllTimers;

// ==========================================
// LOAD CHAT MESSAGES
// ==========================================
async function loadChatMessages() {
    if (!adminData) return;
    
    const container = document.getElementById('admin-chat-logs');
    if (!container) return;
    
    const cached = sessionStorage.getItem('umbrella_cached_chat_logs');
    if (cached) {
        try {
            renderChatLogs(JSON.parse(cached), container);
        } catch(e) { console.error("Cache parse error:", e); }
    }
    
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}`;
        const res = await adminFetch(url);
        const data = await res.json();
        const logs = data.logs || [];
        const stamp = JSON.stringify(logs);
        const savedStamp = getLastChatStamp();

        if (stamp === savedStamp && cached) return;
        setLastChatStamp(stamp);
        
        sessionStorage.setItem('umbrella_cached_chat_logs', JSON.stringify(logs));
        sessionStorage.setItem('umbrella_cached_chat_timestamp', Date.now().toString());
        renderChatLogs(logs, container);
    } catch(e) { 
        console.error("Load chat error:", e);
        if (!cached) {
            container.innerHTML = '<div style="text-align:center;padding:20px;">⚠️ Gagal memuat chat</div>';
        }
    }
}

// ==========================================
// RENDER CHAT LOGS
// ==========================================
function renderChatLogs(logs, container) {
    if (!container) return;
    
    if (!logs.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">📭 Belum ada pesan</div>';
        return;
    }
    
    let html = '';
    for (const msg of logs) {
        let msgType = msg.type || 'msg';
        let msgText = msg.message || '';
        let isSystem = false;
        let displayText = msgText;
        
        if (msgType === 'command') {
            if (msgText.startsWith('MUTE_')) {
                const parts = msgText.split('_');
                const targetIGN = escapeHtml(parts[3] || 'Seseorang');
                const durasi = parts[2] || '?';
                displayText = `🔇 ${targetIGN} dibisukan selama ${durasi} menit.`;
                isSystem = true;
            } else if (msgText.startsWith('UNMUTE_')) {
                const parts = msgText.split('_');
                const targetIGN = escapeHtml(parts[2] || 'Seseorang');
                displayText = `🔊 ${targetIGN} telah dibuka bisuannya.`;
                isSystem = true;
            } else {
                continue;
            }
        }
        
        if (msgType !== 'msg' && !isSystem) continue;
        
        const isDeleted = (msgType === 'msg' && msgText === '[deleted by admin]');
        
        // 🎯 FIX: pakai isMyMessage untuk dukung legacy UID
        const isMe = isMyMessage(msg.uid, adminData);
        
        if (isSystem) {
            html += `<div class="chat-row system-message"><div class="system-text">${displayText}</div></div>`;
            continue;
        }
        
        if (isDeleted) {
            html += `<div class="chat-row deleted"><div class="msg-text">🗑️ Pesan dihapus admin</div></div>`;
            continue;
        }
        
        const username = escapeHtml(msg.username || 'Anonim');
        const message = escapeHtml(msg.message || '');
        const timestamp = msg.timestamp;
        const uid = msg.uid;

        // 🛡️ FIX XSS: escapeJs untuk uid di onclick
        const safeUid = (typeof escapeJs === 'function') ? escapeJs(uid) : String(uid).replace(/'/g, "\\'");
        
        html += `
            <div class="chat-row ${isMe ? 'me' : 'other'}">
                <b>${username}</b>
                <div class="chat-message-wrapper">
                    <div class="msg-text">${message}</div>
                    ${!isMe ? `<button class="delete-chat-btn" onclick="window.deleteChatMessage(${timestamp}, '${safeUid}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ==========================================
// FETCH ONLINE USERS
// ==========================================
async function fetchOnlineUsers() {
    const container = document.getElementById('online-users-container');
    if (!container) return;
    
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}`;
        const res = await adminFetch(url);
        const data = await res.json();
        let users = data.onlineUsers || [];
        
        const admins = users.filter(u => u.uid && (u.uid.indexOf('ADM-') === 0 || u.uid.indexOf('ADMIN_') === 0 || u.uid.indexOf('ADMN_') === 0));
        const regulars = users.filter(u => !(u.uid && (u.uid.indexOf('ADM-') === 0 || u.uid.indexOf('ADMIN_') === 0 || u.uid.indexOf('ADMN_') === 0)));
        onlineUsersCount = users.length;
        
        const onlineCountSpan = document.getElementById('online-count');
        if (onlineCountSpan) onlineCountSpan.innerText = onlineUsersCount;
        
        if (!users.length) {
            container.innerHTML = '<div style="padding:12px;text-align:center;">✨ Tidak ada pengguna online</div>';
            return;
        }
        
        let html = '';
        if (admins.length) {
            html += '<div style="margin-bottom:8px;"><span style="font-size:0.65rem;color:var(--color-primary);">👑 ADMIN ONLINE</span></div>';
            for (const u of admins) {
                html += `<div class="online-user-item admin-item"><div><i class="fas fa-crown" style="color:#f59e0b;"></i> ${escapeHtml(u.ign)}<div style="font-size:0.6rem;">${escapeHtml(u.uid)}</div></div><div style="width:50px;"></div></div>`;
            }
        }
        
        if (regulars.length) {
            if (admins.length) html += '<div style="margin:12px 0 8px;"><span style="font-size:0.65rem;">👥 USER ONLINE</span></div>';
            for (const u of regulars) {
                const muted = u.isMuted === true;

                // 🛡️ FIX XSS: escapeJs untuk uid
                const safeUid = (typeof escapeJs === 'function') ? escapeJs(u.uid) : String(u.uid).replace(/'/g, "\\'");
                const safeIgn = escapeHtml(u.ign);
                const safeIgnJs = (typeof escapeJs === 'function') ? escapeJs(u.ign) : String(u.ign).replace(/'/g, "\\'");

                html += `<div class="online-user-item"><div><strong>${safeIgn}</strong>${muted ? '<span style="color:#ff8888;"> 🔇</span>' : ''}<div style="font-size:0.6rem;">${safeIgn}</div></div><button class="${muted ? 'unmute-btn' : 'mute-btn'}" onclick="window.toggleMute('${safeUid}', '${safeIgnJs}', ${muted})">${muted ? 'BUKA BISU' : 'BISUKAN'}</button></div>`;
            }
        }
        
        container.innerHTML = html;
    } catch(e) { 
        console.error("Fetch online users error:", e);
        container.innerHTML = '<div style="padding:12px;text-align:center;">⚠️ Gagal memuat</div>';
    }
}

// ==========================================
// SEND MESSAGE
// ==========================================
window.adminSendMessage = async function() {
    if (isSending) return;
    
    const input = document.getElementById('admin-chat-input');
    if (!input) return;
    
    const msg = input.value.trim();
    if (!msg) return;
    
    isSending = true;
    input.disabled = true;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=sendChat&adminId=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}&msg=${encodeURIComponent(msg)}`;
        const res = await adminFetch(url);
        const data = await res.json();
        if (data.status === 'success') {
            input.value = '';
            await loadChatMessages();
        } else {
            window.showToast("❌ Gagal kirim", true);
            input.value = msg;
        }
    } catch(e) { 
        console.error("Send message error:", e);
        window.showToast("❌ Gagal kirim", true); 
        input.value = msg;
    } finally { 
        input.disabled = false; 
        input.focus();
        setTimeout(() => { isSending = false; }, 500);
    }
};

// ==========================================
// DELETE CHAT
// ==========================================
window.deleteChatMessage = async function(timestamp, uid) {
    if (!adminData) return;
    if (!timestamp) {
        window.showToast("❌ Error: timestamp tidak valid", true);
        return;
    }
    
    window.showConfirmModal('Hapus pesan ini?', async () => {
        try {
            const res = await adminFetch(`${window.GAS_ADMIN_URL}?action=deleteChat&adminId=${adminData.id}&timestamp=${timestamp}`);
            const data = await res.json();
            if (data.status === 'success') {
                window.showToast('✅ Pesan dihapus');
                await loadChatMessages();
            } else {
                window.showToast('❌ ' + (data.message || 'Gagal'), true);
            }
        } catch(e) { 
            console.error("Delete chat error:", e);
            window.showToast('❌ Gagal', true);
        }
    });
};

// ==========================================
// MUTE / UNMUTE
// ==========================================
window.toggleMute = function(uid, ign, isCurrentlyMuted) {
    if (isCurrentlyMuted) {
        window.executeUnmute(uid, ign);
    } else {
        window.showMuteModal(uid, ign);
    }
};

// ==========================================
// MUTE MODAL
// ==========================================
window.showMuteModal = function(uid, ign) {
    renderMuteModalInternal(uid, ign);
    if (typeof pushView === 'function') {
        pushView('chat-mute', { uid: uid, ign: ign });
    }
};

function renderMuteModalInternal(uid, ign) {
    const modal = document.getElementById('modal-overlay');

    // 🛡️ FIX XSS: escapeJs untuk uid di onclick
    const safeUid = (typeof escapeJs === 'function') ? escapeJs(uid) : String(uid).replace(/'/g, "\\'");

    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-volume-mute"></i> Bisukan Pemain</h3>
            <p>Pemain: <strong>${escapeHtml(ign)}</strong> (${escapeHtml(uid)})</p>
            <select id="mute-duration" style="width:100%; padding:8px; margin-bottom:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <option value="1">1 menit</option><option value="5">5 menit</option>
                <option value="10">10 menit</option><option value="30">30 menit</option>
                <option value="60">60 menit</option>
            </select>
            <div class="modal-buttons">
                <button onclick="window.executeMute('${safeUid}', document.getElementById('mute-duration').value, '${escapeHtml(ign)}')" style="background:var(--color-primary);">BISUKAN</button>
                <button onclick="window.closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

window.executeMute = async function(targetUid, duration, ign) {
    window.closeModal();
    window.showToast(`⏳ Membisukan ${ign}...`);
    
    try {
        const res = await adminFetch(`${window.GAS_ADMIN_URL}?action=executeMute&adminId=${adminData.id}&targetUid=${encodeURIComponent(targetUid)}&duration=${encodeURIComponent(duration)}&targetIgn=${encodeURIComponent(ign)}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast(`✅ ${ign} dibisukan ${duration} menit`);
            await fetchOnlineUsers();
            await loadChatMessages();
        } else {
            window.showToast(`❌ Gagal`, true);
        }
    } catch(e) { 
        console.error("Execute mute error:", e);
        window.showToast("❌ Gagal", true);
    }
};

window.executeUnmute = async function(targetUid, ign) {
    window.closeModal();
    window.showToast(`⏳ Membuka bisuan ${ign}...`);
    
    try {
        const res = await adminFetch(`${window.GAS_ADMIN_URL}?action=executeUnmute&adminId=${adminData.id}&targetUid=${encodeURIComponent(targetUid)}&targetIgn=${encodeURIComponent(ign)}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.showToast(`✅ Bisuan ${ign} dibuka`);
            await fetchOnlineUsers();
            await loadChatMessages();
        } else {
            window.showToast(`❌ Gagal`, true);
        }
    } catch(e) { 
        console.error("Execute unmute error:", e);
        window.showToast("❌ Gagal", true);
    }
};

// ==========================================
// EXPOSE
// ==========================================
window.initChat = initChat;
window.loadChatMessages = loadChatMessages;
window.fetchOnlineUsers = fetchOnlineUsers;
window.renderMuteModalInternal = renderMuteModalInternal;
window.isMyMessage = isMyMessage;

console.log("✅ admin-chat.js loaded (V4 — XSS Fix + Legacy UID)");
