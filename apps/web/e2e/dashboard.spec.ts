import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('cliniqai_access_token', 'test-token');
      localStorage.setItem('cliniqai_refresh_token', 'test-refresh');
    });
  });

  test('dashboard loads with greeting', async ({ page }) => {
    await page.goto('/dashboard');
    // Should show a greeting based on time of day
    const greeting = page.locator('h1');
    await expect(greeting).toContainText(/Good (morning|afternoon|evening)/);
  });

  test('sidebar navigation links are visible', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text=Dashboard')).toBeVisible();
    await expect(sidebar.locator('text=Appointments')).toBeVisible();
    await expect(sidebar.locator('text=Patients')).toBeVisible();
    await expect(sidebar.locator('text=Consultations')).toBeVisible();
    await expect(sidebar.locator('text=Billing')).toBeVisible();
    await expect(sidebar.locator('text=Pharmacy')).toBeVisible();
    await expect(sidebar.locator('text=Follow-ups')).toBeVisible();
    await expect(sidebar.locator('text=Analytics')).toBeVisible();
    await expect(sidebar.locator('text=Audit Log')).toBeVisible();
  });

  test('navigating to patients page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Patients');
    await expect(page).toHaveURL(/\/dashboard\/patients/);
  });

  test('navigating to analytics page', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page.locator('text=Practice Analytics')).toBeVisible();
  });

  test('navigating to follow-ups page', async ({ page }) => {
    await page.goto('/dashboard/follow-ups');
    await expect(page.locator('text=Follow-up')).toBeVisible();
  });

  test('navigating to audit log page', async ({ page }) => {
    await page.goto('/dashboard/audit-log');
    await expect(page.locator('text=Audit Log')).toBeVisible();
  });

  test('command palette opens with Cmd+K', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Meta+k');
    await expect(page.locator('text=Type a command or search')).toBeVisible();
  });

  test('command palette closes with Escape', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Meta+k');
    await expect(page.locator('text=Type a command or search')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Type a command or search')).not.toBeVisible();
  });

  test('quick actions are displayed', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=Book Appointment')).toBeVisible();
    await expect(page.locator('text=Register Patient')).toBeVisible();
  });
});

test.describe('Appointment Booking Flow', () => {
  test('can navigate to new appointment page', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cliniqai_access_token', 'test-token');
    });
    await page.goto('/dashboard/appointments/new');
    await expect(page).toHaveURL(/\/dashboard\/appointments\/new/);
  });
});

test.describe('Queue Display', () => {
  test('queue page shows clinic queue header', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cliniqai_access_token', 'test-token');
    });
    await page.goto('/dashboard/queue');
    await expect(page.locator('text=Clinic Queue')).toBeVisible();
  });

  test('fullscreen toggle button exists', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cliniqai_access_token', 'test-token');
    });
    await page.goto('/dashboard/queue');
    await expect(page.locator('text=Fullscreen')).toBeVisible();
  });
});
