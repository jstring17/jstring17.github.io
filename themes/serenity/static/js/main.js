function enableThemeToggle() {
  const toggle = document.querySelector('#theme-toggle');
  if (!toggle) return;
  const root = document.documentElement;
  const hl = document.querySelector('link#hl');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  let saved;
  try { saved = localStorage.getItem('theme'); } catch {}
  // theme is the visitor's choice; while rings spread, the page catches up with it.
  let theme = saved || (preference.matches ? 'dark' : 'light');
  let turn = theme === 'dark' ? 1 : 0;
  const other = value => value === 'dark' ? 'light' : 'dark';
  function paint(value) {
    document.body.classList.toggle('dark', value === 'dark');
    if (hl) hl.href = hl.dataset[value];
  }
  function label() {
    const text = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    toggle.setAttribute('aria-label', text);
    toggle.title = text;
  }
  // The icon keeps turning the same way: one half turn per change.
  function choose(value) {
    theme = value;
    turn += 1;
    toggle.style.setProperty('--turn', turn);
    label();
  }

  // Circle reveal (see "Theme switch" in main.scss). A burst is one view transition: its old
  // snapshot is the theme from before the first click, the live page the other theme, and each
  // click adds a ring that grows from the button to the farthest corner.
  const RINGS = 8; // keep in step with $theme-rings in main.scss
  const SPREAD = 700;
  const EASE = 'cubic-bezier(0.25, 0.6, 0.3, 1)';
  const ringName = i => `--theme-ring-${i}`;
  const canSpread = Boolean(document.startViewTransition && window.CSS?.registerProperty);
  if (canSpread) {
    for (let i = 0; i < RINGS; i++) {
      try { CSS.registerProperty({ name: ringName(i), syntax: '<length>', inherits: false, initialValue: '0px' }); } catch {}
    }
  }
  let burst = null;

  function start() {
    const box = toggle.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const from = document.body.classList.contains('dark') ? 'dark' : 'light';
    const b = {
      from,
      box,
      radius: Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2,
      rings: new Array(RINGS).fill(null),
      full: -1, // the one ring that already covers the page, if any
      waiting: 0, // clicks that came before the transition was ready
      ready: false,
      hold: null,
    };
    burst = b;
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.classList.add('theme-switching');
    b.transition = document.startViewTransition(() => paint(other(from)));
    b.transition.ready.then(() => {
      b.ready = true;
      launch(b);
    }, () => {});
    b.transition.finished.finally(() => {
      // However the transition ended (all rings landed, or another transition cut in),
      // the page now simply shows the chosen theme.
      if (burst === b) burst = null;
      paint(theme);
      b.rings.forEach(ring => ring?.cancel());
      b.hold?.cancel();
      if (!burst) root.classList.remove('theme-switching', 'theme-flip');
    });
  }
  function launch(b) {
    for (; b.waiting > 0; b.waiting--) {
      const slot = b.rings.indexOf(null);
      const ring = root.animate({ [ringName(slot)]: ['0px', `${b.radius}px`] },
        { duration: SPREAD, easing: EASE, fill: 'forwards', pseudoElement: '::view-transition-new(root)' });
      b.rings[slot] = ring;
      ring.finished.then(() => land(b, slot), () => {});
    }
    // Keeps the transition open a little past the newest ring so land() can end it cleanly.
    b.hold?.cancel();
    b.hold = root.animate({ opacity: [1, 1] }, { duration: SPREAD + 300, pseudoElement: '::view-transition' });
  }
  function land(b, slot) {
    if (b.full < 0) {
      b.full = slot;
    } else {
      // Two rings that both cover the page cancel out, which frees their slots.
      b.rings[b.full].cancel();
      b.rings[slot].cancel();
      b.rings[b.full] = b.rings[slot] = null;
      b.full = -1;
    }
    if (b.waiting || b.rings.some((ring, i) => ring && i !== b.full)) return;
    // Every ring has landed, so the screen already shows the chosen theme everywhere; matching
    // the live page to it is invisible, and the transition can end.
    paint(theme);
    b.transition.skipTransition();
  }

  function press() {
    const spread = canSpread && motion.matches;
    // A full burst ignores further clicks until a ring lands.
    if (spread && burst && burst.rings.filter(Boolean).length + burst.waiting >= RINGS) return;
    choose(other(theme));
    saved = theme;
    try { localStorage.setItem('theme', saved); } catch {}
    if (!spread) { paint(theme); return; }
    if (!burst) start();
    burst.waiting += 1;
    if (burst.ready) launch(burst);
    // The button follows the centre ring, which shows the old theme on every second click.
    root.classList.toggle('theme-flip', theme === burst.from);
  }
  toggle.addEventListener('click', press);
  // Quick double and triple clicks should not select text next to the button.
  toggle.addEventListener('mousedown', event => { if (event.detail > 1) event.preventDefault(); });
  // While a view transition runs, Chrome sends pointer events to <html> instead of the element
  // under the pointer, so presses on the button's spot during a burst are handled here, and
  // their default (selecting the nearby tagline on a double or triple click) is cancelled.
  const onButton = event => {
    if (!burst || event.target !== root) return false;
    const { left, right, top, bottom } = burst.box;
    return event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom;
  };
  document.addEventListener('mousedown', event => { if (onButton(event)) event.preventDefault(); });
  document.addEventListener('click', event => { if (onButton(event)) press(); });
  preference.addEventListener('change', event => {
    if (saved) return;
    choose(event.matches ? 'dark' : 'light');
    if (!burst) paint(theme);
  });
  toggle.style.setProperty('--turn', turn);
  label();
  paint(theme);
}

