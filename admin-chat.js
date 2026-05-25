/**
 * admin-chat.js - Chat Widget
 * 
 * STRUKTUR WIDGET:
 * - Dua tab: "Obrolan" (chat logs) dan "Online" (daftar user online)
 * - dua container terpisah (online-users-list dan admin-chat-logs) yang di-switch via CSS display
 * - Input area hanya muncul di tab Obrolan
 */

let activeInterval = null;
let chatPollingInterval = null;
let isChatOpen = false;
let adminData = null;
let currentChatTab = 'chat';
let isSending = false;
let onlineUsersCount = 0;

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
        
        // Push state untuk back button
        history.pushState({ chatOpen: true }, "");
    } else {
        widget.classList.remove('show');
        isChatOpen = false;
        
        stopAllTimers();
        if (typeof window.sendPresence === 'function') await window.sendPresence('standby');        
        if (history.state && history.state.chatOpen) {
            history.back();
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
    
    // Cek cache dulu
    const cached = sessionStorage.getItem('umbrella_cached_chat_logs');
    if (cached) {
        try {
            renderChatLogs(JSON.parse(cached), container);
        } catch(e) { console.error("Cache parse error:", e); }
    }
    
    try {
        const url = `${window.GAS_SYNC_URL}?uid=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}`;
        const res = await fetch(url);
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

function renderChatLogs(logs, container) {
    if (!container) return;
    
    if (!logs.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">📭 Belum ada pesan</div>';
        return;
    }
    
    let html = '';
    for (const msg of logs) {
        // ==========================================
        // 🆕 KONVERSI COMMAND MUTE/UNMUTE JADI PESAN SISTEM
        // ==========================================
        let msgType = msg.type || 'msg';
        let msgText = msg.message || '';
        let isSystem = false;
        let displayText = msgText;
        
        if (msgType === 'command') {
            if (msgText.startsWith('MUTE_')) {
                const parts = msgText.split('_');
                const targetIGN = parts[3] || 'Seseorang';
                const durasi = parts[2] || '?';
                displayText = `🔇 ${targetIGN} dibisukan selama ${durasi} menit oleh admin.`;
                isSystem = true;
            } else if (msgText.startsWith('UNMUTE_')) {
                const parts = msgText.split('_');
                const targetIGN = parts[2] || 'Seseorang';
                displayText = `🔊 ${targetIGN} telah dibuka bisuannya oleh admin.`;
                isSystem = true;
            } else {
                continue; // command lain tidak ditampilkan
            }
        }
        
        // Filter: hanya msg atau system yang boleh lewat
        if (msgType !== 'msg' && !isSystem) continue;
        
        const isDeleted = (msgType === 'msg' && msgText === '[deleted by admin]');
        
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
        const rowIndex = msg.rowIndex;
        const uid = msg.uid;
        
        html += `
            <div class="chat-row other">
                <b>${username}</b>
                <div class="chat-message-wrapper">
                    <div class="msg-text">${message}</div>
                    <button class="delete-chat-btn" onclick="window.deleteChatMessage(${rowIndex}, '${uid}')"><i class="fas fa-trash-alt"></i></button>
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
        const res = await fetch(url);
        const data = await res.json();
        let users = data.onlineUsers || [];
        
        const admins = users.filter(u => u.uid && u.uid.includes('ADMIN_'));
        const regulars = users.filter(u => u.uid && !u.uid.includes('ADMIN_'));
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
                html += `<div class="online-user-item admin-item"><div><i class="fas fa-crown" style="color:#f59e0b;"></i> ${escapeHtml(u.ign)}<div style="font-size:0.6rem;">${u.uid}</div></div><div style="width:50px;"></div></div>`;
            }
        }
        
        if (regulars.length) {
            if (admins.length) html += '<div style="margin:12px 0 8px;"><span style="font-size:0.65rem;">👥 USER ONLINE</span></div>';
            for (const u of regulars) {
                const muted = u.isMuted === true;
                html += `<div class="online-user-item"><div><strong>${escapeHtml(u.ign)}</strong>${muted ? '<span style="color:#ff8888;"> 🔇</span>' : ''}<div style="font-size:0.6rem;">${u.uid}</div></div><button class="${muted ? 'unmute-btn' : 'mute-btn'}" onclick="window.toggleMute('${u.uid}', '${escapeHtml(u.ign)}', ${muted})">${muted ? 'BUKA BISU' : 'BISUKAN'}</button></div>`;
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
        const res = await fetch(url);
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
window.deleteChatMessage = async function(rowIndex, uid) {
    if (!adminData) return;
    window.showConfirmModal('Hapus pesan ini?', async () => {
        try {
            const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteChat&adminId=${adminData.id}&rowIndex=${rowIndex}`);
            const data = await res.json();
            if (data.status === 'success') {
                window.showToast('✅ Pesan dihapus');
                await loadChatMessages();
            } else {
                window.showToast('❌ Gagal', true);
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

window.showMuteModal = function(uid, ign) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-volume-mute"></i> Bisukan Pemain</h3>
            <p>Pemain: <strong>${escapeHtml(ign)}</strong> (${escapeHtml(uid)})</p>
            <select id="mute-duration" style="width:100%; padding:8px; margin-bottom:10px;">
                <option value="1">1 menit</option><option value="5">5 menit</option>
                <option value="10">10 menit</option><option value="30">30 menit</option>
                <option value="60">60 menit</option>
            </select>
            <div class="modal-buttons">
                <button onclick="window.executeMute('${uid}', document.getElementById('mute-duration').value, '${escapeHtml(ign)}')" style="background:var(--color-primary);">BISUKAN</button>
                <button onclick="window.closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.executeMute = async function(targetUid, duration, ign) {
    window.closeModal();
    window.showToast(`⏳ Membisukan ${ign}...`);
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=executeMute&adminId=${adminData.id}&targetUid=${targetUid}&duration=${duration}&targetIgn=${encodeURIComponent(ign)}`);
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
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=executeUnmute&adminId=${adminData.id}&targetUid=${targetUid}&targetIgn=${encodeURIComponent(ign)}`);
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
// EXPOSE GLOBAL FUNCTIONS
// ==========================================
window.initChat = initChat;
window.loadChatMessages = loadChatMessages;
window.fetchOnlineUsers = fetchOnlineUsers;

console.log("✅ admin-chat.js loaded (Final - Fix Load)");
