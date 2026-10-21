/**
 * content-wysiwyg.js — Contenteditable WYSIWYG dengan floating image upload
 * Return: instance { getHTML, setHTML, destroy, hasChanges }
 */

(function() {
  const ALLOWED_TAGS = ['P','BR','STRONG','B','EM','I','U','UL','OL','LI',
                        'H1','H2','H3','H4','H5','H6','A','IMG','SPAN','DIV',
                        'BLOCKQUOTE','CODE','PRE'];
  
  function sanitize(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // Remove dangerous elements
    tmp.querySelectorAll('script, iframe, embed, object, form, input, button, style, link, meta').forEach(function(el) {
      el.remove();
    });
    
    // Walk all elements, sanitize attributes
    const toClean = [];
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) toClean.push(walker.currentNode);
    
    toClean.forEach(function(el) {
      Array.from(el.attributes).forEach(function(attr) {
        const name = attr.name.toLowerCase();
        const val = (attr.value || '').toLowerCase().trim();
        
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
        } else if ((name === 'href' || name === 'src') && val.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        } else if (name === 'style') {
          // Strip style attributes with dangerous content
          if (val.indexOf('expression') !== -1 || val.indexOf('javascript:') !== -1) {
            el.removeAttribute(attr.name);
          }
        }
      });
    });
    
    return tmp.innerHTML;
  }
  
  function create(containerEl, options) {
    if (!containerEl) return null;
    options = options || {};
    
    const initialHtml = options.initialHtml || '';
    const onChange = options.onChange || function() {};
    const onUpload = options.onUpload || function(file) {
      return window.contentUploader.uploadImage(file, options.context || 'headline');
    };
    const placeholder = options.placeholder || 'Tulis di sini...';
    
    // Build structure
    containerEl.innerHTML = '';
    containerEl.classList.add('wysiwyg-container');
    
    const editor = document.createElement('div');
    editor.className = 'wysiwyg-editor';
    editor.contentEditable = 'true';
    editor.innerHTML = initialHtml || '<p><br></p>';
    editor.setAttribute('data-placeholder', placeholder);
    
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'wysiwyg-upload-btn';
    uploadBtn.type = 'button';
    uploadBtn.innerHTML = '<i class="fas fa-image"></i>';
    uploadBtn.title = 'Tambah gambar';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.jfif,.jpe,.svg';
    fileInput.style.display = 'none';
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'wysiwyg-loading';
    loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    loadingOverlay.style.display = 'none';
    
    containerEl.appendChild(editor);
    containerEl.appendChild(uploadBtn);
    containerEl.appendChild(fileInput);
    containerEl.appendChild(loadingOverlay);
    
    let savedRange = null;
    let currentHtml = initialHtml;
    let uploading = false;
    
    function saveSelection() {
      const sel = window.getSelection();
      if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    }
    
    function restoreSelection() {
      if (savedRange && editor.contains(savedRange.startContainer)) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } else {
        // Fallback: place cursor at end
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    
    function insertImage(url) {
      restoreSelection();
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'max-width: 100%; border-radius: 8px; margin: 8px 0; display: block;';
      
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editor.appendChild(img);
      }
      
      // Ensure cursor is on a new line after image
      const br = document.createElement('p');
      br.innerHTML = '<br>';
      img.after(br);
      
      notifyChange();
    }
    
    function notifyChange() {
      const html = sanitize(editor.innerHTML);
      if (html !== currentHtml) {
        currentHtml = html;
        onChange(html);
      }
    }
    
    // === Wire events ===
    
    // Save selection on mousedown of upload button (before focus shifts)
    uploadBtn.addEventListener('mousedown', function(e) {
      e.preventDefault();  // prevent editor losing focus
      saveSelection();
    });
    
    uploadBtn.addEventListener('click', function() {
      if (uploading) return;
      fileInput.click();
    });
    
    fileInput.addEventListener('change', async function(e) {
      const file = e.target.files && e.target.files[0];
      fileInput.value = '';  // reset
      if (!file) return;
      
      uploading = true;
      uploadBtn.disabled = true;
      loadingOverlay.style.display = 'flex';
      
      try {
        const url = await onUpload(file);
        insertImage(url);
        if (typeof window.showToast === 'function') window.showToast('✅ Gambar ditambahkan');
      } catch (err) {
        console.error('[WYSIWYG] upload error:', err);
        if (typeof window.showToast === 'function') window.showToast('❌ ' + err.message, true);
      } finally {
        uploading = false;
        uploadBtn.disabled = false;
        loadingOverlay.style.display = 'none';
      }
    });
    
    editor.addEventListener('input', notifyChange);
    
    // Paste: sanitize
    editor.addEventListener('paste', function(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      notifyChange();
    });
    
    return {
      getHTML: function() {
        return sanitize(editor.innerHTML);
      },
      setHTML: function(html) {
        editor.innerHTML = html || '<p><br></p>';
        currentHtml = sanitize(editor.innerHTML);
      },
      hasChanges: function() {
        return sanitize(editor.innerHTML) !== currentHtml;
      },
      getInitial: function() {
        return initialHtml;
      },
      destroy: function() {
        containerEl.innerHTML = '';
      }
    };
  }
  
  window.ContentWysiwyg = {
    create: create,
    sanitize: sanitize
  };
  
  console.log('✅ content-wysiwyg.js loaded');
})();
