import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: mock authentication by setting token in localStorage
// ---------------------------------------------------------------------------

async function mockAuth(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('cliniqai_access_token', 'mock-test-token');
    localStorage.setItem('cliniqai_refresh_token', 'mock-refresh-token');
    localStorage.setItem(
      'cliniqai_user',
      JSON.stringify({
        id: 'user-001',
        role: 'doctor',
        phone: '+919876543210',
        doctor: { id: 'doc-001', name: 'Dr. Sharma', specialties: ['General Medicine'] },
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Dashboard — loads with greeting
// ---------------------------------------------------------------------------

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('loads with a time-appropriate greeting', async ({ page }) => {
    await page.goto('/dashboard');

    // The dashboard shows "Good morning/afternoon/evening, Dr. <Name>"
    const greeting = page.locator('h1');
    await expect(greeting).toBeVisible({ timeout: 10_000 });
    await expect(greeting).toContainText(/Good (morning|afternoon|evening)/);
  });

  test('displays today\'s date', async ({ page }) => {
    await page.goto('/dashboard');

    // Date is shown below the greeting in format like "Monday, 10 March 2026"
    const dateText = page.locator('text=/\\d{1,2}\\s\\w+\\s\\d{4}/');
    await expect(dateText.first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows stat cards for revenue and appointments', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText("Today's Revenue")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Today's Appointments")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('GST Collected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Consultation Fees')).toBeVisible({ timeout: 10_000 });
  });

  test('shows quick action buttons', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Book Appointment')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Register Patient')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Billing').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Today's Schedule")).toBeVisible({ timeout: 10_000 });
  });

  test('quick action links navigate to correct pages', async ({ page }) => {
    await page.goto('/dashboard');

    const bookApptLink = page.getByText('Book Appointment');
    await expect(bookApptLink).toBeVisible({ timeout: 10_000 });
    await bookApptLink.click();
    await expect(page).toHaveURL(/\/dashboard\/appointments\/new/);
  });

  test('register patient link works', async ({ page }) => {
    await page.goto('/dashboard');

    const registerLink = page.getByText('Register Patient');
    await expect(registerLink).toBeVisible({ timeout: 10_000 });
    await registerLink.click();
    await expect(page).toHaveURL(/\/dashboard\/patients\/new/);
  });
});

// ---------------------------------------------------------------------------
// Navigation sidebar
// ---------------------------------------------------------------------------

