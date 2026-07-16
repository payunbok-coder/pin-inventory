const test = require("node:test");
const assert = require("node:assert/strict");
const {
  OrderStore,
  createMemoryStorage,
  normalizeQuantity,
  buildCsv,
} = require("../order-store.js");

test("normalizes valid quantities and rejects invalid values", () => {
  assert.equal(normalizeQuantity("2.5"), 2.5);
  assert.equal(normalizeQuantity(1.234), 1.23);
  assert.equal(normalizeQuantity(0), 0);
  assert.equal(normalizeQuantity(-3), 0);
  assert.equal(normalizeQuantity("not-a-number"), 0);
});

test("saves, reloads, edits, and removes an order", () => {
  const storage = createMemoryStorage();
  const store = new OrderStore(storage);
  store.set("rice", 2);
  store.set("oil", 1.5);

  const reloaded = new OrderStore(storage);
  assert.equal(reloaded.get("rice"), 2);
  assert.equal(reloaded.get("oil"), 1.5);
  assert.equal(reloaded.lineCount(), 2);

  reloaded.set("rice", 4);
  reloaded.remove("oil");
  assert.deepEqual(reloaded.entries(), [["rice", 4]]);
});

test("clear removes all saved items", () => {
  const storage = createMemoryStorage();
  const store = new OrderStore(storage);
  store.set("rice", 2);
  store.clear();

  assert.equal(store.lineCount(), 0);
  assert.equal(new OrderStore(storage).lineCount(), 0);
});

test("replaces local state with a normalized remote snapshot", () => {
  const storage = createMemoryStorage();
  const store = new OrderStore(storage);
  store.set("old-item", 2);

  store.replace({ rice: "3.5", oil: 0, "": 4, broken: "nope" });

  assert.deepEqual(store.toObject(), { rice: 3.5 });
  assert.deepEqual(new OrderStore(storage).toObject(), { rice: 3.5 });
});

test("ignores malformed persisted data", () => {
  const storage = createMemoryStorage();
  storage.setItem("pinInventoryOrderV1", "{bad json");
  const store = new OrderStore(storage);
  assert.deepEqual(store.entries(), []);
});

test("builds an Excel-friendly CSV and escapes commas and quotes", () => {
  const csv = buildCsv([
    ["Category", "Product", "Quantity"],
    ["Dry Goods", 'Rice, "Premium"', 2],
  ]);

  assert.equal(
    csv,
    '\ufeff"Category","Product","Quantity"\r\n"Dry Goods","Rice, ""Premium""","2"',
  );
});
