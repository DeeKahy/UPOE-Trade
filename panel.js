// Injected panel UI for POE Trade Manager
class TradePanel {
  constructor() {
    this.currentUrl = null;
    this.categories = [];
    this.searches = [];
    this.filteredSearches = [];
    this.isOpen = false;
    this.draggedItem = null;
    this.init();
  }

  async init() {
    await Storage.init();
    await this.loadData();
    this.injectPanel();
    this.setupEventListeners();
    this.render();
    this.checkForCurrentTrade();
  }

  async loadData() {
    this.categories = await Storage.getCategories();
    this.searches = await Storage.getSearches();
    this.filteredSearches = [...this.searches];
  }

  injectPanel() {
    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'upoe-toggle-btn';
    toggleBtn.className = 'upoe-toggle-btn';
    toggleBtn.innerHTML = 'Panel';
    toggleBtn.title = 'Toggle Trade Manager (Alt+T)';
    document.body.appendChild(toggleBtn);

    // Create panel container
    const panel = document.createElement('div');
    panel.id = 'upoe-panel';
    panel.className = 'upoe-panel';
    panel.innerHTML = `
      <div class="upoe-panel-header">
        <h1>Trade Searches</h1>
        <button id="upoe-close-btn" class="upoe-close-btn" title="Close panel">×</button>
      </div>

      <div class="upoe-actions">
        <button id="upoe-save-current" class="upoe-btn upoe-btn-primary" disabled>
          Save Current
        </button>
        <button id="upoe-new-category" class="upoe-btn">
          New Category
        </button>
      </div>

      <div class="upoe-search-bar">
        <input type="text" id="upoe-filter" placeholder="Filter searches..." />
      </div>

      <div id="upoe-categories" class="upoe-categories">
        <!-- Categories and searches rendered here -->
      </div>

      <div id="upoe-empty" class="upoe-empty" style="display: none;">
        <p>No saved searches yet</p>
        <p class="upoe-hint">Set up a trade search and click "Save Current"</p>
      </div>

      <div class="upoe-footer">
        <button id="upoe-export" class="upoe-btn-small">Export</button>
        <button id="upoe-import" class="upoe-btn-small">Import</button>
        <button id="upoe-settings" class="upoe-btn-small">Settings</button>
      </div>
    `;
    document.body.appendChild(panel);

    // Create modals container
    const modals = document.createElement('div');
    modals.id = 'upoe-modals';
    modals.innerHTML = `
      <!-- Save modal -->
      <div id="upoe-save-modal" class="upoe-modal" style="display: none;">
        <div class="upoe-modal-content">
          <h2>Save Trade Search</h2>
          <form id="upoe-save-form">
            <div class="upoe-form-group">
              <label for="upoe-search-name">Search Name</label>
              <input type="text" id="upoe-search-name" required placeholder="e.g., Life/Res Rings">
            </div>
            <div class="upoe-form-group">
              <label for="upoe-search-category">Category</label>
              <select id="upoe-search-category" required></select>
            </div>
            <div class="upoe-form-actions">
              <button type="button" id="upoe-cancel-save" class="upoe-btn">Cancel</button>
              <button type="submit" class="upoe-btn upoe-btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Category modal -->
      <div id="upoe-category-modal" class="upoe-modal" style="display: none;">
        <div class="upoe-modal-content">
          <h2>New Category</h2>
          <form id="upoe-category-form">
            <div class="upoe-form-group">
              <label for="upoe-category-name">Category Name</label>
              <input type="text" id="upoe-category-name" required placeholder="e.g., Current Build">
            </div>
            <div class="upoe-form-actions">
              <button type="button" id="upoe-cancel-category" class="upoe-btn">Cancel</button>
              <button type="submit" class="upoe-btn upoe-btn-primary">Create</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit modal -->
      <div id="upoe-edit-modal" class="upoe-modal" style="display: none;">
        <div class="upoe-modal-content">
          <h2>Edit Search</h2>
          <form id="upoe-edit-form">
            <input type="hidden" id="upoe-edit-id">
            <div class="upoe-form-group">
              <label for="upoe-edit-name">Search Name</label>
              <input type="text" id="upoe-edit-name" required>
            </div>
            <div class="upoe-form-group">
              <label for="upoe-edit-category">Category</label>
              <select id="upoe-edit-category" required></select>
            </div>
            <div class="upoe-form-actions">
              <button type="button" id="upoe-cancel-edit" class="upoe-btn">Cancel</button>
              <button type="submit" class="upoe-btn upoe-btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modals);
  }

  setupEventListeners() {
    // Toggle panel
    document.getElementById('upoe-toggle-btn').addEventListener('click', () => this.togglePanel());
    document.getElementById('upoe-close-btn').addEventListener('click', () => this.togglePanel());

    // Keyboard shortcut (Alt+T)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        this.togglePanel();
      }
    });

    // Save current
    document.getElementById('upoe-save-current').addEventListener('click', () => this.showSaveModal());

    // New category
    document.getElementById('upoe-new-category').addEventListener('click', () => this.showCategoryModal());

    // Filter
    document.getElementById('upoe-filter').addEventListener('input', (e) => this.filterSearches(e.target.value));

    // Footer buttons
    document.getElementById('upoe-export').addEventListener('click', () => this.exportData());
    document.getElementById('upoe-import').addEventListener('click', () => this.importData());
    document.getElementById('upoe-settings').addEventListener('click', () => {
      browser.runtime.openOptionsPage();
    });

    // Modal forms
    document.getElementById('upoe-save-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSearch();
    });
    document.getElementById('upoe-cancel-save').addEventListener('click', () => this.hideModal('upoe-save-modal'));

    document.getElementById('upoe-category-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createCategory();
    });
    document.getElementById('upoe-cancel-category').addEventListener('click', () => this.hideModal('upoe-category-modal'));

    document.getElementById('upoe-edit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEdit();
    });
    document.getElementById('upoe-cancel-edit').addEventListener('click', () => this.hideModal('upoe-edit-modal'));

    // Close modals on backdrop click
    document.querySelectorAll('.upoe-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal(modal.id);
        }
      });
    });
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById('upoe-panel');
    panel.classList.toggle('upoe-panel-open', this.isOpen);
  }

  async checkForCurrentTrade() {
    const url = window.location.href;
    if (url.includes('/trade/search/')) {
      this.currentUrl = url;
      this.updateSaveButton(true);
      console.log('UPOE Panel: Trade URL detected:', url);
    } else {
      this.updateSaveButton(false);
    }
  }

  updateSaveButton(enabled) {
    const btn = document.getElementById('upoe-save-current');
    if (btn) {
      btn.disabled = !enabled;
    }
  }

  render() {
    const container = document.getElementById('upoe-categories');
    const emptyState = document.getElementById('upoe-empty');

    if (this.searches.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    // Render each category
    this.categories.forEach(category => {
      const categorySearches = this.filteredSearches.filter(s => s.category === category.id);
      
      const categoryEl = document.createElement('div');
      categoryEl.className = 'upoe-category';
      categoryEl.dataset.categoryId = category.id;
      
      // Make category droppable
      this.makeDroppable(categoryEl, category.id);
      
      categoryEl.innerHTML = `
        <div class="upoe-category-header">
          <button class="upoe-category-toggle" data-category="${category.id}">
            <span class="upoe-arrow">▼</span>
          </button>
          <span class="upoe-category-name">${this.escapeHtml(category.name)}</span>
          <span class="upoe-category-count">(${categorySearches.length})</span>
          ${category.id !== 'default' ? `
            <button class="upoe-category-delete" data-category="${category.id}" title="Delete category">×</button>
          ` : ''}
        </div>
        <div class="upoe-category-searches" data-category="${category.id}">
          ${categorySearches.map(search => this.renderSearch(search)).join('')}
        </div>
      `;

      container.appendChild(categoryEl);
    });

    // Attach event listeners to rendered elements
    this.attachSearchListeners();
  }

  renderSearch(search) {
    const date = new Date(search.timestamp);
    const formattedDate = date.toLocaleDateString();
    
    return `
      <div class="upoe-search-item" draggable="true" data-id="${search.id}" data-category="${search.category}">
        <div class="upoe-drag-handle">⋮⋮</div>
        <a href="${this.escapeHtml(search.url)}" class="upoe-search-link" data-url="${this.escapeHtml(search.url)}">
          <div class="upoe-search-name">${this.escapeHtml(search.name)}</div>
          <div class="upoe-search-date">${formattedDate}</div>
        </a>
        <div class="upoe-search-actions">
          <button class="upoe-btn-icon upoe-edit-search" data-id="${search.id}" title="Edit">Edit</button>
          <button class="upoe-btn-icon upoe-delete-search" data-id="${search.id}" title="Delete">Delete</button>
        </div>
      </div>
    `;
  }

  attachSearchListeners() {
    // Category toggles
    document.querySelectorAll('.upoe-category-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const categoryId = e.currentTarget.dataset.category;
        this.toggleCategory(categoryId);
      });
    });

    // Category delete
    document.querySelectorAll('.upoe-category-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const categoryId = e.currentTarget.dataset.category;
        if (confirm('Delete this category? Searches will be moved to Uncategorized.')) {
          await Storage.deleteCategory(categoryId);
          await this.loadData();
          this.render();
        }
      });
    });

    // Search links
    document.querySelectorAll('.upoe-search-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = e.currentTarget.dataset.url;
        window.location.href = url;
      });
    });

    // Edit search
    document.querySelectorAll('.upoe-edit-search').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const searchId = e.currentTarget.dataset.id;
        this.showEditModal(searchId);
      });
    });

    // Delete search
    document.querySelectorAll('.upoe-delete-search').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const searchId = e.currentTarget.dataset.id;
        if (confirm('Delete this saved search?')) {
          await Storage.deleteSearch(searchId);
          await this.loadData();
          this.render();
        }
      });
    });

    // Drag and drop for search items
    document.querySelectorAll('.upoe-search-item').forEach(item => {
      item.addEventListener('dragstart', (e) => this.handleDragStart(e));
      item.addEventListener('dragend', (e) => this.handleDragEnd(e));
    });
  }

  handleDragStart(e) {
    this.draggedItem = {
      id: e.target.dataset.id,
      category: e.target.dataset.category
    };
    e.target.classList.add('upoe-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
  }

  handleDragEnd(e) {
    e.target.classList.remove('upoe-dragging');
    // Remove all drag-over classes
    document.querySelectorAll('.upoe-drag-over').forEach(el => {
      el.classList.remove('upoe-drag-over');
    });
  }

  makeDroppable(element, categoryId) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('upoe-drag-over');
    });

    element.addEventListener('dragleave', (e) => {
      if (e.target === element) {
        element.classList.remove('upoe-drag-over');
      }
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      element.classList.remove('upoe-drag-over');
      
      if (this.draggedItem && this.draggedItem.category !== categoryId) {
        // Move search to new category
        await Storage.updateSearch(this.draggedItem.id, { category: categoryId });
        await this.loadData();
        this.render();
        console.log(`Moved search ${this.draggedItem.id} to category ${categoryId}`);
      }
      
      this.draggedItem = null;
    });
  }

  toggleCategory(categoryId) {
    const categoryEl = document.querySelector(`.upoe-category-searches[data-category="${categoryId}"]`);
    const toggle = document.querySelector(`.upoe-category-toggle[data-category="${categoryId}"] .upoe-arrow`);
    
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
    if (!this.currentUrl) {
      alert('Please navigate to a Path of Exile trade search first');
      return;
    }

    const select = document.getElementById('upoe-search-category');
    select.innerHTML = this.categories
      .map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`)
      .join('');
    
