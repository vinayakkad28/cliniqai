-- Add production data integrity constraints

-- Prevent double-billing: only one invoice per consultation
ALTER TABLE billing.invoices ADD CONSTRAINT invoices_consultation_id_unique UNIQUE (consultation_id);

-- Prevent double-booking: only one appointment per doctor per time slot
ALTER TABLE appointments.appointments ADD CONSTRAINT appointments_doctor_slot_unique UNIQUE (doctor_id, scheduled_at);

-- Prevent negative pharmacy stock
ALTER TABLE pharmacy.inventory ADD CONSTRAINT inventory_stock_nonnegative CHECK (stock_quantity >= 0);
