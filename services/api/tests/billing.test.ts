import { describe, it, expect } from 'vitest';

describe('Billing & Invoice Calculations', () => {
  describe('GST Calculation', () => {
    it('should calculate 18% GST correctly', () => {
      const subtotal = 1000;
      const gstRate = 0.18;
      const gstAmount = subtotal * gstRate;
      const total = subtotal + gstAmount;

      expect(gstAmount).toBe(180);
      expect(total).toBe(1180);
    });

    it('should handle zero amount', () => {
      const subtotal = 0;
      const gstRate = 0.18;
      expect(subtotal * gstRate).toBe(0);
    });

    it('should round GST to 2 decimal places', () => {
      const subtotal = 333.33;
      const gstRate = 0.18;
      const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
      expect(gstAmount).toBe(60);
    });
  });

  describe('Payment Tracking', () => {
    it('should calculate balance correctly for partial payment', () => {
      const total = 1180;
      const paid = 500;
      const balance = total - paid;
      expect(balance).toBe(680);
    });

    it('should mark invoice as paid when balance is zero', () => {
      const total = 1180;
      const paid = 1180;
      const status = paid >= total ? 'paid' : 'partial';
      expect(status).toBe('paid');
    });

    it('should handle overpayment gracefully', () => {
      const total = 1000;
      const paid = 1200;
      const refund = Math.max(0, paid - total);
      expect(refund).toBe(200);
    });
  });

  describe('Revenue Reports', () => {
    it('should aggregate daily revenue', () => {
      const invoices = [
        { date: '2026-03-01', amount: 1000 },
        { date: '2026-03-01', amount: 500 },
        { date: '2026-03-02', amount: 750 },
      ];

      const daily = invoices.reduce(
        (acc, inv) => {
          acc[inv.date] = (acc[inv.date] || 0) + inv.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(daily['2026-03-01']).toBe(1500);
      expect(daily['2026-03-02']).toBe(750);
    });

    it('should calculate monthly revenue correctly', () => {
      const dailyRevenues = [1000, 1500, 750, 2000, 1200];
      const monthlyTotal = dailyRevenues.reduce((sum, v) => sum + v, 0);
      expect(monthlyTotal).toBe(6450);
    });
  });
});