function enableTagFilters() {
  const context = document.querySelector('#active-tag');
  if (!context) return;
  const posts = [...document.querySelectorAll('.post-entry')];
  // Field names in the home tagline work like tag links.
  const tagLinks = [...document.querySelectorAll('.post-tags a, .site-tagline a')];
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
    const link = event.target.closest('.post-tags a, .site-tagline a, #active-tag a');
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
    link.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') shine(); });
    // Keyboard focus runs the same light across the title.
    link.addEventListener('focus', () => { if (link.matches(':focus-visible')) shine(); });
    function shine() {
      if (!allowed.matches) return;
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
    }
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
      // Cut short sideways or after the third line: show the whole heading on hover.
      if (anchor.offsetWidth < anchor.scrollWidth || anchor.clientHeight + 1 < anchor.scrollHeight) {
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
    // Level with the entry's first line, also when a long heading wraps.
    const style = getComputedStyle(entry.link);
    const y = entry.link.offsetTop + parseFloat(style.borderTopWidth) + (parseFloat(style.lineHeight) - marker.offsetHeight) / 2;
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
    // Skip headings hidden by the tag filter or inside a folded section; the index dims the latter.
    entries.forEach(entry => entry.link.classList.toggle('is-folded', Boolean(entry.heading.closest('.fold.is-folded'))));
    const visible = entries.filter(entry => entry.heading.getClientRects().length && !entry.link.classList.contains('is-folded'));
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
  window.addEventListener('foldchange', schedule);
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

// Each h2 and h3 section folds under its heading. The content after a heading, up to the next
// heading of the same or a higher level, moves into a .fold wrapper; the chevron button in the
// left gutter toggles it.
function enableHeadingFolds() {
  const article = document.querySelector('body.post article.prose');
  if (!article) return;
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  const chevron = '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const level = el => /^H[2-6]$/.test(el.tagName) ? Number(el.tagName[1]) : 0;
  const syncs = new Map();
  const timers = new Map();
  let count = 0;

  function setFolded(fold, folded) {
    if (fold.classList.contains('is-folded') === folded) return;
    if (motion.matches) {
      // Clip the content only while it slides, so open sections never cut off outlines.
      fold.classList.add('is-moving');
      clearTimeout(timers.get(fold));
      timers.set(fold, setTimeout(() => fold.classList.remove('is-moving'), 320));
    }
    fold.classList.toggle('is-folded', folded);
    syncs.get(fold)();
    window.dispatchEvent(new Event('foldchange'));
  }

  function addToggle(heading, fold) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fold-toggle';
    button.innerHTML = chevron;
    button.setAttribute('aria-controls', fold.id);
    const name = heading.textContent.trim();
    const sync = () => {
      const open = !fold.classList.contains('is-folded');
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', `${open ? 'Fold' : 'Unfold'} section: ${name}`);
      heading.classList.toggle('is-folded', !open);
    };
    syncs.set(fold, sync);
    sync();
    button.addEventListener('click', () => setFolded(fold, !fold.classList.contains('is-folded')));
    heading.prepend(button);
  }

  function wrap(container, depth) {
    const children = [...container.children];
    for (let i = 0; i < children.length; i++) {
      const heading = children[i];
      if (level(heading) !== depth) continue;
      const fold = document.createElement('div');
      fold.className = 'fold';
      fold.id = `fold-${++count}`;
      const inner = document.createElement('div');
      inner.className = 'fold-inner';
      fold.append(inner);
      let j = i + 1;
      while (j < children.length && !(level(children[j]) && level(children[j]) <= depth)) inner.append(children[j++]);
      i = j - 1;
      if (!inner.children.length) continue;
      heading.after(fold);
      addToggle(heading, fold);
      if (depth < 3) wrap(inner, 3);
    }
  }
  wrap(article, 2);
  wrap(article, 3); // h3 sections that come before the first h2

  // Links into a folded section (the index, a shared URL) open the folds around the target.
  function reveal(target) {
    let opened = false;
    for (let fold = target.closest('.fold'); fold; fold = fold.parentElement.closest('.fold')) {
      if (fold.classList.contains('is-folded')) { setFolded(fold, false); opened = true; }
    }
    if (opened) setTimeout(() => target.scrollIntoView(), motion.matches ? 330 : 0);
  }
  const targetOf = hash => {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { id = hash.slice(1); }
    return id ? document.getElementById(id) : null;
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    const target = link && targetOf(link.hash);
    if (target) reveal(target);
  });
  window.addEventListener('hashchange', () => { const target = targetOf(location.hash); if (target) reveal(target); });
}

