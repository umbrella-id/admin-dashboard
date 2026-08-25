/**
 * admin-member.js - Member Management Module
 * Hanya untuk LEADER & CO-LEAD
 * 
 * PERBAIKAN HIERARKI:
 * - CO-LEAD hanya bisa edit member biasa
 * - CO-LEAD TIDAK BISA edit LEADER
 * - CO-LEAD TIDAK BISA edit CO-LEAD (termasuk dirinya sendiri)
 * - Hanya LEADER yang bisa mengedit CO-LEAD & LEADER
 */

let memberList = [];

// ==========================================
// VALIDASI WA
// ==========================================
function sanitizeWA(wa) {
    if (!wa) return '';
    return wa.toString().replace(/\D/g, '');
}

function isValidWA(wa) {
    if (!wa) return true; // WA boleh kosong
    if (!/^\d+$/.test(wa)) return false;
    if (wa.startsWith('0')) return false; // TOLAK awalan 0
    if (wa.length < 10 || wa.length > 15) return false;
    return true;
}

// ==========================================
// SORTING MEMBER (Role + IGN)
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
// VALIDASI AKSES EDIT MEMBER (PERBAIKAN HIERARKI)
// ==========================================
function canEditMember(admin, targetMember) {
    const isLeader = admin?.role1 === 'LEADER' || admin?.role2 === 'LEADER';
    const isCoLead = admin?.role1 === 'CO-LEAD' || admin?.role2 === 'CO-LEAD';
    const isTargetLeader = targetMember?.role === 'leader';
    const isTargetCoLead = targetMember?.role === 'co-lead';
    
    // ✅ LEADER: Bisa edit semua
    if (isLeader) return true;
    
    // ❌ CO-LEAD: TIDAK BISA edit siapapun yang berstatus CO-LEAD atau LEADER
    if (isCoLead) {
        if (isTargetLeader) return false;
        if (isTargetCoLead) return false;
        return true;  // ✅ Hanya bisa edit member biasa
    }
    
    // ❌ Selain itu tidak boleh
    return false;
}

function canEditStatus(admin, targetMember) {
    const isLeader = admin?.role1 === 'LEADER' || admin?.role2 === 'LEADER';
    const isCoLead = admin?.role1 === 'CO-LEAD' || admin?.role2 === 'CO-LEAD';
    const isTargetCoLead = targetMember?.role === 'co-lead';
    const isTargetLeader = targetMember?.role === 'leader';
    
    // ✅ LEADER: Bisa ubah semua status
    if (isLeader) return true;
    
    // ❌ CO-LEAD: Hanya bisa ubah status member biasa
    if (isCoLead) {
        if (isTargetLeader) return false;
        if (isTargetCoLead) return false;
        return true;
    }
    
    return false;
}

function canEditWA(admin, targetMember) {
    const isLeader = admin?.role1 === 'LEADER' || admin?.role2 === 'LEADER';
    const isCoLead = admin?.role1 === 'CO-LEAD' || admin?.role2 === 'CO-LEAD';
    const isTargetCoLead = targetMember?.role === 'co-lead';
    const isTargetLeader = targetMember?.role === 'leader';
    
    // ✅ LEADER: Bisa edit semua
    if (isLeader) return true;
    
    // ❌ CO-LEAD: Hanya bisa edit WA member biasa
    if (isCoLead) {
        if (isTargetLeader) return false;
        if (isTargetCoLead) return false;
        return true;
    }
    
    return false;
}

// ==========================================
// PENGECEKAN WA DUPLIKAT (HANYA UNTUK MEMBER AKTIF)
// ==========================================
function checkActiveWA(wa, excludeUID = '') {
    if (!wa) return null;
    
    const searchWA = wa.toString().trim();
    
    const existing = memberList.find(m => {
        const memberWA = m.wa ? m.wa.toString().trim() : '';
        return memberWA === searchWA && m.uid !== excludeUID && m.status === 'aktif';
    });
    
    return existing || null;
}

