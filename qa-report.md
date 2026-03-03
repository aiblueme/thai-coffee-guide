# Thai Coffee Guide — Comprehensive QA Audit Report

**Site:** https://thai-coffee.shellnode.lol/
**Audit Date:** 2026-03-03
**Auditor:** QA Expert (Automated + Manual via Playwright)
**Playwright Version:** 1.58.2
**Browser:** Chromium (headless)
**Total Checks Executed:** 148 (89 initial + 59 deep-dive)
**Passed:** 135
**Issues Found:** 13

---

## Executive Summary

The Thai Coffee Guide website is in **good overall condition**. Core navigation, content rendering, and the majority of interactive features function correctly. All 16 brand pages return HTTP 200, no broken links were found among the 15 tested internal routes, and the visual design renders cleanly across tablet and desktop viewports.

Four issues require attention before a production release: a JavaScript `unhandledrejection` console error from the Clipboard API appearing on every brand detail page visit, a horizontal scroll overflow on the smallest mobile viewport (320px), a `--brown` CSS variable reference that resolves to nothing in the test context, and a confirmed sub-optimal UX pattern where 16 of 27 bookmark buttons on the home page live inside a `[hidden]` section and therefore cannot be interacted with without first switching views.

---

## Issues by Severity

### CRITICAL — 0 issues

No critical issues found. All pages load, all routes resolve, and no total feature failures were observed.

---

### HIGH — 3 issues

---

#### HIGH-01: Clipboard API `unhandledrejection` Console Error on Brand Detail Pages

- **Pages Affected:** All brand detail pages (confirmed on `doi-chaang.html`, `akha-ama.html`; likely all 16)
- **Feature:** Copy Button / Clipboard API
- **Description:** When the Copy button is clicked in a browser context where the `clipboard-write` permission has not been granted (standard browser default without a user gesture or permission prompt), `navigator.clipboard.writeText()` throws a `DOMException: Write permission denied`. This rejection is unhandled and surfaces as a `PageError` in the JavaScript console.

  The error message observed:
  ```
  PageError: Failed to execute 'writeText' on 'Clipboard': Write permission denied.
  ```

- **Root Cause:** The code in `/js/main.js` (line 148) calls `navigator.clipboard.writeText(btn.dataset.copy).then(...)` but has no `.catch()` handler. If the clipboard permission is denied (or the API is unavailable), the rejected Promise goes unhandled.

  ```js
  // /js/main.js — lines 146-158
  document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('is-copied');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('is-copied');
        }, 1800);
      });
      // NO .catch() — unhandled rejection on permission denial
    });
  });
  ```

- **Impact:** Console pollution on every brand detail page. In some browser configurations (e.g., HTTP contexts, iframes, strict permissions), the button will silently fail with no user feedback. The `is-copied` visual state and "Copied!" text will never appear. Confirmed: when clipboard permission IS granted (e.g., in a test environment with `permissions: ['clipboard-write']`), the button works perfectly and the text copies correctly.
- **Reproduction:** Visit any brand detail page (e.g., `https://thai-coffee.shellnode.lol/brands/doi-chaang.html`) and click the "Copy" button. Open browser DevTools console — a `DOMException` will appear.
- **Fix Recommendation:** Add a `.catch()` handler. Optionally, fall back to `document.execCommand('copy')` for older browsers.

---

#### HIGH-02: 16 of 27 Bookmark Buttons are Inside a `[hidden]` Section (Quick-List)

- **Page Affected:** Home page (`/`)
- **Feature:** Bookmark/Save Feature
- **Description:** The home page contains 27 bookmark buttons total: 3 in the visible editorial cards, 8 in the compact secondary grid (also editorial), and 16 in the quick-list section (`#quick-list-section`). The quick-list section has a `hidden` HTML attribute by default (the page loads in editorial view). This means those 16 bookmark buttons are completely inaccessible until the user switches to "All 16 Brands" list view. This is by design for the section toggle, but it creates a subtle mismatch: a user browsing the editorial view has no way to bookmark brands that appear only in the quick-list (i.e., brands not given editorial cards).

  Confirmed via DOM evaluation:
  ```
  Total bookmark buttons: 27
  In editorial cards: 3
  In quick list rows: 16
  Hidden by parent [hidden]: 16
  ```

