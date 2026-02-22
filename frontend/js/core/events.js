/* ═══ EventBus — Pub/Sub ═══ */
const EventBus = {
  _handlers: {},
  on(event, fn) {
    (this._handlers[event] = this._handlers[event] || []).push(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    const h = this._handlers[event];
    if (h) this._handlers[event] = h.filter(f => f !== fn);
  },
  emit(event, data) {
    (this._handlers[event] || []).forEach(fn => {
      try { fn(data); } catch(e) { console.error(`EventBus [${event}]:`, e); }
    });
  }
};
window.EventBus = EventBus;
