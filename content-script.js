// Content script that runs on pathofexile.com/trade pages
(async function() {
  'use strict';

  console.log('UPOE Trade Manager: Content script loaded');

  let currentTradeUrl = null;

  // Initialize
  async function init() {
    await checkIfTradeSearch();
    observeUrlChanges();
    loadFuzzySearch();
    loadEquivalentPricing();
  }

  // Check if current page is a trade search
  async function checkIfTradeSearch() {
    const url = window.location.href;
    
    // Save any trade search URL (POE generates unique URLs for each search)
    if (url.includes('/trade/search/')) {
      currentTradeUrl = url;
      notifySidebar(url);
      console.log('UPOE Trade Manager: Trade search detected:', url);
    } else {
      currentTradeUrl = null;
      notifySidebar(null);
    }
  }

  // Notify sidebar about current URL
  function notifySidebar(url) {
    browser.runtime.sendMessage({
      type: 'tradeUrlDetected',
      url: url
    }).catch(err => {
      // Sidebar might not be open, that's okay
      console.log('UPOE Trade Manager: Could not reach sidebar:', err.message);
    });
  }

  // Watch for URL changes (trade site is a SPA)
  function observeUrlChanges() {
    let lastUrl = window.location.href;
    
    // Watch for pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      urlChanged();
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      urlChanged();
    };
    
    // Also watch for popstate events
    window.addEventListener('popstate', urlChanged);
    
    // Poll as backup (in case we miss something)
    setInterval(() => {
      if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
        urlChanged();
      }
    }, 1000);
  }

  function urlChanged() {
    checkIfTradeSearch();
  }

  // Load fuzzy search feature if enabled
  async function loadFuzzySearch() {
    try {
      const settings = await Storage.getSettings();
      
      if (settings.fuzzySearchEnabled) {
        console.log('UPOE Trade Manager: Fuzzy search enabled');
        enableFuzzySearch();
      } else {
        console.log('UPOE Trade Manager: Fuzzy search disabled');
      }
    } catch (error) {
      console.error('UPOE Trade Manager: Error loading fuzzy search setting:', error);
    }
  }

  // Load equivalent pricing feature if enabled
  async function loadEquivalentPricing() {
    try {
      const settings = await Storage.getSettings();
      const enabled = settings.equivalentPricingEnabled !== false; // Default to true
      
      if (enabled && typeof EquivalentPricing !== 'undefined') {
        console.log('UPOE Trade Manager: Equivalent Pricing enabled');
        await EquivalentPricing.init();
      } else if (!enabled) {
        console.log('UPOE Trade Manager: Equivalent Pricing disabled');
      }
    } catch (error) {
      console.error('UPOE Trade Manager: Error loading equivalent pricing:', error);
    }
  }

  // Enable fuzzy search functionality
  function enableFuzzySearch() {
    document.body.addEventListener("keydown", appendFuzzyToTarget);
    document.body.addEventListener("paste", function(e) {
      setTimeout(appendFuzzyToTarget, 0, e);
    });
    
    console.log('UPOE Trade Manager: Fuzzy search active');
  }

  function appendFuzzyToTarget(e) {
    if (e.target.classList.contains("multiselect__input")) {
      if (e.target.selectionStart === e.target.selectionEnd) {
        if (!e.target.value.startsWith("~") && !e.target.value.startsWith(" ") && e.key !== " ") {
          e.target.value = "~" + e.target.value;
        }
      }
    }
  }

  // Listen for settings changes
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings.fuzzySearchEnabled) {
        enableFuzzySearch();
      } else {
        // Note: Can't easily disable without page reload
        console.log('UPOE Trade Manager: Fuzzy search will disable on next page load');
      }
      
      // Handle equivalent pricing setting change
      if (typeof EquivalentPricing !== 'undefined') {
        const epEnabled = newSettings.equivalentPricingEnabled !== false;
        EquivalentPricing.setEnabled(epEnabled);
      }
    }
  });

  // Listen for requests from sidebar
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'requestCurrentUrl') {
      sendResponse({ url: currentTradeUrl });
      return true;
    }
  });

  // Start the extension
  init();

})();
