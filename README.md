# fxminivim

Minimal vim keybindings for Firefox. Requires Firefox 140 or later, since `/`
search is built on the CSS Custom Highlight API.

## Keys

| Key | Action |
| --- | --- |
| `j` `k` | Scroll down / up |
| `h` `l` | Scroll left / right (page only — see below) |
| `H` `L` | Back / forward |
| `d` `u` | Half page down / up |
| `gg` `G` | Top / bottom |
| `r` | Reload |
| `t` | New tab |
| `x` | Close tab (`Ctrl+Shift+T` to undo) |
| `/` | Search bar — type, `Enter` to highlight |
| `n` `N` | Next / previous match |
| `f` | Show link hints; type the label to click |
| `F` | Show link hints; opens an `http(s)` link in a background tab |
| `Esc` | Clear search, dismiss hints, or blur a focused text field |

Keys are ignored while you're typing in an input, textarea, or contenteditable,
including one nested inside a shadow root. Any binding with Ctrl/Alt/Cmd held
passes straight through to the page.

`F` falls back to normal activation for elements without an `http(s)` URL, such
as buttons and `[role=link]` divs.

## Why this exists

The full-featured vim extensions tend to grow memory over a long session. Three
usual causes, all of which this one avoids by construction:

- A persistent `MutationObserver` plus a cached link list, which pins detached
  nodes on any page that churns its DOM. Here, links are queried when you press
  `f` and dropped the moment hints close.
- `all_frames: true` plus a message port per frame; ad iframes come and go and
  the ports accumulate. Here, top frame only.
- A background page holding a `Map` keyed by tab id that isn't pruned on tab
  close. There is a background script here, because `x`, `t`, and `F` need `tabs.*`
  and content scripts can't call it, but it's stateless: one message listener,
  no stored tab state, and the MV3 event page unloads when idle.

The net effect: one permanent `keydown` listener, and a single `<style>` element
after your first search. Everything else lives and dies inside one keystroke.

## Deliberately missing

Iframe support, visual mode, marks, tab bindings, a custom keymap, an options
page, incremental search-as-you-type.

`h`/`l` scroll the page, not inner `overflow-x` containers, so they're inert on
wide code blocks and tables.

`/` matches within a single text node, so a phrase broken up by inline markup
(`the <b>fast</b> lane`) won't match.

`f` and `/` don't cross shadow boundaries (`querySelectorAll` and `TreeWalker`
both stop at the host), so links and text inside web components get neither
hints nor highlights. Detecting a focused input *does* pierce shadow roots.
That asymmetry is deliberate: swallowing keystrokes is a much worse failure
than missing a hint.

## Install

[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fxminivim/).

## Development installation

Open `about:debugging` → *This Firefox* → *Load Temporary Add-on* → pick
`manifest.json`. Hit *Reload* after every edit. It disappears when you restart
Firefox.

## Tests

```
node test.js
```

Covers the hint-label generator (the only piece with real logic). Everything
else needs a browser to mean anything.
