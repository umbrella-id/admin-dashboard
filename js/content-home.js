/**
 * content-home.js — Render halaman utama tab konten
 * Fase E: banner publish real + menu count
 */

let contentHomeData = {
  allContent: null,
  publishStatus: { pending: false, lastPublishAt: 0 }
};

// ==========================================
// HELPER: FORMAT RELATIVE TIME
// ==========================================
function formatRelativeTime(ms) {
  if (!ms || ms === 0) return 'Belum pernah';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' menit lalu';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' hari lalu';
  const d = new Date(ms);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ==========================================
// RENDER HOME
// ==========================================
window.renderContentHome = async function() {
  console.log('🏠 [CONTENT] render home');
  
  const homeView = document.getElementById('content-view-home');
  const subView = document.getElementById('content-view-sub');
  if (!homeView || !subView) return;
  
  homeView.style.display = 'flex';
  subView.style.display = 'none';
  
  renderPublishBanner();
  refreshPublishBanner();
  
  await renderPreviewStage();
  await renderMenuCards();
};

// ==========================================
// BANNER PUBLISH
// ==========================================
function renderPublishBanner() {
  const banner = document.getElementById('publish-status-banner');
  if (!banner) return;
  banner.className = 'publish-status-banner';
  banner.innerHTML = '<div class="publish-banner-loading">Memuat status...</div>';
}

window.refreshPublishBanner = async function() {
  const banner = document.getElementById('publish-status-banner');
  if (!banner) return;
  
  // Reset auto-hide class setiap kali refresh
  banner.classList.remove('auto-hiding');
  
  try {
    const url = new URL(window.GAS_ADMIN_URL);
    url.searchParams.set('action', 'getPublishStatus');
    url.searchParams.set('adminId', currentAdmin.id);
    const res = await fetch(url.toString());
    const data = await res.json();
    
    if (data.status !== 'success') throw new Error(data.message);
    
    contentHomeData.publishStatus = {
      pending: data.pending === true,
      lastPublishAt: data.lastPublishAt || 0
    };
    
    if (data.pending) {
      // KUNING — selalu tampil
      banner.className = 'publish-status-banner pending';
      banner.innerHTML = 
        '<div class="publish-banner-text">' +
        '  <strong>⚠️ Ada perubahan belum tayang</strong>' +
        '  <small>Terakhir terbit: ' + formatRelativeTime(data.lastPublishAt) + '</small>' +
        '</div>' +
        '<button class="btn-publish-now" onclick="window.contentPublishNow()">' +
        '  <i class="fas fa-rocket"></i> PUBLISH NOW' +
        '</button>';
    } else {
      // HIJAU — auto-hide setelah 3 detik di semua device
      banner.className = 'publish-status-banner idle';
      banner.innerHTML = 
        '<div class="publish-banner-text">' +
        '  <strong>✅ Semua konten sudah tayang</strong>' +
        '  <small>Terakhir terbit: ' + formatRelativeTime(data.lastPublishAt) + '</small>' +
        '</div>';
      
      // Auto-hide menggunakan transisi CSS
      setTimeout(function() {
        banner.classList.add('auto-hiding');
      }, 3000);
    }
  } catch (e) {
    console.error('[CONTENT] getPublishStatus error:', e);
    banner.className = 'publish-status-banner pending';
    banner.innerHTML = 
      '<div class="publish-banner-text"><strong>⚠️ Gagal memuat status</strong><small>Periksa koneksi</small></div>';
  }
};

window.contentPublishNow = async function() {
  const choice = await window.contentModal.show({
    title: 'Terbitkan Konten?',
    desc: 'Semua perubahan akan langsung tayang ke publik sekarang.',
    buttons: [
      { label: '🚀 Ya, Terbitkan', style: 'success', value: 'yes' },
      { label: 'Batal', style: 'cancel', value: 'cancel' }
    ]
  });
  
  if (choice !== 'yes') return;
  
  window.showToast('⏳ Menerbitkan...');
  
  try {
    const url = new URL(window.GAS_ADMIN_URL);
    url.searchParams.set('action', 'refreshContentCache');
    url.searchParams.set('adminId', currentAdmin.id);
    const res = await fetch(url.toString());
    const data = await res.json();
    
    if (data.status === 'success') {
      window.showToast('✅ Konten tayang ke publik');
      contentHomeData.allContent = null;
      await refreshPublishBanner();
      await renderMenuCards();
    } else {
      window.showToast('❌ ' + (data.message || 'Gagal'), true);
    }
  } catch (e) {
    console.error('[CONTENT] publish error:', e);
    window.showToast('❌ Koneksi gagal', true);
  }
};

// ==========================================
// PREVIEW STAGE
// ==========================================
async function renderPreviewStage() {
  const stage = document.getElementById('content-preview-stage');
  if (!stage) return;
  
  // Delegate ke content-preview.js
  if (typeof window.renderPreviewStageSkeleton === 'function') {
    window.renderPreviewStageSkeleton(stage);
  } else {
    stage.innerHTML = '<div class="preview-loading"><i class="fas fa-spinner fa-spin"></i> Memuat...</div>';
  }
}

// ==========================================
// MENU CARDS
// ==========================================
async function renderMenuCards() {
  const grid = document.getElementById('content-menu-grid');
  if (!grid) return;
  
  // Fetch semua konten untuk count
  let all = contentHomeData.allContent;
  if (!all) {
    try {
      const url = new URL(window.GAS_ADMIN_URL);
      url.searchParams.set('action', 'getAllContent');
      url.searchParams.set('adminId', currentAdmin.id);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.status === 'success') {
        all = data.data || [];
        contentHomeData.allContent = all;
      }
    } catch (e) {
      console.error('[CONTENT] count error:', e);
      all = [];
    }
  }
  
  function countBy(id) {
    return all.filter(function(x) { 
      return x.ID && x.ID.toString().toLowerCase() === id; 
    }).length;
  }
  
  let crystaCount = 0;
  try {
    const cRes = await fetch(`${window.GAS_ADMIN_URL}?action=getAllCrysta&adminId=${currentAdmin.id}`);
    const cData = await cRes.json();
    if (cData.status === 'success' && Array.isArray(cData.data)) {
      crystaCount = cData.data.length;
    }
  } catch(e) { console.warn('[CONTENT] crysta count error:', e); }
  
  const cards = [
    { id: 'profil', icon: 'fa-address-card', label: 'Profil', count: countBy('profil') },
    { id: 'info', icon: 'fa-bullhorn', label: 'Informasi', count: countBy('headline') + countBy('openmember') + countBy('running_text') },
    { id: 'gallery', icon: 'fa-images', label: 'Gallery', count: countBy('gallery') },
    { id: 'crysta', icon: 'fa-gem', label: 'Crysta', count: crystaCount }
  ];
  
  if (currentAdmin && currentAdmin.role1 === 'leader') {
    cards.push({ id: 'webinternal', icon: 'fa-lock', label: 'Web Internal', count: 0 });
  }
  
  let html = '';
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    html += 
      '<div class="content-menu-card" onclick="window.contentOpenCategory(\'' + c.id + '\')">' +
      '  <div class="content-menu-card-icon"><i class="fas ' + c.icon + '"></i></div>' +
      '  <div class="content-menu-card-title">' + c.label + '</div>' +
      '  <div class="content-menu-card-count">' + c.count + ' item</div>' +
      '</div>';
  }
  grid.innerHTML = html;
}

