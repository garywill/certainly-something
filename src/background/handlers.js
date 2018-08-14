import { consume } from './consumer';
import * as icon from './icon';
import * as state from './state';


// consume the security info about requests
browser.webRequest.onHeadersReceived.addListener(
  details => { consume(details); },
  { urls: ['<all_urls>'] },
  ['blocking'],
);

browser.webRequest.onErrorOccurred.addListener(
  details => { consume(details); },
  { urls: ['<all_urls>'] }
);

// when it's first loaded, reload the page if it's an https page
browser.runtime.onInstalled.addListener(async () => {
  const tabs = await browser.tabs.query({});

  // disable every inactive tab
  tabs.forEach(tab => {
    // disable the icon on every tab
    if (tab.active) {
      try {
        const activeUrl = new URL(tab.url);

        if (activeUrl.protocol === 'https:' && activeUrl.hostname !== 'addons.mozilla.org') {
          browser.tabs.reload(tab.id);
        }
      } catch (e) {
        // pass
      }
    } else {
      // inject notification script to say you need to refresh
      browser.tabs.insertCSS(tab.id, {
        file: '/content_script/index.css',
      });

      browser.tabs.executeScript(tab.id, {
        file: '/content_script/index.js',
      });
    }
  });
});

// update the icon when a navigation is complete
browser.webNavigation.onCompleted.addListener(
  details => {
    icon.update(details.tabId, state.get(details.tabId).state);
  },
  { url: [{ schemes: ['https'] }] }
);

// open the certificate viewer
browser.pageAction.onClicked.addListener(
  details => {
    // open the cert viewer page in the next tab over, if we have the existing state
    if (state.get(details.id) !== undefined) {
      browser.tabs.create({
        index: details.index + 1,
        url: `/viewer/index.html?tid=${String(details.id)}`,
        windowId: details.windowId,
      });
    } else {
      // open popup to have people refresh the page
      browser.tabs.sendMessage(details.id, {
        action: 'notify',
      });
    }
  }
);

// remove the tab state when a tab is closed
browser.tabs.onRemoved.addListener(
  tabId => {
    state.remove(tabId);
  }
);

// requests for the security info for a tab
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (request.action === 'getSecurityInfo' && sender.envType === 'addon_child') {
      const si = state.get(request.tabId);

      if (!si) {
        sendResponse(undefined);
        return;
      }

      sendResponse(si);
    }
  }
);

