(() => {
  const dialog = document.querySelector('#search-dialog');
  if (!dialog) return;
  const input = dialog.querySelector('#search-input');
  const results = dialog.querySelector('#search-results');
  const status = dialog.querySelector('#search-status');
  const localPath = url => {
    const parsed = new URL(url, location.href);
    return parsed.pathname + parsed.search + parsed.hash;
  };
  const posts = new Set([...document.querySelectorAll('[data-search-post]')].map(el => localPath(el.dataset.searchPost)));
  const normalize = text => (text || '').normalize('NFC').toLocaleLowerCase();
  const decoder = document.createElement('textarea');
  function plainText(text) {
    // Decode entities without parsing document markup or creating active elements.
    return (text || '').replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, entity => {
      decoder.innerHTML = entity;
      return decoder.value;
    }).replace(/<\/?(?:p|div|span|br|noscript)\b[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  function appendMatches(element, text, terms) {
    const value = text.normalize('NFC');
    const escaped = [...new Set(terms)].sort((a, b) => b.length - a.length)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(escaped.join('|'), 'giu');
    let end = 0;
    for (const match of value.matchAll(pattern)) {
      element.append(document.createTextNode(value.slice(end, match.index)));
      const mark = document.createElement('mark');
      mark.textContent = match[0];
      element.append(mark);
      end = match.index + match[0].length;
    }
    element.append(document.createTextNode(value.slice(end)));
  }

  let index;
  let pending;
  let timer;

  async function loadIndex() {
    if (index) return index;
    if (!pending) {
      pending = fetch(localPath(dialog.dataset.index)).then(response => {
        if (!response.ok) throw Error('Search index unavailable');
        return response.json();
      }).then(data => {
        if (!Array.isArray(data)) throw Error('Search requires fuse_json');
        index = data.filter(item => posts.has(localPath(item.url))).map(item => {
          const body = plainText(item.body);
          const description = plainText(item.description);
          return { ...item, body, description, titleText: normalize(item.title),
            bodyText: normalize(`${description} ${body}`) };
        });
        return index;
      }).catch(error => { pending = null; throw error; });
    }
    return pending;
  }

  async function search() {
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) { status.textContent = ''; return; }
    status.textContent = 'Searching…';
    try {
      const documents = await loadIndex();
      if (input.value.trim() !== query || !dialog.open) return;
      const terms = normalize(query).split(/\s+/);
      const matches = documents.filter(doc => terms.every(term =>
        doc.titleText.includes(term) || doc.bodyText.includes(term)
      )).sort((a, b) => {
        const score = doc => terms.filter(term => doc.titleText.includes(term)).length;
        return score(b) - score(a) || (a.title || '').localeCompare(b.title || '');
      });
      status.textContent = matches.length === 0 ? 'No results.' : `${matches.length} result${matches.length === 1 ? '' : 's'}`;
      for (const doc of matches) {
        const url = new URL(doc.url, location.href);
        if (!['https:', 'http:'].includes(url.protocol)) continue;
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = localPath(url.href);
        const title = document.createElement('strong');
        appendMatches(title, doc.title || url.pathname, terms);
        const excerpt = document.createElement('span');
        const body = (doc.body || doc.description || '').replace(/\s+/g, ' ');
        const position = normalize(body).indexOf(terms[0]);
        const start = Math.max(0, position - 45);
        const snippet = (start ? '…' : '') + body.slice(start, start + 180) + (body.length > start + 180 ? '…' : '');
        appendMatches(excerpt, snippet, terms);
        link.append(title, excerpt);
        li.append(link);
        results.append(li);
      }
    } catch {
      if (input.value.trim() === query && dialog.open) status.textContent = 'Search could not load. Type again to retry.';
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    input.focus();
    search();
  }
  document.querySelector('#search-button')?.addEventListener('click', open);
  dialog.querySelector('#search-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  input.addEventListener('input', event => {
    clearTimeout(timer);
    if (!event.isComposing) timer = setTimeout(search, 100);
  });
  input.addEventListener('compositionend', () => { clearTimeout(timer); search(); });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
      return;
    }
    const links = [...results.querySelectorAll('a')];
    const current = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && links.length) {
      event.preventDefault();
      links[Math.min(current + 1, links.length - 1)].focus();
    } else if (event.key === 'ArrowUp' && current >= 0) {
      event.preventDefault();
      if (current === 0) input.focus(); else links[current - 1].focus();
    } else if (event.key === 'Enter' && document.activeElement === input && links.length) {
      event.preventDefault();
      links[0].click();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return;
    if (event.key === '/' && !dialog.open) {
      event.preventDefault();
      open();
    }
  });
})();