// The # after a heading copies a link to that heading instead of only jumping to it.
function enableAnchorCopy() {
  const timers = new Map();
  document.addEventListener('click', async event => {
    const anchor = event.target.closest('.prose .zola-anchor');
    if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(anchor.getAttribute('href'), location.href);
    history.replaceState(history.state, '', url.hash);
    const label = anchor.getAttribute('aria-label');
    try {
      await navigator.clipboard.writeText(url.href);
    } catch {
      // Older browsers and unfocused frames refuse the Clipboard API; copy through a selection.
      const field = document.createElement('textarea');
      field.value = url.href;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position: fixed; opacity: 0; pointer-events: none;';
      document.body.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      anchor.focus({ preventScroll: true });
      if (!copied) return;
    }
    anchor.dataset.copied = '';
    anchor.setAttribute('aria-label', 'Link copied');
    clearTimeout(timers.get(anchor));
    timers.set(anchor, setTimeout(() => {
      delete anchor.dataset.copied;
      anchor.setAttribute('aria-label', label);
    }, 1500));
  });
}

// Inline notes: the note component renders a phrase and its explanation. The phrase becomes a
// toggle; the explanation opens under its paragraph, or in the right margin when there is room
// (the index has the left one), joined to the line by a thin connector.
function enableNotes() {
  const article = document.querySelector('body.post article.prose');
  const notes = article ? [...article.querySelectorAll('.note')] : [];
  if (!notes.length) return;
  const wide = window.matchMedia('(min-width: 1240px)'); // room for a note beside the 720px column
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  const GAP = 16; // keep in step with the note offset in main.scss
  const layer = document.createElement('div');
  layer.className = 'note-layer';
  article.append(layer);
  const svgNS = 'http://www.w3.org/2000/svg';

  const items = notes.map((note, i) => {
    const ref = note.querySelector('.note-ref');
    const source = note.querySelector('.note-body');
    ref.setAttribute('role', 'button');
    ref.tabIndex = 0;
    ref.setAttribute('aria-expanded', 'false');
    const block = document.createElement('div');
    block.className = 'note-block';
    block.id = `note-${i + 1}`;
    block.setAttribute('role', 'note');
    block.hidden = true;
    const inner = document.createElement('div');
    inner.className = 'note-inner';
    const text = document.createElement('div');
    text.className = 'note-text';
    text.append(...source.childNodes);
    source.remove();
    inner.append(text);
    // The connector lives inside the note, so it fades and slides with the text as one piece.
    const connector = document.createElementNS(svgNS, 'svg');
    connector.classList.add('note-line');
    connector.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(svgNS, 'path');
    connector.append(line);
    block.append(connector, inner);
    ref.setAttribute('aria-controls', block.id);
    const host = ref.closest('li, p, blockquote, dd, td, th, figcaption') || note;
    return { note, ref, block, text, line, host, open: false, timer: 0 };
  });

  let beside = null;
  function place() {
    if (beside === wide.matches) return;
    beside = wide.matches;
    article.classList.toggle('notes-beside', beside);
    if (beside) {
      items.forEach(item => layer.append(item.block));
    } else {
      // Under the paragraph, in reading order; inside list items and cells, at their end.
      const tails = new Map();
      items.forEach(item => {
        const tail = tails.get(item.host);
        if (tail) tail.after(item.block);
        else if (item.host.matches('li, dd, td, th')) item.host.append(item.block);
        else item.host.after(item.block);
        tails.set(item.host, item.block);
      });
    }
    layout();
  }

  function layout() {
    if (!beside) return;
    const box = article.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(article).paddingRight);
    let floor = -Infinity;
    for (const item of items) {
      // A closing note keeps its place and its line until it has faded out.
      if (item.block.hidden) continue;
      const rect = item.ref.getClientRects()[0];
      const shown = rect && !item.ref.closest('.fold.is-folded');
      item.block.classList.toggle('is-away', !shown);
      if (!shown) continue;
      // The note's first line sits level with the phrase; notes that would overlap stack down.
      const half = parseFloat(getComputedStyle(item.text).lineHeight) / 2;
      const center = rect.top + rect.height / 2 - box.top;
      const top = Math.max(center - half, floor + 16);
      item.block.style.top = `${top}px`;
      floor = top + item.block.offsetHeight;
      // In the note's own coordinates: from just past the end of the text column (x0, level
      // with the phrase) to the note's rule at x = 0, level with its first line.
      const x0 = 8 - pad - GAP;
      const y0 = center - top;
      item.line.setAttribute('d', Math.abs(y0 - half) < 0.5
        ? `M${x0} ${half}H0`
        : `M${x0} ${y0}H${x0 / 2}V${half}H0`);
    }
  }
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; layout(); });
  };

  function toggle(item, open = !item.open) {
    if (open === item.open) return;
    item.open = open;
    item.ref.setAttribute('aria-expanded', String(open));
    item.note.classList.toggle('is-open', open);
    clearTimeout(item.timer);
    if (open) {
      item.block.hidden = false;
      layout();
      item.block.getBoundingClientRect(); // start the transition from the closed state
      item.block.classList.add('is-open');
    } else {
      item.block.classList.remove('is-open');
      layout();
      const done = () => { item.block.hidden = true; layout(); };
      if (motion.matches) item.timer = setTimeout(done, 300);
      else done();
    }
  }

  items.forEach(item => {
    item.ref.addEventListener('click', () => toggle(item));
    item.ref.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle(item);
    });
    // Pointing at a phrase or its note darkens both and the line between them.
    const link = on => [item.note, item.block].forEach(el => el.classList.toggle('is-linked', on));
    [item.ref, item.block].forEach(el => {
      el.addEventListener('pointerenter', () => link(true));
      el.addEventListener('pointerleave', () => link(false));
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
      items.forEach(item => toggle(item, false));
    }
  });

  wide.addEventListener('change', place);
  window.addEventListener('resize', schedule);
  window.addEventListener('foldchange', schedule);
  // The article reflows with folds and images; a note grows when an image inside it loads.
  const resize = new ResizeObserver(schedule);
  resize.observe(article);
  items.forEach(item => resize.observe(item.block));
  document.fonts.ready.then(schedule);
  place();
}

