// Equivalent Pricing Calculator - Powered by poe.ninja
// Shows chaos/divine equivalent prices for trade listings

const EquivalentPricing = {
  // Configuration
  config: {
    CACHE_DURATION: 3600000, // 1 hour
    CACHE_KEY: 'poe-ninja-chaos-ratios',
    POE_NINJA_API: 'https://poe.ninja/api/data/currencyoverview',
  },


  // State
  chaosRatios: null,
  currentLeague: null,
  observer: null,
  enabled: true,

  // Initialize the feature
  async init() {
    console.log('UPOE Trade Manager: Equivalent Pricing initializing...');
    
    // Ensure we don't have duplicate observers from previous inits
    this.destroy();

    // Check if enabled in settings
    try {
      const settings = await Storage.getSettings();
      this.enabled = settings.equivalentPricingEnabled !== false; // Default to true
    } catch (e) {
      this.enabled = true;
    }

    if (!this.enabled) {
      console.log('UPOE Trade Manager: Equivalent Pricing disabled');
      return;
    }

    // Only run on trade pages
    if (!window.location.href.includes('pathofexile.com/trade')) {
      return;
    }

    // Detect current league from URL
    this.currentLeague = this.detectLeague();
    if (!this.currentLeague) {
      console.log('UPOE Trade Manager: Could not detect league');
      return;
    }

    console.log('UPOE Trade Manager: Detected league:', this.currentLeague);

    // Fetch currency ratios
    await this.fetchChaosRatios();

    // Start observing trade results
    this.startObserver();

    // Process any existing results
    this.processExistingResults();
    
    console.log('UPOE Trade Manager: Equivalent Pricing ready');
  },

  // Detect league from URL (e.g., /trade/search/Settlers)
  detectLeague() {
    const url = window.location.href;
    
    // Match patterns like /trade/search/LeagueName or /trade/exchange/LeagueName
    const match = url.match(/\/trade\/(?:search|exchange)\/([^/?#]+)/);
    if (match) {
      // Decode URL-encoded league name
      return decodeURIComponent(match[1]);
    }
    
    return null;
  },

  // Fetch chaos ratios from poe.ninja (via background script to bypass CORS)
  async fetchChaosRatios() {
    // Try to get cached ratios first
    const cached = await this.getCachedRatios();
    if (cached) {
      this.chaosRatios = cached;
      console.log('UPOE Trade Manager: Using cached currency ratios');
      return;
    }

    try {
      const url = `${this.config.POE_NINJA_API}?league=${encodeURIComponent(this.currentLeague)}&type=Currency`;
      console.log('UPOE Trade Manager: Fetching currency ratios from poe.ninja...');
      
      // Use background script to fetch (bypasses CORS restrictions)
      const response = await browser.runtime.sendMessage({
        type: 'fetchPoeNinja',
        url: url
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to fetch from poe.ninja');
      }
      
      this.chaosRatios = this.parseCurrencyData(response.data);
      
      // Cache the ratios
      await this.cacheRatios(this.chaosRatios);
      
      console.log('UPOE Trade Manager: Currency ratios loaded:', Object.keys(this.chaosRatios).length, 'currencies');
    } catch (error) {
      console.error('UPOE Trade Manager: Failed to fetch currency ratios:', error);
      this.chaosRatios = null;
    }
  },

  // Parse poe.ninja currency data into ratios
  parseCurrencyData(data) {
    const ratios = {};
    
    if (!data.lines || !Array.isArray(data.lines)) {
      return ratios;
    }

    for (const line of data.lines) {
      if (line.currencyTypeName && line.chaosEquivalent) {
        const slug = this.slugify(line.currencyTypeName);
        ratios[slug] = line.chaosEquivalent;
      }
    }

    return ratios;
  },

  // Convert currency name to slug (matching poe trade site format)
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  // Get cached ratios from storage
  async getCachedRatios() {
    try {
      const result = await browser.storage.local.get(this.config.CACHE_KEY);
      const cached = result[this.config.CACHE_KEY];
      
      if (!cached) return null;
      
      // Check if cache is still valid and for current league
      if (cached.league !== this.currentLeague) return null;
      if (Date.now() - cached.timestamp > this.config.CACHE_DURATION) return null;
      
      return cached.ratios;
    } catch (e) {
      return null;
    }
  },

  // Cache ratios in storage
  async cacheRatios(ratios) {
    try {
      const cacheData = {
        ratios: ratios,
        league: this.currentLeague,
        timestamp: Date.now()
      };
      await browser.storage.local.set({ [this.config.CACHE_KEY]: cacheData });
    } catch (e) {
      console.error('UPOE Trade Manager: Failed to cache ratios:', e);
    }
  },

  // Start observing DOM for trade results
  startObserver() {
    // Find the trade app container
    const tradeApp = document.getElementById('trade');
    if (!tradeApp || !tradeApp.parentElement) {
      console.log('UPOE Trade Manager: Trade app not found, retrying...');
      setTimeout(() => this.startObserver(), 1000);
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      // Debounce processing
      clearTimeout(this.processTimeout);
      this.processTimeout = setTimeout(() => this.processUnenhancedResults(), 100);
    });

    this.observer.observe(tradeApp.parentElement, {
      childList: true,
      subtree: true
    });

    console.log('UPOE Trade Manager: Observer started');
  },

  // Process existing results on page
  processExistingResults() {
    setTimeout(() => this.processUnenhancedResults(), 500);
  },

  // Find and process unenhanced result rows
  processUnenhancedResults() {
    if (!this.chaosRatios || !this.enabled) return;

    // Find all result rows that haven't been enhanced yet
    const rows = document.querySelectorAll('.resultset > div.row[data-id]:not([upoe-enhanced])');
    
    for (const row of rows) {
      // Skip exchange results
      if (row.classList.contains('exchange')) continue;
      
      this.enhanceRow(row);
      row.setAttribute('upoe-enhanced', 'true');
    }
  },

  // Enhance a single result row with equivalent pricing
  enhanceRow(row) {
    const priceContainer = row.querySelector('.price');
    const currencyImage = row.querySelector('[data-field="price"] .currency-image img');
    
    if (!priceContainer || !currencyImage) return;

    // Parse the price
    const price = this.parsePrice(row);
    if (!price.value || !price.currencySlug) return;

    const chaosValue = this.chaosRatios[price.currencySlug];
    const divineValue = this.chaosRatios['divine-orb'];

    // Handle non-chaos priced items - show chaos equivalent
    if (chaosValue && price.currencySlug !== 'chaos-orb') {
      const chaosEquivalent = Math.round(price.value * chaosValue);
      if (chaosEquivalent > 0) {
        priceContainer.appendChild(this.createChaosEquivalent(chaosEquivalent));

        // Also show breakdown for fractional currency amounts
        const flooredValue = Math.floor(price.value);
        if (flooredValue > 0 && flooredValue !== price.value && chaosValue >= 1) {
          const chaosFraction = Math.round((price.value - flooredValue) * chaosValue);
          if (chaosFraction > 0) {
            priceContainer.appendChild(
              this.createFractionBreakdown(flooredValue, currencyImage.src, currencyImage.alt, chaosFraction)
            );
          }
        }
      }
    }
    // Handle chaos priced items - show divine equivalent if significant
    else if (price.currencySlug === 'chaos-orb' && divineValue) {
      const divineEquivalent = price.value / divineValue;
        const roundedDivine = Math.round(divineEquivalent * 10) / 10;
        priceContainer.appendChild(this.createDivineEquivalent(roundedDivine));
    }
  },

  // Parse price from result row
  parsePrice(row) {
    const currencyTextElement = row.querySelector('[data-field="price"] .currency-text span');
    const priceValueElement = row.querySelector('[data-field="price"] > br + span');

    let currencySlug = null;
    let value = null;

    if (currencyTextElement && currencyTextElement.textContent) {
      currencySlug = this.slugify(currencyTextElement.textContent.trim());
    }

    if (priceValueElement && priceValueElement.textContent) {
      value = parseFloat(priceValueElement.textContent);
    }

    return { currencySlug, value };
  },

  // Map currency alt text to short labels (chaos -> C, divine -> div, else short 3-char)
  currencyShortForAlt(alt) {
    const a = (alt || '').toLowerCase();
    if (a.includes('chaos')) return 'C';
    if (a.includes('divine')) return 'div';
    // fallback: first 3 letters (preserve case from alt if provided)
    return alt ? alt.slice(0, 3) : '';
  },

  // Create chaos equivalent element (text label instead of icon)
  createChaosEquivalent(value) {
    const el = document.createElement('span');
    el.className = 'upoe-equivalent-pricing';
    const label = document.createElement('span');
    label.className = 'upoe-currency-text';
    label.textContent = 'C';
    el.innerHTML = `<span class="upoe-equals">=</span>${value}×`;
    el.appendChild(label);
    return el;
  },

  // Create divine equivalent element (text label instead of icon)
  createDivineEquivalent(value) {
    const el = document.createElement('span');
    el.className = 'upoe-equivalent-pricing';
    const label = document.createElement('span');
    label.className = 'upoe-currency-text';
    label.textContent = 'div';
    el.innerHTML = `<span class="upoe-equals">=</span>${value}×`;
    el.appendChild(label);
    return el;
  },

  createFractionBreakdown(wholeUnits, currencyAlt, chaosFraction) {
    const el = document.createElement('span');
    el.className = 'upoe-equivalent-pricing';
    const short = this.currencyShortForAlt(currencyAlt);
    const labelMain = document.createElement('span');
    labelMain.className = 'upoe-currency-text';
    labelMain.textContent = short;
    const labelChaos = document.createElement('span');
    labelChaos.className = 'upoe-currency-text';
    labelChaos.textContent = 'C';
    el.innerHTML = `<span class="upoe-equals">=</span>${wholeUnits}×`;
    el.appendChild(labelMain);
    el.innerHTML += `+${chaosFraction}×`;
    el.appendChild(labelChaos);
    return el;
  },

  // Clean up observer
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  },

  // Toggle feature on/off
  async setEnabled(enabled) {
    this.enabled = enabled;
    
    if (enabled && !this.chaosRatios) {
      await this.init();
    } else if (!enabled) {
      // Stop observing and remove all enhanced elements
      this.destroy();

      const enhanced = document.querySelectorAll('[upoe-enhanced]');
      for (const el of enhanced) {
        el.removeAttribute('upoe-enhanced');
        const pricings = el.querySelectorAll('.upoe-equivalent-pricing');
        for (const p of pricings) {
          p.remove();
        }
      }
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EquivalentPricing = EquivalentPricing;
}
