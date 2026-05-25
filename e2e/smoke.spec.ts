import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('unauthenticated redirect to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('onboarding page is accessible', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByText(/business/i)).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('fake@test.com');
    await page.getByLabel(/password/i).fill('wrongpass');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard (authenticated)', () => {
  test.skip(!process.env.E2E_TEST_EMAIL, 'Requires E2E_TEST_EMAIL env var');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL('/');
  });

  test('dashboard overview loads', async ({ page }) => {
    await expect(page.getByText(/overview|today/i)).toBeVisible();
  });

  test('customers page loads', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByText(/customers/i)).toBeVisible();
  });

  test('analytics page loads', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByText(/analytics/i)).toBeVisible();
  });

  test('billing page loads', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByText(/billing|subscription/i)).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText(/settings/i)).toBeVisible();
  });
});
