// fxminivim — minimal vim keybindings for Firefox.

const HINT_CHARS = 'asdfghjkl';
const HINT_SEL =
  'a[href],button,input:not([type=hidden]),select,textarea,summary,' +
  '[role=button],[role=link],[onclick],[tabindex]:not([tabindex="-1"])';
const SCROLL_STEP = 60;
const MAX_MATCHES = 2000; // match limit..
// checkVisibility() defaults every one of these to false, so a bare call only
// catches display:none -- collapsed menus are visibility:hidden and slip past.
const VIS = { visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true };

// --- pure ---

// uniform-length labels (all 1 char, or all 2, ...).
// variable length -- short labels for the first few links
function labelsFor(n) {
  const base = HINT_CHARS.length;
  let len = 1;
  while (base ** len < n) len++;
  const out = [];
  for (let i = 0; i < n; i++) {
    let s = '', x = i;
    for (let d = 0; d < len; d++) {
      s = HINT_CHARS[x % base] + s;
      x = Math.floor(x / base);
    }
    out.push(s);
  }
  return out;
}

// --- state ---

let mode = 'normal'; // 'normal' | 'hint' | 'search'
let pending = null, pendingTimer = 0;
let hintUI = null, hints = [], hintInput = '', hintOpenInBackground = false;
let searchUI = null, matches = [], matchIdx = 0;

// --- shared overlay ---

// Shadow root so page CSS can't break our labels and ours can't touch theirs.
function makeOverlay() {
  const host = document.createElement('div');
  host.style.cssText =
    'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const root = host.attachShadow({ mode: 'open' });
  document.documentElement.append(host);
  return { host, root };
}

// --- scrolling ---

// 'instant', not 'auto': auto inherits from the page css.
// ...no silly smooth scrolling
function scroll(x, y) {
  scrollBy({ left: x, top: y, behavior: 'instant' });
}

// --- search ---

// ::highlight() rules must live in the document that owns the ranges, so this
// one <style> is the single node we leave behind. Created at most once.
function ensureHighlightStyle() {
  if (document.getElementById('fxmv-hl')) return;
  const s = document.createElement('style');
  s.id = 'fxmv-hl';
  s.textContent =
    '::highlight(fxmv){background:#ffe066;color:#000}' +
    '::highlight(fxmv-cur){background:#ff9500;color:#000}';
  (document.head || document.documentElement).append(s);
}

function openSearch() {
  closeSearchBar();
  mode = 'search';
  searchUI = makeOverlay();
  searchUI.root.innerHTML =
    '<style>.bar{position:absolute;left:0;bottom:0;display:flex;gap:4px;' +
    'align-items:center;background:#1c1c1c;color:#eee;font:14px monospace;' +
    'padding:4px 8px;pointer-events:auto}' +
    'input{all:unset;width:40ch;color:#eee;font:inherit}</style>' +
    '<div class="bar">/<input></div>';
  searchUI.root.querySelector('input').focus();
}

function closeSearchBar() {
  searchUI?.host.remove();
  searchUI = null;
  if (mode === 'search') mode = 'normal';
}

function clearMatches() {
  CSS.highlights?.delete('fxmv');
  CSS.highlights?.delete('fxmv-cur');
  matches = [];
  matchIdx = 0;
}

function runSearch(q) {
  clearMatches();
  if (!q || !document.body) return; // no body on XML docs -- TreeWalker would throw
  if (!window.CSS?.highlights) {
    console.warn('fxminivim: this Firefox lacks the CSS Custom Highlight API');
    return;
  }
  ensureHighlightStyle();
  const needle = q.toLowerCase();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.checkVisibility && !p.checkVisibility(VIS)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  // matches within a single text node only, so a phrase split
  // across <b>...</b> won't hit.
  for (let n; (n = walker.nextNode()); ) {
    const hay = n.nodeValue.toLowerCase();
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
      const r = new Range();
      r.setStart(n, i);
      r.setEnd(n, i + needle.length);
      matches.push(r);
    }
    if (matches.length >= MAX_MATCHES) break;
  }
  if (!matches.length) return;
  CSS.highlights.set('fxmv', new Highlight(...matches));
  // start from the first match at or below the current viewport top.
  matchIdx = matches.findIndex((r) => r.getBoundingClientRect().top > 0);
  if (matchIdx < 0) matchIdx = 0;
  gotoMatch(0);
}

// ranges go stale if the page rewrites itself (SPA nav) -- the
// highlight just drifts. Esc clears it. Re-searching is cheap.
function gotoMatch(delta) {
  if (!matches.length) return;
  matchIdx = (matchIdx + delta + matches.length) % matches.length;
  const r = matches[matchIdx];
  CSS.highlights.set('fxmv-cur', new Highlight(r));
  // the range's own rect, not the parent's: centering a long <p> can still
  // leave the match itself off-screen.
  const rc = r.getBoundingClientRect();
  scrollBy({ top: rc.top + rc.height / 2 - innerHeight / 2, behavior: 'instant' });
}

// --- hints ---

