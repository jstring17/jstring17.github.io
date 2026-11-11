function enableThemeToggle() {
  const toggle = document.querySelector('#theme-toggle');
  if (!toggle) return;
  const hl = document.querySelector('link#hl');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem('theme'); } catch {}
  function apply(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    if (hl) hl.href = hl.dataset[theme];
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }
  toggle.addEventListener('click', () => {
    saved = document.body.classList.contains('dark') ? 'light' : 'dark';
    try { localStorage.setItem('theme', saved); } catch {}
    apply(saved);
  });
  preference.addEventListener('change', event => {
    if (!saved) apply(event.matches ? 'dark' : 'light');
  });
  apply(saved || (preference.matches ? 'dark' : 'light'));
}

function enableTagFilters() {
  const context = document.querySelector('#active-tag');
  if (!context) return;
  const posts = [...document.querySelectorAll('.post-entry')];
  const tagLinks = [...document.querySelectorAll('.post-tags a')];
  const empty = document.querySelector('#empty-posts');
  const status = document.querySelector('#filter-status');
  const activeTags = document.querySelector('#active-tags');
  const home = document.querySelector('#clear-tags').href;
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  const listFormat = new Intl.ListFormat('en', { type: 'conjunction' });
  tagLinks.forEach(link => { link.dataset.tag = new URL(link.href).searchParams.get('tag'); });
  const tagsOf = post => post.dataset.tags.split(',');
  // ?tag=Bio&tag=AI keeps posts that have every selected tag.
  const urlFor = tags => {
    const url = new URL(home);
    tags.forEach(tag => url.searchParams.append('tag', tag));
    return url.href;
  };
  let selected = [];
  function syncYearIndex() {
    // Years with no matching posts leave the year index; years with only dimmed posts dim in it.
    document.querySelectorAll('.year-index li').forEach(item => {
      const group = document.getElementById(item.querySelector('a').hash.slice(1))?.closest('.year-group');
      if (!group) return;
      item.hidden = !group.querySelector('.post-entry:not([hidden])');
      item.classList.toggle('is-muted', !group.querySelector('.post-entry:not([hidden]):not(.is-muted)'));
    });
  }
  function preview(tag) {
    // Selected tags would widen the filter when clicked, so only unselected ones preview.
    const dim = Boolean(tag) && !selected.includes(tag);
    posts.forEach(post => post.classList.toggle('is-muted', dim && !tagsOf(post).includes(tag)));
    syncYearIndex();
  }
  function render() {
    selected = [...new Set(new URL(location.href).searchParams.getAll('tag'))];
    let count = 0;
    posts.forEach(post => {
      const tags = tagsOf(post);
      post.hidden = !selected.every(tag => tags.includes(tag));
      if (!post.hidden) count++;
    });
    // A tag link adds its tag to the filter, or removes it when it is already selected.
    tagLinks.forEach(link => {
      const tag = link.dataset.tag;
      const on = selected.includes(tag);
      link.classList.toggle('is-selected', on);
      link.href = urlFor(on ? selected.filter(t => t !== tag) : [...selected, tag]);
      if (on) link.title = `Remove ${tag} from the filter`;
      else link.removeAttribute('title');
    });
    activeTags.replaceChildren(...selected.map(tag => {
      const link = document.createElement('a');
      link.href = urlFor(selected.filter(t => t !== tag));
      link.textContent = tag;
      link.title = `Remove ${tag} from the filter`;
      return link;
    }));
    const label = listFormat.format(selected);
    context.hidden = selected.length === 0;
    status.textContent = selected.length ? `Posts tagged ${label}` : '';
    empty.hidden = count > 0;
    empty.textContent = selected.length ? `No posts tagged ${label} yet.` : 'No posts yet.';
    preview(null);
    window.dispatchEvent(new Event('tagchange'));
  }
  function animate(update) {
    // Rows that stay slide into place and rows that leave fade out (View Transitions).
    if (!document.startViewTransition || !motion.matches) { update(); return; }
    const named = [...document.querySelectorAll('.year, .post-entry, #active-tag, #empty-posts')];
    named.forEach((el, i) => { el.style.viewTransitionName = `filter-${i}`; });
    document.startViewTransition(update).finished.finally(() => {
      named.forEach(el => { el.style.viewTransitionName = ''; });
    });
  }
  window.addEventListener('popstate', () => animate(render));
  render();

  // Hovering or focusing a tag previews its filter by dimming posts without it.
  tagLinks.forEach(link => {
    link.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') preview(link.dataset.tag); });
    link.addEventListener('pointerleave', () => preview(null));
    link.addEventListener('focus', () => preview(link.dataset.tag));
    link.addEventListener('blur', () => preview(null));
  });

  // Tag links on the home page filter in place instead of loading the page again.
  document.addEventListener('click', event => {
    const link = event.target.closest('.post-tags a, #active-tag a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    event.preventDefault();
    if (url.href !== location.href) history.pushState(null, '', url);
    animate(render);
  });
}

function enableTitleTransition() {
  // Cross-document View Transitions: the clicked title and the post's h1 share the name
  // post-title (the h1 gets it in CSS), so the title morphs into the heading.
  if (!('onpagereveal' in window)) return;
  const titles = [...document.querySelectorAll('.post-entry h3 a')];
  const clear = () => titles.forEach(title => { title.style.viewTransitionName = ''; });
  const name = title => { clear(); title.style.viewTransitionName = 'post-title'; };
  document.addEventListener('click', event => {
    const title = event.target.closest('.post-entry h3 a');
    if (!title || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    name(title);
  });
  // Coming back from a post, its title morphs back into the list, then the name is dropped
  // so the next click can use it.
  window.addEventListener('pagereveal', event => {
    const from = window.navigation?.activation?.from?.url;
    const back = from && titles.find(title => title.href === from);
    if (back) name(back);
    if (event.viewTransition) event.viewTransition.finished.finally(clear);
    else clear();
  });
}

function enableTitleShine() {
  const allowed = window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)');
  if (!window.CSS?.registerProperty) return;
  const SHINE_SLOTS = 6; // keep in step with $shine-slots in main.scss
  const MIN_GAP = 150; // ms between two bands on one title; 6 slots cover an 800ms sweep
  for (let i = 0; i < SHINE_SLOTS; i++) {
    // Registered as a percentage so the band position animates smoothly.
    try { CSS.registerProperty({ name: `--shine-${i}`, syntax: '<percentage>', inherits: false, initialValue: '0%' }); } catch {}
  }
  document.querySelectorAll('.post-entry h3 a').forEach(link => {
    const bands = new Array(SHINE_SLOTS).fill(null);
    let lastStart = -Infinity;
    link.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch' || !allowed.matches) return;
      const now = performance.now();
      const slot = bands.indexOf(null);
      if (now - lastStart < MIN_GAP || slot < 0) return;
      lastStart = now;
      link.classList.add('shine');
      // Fast start so the light appears the moment the cursor lands, then eases out.
      const band = link.animate({ [`--shine-${slot}`]: ['100%', '0%'] }, { duration: 800, easing: 'cubic-bezier(0.2, 0.55, 0.35, 1)' });
      bands[slot] = band;
      const free = () => {
        bands[slot] = null;
        if (bands.every(b => !b)) link.classList.remove('shine');
      };
      band.finished.then(free, free);
    });
  });
}

