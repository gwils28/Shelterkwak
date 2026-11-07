// Animations d'ambiance des monuments (page Monument), avec GSAP.
// Chaque scène cible des éléments par classe (anim-*) : ceux du décor (couche ambient) et ceux du
// dessin des paliers. Un palier est dessiné une fois par bande ; les copies reçoivent toutes la même
// animation, si bien que le monument reste continu d'une bande à l'autre.
// Tout est coupé si l'appareil demande moins d'animations, ou si l'utilisateur les a désactivées.

import gsap from "gsap";
import { CX, GROUND, LAYOUT, type MonumentStyle, tierTop } from "./monument";
import { animationsEnabled } from "./prefs";

type Q = (selector: string) => Element[];
const SINE = "sine.inOut";
const LAST_LEVEL_KEY = "shelterkwak.monument.lastLevel";

function num(el: Element, attr: string, fallback = 0): number {
  const v = Number(el.getAttribute(attr));
  return Number.isFinite(v) ? v : fallback;
}

/** Vol d'oiseaux : boucle en huit autour de leur position, battement d'ailes. */
function birds(q: Q) {
  q(".anim-bird").forEach((b, i) => {
    const amp = 34 + i * 8;
    gsap.to(b, { x: `+=${amp}`, duration: 3.6 + i * 0.7, ease: SINE, yoyo: true, repeat: -1, delay: i * 0.6 });
    gsap.to(b, { y: `+=${10 + i * 3}`, duration: 1.8 + i * 0.35, ease: SINE, yoyo: true, repeat: -1, delay: i * 0.3 });
  });
  gsap.to(q(".anim-wing"), { scaleY: 0.35, transformOrigin: "50% 100%", duration: 0.28, ease: SINE, yoyo: true, repeat: -1, stagger: 0.11 });
}

function clouds(q: Q) {
  q(".anim-cloud").forEach((c, i) => gsap.to(c, { x: i % 2 ? -26 : 26, duration: 14 + i * 4, ease: SINE, yoyo: true, repeat: -1 }));
}

function twinkle(targets: Element[], peak = 1) {
  targets.forEach((el) =>
    gsap.to(el, {
      keyframes: { opacity: [0, peak, 0], scale: [0.6, 1, 0.6] },
      transformOrigin: "50% 50%",
      duration: gsap.utils.random(1.2, 2.4),
      repeat: -1,
      repeatDelay: gsap.utils.random(0.2, 2.5),
      delay: gsap.utils.random(0, 2),
      ease: SINE,
    }),
  );
}

/** Chute avec dérive (feuilles, pétales) : distance dans data-fall. */
function falling(targets: Element[], spin = 300) {
  targets.forEach((el, i) => {
    const fall = num(el, "data-fall", 200);
    const tl = gsap.timeline({ repeat: -1, repeatDelay: gsap.utils.random(0.5, 3), delay: i * 1.3 });
    tl.set(el, { x: 0, y: 0, rotation: 0, opacity: 0, transformOrigin: "50% 50%" })
      .to(el, { opacity: 1, duration: 0.4 })
      .to(el, { y: fall, rotation: spin, duration: fall / 45, ease: "none" }, "<")
      .to(el, { keyframes: { x: [0, 14, -10, 8, 0] }, duration: fall / 45, ease: SINE }, "<")
      .to(el, { opacity: 0, duration: 0.5 }, "-=0.5");
  });
}

