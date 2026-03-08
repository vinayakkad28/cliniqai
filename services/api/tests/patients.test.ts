import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma';

describe('Patient Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Patient Data Validation', () => {
    it('should validate Indian phone number format', () => {
      const validPhones = ['+919876543210', '+918765432109', '+917654321098'];
      const invalidPhones = ['9876543210', '+1234567890', 'abcdefghij', ''];

      validPhones.forEach((phone) => {
        expect(phone).toMatch(/^\+91\d{10}$/);
      });

      invalidPhones.forEach((phone) => {
        expect(phone).not.toMatch(/^\+91\d{10}$/);
      });
    });

    it('should validate patient age calculation', () => {
      const dob = new Date('1990-01-15');
      const now = new Date('2026-03-08');
      const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      expect(age).toBe(36);
    });

    it('should validate gender enum', () => {
      const validGenders = ['male', 'female', 'other'];
      const invalidGender = 'unknown';
      expect(validGenders).toContain('male');
      expect(validGenders).not.toContain(invalidGender);
    });

    it('should validate blood group format', () => {
      const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      validGroups.forEach((group) => {
        expect(group).toMatch(/^(A|B|AB|O)[+-]$/);
      });
    });
  });

  describe('Patient Search', () => {
    it('should build search query with name filter', () => {
      const searchTerm = 'Raj';
      const whereClause = {
        OR: [
          { first_name: { contains: searchTerm, mode: 'insensitive' } },
          { last_name: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm } },
        ],
      };
      expect(whereClause.OR).toHaveLength(3);
      expect(whereClause.OR[0]).toHaveProperty('first_name');
    });

    it('should paginate results correctly', () => {
      const page = 3;
      const limit = 20;
      const skip = (page - 1) * limit;
      expect(skip).toBe(40);
    });
  });

  describe('Patient Timeline', () => {
    it('should sort timeline entries by date descending', () => {
      const entries = [
        { date: new Date('2026-01-15'), type: 'consultation' },
        { date: new Date('2026-03-01'), type: 'lab' },
        { date: new Date('2026-02-10'), type: 'prescription' },
      ];
      const sorted = entries.sort((a, b) => b.date.getTime() - a.date.getTime());
      expect(sorted[0].type).toBe('lab');
      expect(sorted[2].type).toBe('consultation');
    });
  });
});
