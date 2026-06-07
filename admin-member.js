/**
 * admin-member.js - Member Management Module
 * Hanya untuk LEADER & CO-LEAD
 */

let memberList = [];

// ==========================================
// LOAD MEMBER LIST
// ==========================================
async function loadMemberList(forceRefresh = false) {
    console.log("🟢 [MEMBER] loadMemberList dipanggil, forceRefresh:", forceRefresh);
    
    if (!currentAdmin) {
        console.log("🔴 [MEMBER] currentAdmin null, tidak bisa load data");
        return;
    }
    console.log("🟢 [MEMBER] currentAdmin:", currentAdmin.nama, currentAdmin.id);
    
    const container = document.getElementById('member-list-container');
    if (!container) {
        console.log("🔴 [MEMBER] container member-list-container tidak ditemukan");
        return;
    }
    
    // Baca dari cache dulu
    if (!forceRefresh) {
        const cached = sessionStorage.getItem('umbrella_cached_members');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                memberList = data;
                renderMemberList(memberList);
                console.log("📦 [MEMBER] Render dari cache, jumlah:", memberList.length);
            } catch(e) {
                console.error("🔴 [MEMBER] Cache parse error:", e);
            }
        }
    }
    
    // Tampilkan loading
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data member...</div>';
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=getAllMembers&adminId=${currentAdmin.id}`;
        console.log("📡 [MEMBER] Fetch dari:", url);
        const res = await fetch(url);
        const result = await res.json();
        console.log("📡 [MEMBER] Response:", result);
        
        if (result.status === 'success' && result.data) {
            memberList = result.data;
            sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
            renderMemberList(memberList);
            updateMissingWABadge(memberList);
            console.log("✅ [MEMBER] Load sukses, jumlah member:", memberList.length);
        } else {
            console.log("🔴 [MEMBER] Load gagal, status:", result.status, "message:", result.message);
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data member</div>';
        }
    } catch(e) {
        console.error("🔴 [MEMBER] Fetch error:", e);
        container.innerHTML = '<div class="empty-state">⚠️ Gagal koneksi</div>';
    }
}

// ==========================================
// RENDER MEMBER LIST
// ==========================================
function renderMemberList(members) {
    console.log("🎨 [MEMBER] renderMemberList dipanggil, jumlah:", members?.length);
    
    const container = document.getElementById('member-list-container');
    if (!container) {
        console.log("🔴 [MEMBER] container tidak ditemukan saat render");
        return;
    }
    
    if (!members || members.length === 0) {
        console.log("🟡 [MEMBER] Tidak ada member aktif");
        container.innerHTML = '<div class="empty-state">📭 Tidak ada member aktif</div>';
        return;
    }
    
    let html = '';
    for (const member of members) {
        const hasWA = member.wa ? `<i class="fab fa-whatsapp"></i> ${member.wa}` : '<span class="no-wa"><i class="fas fa-exclamation-triangle"></i> WA belum diisi</span>';
        
        html += `
            <div class="member-row" data-ign="${escapeHtml(member.ign)}">
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
                    <button class="btn-small" onclick="editMember('${escapeHtml(member.ign)}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    console.log("✅ [MEMBER] Render selesai");
}

// ==========================================
// UPDATE BADGE MEMBER TANPA WA
// ==========================================
function updateMissingWABadge(members) {
    const missingWA = members.filter(m => !m.wa || m.wa === '');
    const badge = document.getElementById('missing-wa-badge');
    const warningDiv = document.getElementById('member-warning');
    
    console.log("📊 [MEMBER] Member tanpa WA:", missingWA.length);
    
    if (missingWA.length > 0) {
        if (badge) badge.innerText = missingWA.length;
        if (warningDiv) warningDiv.style.display = 'flex';
    } else {
        if (warningDiv) warningDiv.style.display = 'none';
    }
}

// ==========================================
// FILTER MEMBER TANPA WA
// ==========================================
function filterMissingWA() {
    console.log("🔍 [MEMBER] filterMissingWA dipanggil");
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
    console.log("🔍 [MEMBER] showAllMembers dipanggil");
    const backBtn = document.querySelector('.filter-back');
    if (backBtn) backBtn.remove();
    renderMemberList(memberList);
}

// ==========================================
// ADD MEMBER
// ==========================================
function openAddMemberModal() {
    console.log("➕ [MEMBER] openAddMemberModal dipanggil");
    
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
                <label>WhatsApp (opsional)</label>
                <input type="text" id="add-wa" placeholder="628123456789" autocomplete="off">
                <small>Isi nomor WhatsApp dengan awalan 62, tanpa tanda + atau 0</small>
            </div>
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitAddMember()" style="background:var(--color-primary);">Tambah</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    document.getElementById('add-ign')?.focus();
}

