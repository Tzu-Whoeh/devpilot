/* ═══ AppState — localStorage Persistence ═══ */
const AppState = {
  _data: {},
  _key: 'devpilot_state',

  init() {
    try {
      const saved = localStorage.getItem(this._key);
      if (saved) this._data = JSON.parse(saved);
    } catch(e) { this._data = {}; }
  },

  get(key, fallback) {
    return key in this._data ? this._data[key] : fallback;
  },

  set(key, value) {
    this._data[key] = value;
    this._save();
    EventBus.emit('state:change', { key, value });
  },

  remove(key) {
    delete this._data[key];
    this._save();
  },

  clear() {
    this._data = {};
    this._save();
  },

  _save() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch(e) {}
  },

  // Auth helpers
  get token() { return this.get('token', ''); },
  set token(v) { this.set('token', v); },
  get user() { return this.get('user', null); },
  set user(v) { this.set('user', v); },
  get isLoggedIn() { return !!this.token && !!this.user; },

  // Projects (mock persistence)
  get projects() { return this.get('projects', []); },
  set projects(v) { this.set('projects', v); },
};

AppState.init();
window.AppState = AppState;
