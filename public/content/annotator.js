(function pintarAnnotate() {
  var data = window.__pintarAnnotationData;
  if (!data || !data.strengths || !data.gaps) return;

  var existing = document.getElementById('pintar-overlay');
  if (existing) existing.remove();

  // Design tokens — mirror of :root in src/sidebar/styles.css.
  // Hard-coded (not CSS vars) because this is injected into an external page.
  var T = {
    surface: '#0f1626', surface2: '#141d31', surface3: '#1a2440',
    border: '#232e49', border2: '#2c3955',
    text: '#f2f5fc', text2: '#b6c0d4', text3: '#8492ac',
    primary: '#6366f1', violet: '#a855f7',
    grad: 'linear-gradient(135deg,#6366f1,#a855f7)',
    success: '#34d399', successSoft: 'rgba(52,211,153,.13)', successLine: 'rgba(52,211,153,.32)',
    warn: '#fbbf24', warnSoft: 'rgba(251,191,36,.13)', warnLine: 'rgba(251,191,36,.32)',
    danger: '#f87171', dangerSoft: 'rgba(248,113,113,.13)', dangerLine: 'rgba(248,113,113,.34)'
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Lucide-style stroke icons — path data mirrors src/sidebar/components/Icon.tsx.
  var ICON = {
    check: 'M20 6 9 17l-5-5',
    'check-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4',
    'alert-triangle':
      'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01',
    'x-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6',
    x: 'M18 6 6 18M6 6l12 12'
  };
  function icon(name, color, size, sw) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="'
      + color + '" stroke-width="' + (sw || 1.8)
      + '" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">'
      + '<path d="' + ICON[name] + '"/></svg>';
  }

  function tone(score) {
    return score >= 80 ? T.success : score >= 60 ? T.warn : T.danger;
  }

  function logoSvg(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" style="flex:none">'
      + '<rect width="32" height="32" rx="9" fill="url(#pintar-ov-grad)"/>'
      + '<path d="M11 22V10h5.2a3.6 3.6 0 0 1 0 7.2H11" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="m21.5 9.2.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" fill="#fff"/>'
      + '<defs><linearGradient id="pintar-ov-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">'
      + '<stop stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>';
  }

  // Circular match gauge — mirrors src/sidebar/components/ScoreRing.tsx.
  function ring(score) {
    var size = 54, sw = 5, r = (size - sw) / 2;
    var c = 2 * Math.PI * r;
    var clamped = Math.max(0, Math.min(100, score));
    var off = c * (1 - clamped / 100);
    var col = tone(clamped);
    return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;flex:none">'
      + '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'
      + '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + T.border2 + '" stroke-width="' + sw + '"/>'
      + '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw
      + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off
      + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>'
      + '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
      + 'font-weight:700;font-size:15px;font-variant-numeric:tabular-nums;color:' + col + '">' + Math.round(clamped) + '</span></div>';
  }

  // Verdict pill — mirrors REC_META in src/sidebar/components/CandidateCard.tsx.
  var REC = {
    strong_yes: { label: 'Strong Yes', col: T.success, soft: T.successSoft, line: T.successLine, icon: 'check-circle' },
    yes: { label: 'Yes', col: T.success, soft: T.successSoft, line: T.successLine, icon: 'check' },
    maybe: { label: 'Maybe', col: T.warn, soft: T.warnSoft, line: T.warnLine, icon: 'alert-triangle' },
    no: { label: 'No', col: T.danger, soft: T.dangerSoft, line: T.dangerLine, icon: 'x-circle' }
  };
  function verdictPill(rec) {
    var m = REC[rec] || REC.maybe;
    return '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;'
      + 'font-size:11.5px;font-weight:600;color:' + m.col + ';background:' + m.soft + ';border:1px solid ' + m.line + '">'
      + icon(m.icon, m.col, 13, 2.1) + esc(m.label) + '</span>';
  }

  function sectionHead(name, color, title, count) {
    return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:9px">'
      + icon(name, color, 15, 2)
      + '<span style="font-weight:600;font-size:12.5px;color:' + T.text + '">' + title + '</span>'
      + '<span style="margin-left:auto;font-size:11px;font-weight:600;color:' + T.text3 + ';background:' + T.surface2
      + ';border:1px solid ' + T.border + ';border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums">'
      + count + '</span></div>';
  }

  // Header: brand mark + gradient wordmark + close.
  var header = '<div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">'
    + logoSvg(22)
    + '<span style="font-weight:700;font-size:14px;letter-spacing:.01em;background:' + T.grad
    + ';-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent">PINTAR Analysis</span>'
    + '<button id="pintar-overlay-close" type="button" aria-label="Close analysis" '
    + 'style="margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;'
    + 'border-radius:8px;background:' + T.surface2 + ';border:1px solid ' + T.border + ';color:' + T.text2 + ';cursor:pointer;padding:0">'
    + icon('x', 'currentColor', 15, 2) + '</button></div>';

  // Score + verdict row (only when the agent passed a score through).
  var scoreRow = '';
  if (typeof data.score === 'number') {
    scoreRow = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid ' + T.border + '">'
      + ring(data.score)
      + '<div style="display:flex;flex-direction:column;gap:7px;min-width:0">'
      + '<span style="font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:' + T.text3 + '">Match score</span>'
      + (data.hire_recommendation ? verdictPill(data.hire_recommendation) : '')
      + '</div></div>';
  }

  var strengthsHtml = data.strengths.map(function (s) {
    return '<div style="background:' + T.successSoft + ';border:1px solid ' + T.successLine + ';border-radius:10px;padding:9px 11px;margin-bottom:7px">'
      + '<div style="color:' + T.success + ';font-weight:600;font-size:12.5px;line-height:1.4">' + esc(s.label) + '</div>'
      + (s.evidence ? '<div style="color:' + T.text2 + ';margin-top:3px;font-size:11.5px;line-height:1.5">' + esc(s.evidence) + '</div>' : '')
      + '</div>';
  }).join('') || '<div style="color:' + T.text3 + ';font-size:12px;padding:2px 0 6px">None identified.</div>';

  var gapsHtml = data.gaps.map(function (g) {
    var sev = g.severity;
    var sevCol = sev === 'high' ? T.danger : sev === 'medium' ? T.warn : T.success;
    var sevPill = sev
      ? '<span style="display:inline-flex;align-items:center;gap:4px;flex:none;font-size:10px;font-weight:600;'
        + 'text-transform:uppercase;letter-spacing:.03em;color:' + sevCol + '">'
        + '<span style="width:7px;height:7px;border-radius:999px;background:' + sevCol + ';flex:none"></span>' + esc(sev) + '</span>'
      : '';
    return '<div style="background:' + T.dangerSoft + ';border:1px solid ' + T.dangerLine + ';border-radius:10px;padding:9px 11px;margin-bottom:7px">'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<div style="color:' + T.danger + ';font-weight:600;font-size:12.5px;line-height:1.4;flex:1;min-width:0">' + esc(g.label) + '</div>'
      + sevPill + '</div>'
      + (g.evidence ? '<div style="color:' + T.text2 + ';margin-top:3px;font-size:11.5px;line-height:1.5">' + esc(g.evidence) + '</div>' : '')
      + '</div>';
  }).join('') || '<div style="color:' + T.text3 + ';font-size:12px;padding:2px 0">None identified.</div>';

  var panel = document.createElement('div');
  panel.id = 'pintar-overlay';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'PINTAR candidate analysis');
  panel.style.cssText = [
    'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
    'width:340px', 'max-height:82vh', 'overflow-y:auto',
    'background:' + T.surface, 'color:' + T.text,
    'border:1px solid ' + T.border, 'border-radius:16px',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    'font-size:13px', 'line-height:1.55', 'box-sizing:border-box',
    'box-shadow:0 24px 60px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4)',
    'padding:16px', '-webkit-font-smoothing:antialiased'
  ].join(';');

  panel.innerHTML = header + scoreRow
    + '<div style="margin-bottom:14px">' + sectionHead('check-circle', T.success, 'Strengths', data.strengths.length) + strengthsHtml + '</div>'
    + '<div>' + sectionHead('alert-triangle', T.danger, 'Gaps', data.gaps.length) + gapsHtml + '</div>';

  // Styles that can't be inlined: scrollbar, focus ring, hover, entrance.
  var styleEl = document.getElementById('pintar-overlay-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'pintar-overlay-style';
    styleEl.textContent =
      '#pintar-overlay::-webkit-scrollbar{width:10px}'
      + '#pintar-overlay::-webkit-scrollbar-thumb{background:' + T.border2 + ';border-radius:999px;border:3px solid ' + T.surface + '}'
      + '#pintar-overlay::-webkit-scrollbar-track{background:transparent}'
      + '#pintar-overlay button:focus-visible{outline:2px solid ' + T.primary + ';outline-offset:2px}'
      + '#pintar-overlay-close:hover{background:' + T.surface3 + ';color:' + T.text + '}'
      + '@media (prefers-reduced-motion:no-preference){#pintar-overlay{animation:pintar-in .26s cubic-bezier(.16,1,.3,1)}}'
      + '@keyframes pintar-in{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}';
    (document.head || document.documentElement).appendChild(styleEl);
  }

  document.body.appendChild(panel);

  function close() {
    panel.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  var closeBtn = panel.querySelector('#pintar-overlay-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
})();
