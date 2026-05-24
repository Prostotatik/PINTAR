(function pintarScrape() {
  try {
    var text = '';

    // --- LinkedIn job page ---
    if (location.hostname.includes('linkedin.com')) {
      var parts = [];

      // Job title
      var titleEl = document.querySelector('[class*="job-details-jobs-unified-top-card__job-title"]')
                 || document.querySelector('h1.t-24')
                 || document.querySelector('h1[class*="job-title"]');
      if (titleEl) parts.push('JOB TITLE: ' + titleEl.textContent.trim());

      // Company + location row
      var companyEl = document.querySelector('[class*="job-details-jobs-unified-top-card__company-name"]')
                   || document.querySelector('[class*="topcard__org-name-link"]')
                   || document.querySelector('a[class*="company"]');
      if (companyEl) parts.push('COMPANY: ' + companyEl.textContent.trim());

      var locationEl = document.querySelector('[class*="job-details-jobs-unified-top-card__bullet"]')
                    || document.querySelector('[class*="topcard__flavor--bullet"]');
      if (locationEl) parts.push('LOCATION: ' + locationEl.textContent.trim());

      // Job description section — grab all visible text inside it
      var descEl = document.querySelector('[class*="jobs-description__content"]')
                || document.querySelector('[class*="job-details-about-the-job-module__description"]')
                || document.querySelector('[class*="description__text"]')
                || document.querySelector('[id*="job-details"]');

      if (descEl) {
        var descText = (descEl.innerText || descEl.textContent || '').trim();
        parts.push('\nJOB DESCRIPTION:\n' + descText);
      }

      if (parts.length > 0) {
        text = parts.join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
          .slice(0, 14000);
        window.__pintarPageText = text;
        return;
      }
    }

    // --- Generic fallback ---
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,[role="complementary"],[role="banner"],[role="navigation"]')
      .forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });
    text = (clone.innerText || clone.textContent || '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .slice(0, 14000);
    window.__pintarPageText = text;
  } catch (e) {
    window.__pintarPageText = '';
  }
})();