// ==========================================
// LOAD MEMBER LIST
// ==========================================
async function loadMemberList(forceRefresh = false) {
    console.log("🟢 [MEMBER] loadMemberList dipanggil, forceRefresh:", forceRefresh);
    
    if (!currentAdmin) return;
    
    const container = document.getElementById('member-list-container');
    if (!container) return;
    
    // Baca dari cache dulu (selalu, termasuk saat refresh)
    const cached = sessionStorage.getItem('umbrella_cached_members');
    if (cached) {
        try {
            const data = JSON.parse(cached);
            memberList = data;
            renderMemberList(memberList);
            updateMissingWABadge(memberList);
            console.log("📦 [MEMBER] Render dari cache, jumlah:", memberList.length);
        } catch(e) {}
    }
    
    // Tampilkan loading hanya jika tidak ada cache
    if (!cached) {
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data member...</div>';
    }
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=getAllMembers&adminId=${currentAdmin.id}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.status === 'success' && result.data) {
            memberList = sortMembers(result.data);
            sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
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
        const hasWA = member.wa ? `<i class="fab fa-whatsapp"></i> ${escapeHtml(member.wa)}` : '<span class="no-wa"><i class="fas fa-exclamation-triangle"></i> WA belum diisi</span>';
        
        html += `
            <div class="member-row" data-uid="${escapeHtml(member.uid)}">
                <div class="member-info">
                    <div class="member-ign">
                        <strong>${escapeHtml(member.ign)}</strong>
                        <span class="member-role ${member.role}">${member.role.toUpperCase()}</span>
                    </div>
                    <div class="member-contact">
                        ${hasWA}
                    </div>
                    <div class="member-dates">
                        <i class="fas fa-calendar-plus"></i> Join: ${member.joinDate || '-'} 
                        | <i class="fas fa-calendar-alt"></i> Rejoin: ${member.rejoinDate || '-'}
                    </div>
                </div>
                <div class="member-actions">
                    <button class="btn-small" onclick="editMember('${escapeHtml(member.uid)}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
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
// SEARCH MEMBER
// ==========================================
let searchTimeout = null;

function initSearchListener() {
    const searchInput = document.getElementById('member-search-input');
    if (!searchInput) return;
    
    // Hapus listener lama jika ada untuk menghindari duplikasi
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
                <small>Contoh: 628123456789 (tanpa 0, tanpa +62, tanpa spasi/tanda hubung)</small>
            </div>
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitAddMember()" style="background:var(--color-primary);">Tambah</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    history.pushState({ modal: true }, "");
    document.getElementById('add-ign')?.focus();
}

async function submitAddMember() {
    const ign = document.getElementById('add-ign')?.value.trim();
    let wa = document.getElementById('add-wa')?.value.trim() || '';
    
    if (!ign) {
        window.showToast("IGN harus diisi", true);
        return;
    }
    
    // 1. Sanitize WA
    wa = sanitizeWA(wa);
    
    // 2. Validasi format WA
    if (wa && !isValidWA(wa)) {
        window.showToast("❌ Format WA salah! Tidak boleh diawali 0. Gunakan kode negara (contoh: 628xxxxxxxxxx)", true);
        return;
    }
    
    // 3. CEK OFFLINE: Apakah WA sudah dipakai member AKTIF?
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
        const url = `${window.GAS_ADMIN_URL}?action=addOrReactivateMember&adminId=${currentAdmin.id}&ign=${encodeURIComponent(ign)}&wa=${encodeURIComponent(wa)}`;
        const res = await fetch(url);
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
// EDIT MEMBER (DENGAN VALIDASI HIERARKI)
// ==========================================
async function editMember(uid) {
    console.log("✏️ [MEMBER] editMember dipanggil untuk UID:", uid);
    
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    // ========== VALIDASI AKSES ==========
    const isLeader = currentAdmin?.role1 === 'LEADER' || currentAdmin?.role2 === 'LEADER';
    const isCoLead = currentAdmin?.role1 === 'CO-LEAD' || currentAdmin?.role2 === 'CO-LEAD';
    const isTargetLeader = member?.role === 'leader';
    const isTargetCoLead = member?.role === 'co-lead';
    const isTargetSelf = member?.uid === currentAdmin?.id;
    
    // ❌ CEK: CO-LEAD mencoba edit LEADER
    if (isCoLead && isTargetLeader) {
        window.showToast("❌ Anda tidak memiliki izin untuk mengedit LEADER!", true);
        return;
    }
    
    // ❌ CEK: CO-LEAD mencoba edit CO-LEAD (termasuk diri sendiri!)
    if (isCoLead && isTargetCoLead) {
        if (isTargetSelf) {
            window.showToast("❌ Anda tidak bisa mengedit diri sendiri sebagai CO-LEAD! Hubungi LEADER.", true);
        } else {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit CO-LEAD lain!", true);
        }
        return;
    }
    
    // ❌ CEK: Bukan LEADER atau CO-LEAD
    if (!isLeader && !isCoLead) {
        window.showToast("❌ Anda tidak memiliki izin untuk mengedit member!", true);
        return;
    }
    
    // ========== ROLE OPTIONS (HANYA LEADER) ==========
    const roleOptions = isLeader ? 
        `<select id="edit-role">
            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="co-lead" ${member.role === 'co-lead' ? 'selected' : ''}>Co-Lead</option>
            <option value="leader" ${member.role === 'leader' ? 'selected' : ''}>Leader</option>
        </select>` :
        `<input type="text" id="edit-role" value="${member.role.toUpperCase()}" readonly disabled>`;
    
    // ========== STATUS OPTIONS ==========
    let statusOptions = '';
    
    if (isLeader) {
        statusOptions = `
            <select id="edit-status">
                <option value="aktif" ${member.status === 'aktif' ? 'selected' : ''}>✅ Aktif</option>
                <option value="nonaktif" ${member.status === 'nonaktif' ? 'selected' : ''}>⚪ Nonaktif</option>
                <option value="scammer" ${member.status === 'scammer' ? 'selected' : ''}>🔴 Scammer</option>
            </select>
        `;
    } else if (isCoLead) {
        if (member.role === 'member') {
            statusOptions = `
                <select id="edit-status">
                    <option value="aktif" ${member.status === 'aktif' ? 'selected' : ''}>✅ Aktif</option>
                    <option value="nonaktif" ${member.status === 'nonaktif' ? 'selected' : ''}>⚪ Nonaktif</option>
                    <option value="scammer" ${member.status === 'scammer' ? 'selected' : ''}>🔴 Scammer</option>
                </select>
            `;
        } else {
            statusOptions = `
                <input type="text" id="edit-status" value="${member.status.toUpperCase()}" readonly disabled>
                <small style="color:#ff6b6b;">⚠️ Hanya LEADER yang bisa mengubah status ${member.role.toUpperCase()}</small>
            `;
        }
    }
    
    // ========== CEK IZIN EDIT WA ==========
    const canEditWAField = canEditWA(currentAdmin, member);
    
    // ========== TAMPILKAN MODAL ==========
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-user-edit"></i> Edit Member</h3>
            
            ${isCoLead && isTargetSelf ? `
                <div style="background:rgba(255,68,68,0.15); border:1px solid #ff4444; border-radius:8px; padding:10px; margin-bottom:15px; color:#ff6b6b; font-size:0.8rem;">
                    ⚠️ Anda adalah CO-LEAD. Hubungi LEADER untuk mengubah data Anda sendiri.
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
            
            <div class="form-group">
                <label>IGN <span style="color:#ff4444;">*</span></label>
                <input type="text" id="edit-ign" value="${escapeHtml(member.ign)}" placeholder="Nama IGN"
                       ${!canEditWAField ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''}>
                <small>Nama bisa berubah kapan saja</small>
                ${!canEditWAField ? '<small style="color:#ff6b6b;">❌ Hanya LEADER yang bisa mengedit data CO-LEAD/LEADER</small>' : ''}
            </div>
            
            <div class="form-group">
                <label>WhatsApp</label>
                <input type="text" id="edit-wa" value="${escapeHtml(member.wa)}" placeholder="628123456789"
                       ${!canEditWAField ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''}>
                <small>Contoh: 628123456789 (tanpa 0, tanpa +62)</small>
                ${!canEditWAField ? '<small style="color:#ff6b6b;">❌ Hanya LEADER yang bisa mengedit data CO-LEAD/LEADER</small>' : ''}
            </div>
            
            <div class="form-group">
                <label>Role</label>
                ${roleOptions}
                ${!isLeader ? '<small>✏️ Hanya Leader yang bisa mengubah Role</small>' : ''}
            </div>
            
            <div class="form-group">
                <label>Status</label>
                ${statusOptions}
            </div>
            
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitEditMember('${escapeHtml(member.uid)}')" 
                        style="background:var(--color-primary);" 
                        ${(!isLeader && (isTargetLeader || isTargetCoLead)) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    Simpan
                </button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    history.pushState({ modal: true }, "");
}

// ==========================================
// SUBMIT EDIT MEMBER (DENGAN VALIDASI HIERARKI)
// ==========================================
async function submitEditMember(uid) {
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    // ========== VALIDASI ULANG ==========
    const isLeader = currentAdmin?.role1 === 'LEADER' || currentAdmin?.role2 === 'LEADER';
    const isCoLead = currentAdmin?.role1 === 'CO-LEAD' || currentAdmin?.role2 === 'CO-LEAD';
    const isTargetLeader = member?.role === 'leader';
    const isTargetCoLead = member?.role === 'co-lead';
    const isTargetSelf = member?.uid === currentAdmin?.id;
    
    // ❌ CEK: CO-LEAD mencoba edit LEADER
    if (isCoLead && isTargetLeader) {
        window.showToast("❌ Anda tidak memiliki izin untuk mengedit LEADER!", true);
        return;
    }
    
    // ❌ CEK: CO-LEAD mencoba edit CO-LEAD (termasuk diri sendiri!)
    if (isCoLead && isTargetCoLead) {
        if (isTargetSelf) {
            window.showToast("❌ Anda tidak bisa mengedit diri sendiri sebagai CO-LEAD! Hubungi LEADER.", true);
        } else {
            window.showToast("❌ Anda tidak memiliki izin untuk mengedit CO-LEAD lain!", true);
        }
        return;
    }
    
    // ❌ CEK: Bukan LEADER atau CO-LEAD
    if (!isLeader && !isCoLead) {
        window.showToast("❌ Anda tidak memiliki izin untuk mengedit member!", true);
        return;
    }
    
    const newIGN = document.getElementById('edit-ign')?.value.trim();
    let newWA = document.getElementById('edit-wa')?.value.trim() || '';
    const newRole = document.getElementById('edit-role')?.value;
    const newStatus = document.getElementById('edit-status')?.value;
    
    if (!newIGN) {
        window.showToast("IGN harus diisi", true);
        return;
    }
    
    // ========== VALIDASI WA (CO-LEAD tidak bisa edit WA sendiri jika CO-LEAD) ==========
    if (isCoLead && isTargetSelf && member.role === 'co-lead') {
        newWA = member.wa || '';
    }
    
    if (newWA) {
        newWA = sanitizeWA(newWA);
        if (!isValidWA(newWA)) {
            window.showToast("❌ Format WA salah! Tidak boleh diawali 0. Gunakan kode negara (contoh: 628xxxxxxxxxx)", true);
            return;
        }
        
        const existing = checkActiveWA(newWA, uid);
        if (existing) {
            window.showToast(`❌ WA "${newWA}" sudah terdaftar sebagai "${existing.ign}"`, true);
            return;
        }
    }
    
    // ========== VALIDASI ROLE (hanya LEADER) ==========
    let finalRole = member.role;
    if (isLeader && newRole) {
        finalRole = newRole;
    } else if (!isLeader && newRole && newRole !== member.role) {
        window.showToast("❌ Hanya Leader yang bisa mengubah Role!", true);
        return;
    }
    
    // ========== VALIDASI STATUS ==========
    let finalStatus = member.status;
    if (newStatus) {
        if (isLeader) {
            finalStatus = newStatus;
        } else if (isCoLead && member.role === 'member') {
            finalStatus = newStatus;
        } else if (isCoLead && member.role !== 'member') {
            window.showToast(`❌ Hanya LEADER yang bisa mengubah status ${member.role.toUpperCase()}!`, true);
            return;
        }
    }
    
    // ========== KIRIM KE SERVER ==========
    const modalContent = document.querySelector('#modal-overlay .modal-content');
    const btn = modalContent?.querySelector('button:first-of-type');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;
    }
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=updateMemberWithMerge&adminId=${currentAdmin.id}&uid=${encodeURIComponent(uid)}&ign=${encodeURIComponent(newIGN)}&wa=${encodeURIComponent(newWA)}&role=${encodeURIComponent(finalRole)}&status=${encodeURIComponent(finalStatus)}`;
        const res = await fetch(url);
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
// MODAL PERINGATAN (BUKAN ALERT)
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
        window.showToast("✅ Daftar tersalin! Tempel dan kirim pada grup WA untuk update xixi");
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
// EXPOSE GLOBAL FUNCTIONS
// ==========================================
window.loadMemberList = loadMemberList;
window.refreshMemberList = refreshMemberList;
window.openAddMemberModal = openAddMemberModal;
window.editMember = editMember;
window.submitEditMember = submitEditMember;
window.filterMissingWA = filterMissingWA;
window.showAllMembers = showAllMembers;
window.exportMemberList = exportMemberList;

console.log("✅ [MEMBER] admin-member.js loaded (Dengan Perbaikan Hierarki)");