function enablePrerender() {
  const prerender = (a) => {
    if (!a.classList.contains('instant')) return;
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: [a.href] }] });
    document.body.append(script);
    a.classList.remove('instant');
  }
  const prefetch = (a) => {
    if (!a.classList.contains('instant')) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = a.href;
    document.head.append(link);
    a.classList.remove('instant');
  }
  const support = HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules');
  const handle = support ? prerender : prefetch;
  document.querySelectorAll('a.instant').forEach(a => {
    if (a.href.endsWith(window.location.pathname)) return;
    let timer;
    a.addEventListener('mouseenter', () => {
      timer = setTimeout(() => handle(a), 50);
    });
    a.addEventListener('mouseleave', () => clearTimeout(timer));
    a.addEventListener('touchstart', () => handle(a), { passive: true });
  });
}

function enableOutdateAlert() {
  const alert = document.querySelector('#outdate_alert');
  if (!alert) return;
  const updateDate = new Date(alert.dataset.updated);
  if (!Number.isFinite(updateDate.getTime())) return;
  const intervalDays = Math.floor((Date.now() - updateDate.getTime()) / (24 * 60 * 60 * 1000));
  const alertDays = parseInt(alert.dataset.days);
  if (intervalDays >= alertDays) {
    const msg = alert.dataset.alertTextBefore + intervalDays + alert.dataset.alertTextAfter;
    alert.querySelector('.content').textContent = msg;
    alert.classList.remove('hidden');
  }
}