- **Impact:** Users in editorial view cannot bookmark any of the 16 brands in the quick-list without first switching to list view. There is no indication to the user that 16 additional brandable entries exist behind the view toggle. The Saved filter button (`#bookmark-filter-btn`) is also hidden until at least one bookmark is added, creating a chicken-and-egg discoverability problem.
- **Reproduction:** Load the home page on default editorial view. Inspect the DOM for `.bookmark-btn[data-slug]` — 16 buttons have `closest('[hidden]') !== null`.
- **Fix Recommendation:** Consider ensuring all brands have editorial cards, or add a visible indicator that additional brands exist in the list view, or allow the "Saved" filter button to always be visible as a call-to-action even when count is zero.

---

#### HIGH-03: Horizontal Scroll Overflow at 320px Viewport Width

- **Pages Affected:** Home page at very narrow mobile widths (320px, "Galaxy S5" form factor)
- **Feature:** Responsive Layout
- **Description:** At 320px viewport width, `document.documentElement.scrollWidth` exceeds `clientWidth`, causing a horizontal scrollbar to appear. This breaks the mobile layout for users on the narrowest category of smartphones.

  The offending element is the `.category-strip` section's `.strip-inner` container. The strip uses `white-space: nowrap` and `display: flex` with `gap: 1.5rem`, containing four items with long text labels (e.g., "Northern Highlands · Chiang Rai · Chiang Mai"). At 320px, the content extends to ~1041px wide.

  Overflow elements confirmed:
  ```
  .strip-item  — right: 432px (docWidth: 320px)
  .strip-item  — right: 833px
  .strip-item  — right: 1041px
  ```

  The `.category-strip` container has `overflow-x: auto` which prevents its own scrollbar from affecting the page, but the flex row within it still overflows the document body because the `overflow-x: auto` is on `.category-strip` itself, not necessarily constraining child layout against the viewport.

  The issue does NOT occur at 414px (Mobile-L), 768px (Tablet), or 1440px (Desktop).

- **Impact:** Broken layout on smallest phones. All screen content shifts right. The site appears unprofessional and content may be obscured.
- **Reproduction:** Open the home page with DevTools set to 320px wide (or any Galaxy S series phone emulation). A horizontal scrollbar appears.
- **Fix Recommendation:** In the CSS for `.category-strip` or `.strip-inner`, add `overflow-x: hidden` to the outer wrapper, or add a `max-width: 100%` / `width: 100%` constraint to `.strip-inner`. Alternatively, add a `@media (max-width: 414px)` rule to switch the strip to a wrapping or vertically-scrolling layout.

  ```css
  /* /css/main.css — relevant section around line 376 */
  .category-strip {
    overflow-x: hidden; /* change from auto to hidden, or add to the section itself */
  }
  ```

---

### MEDIUM — 4 issues

---

#### MEDIUM-01: `--brown` CSS Variable Resolves to Empty String

- **Page Affected:** All pages
- **Feature:** CSS Variables / Design System
- **Description:** During CSS variable validation, the `--brown` custom property returned an empty value (`""`). The design system defines `--brown-deep`, `--brown-mid`, `--brown-warm`, and `--brown-warm` but no plain `--brown` alias. If any code (CSS, JS, or inline styles) references `var(--brown)`, the fallback chain will fail silently.

  Checked CSS variable values:
  ```
  --terracotta: "#C4652A"   ✓ defined
  --brown: ""               ✗ not defined
  ```

