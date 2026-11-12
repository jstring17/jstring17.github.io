(() => {
  const dialog = document.querySelector('#search-dialog');
  if (!dialog) return;
  const input = dialog.querySelector('#search-input');
  const results = dialog.querySelector('#search-results');
  const status = dialog.querySelector('#search-status');
  const empty = dialog.querySelector('#search-empty');
  const RECENT = 5;
  const localPath = url => {
    const parsed = new URL(url, location.href);
    return parsed.pathname + parsed.search + parsed.hash;
  };
  // Every listed post, newest first. The empty panel shows the first few without loading the index.
  const posts = [...document.querySelectorAll('[data-search-post]')].map(el => ({
    url: localPath(el.dataset.searchPost),
    title: el.dataset.title || '',
    date: el.dataset.date || '',
  })).sort((a, b) => b.date.localeCompare(a.date));
  const dates = new Map(posts.map(post => [post.url, post.date]));
  // Full date in the list's style, read as a calendar date so time zones cannot shift the day.
  const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  function formatDate(value) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return year && month && day ? dateFormat.format(Date.UTC(year, month - 1, day)) : value;
  }
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
    if (!terms.length) { element.append(value); return; }
    const escaped = [...terms].sort((a, b) => b.length - a.length)
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
  let active = -1;

  async function loadIndex() {
    if (index) return index;
    if (!pending) {
      pending = fetch(localPath(dialog.dataset.index)).then(response => {
        if (!response.ok) throw Error('Search index unavailable');
        return response.json();
      }).then(data => {
        if (!Array.isArray(data)) throw Error('Search requires fuse_json');
        index = data.map(item => ({ ...item, url: localPath(item.url) }))
          .filter(item => dates.has(item.url)).map(item => {
            const text = [plainText(item.description), plainText(item.body)].filter(Boolean).join(' ');
            return { url: item.url, title: item.title || '', date: dates.get(item.url), text,
              titleText: normalize(item.title), bodyText: normalize(text) };
          });
        return index;
      }).catch(error => { pending = null; throw error; });
    }
    return pending;
  }

  // The input keeps focus; the selected option is announced through aria-activedescendant.
  function select(position, scroll = true) {
    const options = [...results.children];
    if (!options.length) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = Math.max(0, Math.min(position, options.length - 1));
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    input.setAttribute('aria-activedescendant', options[active].id);
    if (scroll) options[active].scrollIntoView({ block: 'nearest' });
  }

  function option(post, i, terms) {
    const item = document.createElement('li');
    item.id = `search-option-${i}`;
    item.setAttribute('role', 'option');
    const link = document.createElement('a');
    link.href = post.url;
    link.tabIndex = -1;
    const title = document.createElement('span');
    title.className = 'search-title';
    appendMatches(title, post.title || post.url, terms);
    const date = document.createElement('time');
    date.dateTime = post.date;
    date.textContent = formatDate(post.date);
    link.append(title, date);
    if (post.excerpt) {
      const excerpt = document.createElement('span');
      excerpt.className = 'search-excerpt';
      appendMatches(excerpt, post.excerpt, terms);
      link.append(excerpt);
    }
    item.append(link);
    return item;
  }

  function show(list, terms) {
    results.replaceChildren(...list.map((post, i) => option(post, i, terms)));
    input.setAttribute('aria-expanded', String(list.length > 0));
    select(0);
  }

  // Start the excerpt a little before the first matching term; CSS trims the end.
  function excerptFor(doc, terms) {
    const hits = terms.map(term => doc.bodyText.indexOf(term)).filter(position => position >= 0);
    const start = Math.max(0, (hits.length ? Math.min(...hits) : 0) - 30);
    return (start ? '…' : '') + doc.text.slice(start, start + 200);
  }

  async function search() {
    const query = input.value.trim();
    empty.hidden = true;
    if (!query) {
      results.setAttribute('aria-label', 'Recent posts');
      status.textContent = posts.length ? 'Recent' : '';
      show(posts.slice(0, RECENT), []);
      return;
    }
    results.setAttribute('aria-label', 'Search results');
    if (!index) status.textContent = 'Searching…';
    try {
      const documents = await loadIndex();
      if (input.value.trim() !== query || !dialog.open) return;
      const terms = [...new Set(normalize(query).split(/\s+/))];
      const titleHits = doc => terms.filter(term => doc.titleText.includes(term)).length;
      // Title matches first, then newest first.
      const matches = documents
        .filter(doc => terms.every(term => doc.titleText.includes(term) || doc.bodyText.includes(term)))
        .map(doc => ({ ...doc, hits: titleHits(doc), excerpt: excerptFor(doc, terms) }))
        .sort((a, b) => b.hits - a.hits || b.date.localeCompare(a.date));
      show(matches, terms);
      status.textContent = matches.length ? `${matches.length} result${matches.length === 1 ? '' : 's'}` : 'No results';
      if (!matches.length) {
        empty.textContent = `No posts match “${query}”.`;
        empty.hidden = false;
      }
    } catch {
      if (input.value.trim() !== query || !dialog.open) return;
      show([], []);
      status.textContent = 'Search could not load. Type again to retry.';
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    search();
  }
  // Closing returns focus to the opener; after Esc that shows a keyboard focus ring.
  // Drop it when a pointer opened the panel, and keep it for keyboard users.
  const button = document.querySelector('#search-button');
  let pointerOpened = false;
  function close() {
    if (dialog.open) dialog.close();
    if (pointerOpened && document.activeElement === button) button.blur();
    pointerOpened = false;
  }
  button?.addEventListener('click', event => {
    pointerOpened = event.detail > 0;
    open();
  });
  dialog.addEventListener('close', close);
  dialog.querySelector('#search-close').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  input.addEventListener('input', event => {
    clearTimeout(timer);
    if (!event.isComposing) timer = setTimeout(search, 100);
  });
  input.addEventListener('compositionend', () => { clearTimeout(timer); search(); });
  results.addEventListener('pointermove', event => {
    const item = event.target.closest('[role="option"]');
    const position = item ? [...results.children].indexOf(item) : -1;
    if (position >= 0 && position !== active) select(position, false);
  });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (!results.children.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      select(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      select(active - 1);
    } else if (event.key === 'Enter' && document.activeElement === input && active >= 0) {
      event.preventDefault();
      results.children[active].querySelector('a').click();
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
