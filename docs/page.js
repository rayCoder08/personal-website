(() => {
  if (!("IntersectionObserver" in window)) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const projects = document.querySelectorAll(".project");
  const seen = new WeakSet();

  const reveal = new IntersectionObserver((entries, observer) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      seen.add(target);
      observer.unobserve(target);
      if (!reducedMotion.matches && !target.matches(":focus-within")) {
        target.animate([{ opacity: 0.58 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
      }
    }
  }, { threshold: 0.12 });

  // Restored or deep-linked content is visible immediately, including on reload.
  function observeUpcomingProjects() {
    reveal.disconnect();
    for (const project of projects) {
      if (project.getBoundingClientRect().top < window.innerHeight) seen.add(project);
      if (!seen.has(project)) reveal.observe(project);
    }
  }

  window.addEventListener("pageshow", () => {
    requestAnimationFrame(() => requestAnimationFrame(observeUpcomingProjects));
  });
})();
