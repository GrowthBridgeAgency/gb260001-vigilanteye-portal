/**
 * scroll-animations.js
 * Fallback for browsers without native CSS scroll-driven animations support.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-fallback-visible');
          }
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right').forEach((el) => {
      el.classList.add('scroll-fallback-hidden');
      observer.observe(el);
    });
  }
});
