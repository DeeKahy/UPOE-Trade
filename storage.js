// Storage module for managing saved searches and categories
const Storage = {
  // Default data structure
  defaults: {
    categories: [
      { id: 'default', name: 'Uncategorized', order: 0 }
    ],
    searches: [],
    settings: {
      fuzzySearchEnabled: true,
      defaultCategory: 'default'
    }
  },

  // Initialize storage with defaults if empty
  async init() {
    const data = await browser.storage.local.get(['categories', 'searches', 'settings']);
    
    if (!data.categories) {
      await browser.storage.local.set({ categories: this.defaults.categories });
    }
    if (!data.searches) {
      await browser.storage.local.set({ searches: this.defaults.searches });
    }
    if (!data.settings) {
      await browser.storage.local.set({ settings: this.defaults.settings });
    }
  },

  // Get all categories
  async getCategories() {
    const result = await browser.storage.local.get('categories');
    return result.categories || this.defaults.categories;
  },

  // Get all searches
  async getSearches() {
    const result = await browser.storage.local.get('searches');
    return result.searches || this.defaults.searches;
  },

  // Get settings
  async getSettings() {
    const result = await browser.storage.local.get('settings');
    return result.settings || this.defaults.settings;
  },

  // Save a new search
  async saveSearch(search) {
    const searches = await this.getSearches();
    const newSearch = {
      id: this.generateId(),
      name: search.name,
      category: search.category || 'default',
      url: search.url,
      timestamp: Date.now()
    };
    searches.push(newSearch);
    await browser.storage.local.set({ searches });
    return newSearch;
  },

  // Update an existing search
  async updateSearch(id, updates) {
    const searches = await this.getSearches();
    const index = searches.findIndex(s => s.id === id);
    if (index !== -1) {
      searches[index] = { ...searches[index], ...updates };
      await browser.storage.local.set({ searches });
      return searches[index];
    }
    return null;
  },

  // Delete a search
  async deleteSearch(id) {
    const searches = await this.getSearches();
    const filtered = searches.filter(s => s.id !== id);
    await browser.storage.local.set({ searches: filtered });
    return filtered;
  },

  // Create a new category
  async createCategory(name) {
    const categories = await this.getCategories();
    const newCategory = {
      id: this.generateId(),
      name: name,
      order: categories.length
    };
    categories.push(newCategory);
    await browser.storage.local.set({ categories });
    return newCategory;
  },

  // Update a category
  async updateCategory(id, updates) {
    const categories = await this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates };
      await browser.storage.local.set({ categories });
      return categories[index];
    }
    return null;
  },

  // Delete a category (moves searches to default)
  async deleteCategory(id) {
    if (id === 'default') return null; // Can't delete default category
    
    const categories = await this.getCategories();
    const searches = await this.getSearches();
    
    // Move all searches from this category to default
    const updatedSearches = searches.map(s => 
      s.category === id ? { ...s, category: 'default' } : s
    );
    
    const filtered = categories.filter(c => c.id !== id);
    
    await browser.storage.local.set({ 
      categories: filtered,
      searches: updatedSearches 
    });
    
    return filtered;
  },

  // Update settings
  async updateSettings(updates) {
    const settings = await this.getSettings();
    const newSettings = { ...settings, ...updates };
    await browser.storage.local.set({ settings: newSettings });
    return newSettings;
  },

  // Export all data
  async exportData() {
    const data = await browser.storage.local.get(['categories', 'searches', 'settings']);
    return JSON.stringify(data, null, 2);
  },

  // Import data
  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      await browser.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  },

  // Generate unique ID
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Initialize on load if in background context
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBackgroundPage) {
  Storage.init().catch(console.error);
}

// Make available globally
if (typeof window !== 'undefined') {
  window.Storage = Storage;
}
