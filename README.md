# PIN Inventory

A small, private, mobile-first ordering app for walking inventory checks at PIN Wok & Bowl. It is plain HTML, CSS, and JavaScript—no login, database, build step, or POS integration.

## Open the app

Open `index.html` directly in a browser. For the most reliable clipboard testing, serve the folder locally:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

Order quantities are saved only in that browser using `localStorage`.

## Product data

The catalog lives in `products.js` and was generated from the latest Google Drive copy of:

`Ordering Guide Pin Wok&Bowl.xlsx`

Supported product fields are:

```js
{
  id: "unique-id",
  name: "Product name",
  category: "Category",
  unit: "case",
  pack: "6 x 1 lb",
  supplier: "Supplier name",
  sku: "SKU-001",
  note: "Optional note"
}
```

The current import contains **149 products across 11 categories** from `Sheet1!A1:Q51`. Product spelling and punctuation follow the source; surrounding whitespace was removed. Existing order quantities in the source sheet were intentionally not imported, so every browser starts with an empty order.

The source workbook is not needed when the app runs. Refresh `products.js` only when the ordering guide changes.

## Free deployment

### GitHub Pages

1. Create a new GitHub repository and push every file in this folder.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the main branch and the `/ (root)` folder, then save.
5. GitHub will show the public Pages URL after deployment.

Important: GitHub Pages is public. Use an unguessable repository/site name if the catalog is not sensitive, or use the app only from local files for true privacy.

### Vercel

1. Import the GitHub repository at Vercel.
2. Choose **Other** as the framework preset.
3. Leave the build command empty and set the output directory to `.`.
4. Deploy.

Vercel's free URL is also public unless access controls are added. The order itself remains in the browser and is never uploaded by this app.

## Tests

Run the localStorage/order-state checks with:

```bash
node --test tests/order-store.test.js
```
