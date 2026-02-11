// Background script for handling extension lifecycle and messaging
console.log('UPOE Trade Manager: Background script loaded');

// Initialize storage on install
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('UPOE Trade Manager: First install, initializing storage');
    await Storage.init();
  } else if (details.reason === 'update') {
    console.log('UPOE Trade Manager: Extension updated');
    // Could handle migrations here if needed
  }
});

// Handle messages from content scripts and sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('UPOE Trade Manager: Received message:', message.type);
  
  if (message.type === 'tradeUrlDetected') {
    // Forward to sidebar if it's open
    // This is handled by the sidebar listening directly
    return false;
  }
  
  // Handle poe.ninja API requests (to bypass CORS in content scripts)
  if (message.type === 'fetchPoeNinja') {
    fetch(message.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('UPOE Trade Manager: poe.ninja fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  return false;
});

console.log('UPOE Trade Manager: Ready');
