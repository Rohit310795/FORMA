/**
 * End-to-end test of the FORMA app (web build) against the Firebase emulators
 * (Auth, Firestore, Functions, Storage). Run: npm run test:e2e:mobile
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:8081';
const email = `e2e${Date.now()}@example.test`;
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(`✔ ${name}`);
  } catch (err) {
    results.push(`✘ ${name}: ${err.message.split('\n').slice(0, 8).join(' | ')}`);
    throw err;
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('dialog', (d) => d.accept());
const byTest = (id) => page.getByTestId(id).locator('visible=true').first();
const btn = (name) => page.getByRole('button', { name, exact: true }).locator('visible=true').first();
const text = (t) => page.getByText(t, { exact: false }).locator('visible=true').first();

try {
  await step('welcome screen renders', async () => {
    await page.goto(BASE);
    await text('Stronger today').waitFor({ timeout: 30000 });
    await page.screenshot({ path: 'test-results/01-welcome.png' });
  });

  await step('sign up with email', async () => {
    await byTest('get-started').click();
    await byTest('name').fill('Alex');
    await byTest('email').fill(email);
    await byTest('password').fill('Passw0rd!long');
    await byTest('sign-up-submit').click();
    await text('Please accept').waitFor();
    await page.getByRole('switch').first().click();
    await byTest('sign-up-submit').click();
    await text('Step 1 of 5').waitFor({ timeout: 20000 });
  });

  await step('onboarding (goals, details, consent)', async () => {
    await text('Build muscle').click();
    await byTest('onboarding-next').click();
    await page.getByPlaceholder('YYYY-MM-DD').fill('1996-04-12');
    await page.getByLabel('Height (cm)').fill('172');
    await page.getByLabel('Current weight (kg)').fill('68');
    await byTest('onboarding-next').click();
    await text('Dumbbells').click();
    await text('Mon').click();
    await text('Wed').click();
    await text('Fri').click();
    await byTest('onboarding-next').click();
    await byTest('onboarding-next').click();
    await byTest('consent-health').click();
    await page.screenshot({ path: 'test-results/02-onboarding-privacy.png' });
    await byTest('onboarding-finish').click();
    await text('Good').waitFor({ timeout: 20000 });
    await text('Alex').waitFor();
    await page.screenshot({ path: 'test-results/03-home.png' });
  });

  await step('onboarding writes are accepted by Security Rules (outbox drains to Synced)', async () => {
    await text('Synced').waitFor({ timeout: 30000 });
  });

  await step('server config loaded (plan from backend)', async () => {
    await page.getByRole('tab', { name: /More/ }).or(text('More')).last().click();
    await text('Free plan').waitFor({ timeout: 20000 });
  });

  await step('build a plan from a template', async () => {
    await page.getByRole('tab', { name: /Workouts/ }).or(text('Workouts')).last().click();
    await btn('Build a plan').click();
    await text('Start from a template').waitFor({ timeout: 15000 });
    await byTest('template-home').click();
    await text('Edit plan').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Go back' }).locator('visible=true').first().click();
    await text('Weekly plan').waitFor({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/04-workouts.png' });
  });

  await step('log a live workout and finish it', async () => {
    await page.getByRole('button', { name: 'Start', exact: true }).locator('visible=true').first().click();
    await byTest('set-0-complete').waitFor({ timeout: 15000 });
    await byTest('set-0-complete').click();
    await text('Rest').waitFor();
    await page.screenshot({ path: 'test-results/05-live-workout.png' });
    for (let i = 0; i < 8; i++) {
      if (await byTest('finish-workout').isVisible()) break;
      await page.getByRole('button', { name: 'Next exercise' }).locator('visible=true').first().click();
    }
    await byTest('finish-workout').click();
    await byTest('save-workout').click();
    await text('Workout complete').waitFor({ timeout: 15000 });
    await text('Working sets').waitFor();
    await page.screenshot({ path: 'test-results/06-summary.png' });
    await page.getByRole('button', { name: 'Done' }).locator('visible=true').first().click();
    await text('Synced').waitFor({ timeout: 30000 });
  });

  await step('log food from the Indian starter database', async () => {
    await page.getByRole('tab', { name: /Nutrition/ }).or(text('Nutrition')).last().click();
    await byTest('log-meal').click();
    await page.getByLabel('Search foods').fill('dal');
    await text('Toor / arhar dal').click();
    await byTest('add-food').click();
    await text('Toor / arhar dal').waitFor();
    await page.screenshot({ path: 'test-results/07-nutrition.png' });
  });

  await step('recovery check-in and transparent estimate', async () => {
    await page.goto(`${BASE}/recovery/check-in`);
    await byTest('save-checkin').click();
    await page.goto(`${BASE}/recovery`);
    await text('How this is calculated').waitFor({ timeout: 15000 });
    await text('does not measure healing').waitFor();
    await page.screenshot({ path: 'test-results/08-recovery.png' });
  });

  await step('red-flag discomfort log → prompt professional assessment', async () => {
    await page.goto(`${BASE}/recovery/discomfort?joint=knee`);
    await page.getByRole('switch', { name: 'Locking or catching' }).click();
    await byTest('save-discomfort').click();
    await text('Get this checked by a professional soon').waitFor({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/09-knee-safety.png' });
  });

  await step('AI Coach degrades gracefully when no provider is configured', async () => {
    await page.goto(`${BASE}/coach`);
    await byTest('coach-input').fill('Make me a push day');
    await byTest('coach-send').click();
    await text('AI is temporarily unavailable').waitFor({ timeout: 30000 });
  });

  await step('AI Coach red-flag answer comes from the safety engine', async () => {
    await byTest('coach-input').fill('My knee locked and won’t straighten, what should I do?');
    await byTest('coach-send').click();
    await text('Safety first').waitFor({ timeout: 30000 });
    await page.screenshot({ path: 'test-results/10-coach.png' });
  });

  await step('session persists across reload', async () => {
    await page.reload();
    await page.goto(BASE);
    await text('Alex').waitFor({ timeout: 20000 });
  });

  await step('data export works', async () => {
    await page.goto(`${BASE}/settings/privacy`);
    const download = page.waitForEvent('download', { timeout: 20000 });
    await page.getByRole('button', { name: /Download my data/ }).click();
    const d = await download;
    const json = JSON.parse(await (await d.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
    assert.ok(Array.isArray(json.workoutSessions) && json.workoutSessions.length >= 1, 'export has the workout');
    assert.ok(json.nutritionLogs.length >= 1, 'export has nutrition');
  });

  await step('sign out and back in', async () => {
    await page.goto(`${BASE}/settings`);
    await byTest('sign-out').click();
    await text('Stronger today').waitFor({ timeout: 15000 });
    await page.getByText('I already have an account').click();
    await byTest('email').fill(email);
    await byTest('password').fill('wrong-password');
    await byTest('sign-in-submit').click();
    await text('incorrect').waitFor();
    await byTest('password').fill('Passw0rd!long');
    await byTest('sign-in-submit').click();
    await text('Alex').waitFor({ timeout: 20000 });
  });

  await step('account deletion requires typing DELETE and removes the account', async () => {
    await page.goto(`${BASE}/settings/privacy`);
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await text('Stronger today').waitFor({ timeout: 20000 });
    await page.getByText('I already have an account').click();
    await byTest('email').fill(email);
    await byTest('password').fill('Passw0rd!long');
    await byTest('sign-in-submit').click();
    await text('incorrect').waitFor({ timeout: 10000 });
  });
} catch {
  await page.screenshot({ path: 'test-results/failure.png' }).catch(() => {});
  const outbox = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('outbox')).map((k) => localStorage.getItem(k))).catch(() => []);
  console.log('Outbox:', outbox.map((o) => JSON.stringify(JSON.parse(o).pending.map((p) => ({ c: p.collection, id: p.id, err: p.lastError })))).join('\n'));
} finally {
  console.log(results.join('\n'));
  if (consoleErrors.length) console.log('Page errors:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('✘')) ? 1 : 0);
}
