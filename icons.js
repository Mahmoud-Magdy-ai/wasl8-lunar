// Wasl — one consistent SVG icon set (1.8px strokes, 24px grid) replacing emoji, which render differently on every OS.
(function () {
  const P = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    earth: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h5l2 3-2 3H4M14 3.5l-1 3.5 3 2 4-1M15 20l1-4 3-1"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M15 4h4l-4 4h4"/>',
    signal: '<path d="M12 20v-6"/><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    warn: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
    off: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5M8.5 9.5a5 5 0 1 0 7 0"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    half: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    mountain: '<path d="M2 20l7-12 4 6 3-4 6 10H2z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    play: '<path d="M7 4l13 8-13 8V4z" fill="currentColor"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    next: '<path d="M5 5l9 7-9 7V5z" fill="currentColor"/><path d="M19 5v14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    logo: '<circle cx="12" cy="12" r="7.5"/><path d="M2.5 15.5c3-1.5 6-1.5 9.5 0s6.5 1.5 9.5 0" stroke="#FC3D21"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  // emoji → icon, applied to translated strings
  const MAP = [['☀', 'sun'], ['🌍', 'earth'], ['🏆', 'trophy'], ['💤', 'sleep'], ['📡', 'signal'], ['⚠', 'warn'], ['🚨', 'alert'], ['☠', 'off'],
    ['🌑', 'moon'], ['🌗', 'half'], ['⛰', 'mountain'], ['⬇', 'download'], ['📋', 'copy'], ['▶', 'play'], ['✅', 'check'], ['✓', 'check'], ['❌', 'x'], ['✗', 'x'],
    ['⚙', 'gear'], ['⏭', 'next'], ['❚❚', 'pause'], ['▲', 'up'], ['▼', 'down']];
  const iconize = s => typeof s !== 'string' ? s : MAP.reduce((a, [e, n]) => a.split(e).join(icon(n, n)), s.replace(/️/g, ''));
  // Replace emoji in any text node with the matching icon (covers all dynamic UI); skips form fields.
  const RE = /(❚❚|☀|🌍|🏆|💤|📡|⚠|🚨|☠|🌑|🌗|⛰|⬇|📋|▶|✅|✓|❌|✗|⚙|⏭|▲|▼)\uFE0F?/;
  const SKIP = new Set(['TEXTAREA', 'OPTION', 'SCRIPT', 'STYLE', 'SELECT', 'TITLE']);
  function walk(root) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentNode && !SKIP.has(n.parentNode.nodeName) && !n.parentNode.closest('svg') && RE.test(n.nodeValue)) ? 1 : 2 });
    const list = []; while (tw.nextNode()) list.push(tw.currentNode);
    list.forEach(n => { const span = document.createElement('span'); span.className = 'icw'; span.innerHTML = iconize(n.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;')); n.replaceWith(...span.childNodes); });
  }
  function start() { document.querySelectorAll('[data-icon]').forEach(e => e.innerHTML = icon(e.dataset.icon)); walk(document.body); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) walk(n); else if (n.nodeType === 3 && n.parentNode) walk(n.parentNode); }))).observe(document.body, { childList: true, subtree: true, characterData: false }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.Icons = { icon, iconize };
})();
