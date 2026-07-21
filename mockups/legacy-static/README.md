# Baksters Counting Mockups

Static prototypes based on the stock-counting flow.

## Files

- `original-ui.html` - preferred version. Original mobile UI structure/style/workflow, rebranded to Baksters with Baksters-only product imagery and animated barcode scanner.
- `real-ui.html` - earlier redesigned real-app-style UI, Baksters-only product packshots, animated barcode scanner, animated AI count overlay, and full flow/result states.
- `index.html` - earlier simple clickable mockup.
- `reference-recreate.html` - earlier reference experiment; kept for comparison, but it uses local legacy reference photos and is not the preferred version.
- `assets/baksters-heart.png` - Baksters logo supplied as the project reference.
- `assets/real-ui/baksters-product-set.png` - generated Baksters-only product packshot set.
- `assets/real-ui/product-glow-box.png`, `product-cleansing-tube.png`, `product-black-mask.png`, `product-serum-set.png` - per-SKU product images used by the real UI.
- `assets/real-ui/baksters-real-ui-walkthrough.mp4` - generated walkthrough video with scan-line and count-overlay motion.
- `assets/real-ui/screens/` - screenshots used to build the real-UI video.
- `assets/original-ui/baksters-original-ui-walkthrough.mp4` - generated walkthrough video for the original-UI rebrand.
- `assets/original-ui/contact-sheet.png` - 12-screen contact sheet for the original-UI flow.
- `assets/original-ui/screens/` - browser screenshots used to build the original-UI video.
- `assets/baksters-counting-walkthrough.mp4` - generated walkthrough video.
- `assets/baksters-reference-recreate-walkthrough.mp4` - generated walkthrough video for the reference-driven recreate.
- `assets/screens/` - browser screenshots used to build the video.
- `assets/reference-screens/` - browser screenshots used to build the reference recreate video.
- `assets/reference-box.jpg`, `assets/reference-tube.jpg`, `assets/reference-counting-row.jpg` - local reference images copied from the existing project to preserve product shape/workflow context.

## How to Open

Open `original-ui.html` in a browser. No install step or dev server is required.

Use `assets/original-ui/baksters-original-ui-walkthrough.mp4` for the video handoff. The scanner screen also moves in the live HTML through CSS animation.

## Flow Covered

1. LINE entry and Baksters identity.
2. Registration / account linking.
3. Approval state.
4. Counting home with location tabs, product list, locks, and out-of-stock option.
5. SKU barcode scan.
6. SKU match confirmation.
7. Counting camera and model detections.
8. Quantity verification.
9. Save result.
10. Draft review and send confirmation.
11. Sent round result and admin export summary.
12. Exception states for cutoff, product lock, and out-of-stock.

## Fidelity Note

The preferred `original-ui.html` intentionally keeps the original app UI language: white mobile headers, Thai labels, orange primary actions, product rows, bottom nav, camera scanner, quantity verification, draft/sent flows, and manual barcode exception sheet. Only the logo, brand copy, and product imagery were changed to Baksters. If you later provide actual Baksters SKU packshots or shelf photos, replace the product files and regenerate screenshots/video.
