/**
 * End-to-end test of the admin console (static build) against the emulators.
 * Prerequisite: an owner account created with the bootstrap script, e.g.
 *   owner@forma.test / OwnerPass!123  (see tests/e2e/README in docs/TESTING.md)
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.E2E_ADMIN_BASE ?? 'http://127.0.0.1:8082';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const OWNER = { email: process.env.E2E_OWNER_EMAIL ?? 'owner@forma.test', password: process.env.E2E_OWNER_PASSWORD ?? 'OwnerPass!123' };
const SECRET = 'sk-test-THIS-MUST-NEVER-APPEAR-9876';
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(`✔ ${name}`);
  } catch (err) {
    results.push(`✘ ${name}: ${err.message.split('\n').slice(0, 6).join(' | ')}`);
    throw err;
  }
};
const signUp = (email, password) => fetch(`${AUTH}/accounts:signUp?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) }).then((r) => r.json());

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1360, height: 1000 } })).newPage();
const dialogAnswers = [];
page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(dialogAnswers.shift() ?? 'e2e reason') : d.accept()));
const login = async (email, password) => {
  await page.goto(`${BASE}/login`);
  await page.getByTestId('admin-email').fill(email);
  await page.getByTestId('admin-password').fill(password);
  await page.getByTestId('admin-sign-in').click();
};
const see = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 20000 });

try {
  const plainEmail = `member${Date.now()}@example.test`;
  await step('non-admin account is refused', async () => {
    await signUp(plainEmail, 'MemberPass!123');
    await login(plainEmail, 'MemberPass!123');
    await see('No access');
    await page.getByRole('button', { name: 'Sign out' }).click();
  });

  await step('owner signs in and sees live overview', async () => {
    await login(OWNER.email, OWNER.password);
    await see('Registered users');
    await see('Not instrumented yet');
    await page.screenshot({ path: 'test-results/admin-01-overview.png', fullPage: true });
  });

  await step('add an AI provider with a model', async () => {
    await page.getByRole('link', { name: 'AI Providers' }).click();
    await page.getByRole('button', { name: 'Add provider' }).click();
    await page.getByTestId('provider-id').fill('openai-main');
    await page.getByRole('button', { name: 'Add model' }).click();
    await page.getByTestId('model-id-0').fill('gpt-test');
    await page.getByRole('switch', { name: 'Enabled' }).first().check();
    await page.getByRole('button', { name: 'Save provider' }).click();
    await see('gpt-test');
  });

  await step('store an API key without it ever reaching the browser again', async () => {
    await page.getByRole('switch', { name: 'Test connection before saving' }).uncheck();
    await page.getByTestId('key-openai-main').fill(SECRET);
    await page.getByRole('button', { name: 'Save key' }).click();
    await see('Key saved securely.');
    await page.reload();
    await see('Configured …9876');
    const html = await page.content();
    if (html.includes(SECRET)) throw new Error('secret leaked into page');
    await page.screenshot({ path: 'test-results/admin-02-providers.png', fullPage: true });
  });

  await step('route AI Coach to the provider', async () => {
    await page.getByRole('link', { name: 'Feature AI Routing' }).click();
    const card = page.locator('section', { hasText: 'AI Coach chat' }).first();
    await card.getByLabel('Primary model').selectOption({ index: 1 });
    await card.getByRole('button', { name: 'Save route' }).click();
    await see('Route saved.');
  });

  await step('kill switch: turn AI Coach off and on', async () => {
    await page.getByRole('link', { name: 'Feature Flags' }).click();
    const card = page.locator('section', { hasText: 'Conversational coaching' }).first();
    await card.getByRole('switch', { name: /Enabled/ }).uncheck();
    await see('AI Coach saved.');
    await card.getByRole('switch', { name: /Enabled/ }).check();
  });

  await step('create, publish and roll back a prompt version', async () => {
    await page.getByRole('link', { name: 'Prompts & Policies' }).click();
    const publishedBadge = async () => (await page.getByText(/^v\d+ published$/).first().textContent({ timeout: 20000 }))?.trim();
    const draft = async (label) => {
      await page.getByTestId('prompt-text').fill(`Be warm, concise and practical. ${label} of the coach guidance.`);
      await page.getByPlaceholder('What changed and why').fill(label);
      await page.getByRole('button', { name: 'Save as new draft' }).click();
      await see('Draft saved');
    };
    await draft('Version A');
    await page.getByRole('button', { name: 'Publish', exact: true }).first().click();
    await page.getByText(/^v\d+ published$/).first().waitFor({ timeout: 20000 });
    const first = await publishedBadge();
    await draft('Version B');
    await page.getByRole('button', { name: 'Publish', exact: true }).first().click();
    await page.waitForFunction((prev) => [...document.querySelectorAll('.badge')].some((b) => /^v\d+ published$/.test(b.textContent ?? '') && b.textContent !== prev), first, { timeout: 20000 });
    await page.getByRole('row', { name: new RegExp(`^${first.split(' ')[0]}\\b`) }).getByRole('button', { name: 'Roll back' }).click();
    await page.waitForFunction((want) => [...document.querySelectorAll('.badge')].some((b) => b.textContent === want), first, { timeout: 20000 });
  });

  await step('suspend and reactivate a user', async () => {
    await page.getByRole('link', { name: 'Users' }).click();
    await page.getByTestId('user-search').fill(plainEmail);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await see('Sign-in methods');
    dialogAnswers.push('e2e suspension test');
    await page.getByRole('button', { name: 'Suspend' }).click();
    await see('Account suspended');
    dialogAnswers.push('e2e reactivation');
    await page.getByRole('button', { name: 'Reactivate' }).click();
    await see('Account reactivated');
  });

  await step('audit log records actions (and never the key)', async () => {
    await page.getByRole('link', { name: 'Audit Log' }).click();
    await see('providers.setKey');
    await see('users.setStatus');
    await see('denied');
    if ((await page.content()).includes(SECRET)) throw new Error('secret in audit log');
    await page.screenshot({ path: 'test-results/admin-03-audit.png', fullPage: true });
  });

  await step('usage, plans, settings and admins pages load', async () => {
    for (const [link, text] of [['AI Usage & Costs', 'Budgets'], ['Plans & Entitlements', 'test mode'], ['App Settings', 'Announcement'], ['Admins', 'What each role can do']]) {
      await page.getByRole('link', { name: link }).click();
      await see(text);
    }
  });
} catch {
  await page.screenshot({ path: 'test-results/admin-failure.png', fullPage: true }).catch(() => {});
} finally {
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('✘')) ? 1 : 0);
}