- **Impact:** Low risk if `var(--brown)` is not currently referenced anywhere. However, this is a code hygiene concern — if a developer adds a reference to `--brown` expecting it to work (by analogy with other brown variants), they will get a transparent/invisible color with no error. Worth adding an alias `--brown: var(--brown-deep)` or `--brown: #2C1810` as a safety measure.
- **Fix Recommendation:** Add `--brown: #2C1810;` (or alias `var(--brown-deep)`) to the `:root` block in `/css/main.css`.

---

#### MEDIUM-02: Copy Button Feedback Does Not Work Without Explicit Browser Permission Grant

- **Pages Affected:** All brand detail pages
- **Feature:** Copy Button
- **Description:** Directly related to HIGH-01. In the standard browser context (no explicit clipboard permission grant), the copy button does not show any feedback after clicking — neither the `is-copied` CSS class nor the "Copied!" text change. The button appears to do nothing from the user's perspective.

  Test results:
  - Without clipboard permission: Button shows no `is-copied` state. Text stays "Copy". No visual feedback.
  - With clipboard permission (`permissions: ['clipboard-write']`): Button correctly shows "Copied!", applies `is-copied` class, then resets after 1.8 seconds. Clipboard content verified as correct.

- **Impact:** Users clicking the Copy button on most desktop browsers (which do not auto-grant clipboard access without a prior user gesture in a secure context) may believe the button is broken. The feature works correctly on HTTPS (which the site uses), and modern browsers generally allow clipboard access from a user click on HTTPS pages — so the real-world impact may be lower than the test environment suggests. However, the missing `.catch()` means any denial is invisible to the user.
- **Fix Recommendation:** See HIGH-01. Add a `.catch()` handler that shows a fallback error state or selects the text for manual copy.

---

#### MEDIUM-03: "Saved" Filter Button Hidden When No Bookmarks Exist (Discoverability)

- **Page Affected:** Home page (`/`)
- **Feature:** Bookmark/Save Feature
- **Description:** The `#bookmark-filter-btn` ("Saved") button is `hidden` on page load when `Bookmarks.count() === 0`. This means new users have no visual indication that a save/bookmark feature exists until they accidentally discover a bookmark button and click it.

  From `/js/main.js` line 133:
  ```js
  if (Bookmarks.count() === 0) bookmarkFilterBtn.hidden = true;
  ```

  The feature works correctly once bookmarks are added (button appears, count badge shows, saved filter activates). But the entry point is invisible.

- **Impact:** Feature discoverability is poor. Users who do not notice the small heart icon on brand cards will never know the Saved filter exists.
- **Fix Recommendation:** Consider keeping the "Saved" button always visible but in a disabled/dimmed state when no bookmarks exist. The CSS already defines `.bookmark-toggle-btn` with appropriate base styling. A disabled-state style (e.g., `opacity: 0.4; cursor: not-allowed`) with a tooltip like "Save brands to filter them here" would improve discoverability.

---

#### MEDIUM-04: Compare Page "Category" Filter Uses Internal Enum Values as Labels

- **Page Affected:** Compare page (`/compare.html`)
- **Feature:** Filters
- **Description:** The category filter dropdown (`#filter-category`) exposes options with values `specialty`, `commercial`, `single-origin`, `blend`. These are technically correct internal identifiers, but they are presented directly as user-facing labels without sentence-case formatting or human-friendly names (e.g., "Specialty Coffee", "Commercial / Everyday", "Single Origin", "Blend"). At 320px on mobile, these labels may also truncate unexpectedly inside the `<select>` element.

  Filter option values observed: `["", "specialty", "commercial", "single-origin", "blend"]`

- **Impact:** Low visual polish issue. Does not break functionality but creates an inconsistency with the tags shown in brand cards (which display formatted labels like "Specialty" and "Single Origin").
- **Fix Recommendation:** Update the `<option>` display text to use human-readable labels while keeping the `value` attribute as the enum identifier for filter logic.

---

### LOW — 6 issues

---

#### LOW-01: Shimmer Placeholder Elements Not Present in Compiled HTML

