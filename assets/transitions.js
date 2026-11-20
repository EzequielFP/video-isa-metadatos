import { gsap, ScrollTrigger } from "./vendor/gsap-web.js";

export function setupTransitions() {
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  media.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
    const card = document.querySelector(".next-card");
    function light(event) {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--light-x", (event.clientX - bounds.left) + "px");
      card.style.setProperty("--light-y", (event.clientY - bounds.top) + "px");
    }
    card.addEventListener("pointermove", light);
    return () => {
      card.removeEventListener("pointermove", light);
      card.style.removeProperty("--light-x");
      card.style.removeProperty("--light-y");
    };
  });
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const hero = document.querySelector("[data-hero]");
    const progress = document.createElement("div");
    progress.className = "page-progress";
    progress.setAttribute("aria-hidden", "true");
    document.querySelector(".header").append(progress);
    let pendingRefresh = 0;

    gsap.to(progress, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
    });
    const dimensions = new ResizeObserver(() => {
      if (pendingRefresh) return;
      pendingRefresh = requestAnimationFrame(() => {
        pendingRefresh = 0;
        ScrollTrigger.refresh();
      });
    });
    dimensions.observe(document.body);

    if (!location.hash && scrollY < 70) {
      gsap.fromTo(hero.querySelectorAll(".hero-copy > *"), { opacity: 0.68, y: 19 }, {
        opacity: 1, y: 0, duration: 0.68, ease: "power2.out", stagger: 0.08, clearProps: "opacity,transform",
      });
    }
    gsap.fromTo(hero.querySelector(".hero-picture"), { scale: 1 }, {
      scale: 1.065,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.36 },
    });

    for (const scene of document.querySelectorAll("main > .scene")) {
      const heading = scene.querySelector(".scene-heading, .pacific-heading") ?? scene.querySelector(".scene-copy h2");
      if (!heading) continue;
      gsap.fromTo(heading, { opacity: 0.68, y: 16 }, {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        duration: 0.56,
        clearProps: "opacity,transform",
        immediateRender: false,
        scrollTrigger: { trigger: scene, start: "top 78%", once: true },
      });
    }

    return () => {
      dimensions.disconnect();
      cancelAnimationFrame(pendingRefresh);
      progress.remove();
    };
  });
}
