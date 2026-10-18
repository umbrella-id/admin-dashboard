/**
 * admin-member.js - Member Management Module (V8)
 * 
 * Perubahan dari V7:
 * - 🐛 FIX BUG #1: Leader bisa edit nama & WA sendiri (status/role tetap readonly)
 * - 🎯 Defensive Bug #2: pakai member.ign sebagai display name admin
 * - 🎯 Reset Passkey Random (generate di frontend)
 * - 🎯 Tombol Reset Passkey di modal Ubah Jabatan
 * - 🐛 FIX BUG: role2 "bendahara" tidak mau terhapus (isDeleteMode logic)
 */

let memberList = [];
let cachedAdminLinkedUids = [];
let cachedAdminLinkedData = [];

// ==========================================
// VALIDASI WA
// ==========================================
function sanitizeWA(wa) {
    if (!wa) return '';
    return wa.toString().replace(/\D/g, '');
}

function isValidWA(wa) {
    if (!wa) return true;
    if (!/^\d+$/.test(wa)) return false;
    if (wa.startsWith('0')) return false;
    if (wa.length < 10 || wa.length > 15) return false;
    return true;
}

// ==========================================
// SORTING
// ==========================================
function sortMembers(members) {
    const rolePriority = { 'leader': 1, 'co-lead': 2, 'member': 3 };
    
    return [...members].sort((a, b) => {
        if (rolePriority[a.role] !== rolePriority[b.role]) {
            return rolePriority[a.role] - rolePriority[b.role];
        }
        return a.ign.localeCompare(b.ign);
    });
}

// ==========================================
// CEK APAKAH MEMBER SUDAH JADI ADMIN
// ==========================================
function memberList_isAdmin(memberUid) {
    if (!memberUid) return false;
    return cachedAdminLinkedUids.includes(memberUid);
}

function memberList_isBendahara(memberUid) {
    if (!memberUid) return false;
    const adminEntry = cachedAdminLinkedData.find(a => a.linkedUid === memberUid);
    if (!adminEntry) return false;
    return adminEntry.role2 === 'bendahara';
}

function memberList_isCoLead(memberUid) {
    if (!memberUid) return false;
    const adminEntry = cachedAdminLinkedData.find(a => a.linkedUid === memberUid);
    if (!adminEntry) return false;
    return adminEntry.role1 === 'co-lead';
}

// ==========================================
// 🎯 AMBIL NAMA ADMIN DARI MEMBER_LIST
// (bukan dari ADMIN_SETTINGS kolom B — single source of truth)
// ==========================================
function getAdminDisplayName(linkedUid, fallbackName = '') {
    if (!linkedUid) return fallbackName || '(tanpa nama)';
    const member = memberList.find(m => m.uid === linkedUid);
    if (member && member.ign) return member.ign;
    return fallbackName || '(tanpa nama)';
}

