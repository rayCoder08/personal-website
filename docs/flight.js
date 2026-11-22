(() => {
  const desktop = window.matchMedia("(min-width: 900px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)");
  const stage = document.querySelector(".hero-stage");
  const work = document.querySelector("#work");
  const hero = stage?.querySelector(".hero");
  const canvas = stage?.querySelector(".flight-replay");
  const context = canvas?.getContext("2d");
  if (!hero || !work || !context) return;

  // Aerochronix's fixed-camera capture: 40 tiles follow the static first frame.
  const tileLeft = 248;
  const tileWidth = 344;
  const tileColumns = 5;
  const lastFrame = 40;
  const atlas = new Image();
  atlas.decoding = "async";
  let paintedFrame = 0;
  let pendingPaint = 0;
  let atlasReady = false;

  const clamp = (value) => Math.max(0, Math.min(1, value));

  function paint() {
    pendingPaint = 0;
    const bounds = stage.getBoundingClientRect();
    const travel = bounds.height - hero.offsetHeight;
    if (travel <= 0) return;

    const progress = clamp(-bounds.top / travel);
    const fadeStart = hero.offsetHeight - 56;
    const fadeEnd = Math.min(160, window.innerHeight * 0.2);
    const fade = clamp((fadeStart - work.getBoundingClientRect().top) / (fadeStart - fadeEnd));
    const alpha = 1 - fade * fade * (3 - 2 * fade);
    hero.style.setProperty("--hero-alpha", alpha);

    if (!atlas.src && bounds.bottom > 0 && bounds.top < window.innerHeight) {
      atlas.src = canvas.dataset.frames;
    }
    if (!atlasReady) return;

    const target = Math.round(clamp(progress / 0.76) * lastFrame);
    if (target === paintedFrame) return;

    context.clearRect(tileLeft, 0, tileWidth, canvas.height);
    if (target > 0) {
      const tile = target - 1;
      const x = (tile % tileColumns) * tileWidth;
      const y = Math.floor(tile / tileColumns) * canvas.height;
      context.drawImage(atlas, x, y, tileWidth, canvas.height, tileLeft, 0, tileWidth, canvas.height);
    }
    paintedFrame = target;
    canvas.dataset.frame = target;
  }

  function queuePaint() {
    if (!pendingPaint) pendingPaint = window.requestAnimationFrame(paint);
  }

  function syncMotion() {
    document.documentElement.classList.toggle("flight-motion", desktop.matches);
    if (desktop.matches) {
      window.addEventListener("scroll", queuePaint, { passive: true });
      window.addEventListener("resize", queuePaint, { passive: true });
      queuePaint();
    } else {
      window.removeEventListener("scroll", queuePaint);
      window.removeEventListener("resize", queuePaint);
      window.cancelAnimationFrame(pendingPaint);
      pendingPaint = 0;
      paintedFrame = 0;
      canvas.dataset.frame = "0";
      context.clearRect(0, 0, canvas.width, canvas.height);
      hero.style.removeProperty("--hero-alpha");
    }
  }

  atlas.onload = () => {
    atlasReady = true;
    if (desktop.matches) queuePaint();
  };
  desktop.addEventListener("change", syncMotion);
  syncMotion();
})();

if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (!entry.target.matches(":focus-within")) entry.target.classList.add("project-entered");
    }
  }, { threshold: 0.1 });

  for (const project of document.querySelectorAll(".project")) reveal.observe(project);
}