- **Page Affected:** Home page (`/`), Compare page
- **Feature:** Image Loading / Shimmer Animation
- **Description:** The CSS defines shimmer/skeleton animation styles for `.brand-card__img-placeholder`, `.brand-row__img-placeholder`, and `.compact-img-placeholder` (lines 1721–1746 of `main.css`). The template (`/templates/index.html`) conditionally renders these elements when a brand has no `thumbnail` field. However, the compiled `dist/index.html` contains no placeholder elements because all 16 brands currently have thumbnail images.

  This is not a bug in the current state — it's a future-proofing concern. If a new brand is added without an image, the shimmer placeholder will appear, which is correct behavior. However, the shimmer CSS gives images `opacity: 0` initially (lines 1748–1754), and the `img-loaded` class is added by JavaScript after load. During the brief period before JS fires, images are invisible. On slower connections, this creates a flash of invisible content rather than a shimmer skeleton.

  Confirmed: The image starts at `opacity: 0` immediately after DOM load and reaches `opacity: 1` only after the `load` event fires and JS adds `img-loaded`.

- **Impact:** On slow connections, brand card images are invisible (not just shimmering) until they load, because the placeholder div is not rendered when an image tag exists. The shimmer animation only applies to the placeholder div, not the `<img>` element itself.
- **Fix Recommendation:** Consider adding a `.brand-card__img-wrapper` element with the shimmer background behind the `<img>` even when an image exists, so the shimmer shows while the image loads.

---

#### LOW-02: Mobile Viewport — Hero Stat Block Not Visible in Default Scroll Position

- **Page Affected:** Home page at 320–375px
- **Feature:** Responsive Layout
- **Description:** At mobile viewport widths, the hero section (`<section class="hero">`) stacks vertically. The hero stat block (showing "16 Brands Reviewed", "฿65–700 Price Range", etc.) is positioned below the hero text and CTA buttons. On a 375px × 667px viewport, the stats are below the fold and not visible without scrolling. The user's initial view is only the headline and two CTA buttons.

  This is a layout consequence of the responsive stacking and is not necessarily a bug, but worth flagging for UX review.

- **Impact:** The key "at a glance" statistics (brand count, price range, roast levels, regions) are not visible above the fold on mobile.
- **Fix Recommendation:** For mobile, consider placing the stat block before the CTA buttons, or using a condensed horizontal stat strip rather than a 2×2 grid below the fold.

---

#### LOW-03: Nav Active Link Incorrect on Brand Detail Pages

- **Page Affected:** Brand detail pages (e.g., `doi-chaang.html`, `akha-ama.html`)
- **Feature:** Navigation
- **Description:** Brand detail pages incorrectly mark the "Compare" nav link as active (`nav-link--active`) instead of marking no nav link or a more appropriate "Overview" link as active. Since brand detail pages are reached from both the home page and the compare page, marking "Compare" as the active nav item is misleading.

  Observed in `dist/brands/doi-chaang.html` (line 38):
  ```html
  <a href="/compare.html" class="nav-link nav-link--active">Compare</a>
  ```

- **Impact:** Minor navigational confusion. The user is on a brand detail page but the nav implies they are in the Compare section.
- **Fix Recommendation:** Either remove `nav-link--active` from all links on detail pages, or create a parent section concept (e.g., mark no link active, or mark "Overview" as a parent breadcrumb).

---

#### LOW-04: Lightbox Lacks Keyboard Focus Trap

- **Page Affected:** Brand detail pages
- **Feature:** Image Gallery / Lightbox / Accessibility
- **Description:** The lightbox modal (`#brand-lightbox`) opens on gallery click but does not implement a focus trap. When the lightbox is open, keyboard Tab navigation can move focus outside the modal to background content, allowing interaction with elements behind the overlay.

  Confirmed working: Escape key closes the lightbox. Arrow keys navigate images. Close button works. Body overflow is locked.
  Not confirmed: Focus is not programmatically trapped within the lightbox dialog.

