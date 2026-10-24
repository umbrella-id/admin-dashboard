/**
 * content-router.js — Router sub-view tab konten
 */

window.handleContentView = function(viewName, data) {
  switch (viewName) {
    case 'content-sub':
      if (data && data.category) {
        window.renderContentSub(data.category);
      }
      return true;
    
    case 'content-info':
      if (typeof window.renderInfoView === 'function') {
        window.renderInfoView();
      }
      return true;
    
    case 'content-gallery-edit':
      if (typeof window.renderGalleryEditForm === 'function') {
        window.renderGalleryEditForm();
      }
      return true;
    
    case 'content-gallery-add':
      if (typeof window.renderGalleryAddForm === 'function') {
        window.renderGalleryAddForm();
      }
      return true;
    
    case 'content-webinternal':
      if (typeof window.renderWebInternalView === 'function') {
        window.renderWebInternalView();
      }
      return true;

    case 'content-crysta-chain':
      if (typeof window.renderCrystaChainDetail === 'function') {
        window.renderCrystaChainDetail();
      }
      return true;
    
    case 'content-profil-edit':
      if (typeof window.renderProfilEditForm === 'function') {
        window.renderProfilEditForm();
      }
      return true;
    
    case 'content-profil-add':
      if (typeof window.renderProfilAddForm === 'function') {
        window.renderProfilAddForm();
      }
      return true;
    
    default:
      return false;
  }
};

console.log('✅ content-router.js loaded (Fase E)');
