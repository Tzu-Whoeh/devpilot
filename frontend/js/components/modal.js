/* ═══ Modal Component ═══
 * 通用模态框工具
 */
const Modal = {
  show(options = {}) {
    const { title = '', body = '', onConfirm, onCancel, confirmText = '确认', cancelText = '取消' } = options;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-overlay);z-index:500;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:var(--space-xl);width:480px;max-width:90vw">
        ${title ? `<h3 style="margin-bottom:var(--space-md)">${title}</h3>` : ''}
        <div>${body}</div>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg)">
          <button class="btn btn-secondary" id="_modalCancel">${cancelText}</button>
          ${onConfirm ? `<button class="btn btn-primary" id="_modalConfirm">${confirmText}</button>` : ''}
        </div>
      </div>
    `;
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } };
    document.body.appendChild(overlay);
    overlay.querySelector('#_modalCancel')?.addEventListener('click', () => { overlay.remove(); onCancel?.(); });
    overlay.querySelector('#_modalConfirm')?.addEventListener('click', () => { overlay.remove(); onConfirm?.(); });
    return overlay;
  },
  close(el) { el?.remove(); }
};
window.Modal = Modal;