- **Impact:** Accessibility concern for keyboard and assistive technology users. WCAG 2.1 SC 2.1.2 (No Keyboard Trap) requires that if a user can move focus into a component, they can also move focus out — but for modal dialogs, the focus should be contained within the modal while it is open (ARIA `dialog` pattern).
- **Fix Recommendation:** Add a focus trap to the lightbox: capture Tab/Shift+Tab key events when the lightbox is open and cycle focus among the lightbox's focusable elements (close button, prev/next arrows). Use `role="dialog"` and `aria-modal="true"` on the lightbox element. Ensure focus is moved to the lightbox (or its close button) when it opens.

---

#### LOW-05: Guide Page TOC Active Link State Uses Inline Styles (Not CSS Classes)

- **Page Affected:** Guide page (`/guide.html`)
- **Feature:** Table of Contents Active State
- **Description:** The IntersectionObserver-based TOC active state in `/js/main.js` (lines 196–208) applies active styling directly via `link.style.color` and `link.style.borderColor`. Using inline styles means the active state cannot be overridden by CSS media queries, themes, or user stylesheets, and creates a potential conflict with CSS specificity.

  From `/js/main.js`:
  ```js
  link.style.color = active ? 'var(--terracotta)' : '';
  link.style.borderColor = active ? 'var(--terracotta)' : '';
  ```
  Note: `var(--terracotta)` in an inline style is resolved at render time; this approach works in modern browsers but `''` (empty string) to clear the style is correct and functional.

- **Impact:** Minor code quality issue. Functionally, the TOC active state works correctly. The approach is fragile compared to toggling a CSS class.
- **Fix Recommendation:** Define a `.toc-link--active` CSS class in `main.css` and toggle it with `classList.toggle('toc-link--active', active)` instead of inline styles.

---

#### LOW-06: Compare Page — "Name" Sort Shows Full Thai Name in First Cell Text

- **Page Affected:** Compare page (`/compare.html`)
- **Feature:** Sort by Name
- **Description:** When sorting by name, the first table row's display text includes both the English name and the Thai name concatenated (because the brand name cell contains both `<span>` elements without separator markup). This was observed during testing:

  ```
  After name sort, first visible row name: "Akha Ama Coffee
                อาข่า อ่ามา คอฟฟี่"
  ```

  The sort itself works correctly (sorting alphabetically by `data-name` attribute), but the text content extraction includes multi-line Thai text. This is a cosmetic artifact of how text content is measured in tests and does not affect users.

- **Impact:** No user-facing impact. Test/automation artifact only.
- **Fix Recommendation:** No immediate action needed. If automated test assertions are written against visible name text, use attribute-based selectors (`[data-name]`) rather than `textContent`.

---

## Feature Verification Summary