    document.getElementById('upoe-search-name').value = '';
    this.showModal('upoe-save-modal');
    document.getElementById('upoe-search-name').focus();
  }

  async saveSearch() {
    const name = document.getElementById('upoe-search-name').value.trim();
    const category = document.getElementById('upoe-search-category').value;

    if (!name) return;

    await Storage.saveSearch({
      name,
      category,
      url: this.currentUrl
    });

    await this.loadData();
    this.render();
    this.hideModal('upoe-save-modal');
    this.showNotification('Search saved!', 'success');
  }

  showCategoryModal() {
    document.getElementById('upoe-category-name').value = '';
    this.showModal('upoe-category-modal');
    document.getElementById('upoe-category-name').focus();
  }

  async createCategory() {
    const name = document.getElementById('upoe-category-name').value.trim();
    if (!name) return;

    await Storage.createCategory(name);
    await this.loadData();
    this.hideModal('upoe-category-modal');
    this.render();
    this.showNotification('Category created!', 'success');
  }

  showEditModal(searchId) {
    const search = this.searches.find(s => s.id === searchId);
    if (!search) return;

    const select = document.getElementById('upoe-edit-category');
    select.innerHTML = this.categories
      .map(c => `<option value="${c.id}" ${c.id === search.category ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`)
      .join('');
    
    document.getElementById('upoe-edit-id').value = searchId;
    document.getElementById('upoe-edit-name').value = search.name;
    this.showModal('upoe-edit-modal');
    document.getElementById('upoe-edit-name').focus();
  }

  async saveEdit() {
    const id = document.getElementById('upoe-edit-id').value;
    const name = document.getElementById('upoe-edit-name').value.trim();
    const category = document.getElementById('upoe-edit-category').value;

    if (!name) return;

    await Storage.updateSearch(id, { name, category });
    await this.loadData();
    this.render();
    this.hideModal('upoe-edit-modal');
    this.showNotification('Search updated!', 'success');
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
    this.showNotification('Data exported!', 'success');
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
          this.showNotification('Import successful!', 'success');
        } else {
          this.showNotification('Import failed', 'error');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
  }

  hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `upoe-notification upoe-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('upoe-notification-show'), 100);
    
    setTimeout(() => {
      notification.classList.remove('upoe-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.tradePanel = new TradePanel();
  });
} else {
  window.tradePanel = new TradePanel();
}
