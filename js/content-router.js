/**
 * content-router.js — Helper navigasi sub-view tab konten
 * Fase D: minimal, hanya bridge ke admin-router.js
 */

// Mapping view → render function
const CONTENT_VIEW_HANDLERS = {
  'content-sub': function(data) {
    if (data && data.category && typeof window.renderContentSub === 'function') {
      window.renderContentSub(data.category);
    }
  }
};

// ==========================================
// HANDLE CONTENT VIEW (dipanggil dari admin-router.js)
// ==========================================
window.handleContentView = function(viewName, data) {
  const handler = CONTENT_VIEW_HANDLERS[viewName];
  if (handler) {
    handler(data);
    return true;
  }
  return false;
};

console.log('✅ content-router.js loaded');
