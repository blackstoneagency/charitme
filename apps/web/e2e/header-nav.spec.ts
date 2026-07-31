import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// The header mega-menus, pinned by HIT-TESTING rather than by looking at boxes.
//
// This exists because the bug it guards against is invisible to every other
// check. #98 shipped a nav that overlapped `.kind-auth`: nothing overflowed,
// nothing looked wrong, and three links were simply unclickable on every page.
// The same shape recurred while building these dropdowns — `.kind-header nav a`
// styled the panel links too (they render inside <nav>), and `white-space:
// nowrap` stretched each Resources link to 478px inside a 200px column so it
// covered the next column. 4 of 12 links were unreachable at every desktop
// width, and the panel screenshot looked completely normal.
//
// So the assertion is `document.elementFromPoint` at each control's own centre:
// the one question that actually matters is "if a user clicks this, do they hit
// it?" A bounding-box check answers a different question and passes.
// ─────────────────────────────────────────────────────────────────────────────

/** Below this the nav collapses to the hamburger; see the 1101–1199px block. */
const DESKTOP_WIDTHS = [1280, 1366, 1440, 1920];

type Probe = { obscured: string[]; tooSmall: string[]; overflow: number; controls: number };

async function probeHeader(page: import('@playwright/test').Page): Promise<Probe> {
  return page.evaluate(() => {
    const header = document.querySelector('.kind-header')!;
    const controls = [...header.querySelectorAll('nav a, nav button, .kind-auth a, .kind-auth button')];
    const obscured: string[] = [];
    const tooSmall: string[] = [];

    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const name = (el.textContent || el.getAttribute('aria-label') || '?').trim().slice(0, 24);

      // WCAG 2.2 AA target-size (2.5.8).
      if (r.height < 24) tooSmall.push(`${name} h=${r.height.toFixed(1)}`);

      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !el.contains(top) && !top.contains(el)) {
        obscured.push(`${name} covered by ${(top.className || top.tagName).toString().split(' ')[0]}`);
      }
    }

    const container = header.querySelector('.container')!;
    return {
      obscured,
      tooSmall,
      overflow: container.scrollWidth - container.clientWidth,
      controls: controls.length,
    };
  });
}

for (const width of DESKTOP_WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`header bar is clickable and correctly sized at ${width}px (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

      const r = await probeHeader(page);

      // A probe that found nothing would also report no problems.
      expect(r.controls, 'header controls found').toBeGreaterThan(5);
      expect(r.obscured, `controls painted under something at ${width}px`).toEqual([]);
      expect(r.tooSmall, `controls below the 24px WCAG 2.2 target size at ${width}px`).toEqual([]);
      expect(r.overflow, 'header container overflows horizontally').toBe(0);
    });
  }
}

for (const width of DESKTOP_WIDTHS) {
  for (const menu of ['Explore Causes', 'Resources'] as const) {
    test(`${menu} dropdown is fully reachable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const trigger = page.locator('.kind-menu-trigger', { hasText: menu });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const r = await page.evaluate(() => {
        const panel = document.querySelector('.kind-menu-panel');
        if (!panel) return null;
        const b = panel.getBoundingClientRect();
        const links = [...panel.querySelectorAll('a')];
        const unreachable = links
          .filter((a) => {
            const lr = a.getBoundingClientRect();
            const top = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
            return !top || (!a.contains(top) && !top.contains(a));
          })
          .map((a) => (a.textContent || '').trim().slice(0, 30));
        return { offLeft: b.left < 0, offRight: b.right > window.innerWidth, links: links.length, unreachable };
      });

      expect(r, 'panel did not render').not.toBeNull();
      expect(r!.links, 'panel rendered no links').toBeGreaterThan(5);
      expect(r!.offLeft, 'panel runs off the left edge').toBe(false);
      expect(r!.offRight, 'panel runs off the right edge').toBe(false);
      expect(r!.unreachable, 'links that cannot be clicked where they are drawn').toEqual([]);
    });
  }
}

test('Escape closes the dropdown and returns focus to its trigger', async ({ page }) => {
  // Escape that drops focus to the top of the document strands a keyboard user
  // partway through the header, so the focus return is part of the contract.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const trigger = page.locator('.kind-menu-trigger', { hasText: 'Resources' });
  await trigger.click();
  await expect(page.locator('.kind-menu-panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.kind-menu-panel')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('the dropdown is operable by keyboard alone', async ({ page }) => {
  // Hover is an enhancement; the menu must work without a pointer.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const trigger = page.locator('.kind-menu-trigger', { hasText: 'Explore Causes' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.kind-menu-panel')).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

test('closed dropdowns keep their links out of the tab order', async ({ page }) => {
  // Keeping the panels mounted and hidden with CSS would leave ~34 extra tab
  // stops in the header of every page on the site.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.kind-menu-panel')).toHaveCount(0);
});

test('navigating closes an open dropdown', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await page.locator('.kind-menu-trigger', { hasText: 'Resources' }).click();
  await page.locator('.kind-menu-panel a', { hasText: 'Fundraising Guide' }).click();

  await expect(page).toHaveURL(/\/fundraising-guide$/);
  // A panel left open across a route change hangs over the new page.
  await expect(page.locator('.kind-menu-panel')).toHaveCount(0);
});