async function submitAddMember() {
    console.log("📤 [MEMBER] submitAddMember dipanggil");
    
    const ign = document.getElementById('add-ign')?.value.trim();
    const wa = document.getElementById('add-wa')?.value.trim() || '';
    
    if (!ign) {
        window.showToast("IGN harus diisi", true);
        return;
    }
    
    console.log("📤 [MEMBER] Data:", { ign, wa });
    
    const modalContent = document.querySelector('#modal-overlay .modal-content');
    const btn = modalContent?.querySelector('button:first-of-type');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;
    }
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=addOrReactivateMember&adminId=${currentAdmin.id}&ign=${encodeURIComponent(ign)}&wa=${encodeURIComponent(wa)}`;
        console.log("📡 [MEMBER] Fetch URL:", url);
        const res = await fetch(url);
        const result = await res.json();
        console.log("📡 [MEMBER] Response:", result);
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            
            if (result.data) {
                const existingIndex = memberList.findIndex(m => m.ign === result.data.ign);
                if (existingIndex >= 0) {
                    memberList[existingIndex] = result.data;
                } else {
                    memberList.push(result.data);
                }
                sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
                renderMemberList(memberList);
                updateMissingWABadge(memberList);
            } else {
                await loadMemberList(true);
            }
        } else {
            if (result.action === 'scammer') {
                window.showToast(result.message, true);
                alert(`🔴 PERINGATAN!\n\n${result.message}\n\nSegera koordinasikan dengan Leader untuk tindakan!`);
            } else {
                window.showToast(result.message || "Gagal", true);
            }
        }
    } catch(e) {
        console.error("🔴 [MEMBER] Add member error:", e);
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
async function editMember(ign) {
    console.log("✏️ [MEMBER] editMember dipanggil dengan IGN:", ign);
    console.log("📊 [MEMBER] memberList saat ini:", memberList);
    console.log("📊 [MEMBER] currentAdmin:", currentAdmin);
    
    if (!memberList || memberList.length === 0) {
        console.log("🔴 [MEMBER] memberList kosong, coba load ulang");
        await loadMemberList(true);
    }
    
    const member = memberList.find(m => m.ign === ign);
    if (!member) {
        console.log("🔴 [MEMBER] Member tidak ditemukan di memberList");
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    console.log("✅ [MEMBER] Member ditemukan:", member);
    
    const isLeader = currentAdmin?.role1 === 'LEADER';
    console.log("📊 [MEMBER] isLeader:", isLeader);
    
    const roleOptions = isLeader ? 
        `<select id="edit-role">
            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="co-lead" ${member.role === 'co-lead' ? 'selected' : ''}>Co-Lead</option>
            <option value="leader" ${member.role === 'leader' ? 'selected' : ''}>Leader</option>
        </select>` :
        `<input type="text" id="edit-role" value="${member.role}" readonly disabled>`;
    
    const statusOptions = `
        <select id="edit-status">
            <option value="aktif" ${member.status === 'aktif' ? 'selected' : ''}>✅ Aktif</option>
            <option value="nonaktif" ${member.status === 'nonaktif' ? 'selected' : ''}>⚪ Nonaktif</option>
            <option value="scammer" ${member.status === 'scammer' ? 'selected' : ''}>🔴 Scammer</option>
        </select>
    `;
    
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <button class="modal-close-x" onclick="window.closeModal()">✕</button>
            <h3><i class="fas fa-user-edit"></i> Edit Member</h3>
            <div class="form-group">
                <label>IGN</label>
                <input type="text" id="edit-ign" value="${escapeHtml(member.ign)}" readonly disabled>
            </div>
            <div class="form-group">
                <label>WhatsApp</label>
                <input type="text" id="edit-wa" value="${escapeHtml(member.wa)}" placeholder="628123456789" autocomplete="off">
                <small>Isi nomor WhatsApp dengan awalan 62, tanpa tanda + atau 0</small>
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
            <div class="form-group">
                <label>Join Date</label>
                <input type="text" value="${member.joinDate || '-'}" readonly disabled>
            </div>
            <div class="form-group">
                <label>Rejoin Date</label>
                <input type="text" value="${member.rejoinDate || '-'}" readonly disabled>
            </div>
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitEditMember('${escapeHtml(member.ign)}')" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    console.log("✅ [MEMBER] Modal edit ditampilkan");
}

async function submitEditMember(oldIgn) {
    console.log("📤 [MEMBER] submitEditMember dipanggil untuk:", oldIgn);
    
    const newWA = document.getElementById('edit-wa')?.value.trim() || '';
    const newRole = document.getElementById('edit-role')?.value;
    const newStatus = document.getElementById('edit-status')?.value;
    
    console.log("📤 [MEMBER] Data baru:", { newWA, newRole, newStatus });
    
    const modalContent = document.querySelector('#modal-overlay .modal-content');
    const btn = modalContent?.querySelector('button:first-of-type');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;
    }
    
    try {
        const url = `${window.GAS_ADMIN_URL}?action=updateMemberWithMerge&adminId=${currentAdmin.id}&ign=${encodeURIComponent(oldIgn)}&wa=${encodeURIComponent(newWA)}&role=${encodeURIComponent(newRole)}&status=${encodeURIComponent(newStatus)}`;
        console.log("📡 [MEMBER] Fetch URL:", url);
        const res = await fetch(url);
        const result = await res.json();
        console.log("📡 [MEMBER] Response:", result);
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            
            if (result.data) {
                const existingIndex = memberList.findIndex(m => m.ign === oldIgn);
                if (existingIndex >= 0) {
                    memberList[existingIndex] = result.data;
                } else {
                    memberList.push(result.data);
                }
                sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
                renderMemberList(memberList);
                updateMissingWABadge(memberList);
                console.log("✅ [MEMBER] Data member diupdate");
            } else {
                await loadMemberList(true);
            }
        } else {
            if (result.action === 'scammer') {
                window.showToast(result.message, true);
                alert(`🔴 PERINGATAN!\n\n${result.message}\n\nSegera koordinasikan dengan Leader untuk tindakan!`);
            } else {
                window.showToast(result.message || "Gagal", true);
            }
        }
    } catch(e) {
        console.error("🔴 [MEMBER] Edit member error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

// ==========================================
// REFRESH
// ==========================================
async function refreshMemberList() {
    console.log("🔄 [MEMBER] refreshMemberList dipanggil");
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
window.filterMissingWA = filterMissingWA;
window.showAllMembers = showAllMembers;

console.log("✅ [MEMBER] admin-member.js loaded");
