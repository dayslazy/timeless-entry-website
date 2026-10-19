// Shared site behavior: mobile nav, sticky header, scroll reveals, optional photos.
(() => {
  const body = document.body;
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');

  // Mobile nav
  const setNavTop = () => {
    if (header) document.documentElement.style.setProperty('--nav-top', header.getBoundingClientRect().bottom + 'px');
  };
  const closeNav = () => {
    body.classList.remove('nav-open');
    toggle?.setAttribute('aria-expanded', 'false');
  };
  toggle?.addEventListener('click', () => {
    setNavTop();
    const open = body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.site-nav a').forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1080) closeNav(); });

  // Header shadow once scrolled
  const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Scroll reveal
  const startReveals = () => {
    const items = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      items.forEach(el => io.observe(el));
    } else {
      items.forEach(el => el.classList.add('in'));
    }
  };

  // Intro garage door: page content animates in as the door rises past it
  const intro = document.querySelector('.garage-intro');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = document.documentElement.classList.contains('intro-seen');
  if (intro && !reduced && !seen) {
    const root = document.documentElement;
    root.classList.add('intro-playing');
    try { sessionStorage.setItem('te-intro-seen', '1'); } catch { /* storage blocked: intro just plays each time */ }
    const panels = [...intro.querySelectorAll('.gi-panel')];
    const n = panels.length;
    const DELAY = 500;   // pause on the closed door
    const JOLT = 450;    // little dip as the opener engages
    const RISE = 4300;   // the door going up and back
    const doorEl = intro.querySelector('.gi-door');
    let H, ph, R, arc, D;
    const measure = () => {
      H = doorEl.clientHeight;
      ph = H / n;
      R = ph * 0.85;                // radius of the curved track behind the header
      arc = (R * Math.PI) / 2;
      D = H + arc + 4;              // total travel: up the opening, then around the curve
    };
    measure();
    window.addEventListener('resize', measure);

    // Each panel rides a track like a real sectional door, seen from the
    // driveway: straight up, then it tips back into the garage behind the header.
    // u = position along the track (screen y, measured from the top of the opening)
    const track = u => {
      if (u >= 0) return { y: u, z: 0 };
      const s = -u;
      if (s < arc) return { y: -R * Math.sin(s / R), z: -R * (1 - Math.cos(s / R)) };
      return { y: -R, z: -R - (s - arc) };
    };
    // each panel hangs between two hinge points on the track, so neighbours always meet
    const place = d => {
      panels.forEach((p, i) => {
        const b = track((i + 1) * ph - d); // bottom hinge
        const t = track(i * ph - d);       // top hinge
        const a = Math.atan2(-(t.z - b.z), -(t.y - b.y));
        p.style.visibility = (i + 1) * ph - d < -arc ? 'hidden' : 'visible'; // fully inside the garage
        p.style.transform = `translate3d(0, ${b.y - (i + 1) * ph}px, ${b.z}px) rotateX(${a}rad)`;
        p.style.setProperty('--shade', (Math.abs(Math.sin(a)) * 0.5).toFixed(3));
      });
    };
    const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.classList.remove('intro-playing');
      window.removeEventListener('resize', measure);
      intro.remove();
    };
    let start = null;
    const frame = now => {
      if (finished) return;
      if (start === null) start = now;
      const t = now - start - DELAY;
      if (t < 0) place(0);
      else if (t < JOLT) place(-12 * Math.sin((Math.PI * t) / JOLT));
      else {
        const p = Math.min(1, (t - JOLT) / RISE);
        place(ease(p) * D);
        intro.style.opacity = p > 0.88 ? String(1 - (p - 0.88) / 0.12) : '1';
        if (p >= 1) return finish();
      }
      requestAnimationFrame(frame);
    };
    place(0);
    requestAnimationFrame(frame);
    setTimeout(finish, DELAY + JOLT + RISE + 2000); // safety net
  } else {
    intro?.remove();
  }
  startReveals();

  // Photos: drop real images into /images and they replace the illustrations automatically
  document.querySelectorAll('[data-img]').forEach(el => {
    const src = el.dataset.img;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add('has-img');
    };
    img.src = src;
  });

  // Preview mode: call / text / email buttons are for show only
  document.addEventListener('click', e => {
    if (e.target.closest('a[href="#"]')) e.preventDefault();
  });

  // Review rows: duplicate the cards once so the scroll loops seamlessly
  document.querySelectorAll('.rv-track').forEach(track => {
    [...track.children].forEach(card => {
      const copy = card.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.appendChild(copy);
    });
  });

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
