import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import mqtt from 'mqtt';
const API = 'http://127.0.0.1:4018';
test.describe.configure({ mode: 'serial' });
let browserErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
});
test.afterEach(() => {
  expect(browserErrors).toEqual([]);
});
test.beforeEach(async ({ request }) => {
  await expect
    .poll(async () => (await (await request.get(`${API}/api/simulator`)).json()).available)
    .toBe(true);
  const response = await request.post(`${API}/api/simulator`, {
    data: { running: true, scenario: 'normal', intervalMs: 250 },
  });
  expect(response.ok()).toBe(true);
});
test('complete simulator → MQTT → database → alerts → realtime dashboard lifecycle', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('.connection')).toHaveText(/Live feed connected/);
  await expect(page.getByRole('button', { name: /Ridge North/ })).toBeVisible();
  const initial = (await (await request.get(`${API}/api/summary`)).json()).readingCount;
  await page.getByRole('link', { name: 'Simulator', exact: true }).click();
  await page.getByLabel('Test scenario').focus();
  await page.getByLabel('Test scenario').press('Alt+ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Test scenario')).toBeFocused();
  await page.getByLabel('Test scenario').selectOption('high-gas');
  await page.getByLabel('Publish interval (ms)').fill('250');
  await page.getByRole('button', { name: 'Apply and start' }).click();
  await expect(
    page.getByText('Simulator confirmed: publishing with the selected scenario.'),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${API}/api/alerts?state=OPEN`)).json()).filter(
          (a: { metric: string }) => a.metric === 'gasPpm',
        ).length,
    )
    .toBeGreaterThan(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Alerts/ })
    .click();
  await expect(page.getByRole('button', { name: 'Acknowledge' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Acknowledge' }).first().click();
  await expect(page.getByText('acknowledged', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'View history' }).first().click();
  await expect(page.getByText(/acknowledge ·/).first()).toBeVisible();
  await page.getByRole('link', { name: 'Simulator', exact: true }).click();
  await page.getByLabel('Test scenario').selectOption('normal');
  await page.getByRole('button', { name: 'Apply and start' }).click();
  await expect
    .poll(async () => (await (await request.get(`${API}/api/alerts?state=OPEN`)).json()).length)
    .toBe(0);
  await expect
    .poll(async () => (await (await request.get(`${API}/api/summary`)).json()).readingCount)
    .toBeGreaterThan(initial);
  const readings = await (await request.get(`${API}/api/nodes/node-01/readings?limit=1`)).json();
  expect(readings[0].soilMoisturePct).toBeGreaterThan(0);
  expect(readings[0].waterLevelCm).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause publishing' }).click();
  await expect(page.getByText('Simulator confirmed: publishing paused.')).toBeVisible();
});
test('device naming validates, persists and survives navigation', async ({ page, request }) => {
  await page.goto('/#devices');
  await expect(page.getByLabel('Display name')).toBeVisible();
  await page.getByRole('button', { name: /Ridge North/ }).click();
  await page.getByLabel('Display name').fill('');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Enter a device name from 1 to 100 characters.')).toBeVisible();
  await page.getByLabel('Display name').fill('QA field station');
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await page.getByRole('link', { name: 'Devices', exact: true }).click();
  await expect(page.getByLabel('Display name')).toHaveValue('QA field station');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Device name saved.')).toBeVisible();
  expect((await (await request.get(`${API}/api/nodes/node-01`)).json()).name).toBe(
    'QA field station',
  );
});
test('history exports measured data and all views remain usable at narrow width', async ({
  page,
}) => {
  await page.goto('/#history');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  await page.locator('#history-node').selectOption('node-01');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toContain('sahapul-node-01');
  await page.screenshot({ path: 'docs/screenshots/history-desktop.png', fullPage: true });
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of [
    'Overview',
    'Devices',
    'Analytics',
    'Alerts',
    'History',
    'Simulator',
    'Settings',
  ]) {
    const link = page.getByRole('navigation').getByRole('link', { name: new RegExp(name) });
    await link.click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.getByLabel('Compact station rows').check();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.getByRole('heading', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/screenshots/settings-mobile.png', fullPage: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(
    page.getByText('Base map unavailable. Station markers and the station list remain usable.'),
  ).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/overview-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'docs/screenshots/overview-desktop.png', fullPage: true });
});
test('failure, retry, loading and empty states are explicit', async ({ page }) => {
  await page.route(`${API}/api/nodes`, (route) =>
    route.fulfill({ status: 503, json: { error: 'Test service unavailable' } }),
  );
  await page.goto('/');
  await expect(page.getByText('Test service unavailable')).toBeVisible();
  await page.unroute(`${API}/api/nodes`);
  await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /QA field station/ })).toBeVisible();
  await page.route(`${API}/api/nodes/*/readings?*`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: [] });
  });
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByText('Loading observations…')).toBeVisible();
  await expect(
    page.getByText('Choose another window or wait for live observations.'),
  ).toBeVisible();
});
test('new devices appear through realtime events, and reconnect reconciles history', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const client = await mqtt.connectAsync('mqtt://127.0.0.1:18883');
  try {
    await client.publishAsync(
      'lora/browser-new/meta',
      JSON.stringify({
        nodeId: 'browser-new',
        name: 'Realtime arrival',
        lat: 49.98,
        lng: -119.4,
        installedAt: new Date().toISOString(),
      }),
      { qos: 1 },
    );
    await expect(page.getByRole('button', { name: /Realtime arrival/ })).toBeVisible();
    await client.publishAsync(
      'lora/spoofed/meta',
      JSON.stringify({
        nodeId: 'spoof-attempt',
        name: 'Invalid association',
        lat: 0,
        lng: 0,
        installedAt: new Date().toISOString(),
      }),
      { qos: 1 },
    );
    expect((await request.get(`${API}/api/nodes/spoof-attempt`)).status()).toBe(404);
    await page.context().setOffline(true);
    await expect(
      page.getByText(
        'Live feed disconnected. Showing available observations; reconnecting automatically.',
      ),
    ).toBeVisible();
    await page.context().setOffline(false);
    await expect(page.locator('.connection')).toHaveText(/Live feed connected/);
  } finally {
    await client.endAsync(true);
  }
});
test('settings and alerts pass automated accessibility checks and keyboard navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const view of ['settings', 'alerts']) {
    await page.goto(`/#${view}`);
    await expect(
      page.getByRole('heading', { name: view === 'settings' ? 'Settings' : 'Alerts', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Loading observations…')).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Alerts', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#alerts$/);
});

test('device inventory search and health filters provide clear, resettable results', async ({
  page,
  request,
}) => {
  const total = (await (await request.get(API + '/api/nodes')).json()).length;
  await page.goto('/#devices');
  await expect(page.getByRole('button', { name: /QA field station/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search devices' }).fill('QA FIELD');
  await expect(page.getByText(`1 of ${total} devices`)).toBeVisible();
  await page.getByRole('button', { name: 'Clear device search' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search devices' })).toBeFocused();
  await page.locator('#device-health').selectOption('offline');
  await expect(page.getByText('No matching devices')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByText(`${total} of ${total} devices`)).toBeVisible();
});
test('analytics uses range-aware backend statistics and handles missing windows', async ({
  page,
}) => {
  // Register the waiter before navigation so even a fast analytics response is captured.
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/analytics?') && response.status() === 200,
    ),
    page.goto('/#analytics'),
  ]);
  const data = await response.json();
  await expect(page.locator('.analytics-statistics>div').first().locator('strong')).toContainText(
    String(data.statistics.temperatureC.avg),
  );
  await page.locator('#analytics-range').selectOption('86400000');
  await page.getByRole('button', { name: 'Soil moisture', exact: true }).click();
  await expect(page.getByText(/15-minute averages/)).toBeVisible();
  await page.route(API + '/api/nodes/*/analytics?*', (route) =>
    route.fulfill({
      json: { nodeId: 'node-01', sampleCount: 0, buckets: [], statistics: {}, bucketMs: 900000 },
    }),
  );
  await page.getByRole('button', { name: 'Refresh analysis' }).click();
  await expect(
    page.getByText(
      'No observations in this time range. Choose another window or wait for telemetry.',
    ),
  ).toBeVisible();
});
test('pause remains available even when draft interval is invalid', async ({ page, request }) => {
  await page.goto('/#simulator');
  await expect(page.getByRole('button', { name: 'Pause publishing' })).toBeEnabled();
  await page.getByLabel('Publish interval (ms)').fill('1');
  await page.getByRole('button', { name: 'Pause publishing' }).click();
  await expect(page.getByText('Simulator confirmed: publishing paused.')).toBeVisible();
  const status = await (await request.get(API + '/api/simulator')).json();
  expect(status.running).toBe(false);
  expect(status.intervalMs).toBe(250);
});
test('system diagnostics, all main views, and screenshots reflect live backend data', async ({
  page,
  request,
}) => {
  const health = await (await request.get(API + '/api/health/ready')).json();
  expect(health.ready).toBe(true);
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible();
  await expect(page.getByText('Ready for telemetry', { exact: true })).toBeVisible();
  await expect(page.getByText('Enforced', { exact: true })).toBeVisible();
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
  for (const view of [
    'overview',
    'devices',
    'analytics',
    'alerts',
    'history',
    'simulator',
    'settings',
  ]) {
    await page.goto('/#' + view);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.loader')).toHaveCount(0);
    if (view === 'alerts') await page.locator('#alert-filter').selectOption('all');
    const results = await new AxeBuilder({ page })
      .exclude('.leaflet-container')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: 'docs/screenshots/' + view + '-desktop.png', fullPage: true });
  }
});
