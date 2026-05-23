let activeInterval = null, chatPollingInterval = null, isChatOpen = false, lastChatStamp = "", adminData = null, currentChatTab = 'chat', isSending = false, onlineUsersCount = 0;

function initChat(admin) { adminData = admin; document.getElementById('floating-chat').style.display = 'block'; }
window.isChatOpen = () => isChatOpen;

window.toggleChatWidget = async function() {
    if (!adminData) { showToast("Chat belum siap", true); return; }
    const widget = document.getElementById('chat-widget');
    const isOpening = !widget.classList.contains('show');
    if (isOpening) {
        widget.classList.add('show');
        isChatOpen = true;
        if (typeof window.markChatAsRead === 'function') window.markChatAsRead();
        if (typeof window.stopStandbyPresence === 'function') window.stopStandbyPresence();
        await window.sendPresence('active');
        startAllTimers();
        renderChatUI();
        switchChatTab('chat');
        await loadChatMessages();
        await fetchOnlineUsers();
        document.getElementById('admin-chat-input')?.focus();
    } else {
        widget.classList.remove('show');
        isChatOpen = false;
        stopAllTimers();
        await window.sendPresence('standby');
        if (typeof window.startStandbyPresence === 'function') window.startStandbyPresence();
    }
};

function renderChatUI() {
    const widget = document.getElementById('chat-widget');
    if (!widget.querySelector('.chat-tabs')) {
        const tabsHtml = `<div class="chat-tabs"><button class="chat-tab-btn active" data-tab="chat"><i class="fas fa-comments"></i> Obrolan</button><button class="chat-tab-btn" data-tab="online"><i class="fas fa-users"></i> Online (<span id="online-count">0</span>)</button></div>`;
        const header = widget.querySelector('.chat-header');
        header.insertAdjacentHTML('afterend', tabsHtml);
        document.querySelectorAll('.chat-tab-btn').forEach(btn => btn.addEventListener('click', () => switchChatTab(btn.dataset.tab)));
    }
}

function switchChatTab(tab) {
    currentChatTab = tab;
    document.querySelectorAll('.chat-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    const onlineDiv = document.getElementById('online-users-list'), chatDiv = document.getElementById('admin-chat-logs'), inputArea = document.querySelector('.chat-input-area');
    if (tab === 'online') {
        onlineDiv.style.display = 'block'; chatDiv.style.display = 'none'; inputArea.style.display = 'none';
        fetchOnlineUsers();
    } else {
        onlineDiv.style.display = 'none'; chatDiv.style.display = 'flex'; inputArea.style.display = 'flex';
        setTimeout(() => chatDiv.scrollTop = chatDiv.scrollHeight, 100);
    }
}

function startAllTimers() {
    if (activeInterval) clearInterval(activeInterval);
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    activeInterval = setInterval(async () => { if(isChatOpen && adminData) await window.sendPresence('active'); }, 4500);
    chatPollingInterval = setInterval(async () => { if(isChatOpen && adminData) { await loadChatMessages(); if(currentChatTab === 'online') await fetchOnlineUsers(); } }, 4500);
}
function stopAllTimers() { if(activeInterval) clearInterval(activeInterval); if(chatPollingInterval) clearInterval(chatPollingInterval); }
window.stopActivePresence = stopAllTimers;

async function loadChatMessages() {
    const container = document.getElementById('admin-chat-logs');
    if (!container) return;
    const cached = sessionStorage.getItem('umbrella_cached_chat_logs');
    if (cached) renderChatLogs(JSON.parse(cached), container);
    try {
        const res = await fetch(`${window.GAS_SYNC_URL}?uid=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}`);
        const data = await res.json();
        const logs = data.logs || [];
        const stamp = JSON.stringify(logs);
        if (stamp === lastChatStamp && cached) return;
        lastChatStamp = stamp;
        sessionStorage.setItem('umbrella_cached_chat_logs', JSON.stringify(logs));
        renderChatLogs(logs, container);
    } catch(e) { console.error(e); }
}

function renderChatLogs(logs, container) {
    if (!logs.length) { container.innerHTML = '<div style="text-align:center;padding:20px;">📭 Belum ada pesan</div>'; return; }
    container.innerHTML = logs.map(msg => {
        if (msg.type === 'command') return '';
        const isDeleted = msg.message === '[deleted by admin]';
        const isMe = msg.uid === adminData.id;
        if (isDeleted) return `<div class="chat-row deleted"><div class="msg-text">🗑️ Pesan dihapus admin</div></div>`;
        return `<div class="chat-row ${isMe ? 'me' : 'other'}"><b>${escapeHtml(msg.username || 'Anonim')}</b><div class="chat-message-wrapper"><div class="msg-text">${escapeHtml(msg.message)}</div>${!isMe ? `<button class="delete-chat-btn" onclick="window.deleteChatMessage(${msg.rowIndex}, '${msg.uid}')"><i class="fas fa-trash-alt"></i></button>` : ''}</div></div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

async function fetchOnlineUsers() {
    const container = document.getElementById('online-users-container');
    if (!container) return;
    try {
        const res = await fetch(`${window.GAS_SYNC_URL}?uid=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}`);
        const data = await res.json();
        let users = data.onlineUsers || [];
        const admins = users.filter(u => u.uid.includes('ADMIN_'));
        const regulars = users.filter(u => !u.uid.includes('ADMIN_'));
        document.getElementById('online-count').innerText = users.length;
        if (!users.length) { container.innerHTML = '<div style="padding:12px;text-align:center;">✨ Tidak ada pengguna online</div>'; return; }
        let html = '';
        if (admins.length) {
            html += '<div style="margin-bottom:8px;"><span style="font-size:0.65rem;color:var(--color-primary);">👑 ADMIN ONLINE</span></div>';
            admins.forEach(u => { html += `<div class="online-user-item admin-item"><div><i class="fas fa-crown" style="color:#f59e0b;"></i> ${escapeHtml(u.ign)}<div style="font-size:0.6rem;">${u.uid}</div></div><div style="width:50px;"></div></div>`; });
        }
        if (regulars.length) {
            if (admins.length) html += '<div style="margin:12px 0 8px;"><span style="font-size:0.65rem;">👥 USER ONLINE</span></div>';
            regulars.forEach(u => {
                const muted = u.isMuted === true;
                html += `<div class="online-user-item"><div><strong>${escapeHtml(u.ign)}</strong>${muted ? '<span style="color:#ff8888;"> 🔇</span>' : ''}<div style="font-size:0.6rem;">${u.uid}</div></div><button class="${muted ? 'unmute-btn' : 'mute-btn'}" onclick="window.toggleMute('${u.uid}', '${escapeHtml(u.ign)}', ${muted})">${muted ? 'BUKA BISU' : 'BISUKAN'}</button></div>`;
            });
        }
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<div style="padding:12px;text-align:center;">⚠️ Gagal memuat</div>'; }
}

window.adminSendMessage = async function() {
    if (isSending) return;
    const input = document.getElementById('admin-chat-input');
    const msg = input?.value.trim();
    if (!msg) return;
    isSending = true;
    input.disabled = true;
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=sendChat&adminId=${adminData.id}&ign=${encodeURIComponent(adminData.nama)}&msg=${encodeURIComponent(msg)}`);
        const data = await res.json();
        if (data.status === 'success') { input.value = ''; await loadChatMessages(); }
        else { showToast("❌ Gagal kirim", true); input.value = msg; }
    } catch(e) { showToast("❌ Gagal", true); input.value = msg; }
    finally { input.disabled = false; input.focus(); setTimeout(() => { isSending = false; }, 500); }
};

