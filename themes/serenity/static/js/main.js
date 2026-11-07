function enableThemeToggle() {
  const themeToggle = document.querySelector('#theme-toggle');
  if (!themeToggle) return;
  const hlLink = document.querySelector('link#hl');
  const preferDark = window.matchMedia("(prefers-color-scheme: dark)");
  function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    if (hlLink) hlLink.href = hlLink.dataset[theme];
  }
  themeToggle.addEventListener('click', () => {
    const theme = document.body.classList.contains('dark') ? 'light' : 'dark';
    sessionStorage.setItem('theme', theme);
    applyTheme(theme);
  });
  preferDark.addEventListener('change', e => {
    if (!sessionStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
  applyTheme(sessionStorage.getItem('theme') || (preferDark.matches ? 'dark' : 'light'));
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
  const nav = document.querySelector('body.post aside nav');
  if (!nav) return;
  const entries = [...nav.querySelectorAll('a[href^="#"]')].map(link => {
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { id = link.hash.slice(1); }
    return { link, heading: document.getElementById(id) };
  }).filter(entry => entry.heading);
  if (!entries.length) return;
  let active;
  let scheduled = false;
  const update = () => {
    scheduled = false;
    let current = entries[0];
    for (const entry of entries) {
      if (entry.heading.getBoundingClientRect().top <= 80) current = entry;
      else break;
    }
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = entries[entries.length - 1];
    }
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
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
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
enablePrerender();
if (document.body.classList.contains('post')) {
  enableOutdateAlert();
  addBackToTopBtn();
  enableTocTooltip();
  enableActiveToc();
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
