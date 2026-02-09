// Options page controller
class OptionsUI {
  constructor() {
    this.init();
  }

  async init() {
    await Storage.init();
    await this.loadSettings();
    await this.loadCategories();
    this.setupEventListeners();
  }

  async loadSettings() {
    const settings = await Storage.getSettings();
    
    // Load fuzzy search setting
    document.getElementById('fuzzySearchEnabled').checked = settings.fuzzySearchEnabled ?? true;
    
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

  setupEventListeners() {
    // Fuzzy search toggle
    document.getElementById('fuzzySearchEnabled').addEventListener('change', async (e) => {
      await this.saveSetting('fuzzySearchEnabled', e.target.checked);
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
