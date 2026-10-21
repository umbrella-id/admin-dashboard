/**
 * content-home.js — Render halaman utama tab konten
 * Fase D: skeleton, data placeholder
 */

// State
let contentHomeData = {
  allContent: [],       // dari getAllContent
  publishStatus: {
    pending: false,
    lastPublishAt: 0
  }
};

// ==========================================
// RENDER HOME
// ==========================================
window.renderContentHome = async function() {
  console.log('🏠 [CONTENT] render home');
  
  const homeView = document.getElementById('content-view-home');
  const subView = document.getElementById('content-view-sub');
  
  if (!homeView || !subView) {
    console.error('❌ content-view-home atau content-view-sub tidak ada');
    return;
  }
  
  // Tampilkan home, sembunyikan sub
  homeView.style.display = 'flex';
  subView.style.display = 'none';
  
  // Render banner (placeholder dulu)
  renderPublishBanner();
  
  // Render preview
  await renderPreviewStage();
  
  // Render menu
  await renderMenuCards();
};

// ==========================================
// RENDER BANNER PUBLISH
// ==========================================
function renderPublishBanner() {
  const banner = document.getElementById('publish-status-banner');
  if (!banner) return;
  
  // Fase D: placeholder — nanti diisi dari getPublishStatus
  banner.className = 'publish-status-banner idle';
  banner.innerHTML = `
    <div class="publish-banner-text">
      <strong><i class="fas fa-check-circle"></i> Siap</strong>
      <small>Data status akan dimuat di Fase E</small>
    </div>
  `;
}

// ==========================================
// RENDER PREVIEW STAGE
// ==========================================
async function renderPreviewStage() {
  const stage = document.getElementById('content-preview-stage');
  if (!stage) return;
  
  // Fase D: placeholder dengan gambar default
  stage.innerHTML = `
    <img src="https://umbrella-id.github.io/Assets/Background.webp" 
         alt="Preview Background"
         onerror="this.style.display='none';this.parentElement.innerHTML='<div class=\\'preview-loading\\'><i class=\\'fas fa-image\\'></i> Background default</div>'">
    <div class="preview-overlay"></div>
    <button class="preview-edit-btn" onclick="window.contentPreviewEdit()">
      <i class="fas fa-edit"></i> Edit
    </button>
  `;
}

window.contentPreviewEdit = function() {
  // Fase D: placeholder
  window.showToast('Fitur edit preview akan hadir di Fase F', true);
};

// ==========================================
// RENDER MENU CARDS
// ==========================================
async function renderMenuCards() {
  const grid = document.getElementById('content-menu-grid');
  if (!grid) return;
  
  // Placeholder count — nanti diisi dari data getAllContent
  const cards = [
    { id: 'profil', icon: 'fa-address-card', label: 'Profil', count: 0 },
    { id: 'info', icon: 'fa-bullhorn', label: 'Informasi', count: 0 },
    { id: 'gallery', icon: 'fa-images', label: 'Gallery', count: 0 }
  ];
  
  // Tambah Web Internal hanya untuk leader
  if (currentAdmin && currentAdmin.role1 === 'leader') {
    cards.push({ id: 'webinternal', icon: 'fa-lock', label: 'Web Internal', count: 0 });
  }
  
  let html = '';
  for (const card of cards) {
    html += `
      <div class="content-menu-card" onclick="window.contentOpenCategory('${card.id}')">
        <div class="content-menu-card-icon">
          <i class="fas ${card.icon}"></i>
        </div>
        <div class="content-menu-card-title">${card.label}</div>
        <div class="content-menu-card-count">${card.count} item</div>
      </div>
    `;
  }
  
  grid.innerHTML = html;
}

// ==========================================
// BUKA KATEGORI
// ==========================================
window.contentOpenCategory = function(category) {
  console.log('📂 [CONTENT] buka kategori:', category);
  
  if (typeof pushView === 'function') {
    pushView('content-sub', { category });
  } else {
    // Fallback kalau admin-router.js belum load
    renderContentSub(category);
  }
};

// ==========================================
// RENDER SUB-VIEW (placeholder Fase D)
// ==========================================
window.renderContentSub = function(category) {
  const homeView = document.getElementById('content-view-home');
  const subView = document.getElementById('content-view-sub');
  
  if (!homeView || !subView) return;
  
  homeView.style.display = 'none';
  subView.style.display = 'flex';
  
  const titles = {
    profil: 'Profil',
    info: 'Informasi',
    gallery: 'Gallery',
    webinternal: 'Web Internal'
  };
  
  const title = titles[category] || category;
  
  subView.innerHTML = `
    <div class="content-sub-header">
      <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="content-sub-title">${title}</div>
    </div>
    
    <div class="content-sub-body">
      <div class="content-placeholder">
        <i class="fas fa-tools"></i>
        <p><strong>${title}</strong></p>
        <p>Sub-view ini akan diimplementasikan di Fase E</p>
      </div>
    </div>
  `;
};

// ==========================================
// BACK DARI SUB-VIEW
// ==========================================
window.contentBackFromSub = function() {
  if (typeof closeCurrentView === 'function') {
    closeCurrentView();
  } else {
    // Fallback
    renderContentHome();
  }
};

// ==========================================
// INIT — dipanggil saat tab konten dibuka
// ==========================================
window.initContentTab = function() {
  console.log('🚀 [CONTENT] init tab konten');
  renderContentHome();
};

console.log('✅ content-home.js loaded');