// ==========================================
// LOAD ADMIN LINKED UIDS
// ==========================================
async function loadAdminLinkedUids() {
    try {
        const url = `${window.GAS_ADMIN_URL}?action=getAdminList&adminId=${currentAdmin.id}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success' && data.data) {
            cachedAdminLinkedData = data.data
                .filter(a => a.linkedMemberUid && a.linkedMemberUid.trim() !== '')
                .map(a => ({
                    linkedUid: a.linkedMemberUid.trim(),
                    admId: a.id,
                    role1: a.role1 || '',
                    role2: a.role2 || '',
                    nama: a.nama || ''
                }));
            
            cachedAdminLinkedUids = cachedAdminLinkedData.map(a => a.linkedUid);
        }
    } catch(e) {
        console.error('loadAdminLinkedUids error:', e);
    }
}

// ==========================================
// 🎯 HELPER: Update State dari Snapshot Response
// (menghindari multiple GAS calls)
// ==========================================
function applySnapshot(snapshot) {
    if (!snapshot) return false;
    
    if (snapshot.members && Array.isArray(snapshot.members)) {
        memberList = sortMembers(snapshot.members);
        sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
    }
    
    if (snapshot.admins && Array.isArray(snapshot.admins)) {
        cachedAdminLinkedData = snapshot.admins
            .filter(a => a.linkedMemberUid && a.linkedMemberUid.trim() !== '')
            .map(a => ({
                linkedUid: a.linkedMemberUid.trim(),
                admId: a.id,
                role1: a.role1 || '',
                role2: a.role2 || '',
                nama: a.nama || ''
            }));
    }
    
    if (snapshot.linkedUids && Array.isArray(snapshot.linkedUids)) {
        cachedAdminLinkedUids = snapshot.linkedUids.slice();
    } else if (snapshot.admins) {
        cachedAdminLinkedUids = cachedAdminLinkedData.map(a => a.linkedUid);
    }
    
    renderMemberList(memberList);
    updateMissingWABadge(memberList);
    
    return true;
}

// ==========================================
// VALIDASI AKSES EDIT
// ==========================================
function canEditMember(admin, targetMember) {
    if (!admin || !targetMember) return false;
    
    const isLeader = admin.role1 === 'leader';
    const isCoLead = admin.role1 === 'co-lead';
    const isTargetSelf = targetMember.uid === admin.linkedMemberUid || targetMember.uid === admin.id;
    const isTargetLeader = targetMember.role === 'leader';
    const isTargetCoLead = targetMember.role === 'co-lead';
    
    if (isLeader) return true;
    
    if (isCoLead) {
        if (isTargetSelf) return false;
        if (isTargetLeader) return false;
        if (isTargetCoLead) return false;
        return true;
    }
    
    return false;
}

function canEditWA(admin, targetMember) {
    return canEditMember(admin, targetMember);
}

// ==========================================
// CEK WA DUPLIKAT
// ==========================================
function checkActiveWA(wa, excludeUID = '') {
    if (!wa) return null;
    const searchWA = wa.toString().trim();
    return memberList.find(m => {
        const memberWA = m.wa ? m.wa.toString().trim() : '';
        return memberWA === searchWA && m.uid !== excludeUID && m.status === 'aktif';
    }) || null;
}

// ==========================================
// LOAD MEMBER LIST
// ==========================================
async function loadMemberList(forceRefresh = false) {
    console.log("🟢 [MEMBER] loadMemberList dipanggil, forceRefresh:", forceRefresh);
    
    if (!currentAdmin) return;
    
    const container = document.getElementById('member-list-container');
    if (!container) return;
    
    const cached = sessionStorage.getItem('umbrella_cached_members');
    if (cached) {
        try {
            const data = JSON.parse(cached);
            memberList = data;
            
            loadAdminLinkedUids().then(() => {
                renderMemberList(memberList);
                updateMissingWABadge(memberList);
            });
            
            console.log("📦 [MEMBER] Render dari cache, jumlah:", memberList.length);
        } catch(e) {}
    }
    
    if (!cached) {
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data member...</div>';
    }
    
    try {
        const res = await fetch(window.GAS_ADMIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'getAllMembers',
                adminId: currentAdmin.id
            })
        });
        const result = await res.json();
        
        if (result.status === 'success' && result.data) {
            memberList = sortMembers(result.data);
            sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
            
            await loadAdminLinkedUids();
            
            renderMemberList(memberList);
            updateMissingWABadge(memberList);
            initSearchListener();
            console.log("✅ [MEMBER] Load sukses, jumlah:", memberList.length);
        } else if (!cached) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data member</div>';
        }
    } catch(e) {
        console.error("🔴 [MEMBER] Fetch error:", e);
        if (!cached) {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal koneksi</div>';
        }
    }
}

// ==========================================
// RENDER MEMBER LIST
// ==========================================
function renderMemberList(members) {
    const container = document.getElementById('member-list-container');
    if (!container) return;
    
    if (!members || members.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 Tidak ada member aktif</div>';
        return;
    }
    
    const sortedMembers = sortMembers(members);
    
    let html = '';
    for (const member of sortedMembers) {
        const hasWA = member.wa 
            ? `<i class="fab fa-whatsapp"></i> ${escapeHtml(member.wa)}` 
            : '<span class="no-wa"><i class="fas fa-exclamation-triangle"></i> WA belum diisi</span>';
        
        const isVerified = member.webUID && member.webUID.trim() !== '';
        const memberIsAdmin = memberList_isAdmin(member.uid);
        const memberIsBendahara = memberList_isBendahara(member.uid);
        const memberIsCoLead = memberList_isCoLead(member.uid);
        
        const verifiedBadge = isVerified 
            ? `<i class="fas fa-check-circle badge-verified" title="Akun Web Terkait"></i>` 
            : '';
        
        const memberIsBendaharaOnly = memberIsAdmin && !memberIsCoLead && !member.role.includes('leader');
        const bendaharaBadge = memberIsBendaharaOnly 
            ? `<span class="badge-bendahara" title="Admin Bendahara (tanpa jabatan struktural)">BENDAHARA</span>` 
            : '';
        const activationStatus = member.activationStatus;
        const activationBadge = (activationStatus?.hasCode && !activationStatus?.used && !activationStatus?.expired)
            ? `<span class="badge-activation" title="Punya kode aktivasi aktif">🔑</span>` 
            : '';
        
        let actionButtons = '';
        
        if (canEditMember(currentAdmin, member)) {
            actionButtons += `
                <button class="btn-icon" onclick="editMember('${escapeHtml(member.uid)}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }
        
        if (currentAdmin?.role1 === 'leader') {
            const isSelf = member.uid === currentAdmin.linkedMemberUid;
            if (!isSelf) {
                actionButtons += `
                    <button class="btn-icon btn-icon-warning" onclick="openPromoteAdminModal('${escapeHtml(member.uid)}', '${escapeHtml(member.ign)}')" title="${memberIsAdmin ? 'Ubah Jabatan' : 'Angkat jadi Admin'}">
                        <i class="fas fa-crown"></i>
                    </button>
                `;
            } else {
                actionButtons += `
                    <button class="btn-icon btn-icon-warning" onclick="openTransferLeadershipModal()" title="Serah Jabatan LEADER">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                `;
            }
        }
        
        if (!actionButtons) {
            actionButtons = '<span style="font-size:0.7rem; color:var(--text-muted); padding:6px;">—</span>';
        }
        
        html += `
            <div class="member-row" data-uid="${escapeHtml(member.uid)}">
                <div class="member-info">
                    <div class="member-ign">
                        <strong>${escapeHtml(member.ign)}</strong>
                        <span class="member-role ${member.role}">${member.role.toUpperCase()}</span>
                        ${verifiedBadge}
                        ${bendaharaBadge}
                        ${activationBadge}
                    </div>
                    <div class="member-contact">
                        ${hasWA}
                    </div>
                </div>
                <div class="member-actions">
                    ${actionButtons}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==========================================
// GENERATE KODE VERIFIKASI
// ==========================================
async function generateVerifCode(uid) {
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    if (!canEditMember(currentAdmin, member)) {
        window.showToast("❌ Anda tidak memiliki izin", true);
        return;
    }
    
    if (!member.wa) {
        window.showToast("Member belum punya nomor WA", true);
        return;
    }
    
    window.showToast("⏳ Membuat kode...");
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=generateVerifCode&adminId=${currentAdmin.id}&uid=${encodeURIComponent(uid)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            renderVerifCodeModal({
                mode: 'generate',
                code: data.code,
                ign: data.ign,
                wa: data.wa,
                uid: uid
            });
        } else {
            window.showToast("❌ " + (data.message || "Gagal"), true);
        }
    } catch(e) {
        console.error("Generate verif code error:", e);
        window.showToast("❌ Koneksi gagal", true);
    }
}

async function showVerifCode(uid) {
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    if (!canEditMember(currentAdmin, member)) {
        window.showToast("❌ Anda tidak memiliki izin", true);
        return;
    }
    
    if (!member.wa) {
        window.showToast("Member belum punya nomor WA", true);
        return;
    }
    
    window.showToast("⏳ Memuat kode...");
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=generateVerifCode&adminId=${currentAdmin.id}&uid=${encodeURIComponent(uid)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            renderVerifCodeModal({
                mode: 'view',
                code: data.code,
                ign: data.ign,
                wa: data.wa,
                uid: uid,
                webUID: data.webUID
            });
        } else {
            window.showToast("❌ " + (data.message || "Gagal"), true);
        }
    } catch(e) {
        console.error("Show verif code error:", e);
        window.showToast("❌ Koneksi gagal", true);
    }
}

function renderVerifCodeModal(data) {
    const isViewMode = data.mode === 'view';
    const title = isViewMode ? '🔑 Kode Verifikasi' : '🎉 Kode Berhasil Dibuat';
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            
            <h3 style="text-align:center; margin-bottom:20px;">${title}</h3>
            
            <div class="verif-info">
                <div class="verif-row">
                    <span class="verif-label">Member:</span>
                    <span class="verif-value"><strong>${escapeHtml(data.ign)}</strong></span>
                </div>
                <div class="verif-row">
                    <span class="verif-label">WA:</span>
                    <span class="verif-value">${escapeHtml(data.wa)}</span>
                </div>
            </div>
            
            <div class="verif-code-box">
                <div class="verif-code-label">Kode Verifikasi</div>
                <div class="verif-code" id="verif-code-value">${escapeHtml(data.code)}</div>
                <button class="btn-copy-code" onclick="copyVerifCode('${escapeHtml(data.code)}')">
                    <i class="fas fa-copy"></i> Copy Kode
                </button>
            </div>
            
            <p class="verif-hint">
                ${isViewMode 
                    ? '💡 Kode ini bisa dipakai member untuk login di device baru.' 
                    : '⚠️ Berikan kode ini ke member via DM. Kode hanya untuk member ini.'}
            </p>
            
            <div class="modal-buttons" style="margin-top: 16px;">
                <button onclick="window.closeModal()" style="background:#333;">Tutup</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    if (typeof pushView === 'function') {
        pushView('verif-code', data);
    }
}

function copyVerifCode(code) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code)
            .then(() => {
                window.showToast("✅ Kode dicopy");
            })
            .catch(err => {
                console.error('Copy error:', err);
                fallbackCopyVerifCode(code);
            });
    } else {
        fallbackCopyVerifCode(code);
    }
}

function fallbackCopyVerifCode(code) {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        window.showToast("✅ Kode dicopy");
    } catch(e) {
        window.showToast("❌ Gagal copy", true);
    }
    document.body.removeChild(textarea);
}

// ==========================================
// UPDATE BADGE MEMBER TANPA WA
// ==========================================
function updateMissingWABadge(members) {
    const missingWA = members.filter(m => !m.wa || m.wa === '');
    const warningDiv = document.getElementById('member-warning');
    
    if (missingWA.length > 0) {
        if (warningDiv) {
            warningDiv.innerHTML = `
                <span class="warning-text">⚠️ Ada ${missingWA.length} member yang belum mengisi nomor WhatsApp.</span>
                <button class="btn-small" onclick="filterMissingWA()">Tampilkan</button>
            `;
            warningDiv.style.display = 'flex';
        }
    } else {
        if (warningDiv) warningDiv.style.display = 'none';
    }
}

// ==========================================
// FILTER MEMBER TANPA WA
// ==========================================
function filterMissingWA() {
    const missingWA = memberList.filter(m => !m.wa || m.wa === '');
    renderMemberList(missingWA);
    
    if (!document.querySelector('.filter-back')) {
        const container = document.getElementById('member-list-container');
        const backBtn = document.createElement('div');
        backBtn.className = 'filter-back';
        backBtn.innerHTML = '<button class="btn-small" onclick="showAllMembers()">← Kembali ke semua member</button>';
        container.parentNode.insertBefore(backBtn, container.nextSibling);
    }
}

function showAllMembers() {
    const backBtn = document.querySelector('.filter-back');
    if (backBtn) backBtn.remove();
    renderMemberList(memberList);
}

// ==========================================
// SEARCH
// ==========================================
let searchTimeout = null;

function initSearchListener() {
    const searchInput = document.getElementById('member-search-input');
    if (!searchInput) return;
    
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', function(e) {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value.trim());
        }, 300);
    });
}

function performSearch(query) {
    if (!query) {
        renderMemberList(memberList);
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = memberList.filter(m => 
        m.ign.toLowerCase().includes(lowerQuery) || 
        (m.wa && m.wa.toString().includes(query))
    );
    
    renderMemberList(filtered);
}

// ==========================================
// ADD MEMBER
// ==========================================
function openAddMemberModal() {
    renderAddMemberInternal();
    if (typeof pushView === 'function') {
        pushView('member-add');
    }
}

function renderAddMemberInternal() {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-user-plus"></i> Tambah Member Baru</h3>
            <div class="form-group">
                <label>IGN <span style="color:#ff4444;">*</span></label>
                <input type="text" id="add-ign" placeholder="Nama IGN" autocomplete="off">
            </div>
            <div class="form-group">
                <label>WhatsApp</label>
                <input type="text" id="add-wa" placeholder="628123456789" autocomplete="off">
                <small>Contoh: 628123456789 (tanpa 0, tanpa +62)</small>
            </div>
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitAddMember()" style="background:var(--color-primary);">Tambah</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        document.getElementById('add-ign')?.focus();
    }, 200);
}

async function submitAddMember() {
    const ign = document.getElementById('add-ign')?.value.trim();
    let wa = document.getElementById('add-wa')?.value.trim() || '';
    
    if (!ign) {
        window.showToast("IGN harus diisi", true);
        return;
    }
    
    wa = sanitizeWA(wa);
    
    if (wa && !isValidWA(wa)) {
        window.showToast("❌ Format WA salah! Tidak boleh diawali 0.", true);
        return;
    }
    
    if (wa) {
        const existing = checkActiveWA(wa);
        if (existing) {
            window.showToast(`❌ WA "${wa}" sudah terdaftar sebagai "${existing.ign}"`, true);
            return;
        }
    }
    
    const modalContent = document.querySelector('#modal-overlay .modal-content');
    const btn = modalContent?.querySelector('button:first-of-type');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;
    }
    
    try {
        const res = await fetch(window.GAS_ADMIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'addOrReactivateMember',
                adminId: currentAdmin.id,
                ign: ign,
                wa: wa
            })
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            
            if (result.data) {
                const existingIndex = memberList.findIndex(m => m.uid === result.data.uid);
                if (existingIndex >= 0) {
                    memberList[existingIndex] = result.data;
                } else {
                    memberList.push(result.data);
                }
                memberList = sortMembers(memberList);
                sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
                renderMemberList(memberList);
                updateMissingWABadge(memberList);
            } else {
                await loadMemberList(true);
            }
        } else {
            if (result.action === 'scammer') {
                closeModal();
                showAlertModal('SCAMMER DETEKSI', result.message, 'scammer');
            } else {
                window.showToast(result.message || "Gagal", true);
            }
        }
    } catch(e) {
        console.error("Add member error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

// ==========================================
// EDIT MEMBER
// ==========================================
async function editMember(uid) {
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    const isLeader = currentAdmin?.role1 === 'leader';
    const isCoLead = currentAdmin?.role1 === 'co-lead';
    const isTargetSelf = uid === currentAdmin?.linkedMemberUid;
    const isTargetLeader = member.role === 'leader';
    const isTargetCoLead = member.role === 'co-lead';
    
    if (!isLeader && !isCoLead) {
        window.showToast("❌ Anda tidak memiliki izin untuk mengedit member!", true);
        return;
    }
    
    if (isCoLead) {
        if (isTargetSelf) {
            window.showToast("❌ Anda tidak bisa mengedit diri sendiri sebagai CO-LEAD!", true);
            return;
        }
        if (isTargetLeader) {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit LEADER!", true);
            return;
        }
        if (isTargetCoLead) {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit CO-LEAD lain!", true);
            return;
        }
    }
    
    renderEditMemberInternal(member);
    if (typeof pushView === 'function') {
        pushView('member-edit', { member: member });
    }
}

function renderEditMemberInternal(member) {
    const uid = member.uid;
    
    const isLeader = currentAdmin?.role1 === 'leader';
    const isCoLead = currentAdmin?.role1 === 'co-lead';
    const isTargetLeader = member?.role === 'leader';
    const isTargetCoLead = member?.role === 'co-lead';
    const isTargetSelf = member?.uid === currentAdmin?.linkedMemberUid;
    
    if (isCoLead && isTargetLeader) {
        window.showToast("❌ Anda tidak memiliki izin untuk mengedit LEADER!", true);
        return;
    }
    if (isCoLead && isTargetCoLead) {
        if (isTargetSelf) {
            window.showToast("❌ Anda tidak bisa mengedit diri sendiri!", true);
        } else {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit CO-LEAD lain!", true);
        }
        return;
    }
    if (!isLeader && !isCoLead) {
        window.showToast("❌ Anda tidak memiliki izin!", true);
        return;
    }
    
    // 🎯 FIX BUG #1: Leader bisa edit IGN & WA sendiri
    // Tapi role & status tetap readonly untuk diri sendiri
    const canEditIGNWA = isLeader || (isCoLead && !isTargetSelf && !isTargetLeader && !isTargetCoLead);
    const canEditStatus = isLeader ? !isTargetSelf : (isCoLead && !isTargetSelf && !isTargetLeader && !isTargetCoLead);
    
    const roleDisplay = member.role.toUpperCase();
    const roleOptions = `
        <input type="text" 
               id="edit-role" 
               value="${roleDisplay}" 
               readonly 
               disabled 
               style="width:100%; padding:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white; opacity:0.6;">
        <small style="display:block; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">
            ✏️ Role diatur via tombol 👑 (khusus LEADER)
        </small>
    `;
    
    let statusOptions = '';
    if (canEditStatus) {
        statusOptions = `
            <select id="edit-status" style="width:100%; padding:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <option value="aktif" ${member.status === 'aktif' ? 'selected' : ''}>✅ Aktif</option>
                <option value="nonaktif" ${member.status === 'nonaktif' ? 'selected' : ''}>⚪ Nonaktif</option>
                <option value="scammer" ${member.status === 'scammer' ? 'selected' : ''}>🔴 Scammer</option>
            </select>
        `;
    } else {
        statusOptions = `
            <input type="text" id="edit-status" value="${member.status.toUpperCase()}" readonly disabled
                   style="width:100%; padding:10px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white; opacity:0.6;">
            <small style="display:block; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">
                ⚠️ Tidak bisa mengubah status diri sendiri
            </small>
        `;
    }
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-user-edit"></i> Edit Member</h3>
            
            ${isCoLead && isTargetSelf ? `
                <div style="background:rgba(255,68,68,0.15); border:1px solid #ff4444; border-radius:8px; padding:10px; margin-bottom:15px; color:#ff6b6b; font-size:0.8rem;">
                    ⚠️ Anda CO-LEAD. Hubungi LEADER untuk mengubah data Anda.
                </div>
            ` : ''}
            
            ${isCoLead && isTargetCoLead && !isTargetSelf ? `
                <div style="background:rgba(255,68,68,0.15); border:1px solid #ff4444; border-radius:8px; padding:10px; margin-bottom:15px; color:#ff6b6b; font-size:0.8rem;">
                    ⚠️ Anda tidak memiliki izin untuk mengedit CO-LEAD lain!
                </div>
            ` : ''}
            
            ${isCoLead && isTargetLeader ? `
                <div style="background:rgba(255,68,68,0.15); border:1px solid #ff4444; border-radius:8px; padding:10px; margin-bottom:15px; color:#ff6b6b; font-size:0.8rem;">
                    ⚠️ Anda tidak memiliki izin untuk mengedit LEADER!
                </div>
            ` : ''}
            
            <div class="form-group" style="margin-bottom:16px;">
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">IGN <span style="color:#ff4444;">*</span></label>
                <input type="text" id="edit-ign" value="${escapeHtml(member.ign)}" placeholder="Nama IGN"
                       ${!canEditIGNWA ? 'disabled style="opacity:0.6;cursor:not-allowed;width:100%;padding:10px;background:var(--bg-dark);border:1px solid var(--border-line);border-radius:8px;color:white;"' : 'style="width:100%;padding:10px;background:var(--bg-dark);border:1px solid var(--border-line);border-radius:8px;color:white;"'}>
            </div>
            
            <div class="form-group" style="margin-bottom:16px;">
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">WhatsApp</label>
                <input type="text" id="edit-wa" value="${escapeHtml(member.wa)}" placeholder="628123456789"
                       ${!canEditIGNWA ? 'disabled style="opacity:0.6;cursor:not-allowed;width:100%;padding:10px;background:var(--bg-dark);border:1px solid var(--border-line);border-radius:8px;color:white;"' : 'style="width:100%;padding:10px;background:var(--bg-dark);border:1px solid var(--border-line);border-radius:8px;color:white;"'}>
            </div>
            
            <div class="form-group" style="margin-bottom:16px;">
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">Role</label>
                ${roleOptions}
            </div>
            
            <div class="form-group" style="margin-bottom:16px;">
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">Status</label>
                ${statusOptions}
            </div>
            
            ${canEditIGNWA ? `
            <div style="border-top: 1px solid var(--border-line); padding-top: 16px; margin-top: 16px;">
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">
                    ✅ VERIFIKASI AKUN
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.generateActivationCode('${escapeHtml(member.uid)}', '${escapeHtml(member.ign)}')" 
                            style="flex: 1; background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; border-radius: 8px; padding: 10px; color: #4ade80; cursor: pointer; font-size: 0.75rem; font-weight: bold;">
                        <i class="fas fa-check-circle"></i> Generate Kode Verifikasi
                    </button>
                    ${member.activationStatus?.hasCode && !member.activationStatus?.used ? `
                    <button onclick="window.revokeActivationCode('${escapeHtml(member.uid)}', '${escapeHtml(member.ign)}')" 
                            style="flex: 1; background: rgba(255, 68, 68, 0.2); border: 1px solid #ff4444; border-radius: 8px; padding: 10px; color: #ff8888; cursor: pointer; font-size: 0.75rem;">
                        <i class="fas fa-trash"></i> Revoke
                    </button>
                    ` : ''}
                </div>
                ${member.activationStatus?.hasCode ? `
                <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 8px; padding: 6px 8px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                    ${member.activationStatus.used 
                        ? '✅ Sudah dipakai' 
                        : member.activationStatus.expired 
                            ? '⏰ Kode expired' 
                            : `⏰ Aktif hingga: ${new Date(member.activationStatus.expiredAt).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}`
                    }
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitEditMember('${escapeHtml(member.uid)}')" 
                        style="background:var(--color-primary);">
                    Simpan
                </button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

// ==========================================
// SUBMIT EDIT MEMBER
// ==========================================
async function submitEditMember(uid) {
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    const isLeader = currentAdmin?.role1 === 'leader';
    const isCoLead = currentAdmin?.role1 === 'co-lead';
    const isTargetSelf = uid === currentAdmin?.linkedMemberUid;
    const isTargetLeader = member.role === 'leader';
    const isTargetCoLead = member.role === 'co-lead';
    
    if (isCoLead) {
        if (isTargetSelf) {
            window.showToast("❌ Anda tidak bisa mengedit diri sendiri!", true);
            return;
        }
        if (isTargetLeader) {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit LEADER!", true);
            return;
        }
        if (isTargetCoLead) {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit CO-LEAD lain!", true);
            return;
        }
    }
    
    if (!isLeader && !isCoLead) {
        window.showToast("❌ Anda tidak memiliki izin!", true);
        return;
    }
    
    const newIGN = document.getElementById('edit-ign')?.value.trim();
    let newWA = document.getElementById('edit-wa')?.value.trim() || '';
    
    // 🎯 FIX BUG: Cek apakah field status EDITABLE
    // Kalau disabled (self-edit leader/co-lead), anggap status tidak diubah
    const statusEl = document.getElementById('edit-status');
    const statusIsEditable = statusEl && !statusEl.disabled;
    const newStatus = statusIsEditable ? statusEl.value : null;
    
    if (!newIGN) {
        window.showToast("IGN harus diisi", true);
        return;
    }
    
    if (newWA) {
        newWA = sanitizeWA(newWA);
        if (!isValidWA(newWA)) {
            window.showToast("❌ Format WA salah! Tidak boleh diawali 0.", true);
            return;
        }
        
        const existing = checkActiveWA(newWA, uid);
        if (existing) {
            window.showToast(`❌ WA "${newWA}" sudah terdaftar sebagai "${existing.ign}"`, true);
            return;
        }
    }
    
    const finalRole = member.role;
    
    // 🎯 FIX BUG: Validasi status HANYA kalau status memang editable + berubah
    let finalStatus = member.status;
    if (newStatus && newStatus !== member.status) {
        if (isLeader && !isTargetSelf) {
            finalStatus = newStatus;
        } else if (isCoLead && !isTargetSelf && !isTargetLeader && !isTargetCoLead) {
            finalStatus = newStatus;
        } else {
            window.showToast("❌ Tidak bisa mengubah status member ini!", true);
            return;
        }
    }
    
    const modalContent = document.querySelector('#modal-overlay .modal-content');
    const btn = modalContent?.querySelector('button:first-of-type');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;
    }
    
    try {
        const res = await fetch(window.GAS_ADMIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateMemberWithMerge',
                adminId: currentAdmin.id,
                uid: uid,
                ign: newIGN,
                wa: newWA,
                role: finalRole,
                status: finalStatus
            })
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            
            if (result.data) {
                if (result.data.status !== 'aktif') {
                    const index = memberList.findIndex(m => m.uid === result.data.uid);
                    if (index >= 0) {
                        memberList.splice(index, 1);
                    }
                } else {
                    const existingIndex = memberList.findIndex(m => m.uid === result.data.uid);
                    if (existingIndex >= 0) {
                        memberList[existingIndex] = result.data;
                    } else {
                        memberList.push(result.data);
                    }
                }
                
                memberList = sortMembers(memberList);
                sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
                renderMemberList(memberList);
                updateMissingWABadge(memberList);
            } else {
                await loadMemberList(true);
            }
            
            // Refresh admin linked data (kalau nama admin berubah)
            if (isLeader && memberList_isAdmin(uid)) {
                await loadAdminLinkedUids();
            }
        } else {
            if (result.action === 'scammer') {
                closeModal();
                showAlertModal('SCAMMER DETEKSI', result.message, 'scammer');
            } else {
                window.showToast(result.message || "Gagal", true);
            }
        }
    } catch(e) {
        console.error("Edit member error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

// ==========================================
// MODAL PERINGATAN
// ==========================================
function showAlertModal(title, message, type = 'warning') {
    const modal = document.getElementById('modal-overlay');
    
    let icon = '⚠️';
    let color = '#f59e0b';
    if (type === 'scammer') {
        icon = '🔴';
        color = '#ff4444';
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px; text-align: center;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <div style="font-size: 3rem; margin-bottom: 10px;">${icon}</div>
            <h3 style="color: ${color}; margin-bottom: 15px;">${title}</h3>
            <p style="margin-bottom: 20px; color: var(--text-muted);">${message}</p>
            <div class="modal-buttons">
                <button onclick="window.closeModal()" style="background: ${color}; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer;">
                    Tutup
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

// ==========================================
// EXPORT MEMBER
// ==========================================
async function exportMemberList() {
    const membersToExport = memberList.filter(m => m.status === 'aktif' && m.wa && m.wa !== '');
    
    if (membersToExport.length === 0) {
        window.showToast("Tidak ada member yang memiliki WA", true);
        return;
    }
    
    const totalExport = membersToExport.length;
    const maxWALength = 13;
    
    let text = "#editmember\n";
    text += "傘 ᴜᴍʙʀᴇʟʟᴀ               " + totalExport + " ᴍᴇᴍʙᴇʀ\n\n";
    
    for (const member of membersToExport) {
        let wa = member.wa;
        wa = wa.padEnd(maxWALength, ' ');
        text += `\`\`\`${wa} |\`\`\` ${member.ign}\n`;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        window.showToast("✅ Daftar tersalin!");
    } catch(e) {
        console.error("Copy failed:", e);
        window.showToast("❌ Gagal menyalin", true);
    }
}

// ==========================================
// REFRESH
// ==========================================
async function refreshMemberList() {
    const btn = document.querySelector('.refresh-btn i');
    if (btn) btn.classList.add('fa-spin');
    await loadMemberList(true);
    if (btn) btn.classList.remove('fa-spin');
    window.showToast("✅ Data member diperbarui");
}

// ==========================================
// 🎯 MODAL: ANGKAT / UBAH JABATAN
// ==========================================
window.openPromoteAdminModal = async function(memberUid, memberIgn) {
    if (currentAdmin?.role1 !== 'leader') {
        window.showToast('❌ Hanya LEADER yang bisa mengangkat/mengubah jabatan', true);
        return;
    }
    
    if (memberUid === currentAdmin.linkedMemberUid) {
        window.showToast('❌ Tidak bisa mengubah jabatan diri sendiri', true);
        return;
    }
    
    const memberIsAdmin = memberList_isAdmin(memberUid);
    
    let adminData = null;
    if (memberIsAdmin) {
        try {
            const url = `${window.GAS_ADMIN_URL}?action=getAdminList&adminId=${currentAdmin.id}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success' && data.data) {
                adminData = data.data.find(a => a.linkedMemberUid === memberUid);
            }
        } catch(e) {
            console.error('Fetch admin data error:', e);
        }
    }
    
    const mode = memberIsAdmin ? 'edit' : 'promote';
    const title = mode === 'promote' ? 'Angkat jadi Admin' : 'Ubah Jabatan';
    
    const currentRole1 = adminData?.role1 || '';
    const currentRole2 = adminData?.role2 || '';
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3 style="text-align:center; margin-bottom:16px;">
                <i class="fas fa-crown"></i> ${title}
            </h3>
            
            <div class="verif-info" style="background:var(--bg-dark); border-radius:10px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span style="color:var(--text-muted);">Member:</span>
                    <strong style="color:white;">${escapeHtml(memberIgn)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span style="color:var(--text-muted);">UID:</span>
                    <span style="color:white; font-family:monospace; font-size:0.75rem;">${escapeHtml(memberUid)}</span>
                </div>
                ${mode === 'edit' ? `
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span style="color:var(--text-muted);">Admin ID:</span>
                    <span style="color:white; font-family:monospace; font-size:0.75rem;">${escapeHtml(adminData?.id || '-')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px solid rgba(255,255,255,0.05); margin-top:6px; padding-top:8px;">
                    <span style="color:var(--text-muted);">Saldo Kas:</span>
                    <strong id="promote-saldo-display" style="color:white;">Memuat...</strong>
                </div>
                ` : ''}
            </div>
            
            <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">
                JABATAN UTAMA (opsional)
            </label>
            <select id="promote-role1" style="width:100%; padding:10px; margin-bottom:12px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <option value="" ${!currentRole1 ? 'selected' : ''}>(Kosong — bukan jabatan struktural)</option>
                <option value="co-lead" ${currentRole1 === 'co-lead' ? 'selected' : ''}>CO-LEAD</option>
                ${currentRole1 === 'leader' ? `<option value="leader" selected disabled>LEADER (serah jabatan dulu)</option>` : ''}
            </select>
            ${currentRole1 === 'leader' ? `
                <small style="display:block; font-size:0.6rem; color:#f59e0b; margin-bottom:12px;">
                    ⚠️ LEADER tidak bisa di-set dari sini. Gunakan tombol ⇄ "Serah Jabatan".
                </small>
            ` : ''}
            
            <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">
                TUGAS TAMBAHAN (opsional)
            </label>
            <select id="promote-role2" style="width:100%; padding:10px; margin-bottom:16px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                <option value="" ${!currentRole2 ? 'selected' : ''}>(Tidak ada)</option>
                <option value="bendahara" ${currentRole2 === 'bendahara' ? 'selected' : ''}>BENDAHARA</option>
            </select>
            
            <div id="promote-info" style="background:rgba(168,85,247,0.1); border:1px solid var(--color-primary); border-radius:8px; padding:10px 12px; font-size:0.7rem; color:var(--text-muted); margin-bottom:16px; line-height:1.5;">
                ${mode === 'edit' 
                    ? `💡 <strong>Ubah jabatan:</strong> pilih role.<br>⚠️ <strong>Hapus admin:</strong> kosongkan semua role (saldo kas harus 0).`
                    : `💡 Pilih minimal 1 role. Role <strong>CO-LEAD</strong> disinkron ke MEMBER_LIST. Bendahara tidak disinkron.`}
            </div>
            
            ${mode === 'promote' ? `
            <p style="font-size:0.7rem; color:#ff8888; text-align:center; margin-bottom:12px;">
                ⚠️ Passkey akan di-generate & ditampilkan setelah proses.
            </p>
            ` : ''}
            
            <div class="modal-buttons" style="margin-bottom:10px;">
                <button onclick="submitPromoteAdmin('${escapeHtml(memberUid)}', '${mode}', '${adminData?.id || ''}')" style="background:var(--color-primary); flex:2;">
                    <i class="fas fa-crown"></i> ${mode === 'promote' ? 'ANGKAT' : 'SIMPAN'}
                </button>
                <button onclick="window.closeModal()" style="background:#333; flex:1;">Batal</button>
            </div>
            
            ${mode === 'edit' ? `
            <div style="border-top:1px solid var(--border-line); padding-top:12px;">
                <button onclick="handleResetPasskey('${escapeHtml(adminData?.id || '')}', '${escapeHtml(memberIgn)}')" 
                        style="width:100%; background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:10px; padding:10px; color:#f59e0b; cursor:pointer; font-size:0.8rem; font-weight:bold;">
                    <i class="fas fa-key"></i> Reset Passkey (Random)
                </button>
            </div>
            ` : ''}
        </div>
    `;
    modal.style.display = 'flex';
    
    if (typeof pushView === 'function') {
        pushView('promote-admin', { memberUid, memberIgn, mode });
    }
    
    if (mode === 'edit' && adminData) {
        try {
            const kasUrl = `${window.GAS_ADMIN_URL}?action=getKasFullData&adminId=${currentAdmin.id}`;
            const kasRes = await fetch(kasUrl);
            const kasData = await kasRes.json();
            
            const saldoEl = document.getElementById('promote-saldo-display');
            if (saldoEl && kasData.status === 'success' && kasData.data.saldo) {
                const saldo = kasData.data.saldo[adminData.id] || 0;
                const saldoFormatted = new Intl.NumberFormat('id-ID').format(saldo) + ' S';
                saldoEl.innerText = saldoFormatted;
                saldoEl.style.color = saldo > 0 ? '#f59e0b' : '#4ade80';
            } else if (saldoEl) {
                saldoEl.innerText = '(error)';
            }
        } catch(e) {
            console.error('Fetch saldo error:', e);
            const saldoEl = document.getElementById('promote-saldo-display');
            if (saldoEl) saldoEl.innerText = '(error)';
        }
    }
};

// ==========================================
// SUBMIT PROMOTE / EDIT ADMIN
// ==========================================
window.submitPromoteAdmin = async function(memberUid, mode = 'promote', adminIdToEdit = '') {
    if (currentAdmin?.role1 !== 'leader') {
        window.showToast('❌ Hanya LEADER yang bisa', true);
        return;
    }
    
    const role1 = document.getElementById('promote-role1')?.value || '';
    const role2 = document.getElementById('promote-role2')?.value || '';
    
    if (role1 === 'leader') {
        window.showToast('❌ Tidak bisa set LEADER dari form ini. Gunakan "Serah Jabatan".', true);
        return;
    }
    
    if (!role1 && !role2 && mode === 'promote') {
        window.showToast('❌ Pilih minimal 1 role', true);
        return;
    }
    
    const btn = document.querySelector('#modal-overlay .modal-buttons button:first-child');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        if (mode === 'promote') {
            const url = `${window.GAS_ADMIN_URL}?action=promoteMemberToAdmin&adminId=${currentAdmin.id}&memberUid=${encodeURIComponent(memberUid)}&role1=${encodeURIComponent(role1)}&role2=${encodeURIComponent(role2)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success') {
                window.closeModal();
                
                setTimeout(() => {
                    // Ambil memberIgn dari memberList (sebelum state di-update)
                    const memberData = memberList.find(m => m.uid === memberUid);
                    const memberIgn = memberData ? memberData.ign : '';
                    renderPromoteSuccessModal(data.data, memberIgn);
                }, 200);
                
                // 🎯 Update state dari snapshot (tanpa fetch ulang)
                if (data.snapshot) {
                    applySnapshot(data.snapshot);
                } else {
                    // Fallback: fetch manual (kalau GAS 4 lama)
                    await loadAdminLinkedUids();
                    await loadMemberList(true);
                }
            } else {
                window.showToast('❌ ' + (data.message || 'Gagal'), true);
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        } else {
            // ==========================================
            // FIX BUG: SELALU UPDATE role1 DAN role2
            // ==========================================
            const willDeleteAdmin = (!role1 && !role2);
            
            if (willDeleteAdmin) {
                if (!confirm(`⚠️ Semua jabatan dikosongkan.\n\nAdmin ini akan DIHAPUS dari sistem.\n\nLanjutkan?`)) {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                    return;
                }
            }
            
            // STEP 1: Update role1
            const resRole1 = await fetch(`${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${currentAdmin.id}&targetAdminId=${adminIdToEdit}&field=role1&value=${encodeURIComponent(role1)}`);
            const dataRole1 = await resRole1.json();
            
            if (dataRole1.status !== 'success' && !willDeleteAdmin) {
                window.showToast('❌ ' + (dataRole1.message || 'Gagal update role1'), true);
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return;
            }
            
            // STEP 2: SELALU update role2
            const resRole2 = await fetch(`${window.GAS_ADMIN_URL}?action=updateAdmin&adminId=${currentAdmin.id}&targetAdminId=${adminIdToEdit}&field=role2&value=${encodeURIComponent(role2)}`);
            const dataRole2 = await resRole2.json();
            
            if (dataRole2.status !== 'success') {
                window.showToast('❌ ' + (dataRole2.message || 'Gagal update role2'), true);
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return;
            }
            
            // 🎯 Cek hasil
            if (willDeleteAdmin) {
                if (dataRole1.message && dataRole1.message.includes('dihapus')) {
                    window.showToast('✅ Admin berhasil dihapus');
                } else if (dataRole2.message && dataRole2.message.includes('dihapus')) {
                    window.showToast('✅ Admin berhasil dihapus');
                } else {
                    window.showToast('✅ Jabatan dikosongkan');
                }
            } else {
                await syncMemberRoleFromAdmin(memberUid, role1);
                window.showToast('✅ Jabatan berhasil diperbarui');
            }
            
            window.closeModal();
            
            // 🎯 Update state dari snapshot response (yang terakhir = dataRole2)
            // Snapshot ada di response updateAdmin saat field=role2
            if (dataRole2.snapshot) {
                applySnapshot(dataRole2.snapshot);
            } else if (dataRole1.snapshot) {
                applySnapshot(dataRole1.snapshot);
            } else {
                // Fallback
                await loadAdminLinkedUids();
                await loadMemberList(true);
            }
        }
    } catch(e) {
        console.error('Submit promote error:', e);
        window.showToast('❌ Koneksi gagal', true);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

// ==========================================
// SYNC MEMBER ROLE DARI ADMIN
// ==========================================
async function syncMemberRoleFromAdmin(memberUid, role1) {
    let newRole = 'member';
    if (role1 === 'leader') newRole = 'leader';
    else if (role1 === 'co-lead') newRole = 'co-lead';
    
    try {
        await fetch(`${window.GAS_ADMIN_URL}?action=updateMemberRole&adminId=${currentAdmin.id}&uid=${encodeURIComponent(memberUid)}&role=${encodeURIComponent(newRole)}`);
    } catch(e) {
        console.error('Sync member role error:', e);
    }
}

// ==========================================
// MODAL SUKSES PROMOTE
// ==========================================
window.renderPromoteSuccessModal = function(data, memberIgn) {
    const { adminId, passkey, role1, role2, linkedMemberUid } = data;
    
    // 🎯 Pakai memberIgn (dari parameter) — bukan data.nama
    const displayName = memberIgn || getAdminDisplayName(linkedMemberUid, data.nama) || '(tanpa nama)';
    
    const roleParts = [];
    if (role1) roleParts.push(role1.toUpperCase());
    if (role2) roleParts.push(role2.toUpperCase());
    const roleText = roleParts.join(' + ') || '(no role)';
    
    const infoText = 
`Admin: ${displayName}
ID: ${adminId}
Passkey: ${passkey}
Role: ${roleText}
Login: https://umbrella-id.github.io/admin-dashboard`;
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            
            <h3 style="text-align:center; margin-bottom:16px; color:#4ade80;">
                <i class="fas fa-check-circle"></i> Berhasil
            </h3>
            
            <p style="font-size:0.8rem; text-align:center; color:var(--text-muted); margin-bottom:16px;">
                <strong>${escapeHtml(displayName)}</strong> telah diangkat menjadi admin
            </p>
            
            <div class="verif-info" style="background:var(--bg-dark); border-radius:10px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="color:var(--text-muted); font-size:0.75rem;">Admin ID:</span>
                    <strong style="color:white; font-family:monospace;">${escapeHtml(adminId)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="color:var(--text-muted); font-size:0.75rem;">Role:</span>
                    <strong style="color:white;">${escapeHtml(roleText)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span style="color:var(--text-muted); font-size:0.75rem;">Linked Member:</span>
                    <span style="color:white; font-family:monospace; font-size:0.75rem;">${escapeHtml(linkedMemberUid)}</span>
                </div>
            </div>
            
            <div style="background:rgba(74,222,128,0.1); border:1px solid #4ade80; border-radius:10px; padding:16px; margin-bottom:16px; text-align:center;">
                <div style="font-size:0.65rem; color:#4ade80; letter-spacing:1px; margin-bottom:8px;">PASSKEY</div>
                <code style="font-size:1.3rem; font-weight:bold; color:#4ade80; letter-spacing:2px; user-select:all; display:block; margin-bottom:12px;" id="promote-passkey-value">${escapeHtml(passkey)}</code>
                <button onclick="copyPromotePasskey('${escapeHtml(passkey)}')" 
                        style="background:var(--color-primary); color:white; border:none; border-radius:8px; padding:8px 20px; cursor:pointer; font-size:0.75rem;">
                    <i class="fas fa-copy"></i> Copy Passkey
                </button>
            </div>
            
            <p style="font-size:0.7rem; color:#ff8888; text-align:center; margin-bottom:16px;">
                ⚠️ Passkey ini hanya ditampilkan sekali. Catat & kirim ke admin yang bersangkutan.
            </p>
            
            <div class="modal-buttons">
                <button onclick="copyPromoteInfo(\`${escapeHtml(infoText)}\`)" style="background:var(--color-primary); flex:1;">
                    <i class="fas fa-clipboard"></i> Copy Info Lengkap
                </button>
                <button onclick="window.closeModal()" style="background:#333; flex:1;">Tutup</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    if (typeof pushView === 'function') {
        pushView('promote-success', { data });
    }
};

window.copyPromotePasskey = function(passkey) {
    navigator.clipboard.writeText(passkey).then(() => {
        window.showToast('✅ Passkey dicopy');
    }).catch(() => {
        window.showToast('❌ Gagal copy', true);
    });
};

window.copyPromoteInfo = function(infoText) {
    navigator.clipboard.writeText(infoText).then(() => {
        window.showToast('✅ Info lengkap dicopy');
    }).catch(() => {
        window.showToast('❌ Gagal copy', true);
    });
};

// ==========================================
// RESET PASSKEY (RANDOM)
// ==========================================
window.handleResetPasskey = async function(adminId, adminNama) {
    if (!adminId) {
        window.showToast('❌ Admin ID tidak valid', true);
        return;
    }
    
    if (currentAdmin?.role1 !== 'leader') {
        window.showToast('❌ Hanya LEADER yang bisa reset passkey', true);
        return;
    }
    
    const konfirmasi = confirm(`⚠️ Reset passkey untuk admin:\n\nNama: ${adminNama}\nID: ${adminId}\n\nPasskey baru akan di-generate otomatis (random).\n\nLanjutkan?`);
    
    if (!konfirmasi) return;
    
    const newPasskey = generateRandomPasskey(8);
    
    window.showToast('⏳ Mereset passkey...');
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=resetPasskey&adminId=${currentAdmin.id}&targetAdminId=${encodeURIComponent(adminId)}&newKey=${encodeURIComponent(newPasskey)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast('✅ Passkey berhasil direset');
            
            setTimeout(() => {
                renderPasskeyResultModal(adminId, adminNama, data.newPasskey || newPasskey);
            }, 300);
        } else {
            window.showToast('❌ ' + (data.message || 'Gagal reset'), true);
        }
    } catch(e) {
        console.error('Reset passkey error:', e);
        window.showToast('❌ Gagal koneksi', true);
    }
};

// ==========================================
// GENERATE RANDOM PASSKEY
// ==========================================
function generateRandomPasskey(length = 8) {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ==========================================
// MODAL HASIL RESET PASSKEY
// ==========================================
function renderPasskeyResultModal(adminId, adminNama, newPasskey) {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            
            <h3 style="text-align:center; margin-bottom:16px; color:#4ade80;">
                <i class="fas fa-check-circle"></i> Passkey Direset
            </h3>
            
            <div class="verif-info" style="background:var(--bg-dark); border-radius:10px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span style="color:var(--text-muted);">Admin:</span>
                    <strong style="color:white;">${escapeHtml(adminNama)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span style="color:var(--text-muted);">Admin ID:</span>
                    <span style="color:white; font-family:monospace; font-size:0.75rem;">${escapeHtml(adminId)}</span>
                </div>
            </div>
            
            <div style="background:rgba(245,158,11,0.1); border:1px solid #f59e0b; border-radius:10px; padding:16px; margin-bottom:16px; text-align:center;">
                <div style="font-size:0.65rem; color:#f59e0b; letter-spacing:1px; margin-bottom:8px;">PASSKEY BARU</div>
                <code style="font-size:1.3rem; font-weight:bold; color:#f59e0b; letter-spacing:2px; user-select:all; display:block; margin-bottom:12px;" id="reset-passkey-value">${escapeHtml(newPasskey)}</code>
                <button onclick="copyResetPasskey('${escapeHtml(newPasskey)}')" 
                        style="background:var(--color-primary); color:white; border:none; border-radius:8px; padding:8px 20px; cursor:pointer; font-size:0.75rem;">
                    <i class="fas fa-copy"></i> Copy Passkey
                </button>
            </div>
            
            <p style="font-size:0.7rem; color:#ff8888; text-align:center; margin-bottom:16px;">
                ⚠️ Passkey ini hanya ditampilkan sekali. Catat & kirim ke admin yang bersangkutan.
            </p>
            
            <div class="modal-buttons">
                <button onclick="window.closeModal()" style="background:#333; flex:1;">Tutup</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    if (typeof pushView === 'function') {
        pushView('passkey-result', { adminId, adminNama, newPasskey });
    }
}

window.copyResetPasskey = function(passkey) {
    navigator.clipboard.writeText(passkey).then(() => {
        window.showToast('✅ Passkey dicopy');
    }).catch(() => {
        fallbackCopyVerifCode(passkey);
    });
};

// ==========================================
// MODAL: SERAH JABATAN LEADER
// ==========================================
window.openTransferLeadershipModal = async function() {
    if (currentAdmin?.role1 !== 'leader') {
        window.showToast('❌ Hanya LEADER yang bisa serah jabatan', true);
        return;
    }
    
    window.showToast('⏳ Memuat list CO-LEAD...');
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=getAdminList&adminId=${currentAdmin.id}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status !== 'success' || !data.data) {
            window.showToast('❌ Gagal memuat list CO-LEAD', true);
            return;
        }
        
        const coLeads = data.data.filter(a => 
            a.role1 === 'co-lead' && a.id !== currentAdmin.id
        );
        
        if (coLeads.length === 0) {
            window.showToast('❌ Tidak ada CO-LEAD untuk diserahi jabatan', true);
            return;
        }
        
        const modal = document.getElementById('modal-overlay');
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <button class="modal-close-x" onclick="window.closeModal()">✕</button>
                <h3 style="text-align:center; margin-bottom:16px; color:#f59e0b;">
                    <i class="fas fa-exchange-alt"></i> Serah Jabatan LEADER
                </h3>
                
                <div style="background:rgba(245,158,11,0.1); border:1px solid #f59e0b; border-radius:8px; padding:10px 12px; margin-bottom:16px; font-size:0.75rem; color:#f59e0b; line-height:1.5;">
                    ⚠️ <strong>Perhatian:</strong><br>
                    • Jabatan LEADER Anda akan diserahkan ke CO-LEAD yang dipilih.<br>
                    • Anda akan otomatis menjadi <strong>CO-LEAD + BENDAHARA</strong>.<br>
                    • LEADER baru akan punya akses penuh (termasuk kas).
                </div>
                
                <div style="background:var(--bg-dark); border-radius:10px; padding:12px 16px; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; padding:6px 0;">
                        <span style="color:var(--text-muted); font-size:0.75rem;">LEADER Saat Ini:</span>
                        <strong style="color:white;">${escapeHtml(currentAdmin.nama)}</strong>
                    </div>
                </div>
                
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">
                    PILIH CO-LEAD PENERIMA JABATAN
                </label>
                <select id="transfer-target" style="width:100%; padding:10px; margin-bottom:16px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                    <option value="">-- Pilih CO-LEAD --</option>
                    ${coLeads.map(cl => `
                        <option value="${escapeHtml(cl.id)}">${escapeHtml(getAdminDisplayName(cl.linkedMemberUid, cl.nama))} (${escapeHtml(cl.id)})</option>
                    `).join('')}
                </select>
                
                <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:6px;">
                    KONFIRMASI PASSKEY ANDA
                </label>
                <input type="password" 
                       id="transfer-passkey" 
                       placeholder="Masukkan passkey Anda" 
                       style="width:100%; padding:10px; margin-bottom:16px; background:var(--bg-dark); border:1px solid var(--border-line); border-radius:8px; color:white;">
                
                <div class="modal-buttons">
                    <button onclick="submitTransferLeadership()" style="background:#f59e0b; color:white; flex:2;">
                        <i class="fas fa-crown"></i> SERAH JABATAN
                    </button>
                    <button onclick="window.closeModal()" style="background:#333; flex:1;">Batal</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        
        if (typeof pushView === 'function') {
            pushView('transfer-leadership');
        }
        
    } catch(e) {
        console.error('openTransferLeadershipModal error:', e);
        window.showToast('❌ Koneksi gagal', true);
    }
};

window.submitTransferLeadership = async function() {
    const targetAdminId = document.getElementById('transfer-target')?.value;
    const passkey = document.getElementById('transfer-passkey')?.value.trim();
    
    if (!targetAdminId) {
        window.showToast('❌ Pilih CO-LEAD penerima jabatan', true);
        return;
    }
    
    if (!passkey) {
        window.showToast('❌ Masukkan passkey Anda', true);
        return;
    }
    
    if (!confirm('⚠️ Konfirmasi: Serah jabatan LEADER?\n\nAnda akan turun menjadi CO-LEAD + BENDAHARA.')) {
        return;
    }
    
    const btn = document.querySelector('#modal-overlay .modal-buttons button:first-child');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=transferLeadership&adminId=${currentAdmin.id}&passkey=${encodeURIComponent(passkey)}&targetAdminId=${encodeURIComponent(targetAdminId)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast('✅ ' + data.message);
            window.closeModal();
            
            // 🎯 Snapshot tidak terlalu perlu karena akan reload halaman
            // (tapi tetap update state kalau ada)
            if (data.snapshot) {
                applySnapshot(data.snapshot);
            }
            
            setTimeout(() => {
                alert('Jabatan Anda telah berubah menjadi CO-LEAD + BENDAHARA.\n\nSilakan login ulang.');
                localStorage.removeItem('umbrella_admin_session');
                location.reload();
            }, 1500);
        } else {
            window.showToast('❌ ' + (data.message || 'Gagal'), true);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    } catch(e) {
        console.error('submitTransferLeadership error:', e);
        window.showToast('❌ Koneksi gagal', true);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

// ==========================================
// 🎯 GENERATE ACTIVATION CODE (Admin Panel)
// ==========================================
window.generateActivationCode = async function(memberUid, memberIgn) {
    if (currentAdmin?.role1 !== 'leader' && currentAdmin?.role1 !== 'co-lead') {
        window.showToast('❌ Hanya leader/co-lead yang bisa generate', true);
        return;
    }
    
    // Tampilkan modal loading dulu
    renderActivationCodeModal({
        code: null,
        uid: memberUid,
        ign: memberIgn,
        expired: null,
        isLoading: true
    });
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=generateActivationCode&adminId=${currentAdmin.id}&uid=${encodeURIComponent(memberUid)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            // Update modal dengan kode
            renderActivationCodeModal({
                code: data.code,
                uid: data.uid,
                ign: data.ign,
                expired: data.expired,
                isLoading: false
            });
        } else {
            // Gagal generate
            renderActivationCodeModal({
                code: null,
                uid: memberUid,
                ign: memberIgn,
                expired: null,
                isLoading: false,
                error: data.message || 'Gagal generate kode'
            });
        }
    } catch(e) {
        console.error('Generate activation code error:', e);
        renderActivationCodeModal({
            code: null,
            uid: memberUid,
            ign: memberIgn,
            expired: null,
            isLoading: false,
            error: 'Koneksi gagal'
        });
    }
};

// ==========================================
// 🎯 RENDER MODAL KODE AKTIVASI
// ==========================================
function renderActivationCodeModal({ code, uid, ign, expired, isLoading, error }) {
    const modal = document.getElementById('modal-overlay');
    if (!modal) return;
    
    let expiredStr = '-';
    if (expired) {
        const expiredDate = new Date(expired);
        expiredStr = expiredDate.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // === LOADING STATE ===
    if (isLoading) {
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 380px;">
                <button class="modal-close-x" onclick="window.closeModal()">✕</button>
                <h3 style="text-align: center; margin-bottom: 16px;">
                    🔑 Generate Kode Aktivasi
                </h3>
                <div style="text-align: center; padding: 30px 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #f59e0b;"></i>
                    <p style="margin-top: 12px; color: var(--text-muted); font-size: 0.8rem;">
                        Generating kode untuk <strong>${escapeHtml(ign)}</strong>...
                    </p>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        return;
    }
    
    // === ERROR STATE ===
    if (error) {
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 380px;">
                <button class="modal-close-x" onclick="window.closeModal()">✕</button>
                <h3 style="text-align: center; margin-bottom: 16px;">
                    ⚠️ Gagal Generate
                </h3>
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ff8888;"></i>
                    <p style="margin-top: 12px; color: #ff8888; font-size: 0.8rem;">
                        ${escapeHtml(error)}
                    </p>
                </div>
                <div class="modal-buttons" style="margin-top: 16px;">
                    <button onclick="window.closeModal()" style="background: #333;">Tutup</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        return;
    }
    
    // === SUCCESS STATE ===
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3 style="text-align: center; margin-bottom: 16px;">
                🔑 Kode Aktivasi
            </h3>
            
            <div style="background: var(--bg-dark); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.75rem;">
                    <span style="color: var(--text-muted);">Member:</span>
                    <strong style="color: white;">${escapeHtml(ign)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.75rem;">
                    <span style="color: var(--text-muted);">UID:</span>
                    <span style="color: white; font-family: monospace; font-size: 0.7rem;">${escapeHtml(uid)}</span>
                </div>
            </div>
            
            <div style="background: rgba(245, 158, 11, 0.1); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 16px;">
                <div style="font-size: 0.65rem; color: #f59e0b; letter-spacing: 1px; margin-bottom: 8px;">
                    KODE AKTIVASI
                </div>
                <code id="activation-code-value" style="font-size: 1.8rem; font-weight: bold; color: #f59e0b; letter-spacing: 4px; user-select: all; display: block; margin-bottom: 12px;">
                    ${escapeHtml(code)}
                </code>
                <button onclick="window.copyActivationCode('${escapeHtml(code)}')" 
                        style="background: var(--color-primary); color: white; border: none; border-radius: 8px; padding: 8px 20px; cursor: pointer; font-size: 0.75rem;">
                    <i class="fas fa-copy"></i> Copy Kode
                </button>
            </div>
            
            <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 10px 12px; font-size: 0.7rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
                ⏰ Expire: <strong style="color: #f59e0b;">${expiredStr}</strong><br>
                ⚠️ Kode hanya ditampilkan sekali. Kirim ke member via WA pribadi.
            </div>
            
            <div style="text-align: center; padding: 8px; color: #4ade80; font-size: 0.7rem;">
                ✅ Kode tersimpan di server
            </div>
            
            <div class="modal-buttons" style="margin-top: 16px;">
                <button onclick="window.closeModal()" style="background: #333;">Tutup</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    if (typeof pushView === 'function') {
        pushView('activation-code', { uid, ign });
    }
}

// ==========================================
// 🎯 COPY KODE AKTIVASI
// ==========================================
window.copyActivationCode = function(code) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
            window.showToast('✅ Kode dicopy');
        }).catch(() => {
            fallbackCopyActivationCode(code);
        });
    } else {
        fallbackCopyActivationCode(code);
    }
};

function fallbackCopyActivationCode(code) {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        window.showToast('✅ Kode dicopy');
    } catch(e) {
        window.showToast('❌ Gagal copy', true);
    }
    document.body.removeChild(textarea);
}

// ==========================================
// 🎯 REVOKE KODE AKTIVASI
// ==========================================
window.revokeActivationCode = async function(memberUid, memberIgn) {
    if (currentAdmin?.role1 !== 'leader' && currentAdmin?.role1 !== 'co-lead') {
        window.showToast('❌ Hanya leader/co-lead yang bisa revoke', true);
        return;
    }
    
    const confirmed = confirm(`Hapus kode aktivasi untuk ${memberIgn}?\n\nKode lama tidak akan bisa dipakai lagi.`);
    if (!confirmed) return;
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=revokeActivationCode&adminId=${currentAdmin.id}&uid=${encodeURIComponent(memberUid)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'success') {
            window.showToast('✅ Kode aktivasi dihapus');
            // Refresh member list untuk update status
            if (typeof window.loadMemberList === 'function') {
                window.loadMemberList(true);
            }
        } else {
            window.showToast('❌ ' + (data.message || 'Gagal'), true);
        }
    } catch(e) {
        console.error('Revoke activation code error:', e);
        window.showToast('❌ Koneksi gagal', true);
    }
};

// ==========================================
// EXPOSE
// ==========================================
window.loadMemberList = loadMemberList;
window.refreshMemberList = refreshMemberList;
window.openAddMemberModal = openAddMemberModal;
window.editMember = editMember;
window.submitEditMember = submitEditMember;
window.filterMissingWA = filterMissingWA;
window.showAllMembers = showAllMembers;
window.exportMemberList = exportMemberList;

window.generateVerifCode = generateVerifCode;
window.showVerifCode = showVerifCode;
window.renderVerifCodeModal = renderVerifCodeModal;
window.copyVerifCode = copyVerifCode;

window.renderAddMemberInternal = renderAddMemberInternal;
window.renderEditMemberInternal = renderEditMemberInternal;
window.memberList_isAdmin = memberList_isAdmin;
window.memberList_isBendahara = memberList_isBendahara;
window.getAdminDisplayName = getAdminDisplayName;

console.log("✅ admin-member.js loaded (V8 — Fix Bug #1 + Defensive Bug #2)");
