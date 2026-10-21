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
