(function () {
  "use strict";

  const rawProducts = Array.isArray(window.PIN_PRODUCTS) ? window.PIN_PRODUCTS : [];
  let products = normalizeProducts(rawProducts);
  const productById = new Map(products.map((product) => [product.id, product]));
  const store = new window.PIN_ORDER_STORE.OrderStore(getStorage());
  let activeCategory = "All";
  let activeView = "inventory";
  let toastTimer;

  const elements = {
    inventoryView: document.getElementById("inventoryView"),
    orderView: document.getElementById("orderView"),
    productGroups: document.getElementById("productGroups"),
    catalogSummary: document.getElementById("catalogSummary"),
    categoryChips: document.getElementById("categoryChips"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear"),
    orderList: document.getElementById("orderList"),
    orderActions: document.getElementById("orderActions"),
    orderLineCount: document.getElementById("orderLineCount"),
    headerOrderCount: document.getElementById("headerOrderCount"),
    navOrderCount: document.getElementById("navOrderCount"),
    headerOrderButton: document.getElementById("headerOrderButton"),
    copyOrderButton: document.getElementById("copyOrderButton"),
    exportCsvButton: document.getElementById("exportCsvButton"),
    clearOrderButton: document.getElementById("clearOrderButton"),
    toast: document.getElementById("toast"),
  };

  function getStorage() {
    try {
      const testKey = "__pin_inventory_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (_error) {
      return window.PIN_ORDER_STORE.createMemoryStorage();
    }
  }

  function slugify(value) {
    return String(value || "item")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function normalizeProducts(input) {
    const usedIds = new Set();
    return input
      .map((item, index) => {
        if (!item || !String(item.name || "").trim()) return null;
        const baseId = String(item.id || item.sku || slugify(item.name)).trim();
        let id = baseId;
        let suffix = 2;
        while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
        usedIds.add(id);
        return {
          id,
          name: String(item.name).trim(),
          category: String(item.category || "Other").trim(),
          unit: String(item.unit || "").trim(),
          supplier: String(item.supplier || "").trim(),
          pack: String(item.pack || "").trim(),
          sku: String(item.sku || "").trim(),
          note: String(item.note || "").trim(),
          sourceIndex: index,
        };
      })
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function categories() {
    return [...new Set(products.map((product) => product.category))];
  }

  function renderCategoryChips() {
    const values = ["All", ...categories()];
    elements.categoryChips.innerHTML = values
      .map((category) => {
        const count = category === "All" ? products.length : products.filter((p) => p.category === category).length;
        return `<button class="chip${activeCategory === category ? " is-active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)} · ${count}</button>`;
      })
      .join("");
  }

  function filteredProducts() {
    const query = elements.searchInput.value.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const inCategory = activeCategory === "All" || product.category === activeCategory;
      const haystack = [product.name, product.category, product.unit, product.supplier, product.pack, product.sku, product.note]
        .join(" ")
        .toLocaleLowerCase();
      return inCategory && (!query || haystack.includes(query));
    });
  }

  function productMeta(product) {
    return [product.unit, product.pack, product.supplier, product.sku]
      .filter(Boolean)
      .map((value) => `<span>${escapeHtml(value)}</span>`)
      .join("");
  }

  function renderInventory() {
    renderCategoryChips();
    const filtered = filteredProducts();
    elements.searchClear.hidden = elements.searchInput.value.length === 0;

    if (products.length === 0) {
      elements.catalogSummary.textContent = "Product catalog not loaded";
      elements.productGroups.innerHTML = emptyCatalogMarkup();
      return;
    }

    const query = elements.searchInput.value.trim();
    elements.catalogSummary.textContent = query || activeCategory !== "All"
      ? `${filtered.length} of ${products.length} products`
      : `${products.length} products in ${categories().length} categories`;

    if (filtered.length === 0) {
      elements.productGroups.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          </div>
          <h3>No products found</h3>
          <p>Try another search or choose a different category.</p>
        </div>`;
      return;
    }

    const grouped = groupBy(filtered, (product) => product.category);
    elements.productGroups.innerHTML = [...grouped.entries()]
      .map(([category, items]) => `
        <section class="category-section">
          <div class="category-header">
            <h3>${escapeHtml(category)}</h3>
            <span>${items.length} ${items.length === 1 ? "product" : "products"}</span>
          </div>
          <div class="product-grid">
            ${items.map(productCardMarkup).join("")}
          </div>
        </section>`)
      .join("");
  }

  function emptyCatalogMarkup() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 6.5 12 3l8 3.5-8 3.5-8-3.5Z"/><path d="M4 6.5V17l8 4 8-4V6.5M12 10v11"/></svg>
        </div>
        <h3>Waiting for the product guide</h3>
        <p>Add <code>Ordering Guide Pin Wok&amp;Bowl.xlsx</code> to this project so the catalog can be generated without inventing product data.</p>
      </div>`;
  }

  function productCardMarkup(product) {
    const inOrder = store.get(product.id);
    return `
      <article class="product-card${inOrder ? " is-in-order" : ""}" data-product-card="${escapeHtml(product.id)}">
        <div class="product-info">
          <h4>${escapeHtml(product.name)}</h4>
          ${productMeta(product) ? `<p class="product-meta">${productMeta(product)}</p>` : ""}
          ${inOrder ? `<span class="in-order-label">In order: ${formatQuantity(inOrder)}${product.unit ? ` ${escapeHtml(product.unit)}` : ""}</span>` : ""}
        </div>
        <div class="product-controls">
          <input class="quantity-input" type="number" min="0" step="any" inputmode="decimal" placeholder="Qty" aria-label="Quantity for ${escapeHtml(product.name)}" data-quantity="${escapeHtml(product.id)}" value="${inOrder || ""}" />
          <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to order">+</button>
        </div>
      </article>`;
  }

  function getOrderProducts() {
    return store.entries()
      .map(([id, quantity]) => ({ product: productById.get(id), quantity }))
      .filter((entry) => entry.product)
      .sort((a, b) => a.product.sourceIndex - b.product.sourceIndex);
  }

  function renderOrder() {
    const entries = getOrderProducts();
    const lineCount = entries.length;
    elements.orderLineCount.textContent = String(lineCount);
    updateBadges(lineCount);
    elements.orderActions.hidden = lineCount === 0;

    if (lineCount === 0) {
      elements.orderList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M6.8 8.2h10.4l-1 11H7.8l-1-11Z"/><path d="M9.2 9V6.5a2.8 2.8 0 0 1 5.6 0V9"/></svg>
          </div>
          <h3>Your order is empty</h3>
          <p>Add products as you walk through the store. Your list is saved automatically on this device.</p>
        </div>`;
      return;
    }

    const grouped = groupBy(entries, (entry) => entry.product.category);
    elements.orderList.innerHTML = [...grouped.entries()]
      .map(([category, items]) => `
        <section class="order-group">
          <h3>${escapeHtml(category)}</h3>
          ${items.map(orderItemMarkup).join("")}
        </section>`)
      .join("");
  }

  function orderItemMarkup({ product, quantity }) {
    const details = [product.unit, product.pack, product.supplier].filter(Boolean).join(" · ");
    return `
      <div class="order-item" data-order-item="${escapeHtml(product.id)}">
        <div class="order-item-info">
          <strong>${escapeHtml(product.name)}</strong>
          ${details ? `<span>${escapeHtml(details)}</span>` : ""}
        </div>
        <div class="order-quantity-wrap">
          <button class="step-button" type="button" data-step="-1" data-id="${escapeHtml(product.id)}" aria-label="Decrease ${escapeHtml(product.name)}">−</button>
          <input class="order-quantity" type="number" min="0" step="any" inputmode="decimal" value="${quantity}" data-order-quantity="${escapeHtml(product.id)}" aria-label="Order quantity for ${escapeHtml(product.name)}" />
          <button class="step-button" type="button" data-step="1" data-id="${escapeHtml(product.id)}" aria-label="Increase ${escapeHtml(product.name)}">+</button>
        </div>
        <button class="delete-button" type="button" data-delete="${escapeHtml(product.id)}" aria-label="Remove ${escapeHtml(product.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>
        </button>
      </div>`;
  }

  function groupBy(items, keyFunction) {
    const result = new Map();
    items.forEach((item) => {
      const key = keyFunction(item);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(item);
    });
    return result;
  }

  function updateBadges(count) {
    [elements.headerOrderCount, elements.navOrderCount].forEach((badge) => {
      badge.textContent = String(count);
      badge.classList.toggle("is-empty", count === 0);
    });
  }

  function refreshAll() {
    renderInventory();
    renderOrder();
  }

  function switchView(view) {
    activeView = view === "order" ? "order" : "inventory";
    const showingOrder = activeView === "order";
    elements.inventoryView.hidden = showingOrder;
    elements.orderView.hidden = !showingOrder;
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === activeView);
      button.setAttribute("aria-current", button.dataset.view === activeView ? "page" : "false");
    });
    if (showingOrder) renderOrder();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addProduct(productId) {
    const input = document.querySelector(`[data-quantity="${cssEscape(productId)}"]`);
    const quantity = window.PIN_ORDER_STORE.normalizeQuantity(input?.value);
    if (!quantity) {
      input?.focus();
      showToast("Enter a quantity greater than zero");
      return;
    }
    store.set(productId, quantity);
    refreshAll();
    showToast("Added to order");
  }

  function changeQuantity(productId, value) {
    const quantity = window.PIN_ORDER_STORE.normalizeQuantity(value);
    if (!quantity) {
      store.remove(productId);
      showToast("Removed from order");
    } else {
      store.set(productId, quantity);
    }
    refreshAll();
  }

  function stepQuantity(productId, delta) {
    const current = store.get(productId);
    changeQuantity(productId, Math.max(0, current + delta));
  }

  function formatQuantity(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }

  function orderText() {
    const entries = getOrderProducts();
    const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date());
    const grouped = groupBy(entries, (entry) => entry.product.category);
    const lines = [`PIN INVENTORY — ORDER LIST`, date, ""];
    for (const [category, items] of grouped.entries()) {
      lines.push(category.toUpperCase());
      items.forEach(({ product, quantity }) => {
        lines.push(`• ${product.name} — ${formatQuantity(quantity)}${product.unit ? ` ${product.unit}` : ""}`);
      });
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  async function copyOrder() {
    const text = orderText();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      showToast("Order list copied");
    } catch (_error) {
      showToast("Could not copy. Try Export CSV instead.");
    }
  }

  function exportCsv() {
    const rows = [["Category", "Product", "Quantity", "Unit", "Pack", "Supplier", "SKU"]];
    getOrderProducts().forEach(({ product, quantity }) => {
      rows.push([product.category, product.name, quantity, product.unit, product.pack, product.supplier, product.sku]);
    });
    const csv = window.PIN_ORDER_STORE.buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `pin-inventory-order-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("CSV exported");
  }

  function clearOrder() {
    if (!window.confirm("Clear every item from this order?")) return;
    store.clear();
    refreshAll();
    showToast("Order cleared");
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  elements.categoryChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderInventory();
  });

  elements.productGroups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (button) addProduct(button.dataset.add);
  });

  elements.productGroups.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("[data-quantity]")) {
      event.preventDefault();
      addProduct(event.target.dataset.quantity);
    }
  });

  elements.searchInput.addEventListener("input", renderInventory);
  elements.searchClear.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.searchInput.focus();
    renderInventory();
  });

  elements.orderList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete]");
    const stepButton = event.target.closest("[data-step]");
    if (deleteButton) {
      store.remove(deleteButton.dataset.delete);
      refreshAll();
      showToast("Removed from order");
    } else if (stepButton) {
      stepQuantity(stepButton.dataset.id, Number(stepButton.dataset.step));
    }
  });

  elements.orderList.addEventListener("change", (event) => {
    if (event.target.matches("[data-order-quantity]")) {
      changeQuantity(event.target.dataset.orderQuantity, event.target.value);
    }
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  elements.headerOrderButton.addEventListener("click", () => switchView("order"));
  elements.copyOrderButton.addEventListener("click", copyOrder);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.clearOrderButton.addEventListener("click", clearOrder);

  refreshAll();

  window.PIN_APP = {
    getProducts: () => [...products],
    getOrder: () => getOrderProducts().map(({ product, quantity }) => ({ ...product, quantity })),
    switchView,
    setProductsForTesting(nextProducts) {
      products = normalizeProducts(nextProducts);
      productById.clear();
      products.forEach((product) => productById.set(product.id, product));
      activeCategory = "All";
      refreshAll();
    },
  };
})();