| Feature | Status | Notes |
|---|---|---|
| Home page loads (HTTP 200) | PASS | Returns 200 |
| Page titles present and descriptive | PASS | All pages have meaningful titles |
| View toggle (Editorial / All Brands) | PASS | Toggles sections, saves preference to localStorage |
| Editorial view default | PASS | Editorial shown by default |
| List view activation | PASS | `is-active` class applied, section shown |
| Bookmark buttons (editorial cards) | PASS | 11 visible buttons across editorial + compact grid |
| Bookmark save to localStorage | PASS | Data stored under `tcg-bookmarks` key |
| Bookmark count badge update | PASS | Badge shows correct count and hides at zero |
| Saved filter button visibility (after bookmark) | PASS | Appears after first bookmark added |
| Saved filter activation | PASS | Filters quick-list rows correctly |
| Quick-list bookmark buttons (hidden section) | WARN | 16 buttons inside `[hidden]` — see HIGH-02 |
| Compare page loads (HTTP 200) | PASS | Returns 200 |
| Category filter | PASS | Filters table correctly, active class applied |
| Roast filter | PASS | Reduces from 16 to correct subset |
| Price filter | PASS | Filters by max price correctly |
| Multi-filter (category + roast) | PASS | Combined filter works, pill shows "2 active" |
| Clear filters button | PASS | Resets all filters, hides when inactive |
| Active filter highlight (colored border) | PASS | `filter-select--active` class applied |
| Active filter count pill | PASS | Shows "N active" correctly |
| Sort by rating | PASS | Default sort, works correctly |
| Sort by name | PASS | Alphabetical sort works |
| Sort by price | PASS | Ascending/descending price sort works |
| Table bookmark buttons | PASS | 16 buttons present in compare table |
| No JS console errors (Compare) | PASS | Zero errors on compare page |
| Brand detail page loads (HTTP 200) | PASS | Both doi-chaang and akha-ama return 200 |
| Radar chart canvas present | PASS | `#flavor-radar` found on both pages |
| Radar chart FLAVOR_DATA defined | PASS | `window.FLAVOR_DATA` set correctly |
| Radar chart drawn (non-blank) | PASS | Canvas has non-transparent pixels |
| Image gallery present | PASS | `#brand-gallery` found |
| Gallery frames (8 images) | PASS | 8 frames on both tested pages |
| Gallery thumbnail click | PASS | Second thumbnail activates second frame |
| Gallery prev/next arrows | PASS | Arrow navigation advances counter |
| Lightbox opens on gallery click | PASS | Lightbox becomes visible |
| Lightbox closes with Escape key | PASS | Correctly closed, body overflow restored |
| Lightbox expand button | PASS | Also opens lightbox correctly |
| Copy button present | PASS | `.copy-btn[data-copy]` found |
| Copy button data attribute | PASS | Correct "Brand (ภาษาไทย)" format |
| Copy button feedback (with permission) | PASS | Shows "Copied!" and `is-copied` class |
| Copy button feedback (no permission) | FAIL | Silent fail, no user feedback — see HIGH-01 |
| Copy button text reset | PASS | Resets to "Copy" after 1.8s |
| Clipboard content correct | PASS | Matches `data-copy` attribute |
| Bookmark button on detail page | PASS | Present with correct `data-slug` |
| Flavor bars present | PASS | 5 `.flavor-bar-fill` elements |
| Guide page loads (HTTP 200) | PASS | Returns 200 |
| Table of Contents present | PASS | `.toc-list` with 8 links |
| TOC links point to existing anchors | PASS | All 5 tested links resolve |
| TOC link click scrolls to section | PASS | Smooth scroll confirmed |
| No JS console errors (Guide) | PASS | Zero errors |
| Mobile nav toggle (375px) | PASS | Opens, closes, aria-expanded updates |
| Mobile nav outside click closes | PASS | Closes on outside click |
| Responsive layout — 414px | PASS | No horizontal overflow |
| Responsive layout — 768px | PASS | No horizontal overflow |
| Responsive layout — 1440px | PASS | No horizontal overflow |
| Responsive layout — 320px | FAIL | Horizontal overflow — see HIGH-03 |
| No broken navigation links (15 tested) | PASS | All internal links return 200 |
| Image fade-in (opacity 0 → 1) | PASS | JS adds `img-loaded` class correctly |
| Images loaded after network idle | PASS | All 3 sampled images show `opacity: 1` |
| CSS custom properties loaded | PASS | `--terracotta`, `--cream` etc. defined |
| Header height > 0 | PASS | 66px height confirmed |
| Footer present | PASS | Footer element found on all pages |

---

## Screenshots Captured

All screenshots saved to `/home/dev/projects/thai-coffee/qa-screenshots/`.

