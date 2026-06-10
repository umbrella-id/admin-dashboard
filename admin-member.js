/**
 * admin-member.js - Member Management Module
 * Hanya untuk LEADER & CO-LEAD
 */

let memberList = [];

// Override escapeHtml untuk keamanan
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    if (typeof str !== 'string') str = String(str);
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
// PENGECEKAN OFFLINE (HANYA UNTUK MEMBER AKTIF)
// ==========================================
function checkActiveWA(wa, excludeUID = '') {
    if (!wa) return null;
    
    const searchWA = wa.toString().trim();
    
    const existing = memberList.find(m => {
        const memberWA = m.wa ? m.wa.toString().trim() : '';
        return memberWA === searchWA && m.uid !== excludeUID;
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
// EDIT MEMBER
// ==========================================
async function editMember(uid) {
    console.log("✏️ [MEMBER] editMember dipanggil untuk UID:", uid);
    
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
        return;
    }
    
    const isLeader = currentAdmin?.role1 === 'LEADER';
    
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
                <label>IGN <span style="color:#ff4444;">*</span></label>
                <input type="text" id="edit-ign" value="${escapeHtml(member.ign)}" placeholder="Nama IGN">
                <small>Nama bisa berubah kapan saja (ganti nama di game)</small>
            </div>
            
            <div class="form-group">
                <label>WhatsApp</label>
                <input type="text" id="edit-wa" value="${escapeHtml(member.wa)}" placeholder="628123456789">
                <small>Contoh: 628123456789 (tanpa 0, tanpa +62, tanpa spasi/tanda hubung)</small>
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
                <button onclick="submitEditMember('${escapeHtml(member.uid)}')" style="background:var(--color-primary);">Simpan</button>
                <button onclick="closeModal()" style="background:#333;">Batal</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function submitEditMember(uid) {
    const member = memberList.find(m => m.uid === uid);
    if (!member) {
        window.showToast("Member tidak ditemukan", true);
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
    
    newWA = sanitizeWA(newWA);
    if (newWA && !isValidWA(newWA)) {
        window.showToast("❌ Format WA salah! Tidak boleh diawali 0. Gunakan kode negara (contoh: 628xxxxxxxxxx)", true);
        return;
    }
    
    if (newWA) {
        const existing = checkActiveWA(newWA, uid);
        if (existing) {
            window.showToast(`❌ WA "${newWA}" sudah terdaftar sebagai "${existing.ign}"`, true);
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
        const url = `${window.GAS_ADMIN_URL}?action=updateMemberWithMerge&adminId=${currentAdmin.id}&uid=${encodeURIComponent(uid)}&ign=${encodeURIComponent(newIGN)}&wa=${encodeURIComponent(newWA)}&role=${encodeURIComponent(newRole)}&status=${encodeURIComponent(newStatus)}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.status === 'success') {
            window.showToast(result.message);
            closeModal();
            
            if (result.data) {
                // ✅ HAPUS JIKA STATUS NONAKTIF
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
            } else if (result.action === 'active') {
                window.showToast(result.message, true);
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
window.filterMissingWA = filterMissingWA;
window.showAllMembers = showAllMembers;

console.log("✅ [MEMBER] admin-member.js loaded");
