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
  const svgNS = 'http://www.w3.org/2000/svg';
  const lines = document.createElementNS(svgNS, 'svg');
  lines.classList.add('note-lines');
  lines.setAttribute('aria-hidden', 'true');
  layer.append(lines);
  article.append(layer);

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
    block.append(inner);
    ref.setAttribute('aria-controls', block.id);
    const line = document.createElementNS(svgNS, 'path');
    lines.append(line);
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
    if (!beside) { items.forEach(item => item.line.setAttribute('d', '')); return; }
    const box = article.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(article).paddingRight);
    let floor = -Infinity;
    for (const item of items) {
      const rect = item.ref.getClientRects()[0];
      const shown = item.open && rect && !item.ref.closest('.fold.is-folded');
      item.block.classList.toggle('is-away', item.open && !shown);
      if (!shown) { item.line.setAttribute('d', ''); continue; }
      // The note's first line sits level with the phrase; notes that would overlap stack down.
      const half = parseFloat(getComputedStyle(item.text).lineHeight) / 2;
      const center = rect.top + rect.height / 2 - box.top;
      const top = Math.max(center - half, floor + 16);
      item.block.style.top = `${top}px`;
      floor = top + item.block.offsetHeight;
      // From just past the end of the text column to the note's rule.
      const x0 = 8 - pad;
      const x1 = GAP;
      const y1 = top + half;
      const xm = (x0 + x1) / 2;
      item.line.setAttribute('d', Math.abs(y1 - center) < 0.5
        ? `M${x0} ${center}H${x1}`
        : `M${x0} ${center}H${xm}V${y1}H${x1}`);
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
    const link = on => [item.note, item.block, item.line].forEach(el => el.classList.toggle('is-linked', on));
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
  new ResizeObserver(schedule).observe(article);
  document.fonts.ready.then(schedule);
  place();
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

// A text/plain Blob preserves the author source without rendering HTML or Markdown.
const markdownLink = document.querySelector('#markdown-btn');
const markdownSource = document.querySelector('#markdown-source');
if (markdownLink && markdownSource) {
  markdownLink.href = URL.createObjectURL(new Blob([markdownSource.value], { type: 'text/plain;charset=utf-8' }));
  markdownLink.hidden = false;
  markdownSource.remove();
}