// Bond field: a toy in the page's empty space, drawn behind the content in the text colour.
// A click drops a few atoms that drift and bond with neighbours; dragging draws a chain; holding
// gathers a cluster that bursts on release; an atom can be grabbed and pulled. It only answers
// presses on bare containers, never on text, links or controls, so reading and selecting text
// work as before. Touch keeps scrolling: a tap drops atoms and a long press gathers them.
function enableBondField() {
  if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'bond-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const BOND = 48;      // atoms closer than this are drawn bonded and pull toward REST
  const REST = 30;
  const STEP = 18;      // spacing of a dragged chain
  const LIFE = 9000;    // ms an atom lives; it fades in quickly and out over FADE
  const FADE = 2500;
  const HOLD = 350;     // ms a still press waits before it starts gathering
  const PUSH = 260;     // reach of a modifier-click push
  const SWEEP = 90;     // reach of a held modifier press as it moves
  const MAX = 160;
  const BLANK = 'html, body, #wrapper, main, .blog-main, .blog-posts, .year-group, .year-posts, '
    + 'article.prose, .fold, .fold-inner, aside, footer, .site-header';
  let atoms = [];
  let chains = [];      // explicit bonds from dragging: { a, b }
  let rings = [];       // shock rings from pushes: { x, y, born }
  let press = null;
  let frame = 0;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function start() { if (!frame) frame = requestAnimationFrame(tick); }
  function add(x, y, vx = 0, vy = 0) {
    // vx/vy carry pushes and pulls and die away; dx/dy is the atom's own slow, steady drift, so
    // a fresh cluster keeps spreading apart and its bonds fade as the atoms part.
    const atom = { x, y, vx, vy, dx: (Math.random() - 0.5) * 0.35, dy: (Math.random() - 0.5) * 0.35,
      r: 2 + Math.random() * 1.6, born: performance.now() };
    atoms.push(atom);
    if (atoms.length > MAX) {
      const old = atoms.shift();
      chains = chains.filter(c => c.a !== old && c.b !== old);
    }
    start();
    return atom;
  }
  function scatter(x, y, count, spread) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.random() * spread;
      add(x + Math.cos(angle) * d, y + Math.sin(angle) * d);
    }
  }
  const nearest = (x, y, within) => {
    let best = null;
    let bestD = within;
    for (const atom of atoms) {
      const d = Math.hypot(atom.x - x, atom.y - y);
      if (d < bestD) { best = atom; bestD = d; }
    }
    return best;
  };
  // Page coordinates, so atoms stay where they were dropped while the page scrolls.
  const at = event => ({ x: event.clientX + window.scrollX, y: event.clientY + window.scrollY });
  // A push flings nearby atoms outward, harder the closer they are, with a thin shock ring.
  // Flung atoms glide; any that leave the screen are gone.
  function blast(x, y) {
    for (const atom of atoms) {
      const dx = atom.x - x;
      const dy = atom.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > PUSH) continue;
      const speed = 5 + 11 * (1 - d / PUSH);
      atom.vx += dx / d * speed;
      atom.vy += dy / d * speed;
      atom.flung = true;
    }
    rings.push({ x, y, born: performance.now() });
    start();
  }
  const pushing = event => event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;

  function isBlank(event) {
    // Mouse events have no isPrimary; only a second finger or pen is turned away.
    if (event.button !== 0 || event.isPrimary === false) return false;
    if (document.documentElement.classList.contains('theme-switching') || document.querySelector('dialog[open]')) return false;
    return event.target instanceof Element && event.target.matches(BLANK);
  }

  // Selection starts on mousedown, so a press that belongs to the field cancels it there.
  // Clicking blank space still clears an old selection and focus, as it would without the field.
  document.addEventListener('mousedown', event => {
    if (!isBlank(event)) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  // On a Mac, Ctrl-click opens the context menu; on blank space it pushes instead.
  document.addEventListener('contextmenu', event => {
    if (event.ctrlKey && event.target instanceof Element && event.target.matches(BLANK)) event.preventDefault();
  });

  document.addEventListener('pointerdown', event => {
    if (!isBlank(event)) return;
    const { x, y } = at(event);
    // Shift, Ctrl, Alt or Cmd with a press pushes atoms away; held and moved, it sweeps them.
    if (event.pointerType !== 'touch' && pushing(event)) {
      press = { id: event.pointerId, touch: false, cx: event.clientX, cy: event.clientY, x, y, mode: 'push', timer: 0, spawn: 0 };
      try { event.target.setPointerCapture(event.pointerId); } catch {}
      blast(x, y);
      return;
    }
    const grabbed = event.pointerType === 'touch' ? null : nearest(x, y, 14);
    press = { id: event.pointerId, touch: event.pointerType === 'touch', cx: event.clientX, cy: event.clientY,
      x, y, mode: grabbed ? 'grab' : 'press', atom: grabbed, last: null, gathered: 0, timer: 0, spawn: 0 };
    // Keep receiving the drag even if the pointer leaves the window before it is released.
    if (!press.touch) { try { event.target.setPointerCapture(event.pointerId); } catch {} }
    if (grabbed) { grabbed.born = performance.now(); start(); return; }
    press.timer = setTimeout(() => {
      if (!press || press.mode !== 'press') return;
      press.mode = 'hold';
      press.spawn = setInterval(() => {
        if (!press || press.mode !== 'hold' || press.gathered >= 14) return;
        press.gathered++;
        const angle = Math.random() * Math.PI * 2;
        const d = 10 + Math.random() * 16;
        add(press.x + Math.cos(angle) * d, press.y + Math.sin(angle) * d);
      }, 70);
      start();
    }, HOLD);
  });

  document.addEventListener('pointermove', event => {
    if (!press || event.pointerId !== press.id) return;
    const { x, y } = at(event);
    if (press.mode === 'press' && Math.hypot(event.clientX - press.cx, event.clientY - press.cy) > 6) {
      clearTimeout(press.timer);
      if (press.touch) { press = null; return; } // a touch drag scrolls the page
      press.mode = 'draw';
      press.last = add(press.x, press.y);
    }
    if (press.mode === 'draw') {
      // Lay atoms along the path at even spacing, each bonded to the one before.
      let dx = x - press.last.x;
      let dy = y - press.last.y;
      let d = Math.hypot(dx, dy);
      while (d >= STEP) {
        const next = add(press.last.x + dx / d * STEP, press.last.y + dy / d * STEP);
        chains.push({ a: press.last, b: next });
        press.last = next;
        dx = x - next.x;
        dy = y - next.y;
        d = Math.hypot(dx, dy);
      }
    } else if (press.mode === 'grab') {
      press.atom.vx = x - press.atom.x;
      press.atom.vy = y - press.atom.y;
      press.atom.x = x;
      press.atom.y = y;
    } else if (press.mode === 'hold' || press.mode === 'push') {
      press.x = x;
      press.y = y;
    }
  });

  function release(event) {
    if (!press || event.pointerId !== press.id) return;
    clearTimeout(press.timer);
    clearInterval(press.spawn);
    if (press.mode === 'press' && event.type === 'pointerup') {
      scatter(press.x, press.y, 5, 22);
    } else if (press.mode === 'hold') {
      // Let go: everything gathered nearby bursts outward, and bonds snap as atoms part.
      for (const atom of atoms) {
        const dx = atom.x - press.x;
        const dy = atom.y - press.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 120) continue;
        const speed = 3 + 5 * (1 - d / 120);
        atom.vx += dx / d * speed;
        atom.vy += dy / d * speed;
      }
    }
    press = null;
  }
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);

  const fade = (atom, now) => {
    const age = now - atom.born;
    return Math.max(0, Math.min(1, age / 300, (LIFE - age) / FADE));
  };

  function tick(now) {
    frame = 0;
    atoms = atoms.filter(atom => now - atom.born < LIFE);
    chains = chains.filter(c => atoms.includes(c.a) && atoms.includes(c.b));
    const chained = new Set(chains.map(c => c.a).concat(chains.map(c => c.b)));
    // Left alone, atoms only drift and bonds are just drawn between near ones. While an atom is
    // being pulled, near neighbours spring toward a resting distance so the molecule follows.
    if (press?.mode === 'grab') for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < atoms.length; j++) {
        const b = atoms[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d >= BOND) continue;
        const f = (d - REST) * 0.006;
        a.vx += dx / d * f; a.vy += dy / d * f;
        b.vx -= dx / d * f; b.vy -= dy / d * f;
      }
    }
    for (const { a, b } of chains) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - STEP) * 0.03;
      a.vx += dx / d * f; a.vy += dy / d * f;
      b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const atom of atoms) {
      if (press?.mode === 'hold') {
        const dx = press.x - atom.x;
        const dy = press.y - atom.y;
        if (Math.hypot(dx, dy) < 140) { atom.vx += dx * 0.004; atom.vy += dy * 0.004; }
      } else if (press?.mode === 'push') {
        const dx = atom.x - press.x;
        const dy = atom.y - press.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < SWEEP) {
          const f = 0.8 * (1 - d / SWEEP);
          atom.vx += dx / d * f;
          atom.vy += dy / d * f;
          atom.flung = true;
        }
      }
      if (press?.mode === 'grab' && atom === press.atom) continue;
      // A flung atom glides until it slows down, then drifts like the rest.
      const keep = atom.flung ? 0.985 : 0.95;
      atom.vx *= keep;
      atom.vy *= keep;
      if (atom.flung && Math.hypot(atom.vx, atom.vy) < 0.3) atom.flung = false;
      atom.x += atom.vx + atom.dx;
      atom.y += atom.vy + atom.dy;
    }
    // Flung atoms that leave the screen are gone; others stay pinned to the page.
    const left = window.scrollX - 20;
    const top = window.scrollY - 20;
    const right = window.scrollX + innerWidth + 20;
    const bottom = window.scrollY + innerHeight + 20;
    const before = atoms.length;
    atoms = atoms.filter(a => !a.flung || (a.x > left && a.x < right && a.y > top && a.y < bottom));
    if (atoms.length !== before) chains = chains.filter(c => atoms.includes(c.a) && atoms.includes(c.b));
    rings = rings.filter(ring => now - ring.born < 450);

    ctx.setTransform(dpr, 0, 0, dpr, -window.scrollX * dpr, -window.scrollY * dpr);
    ctx.clearRect(window.scrollX, window.scrollY, innerWidth, innerHeight);
    const color = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#222';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < atoms.length; j++) {
        const b = atoms[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d >= BOND) continue;
        ctx.globalAlpha = Math.min(fade(a, now), fade(b, now)) * (1 - d / BOND) * 0.6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (const { a, b } of chains) {
      if (Math.hypot(b.x - a.x, b.y - a.y) < BOND) continue; // already drawn above
      ctx.globalAlpha = Math.min(fade(a, now), fade(b, now)) * 0.35;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const atom of atoms) {
      ctx.globalAlpha = fade(atom, now) * (chained.has(atom) ? 0.75 : 0.85);
      ctx.beginPath(); ctx.arc(atom.x, atom.y, atom.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const ring of rings) {
      const k = (now - ring.born) / 450;
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, 8 + (PUSH - 8) * (1 - (1 - k) ** 3), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (atoms.length || press || rings.length) start();
    else ctx.clearRect(window.scrollX, window.scrollY, innerWidth, innerHeight);
  }
  // Atoms are pinned to the page, so a scroll while they live just needs the next frame.
  window.addEventListener('scroll', () => { if (atoms.length) start(); }, { passive: true });
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
  enableHeadingFolds();
  enableAnchorCopy();
  enableNotes();
  enableImgLightense();
}
enableBondField();

// A text/plain Blob preserves the author source without rendering HTML or Markdown.
const markdownLink = document.querySelector('#markdown-btn');
const markdownSource = document.querySelector('#markdown-source');
if (markdownLink && markdownSource) {
  markdownLink.href = URL.createObjectURL(new Blob([markdownSource.value], { type: 'text/plain;charset=utf-8' }));
  markdownLink.hidden = false;
  markdownSource.remove();
}
