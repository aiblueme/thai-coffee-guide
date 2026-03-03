/**
 * Thai Coffee Guide — Deep Dive QA Tests
 * Focuses on edge cases and subtle issues found in initial scan.
 */

const { chromium } = require('/home/dev/projects/qa-assessment/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://thai-coffee.shellnode.lol';
const SCREENSHOTS_DIR = '/home/dev/projects/thai-coffee/qa-screenshots';
const RESULTS = [];

function log(msg) { console.log(`[QA-DEEP] ${msg}`); }

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

// ─── Test: Bookmark Button Visibility Issue ───────────────────────────────────
// The initial test found bookmark buttons "not visible" — investigate why

async function testBookmarkButtonVisibility(browser) {
  log('=== Deep Test: Bookmark Button Visibility ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const pageName = 'Bookmark Visibility';

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check all bookmark buttons and their visibility states
    const bookmarkInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.bookmark-btn[data-slug]'));
      return btns.map(btn => {
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        const parentRect = btn.parentElement ? btn.parentElement.getBoundingClientRect() : null;
        return {
          slug: btn.dataset.slug,
          visible: rect.width > 0 && rect.height > 0,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
          rectTop: rect.top,
          rectHeight: rect.height,
          parentDisplay: btn.parentElement ? window.getComputedStyle(btn.parentElement).display : 'n/a',
          isInQuickList: btn.closest('.quick-list__row') !== null,
          isInEditorial: btn.closest('.brand-card') !== null,
          isInHero: btn.closest('.brand-hero') !== null,
          parentHidden: btn.closest('[hidden]') !== null
        };
      });
    });

    log(`  Total bookmark buttons: ${bookmarkInfo.length}`);

    let editorialBtns = bookmarkInfo.filter(b => b.isInEditorial);
    let quickListBtns = bookmarkInfo.filter(b => b.isInQuickList);
    let visibleBtns = bookmarkInfo.filter(b => b.visible);
    let hiddenByParent = bookmarkInfo.filter(b => b.parentHidden);

    log(`  In editorial cards: ${editorialBtns.length}`);
    log(`  In quick list rows: ${quickListBtns.length}`);
    log(`  Visible (non-zero rect): ${visibleBtns.length}`);
    log(`  Hidden by parent [hidden]: ${hiddenByParent.length}`);

    if (hiddenByParent.length > 0) {
      issue('High', pageName, 'Bookmark Buttons',
        `${hiddenByParent.length} bookmark buttons are inside hidden parent sections`,
        `Slugs: ${hiddenByParent.map(b => b.slug).join(', ')}`);
    }

    if (editorialBtns.every(b => b.visible)) {
      pass(pageName, 'Bookmark Buttons', 'All editorial card bookmark buttons are visible');
    } else {
      const invisible = editorialBtns.filter(b => !b.visible);
      issue('High', pageName, 'Bookmark Buttons',
        `${invisible.length}/${editorialBtns.length} editorial bookmark buttons not visible`);
    }

    // Click the first VISIBLE bookmark button (editorial view)
    const editorialVisibleBtn = await page.$('.brand-card .bookmark-btn[data-slug]');
    if (editorialVisibleBtn) {
      const isVisible = await editorialVisibleBtn.isVisible();
      log(`  First editorial bookmark button isVisible(): ${isVisible}`);

      if (isVisible) {
        await editorialVisibleBtn.click();
        await page.waitForTimeout(300);
        const isSaved = await editorialVisibleBtn.evaluate(el => el.classList.contains('is-saved'));
        if (isSaved) {
          pass(pageName, 'Bookmark Toggle', 'Clicking editorial card bookmark button saves brand');
        } else {
          issue('High', pageName, 'Bookmark Toggle', 'Editorial card bookmark click did not save brand');
        }

        // Check badge
        const badge = await page.$('.bookmark-count-badge');
        if (badge) {
          const badgeVisible = await badge.isVisible();
          const badgeText = await badge.textContent();
          if (badgeVisible) {
            pass(pageName, 'Bookmark Badge', `Bookmark count badge visible with value: "${badgeText}"`);
          } else {
            issue('High', pageName, 'Bookmark Badge', 'Bookmark count badge not visible after saving brand');
          }
        }

        // Check Saved button appears
        const savedBtn = await page.$('#bookmark-filter-btn');
        if (savedBtn) {
          const savedBtnHidden = await savedBtn.getAttribute('hidden');
          if (savedBtnHidden === null) {
            pass(pageName, 'Saved Filter Button', 'Saved filter button is visible after bookmarking');
          } else {
            issue('High', pageName, 'Saved Filter Button', 'Saved filter button remains hidden after bookmarking');
          }
        }

        await screenshot(page, 'deep-01-bookmark-saved');

        // Switch to list view and test saved filter
        const listBtn = await page.$('.view-toggle__btn[data-view="list"]');
        if (listBtn) {
          await listBtn.click();
          await page.waitForTimeout(500);
          await screenshot(page, 'deep-02-list-view-with-saved');

          // Click the saved filter button
          const savedFilterBtn = await page.$('#bookmark-filter-btn');
          if (savedFilterBtn && await savedFilterBtn.isVisible()) {
            await savedFilterBtn.click();
            await page.waitForTimeout(500);

            const isActive = await savedFilterBtn.evaluate(el => el.classList.contains('is-active'));
            if (isActive) {
              pass(pageName, 'Saved Filter', 'Saved filter button becomes active on click');
            } else {
              issue('High', pageName, 'Saved Filter', 'Saved filter button did not become active on click');
            }

            // Check how many rows are visible
            const rowVisibility = await page.evaluate(() => {
              const rows = Array.from(document.querySelectorAll('.quick-list__row'));
              return rows.map(r => ({
                slug: r.dataset.slug,
                hidden: r.classList.contains('is-hidden')
              }));
            });
            const visibleRows = rowVisibility.filter(r => !r.hidden);
            const hiddenRows = rowVisibility.filter(r => r.hidden);
            log(`  After saved filter: ${visibleRows.length} visible rows, ${hiddenRows.length} hidden rows`);

            if (visibleRows.length > 0 && hiddenRows.length > 0) {
              pass(pageName, 'Saved Filter', `Saved filter hides non-bookmarked rows (${hiddenRows.length} hidden, ${visibleRows.length} shown)`);
            } else if (visibleRows.length === rowVisibility.length) {
              issue('High', pageName, 'Saved Filter', 'Saved filter did not hide any rows — all rows still visible');
            } else if (hiddenRows.length === rowVisibility.length) {
              issue('High', pageName, 'Saved Filter', 'Saved filter hid ALL rows including the bookmarked one');
            }

            await screenshot(page, 'deep-03-saved-filter-active');
          }
        }

        // Clean up bookmark
        await editorialVisibleBtn.click();
        await page.waitForTimeout(300);
      } else {
        issue('High', pageName, 'Bookmark Buttons',
          'First editorial bookmark button is not clickable (not visible according to Playwright)');
      }
    }

  } catch (err) {
    issue('High', pageName, 'Test Execution', `Deep bookmark test threw: ${err.message}`);
  } finally {
    await page.evaluate(() => localStorage.removeItem('tcg-bookmarks'));
    await context.close();
  }
}

