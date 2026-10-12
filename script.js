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

const inventoryGrid = document.querySelector("#inventory-grid");
const inventoryStatus = document.querySelector("#inventory-status");

if (inventoryGrid && inventoryStatus) {
  let inventoryItems = [];
  let activeStockFilter = "all";

  const categoryLabels = { laptop: "Laptop", desktop: "Desktop PC", cpu: "CPU unit" };
  const priceFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  function renderInventory() {
    inventoryGrid.replaceChildren();
    const visibleItems = inventoryItems.filter((item) => activeStockFilter === "all" || item.category === activeStockFilter);

    visibleItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "inventory-card";
      const cardInner = document.createElement("div");
      cardInner.className = "inventory-card-inner";

      const media = document.createElement("div");
      media.className = `inventory-card-media inventory-${item.category || "computer"}`;
      const type = document.createElement("span");
      type.className = "inventory-card-type";
      type.textContent = categoryLabels[item.category] || "Computer";
      media.append(type);

      if (item.image_url) {
        const image = document.createElement("img");
        image.src = item.image_url;
        image.alt = item.name ? `${item.name} available at LaptopFactory` : "Available computer";
        image.loading = "lazy";
        image.decoding = "async";
        image.onerror = () => image.remove();
        media.append(image);
      } else {
        const illustration = document.createElement("span");
        illustration.className = "inventory-card-illustration";
        illustration.setAttribute("aria-hidden", "true");
        illustration.textContent = item.category === "laptop" ? "▱" : item.category === "cpu" ? "▤" : "▰";
        media.append(illustration);
      }

      const front = document.createElement("div");
      front.className = "inventory-card-face inventory-card-front";
      front.setAttribute("role", "button");
      front.tabIndex = 0;
      front.setAttribute("aria-expanded", "false");
      front.setAttribute("aria-label", `Show details for ${item.name || "available computer"}`);
      const content = document.createElement("div");
      content.className = "inventory-card-content";
      const title = document.createElement("h3");
      title.textContent = item.name || "Computer";
      const model = document.createElement("p");
      model.className = "inventory-card-model";
      model.textContent = [item.brand, item.model].filter(Boolean).join(" · ") || categoryLabels[item.category] || "Computer";
      const specs = document.createElement("p");
      specs.className = "inventory-card-specs";
      specs.textContent = item.specifications || "Ask us for full specifications.";

      const meta = document.createElement("div");
      meta.className = "inventory-card-meta";
      const condition = document.createElement("span");
      condition.textContent = item.condition || "Refurbished";
      const quantity = document.createElement("span");
      quantity.textContent = `${item.stock_quantity} available`;
      meta.append(condition, quantity);

      const bottom = document.createElement("div");
      bottom.className = "inventory-card-bottom";
      const price = document.createElement("strong");
      price.className = "inventory-card-price";
      price.textContent = Number(item.price_inr) > 0 ? `₹${priceFormatter.format(Number(item.price_inr))}` : "Ask for price";
      const ask = document.createElement("a");
      ask.className = "inventory-card-ask";
      const question = `Hi LaptopFactory, is ${item.name || "this computer"} still available? Please share the details.`;
      ask.href = `https://wa.me/919922221640?text=${encodeURIComponent(question)}`;
      ask.target = "_blank";
      ask.rel = "noreferrer";
      ask.textContent = "Ask about this item ↗";
      const flipHint = document.createElement("span");
      flipHint.className = "inventory-flip-hint";
      flipHint.textContent = "Tap for details ↗";
      bottom.append(price, flipHint);

      content.append(title, model, specs, meta, bottom);
      front.append(media, content);

      const back = document.createElement("div");
      back.className = "inventory-card-face inventory-card-back";
      back.setAttribute("aria-hidden", "true");
      back.inert = true;
      const backHead = document.createElement("div");
      backHead.className = "inventory-back-head";
      const backLabel = document.createElement("span");
      backLabel.textContent = `${categoryLabels[item.category] || "Computer"} · ${item.condition || "Refurbished"}`;
      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.className = "inventory-back-button";
      backButton.textContent = "← Photo";
      backButton.setAttribute("aria-label", `Return to photo of ${item.name || "computer"}`);
      backHead.append(backLabel, backButton);
      const backTitle = document.createElement("h3");
      backTitle.textContent = item.name || "Computer";
      const backModel = document.createElement("p");
      backModel.className = "inventory-back-model";
      backModel.textContent = [item.brand, item.model].filter(Boolean).join(" · ") || categoryLabels[item.category] || "Computer";
      const backSpecs = document.createElement("p");
      backSpecs.className = "inventory-back-specs";
      backSpecs.textContent = item.specifications || "Ask the shop for full specifications.";
      const detailMeta = document.createElement("div");
      detailMeta.className = "inventory-back-stock";
      const availableLabel = document.createElement("span");
      availableLabel.textContent = "AVAILABLE NOW";
      const availableQuantity = document.createElement("strong");
      availableQuantity.textContent = String(item.stock_quantity);
      detailMeta.append(availableLabel, availableQuantity);
      back.append(backHead, backTitle, backModel, backSpecs, detailMeta, ask);

      function setFlipped(open) {
        card.classList.toggle("is-flipped", open);
        front.setAttribute("aria-expanded", String(open));
        front.setAttribute("aria-hidden", String(open));
        back.setAttribute("aria-hidden", String(!open));
        front.tabIndex = open ? -1 : 0;
        back.inert = !open;
        if (open) backButton.focus({ preventScroll: true });
        else front.focus({ preventScroll: true });
      }
      front.addEventListener("click", () => setFlipped(true));
      front.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setFlipped(true);
        }
      });
      backButton.addEventListener("click", () => setFlipped(false));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && card.classList.contains("is-flipped")) setFlipped(false);
      });

      cardInner.append(front, back);
      card.append(cardInner);
      inventoryGrid.append(card);
    });

    if (inventoryItems.length && !visibleItems.length) {
      inventoryStatus.textContent = "No items in this category are listed right now.";
    } else if (inventoryItems.length) {
      inventoryStatus.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "listing" : "listings"} available`;
    }
  }

  document.querySelectorAll("[data-stock-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeStockFilter = button.dataset.stockFilter || "all";
      document.querySelectorAll("[data-stock-filter]").forEach((filter) => {
        const selected = filter === button;
        filter.classList.toggle("is-active", selected);
        filter.setAttribute("aria-pressed", String(selected));
      });
      renderInventory();
    });
  });

  fetch("/api/inventory", { headers: { Accept: "application/json" }, cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "inventory_unavailable");
      return payload;
    })
    .then((payload) => {
      inventoryItems = Array.isArray(payload.items) ? payload.items : [];
      if (!inventoryItems.length) {
        inventoryStatus.textContent = "No computers are listed online right now. Call or message us and we’ll check today’s stock.";
        return;
      }
      renderInventory();
    })
    .catch(() => {
      inventoryStatus.textContent = "Live stock is being set up. Call or message us to check today’s availability.";
    });
}
