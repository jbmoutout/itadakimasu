// Debug logging
console.log("Background script loaded");

// Listen for messages from the web app
chrome.runtime.onMessageExternal.addListener(function (
  request,
  sender,
  sendResponse
) {
  // Debug logging
  console.log("Received message in background script:", request);
  console.log("Message sender:", sender);

  if (request.type === "ITADAKIMASU_LOGIN") {
    // Debug logging
    console.log("Processing ITADAKIMASU_LOGIN message");

    // Store the token in both local and sync storage
    Promise.all([
      new Promise((resolve, reject) => {
        chrome.storage.local.set({ token: request.token }, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to store in local:",
              chrome.runtime.lastError
            );
            reject(chrome.runtime.lastError);
          } else {
            console.log("Token stored in local storage");
            resolve();
          }
        });
      }),
      new Promise((resolve, reject) => {
        chrome.storage.sync.set({ token: request.token }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to store in sync:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log("Token stored in sync storage");
            resolve();
          }
        });
      }),
    ])
      .then(() => {
        console.log("Token stored in both storage locations");
        // Send success response back to web app
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error storing token:", error);
        // Send error response back to web app
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});