function showHints(openInBackground = false) {
  exitHints();
  const w = innerWidth, h = innerHeight;
  const els = [...document.querySelectorAll(HINT_SEL)].filter((el) => {
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 && r.height > 0 &&
      r.bottom > 0 && r.top < h && r.right > 0 && r.left < w &&
      (el.checkVisibility?.(VIS) ?? true)
    );
  });
  if (!els.length) return;

  mode = 'hint';
  hintInput = '';
  hintOpenInBackground = openInBackground;
  const labels = labelsFor(els.length);
  hintUI = makeOverlay();
  hintUI.root.innerHTML =
    '<style>.h{position:absolute;background:#ffe066;color:#000;' +
    'font:bold 11px/1.2 monospace;padding:1px 3px;border:1px solid #a80;' +
    'border-radius:2px;text-transform:uppercase}</style>';
  hints = els.map((el, i) => {
    const r = el.getBoundingClientRect();
    const tag = document.createElement('span');
    tag.className = 'h';
    tag.textContent = labels[i];
    tag.style.left = Math.max(0, r.left) + 'px';
    tag.style.top = Math.max(0, r.top) + 'px';
    hintUI.root.append(tag);
    return { label: labels[i], el, tag };
  });
  // Rects are a snapshot; if the page scrolls under us the labels lie.
  addEventListener('scroll', exitHints, { once: true, passive: true, capture: true });
}

function exitHints() {
  removeEventListener('scroll', exitHints, { capture: true });
  hintUI?.host.remove();
  hintUI = null;
  hints = [];
  hintInput = '';
  hintOpenInBackground = false;
  if (mode === 'hint') mode = 'normal';
}

function backgroundTabUrl(el) {
  if (!el.href) return null;
  try {
    const url = new URL(el.href, location.href);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function activate(el, openInBackground) {
  // A button or [role=link] div has no URL to hand off, so F activates it in place.
  const url = openInBackground && backgroundTabUrl(el);
  if (url) {
    browser.runtime.sendMessage({ type: 'open-background-tab', url });
    return;
  }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) {
    el.focus();
  } else {
    // No focus() first: programmatic focus inside a keydown handler matches
    // :focus-visible, so the link keeps a focus ring -- which bfcache then
    // restores when you navigate back. click() alone doesn't move focus.
    el.click(); // not location.href = -- click keeps JS handlers and SPA routers working
  }
}

function onHintKey(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') return exitHints();
  if (e.key === 'Backspace') hintInput = hintInput.slice(0, -1);
  else if (HINT_CHARS.includes(e.key)) hintInput += e.key;
  else return exitHints();

  let hit = null, any = false;
  for (const hn of hints) {
    const m = hn.label.startsWith(hintInput);
    hn.tag.style.display = m ? '' : 'none';
    if (m) {
      any = true;
      if (hn.label === hintInput) hit = hn;
    }
  }
  if (hit) {
    const el = hit.el, openInBackground = hintOpenInBackground;
    exitHints();
    activate(el, openInBackground);
  } else if (!any) {
    exitHints();
  }
}

// --- key handling ---

// Returns the focused editable, or null. activeElement stops at a shadow host,
// so on a web-component page the real <input> is one or more roots down --
// miss it and we preventDefault the keystrokes the user is trying to type.
// Returning the element (not a bool) also means Esc blurs the input rather
// than the host, which would leave focus inside it.
function activeEditable() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el) return null;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ? el : null;
}

function onSearchKey(e) {
  // Shadow DOM retargets but still propagates: without this the page's own
  // document-level handlers see every character typed into our bar and fire
  // their shortcuts. preventDefault is separate -- the input needs the default.
  e.stopPropagation();
  if (e.key === 'Enter') {
    const q = searchUI.root.querySelector('input').value;
    e.preventDefault();
    closeSearchBar();
    runSearch(q);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSearchBar();
    clearMatches();
  }
  // everything else falls through to the input
}

function onKey(e) {
  if (!e.isTrusted) return;
  // Search first: our input wants Ctrl+A/C/V, and onSearchKey has to shield
  // them from the page too. It never preventDefaults them, so browser-level
  // combos (Ctrl+F, Ctrl+T) still work.
  if (mode === 'search') return onSearchKey(e);
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (mode === 'hint') return onHintKey(e);

  const edit = activeEditable();
  if (edit) {
    if (e.key === 'Escape') edit.blur();
    return;
  }

  if (pending === 'g') {
    clearTimeout(pendingTimer);
    pending = null;
    if (e.key === 'g') {
      e.preventDefault();
      scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
  }

  const half = innerHeight / 2;
  switch (e.key) {
    case 'j': scroll(0, SCROLL_STEP); break;
    case 'k': scroll(0, -SCROLL_STEP); break;
    case 'h': scroll(-SCROLL_STEP, 0); break;
    case 'l': scroll(SCROLL_STEP, 0); break;
    case 'H': history.back(); break;
    case 'L': history.forward(); break;
    case 'd': scroll(0, half); break;
    case 'u': scroll(0, -half); break;
    // documentElement, not body: body's height is short whenever the page
    // scrolls a wrapper instead. Overscroll is clamped for us.
    case 'G': scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); break;
    case 'g':
      pending = 'g';
      pendingTimer = setTimeout(() => (pending = null), 800);
      break;
    case 'r': location.reload(); break;
    case 'x': browser.runtime.sendMessage('close'); break;
    case 't': browser.runtime.sendMessage('newtab'); break;
    case '/': openSearch(); break;
    case 'f': showHints(); break;
    case 'F': showHints(true); break;
    case 'n': gotoMatch(1); break;
    case 'N': gotoMatch(-1); break;
    case 'Escape': clearMatches(); return; // no preventDefault; Esc still stops page load
    default: return;
  }
  e.preventDefault();
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onKey, true);
}
if (typeof module !== 'undefined') module.exports = { labelsFor, HINT_CHARS };