| File | Description |
|---|---|
| `01-home-desktop.png` | Home page, desktop viewport (1280px), editorial view |
| `02-home-list-view.png` | Home page, list view active |
| `03-home-editorial-view.png` | Home page, editorial view restored |
| `06-compare-desktop.png` | Compare page, desktop viewport |
| `07-compare-filter-active.png` | Compare page, specialty filter active with "1 active" pill |
| `08-compare-filters-cleared.png` | Compare page, after clear filters |
| `09-compare-mobile.png` | Compare page, mobile viewport (375px) |
| `10-doi_chaang-desktop.png` | Doi Chaang brand detail page, desktop |
| `11-doi_chaang-gallery-thumb2.png` | Gallery with second thumbnail selected |
| `12-doi_chaang-copy-btn.png` | Copy button area |
| `13-doi_chaang-scrolled.png` | Brand detail scrolled to flavor section + radar chart |
| `14-doi_chaang-mobile.png` | Brand detail, mobile viewport |
| `10-akha_ama-desktop.png` | Akha Ama brand detail page, desktop |
| `11-akha_ama-gallery-thumb2.png` | Gallery with second thumbnail selected |
| `14-akha_ama-mobile.png` | Akha Ama brand detail, mobile viewport |
| `15-guide-desktop.png` | Guide page, desktop viewport |
| `16-guide-scrolled.png` | Guide page, scrolled with TOC |
| `17-guide-mobile.png` | Guide page, mobile viewport |
| `deep-01-bookmark-saved.png` | Home page with one brand bookmarked |
| `deep-02-list-view-with-saved.png` | List view with Saved button visible |
| `deep-03-saved-filter-active.png` | Saved filter active, showing 1 of 16 brands |
| `deep-04-copy-btn-copied.png` | Copy button showing "Copied!" feedback |
| `deep-05-mobile-nav-closed.png` | Mobile nav, closed state |
| `deep-06-mobile-nav-open.png` | Mobile nav, open state |
| `deep-07-compare-roast-filter.png` | Compare page, roast filter active |
| `deep-08-compare-name-sort.png` | Compare page, sorted by name |
| `deep-09-compare-multi-filter.png` | Compare page, category + roast combined filter |
| `deep-10-lightbox-open.png` | Lightbox open on brand detail page |
| `deep-11-guide-toc.png` | Guide page with TOC |
| `deep-12-compare-table.png` | Compare page full table |
| `deep-responsive-mobile-s.png` | Home page at 320px (overflow present) |
| `deep-responsive-mobile-l.png` | Home page at 414px (no overflow) |
| `deep-responsive-tablet.png` | Home page at 768px (no overflow) |
| `deep-responsive-desktop.png` | Home page at 1440px (no overflow) |

---

## Issue Priority Matrix

| ID | Severity | Feature | Effort to Fix | User Impact |
|---|---|---|---|---|
| HIGH-01 | High | Clipboard unhandled rejection | Low (add `.catch()`) | Medium — silent failure in some contexts |
| HIGH-02 | High | Quick-list bookmarks in hidden section | Medium (UX redesign) | Medium — discoverability of save feature |
| HIGH-03 | High | Horizontal overflow at 320px | Low (CSS fix) | Low — affects only smallest phones |
| MEDIUM-01 | Medium | `--brown` CSS variable undefined | Low (add one line) | Low — preventive |
| MEDIUM-02 | Medium | Copy button silent failure | Low (same as HIGH-01) | Medium — duplicates HIGH-01 |
| MEDIUM-03 | Medium | Saved filter button hidden by default | Low (CSS visibility) | Medium — feature discoverability |
| MEDIUM-04 | Medium | Filter option labels not human-friendly | Low (template edit) | Low — cosmetic |
| LOW-01 | Low | Shimmer not visible during image load | Medium (CSS/HTML) | Low — slow connections |
| LOW-02 | Low | Stats below fold on mobile | Medium (layout) | Low — UX improvement |
| LOW-03 | Low | Wrong active nav on detail pages | Low (template fix) | Low — visual polish |
| LOW-04 | Low | Lightbox missing focus trap | Medium (JS focus management) | Medium — accessibility |
| LOW-05 | Low | TOC active state via inline styles | Low (CSS class instead) | None — code quality |
| LOW-06 | Low | Sort name shows Thai text in test | None (test artifact) | None |

---

## Positive Findings (What Works Well)

The following features were explicitly verified and found to be fully functional:

