// Options page controller
class OptionsUI {
  constructor() {
    this.init();
  }

  async init() {
    await Storage.init();
    await this.loadSettings();
    await this.loadCategories();
    this.loadVersion();
    this.setupEventListeners();
  }

  async loadSettings() {
    const settings = await Storage.getSettings();
    
    // Load fuzzy search setting
    document.getElementById('fuzzySearchEnabled').checked = settings.fuzzySearchEnabled ?? true;
    
    // Load equivalent pricing setting
    document.getElementById('equivalentPricingEnabled').checked = settings.equivalentPricingEnabled !== false;
    
    // Default category will be loaded after categories are fetched
    this.defaultCategory = settings.defaultCategory || 'default';
  }

  async loadCategories() {
    const categories = await Storage.getCategories();
    const select = document.getElementById('defaultCategory');
    
    select.innerHTML = categories
      .map(c => `<option value="${c.id}" ${c.id === this.defaultCategory ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`)
      .join('');
  }

  // Load installed extension version from the manifest and display it in the UI
  loadVersion() {
    try {
      const manifest = (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getManifest)
        ? browser.runtime.getManifest()
        : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
          ? chrome.runtime.getManifest()
          : null;
      const version = manifest?.version || '';
      const el = document.getElementById('extensionVersion');
      if (el) el.textContent = version;
    } catch (e) {
      // Fail silently if runtime/method isn't available
    }
  }

  setupEventListeners() {
    // Fuzzy search toggle
    document.getElementById('fuzzySearchEnabled').addEventListener('change', async (e) => {
      await this.saveSetting('fuzzySearchEnabled', e.target.checked);
    });

    // Equivalent pricing toggle
    document.getElementById('equivalentPricingEnabled').addEventListener('change', async (e) => {
      await this.saveSetting('equivalentPricingEnabled', e.target.checked);
    });

    // Default category
    document.getElementById('defaultCategory').addEventListener('change', async (e) => {
      await this.saveSetting('defaultCategory', e.target.value);
    });
  }

  async saveSetting(key, value) {
    const updates = {};
    updates[key] = value;
    
    await Storage.updateSettings(updates);
    this.showStatus();
  }

  showStatus() {
    const status = document.getElementById('status');
    status.classList.add('show');
    
    setTimeout(() => {
      status.classList.remove('show');
    }, 2000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize options UI
const optionsUI = new OptionsUI();
