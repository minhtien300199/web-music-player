(function(global) {
  'use strict';

  const extensionOrigin = chrome.runtime.getURL('');
  const isOwnExtension = (sender) => sender?.id === chrome.runtime.id;
  const isExtensionPage = (sender) => isOwnExtension(sender) && typeof sender.url === 'string' && sender.url.startsWith(extensionOrigin);
  const isContentScript = (sender) => isOwnExtension(sender) && Boolean(sender.tab) && !isExtensionPage(sender);

  global.MusicControlSenderPolicy = Object.freeze({ isExtensionPage, isContentScript });
})(globalThis);