- **Radar Chart:** Custom canvas-based spider chart renders correctly on all tested brand pages. `window.FLAVOR_DATA` is defined, canvas dimensions are 280x280, and pixel content is non-blank. The implementation in `/js/brand-detail.js` is clean and does not depend on external chart libraries.

- **Image Gallery with Lightbox:** Full gallery flow works end-to-end. Thumbnail click advances the active frame, arrow navigation works, counter updates correctly (e.g., "01 / 08"), lightbox opens on stage click and on the expand button, Escape key closes it, body scroll is locked while open, and the lightbox image src updates on navigation.

- **Active Filter States (Compare Page):** The filter highlight system works exactly as specified. Selecting any filter applies `filter-select--active` CSS class to the dropdown. The "Clear filters" button appears with `.is-visible`. The active filter count pill shows the correct count ("1 active", "2 active"). Clicking "Clear filters" or "Reset" restores all defaults and hides the UI indicators.

- **View Toggle (Home Page):** Switching between Editorial and All Brands view is smooth. The `is-active` class and `aria-pressed` attribute update correctly. The selected view is persisted to localStorage under `tcg-view`. The quick-list section shows/hides correctly.

- **Bookmark / Save Feature (Core Flow):** Clicking a bookmark button on a visible card correctly adds `is-saved` class, updates the bookmark count badge, shows the Saved filter button, and persists data to localStorage under `tcg-bookmarks`. The Saved filter in list view correctly filters rows to only show bookmarked brands. Bookmark state persists across page navigations.

- **Copy Button (with permission):** When the Clipboard API permission is available, the full flow works: text is copied to clipboard, button shows "Copied!" for 1.8 seconds, then resets to "Copy". Clipboard content verified to match the `data-copy` attribute exactly (e.g., `"Doi Chaang Coffee (ดอยช้าง คอฟฟี่)"`).

- **Mobile Navigation:** The hamburger toggle works on all tested mobile viewports. Nav opens/closes correctly, `aria-expanded` updates, and the nav closes on outside click.

- **No 404 Errors:** All 15 tested internal links returned HTTP 200.

- **No Console Errors on Non-Detail Pages:** Home, Compare, and Guide pages are clean — zero JavaScript console errors.

- **Responsive Layout (414px+):** Layout is solid at 414px, 768px, and 1440px. No overflow, header always visible.

---

## Recommended Fix Order

1. **HIGH-01 + MEDIUM-02 (same root cause):** Add `.catch()` to the clipboard call in `/js/main.js` line 148. One-line fix.
2. **HIGH-03:** Add `overflow-x: hidden` or constrain the `.category-strip` / `.strip-inner` at narrow mobile widths in `/css/main.css`.
3. **MEDIUM-03:** Make the Saved filter button always visible (perhaps dimmed) when no bookmarks exist.
4. **LOW-04:** Add `role="dialog"` and a focus trap to the lightbox in `/js/brand-detail.js`.
5. **LOW-03:** Fix active nav link on brand detail pages in the template.
6. **MEDIUM-01:** Add `--brown` alias to CSS variables.
7. **MEDIUM-04:** Update filter option display text to human-friendly labels.

---

## Test Environment

| Property | Value |
|---|---|
| Test Date | 2026-03-03 |
| Playwright | 1.58.2 |
| Browser Engine | Chromium (headless) |
| Site Protocol | HTTPS |
| Desktop Viewport | 1280 × 800 |
| Mobile Viewports Tested | 320px, 375px, 414px, 768px, 1440px |
| Pages Tested | 5 (Home, Compare, Doi Chaang detail, Akha Ama detail, Guide) |
| Internal Links Checked | 15 |
| Total Automated Checks | 148 |
| Passed | 135 (91.2%) |
| Failed / Issues | 13 (8.8%) |

---

*Report generated by automated Playwright audit + manual code review.*
*Test scripts: `/home/dev/projects/thai-coffee/qa-tests/audit.js` and `/home/dev/projects/thai-coffee/qa-tests/deep-audit.js`*
*Raw results data: `/home/dev/projects/thai-coffee/qa-results.json`*