function enableTocTooltip() {
  const anchors = document.querySelectorAll('aside nav a');
  if (anchors.length == 0) return;
  const toggleTooltip = () => {
    anchors.forEach(anchor => {
      if (anchor.offsetWidth < anchor.scrollWidth) {
        anchor.setAttribute('title', anchor.textContent);
      } else {
        anchor.removeAttribute('title');
      }
    });
  };
  window.addEventListener('resize', toggleTooltip);
  toggleTooltip();
}

function enableActiveToc() {
  const nav = document.querySelector('body.post aside nav, body.blog .year-index nav');
  if (!nav) return;
  const entries = [...nav.querySelectorAll('a[href^="#"]')].map(link => {
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { id = link.hash.slice(1); }
    return { link, heading: document.getElementById(id) };
  }).filter(entry => entry.heading);
  if (!entries.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  const marker = document.createElement('span');
  marker.className = 'toc-marker';
  marker.setAttribute('aria-hidden', 'true');
  nav.append(marker);
  let markerY = null;
  function placeMarker(entry) {
    if (!entry) { marker.classList.remove('is-shown'); return; }
    const y = entry.link.offsetTop + (entry.link.offsetHeight - marker.offsetHeight) / 2;
    if (y !== markerY) marker.style.transform = `translateY(${y}px)`;
    if (markerY === null) {
      // Place it before turning on the transition so it does not slide in from the top.
      marker.getBoundingClientRect();
      marker.classList.add('is-ready');
    }
    markerY = y;
    marker.classList.add('is-shown');
  }
  let active;
  let pinned = null;
  let release;
  let scheduled = false;
  const update = () => {
    scheduled = false;
    // Skip headings hidden by the tag filter.
    const visible = entries.filter(entry => entry.heading.getClientRects().length);
    if (!visible.length) { placeMarker(null); return; }
    let current = visible[0];
    for (const entry of visible) {
      if (entry.heading.getBoundingClientRect().top <= 80) current = entry;
      else break;
    }
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      // At the bottom, keep a clicked entry that is on screen instead of jumping to the last one.
      let hash;
      try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = location.hash.slice(1); }
      const target = visible.find(entry => entry.heading.id === hash);
      const rect = target?.heading.getBoundingClientRect();
      current = rect && rect.bottom > 0 && rect.top < window.innerHeight ? target : visible[visible.length - 1];
    }
    // While a clicked entry scrolls into view, stay on it instead of stepping through the ones in between.
    if (pinned && visible.includes(pinned)) current = pinned;
    placeMarker(current);
    if (active === current) return;
    active?.link.removeAttribute('aria-current');
    current.link.setAttribute('aria-current', 'location');
    active = current;
    // Scroll only the TOC, never the article, when the active entry is clipped.
    const item = current.link.getBoundingClientRect();
    const bounds = nav.getBoundingClientRect();
    if (item.top < bounds.top) nav.scrollTop -= bounds.top - item.top + 10;
    else if (item.bottom > bounds.bottom) nav.scrollTop += item.bottom - bounds.bottom + 10;
  };
  const schedule = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  };
  const root = document.documentElement;
  const unpin = () => {
    clearTimeout(release);
    pinned = null;
    root.style.scrollBehavior = '';
    schedule();
  };
  // scrollend ends the pin; without it, scrolling has settled once scroll events pause.
  // The longer wait with scrollend only covers clicks that do not scroll at all.
  const settle = 'onscrollend' in window ? 1000 : 150;
  const waitForStop = () => { clearTimeout(release); release = setTimeout(unpin, settle); };
  nav.addEventListener('click', event => {
    const entry = entries.find(item => item.link === event.target.closest('a'));
    if (!entry || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    pinned = entry;
    // Smooth only for index clicks. The browser still updates the hash and history as usual.
    if (motion.matches) root.style.scrollBehavior = 'smooth';
    waitForStop();
    schedule();
  });
  window.addEventListener('scroll', () => { if (pinned) waitForStop(); }, { passive: true });
  window.addEventListener('scrollend', () => { if (pinned) unpin(); });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('tagchange', schedule);
  window.addEventListener('load', schedule);
  document.fonts.ready.then(schedule);
  update();
}

