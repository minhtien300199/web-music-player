chrome.runtime.onInstalled.addListener(() => {
  console.log('Music Control Extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
});

let mediaTabId = null;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tabId === mediaTabId) {
    mediaTabId = null;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === mediaTabId) {
    mediaTabId = null;
  }
});

async function findMediaTab() {
  if (mediaTabId) {
    try {
      const tab = await chrome.tabs.get(mediaTabId);
      if (tab) return tab;
    } catch (e) {
      mediaTabId = null;
    }
  }

  const audibleTabs = await chrome.tabs.query({ audible: true });
  for (const tab of audibleTabs) {
    if (tab.url && (tab.url.includes('youtube.com') || tab.url.includes('spotify.com') || tab.url.includes('soundcloud.com'))) {
      mediaTabId = tab.id;
      return tab;
    }
  }

  if (audibleTabs.length > 0) {
    mediaTabId = audibleTabs[0].id;
    return audibleTabs[0];
  }

  return null;
}

async function forwardToMediaTab(action, data = {}) {
  const tab = await findMediaTab();
  if (!tab) {
    return { success: false, error: 'No media tab found' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
    return response;
  } catch (e) {
    mediaTabId = null;
    return { success: false, error: e.message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getActiveMediaTab') {
    findMediaTab().then(tab => {
      sendResponse({ tab });
    });
    return true;
  }

  if (message.action === 'notifyMediaFound') {
    if (sender.tab) {
      mediaTabId = sender.tab.id;
    }
    return true;
  }

  if (message.action === 'miniPlayerCommand') {
    forwardToMediaTab(message.command, message.data).then(response => {
      sendResponse(response);
    });
    return true;
  }
});
