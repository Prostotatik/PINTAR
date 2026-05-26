(function pintarCandidateScrape() {
  try {
    var body = document.body;
    var clone = body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,nav,footer,[aria-hidden="true"]')
      .forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });

    var rawContent = (clone.innerText || clone.textContent || '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .slice(0, 15000);

    var sections = {};
    body.querySelectorAll('h1,h2,h3,h4').forEach(function (heading) {
      var title = (heading.innerText || '').trim();
      if (!title || title.length >= 60) return;
      var content = '';
      var next = heading.nextElementSibling;
      while (next && ['H1','H2','H3','H4'].indexOf(next.tagName) === -1) {
        content += (next.innerText || '') + '\n';
        next = next.nextElementSibling;
      }
      if (content.trim()) sections[title] = content.trim().slice(0, 1000);
    });

    window.__pintarCandidatePage = { rawContent: rawContent, sections: sections };
  } catch (e) {
    window.__pintarCandidatePage = { rawContent: '', sections: {} };
  }
})();
