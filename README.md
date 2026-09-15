# fxminivim

Minimal Vim-style navigation for Firefox. Requires Firefox 140 or later.

[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fxminivim/)

## Keys

| Key | Action |
| --- | --- |
| `j` / `k` | Scroll down / up |
| `h` / `l` | Scroll left / right |
| `H` / `L` | Back / forward |
| `d` / `u` | Half page down / up |
| `gg` / `G` | Top / bottom |
| `r` | Reload |
| `t` / `x` | New tab / close tab |
| `/` | Search; press `Enter` to highlight matches |
| `n` / `N` | Next / previous search match |
| `f` | Show link hints; type a label to activate it |
| `F` | Show link hints; opens HTTP(S) links in a background tab |
| `Esc` | Clear search, dismiss hints, or blur a text field |

Bindings are ignored while typing in an input, textarea, select, or contenteditable. Ctrl, Alt, and Cmd combinations pass through unchanged.

## Performance

Unlike full-featured Vim extensions, fxminivim keeps no persistent link cache, DOM observer, frame message ports, or per-tab background state. It queries links only when hints open and releases that state when they close, leaving one key listener and, after the first search, one style element while idle.

## Scope

- Runs in the top-level page only, not iframes.
- Search matches text within a single text node, so it does not cross inline markup.
- Hints and search do not enter shadow DOM.
- `h` and `l` scroll the page, not nested overflow containers.

## Development

Open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on** and select `manifest.json`. Reload the extension after edits.

Run the unit test with:

```sh
node test.js
```