function addCopyBtns() {
  const cfg = document.querySelector('#copy-cfg');
  document.querySelectorAll('.prose pre').forEach(block => {
    const code = block.querySelector('code');
    if (!code || block.classList.contains('mermaid') || block.parentElement.classList.contains('codeblock')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'codeblock';
    const header = document.createElement('div');
    header.className = 'code-header';
    const language = ['plain', 'text', 'plaintext'].includes(code.dataset.lang)
      ? '' : (code.dataset.lang || '');
    const hasHeader = Boolean(code.dataset.name || language);
    if (hasHeader) {
      const name = document.createElement('span');
      name.className = 'code-name';
      name.textContent = code.dataset.name || language;
      header.append(name);
      if (code.dataset.name && language) {
        const lang = document.createElement('span');
        lang.className = 'code-language';
        lang.textContent = language;
        header.append(lang);
      }
    } else {
      wrapper.classList.add('codeblock-plain');
      if (cfg) wrapper.classList.add('has-copy');
    }
    if (cfg) {
      const status = document.createElement('span');
      status.className = 'copy-status';
      status.setAttribute('role', 'status');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.title = 'Copy code';
      btn.innerHTML = cfg.dataset.copyIcon;
      let timer;
      btn.addEventListener('click', async () => {
        clearTimeout(timer);
        btn.innerHTML = cfg.dataset.copyIcon;
        status.textContent = '';
        const source = code.cloneNode(true);
        source.querySelectorAll('.giallo-ln').forEach(number => number.remove());
        btn.disabled = true;
        try {
          await navigator.clipboard.writeText(source.textContent);
          btn.innerHTML = cfg.dataset.checkIcon;
        } catch {
          status.textContent = 'Copy failed. Select the code and copy manually.';
        } finally {
          btn.disabled = false;
          timer = setTimeout(() => {
            btn.innerHTML = cfg.dataset.copyIcon;
            status.textContent = '';
          }, 4000);
        }
      });
      (hasHeader ? header : wrapper).append(status, btn);
    }
    block.before(wrapper);
    if (hasHeader) wrapper.append(header);
    wrapper.append(block);
  });
}

function wrapTables() {
  document.querySelectorAll('.prose table').forEach(table => {
    if (table.parentElement.classList.contains('table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable table');
    table.before(wrapper);
    wrapper.append(table);
  });
}

function addBackToTopBtn() {
  const backBtn = document.querySelector('#back-to-top');
  if (!backBtn) return;
  const toTop = () => window.scrollTo({ top: 0 });
  const toggle = () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop > 200 && !backBtn.classList.contains('shown')) {
      backBtn.classList.add('shown');
      backBtn.setAttribute('tabindex', 0);
      backBtn.addEventListener('click', toTop);
    } else if (scrollTop <= 200 && backBtn.classList.contains('shown')) {
      backBtn.classList.remove('shown');
      backBtn.setAttribute('tabindex', -1);
      backBtn.removeEventListener('click', toTop);
    }
  };
  window.addEventListener('scroll', toggle);
  toggle();
}

function addFootnoteBacklink() {
  const footnotes = document.querySelectorAll('.footnote-definition');
  footnotes.forEach(footnote => {
    const backlink = document.createElement('button');
    backlink.className = 'backlink';
    backlink.ariaLabel = 'backlink';
    backlink.innerHTML = '↩︎';
    backlink.addEventListener('click', () => window.scrollTo({
      top: document.querySelector(`.footnote-reference a[href="#${footnote.id}"]`).getBoundingClientRect().top + window.scrollY,
    }));
    const lastEl = footnote.lastElementChild || footnote;
    lastEl.appendChild(backlink);
  });
}

function enableImgLightense() {
  window.addEventListener("load", () => Lightense(".prose img:not(.no-lightense)", { background: 'rgba(43, 43, 43, 0.19)' }));
}

enableThemeToggle();
enableTagFilters();
enablePrerender();
if (document.body.classList.contains('post')) {
  enableOutdateAlert();
  addBackToTopBtn();
  enableTocTooltip();
  enableActiveToc();
}
if (document.body.classList.contains('blog')) {
  enableActiveToc();
  enableTitleShine();
  enableTitleTransition();
}
if (document.querySelector('.prose')) {
  addCopyBtns();
  wrapTables();
  addFootnoteBacklink();
  enableImgLightense();
}

// A text/plain Blob preserves the author source without rendering HTML or Markdown.
const markdownLink = document.querySelector('#markdown-btn');
const markdownSource = document.querySelector('#markdown-source');
if (markdownLink && markdownSource) {
  markdownLink.href = URL.createObjectURL(new Blob([markdownSource.value], { type: 'text/plain;charset=utf-8' }));
  markdownLink.hidden = false;
  markdownSource.remove();
}
