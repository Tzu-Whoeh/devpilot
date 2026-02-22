/* ═══ Placeholder Page Template ═══
 * 用于尚未实现的页面的通用占位模板
 */
function renderPlaceholder(title, icon, desc) {
  return `
    <div class="page-container">
      <div class="empty-state">
        <div class="empty-icon">${icon || '🚧'}</div>
        <div class="empty-title">${title || '开发中'}</div>
        <div class="empty-desc">${desc || '此功能正在开发中，敬请期待'}</div>
      </div>
    </div>
  `;
}
window.renderPlaceholder = renderPlaceholder;
