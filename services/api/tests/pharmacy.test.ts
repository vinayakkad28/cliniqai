import { describe, it, expect } from 'vitest';

describe('Pharmacy Management', () => {
  describe('Inventory Calculations', () => {
    it('should detect low stock correctly', () => {
      const medicine = { name: 'Paracetamol 500mg', stock: 15, reorder_level: 20 };
      const isLowStock = medicine.stock <= medicine.reorder_level;
      expect(isLowStock).toBe(true);
    });

    it('should not flag adequate stock', () => {
      const medicine = { name: 'Amoxicillin 250mg', stock: 100, reorder_level: 20 };
      const isLowStock = medicine.stock <= medicine.reorder_level;
      expect(isLowStock).toBe(false);
    });

    it('should calculate stock after dispensing', () => {
      const currentStock = 50;
      const dispensedQty = 10;
      const newStock = currentStock - dispensedQty;
      expect(newStock).toBe(40);
    });

    it('should prevent dispensing more than available stock', () => {
      const currentStock = 5;
      const requestedQty = 10;
      const canDispense = requestedQty <= currentStock;
      expect(canDispense).toBe(false);
    });

    it('should calculate days until stockout', () => {
      const currentStock = 100;
      const avgDailyUsage = 8;
      const daysUntilStockout = Math.floor(currentStock / avgDailyUsage);
      expect(daysUntilStockout).toBe(12);
    });
  });

  describe('Medicine Batch Management', () => {
    it('should identify expired medicines', () => {
      const today = new Date('2026-03-08');
      const batches = [
        { batchNo: 'B001', expiry: new Date('2026-02-28') },
        { batchNo: 'B002', expiry: new Date('2026-12-31') },
        { batchNo: 'B003', expiry: new Date('2025-06-15') },
      ];

      const expired = batches.filter((b) => b.expiry < today);
      expect(expired).toHaveLength(2);
      expect(expired.map((b) => b.batchNo)).toContain('B001');
      expect(expired.map((b) => b.batchNo)).toContain('B003');
    });

    it('should sort by FIFO (first expiry first out)', () => {
      const batches = [
        { batchNo: 'B002', expiry: new Date('2026-12-31'), qty: 30 },
        { batchNo: 'B001', expiry: new Date('2026-06-30'), qty: 20 },
        { batchNo: 'B003', expiry: new Date('2027-03-15'), qty: 50 },
      ];

      const sorted = [...batches].sort((a, b) => a.expiry.getTime() - b.expiry.getTime());
      expect(sorted[0].batchNo).toBe('B001');
      expect(sorted[2].batchNo).toBe('B003');
    });
  });
});