const SCENES: Record<MonumentStyle, (q: Q, level: number) => void> = {
  colonne: (q) => {
    gsap.fromTo(q(".anim-sheen"), { x: -110 }, { x: 110, duration: 3.2, ease: "power1.inOut", repeat: -1, repeatDelay: 3.5 });
    q(".anim-mote").forEach((m, i) =>
      gsap.to(m, { keyframes: { y: [0, -80], x: [0, 6, -4, 0], opacity: [0, 0.8, 0] }, duration: 7 + (i % 4), repeat: -1, delay: i * 0.8, ease: "none" }),
    );
    twinkle(q(".anim-glint"));
  },
  pyramide: (q) => {
    q(".anim-sand").forEach((s, i) =>
      gsap.fromTo(s, { x: -30, opacity: 0 }, { x: 280, keyframes: { opacity: [0, 0.8, 0.8, 0] }, duration: 2.6 + i * 0.5, ease: "none", repeat: -1, delay: i * 0.9 }),
    );
    twinkle(q(".anim-glint"));
    gsap.to(q(".anim-sun"), { scale: 1.15, transformOrigin: "50% 50%", opacity: 0.4, duration: 2.5, ease: SINE, yoyo: true, repeat: -1 });
  },
  arbre: (q) => {
    gsap.fromTo(q(".anim-sway"), { rotation: -1.3 }, { rotation: 1.3, svgOrigin: `${CX} 430`, duration: 3.4, ease: SINE, yoyo: true, repeat: -1 });
    falling(q(".anim-leaf"));
  },
  azteque: (q) => {
    gsap.to(q(".anim-rays"), { rotation: 360, svgOrigin: `${CX} 30`, duration: 80, ease: "none", repeat: -1 });
    q(".anim-smoke").forEach((s, i) =>
      gsap.to(s, {
        keyframes: { y: [0, -34], x: [0, i % 2 ? 8 : -8], scale: [0.4, 1.8], opacity: [0, 0.55, 0] },
        transformOrigin: "50% 50%",
        duration: 4,
        repeat: -1,
        delay: i,
        ease: "none",
      }),
    );
  },
  eiffel: (q) => {
    clouds(q);
    gsap.fromTo(q(".anim-beam"), { scaleX: 1 }, { scaleX: -1, svgOrigin: `${CX} 29`, duration: 3, ease: SINE, yoyo: true, repeat: -1 });
    // Le vrai scintillement : des milliers d'ampoules qui crépitent au hasard
    q(".anim-twinkle").forEach((s) =>
      gsap.to(s, { opacity: 1, duration: 0.08, yoyo: true, repeat: -1, repeatDelay: gsap.utils.random(0.1, 1.4), delay: gsap.utils.random(0, 1.5) }),
    );
  },
  liberte: (q) => {
    gsap.to(q(".anim-flame"), { keyframes: { scaleY: [1, 1.14, 0.94, 1.08, 1], scaleX: [1, 0.94, 1.04, 0.97, 1] }, duration: 1.3, repeat: -1, ease: SINE });
    q(".anim-wave").forEach((w, i) => gsap.to(w, { x: i % 2 ? 10 : -10, duration: 2.6 + i * 0.3, ease: SINE, yoyo: true, repeat: -1 }));
    birds(q);
  },
  glace: (q) => {
    const splashes = q(".anim-splash");
    q(".anim-drop").forEach((d, i) => {
      const fall = num(d, "data-fall", 20);
      const splash = splashes.find((s) => s.getAttribute("data-i") === String(i));
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 + i * 0.9, delay: i * 1.4 });
      tl.set(d, { y: 0, scale: 0, opacity: 1, transformOrigin: "50% 0%" })
        .to(d, { scale: 1, duration: 1.6, ease: "power1.in" })
        .to(d, { y: fall, duration: Math.sqrt(fall) / 9, ease: "power2.in" })
        .set(d, { opacity: 0 });
      if (splash) tl.fromTo(splash, { scale: 0.2, opacity: 0.9, transformOrigin: "50% 50%" }, { scale: 1.8, opacity: 0, duration: 0.7, ease: "power2.out" });
    });
    twinkle(q(".anim-sparkle"));
    gsap.to(q(".anim-aurora"), { keyframes: { x: [0, 14, -10, 0], skewX: [0, 6, -4, 0], opacity: [1, 0.65, 1] }, duration: 9, repeat: -1, ease: SINE });
  },
  djenne: (q) => birds(q),
  moai: (q) => {
    clouds(q);
    birds(q);
    gsap.to(q(".anim-sea"), { x: 24, duration: 3, ease: SINE, yoyo: true, repeat: -1 });
  },
  pagode: (q) => {
    gsap.fromTo(q(".anim-bell"), { rotation: -12 }, { rotation: 12, duration: 1.4, ease: SINE, yoyo: true, repeat: -1, stagger: { each: 0.09, from: "random" } });
    falling(q(".anim-petal"), 540);
  },
  bouddha: (q) => {
    // respiration calme : 4 s d'inspiration, 4 s d'expiration
    gsap.to(q(".anim-halo"), { scale: 1.06, opacity: "+=0.2", svgOrigin: `${CX} 150`, duration: 4, ease: SINE, yoyo: true, repeat: -1 });
    q(".anim-incense").forEach((s, i) =>
      gsap.fromTo(
        s,
        { y: 0, opacity: 0, scaleX: 1 },
        { keyframes: { y: [0, -26], opacity: [0, 0.7, 0], scaleX: [1, 1.6] }, transformOrigin: "50% 100%", duration: 5, repeat: -1, delay: (i % 3) * 1.6, ease: "none" },
      ),
    );
  },
  fusee: (q, level) => {
    twinkle(q(".anim-star"));
    q(".anim-steam").forEach((s, i) => {
      const dir = num(s, "data-dir", 1);
      gsap.fromTo(
        s,
        { x: 0, y: 0, scale: 0.3, opacity: 0 },
        { keyframes: { x: [0, dir * 26], y: [0, -10], scale: [0.3, 2.2], opacity: [0, 0.75, 0] }, transformOrigin: "50% 50%", duration: 3, repeat: -1, delay: i * 0.5, ease: "power1.out" },
      );
    });
    if (level >= LAYOUT.levels) {
      gsap.to(q(".anim-thrust"), { scaleY: 1.25, scaleX: 0.92, duration: 0.09, ease: "none", yoyo: true, repeat: -1 });
      gsap.to(q(".tier-art, .crown"), { x: 0.7, duration: 0.05, ease: "none", yoyo: true, repeat: -1 });
    }
  },
  tornade: (q) => {
    gsap.fromTo(q(".anim-funnel"), { rotation: -1.4 }, { rotation: 1.4, svgOrigin: `${CX} ${GROUND}`, duration: 2.6, ease: SINE, yoyo: true, repeat: -1 });
    gsap.set(q(".anim-swirl"), { strokeDasharray: "22 9" });
    gsap.to(q(".anim-swirl"), { strokeDashoffset: -62, duration: 1.1, ease: "none", repeat: -1 });
    q(".anim-debris").forEach((d, i) => {
      const r = 26 + i * 9;
      gsap.to(d, { keyframes: { x: [-r, 0, r, 0, -r], scale: [1, 1.3, 1, 0.7, 1] }, rotation: 360, transformOrigin: "50% 50%", duration: 1.6 + i * 0.25, ease: "none", repeat: -1 });
      gsap.to(d, { y: -12, duration: 0.8 + i * 0.1, ease: SINE, yoyo: true, repeat: -1 });
    });
    const flash = gsap.timeline({ repeat: -1, repeatDelay: 3.5 });
    flash
      .to(q(".anim-cloudflash"), { opacity: 0.55, duration: 0.06 })
      .to(q(".anim-bolt"), { opacity: 0, duration: 0.05 }, "<")
      .to(q(".anim-cloudflash"), { opacity: 0, duration: 0.12 })
      .to(q(".anim-bolt"), { opacity: 1, duration: 0.05 }, "<")
      .to(q(".anim-cloudflash"), { opacity: 0.35, duration: 0.05 })
      .to(q(".anim-cloudflash"), { opacity: 0, duration: 0.4 });
  },
  tamu: (q) => {
    gsap.to(q(".anim-fish"), { keyframes: { x: [0, -26, -10, 14, 0], y: [0, -6, 4, -3, 0] }, duration: 12, ease: SINE, repeat: -1 });
    gsap.to(q(".anim-jelly"), { y: -16, duration: 3.2, ease: SINE, yoyo: true, repeat: -1 });
    gsap.to(q(".anim-jelly"), { scaleY: 0.86, scaleX: 1.08, duration: 0.8, ease: SINE, yoyo: true, repeat: -1 });
    q(".anim-ray").forEach((r, i) => gsap.to(r, { opacity: "+=0.06", x: i % 2 ? 8 : -8, duration: 4 + i, ease: SINE, yoyo: true, repeat: -1 }));
    q(".anim-bubble").forEach((b, i) => {
      const rise = num(b, "data-rise", 400);
      gsap.fromTo(
        b,
        { y: 0, x: 0, opacity: 0 },
        { y: -rise, keyframes: { x: [0, 4, -3, 2], opacity: [0, 0.9, 0.9, 0] }, duration: 7 + i, ease: "none", repeat: -1, delay: i * 1.2 },
      );
    });
  },
};

