const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector("#main-nav");

if (menuButton && mainNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    mainNav.classList.toggle("is-open", !isOpen);
  });

  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation");
      mainNav.classList.remove("is-open");
    }
  });
}

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

const headingMotions = ["from-top", "from-left", "from-right", "from-bottom", "assemble"];
const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

headings.forEach((heading, index) => {
  heading.classList.add("motion-heading");
  heading.style.setProperty("--heading-delay", `${(index % 3) * 90}ms`);

  // The main page titles already animate their individual lines.
  if (!heading.hasAttribute("data-motion") && !heading.querySelector("[data-motion]")) {
    heading.dataset.motion = headingMotions[index % headingMotions.length];
  }
});

const motionItems = document.querySelectorAll("[data-motion]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (motionItems.length && "IntersectionObserver" in window && !prefersReducedMotion) {
  document.documentElement.classList.add("motion-ready");
  const motionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -35px 0px" });

  motionItems.forEach((item) => motionObserver.observe(item));
}
