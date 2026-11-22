(() => {
  const image = document.querySelector("#flight-frame");
  const hero = image?.closest(".hero");
  if (!hero) return;

  const desktopMotion = window.matchMedia("(min-width: 900px) and (prefers-reduced-motion: no-preference)");
  const poster = image.src;
  const lastFrame = 10;
  const frames = new Map([[0, image]]);
  let active = false;
  let currentFrame = 0;
  let animationFrame = 0;
  let startedLoading = false;

  function paint() {
    animationFrame = 0;
    if (!active) return;

    const { top, height } = hero.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -top / (height * 0.65)));
    const target = Math.round(progress * lastFrame);
    const frame = frames.get(target);

    if (target !== currentFrame && frame?.complete && frame.naturalWidth) {
      image.src = target === 0 ? poster : frame.src;
      currentFrame = target;
    }
  }

  function queuePaint() {
    if (active && !animationFrame) animationFrame = window.requestAnimationFrame(paint);
  }

  function loadFrames() {
    if (!active || startedLoading) return;
    startedLoading = true;
    for (let i = 1; i <= lastFrame; i++) {
      const frame = new Image();
      frame.decoding = "async";
      frame.onload = queuePaint;
      frame.src = new URL(String(i).padStart(2, "0") + ".webp", poster).href;
      frames.set(i, frame);
    }
  }

  function syncMotion() {
    active = desktopMotion.matches;
    if (active) {
      window.addEventListener("scroll", queuePaint, { passive: true });
      window.addEventListener("resize", queuePaint, { passive: true });
      if ("requestIdleCallback" in window) window.requestIdleCallback(loadFrames, { timeout: 1200 });
      else window.setTimeout(loadFrames, 200);
      queuePaint();
    } else {
      window.removeEventListener("scroll", queuePaint);
      window.removeEventListener("resize", queuePaint);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (currentFrame !== 0) image.src = poster;
      currentFrame = 0;
    }
  }

  desktopMotion.addEventListener("change", syncMotion);
  syncMotion();
})();
