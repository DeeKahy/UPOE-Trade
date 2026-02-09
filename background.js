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
  
  return false;
});

// Handle browser action click (though we mainly use sidebar)
browser.browserAction?.onClicked.addListener(() => {
  // Open sidebar
  browser.sidebarAction.open().catch(err => {
    console.error('UPOE Trade Manager: Failed to open sidebar:', err);
  });
});

console.log('UPOE Trade Manager: Ready');
