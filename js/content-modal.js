/**
 * content-modal.js — Modal reusable untuk tab konten
 * API: await window.contentModal.show({ title, desc, buttons })
 * Return: Promise<string> — value dari tombol yang diklik
 */

(function() {
  let activeResolve = null;
  
  function ensureOverlay() {
    let overlay = document.getElementById('content-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'content-modal-overlay';
      overlay.className = 'content-modal-overlay';
      overlay.innerHTML = '<div class="content-modal-box"><div id="content-modal-body"></div></div>';
      document.body.appendChild(overlay);
    }
    return overlay;
  }
  
  window.contentModal = {
    show: function(options) {
      return new Promise(function(resolve) {
        const overlay = ensureOverlay();
        const body = document.getElementById('content-modal-body');
        if (!body) return resolve('cancel');
        
        const title = options.title || '';
        const desc = options.desc || '';
        const buttons = options.buttons || [
          { label: 'OK', style: 'confirm', value: 'ok' }
        ];
        
        let buttonsHtml = '';
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          const styleClass = b.style || 'cancel';
          buttonsHtml += '<button class="btn-' + styleClass + '" data-value="' + 
                         b.value + '">' + b.label + '</button>';
        }
        
        body.innerHTML = 
          '<button class="content-modal-close" type="button" aria-label="Tutup">✕</button>' +
          '<div class="content-modal-title">' + title + '</div>' +
          (desc ? '<div class="content-modal-desc">' + desc + '</div>' : '') +
          '<div class="content-modal-actions">' + buttonsHtml + '</div>';
        
        activeResolve = resolve;
        overlay.classList.add('open');
        
        // Wire X button
        const xBtn = body.querySelector('.content-modal-close');
        if (xBtn) {
          xBtn.onclick = function() { close('cancel'); };
        }
        
        // Wire tombol actions
        body.querySelectorAll('.content-modal-actions button').forEach(function(btn) {
          btn.onclick = function() {
            const val = btn.getAttribute('data-value');
            close(val);
          };
        });
        
        // Klik overlay = cancel
        overlay.onclick = function(e) {
          if (e.target === overlay) close('cancel');
        };
      });
    }
  };
  
  function close(value) {
    const overlay = document.getElementById('content-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    if (activeResolve) {
      const r = activeResolve;
      activeResolve = null;
      r(value);
    }
  }
  
  console.log('✅ content-modal.js loaded');
})();