// ==========================================
// NAVIGASI
// ==========================================
window.contentOpenCategory = function(category) {
  console.log('📂 buka kategori:', category);
  
  // 1. RENDER DULU (pushView tidak render)
  renderContentSub(category);
  
  // 2. BARU push state untuk back navigation
  if (typeof pushView === 'function') {
    pushView('content-sub', { category: category });
  }
};

window.renderContentSub = function(category) {
  const homeView = document.getElementById('content-view-home');
  const subView = document.getElementById('content-view-sub');
  if (!homeView || !subView) return;
  
  // WAJIB: show sub-view, hide home — DI AWAL, sebelum routing
  homeView.style.display = 'none';
  subView.style.display = 'flex';
  
  if (category === 'profil' && typeof window.renderProfilList === 'function') {
    window.renderProfilList();
    return;
  }
  if (category === 'info' && typeof window.renderInfoView === 'function') {
    window.renderInfoView();
    return;
  }
  if (category === 'gallery' && typeof window.renderGalleryList === 'function') {
    window.renderGalleryList();
    return;
  }
  if (category === 'crysta' && typeof window.renderCrystaList === 'function') {
    window.renderCrystaList();
    return;
  }
  if (category === 'webinternal' && typeof window.renderWebInternalView === 'function') {
    window.renderWebInternalView();
    return;
  }
  
  // Placeholder untuk kategori lain (Fase E lanjutan)
  const titles = { info: 'Informasi', gallery: 'Gallery', webinternal: 'Web Internal' };
  const title = titles[category] || category;
  
  subView.innerHTML = 
    '<div class="content-sub-header">' +
    '  <button class="content-sub-back-btn" onclick="window.contentBackFromSub()">' +
    '    <i class="fas fa-arrow-left"></i>' +
    '  </button>' +
    '  <div class="content-sub-title">' + title + '</div>' +
    '</div>' +
    '<div class="content-sub-body">' +
    '  <div class="content-placeholder">' +
    '    <i class="fas fa-tools"></i>' +
    '    <p><strong>' + title + '</strong></p>' +
    '    <p>Akan diimplementasikan di fase berikutnya</p>' +
    '  </div>' +
    '</div>';
};

window.contentBackFromSub = function() {
  if (typeof closeCurrentView === 'function') {
    closeCurrentView();
  } else {
    renderContentHome();
  }
};

window.contentBackFromSub = function() {
  if (typeof closeCurrentView === 'function') {
    closeCurrentView();
  } else {
    renderContentHome();
  }
};

// ==========================================
// RESET KE HOME — dipanggil dari router saat back ke dashboard
// ==========================================
window.contentResetToHome = function() {
  const homeView = document.getElementById('content-view-home');
  const subView = document.getElementById('content-view-sub');
  if (homeView) homeView.style.display = 'flex';
  if (subView) {
    subView.style.display = 'none';
    subView.innerHTML = '';
  }
};

window.initContentTab = function() {
  console.log('🚀 init tab konten');
  renderContentHome();
};

// ==========================================
// AUTO-INIT VIA INTERSECTION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
  const tabPage = document.getElementById('tab-content-page');
  if (!tabPage) return;
  
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && !tabPage.dataset.contentInit) {
        console.log('👁️ Tab terlihat, auto-init');
        tabPage.dataset.contentInit = 'true';
        window.initContentTab();
      }
    });
  }, { threshold: 0.3 });
  
  observer.observe(tabPage);
});

console.log('✅ content-home.js loaded (Fase E)');
