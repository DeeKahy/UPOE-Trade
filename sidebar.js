// Sidebar UI controller
class SidebarUI {
  constructor() {
    this.currentUrl = null;
    this.categories = [];
    this.searches = [];
    this.filteredSearches = [];
    this.init();
  }

  async init() {
    await Storage.init();
    await this.loadData();
    this.loadQuickLinksState();
    this.setupEventListeners();
    this.render();
    this.updateSaveButton(false); // Start disabled
    this.checkForCurrentTrade();
  }

  async loadData() {
    this.categories = await Storage.getCategories();
    this.searches = await Storage.getSearches();
    this.filteredSearches = [...this.searches];
  }

  setupEventListeners() {
    // Save current search
    document.getElementById('saveCurrentBtn').addEventListener('click', () => {
      this.showSaveModal();
    });

    // New category
    document.getElementById('newCategoryBtn').addEventListener('click', () => {
      this.showCategoryModal();
    });

    // Export/Import
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });
    document.getElementById('importBtn').addEventListener('click', () => {
      this.importData();
    });

    // Settings
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (browser.runtime.openOptionsPage) {
          browser.runtime.openOptionsPage();
        }
      });
    }

    // Filter
    document.getElementById('filterInput').addEventListener('input', (e) => {
      this.filterSearches(e.target.value);
    });

    // Quick links toggle
    const quickLinksToggle = document.getElementById('quickLinksToggle');
    if (quickLinksToggle) {
      quickLinksToggle.addEventListener('click', () => {
        this.toggleQuickLinks();
      });
    }

    // Modal forms
    document.getElementById('saveForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSearch();
    });
    document.getElementById('cancelSaveBtn').addEventListener('click', () => {
      this.hideSaveModal();
    });

    document.getElementById('categoryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createCategory();
    });
    document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('editForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEdit();
    });
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      this.hideEditModal();
    });

    // Confirm modal
    document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
      this.hideConfirmModal();
    });

    // Listen for messages from content script
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'tradeUrlDetected') {
        this.currentUrl = message.url;
        this.updateSaveButton(!!message.url);
        console.log('UPOE Sidebar: Received trade URL:', message.url);
      }
    });
  }

  loadQuickLinksState() {
    const quickLinks = document.getElementById('quickLinks');
    const quickLinksToggle = document.getElementById('quickLinksToggle');
    if (!quickLinks || !quickLinksToggle) return;

    const saved = localStorage.getItem('upoe.quickLinksCollapsed');
    const isCollapsed = saved === 'true';
    if (isCollapsed) {
      quickLinks.classList.add('collapsed');
      quickLinksToggle.setAttribute('aria-expanded', 'false');
    } else {
      quickLinks.classList.remove('collapsed');
      quickLinksToggle.setAttribute('aria-expanded', 'true');
    }
  }

  toggleQuickLinks() {
    const quickLinks = document.getElementById('quickLinks');
    const quickLinksToggle = document.getElementById('quickLinksToggle');
    if (!quickLinks || !quickLinksToggle) return;

    const isCollapsed = quickLinks.classList.toggle('collapsed');
    quickLinksToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    localStorage.setItem('upoe.quickLinksCollapsed', isCollapsed ? 'true' : 'false');
  }

  async checkForCurrentTrade() {
    // Ask content script for current URL
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        // First check the tab URL directly
        if (tabs[0].url && tabs[0].url.includes('pathofexile.com/trade/search/')) {
          this.currentUrl = tabs[0].url;
          this.updateSaveButton(true);
          console.log('UPOE Sidebar: Initial trade URL detected:', tabs[0].url);
        } else {
          console.log('UPOE Sidebar: No trade URL detected, current URL:', tabs[0]?.url);
        }
        
        // Also ask the content script directly (it might have a more up-to-date URL)
        try {
          const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'requestCurrentUrl' });
          if (response && response.url) {
            this.currentUrl = response.url;
            this.updateSaveButton(true);
            console.log('UPOE Sidebar: Got URL from content script:', response.url);
          }
        } catch (msgError) {
          console.log('UPOE Sidebar: Could not reach content script (page might not be a trade page)');
        }
      }
    } catch (error) {
      console.error('UPOE Sidebar: Error checking current trade:', error);
    }
  }

  updateSaveButton(enabled) {
    const btn = document.getElementById('saveCurrentBtn');
    if (btn) {
      btn.disabled = !enabled;
      btn.title = enabled ? 'Save current trade search' : 'Navigate to a POE trade search first';
      console.log('UPOE Sidebar: Save button updated, enabled:', enabled);
    } else {
      console.error('UPOE Sidebar: Save button not found in DOM!');
    }
  }

  render() {
    const container = document.getElementById('categoriesContainer');
    const emptyState = document.getElementById('emptyState');

    console.log('UPOE Sidebar: Rendering. Categories:', this.categories.length, 'Searches:', this.searches.length);

    if (this.searches.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    // Render categories and their searches
    this.categories.forEach(category => {
      const categorySearches = this.filteredSearches.filter(s => s.category === category.id);
      
      console.log('UPOE Sidebar: Rendering category:', category.name, 'with', categorySearches.length, 'searches');
      
      const categoryEl = document.createElement('div');
      categoryEl.className = 'category';
      categoryEl.innerHTML = `
        <div class="category-header">
          <button class="category-toggle" data-category="${category.id}">
            <span class="arrow">▼</span>
          </button>
          <span class="category-name">${this.escapeHtml(category.name)}</span>
          <span class="category-count">(${categorySearches.length})</span>
          ${category.id !== 'default' ? `
            <button class="category-delete" data-category="${category.id}" title="Delete category">×</button>
          ` : ''}
        </div>
        <div class="category-searches" data-category="${category.id}">
          ${categorySearches.map(search => this.renderSearch(search)).join('')}
        </div>
      `;

      container.appendChild(categoryEl);
    });

    // Attach event listeners to dynamically created elements
    this.attachSearchListeners();
  }

  renderSearch(search) {
    const date = new Date(search.timestamp);
    const formattedDate = date.toLocaleDateString();
    
    return `
      <div class="search-item" data-id="${search.id}">
        <a href="${this.escapeHtml(search.url)}" class="search-link" data-url="${this.escapeHtml(search.url)}">
          <div class="search-name">${this.escapeHtml(search.name)}</div>
          <div class="search-date">${formattedDate}</div>
        </a>
        <div class="search-actions">
          <button class="btn-icon edit-search" data-id="${search.id}" title="Edit">Edit</button>
          <button class="btn-icon delete-search" data-id="${search.id}" title="Delete">Delete</button>
        </div>
      </div>
    `;
  }

  attachSearchListeners() {
    // Category toggles
    document.querySelectorAll('.category-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const categoryId = e.currentTarget.dataset.category;
        this.toggleCategory(categoryId);
      });
    });

    // Category delete
    document.querySelectorAll('.category-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const categoryId = e.currentTarget.dataset.category;
        const confirmed = await this.showConfirmModal(
          'Delete Category',
          'Delete this category? Searches will be moved to Uncategorized.'
        );
        if (confirmed) {
          await Storage.deleteCategory(categoryId);
          await this.loadData();
          this.render();
        }
      });
    });

    // Search links
    document.querySelectorAll('.search-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = e.currentTarget.dataset.url;
        await browser.tabs.update({ url });
      });
    });

    // Edit search
    document.querySelectorAll('.edit-search').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const searchId = e.currentTarget.dataset.id;
        this.showEditModal(searchId);
      });
    });

    // Delete search
    document.querySelectorAll('.delete-search').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const searchId = e.currentTarget.dataset.id;
        const confirmed = await this.showConfirmModal(
          'Delete Search',
          'Delete this saved search?'
        );
        if (confirmed) {
          await Storage.deleteSearch(searchId);
          await this.loadData();
          this.render();
        }
      });
    });
  }

  toggleCategory(categoryId) {
    const categoryEl = document.querySelector(`.category-searches[data-category="${categoryId}"]`);
    const toggle = document.querySelector(`.category-toggle[data-category="${categoryId}"] .arrow`);
    
    if (categoryEl.style.display === 'none') {
      categoryEl.style.display = 'block';
      toggle.textContent = '▼';
    } else {
      categoryEl.style.display = 'none';
      toggle.textContent = '▶';
    }
  }

  filterSearches(query) {
    const lowerQuery = query.toLowerCase();
    this.filteredSearches = this.searches.filter(s => 
      s.name.toLowerCase().includes(lowerQuery)
    );
    this.render();
  }

  async showSaveModal() {
    console.log('UPOE Sidebar: showSaveModal called, currentUrl:', this.currentUrl);
    if (!this.currentUrl) {
      alert('Please navigate to a Path of Exile trade search first');
      return;
    }

    const modal = document.getElementById('saveModal');
    const select = document.getElementById('searchCategory');
    
    // Populate categories
    select.innerHTML = this.categories
      .map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`)
      .join('');
    
    document.getElementById('searchName').value = '';
    modal.style.display = 'flex';
    document.getElementById('searchName').focus();
  }

  hideSaveModal() {
    document.getElementById('saveModal').style.display = 'none';
  }

  async saveSearch() {
    const name = document.getElementById('searchName').value.trim();
    const category = document.getElementById('searchCategory').value;

    if (!name) return;

    await Storage.saveSearch({
      name,
      category,
      url: this.currentUrl
    });

    await this.loadData();
    this.render();
    this.hideSaveModal();
  }

  showCategoryModal() {
    const modal = document.getElementById('categoryModal');
    document.getElementById('categoryName').value = '';
    modal.style.display = 'flex';
    document.getElementById('categoryName').focus();
  }

  hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
  }

  async createCategory() {
    const name = document.getElementById('categoryName').value.trim();
    if (!name) return;

    await Storage.createCategory(name);
    await this.loadData();
    this.hideCategoryModal();
    this.render();
    console.log('UPOE Sidebar: Category created, categories:', this.categories);
  }

  showEditModal(searchId) {
    const search = this.searches.find(s => s.id === searchId);
    if (!search) return;

    const modal = document.getElementById('editModal');
    const select = document.getElementById('editSearchCategory');
    
    // Populate categories
    select.innerHTML = this.categories
      .map(c => `<option value="${c.id}" ${c.id === search.category ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`)
      .join('');
    
    document.getElementById('editSearchId').value = searchId;
    document.getElementById('editSearchName').value = search.name;
    modal.style.display = 'flex';
    document.getElementById('editSearchName').focus();
  }

  showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      
      const okBtn = document.getElementById('okConfirmBtn');
      const cancelBtn = document.getElementById('cancelConfirmBtn');
      
      const handleOk = () => {
        cleanup();
        resolve(true);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      const cleanup = () => {
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.style.display = 'none';
      };
      
      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);
      
      modal.style.display = 'flex';
    });
  }

  hideConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
  }

  hideEditModal() {
    document.getElementById('editModal').style.display = 'none';
  }

  async saveEdit() {
    const id = document.getElementById('editSearchId').value;
    const name = document.getElementById('editSearchName').value.trim();
    const category = document.getElementById('editSearchCategory').value;

    if (!name) return;

    await Storage.updateSearch(id, { name, category });
    await this.loadData();
    this.render();
    this.hideEditModal();
  }

  async exportData() {
    const data = await Storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `poe-trade-searches-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const success = await Storage.importData(event.target.result);
        if (success) {
          await this.loadData();
          this.render();
          alert('Import successful!');
        } else {
          alert('Import failed. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the sidebar UI
const ui = new SidebarUI();
