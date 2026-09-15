# Changelog

## 0.1.2

- Ignore synthetic keyboard events from pages.
- Fix pending `g` handling so the next non-`g` key is processed normally.
- Cap search matches within large individual text nodes.
- Preserve text offsets for Unicode case-insensitive searches.
- Use blue hint labels for `F` background-tab actions.

## 0.1.1

- Added `F` to open a hinted HTTP(S) link in a background tab next to the current tab.
- `F` falls back to normal activation for elements without an HTTP(S) URL, such as buttons and `[role=link]` divs.

## 0.1.0

Initial release.
