/**
 * admin-member.js - Member Management Module
 * Hanya untuk LEADER & CO-LEAD
 */

let memberList = [];
let currentFilter = 'aktif'; // default tampilkan aktif saja

// ==========================================
// LOAD MEMBER LIST
// ==========================================
async function loadMemberList(forceRefresh = false) {
    const container = document.getElementById('member-list-container');
    if (!container) return;
    
    // Baca dari cache dulu
    if (!forceRefresh) {
        const cached = sessionStorage.getItem('umbrella_cached_members');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                memberList = data;
                renderMemberList(memberList);
                console.log("📦 Render member dari cache");
            } catch(e) {}
        }
    }
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=getAllMembers`);
        const result = await res.json();
        
        if (result.status === 'success' && result.data) {
            memberList = result.data;
            // Simpan ke cache
            sessionStorage.setItem('umbrella_cached_members', JSON.stringify(memberList));
            renderMemberList(memberList);
            updateMissingWABadge(memberList);
        } else {
            container.innerHTML = '<div class="empty-state">⚠️ Gagal memuat data member</div>';
        }
    } catch(e) {
        console.error("Load member error:", e);
        container.innerHTML = '<div class="empty-state">⚠️ Gagal koneksi</div>';
    }
}

// ==========================================
// RENDER MEMBER LIST
// ==========================================
function renderMemberList(members) {
    const container = document.getElementById('member-list-container');
    if (!container) return;
    
    // Filter berdasarkan status
    let filtered = members;
    if (currentFilter !== 'all') {
        filtered = members.filter(m => m.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 Tidak ada member</div>';
        return;
    }
    
    let html = '';
    for (const member of filtered) {
        const statusClass = member.status === 'aktif' ? 'status-aktif' : 
                           (member.status === 'scammer' ? 'status-scammer' : 'status-nonaktif');
        const statusIcon = member.status === 'aktif' ? '✅' : 
                          (member.status === 'scammer' ? '🔴' : '⚪');
        const hasWA = member.wa ? `📞 ${member.wa}` : '<span class="no-wa">⚠️ WA belum diisi</span>';
        
        html += `
            <div class="member-row ${member.status === 'scammer' ? 'scammer' : ''}" data-ign="${member.ign}">
                <div class="member-info">
                    <div class="member-ign">
                        <strong>${escapeHtml(member.ign)}</strong>
                        <span class="member-role ${member.role}">${member.role.toUpperCase()}</span>
                        <span class="member-status ${statusClass}">${statusIcon} ${member.status.toUpperCase()}</span>
                    </div>
                    <div class="member-contact">
                        ${hasWA}
                    </div>
                    <div class="member-dates">
                        📅 Join: ${member.joinDate || '-'} | 🔄 Rejoin: ${member.rejoinDate || '-'}
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
    updateFilterButtons();
}

// ==========================================
// UPDATE BADGE MEMBER TANPA WA
// ==========================================
function updateMissingWABadge(members) {
    const missingWA = members.filter(m => m.wa === '' && m.status === 'aktif');
    const badge = document.getElementById('missing-wa-badge');
    const warningDiv = document.getElementById('member-warning');
    
    if (missingWA.length > 0) {
        if (badge) badge.innerText = missingWA.length;
        if (warningDiv) warningDiv.style.display = 'flex';
    } else {
        if (warningDiv) warningDiv.style.display = 'none';
    }
}

// ==========================================
// FILTER
// ==========================================
function setFilter(filter) {
    currentFilter = filter;
    renderMemberList(memberList);
}

function updateFilterButtons() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        if (btn.dataset.filter === currentFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function filterMissingWA() {
    const missingWA = memberList.filter(m => m.wa === '' && m.status === 'aktif');
    renderMemberList(missingWA);
    // Tampilkan tombol kembali
    const container = document.getElementById('member-list-container');
    const backBtn = document.createElement('div');
    backBtn.className = 'filter-back';
    backBtn.innerHTML = '<button class="btn-small" onclick="setFilter(\'aktif\')">← Kembali ke semua member aktif</button>';
    if (!document.querySelector('.filter-back')) {
        container.parentNode.insertBefore(backBtn, container.nextSibling);
    }
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
                <input type="text" id="add-ign" placeholder="Nama IGN">
            </div>
            <div class="form-group">
                <label>WhatsApp (opsional)</label>
                <input type="text" id="add-wa" placeholder="628123456789">
                <small>Isi jika ada, bisa dikosongkan</small>
            </div>
            <div class="modal-buttons" style="margin-top: 20px;">
                <button onclick="submitAddMember()" style="background:var(--color-primary);">Tambah</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function submitAddMember() {
    const ign = document.getElementById('add-ign')?.value.trim();
    const wa = document.getElementById('add-wa')?.value.trim() || '';
    
    if (!ign) {
        window.showToast("IGN harus diisi", true);
        return;
    }
    
    const btn = document.querySelector('#modal-overlay button:first-of-type');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=addOrReactivateMember&ign=${encodeURIComponent(ign)}&wa=${encodeURIComponent(wa)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            // Update cache dengan data terbaru dari response
            if (result.data) {
                // Update atau tambah ke memberList
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
                // Tampilkan peringatan scammer
                alert(`🔴 PERINGATAN!\n\n${result.message}\n\nSegera koordinasikan dengan Leader untuk tindakan!`);
            } else {
                window.showToast(result.message || "Gagal", true);
            }
        }
    } catch(e) {
        console.error("Add member error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// EDIT MEMBER
// ==========================================
async function editMember(ign) {
    const member = memberList.find(m => m.ign === ign);
    if (!member) return;
    
    const isLeader = currentAdmin?.role1 === 'LEADER';
    const roleOptions = isLeader ? 
        `<select id="edit-role">
            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="co-lead" ${member.role === 'co-lead' ? 'selected' : ''}>Co-Lead</option>
            <option value="leader" ${member.role === 'leader' ? 'selected' : ''}>Leader</option>
        </select>` :
        `<input type="text" id="edit-role" value="${member.role}" disabled readonly>`;
    
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
                <input type="text" id="edit-wa" value="${escapeHtml(member.wa)}" placeholder="628123456789">
                <small>Isi nomor WhatsApp yang valid</small>
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
}

async function submitEditMember(oldIgn) {
    const newWA = document.getElementById('edit-wa')?.value.trim() || '';
    const newRole = document.getElementById('edit-role')?.value;
    const newStatus = document.getElementById('edit-status')?.value;
    
    const btn = document.querySelector('#modal-overlay button:first-of-type');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`${window.GAS_ADMIN_URL}?action=updateMemberWithMerge&ign=${encodeURIComponent(oldIgn)}&wa=${encodeURIComponent(newWA)}&role=${encodeURIComponent(newRole)}&status=${encodeURIComponent(newStatus)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            
            // Update cache dengan data terbaru dari response
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
        console.error("Edit member error:", e);
        window.showToast("Gagal koneksi", true);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================
// REFRESH
// ==========================================
async function refreshMemberList() {
    const btn = document.querySelector('#member-container .refresh-btn i');
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
window.setFilter = setFilter;
window.filterMissingWA = filterMissingWA;

console.log("✅ admin-member.js loaded");
