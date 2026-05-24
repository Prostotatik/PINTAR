(function pintarAnnotate() {
  var data = window.__pintarAnnotationData;
  if (!data || !data.strengths || !data.gaps) return;

  var existing = document.getElementById('pintar-overlay');
  if (existing) existing.remove();

  var panel = document.createElement('div');
  panel.id = 'pintar-overlay';
  panel.style.cssText = [
    'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
    'width:320px', 'max-height:80vh', 'overflow-y:auto',
    'background:#0f172a', 'color:#f1f5f9', 'border-radius:12px',
    'font-family:-apple-system,sans-serif', 'font-size:13px',
    'box-shadow:0 25px 50px rgba(0,0,0,.5)', 'border:1px solid #1e3a5f',
    'padding:16px'
  ].join(';');

  var strengthsHtml = data.strengths.map(function (s) {
    return '<div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:8px;margin-bottom:6px">'
      + '<div style="color:#4ade80;font-weight:600">' + (s.label || '') + '</div>'
      + '<div style="color:#86efac;margin-top:4px;font-size:12px">' + (s.evidence || '') + '</div>'
      + '</div>';
  }).join('');

  var gapsHtml = data.gaps.map(function (g) {
    var dot = g.severity === 'high' ? '🔴' : g.severity === 'medium' ? '🟡' : '🟢';
    return '<div style="background:#2d1515;border:1px solid #7f1d1d;border-radius:8px;padding:8px;margin-bottom:6px">'
      + '<div style="color:#f87171;font-weight:600">' + (g.label || '') + ' ' + dot + '</div>'
      + '<div style="color:#fca5a5;margin-top:4px;font-size:12px">' + (g.evidence || '') + '</div>'
      + '</div>';
  }).join('');

  panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #1e3a5f">'
    + '<span style="font-weight:700;font-size:14px;color:#38bdf8">PINTAR Analysis</span>'
    + '<button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1">×</button>'
    + '</div>'
    + '<div><div style="color:#4ade80;font-weight:600;margin-bottom:8px">✅ Strengths</div>' + strengthsHtml + '</div>'
    + '<div style="margin-top:12px"><div style="color:#f87171;font-weight:600;margin-bottom:8px">⚠️ Gaps</div>' + gapsHtml + '</div>';

  document.body.appendChild(panel);
})();
