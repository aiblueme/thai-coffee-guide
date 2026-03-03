/**
 * Thai Coffee Guide — Comprehensive QA Audit Script
 * Uses Playwright (chromium) to test all pages and features.
 */

const { chromium } = require('/home/dev/projects/qa-assessment/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://thai-coffee.shellnode.lol';
const SCREENSHOTS_DIR = '/home/dev/projects/thai-coffee/qa-screenshots';
const RESULTS = [];

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[QA] ${msg}`); }

function issue(severity, page, feature, description, details = '') {
  const entry = { severity, page, feature, description, details };
  RESULTS.push(entry);
  console.log(`  [${severity}] ${description}${details ? ' — ' + details : ''}`);
}

function pass(page, feature, description) {
  const entry = { severity: 'PASS', page, feature, description };
  RESULTS.push(entry);
  console.log(`  [PASS] ${description}`);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  return filepath;
}

async function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));
  return errors;
}

// ─── Test: Home Page ─────────────────────────────────────────────────────────

async function testHomePage(browser) {
  log('=== Testing Home Page ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));

  const pageName = 'Home';

  try {
    const resp = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // HTTP status
    if (resp.status() === 200) {
      pass(pageName, 'Navigation', 'Home page returns HTTP 200');
    } else {
      issue('Critical', pageName, 'Navigation', `Home page returned HTTP ${resp.status()}`);
    }

    await screenshot(page, '01-home-desktop');

    // Title
    const title = await page.title();
    if (title && title.length > 0) {
      pass(pageName, 'Meta', `Page title present: "${title}"`);
    } else {
      issue('Medium', pageName, 'Meta', 'Page title is empty');
    }

    // Nav elements
    const navToggle = await page.$('.nav-toggle');
    if (navToggle) {
      pass(pageName, 'Navigation', 'Mobile nav toggle element present');
    } else {
      issue('High', pageName, 'Navigation', 'Mobile nav toggle (.nav-toggle) not found');
    }

    const siteNav = await page.$('.site-nav');
    if (siteNav) {
      pass(pageName, 'Navigation', 'Site nav element present');
    } else {
      issue('High', pageName, 'Navigation', 'Site nav (.site-nav) not found');
    }

    // View toggle buttons
    const viewToggleBtns = await page.$$('.view-toggle__btn');
    if (viewToggleBtns.length >= 2) {
      pass(pageName, 'View Toggle', `View toggle buttons found (${viewToggleBtns.length})`);
    } else {
      issue('High', pageName, 'View Toggle', `Expected ≥2 view-toggle buttons, found ${viewToggleBtns.length}`);
    }

    // Check editorial section visible by default
    const editorialSect = await page.$('#editorial-sections');
    const quickListSect = await page.$('#quick-list-section');

    if (editorialSect && quickListSect) {
      const editHidden = await editorialSect.getAttribute('hidden');
      const quickHidden = await quickListSect.getAttribute('hidden');

      if (editHidden === null) {
        pass(pageName, 'View Toggle', 'Editorial view visible by default (or saved preference)');
      } else if (quickHidden === null) {
        pass(pageName, 'View Toggle', 'Quick-list view visible (saved user preference)');
      } else {
        issue('High', pageName, 'View Toggle', 'Both editorial and quick-list sections are hidden');
      }
    } else {
      issue('High', pageName, 'View Toggle', 'editorial-sections or quick-list-section not found in DOM');
    }

    // Switch to list view
    const listBtn = await page.$('.view-toggle__btn[data-view="list"]');
    if (listBtn) {
      await listBtn.click();
      await page.waitForTimeout(500);
      const quickNowHidden = await quickListSect.getAttribute('hidden');
      if (quickNowHidden === null) {
        pass(pageName, 'View Toggle', 'Switching to list view shows quick-list section');
      } else {
        issue('High', pageName, 'View Toggle', 'Clicking list toggle did not show quick-list section');
      }

      // Check list btn active
      const isActive = await listBtn.evaluate(el => el.classList.contains('is-active'));
      if (isActive) {
        pass(pageName, 'View Toggle', 'List button gets is-active class on click');
      } else {
        issue('Medium', pageName, 'View Toggle', 'List button does not get is-active class after click');
      }

      await screenshot(page, '02-home-list-view');
    } else {
      issue('High', pageName, 'View Toggle', 'List view toggle button not found');
    }

    // Switch back to editorial view
    const editBtn = await page.$('.view-toggle__btn[data-view="editorial"]');
    if (editBtn) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '03-home-editorial-view');
    }

    // Bookmark buttons
    const bookmarkBtns = await page.$$('.bookmark-btn[data-slug]');
    if (bookmarkBtns.length > 0) {
      pass(pageName, 'Bookmarks', `Bookmark buttons found (${bookmarkBtns.length})`);

      // Click a bookmark button
      await bookmarkBtns[0].click();
      await page.waitForTimeout(300);

      const isSaved = await bookmarkBtns[0].evaluate(el => el.classList.contains('is-saved'));
      if (isSaved) {
        pass(pageName, 'Bookmarks', 'Clicking bookmark button adds is-saved class');
      } else {
        issue('High', pageName, 'Bookmarks', 'Clicking bookmark button did not add is-saved class');
      }

      // Check bookmark count badge
      const badge = await page.$('.bookmark-count-badge');
      if (badge) {
        const badgeHidden = await badge.getAttribute('hidden');
        if (badgeHidden === null) {
          const badgeText = await badge.textContent();
          pass(pageName, 'Bookmarks', `Bookmark count badge visible with count: ${badgeText}`);
        } else {
          issue('High', pageName, 'Bookmarks', 'Bookmark count badge remains hidden after saving a brand');
        }
      } else {
        issue('Medium', pageName, 'Bookmarks', 'Bookmark count badge (.bookmark-count-badge) not found');
      }

      // Un-bookmark
      await bookmarkBtns[0].click();
      await page.waitForTimeout(300);
    } else {
      issue('High', pageName, 'Bookmarks', 'No bookmark buttons (.bookmark-btn[data-slug]) found on home page');
    }

    // Brand cards
    const brandCards = await page.$$('.brand-card');
    if (brandCards.length > 0) {
      pass(pageName, 'Brand Cards', `Brand cards found (${brandCards.length})`);
    } else {
      issue('High', pageName, 'Brand Cards', 'No brand cards found on editorial view');
    }

    // Images
    const cardImgs = await page.$$('.brand-card__img');
    if (cardImgs.length > 0) {
      pass(pageName, 'Images', `Brand card images found (${cardImgs.length})`);
      // Check if at least one image loaded
      const firstImgLoaded = await cardImgs[0].evaluate(img => img.complete && img.naturalWidth > 0);
      if (firstImgLoaded) {
        pass(pageName, 'Images', 'First brand card image loaded successfully');
      } else {
        issue('Medium', pageName, 'Images', 'First brand card image did not load');
      }
    } else {
      issue('Medium', pageName, 'Images', 'No brand card images found');
    }

    // Console errors
    if (errors.length === 0) {
      pass(pageName, 'Console', 'No JavaScript console errors');
    } else {
      errors.forEach(e => issue('High', pageName, 'Console', `JS Error: ${e}`));
    }

    // Mobile viewport test
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await screenshot(page, '04-home-mobile');

    // Mobile nav toggle
    if (navToggle) {
      await navToggle.click();
      await page.waitForTimeout(400);
      const navOpen = await siteNav.evaluate(el => el.classList.contains('open'));
      if (navOpen) {
        pass(pageName, 'Mobile Nav', 'Mobile nav opens on toggle click');
      } else {
        issue('High', pageName, 'Mobile Nav', 'Mobile nav did not open after toggle click');
      }
      await screenshot(page, '05-home-mobile-nav-open');

      // Close nav
      await navToggle.click();
      await page.waitForTimeout(300);
    }

    // Bookmark filter button (Saved filter)
    const bookmarkFilterBtn = await page.$('#bookmark-filter-btn');
    if (bookmarkFilterBtn) {
      pass(pageName, 'Bookmark Filter', 'Bookmark filter button (#bookmark-filter-btn) found');
    } else {
      issue('Medium', pageName, 'Bookmark Filter', 'Bookmark filter button (#bookmark-filter-btn) not found');
    }

  } catch (err) {
    issue('Critical', pageName, 'Test Execution', `Test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Compare Page ──────────────────────────────────────────────────────

async function testComparePage(browser) {
  log('=== Testing Compare Page ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));

  const pageName = 'Compare';

  try {
    const resp = await page.goto(`${BASE_URL}/compare.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (resp.status() === 200) {
      pass(pageName, 'Navigation', 'Compare page returns HTTP 200');
    } else {
      issue('Critical', pageName, 'Navigation', `Compare page returned HTTP ${resp.status()}`);
    }

    await screenshot(page, '06-compare-desktop');

    // Filter elements
    const filterCategory = await page.$('#filter-category');
    const filterRoast = await page.$('#filter-roast');
    const filterPrice = await page.$('#filter-price');
    const sortBy = await page.$('#sort-by');

    if (filterCategory && filterRoast && filterPrice && sortBy) {
      pass(pageName, 'Filters', 'All filter dropdowns present');
    } else {
      const missing = [
        !filterCategory && 'filter-category',
        !filterRoast && 'filter-roast',
        !filterPrice && 'filter-price',
        !sortBy && 'sort-by'
      ].filter(Boolean);
      issue('High', pageName, 'Filters', `Missing filter elements: ${missing.join(', ')}`);
    }

    // Clear filter button
    const clearBtn = await page.$('#filter-clear-btn');
    if (clearBtn) {
      pass(pageName, 'Filters', 'Clear filters button (#filter-clear-btn) present');
    } else {
      issue('High', pageName, 'Filters', 'Clear filters button (#filter-clear-btn) not found');
    }

    // Active filter pill
    const activePill = await page.$('#active-filter-pill');
    if (activePill) {
      pass(pageName, 'Filters', 'Active filter pill (#active-filter-pill) present');
    } else {
      issue('Medium', pageName, 'Filters', 'Active filter pill (#active-filter-pill) not found');
    }

    // Test: Select a category filter and verify active state
    if (filterCategory) {
      // Get available options
      const options = await filterCategory.$$('option');
      const optionValues = await Promise.all(options.map(o => o.getAttribute('value')));
      const nonEmptyOptions = optionValues.filter(v => v && v !== '');
      log(`  Category filter options: ${optionValues.join(', ')}`);

      if (nonEmptyOptions.length > 0) {
        await filterCategory.selectOption(nonEmptyOptions[0]);
        await page.waitForTimeout(500);

        // Check active class on the select
        const hasActiveClass = await filterCategory.evaluate(el => el.classList.contains('filter-select--active'));
        if (hasActiveClass) {
          pass(pageName, 'Active Filter State', 'Filter dropdown gets filter-select--active class when value selected');
        } else {
          issue('High', pageName, 'Active Filter State', 'Filter dropdown does not get filter-select--active class when value is selected');
        }

        // Check clear button visibility
        if (clearBtn) {
          const clearVisible = await clearBtn.evaluate(el => el.classList.contains('is-visible'));
          if (clearVisible) {
            pass(pageName, 'Active Filter State', 'Clear filters button becomes visible when filter is active');
          } else {
            issue('High', pageName, 'Active Filter State', 'Clear filters button does not become visible when filter is active');
          }

          // Check active pill
          if (activePill) {
            const pillVisible = await activePill.evaluate(el => el.classList.contains('is-visible'));
            if (pillVisible) {
              const pillText = await activePill.textContent();
              pass(pageName, 'Active Filter State', `Active filter pill shows: "${pillText}"`);
            } else {
              issue('Medium', pageName, 'Active Filter State', 'Active filter count pill not visible when filter is active');
            }
          }

          await screenshot(page, '07-compare-filter-active');

          // Test clear filters button
          await clearBtn.click();
          await page.waitForTimeout(500);

          const categoryVal = await filterCategory.evaluate(el => el.value);
          if (categoryVal === '') {
            pass(pageName, 'Clear Filters', 'Clear filters button resets category filter to empty');
          } else {
            issue('High', pageName, 'Clear Filters', `Clear filters did not reset category filter (value: "${categoryVal}")`);
          }

          const clearStillVisible = await clearBtn.evaluate(el => el.classList.contains('is-visible'));
          if (!clearStillVisible) {
            pass(pageName, 'Clear Filters', 'Clear filters button hides after resetting all filters');
          } else {
            issue('Medium', pageName, 'Clear Filters', 'Clear filters button remains visible after resetting');
          }

          await screenshot(page, '08-compare-filters-cleared');
        }
      } else {
        issue('Medium', pageName, 'Filters', 'No non-empty options found in category filter');
      }
    }

    // Brand rows in table
    const brandRows = await page.$$('.brand-row-tr');
    if (brandRows.length > 0) {
      pass(pageName, 'Table', `Brand table rows found (${brandRows.length})`);
    } else {
      issue('High', pageName, 'Table', 'No brand table rows (.brand-row-tr) found');
    }

    // Results count
    const resultsCount = await page.$('#results-count');
    if (resultsCount) {
      const countText = await resultsCount.textContent();
      pass(pageName, 'Table', `Results count element present, showing: ${countText}`);
    } else {
      issue('Medium', pageName, 'Table', 'Results count (#results-count) not found');
    }

    // Sort buttons
    const sortBtns = await page.$$('.sort-btn');
    if (sortBtns.length > 0) {
      pass(pageName, 'Sort', `Sort buttons found (${sortBtns.length})`);

      // Click rating sort
      const ratingSort = await page.$('.sort-btn[data-sort-col="rating"]');
      if (ratingSort) {
        await ratingSort.click();
        await page.waitForTimeout(300);
        pass(pageName, 'Sort', 'Rating sort button clicked without error');
      }
    } else {
      issue('Medium', pageName, 'Sort', 'No sort buttons found');
    }

    // Bookmark buttons in table
    const tableBookmarks = await page.$$('.bookmark-btn[data-slug]');
    if (tableBookmarks.length > 0) {
      pass(pageName, 'Bookmarks', `Bookmark buttons in compare table found (${tableBookmarks.length})`);
    } else {
      issue('Medium', pageName, 'Bookmarks', 'No bookmark buttons found in compare table');
    }

    // Console errors
    if (errors.length === 0) {
      pass(pageName, 'Console', 'No JavaScript console errors');
    } else {
      errors.forEach(e => issue('High', pageName, 'Console', `JS Error: ${e}`));
    }

    // Mobile test
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await screenshot(page, '09-compare-mobile');

  } catch (err) {
    issue('Critical', pageName, 'Test Execution', `Test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Brand Detail Page ─────────────────────────────────────────────────

async function testBrandDetailPage(browser, slug, pageLabel) {
  log(`=== Testing Brand Detail Page: ${slug} ===`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));

  const pageName = pageLabel;
  const screenshotPrefix = slug.replace(/-/g, '_');

  try {
    const resp = await page.goto(`${BASE_URL}/brands/${slug}.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    if (resp.status() === 200) {
      pass(pageName, 'Navigation', `Brand detail page returns HTTP 200`);
    } else {
      issue('Critical', pageName, 'Navigation', `Brand detail page returned HTTP ${resp.status()}`);
    }

    await screenshot(page, `10-${screenshotPrefix}-desktop`);

    // Page title
    const title = await page.title();
    if (title && title.length > 0) {
      pass(pageName, 'Meta', `Page title: "${title}"`);
    } else {
      issue('Medium', pageName, 'Meta', 'Page title is empty');
    }

    // Radar chart canvas
    const radarCanvas = await page.$('#flavor-radar');
    if (radarCanvas) {
      pass(pageName, 'Radar Chart', 'Radar chart canvas (#flavor-radar) found');

      // Check canvas has been drawn (non-empty dimensions)
      const canvasDims = await radarCanvas.evaluate(canvas => ({
        width: canvas.width,
        height: canvas.height,
        hasContext: !!canvas.getContext('2d')
      }));

      if (canvasDims.width > 0 && canvasDims.height > 0) {
        pass(pageName, 'Radar Chart', `Canvas has valid dimensions: ${canvasDims.width}x${canvasDims.height}`);
      } else {
        issue('High', pageName, 'Radar Chart', `Canvas has zero dimensions: ${canvasDims.width}x${canvasDims.height}`);
      }

      // Check FLAVOR_DATA is defined
      const flavorDataExists = await page.evaluate(() => !!window.FLAVOR_DATA);
      if (flavorDataExists) {
        pass(pageName, 'Radar Chart', 'window.FLAVOR_DATA is defined');
      } else {
        issue('High', pageName, 'Radar Chart', 'window.FLAVOR_DATA is not defined — radar chart may not render');
      }

      // Check canvas is not blank by sampling pixels
      await page.waitForTimeout(500); // give time for drawRadar to run
      const hasDrawnPixels = await radarCanvas.evaluate(canvas => {
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // Check if any pixel is non-transparent
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
        return false;
      });

      if (hasDrawnPixels) {
        pass(pageName, 'Radar Chart', 'Radar chart canvas has drawn content (non-blank)');
      } else {
        issue('High', pageName, 'Radar Chart', 'Radar chart canvas appears blank (all pixels transparent)');
      }
    } else {
      issue('High', pageName, 'Radar Chart', 'Radar chart canvas (#flavor-radar) not found');
    }

    // Image gallery
    const gallery = await page.$('#brand-gallery');
    if (gallery) {
      pass(pageName, 'Gallery', 'Image gallery (#brand-gallery) found');

      const galleryFrames = await page.$$('.gallery__frame');
      const galleryThumbs = await page.$$('.gallery__thumb');

      if (galleryFrames.length > 0) {
        pass(pageName, 'Gallery', `Gallery frames found (${galleryFrames.length})`);
      } else {
        issue('High', pageName, 'Gallery', 'No gallery frames (.gallery__frame) found');
      }

      if (galleryThumbs.length > 0) {
        pass(pageName, 'Gallery', `Gallery thumbnails found (${galleryThumbs.length})`);

        // Click the second thumbnail if it exists
        if (galleryThumbs.length > 1) {
          await galleryThumbs[1].click();
          await page.waitForTimeout(500);

          // Check if the second frame is now active
          const secondFrameActive = await galleryFrames[1].evaluate(el => el.classList.contains('is-active'));
          if (secondFrameActive) {
            pass(pageName, 'Gallery', 'Clicking second thumbnail activates second gallery frame');
          } else {
            issue('High', pageName, 'Gallery', 'Clicking thumbnail did not activate corresponding gallery frame');
          }
          await screenshot(page, `11-${screenshotPrefix}-gallery-thumb2`);
        } else {
          pass(pageName, 'Gallery', 'Only one gallery image (single-image brand)');
        }
      } else {
        issue('Medium', pageName, 'Gallery', 'No gallery thumbnails (.gallery__thumb) found');
      }
    } else {
      issue('Medium', pageName, 'Gallery', 'Image gallery (#brand-gallery) not found');
    }

    // Copy button
    const copyBtn = await page.$('.copy-btn[data-copy]');
    if (copyBtn) {
      pass(pageName, 'Copy Button', 'Copy button found');

      const copyData = await copyBtn.getAttribute('data-copy');
      if (copyData && copyData.length > 0) {
        pass(pageName, 'Copy Button', `Copy button has data: "${copyData}"`);
      } else {
        issue('Medium', pageName, 'Copy Button', 'Copy button has empty data-copy attribute');
      }

      // Simulate clipboard API (may not work in headless without permission)
      try {
        await page.evaluate(() => {
          // Override clipboard to test the button click flow
          navigator.clipboard = {
            writeText: (text) => Promise.resolve()
          };
        });
        await copyBtn.click();
        await page.waitForTimeout(500);

        const isCopied = await copyBtn.evaluate(el => el.classList.contains('is-copied'));
        if (isCopied) {
          pass(pageName, 'Copy Button', 'Copy button shows is-copied class after click');
        } else {
          issue('Medium', pageName, 'Copy Button', 'Copy button did not show is-copied state after click');
        }

        const btnText = await copyBtn.textContent();
        if (btnText.trim() === 'Copied!') {
          pass(pageName, 'Copy Button', 'Copy button shows "Copied!" text feedback');
        } else {
          issue('Medium', pageName, 'Copy Button', `Copy button text after click: "${btnText.trim()}" (expected "Copied!")`);
        }

        await screenshot(page, `12-${screenshotPrefix}-copy-btn`);
      } catch (e) {
        issue('Low', pageName, 'Copy Button', `Copy button click test error: ${e.message}`);
      }
    } else {
      issue('Medium', pageName, 'Copy Button', 'No copy button (.copy-btn[data-copy]) found');
    }

    // Bookmark button on detail page
    const bookmarkBtn = await page.$('.bookmark-btn[data-slug]');
    if (bookmarkBtn) {
      pass(pageName, 'Bookmark', 'Bookmark button found on detail page');
      const slug_val = await bookmarkBtn.getAttribute('data-slug');
      pass(pageName, 'Bookmark', `Bookmark slug: "${slug_val}"`);
    } else {
      issue('Medium', pageName, 'Bookmark', 'No bookmark button (.bookmark-btn[data-slug]) found on detail page');
    }

    // Flavor bars
    const flavorBars = await page.$$('.flavor-bar-fill');
    if (flavorBars.length > 0) {
      pass(pageName, 'Flavor Bars', `Flavor bar fill elements found (${flavorBars.length})`);
    } else {
      issue('Low', pageName, 'Flavor Bars', 'No flavor bar fill elements found');
    }

    // Main hero image
    const heroImg = await page.$('.brand-detail__hero-img, .brand-hero__img, img.hero-img');
    if (heroImg) {
      const imgLoaded = await heroImg.evaluate(img => img.complete && img.naturalWidth > 0);
      if (imgLoaded) {
        pass(pageName, 'Images', 'Hero image loaded successfully');
      } else {
        issue('Medium', pageName, 'Images', 'Hero image did not load');
      }
    }

    // Scroll down and screenshot
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    await screenshot(page, `13-${screenshotPrefix}-scrolled`);

    // Console errors
    if (errors.length === 0) {
      pass(pageName, 'Console', 'No JavaScript console errors');
    } else {
      errors.forEach(e => issue('High', pageName, 'Console', `JS Error: ${e}`));
    }

    // Mobile test
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await screenshot(page, `14-${screenshotPrefix}-mobile`);

  } catch (err) {
    issue('Critical', pageName, 'Test Execution', `Test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Guide Page ────────────────────────────────────────────────────────

async function testGuidePage(browser) {
  log('=== Testing Guide Page ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));

  const pageName = 'Guide';

  try {
    const resp = await page.goto(`${BASE_URL}/guide.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (resp.status() === 200) {
      pass(pageName, 'Navigation', 'Guide page returns HTTP 200');
    } else {
      issue('Critical', pageName, 'Navigation', `Guide page returned HTTP ${resp.status()}`);
    }

    await screenshot(page, '15-guide-desktop');

    const title = await page.title();
    if (title && title.length > 0) {
      pass(pageName, 'Meta', `Page title: "${title}"`);
    }

    // Table of Contents
    const toc = await page.$('.toc-list');
    if (toc) {
      pass(pageName, 'TOC', 'Table of contents (.toc-list) found');
      const tocLinks = await page.$$('.toc-list a');
      if (tocLinks.length > 0) {
        pass(pageName, 'TOC', `TOC links found (${tocLinks.length})`);
      } else {
        issue('Medium', pageName, 'TOC', 'No links in table of contents');
      }
    } else {
      issue('Low', pageName, 'TOC', 'Table of contents (.toc-list) not found');
    }

    // Content sections
    const sections = await page.$$('section[id], article[id], h2[id], h3[id]');
    pass(pageName, 'Content', `Content sections/headings with IDs found: ${sections.length}`);

    // Scroll and check TOC active state
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(800);
    await screenshot(page, '16-guide-scrolled');

    // Console errors
    if (errors.length === 0) {
      pass(pageName, 'Console', 'No JavaScript console errors');
    } else {
      errors.forEach(e => issue('High', pageName, 'Console', `JS Error: ${e}`));
    }

    // Mobile test
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await screenshot(page, '17-guide-mobile');

  } catch (err) {
    issue('Critical', pageName, 'Test Execution', `Test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Navigation Links ───────────────────────────────────────────────────

async function testNavLinks(browser) {
  log('=== Testing Navigation Links (404 check) ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const pageName = 'Navigation';
  const failedLinks = [];
  const testedLinks = new Set();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Collect all navigation links
    const navLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(href => href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:') && !href.includes('#'));
    });

    log(`  Found ${navLinks.length} links on home page`);

    for (const href of navLinks.slice(0, 30)) { // Limit to 30 to avoid excessive requests
      if (testedLinks.has(href)) continue;
      testedLinks.add(href);

      if (!href.includes('thai-coffee.shellnode.lol') && !href.includes('shellnode.lol')) continue;

      try {
        const resp = await page.evaluate(async (url) => {
          try {
            const r = await fetch(url, { method: 'HEAD' });
            return r.status;
          } catch (e) {
            return -1;
          }
        }, href);

        if (resp === 200) {
          pass(pageName, 'Link Check', `OK: ${href}`);
        } else if (resp === 301 || resp === 302) {
          pass(pageName, 'Link Check', `Redirect (${resp}): ${href}`);
        } else if (resp === 404) {
          issue('High', pageName, 'Link Check', `404 Not Found: ${href}`);
          failedLinks.push(href);
        } else {
          issue('Medium', pageName, 'Link Check', `HTTP ${resp}: ${href}`);
        }
      } catch (e) {
        issue('Low', pageName, 'Link Check', `Error checking link ${href}: ${e.message}`);
      }
    }

  } catch (err) {
    issue('Critical', pageName, 'Test Execution', `Navigation test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Image Loading & Shimmer ──────────────────────────────────────────

async function testImageLoading(browser) {
  log('=== Testing Image Loading & Shimmer ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const pageName = 'Image Loading';

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    // Check shimmer/skeleton elements
    const shimmerEls = await page.$$('.img-placeholder, .skeleton, [class*="shimmer"], [class*="skeleton"]');
    if (shimmerEls.length > 0) {
      pass(pageName, 'Shimmer', `Shimmer/skeleton placeholder elements found (${shimmerEls.length})`);
    } else {
      // Check in CSS if there are shimmer styles defined
      issue('Low', pageName, 'Shimmer', 'No shimmer/skeleton placeholder elements found in DOM');
    }

    // Check img-loaded class on images after networkidle
    const allImgs = await page.$$('.brand-card__img, .brand-card__compact-img, .brand-row__img, .table-brand-img');
    if (allImgs.length > 0) {
      let loadedCount = 0;
      for (const img of allImgs) {
        const hasLoaded = await img.evaluate(el => el.classList.contains('img-loaded') || (el.complete && el.naturalWidth > 0));
        if (hasLoaded) loadedCount++;
      }
      if (loadedCount === allImgs.length) {
        pass(pageName, 'Image Fade-in', `All ${allImgs.length} images have img-loaded class or are complete`);
      } else {
        issue('Medium', pageName, 'Image Fade-in', `Only ${loadedCount}/${allImgs.length} images have img-loaded class`);
      }
    }

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Image loading test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Bookmark persistence across pages ─────────────────────────────────

async function testBookmarkPersistence(browser) {
  log('=== Testing Bookmark Persistence (localStorage) ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageName = 'Bookmark Persistence';

  try {
    // Navigate to home page
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Click first bookmark button to save a brand
    const bookmarkBtns = await page.$$('.bookmark-btn[data-slug]');
    if (bookmarkBtns.length > 0) {
      const firstSlug = await bookmarkBtns[0].getAttribute('data-slug');
      await bookmarkBtns[0].click();
      await page.waitForTimeout(300);

      // Verify localStorage was updated
      const storedData = await page.evaluate(() => localStorage.getItem('tcg-bookmarks'));
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          pass(pageName, 'localStorage', `Brand "${parsed[0]}" saved to localStorage`);
        } else {
          issue('High', pageName, 'localStorage', 'localStorage key exists but data is empty or malformed');
        }
      } else {
        issue('High', pageName, 'localStorage', 'localStorage key "tcg-bookmarks" not set after bookmarking');
      }

      // Navigate to compare page and check if bookmark persists
      await page.goto(`${BASE_URL}/compare.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      const persistedData = await page.evaluate(() => localStorage.getItem('tcg-bookmarks'));
      if (persistedData) {
        pass(pageName, 'localStorage', 'Bookmark data persists after navigating to compare page');
      } else {
        issue('High', pageName, 'localStorage', 'Bookmark data lost after page navigation');
      }

      // Navigate to brand detail page
      await page.goto(`${BASE_URL}/brands/${firstSlug}.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Check if bookmark button on detail page shows saved state
      const detailBookmarkBtn = await page.$('.bookmark-btn[data-slug]');
      if (detailBookmarkBtn) {
        const isSaved = await detailBookmarkBtn.evaluate(el => el.classList.contains('is-saved'));
        if (isSaved) {
          pass(pageName, 'Cross-page Sync', 'Brand detail page bookmark button reflects saved state from home page');
        } else {
          issue('High', pageName, 'Cross-page Sync', 'Brand detail page bookmark button does not reflect saved state from localStorage');
        }
      }

      // Clean up - remove bookmark
      await page.evaluate(() => localStorage.removeItem('tcg-bookmarks'));
    } else {
      issue('High', pageName, 'Test Setup', 'No bookmark buttons found on home page to test persistence');
    }

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Bookmark persistence test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: CSS / Visual Check ────────────────────────────────────────────────

async function testCSSStyles(browser) {
  log('=== Testing CSS / Visual Styles ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageName = 'CSS/Visual';

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Check that CSS custom properties are loaded
    const cssVarsLoaded = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const terracotta = style.getPropertyValue('--terracotta').trim();
      const brown = style.getPropertyValue('--brown').trim();
      return { terracotta, brown };
    });

    if (cssVarsLoaded.terracotta) {
      pass(pageName, 'CSS Variables', `--terracotta CSS variable loaded: "${cssVarsLoaded.terracotta}"`);
    } else {
      issue('Medium', pageName, 'CSS Variables', '--terracotta CSS variable not found (CSS may not be loaded)');
    }

    if (cssVarsLoaded.brown) {
      pass(pageName, 'CSS Variables', `--brown CSS variable loaded: "${cssVarsLoaded.brown}"`);
    } else {
      issue('Medium', pageName, 'CSS Variables', '--brown CSS variable not found');
    }

    // Check header height
    const headerEl = await page.$('header, .site-header');
    if (headerEl) {
      const headerHeight = await headerEl.evaluate(el => el.getBoundingClientRect().height);
      if (headerHeight > 0) {
        pass(pageName, 'Layout', `Header element has height: ${Math.round(headerHeight)}px`);
      } else {
        issue('High', pageName, 'Layout', 'Header element has zero height (CSS may be broken)');
      }
    }

    // Check footer
    const footer = await page.$('footer, .site-footer');
    if (footer) {
      pass(pageName, 'Layout', 'Footer element present');
    } else {
      issue('Low', pageName, 'Layout', 'Footer element not found');
    }

  } catch (err) {
    issue('Low', pageName, 'Test Execution', `CSS test threw exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting Thai Coffee Guide QA Audit...');
  log(`Target: ${BASE_URL}`);
  log(`Screenshots: ${SCREENSHOTS_DIR}`);
  log('');

  const browser = await chromium.launch({ headless: true });

  try {
    await testHomePage(browser);
    await testComparePage(browser);
    await testBrandDetailPage(browser, 'doi-chaang', 'Brand Detail: Doi Chaang');
    await testBrandDetailPage(browser, 'akha-ama', 'Brand Detail: Akha Ama');
    await testGuidePage(browser);
    await testNavLinks(browser);
    await testImageLoading(browser);
    await testBookmarkPersistence(browser);
    await testCSSStyles(browser);
  } finally {
    await browser.close();
  }

  // ─── Generate Summary ──────────────────────────────────────────
  const issues = RESULTS.filter(r => r.severity !== 'PASS');
  const passes = RESULTS.filter(r => r.severity === 'PASS');

  const critical = issues.filter(r => r.severity === 'Critical');
  const high     = issues.filter(r => r.severity === 'High');
  const medium   = issues.filter(r => r.severity === 'Medium');
  const low      = issues.filter(r => r.severity === 'Low');

  log('');
  log('=== QA AUDIT SUMMARY ===');
  log(`Total Checks:  ${RESULTS.length}`);
  log(`Passed:        ${passes.length}`);
  log(`Issues Total:  ${issues.length}`);
  log(`  Critical:    ${critical.length}`);
  log(`  High:        ${high.length}`);
  log(`  Medium:      ${medium.length}`);
  log(`  Low:         ${low.length}`);

  // Write results to JSON for report generation
  fs.writeFileSync('/home/dev/projects/thai-coffee/qa-results.json', JSON.stringify(RESULTS, null, 2));
  log('');
  log('Results written to /home/dev/projects/thai-coffee/qa-results.json');
  log('Screenshots saved to ' + SCREENSHOTS_DIR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
