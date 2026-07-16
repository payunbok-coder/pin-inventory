(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PIN_ORDER_STORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "pinInventoryOrderV1";

  function normalizeQuantity(value) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) return 0;
    return Math.round(quantity * 100) / 100;
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      },
    };
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function buildCsv(rows) {
    return `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  }

  class OrderStore {
    constructor(storage, key) {
      this.storage = storage || createMemoryStorage();
      this.key = key || STORAGE_KEY;
      this.items = this.load();
    }

    load() {
      try {
        const saved = JSON.parse(this.storage.getItem(this.key) || "null");
        const source = saved && saved.version === 1 && saved.items ? saved.items : {};
        return Object.fromEntries(
          Object.entries(source)
            .map(([id, quantity]) => [id, normalizeQuantity(quantity)])
            .filter(([, quantity]) => quantity > 0),
        );
      } catch (_error) {
        return {};
      }
    }

    save() {
      const payload = { version: 1, updatedAt: new Date().toISOString(), items: this.items };
      try {
        this.storage.setItem(this.key, JSON.stringify(payload));
        return true;
      } catch (_error) {
        return false;
      }
    }

    set(productId, quantity) {
      const id = String(productId || "").trim();
      const normalized = normalizeQuantity(quantity);
      if (!id) return false;
      if (normalized === 0) delete this.items[id];
      else this.items[id] = normalized;
      this.save();
      return normalized > 0;
    }

    remove(productId) {
      const id = String(productId || "");
      const existed = Object.prototype.hasOwnProperty.call(this.items, id);
      delete this.items[id];
      this.save();
      return existed;
    }

    clear() {
      this.items = {};
      try {
        this.storage.removeItem(this.key);
      } catch (_error) {
        this.save();
      }
    }

    replace(nextItems) {
      const source = nextItems && typeof nextItems === "object" ? nextItems : {};
      this.items = Object.fromEntries(
        Object.entries(source)
          .map(([id, quantity]) => [String(id || "").trim(), normalizeQuantity(quantity)])
          .filter(([id, quantity]) => id && quantity > 0),
      );
      this.save();
      return this.entries();
    }

    toObject() {
      return { ...this.items };
    }

    get(productId) {
      return this.items[String(productId)] || 0;
    }

    entries() {
      return Object.entries(this.items);
    }

    lineCount() {
      return this.entries().length;
    }
  }

  return { STORAGE_KEY, OrderStore, normalizeQuantity, createMemoryStorage, csvCell, buildCsv };
});