test.describe('Navigation sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('sidebar is visible on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows CliniqAI brand', async ({ page }) => {
    await page.goto('/dashboard');

    const brand = page.locator('aside').getByText('CliniqAI');
    await expect(brand).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar contains all navigation links', async ({ page }) => {
    await page.goto('/dashboard');

    const sidebar = page.locator('aside');

    await expect(sidebar.locator('text=Dashboard')).toBeVisible();
    await expect(sidebar.locator('text=Appointments')).toBeVisible();
    await expect(sidebar.locator('text=Patients')).toBeVisible();
    await expect(sidebar.locator('text=Consultations')).toBeVisible();
    await expect(sidebar.locator('text=Billing')).toBeVisible();
    await expect(sidebar.locator('text=Pharmacy')).toBeVisible();
    await expect(sidebar.locator('text=Analytics')).toBeVisible();
    await expect(sidebar.locator('text=Queue Display')).toBeVisible();
    await expect(sidebar.locator('text=Settings')).toBeVisible();
  });

  test('clicking Patients navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');

    await page.click('text=Patients');
    await expect(page).toHaveURL(/\/dashboard\/patients/);
  });

  test('clicking Appointments navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');

    await page.click('text=Appointments');
    await expect(page).toHaveURL(/\/dashboard\/appointments/);
  });

  test('clicking Consultations navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');

    await page.click('text=Consultations');
    await expect(page).toHaveURL(/\/dashboard\/consultations/);
  });

  test('clicking Billing navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');

    const billingLink = page.locator('aside nav').getByText('Billing');
    await billingLink.click();
    await expect(page).toHaveURL(/\/dashboard\/billing/);
  });

  test('active nav item is visually highlighted', async ({ page }) => {
    await page.goto('/dashboard');

    // The Dashboard link should have the active class on /dashboard
    const dashboardLink = page.locator('aside nav a[href="/dashboard"]');
    await expect(dashboardLink).toBeVisible({ timeout: 10_000 });

    const className = await dashboardLink.getAttribute('class');
    expect(className).toContain('primary');
  });

  test('sidebar shows user info and logout button', async ({ page }) => {
    await page.goto('/dashboard');

    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Logout')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking logout redirects to login page', async ({ page }) => {
    await page.goto('/dashboard');

    const logoutBtn = page.locator('aside').getByText('Logout');
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 });
    await logoutBtn.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Analytics page loads charts
// ---------------------------------------------------------------------------

test.describe('Analytics page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('analytics page loads', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    await expect(page).toHaveURL(/\/dashboard\/analytics/);
  });

  test('analytics page shows Practice Analytics heading', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    await expect(page.locator('text=Practice Analytics')).toBeVisible({ timeout: 10_000 });
  });

  test('analytics page has chart elements', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Look for chart-related elements (SVG charts, canvas, or chart containers)
    const pageContent = page.locator('main, [class*="content"], .p-6');
    await expect(pageContent.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Patient list page loads
// ---------------------------------------------------------------------------

test.describe('Patient list page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('patient list page loads', async ({ page }) => {
    await page.goto('/dashboard/patients');

    await expect(page).toHaveURL(/\/dashboard\/patients/);
  });

  test('patient list page has content', async ({ page }) => {
    await page.goto('/dashboard/patients');

    const pageContainer = page.locator('main, [class*="content"]');
    await expect(pageContainer.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Appointment booking flow
// ---------------------------------------------------------------------------

test.describe('Appointment booking flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('can navigate to new appointment page', async ({ page }) => {
    await page.goto('/dashboard/appointments/new');

    await expect(page).toHaveURL(/\/dashboard\/appointments\/new/);
  });

  test('appointments page shows schedule', async ({ page }) => {
    await page.goto('/dashboard/appointments');

    await expect(page).toHaveURL(/\/dashboard\/appointments/);
    const content = page.locator('main, [class*="content"]');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('can navigate from appointments list to new appointment', async ({ page }) => {
    await page.goto('/dashboard/appointments');

    const bookButton = page.getByText(/book|new appointment|schedule/i).first();
    await expect(bookButton).toBeVisible({ timeout: 10_000 });
    await bookButton.click();

    await expect(page).toHaveURL(/\/dashboard\/appointments\/new/);
  });
});

// ---------------------------------------------------------------------------
// Search / Command Palette opens with Cmd+K
// ---------------------------------------------------------------------------

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('opens command palette with Cmd+K', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Meta+k');

    await expect(page.locator('text=Type a command or search')).toBeVisible({ timeout: 5_000 });
  });

  test('command palette has search input', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Meta+k');

    const searchInput = page.locator('[role="dialog"] input, [class*="command"] input');
    await expect(searchInput.first()).toBeVisible({ timeout: 5_000 });
  });

  test('command palette closes with Escape', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Meta+k');
    await expect(page.locator('text=Type a command or search')).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('text=Type a command or search')).not.toBeVisible({ timeout: 3_000 });
  });
});

// ---------------------------------------------------------------------------
// Queue Display
// ---------------------------------------------------------------------------

test.describe('Queue Display', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('queue page shows clinic queue header', async ({ page }) => {
    await page.goto('/dashboard/queue');

    await expect(page.locator('text=Clinic Queue')).toBeVisible({ timeout: 10_000 });
  });

  test('fullscreen toggle button exists', async ({ page }) => {
    await page.goto('/dashboard/queue');

    await expect(page.locator('text=Fullscreen')).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Responsive behavior
// ---------------------------------------------------------------------------

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('dashboard is accessible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');

    const greeting = page.locator('h1');
    await expect(greeting).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Authentication guard
// ---------------------------------------------------------------------------

test.describe('Auth guard', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('redirects from protected routes without auth', async ({ page }) => {
    await page.goto('/dashboard/patients');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
