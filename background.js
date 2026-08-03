// exists only because tabs.remove()/tabs.create() are unavailable to content scripts.
// sender.tab.id means this needs no "tabs" permission.
browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg === 'close' && sender.tab) browser.tabs.remove(sender.tab.id);
  if (msg === 'newtab') browser.tabs.create({});
});
