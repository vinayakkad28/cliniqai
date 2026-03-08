import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('CliniqAI')).toBeVisible();
    await expect(page.getByPlaceholder(/phone/i)).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/login');
    const phoneInput = page.getByPlaceholder(/phone/i);
    await phoneInput.fill('123');
    await page.getByRole('button', { name: /send otp/i }).click();
    // Should show validation error or stay on same page
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('should show OTP input after valid phone', async ({ page }) => {
    await page.goto('/login');
    const phoneInput = page.getByPlaceholder(/phone/i);
    await phoneInput.fill('+919999999999');
    await page.getByRole('button', { name: /send otp/i }).click();
    // Should show OTP input
    await expect(page.getByPlaceholder(/otp/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting token in localStorage
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('cliniqai_access_token', 'mock-test-token');
    });
  });

  test('should have sidebar navigation links', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('nav, [role="navigation"]');
    await expect(sidebar.getByText(/patient/i).first()).toBeVisible();
    await expect(sidebar.getByText(/appointment/i).first()).toBeVisible();
    await expect(sidebar.getByText(/billing/i).first()).toBeVisible();
  });
});