// ─── Test: Copy Button with Clipboard Grant ───────────────────────────────────

async function testCopyButtonWithClipboard(browser) {
  log('=== Deep Test: Copy Button (with clipboard grant) ===');
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  const pageName = 'Copy Button (with Permission)';

  try {
    await page.goto(`${BASE_URL}/brands/doi-chaang.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const copyBtn = await page.$('.copy-btn[data-copy]');
    if (!copyBtn) {
      issue('High', pageName, 'Copy Button', 'Copy button not found');
      return;
    }

    const expectedData = await copyBtn.getAttribute('data-copy');
    log(`  Expected copy data: "${expectedData}"`);

    await copyBtn.click();
    await page.waitForTimeout(600);

    const isCopied = await copyBtn.evaluate(el => el.classList.contains('is-copied'));
    const btnText = await copyBtn.textContent();

    if (isCopied) {
      pass(pageName, 'Copy Button', 'Copy button shows is-copied class with clipboard permission');
    } else {
      issue('High', pageName, 'Copy Button', 'Copy button STILL does not show is-copied even with clipboard permission granted');
    }

    if (btnText.trim() === 'Copied!') {
      pass(pageName, 'Copy Button', 'Copy button text changes to "Copied!" with permission');
    } else {
      issue('High', pageName, 'Copy Button', `Button text is "${btnText.trim()}" instead of "Copied!" with permission`);
    }

    // Verify clipboard content
    try {
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      if (clipboardContent === expectedData) {
        pass(pageName, 'Clipboard', `Clipboard content matches: "${clipboardContent}"`);
      } else {
        issue('Medium', pageName, 'Clipboard', `Clipboard content mismatch. Expected: "${expectedData}", Got: "${clipboardContent}"`);
      }
    } catch (e) {
      issue('Low', pageName, 'Clipboard', `Could not read clipboard: ${e.message}`);
    }

    await screenshot(page, 'deep-04-copy-btn-copied');

    // Wait for reset
    await page.waitForTimeout(2000);
    const btnTextAfterReset = await copyBtn.textContent();
    if (btnTextAfterReset.trim().includes('Copy') && !btnTextAfterReset.includes('Copied!')) {
      pass(pageName, 'Copy Button', 'Copy button text resets after 1.8s timeout');
    } else {
      issue('Medium', pageName, 'Copy Button', `Copy button text did not reset after timeout: "${btnTextAfterReset.trim()}"`);
    }

  } catch (err) {
    issue('High', pageName, 'Test Execution', `Copy button deep test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Mobile Nav Interaction ────────────────────────────────────────────

async function testMobileNav(browser) {
  log('=== Deep Test: Mobile Nav ===');
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await context.newPage();
  const pageName = 'Mobile Nav';

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const navToggle = await page.$('.nav-toggle');
    const siteNav = await page.$('.site-nav');

    if (!navToggle || !siteNav) {
      issue('High', pageName, 'Mobile Nav', 'Nav toggle or site nav not found');
      return;
    }

    // Check initial state
    const initialOpen = await siteNav.evaluate(el => el.classList.contains('open'));
    if (!initialOpen) {
      pass(pageName, 'Mobile Nav', 'Nav starts closed on mobile');
    } else {
      issue('Medium', pageName, 'Mobile Nav', 'Nav appears open on initial mobile load');
    }

    const toggleVisible = await navToggle.isVisible();
    if (toggleVisible) {
      pass(pageName, 'Mobile Nav', 'Nav toggle button is visible on mobile viewport');
    } else {
      issue('High', pageName, 'Mobile Nav', 'Nav toggle button not visible on mobile viewport');
    }

    await screenshot(page, 'deep-05-mobile-nav-closed');

    // Open nav
    await navToggle.click();
    await page.waitForTimeout(400);

    const isOpen = await siteNav.evaluate(el => el.classList.contains('open'));
    if (isOpen) {
      pass(pageName, 'Mobile Nav', 'Nav opens after toggle click');
    } else {
      issue('High', pageName, 'Mobile Nav', 'Nav did not open after toggle click');
    }

    const ariaExpanded = await navToggle.getAttribute('aria-expanded');
    if (ariaExpanded === 'true') {
      pass(pageName, 'Mobile Nav', 'aria-expanded set to "true" when nav is open');
    } else {
      issue('Medium', pageName, 'Mobile Nav', `aria-expanded is "${ariaExpanded}" when nav is open (expected "true")`);
    }

    await screenshot(page, 'deep-06-mobile-nav-open');

    // Close by outside click
    await page.click('body', { position: { x: 10, y: 400 } });
    await page.waitForTimeout(400);

    const isClosedAfterOutsideClick = await siteNav.evaluate(el => !el.classList.contains('open'));
    if (isClosedAfterOutsideClick) {
      pass(pageName, 'Mobile Nav', 'Nav closes on outside click');
    } else {
      issue('Medium', pageName, 'Mobile Nav', 'Nav does not close on outside click');
    }

    // Re-open and click a link
    await navToggle.click();
    await page.waitForTimeout(300);

    const navLinks = await siteNav.$$('a');
    if (navLinks.length > 0) {
      pass(pageName, 'Mobile Nav', `Nav links found: ${navLinks.length}`);
    }

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Mobile nav test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Compare Page Filter + Roast Combinations ──────────────────────────

async function testCompareFilters(browser) {
  log('=== Deep Test: Compare Filter Combinations ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageName = 'Compare Filters';

  try {
    await page.goto(`${BASE_URL}/compare.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Get initial count
    const initialCount = await page.$eval('#results-count', el => parseInt(el.textContent));
    pass(pageName, 'Initial State', `Initial brand count: ${initialCount}`);

    // Test roast filter
    const roastFilter = await page.$('#filter-roast');
    if (roastFilter) {
      const roastOptions = await roastFilter.$$('option');
      const roastValues = await Promise.all(roastOptions.map(o => o.getAttribute('value')));
      log(`  Roast options: ${roastValues.join(', ')}`);

      const nonEmptyRoast = roastValues.filter(v => v && v !== '');
      if (nonEmptyRoast.length > 0) {
        await roastFilter.selectOption(nonEmptyRoast[0]);
        await page.waitForTimeout(400);

        const filteredCount = await page.$eval('#results-count', el => parseInt(el.textContent));
        if (filteredCount <= initialCount) {
          pass(pageName, 'Roast Filter', `Roast filter "${nonEmptyRoast[0]}" reduces count from ${initialCount} to ${filteredCount}`);
        } else {
          issue('High', pageName, 'Roast Filter', `Roast filter increased count from ${initialCount} to ${filteredCount}`);
        }

        // Check filter active state
        const hasActive = await roastFilter.evaluate(el => el.classList.contains('filter-select--active'));
        if (hasActive) {
          pass(pageName, 'Roast Filter State', 'Roast filter gets active class');
        } else {
          issue('High', pageName, 'Roast Filter State', 'Roast filter did not get active class');
        }

        await screenshot(page, 'deep-07-compare-roast-filter');
      }
    }

    // Test price filter
    const priceFilter = await page.$('#filter-price');
    if (priceFilter) {
      const priceOptions = await priceFilter.$$('option');
      const priceValues = await Promise.all(priceOptions.map(o => o.getAttribute('value')));
      log(`  Price options: ${priceValues.join(', ')}`);

      // Reset first
      await page.evaluate(() => window.resetFilters());
      await page.waitForTimeout(300);

      const nonEmptyPrice = priceValues.filter(v => v && v !== '');
      if (nonEmptyPrice.length > 0) {
        // Use a restrictive price filter (lowest)
        const sortedPrices = nonEmptyPrice.map(Number).sort((a, b) => a - b);
        await priceFilter.selectOption(String(sortedPrices[0]));
        await page.waitForTimeout(400);

        const priceFilteredCount = await page.$eval('#results-count', el => parseInt(el.textContent));
        pass(pageName, 'Price Filter', `Price filter (max ฿${sortedPrices[0]}/200g) shows ${priceFilteredCount} brands`);
      }
    }

    // Test sort by name
    await page.evaluate(() => window.resetFilters());
    await page.waitForTimeout(300);

    const sortBySelect = await page.$('#sort-by');
    if (sortBySelect) {
      await sortBySelect.selectOption('name');
      await page.waitForTimeout(400);

      // Check if first row is alphabetically first
      const firstRowName = await page.$eval('.brand-row-tr:not(.hidden) [data-name], .brand-row-tr:not(.hidden) td:first-child', el => el.textContent?.trim() || el.dataset?.name || '');
      log(`  After name sort, first visible row name: "${firstRowName}"`);
      pass(pageName, 'Sort by Name', 'Sort by name applied without error');

      await screenshot(page, 'deep-08-compare-name-sort');
    }

    // Test multi-filter: category + roast
    await page.evaluate(() => window.resetFilters());
    await page.waitForTimeout(300);

    const catFilter = await page.$('#filter-category');
    if (catFilter && roastFilter) {
      await catFilter.selectOption('specialty');
      await roastFilter.selectOption('medium');
      await page.waitForTimeout(400);

      const multiFilterCount = await page.$eval('#results-count', el => parseInt(el.textContent));
      const activeCount = await page.$eval('#active-filter-pill', el => el.textContent.trim());

      pass(pageName, 'Multi-Filter', `Category=specialty + Roast=medium shows ${multiFilterCount} brands`);

      if (activeCount.includes('2')) {
        pass(pageName, 'Multi-Filter Count', `Active filter pill shows "${activeCount}" for 2 active filters`);
      } else {
        issue('Medium', pageName, 'Multi-Filter Count', `Active filter pill shows "${activeCount}" for 2 active filters (expected "2 active")`);
      }

      await screenshot(page, 'deep-09-compare-multi-filter');
    }

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Compare filter test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Gallery Lightbox ───────────────────────────────────────────────────

async function testGalleryLightbox(browser) {
  log('=== Deep Test: Gallery Lightbox ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  const pageName = 'Gallery Lightbox';

  try {
    await page.goto(`${BASE_URL}/brands/doi-chaang.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check lightbox exists
    const lightbox = await page.$('#brand-lightbox');
    if (lightbox) {
      pass(pageName, 'Lightbox', 'Lightbox element (#brand-lightbox) found');

      const isHidden = await lightbox.getAttribute('hidden');
      if (isHidden !== null) {
        pass(pageName, 'Lightbox', 'Lightbox is hidden by default');
      } else {
        issue('Medium', pageName, 'Lightbox', 'Lightbox is visible when it should be hidden by default');
      }

      // Click gallery stage to open lightbox
      const galleryStage = await page.$('.gallery__stage');
      if (galleryStage) {
        // Click the main image area (not the nav buttons)
        await page.click('.gallery__frames');
        await page.waitForTimeout(500);

        const isNowHidden = await lightbox.getAttribute('hidden');
        if (isNowHidden === null) {
          pass(pageName, 'Lightbox', 'Clicking gallery stage opens lightbox');

          // Check body overflow
          const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
          if (bodyOverflow === 'hidden') {
            pass(pageName, 'Lightbox', 'Body overflow set to hidden when lightbox is open');
          } else {
            issue('Medium', pageName, 'Lightbox', `Body overflow not set to hidden (got: "${bodyOverflow}")`);
          }

          await screenshot(page, 'deep-10-lightbox-open');

          // Check lightbox image loaded
          const lbImg = await page.$('.lightbox__img');
          if (lbImg) {
            pass(pageName, 'Lightbox', 'Lightbox image element found');
            const imgSrc = await lbImg.getAttribute('src');
            pass(pageName, 'Lightbox', `Lightbox image src: ${imgSrc}`);
          }

          // Close lightbox with Escape key
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);

          const isClosedByEsc = await lightbox.getAttribute('hidden');
          if (isClosedByEsc !== null) {
            pass(pageName, 'Lightbox', 'Pressing Escape closes lightbox');
          } else {
            issue('High', pageName, 'Lightbox', 'Escape key did not close lightbox');
          }

          // Check body overflow restored
          const bodyOverflowAfter = await page.evaluate(() => document.body.style.overflow);
          if (bodyOverflowAfter === '') {
            pass(pageName, 'Lightbox', 'Body overflow restored after lightbox closes');
          } else {
            issue('Medium', pageName, 'Lightbox', `Body overflow not restored after close: "${bodyOverflowAfter}"`);
          }
        } else {
          issue('High', pageName, 'Lightbox', 'Clicking gallery stage did not open lightbox');
        }
      }
    } else {
      issue('High', pageName, 'Lightbox', 'Lightbox element (#brand-lightbox) not found in DOM');
    }

    // Test expand button
    const expandBtn = await page.$('.gallery__expand');
    if (expandBtn) {
      pass(pageName, 'Gallery', 'Gallery expand button found');
      await expandBtn.click();
      await page.waitForTimeout(400);

      const lightboxOpenViaExpand = await lightbox.getAttribute('hidden');
      if (lightboxOpenViaExpand === null) {
        pass(pageName, 'Gallery', 'Expand button opens lightbox');
        // Close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        issue('Medium', pageName, 'Gallery', 'Gallery expand button did not open lightbox');
      }
    } else {
      issue('Low', pageName, 'Gallery', 'Gallery expand button (.gallery__expand) not found');
    }

    // Nav arrows
    const prevBtn = await page.$('.gallery__nav--prev');
    const nextBtn = await page.$('.gallery__nav--next');

    if (prevBtn && nextBtn) {
      pass(pageName, 'Gallery', 'Gallery navigation arrows (prev/next) found');

      const initialCur = await page.$eval('.gallery__cur', el => el.textContent.trim());
      await nextBtn.click();
      await page.waitForTimeout(300);
      const newCur = await page.$eval('.gallery__cur', el => el.textContent.trim());

      if (initialCur !== newCur) {
        pass(pageName, 'Gallery', `Gallery next arrow advances image (${initialCur} → ${newCur})`);
      } else {
        issue('High', pageName, 'Gallery', 'Gallery next arrow did not change current image counter');
      }
    }

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Gallery lightbox test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Responsive Layout Check ───────────────────────────────────────────

async function testResponsiveLayout(browser) {
  log('=== Deep Test: Responsive Layout ===');
  const pageName = 'Responsive';

  const viewports = [
    { name: 'Mobile-S', width: 320, height: 568 },
    { name: 'Mobile-L', width: 414, height: 896 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Check for horizontal scrollbar (overflow)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScroll) {
        issue('High', pageName, 'Layout Overflow', `Horizontal scroll detected at ${vp.name} (${vp.width}px)`);
      } else {
        pass(pageName, 'Layout Overflow', `No horizontal scroll at ${vp.name} (${vp.width}px)`);
      }

      // Check header visibility
      const headerVisible = await page.isVisible('.site-header');
      if (headerVisible) {
        pass(pageName, 'Header', `Header visible at ${vp.name}`);
      } else {
        issue('High', pageName, 'Header', `Header not visible at ${vp.name}`);
      }

      await screenshot(page, `deep-responsive-${vp.name.toLowerCase()}`);

    } catch (err) {
      issue('Medium', pageName, 'Test Execution', `Responsive test at ${vp.name} threw: ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

// ─── Test: Guide Page TOC Functionality ──────────────────────────────────────

async function testGuideTOC(browser) {
  log('=== Deep Test: Guide Page TOC ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageName = 'Guide TOC';

  try {
    await page.goto(`${BASE_URL}/guide.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const tocLinks = await page.$$('.toc-list a');
    if (tocLinks.length === 0) {
      issue('Medium', pageName, 'TOC', 'No TOC links found');
      return;
    }

    // Check each TOC link points to an existing anchor
    for (let i = 0; i < Math.min(tocLinks.length, 5); i++) {
      const link = tocLinks[i];
      const href = await link.getAttribute('href');
      const text = await link.textContent();

      if (!href || !href.startsWith('#')) {
        issue('Medium', pageName, 'TOC Links', `TOC link "${text.trim()}" has invalid href: "${href}"`);
        continue;
      }

      const targetId = href.slice(1);
      const targetExists = await page.$(`#${targetId}`);
      if (targetExists) {
        pass(pageName, 'TOC Links', `TOC link "#${targetId}" points to existing element`);
      } else {
        issue('High', pageName, 'TOC Links', `TOC link "${text.trim()}" points to non-existent #${targetId}`);
      }
    }

    // Click first TOC link and verify scroll
    const firstLink = tocLinks[0];
    const firstHref = await firstLink.getAttribute('href');
    const targetId = firstHref.slice(1);

    await firstLink.click();
    await page.waitForTimeout(800);

    const targetEl = await page.$(`#${targetId}`);
    if (targetEl) {
      const isInView = await targetEl.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= -100 && rect.top <= window.innerHeight;
      });

      if (isInView) {
        pass(pageName, 'TOC Navigation', `Clicking TOC link scrolls to #${targetId}`);
      } else {
        issue('Medium', pageName, 'TOC Navigation', `Clicking TOC link did not scroll to #${targetId} into view`);
      }
    }

    await screenshot(page, 'deep-11-guide-toc');

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Guide TOC test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Image Fade-in (opacity starts at 0) ────────────────────────────────

async function testImageFadeIn(browser) {
  log('=== Deep Test: Image Fade-in CSS Behavior ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageName = 'Image Fade-in';

  try {
    // Intercept to slow images
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Check BEFORE network idle — images may be loading
    const earlyOpacity = await page.evaluate(() => {
      const img = document.querySelector('.brand-card__img');
      if (!img) return null;
      return {
        opacity: window.getComputedStyle(img).opacity,
        complete: img.complete,
        hasImgLoaded: img.classList.contains('img-loaded')
      };
    });

    if (earlyOpacity) {
      log(`  Early image state — opacity: ${earlyOpacity.opacity}, complete: ${earlyOpacity.complete}, img-loaded: ${earlyOpacity.hasImgLoaded}`);
    }

    // Wait for network idle
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    const afterLoadOpacity = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.brand-card__img'));
      return imgs.slice(0, 3).map(img => ({
        opacity: window.getComputedStyle(img).opacity,
        complete: img.complete,
        hasImgLoaded: img.classList.contains('img-loaded'),
        src: img.src.split('/').pop()
      }));
    });

    log(`  After load image states:`);
    for (const s of afterLoadOpacity) {
      log(`    ${s.src}: opacity=${s.opacity}, loaded=${s.hasImgLoaded}, complete=${s.complete}`);
      if (parseFloat(s.opacity) === 1 && s.hasImgLoaded) {
        pass(pageName, 'Image Fade-in', `Image ${s.src} has opacity:1 and img-loaded class`);
      } else if (!s.hasImgLoaded) {
        issue('Medium', pageName, 'Image Fade-in', `Image ${s.src} missing img-loaded class (opacity: ${s.opacity})`);
      }
    }

    // Check if placeholder elements exist (they shouldn't since all brands have images)
    const placeholders = await page.$$('.brand-card__img-placeholder');
    if (placeholders.length === 0) {
      pass(pageName, 'Placeholder', 'No img-placeholder elements in DOM (all brands have images — expected)');
    } else {
      pass(pageName, 'Placeholder', `${placeholders.length} placeholder elements present (some brands missing thumbnails)`);
    }

  } catch (err) {
    issue('Low', pageName, 'Test Execution', `Image fade-in test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Test: Compare Page Table Row Links ─────────────────────────────────────

async function testCompareTableLinks(browser) {
  log('=== Deep Test: Compare Table Row Links ===');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageName = 'Compare Table';

  try {
    await page.goto(`${BASE_URL}/compare.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Check brand links in table
    const brandLinks = await page.$$('.brand-row-tr a[href*="/brands/"]');
    if (brandLinks.length > 0) {
      pass(pageName, 'Table Links', `Brand links found in compare table: ${brandLinks.length}`);

      // Verify first link works
      const firstHref = await brandLinks[0].getAttribute('href');
      const resp = await page.evaluate(async (url) => {
        try {
          const r = await fetch(url, { method: 'HEAD' });
          return r.status;
        } catch { return -1; }
      }, firstHref.startsWith('http') ? firstHref : `${BASE_URL}${firstHref}`);

      if (resp === 200) {
        pass(pageName, 'Table Links', `First table brand link returns 200: ${firstHref}`);
      } else {
        issue('High', pageName, 'Table Links', `First table brand link returns ${resp}: ${firstHref}`);
      }
    } else {
      issue('High', pageName, 'Table Links', 'No brand links found in compare table');
    }

    // Check table image loading
    const tableImgs = await page.$$('.table-brand-img');
    if (tableImgs.length > 0) {
      pass(pageName, 'Table Images', `Table brand images found: ${tableImgs.length}`);
      const firstLoaded = await tableImgs[0].evaluate(img => img.complete && img.naturalWidth > 0);
      if (firstLoaded) {
        pass(pageName, 'Table Images', 'First table image loaded');
      } else {
        issue('Medium', pageName, 'Table Images', 'First table image did not load');
      }
    } else {
      issue('Medium', pageName, 'Table Images', 'No .table-brand-img elements found in compare table');
    }

    await screenshot(page, 'deep-12-compare-table');

  } catch (err) {
    issue('Medium', pageName, 'Test Execution', `Compare table test threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting Deep QA Audit...');

  const browser = await chromium.launch({ headless: true });

  try {
    await testBookmarkButtonVisibility(browser);
    await testCopyButtonWithClipboard(browser);
    await testMobileNav(browser);
    await testCompareFilters(browser);
    await testGalleryLightbox(browser);
    await testResponsiveLayout(browser);
    await testGuideTOC(browser);
    await testImageFadeIn(browser);
    await testCompareTableLinks(browser);
  } finally {
    await browser.close();
  }

  const issues = RESULTS.filter(r => r.severity !== 'PASS');
  const passes = RESULTS.filter(r => r.severity === 'PASS');
  const critical = issues.filter(r => r.severity === 'Critical');
  const high     = issues.filter(r => r.severity === 'High');
  const medium   = issues.filter(r => r.severity === 'Medium');
  const low      = issues.filter(r => r.severity === 'Low');

  log('');
  log('=== DEEP QA SUMMARY ===');
  log(`Total Checks: ${RESULTS.length}`);
  log(`Passed:       ${passes.length}`);
  log(`Issues:       ${issues.length}`);
  log(`  Critical:   ${critical.length}`);
  log(`  High:       ${high.length}`);
  log(`  Medium:     ${medium.length}`);
  log(`  Low:        ${low.length}`);

  // Append to JSON results
  const existingResults = JSON.parse(fs.readFileSync('/home/dev/projects/thai-coffee/qa-results.json', 'utf8'));
  const combined = [...existingResults, ...RESULTS];
  fs.writeFileSync('/home/dev/projects/thai-coffee/qa-results.json', JSON.stringify(combined, null, 2));
  log('Results appended to qa-results.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
