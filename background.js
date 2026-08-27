// exists only because tabs.remove()/tabs.create() are unavailable to content scripts.
// sender.tab.id means this needs no "tabs" permission.
browser.runtime.onMessage.addListener((message, sender) => {
  if (message === 'close' && sender.tab) return browser.tabs.remove(sender.tab.id);
  if (message === 'newtab') return browser.tabs.create({});

  if (message?.type !== 'open-background-tab' || !sender.tab) return;
  // Opened in the background, like a middle-click; index keeps it next to the opener.
  return browser.tabs.create({
    url: message.url,
    active: false,
    index: sender.tab.index + 1,
  });
});