/** Le palier en cours respire doucement ; un palier tout juste acquis se remplit avec un éclat. */
function common(q: Q, svg: SVGSVGElement, level: number, created: Element[]) {
  gsap.to(q(".drum.current .tier-art"), { opacity: 0.72, duration: 1.4, ease: SINE, yoyo: true, repeat: -1 });

  let last: number | null = null;
  try {
    const raw = localStorage.getItem(LAST_LEVEL_KEY);
    last = raw === null ? null : Number(raw);
    localStorage.setItem(LAST_LEVEL_KEY, String(level));
  } catch {
    return;
  }
  if (last === null || !(level > last)) return;
  for (let n = last + 1; n <= level; n++) {
    const art = q(`.drum[data-n="${n}"] .tier-art`);
    const delay = (n - last - 1) * 0.6 + 0.3;
    gsap.fromTo(art, { opacity: 0.15, filter: "grayscale(1)" }, { opacity: 1, filter: "grayscale(0)", duration: 1.1, delay, ease: "power2.out" });
    const cy = tierTop(n) + LAYOUT.tier / 2;
    for (let k = 0; k < 14; k++) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      p.setAttribute("cx", String(CX));
      p.setAttribute("cy", String(cy));
      p.setAttribute("r", String(gsap.utils.random(1.5, 3.2)));
      p.setAttribute("fill", k % 3 ? "#f0d77a" : "#ffffff");
      p.setAttribute("pointer-events", "none");
      svg.appendChild(p);
      created.push(p);
      const a = (k / 14) * Math.PI * 2;
      const dist = gsap.utils.random(40, 90);
      gsap.fromTo(
        p,
        { x: 0, y: 0, opacity: 1 },
        { x: Math.cos(a) * dist, y: Math.sin(a) * dist * 0.6, opacity: 0, duration: 1.2, delay: delay + 0.5, ease: "power2.out", onComplete: () => p.remove() },
      );
    }
  }
}

/** Lance les animations d'un monument dans son SVG ; renvoie la fonction qui les arrête. */
export function animateMonument(svg: SVGSVGElement, style: MonumentStyle, level: number): () => void {
  const created: Element[] = [];
  if (!animationsEnabled()) return () => {};
  const mm = gsap.matchMedia();
  mm.add(
    "(prefers-reduced-motion: no-preference)",
    () => {
      const q = gsap.utils.selector(svg) as Q;
      SCENES[style]?.(q, level);
      common(q, svg, level, created);
    },
    svg,
  );
  return () => {
    mm.revert();
    created.forEach((el) => el.remove());
  };
}