window.deleteChatMessage = async function(rowIndex, uid) {
    if (!adminData) return;
    showConfirmModal('Hapus pesan ini?', async () => {
        try {
            const res = await fetch(`${window.GAS_ADMIN_URL}?action=deleteChat&adminId=${adminData.id}&rowIndex=${rowIndex}`);
            const data = await res.json();
            if (data.status === 'success') { showToast('✅ Pesan dihapus'); await loadChatMessages(); }
            else showToast('❌ Gagal', true);
        } catch(e) { showToast('❌ Gagal', true); }
    });
};

window.toggleMute = function(uid, ign, isCurrentlyMuted) {
    if (isCurrentlyMuted) window.executeUnmute(uid, ign);
    else window.showMuteModal(uid, ign);
};

window.showMuteModal = function(uid, ign) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `<div class="modal-content"><h3><i class="fas fa-volume-mute"></i> Bisukan Pemain</h3><p>Pemain: <strong>${ign}</strong> (${uid})</p><select id="mute-duration"><option value="1">1 menit</option><option value="5">5 menit</option><option value="10">10 menit</option><option value="30">30 menit</option><option value="60">60 menit</option></select><div class="modal-buttons"><button onclick="window.executeMute('${uid}', document.getElementById('mute-duration').value, '${ign}')" style="background:var(--color-primary);">BISUKAN</button><button onclick="closeModal()" style="background:#333;">Batal</button></div></div>`;
    modal.style.display = 'flex';
};

window.executeMute = async function(targetUid, duration, ign) {
    closeModal();
    showToast(`⏳ Membisukan ${ign}...`);
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=executeMute&adminId=${adminData.id}&targetUid=${targetUid}&duration=${duration}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            showToast(`✅ ${ign} dibisukan ${duration} menit`);
            // Refresh list online setelah sukses (baru berubah)
            await fetchOnlineUsers();
            await loadChatMessages();
        } else {
            showToast(`❌ Gagal membisukan ${ign}`, true);
        }
    } catch(e) { 
        showToast("❌ Gagal koneksi", true);
    }
};

window.executeUnmute = async function(targetUid, ign) {
    closeModal();
    showToast(`⏳ Membuka bisuan ${ign}...`);
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=executeUnmute&adminId=${adminData.id}&targetUid=${targetUid}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            showToast(`✅ Bisuan ${ign} dibuka`);
            // Refresh list online setelah sukses (baru berubah)
            await fetchOnlineUsers();
            await loadChatMessages();
        } else {
            showToast(`❌ Gagal membuka bisuan ${ign}`, true);
        }
    } catch(e) { 
        showToast("❌ Gagal koneksi", true);
    }
};

window.initChat = initChat;