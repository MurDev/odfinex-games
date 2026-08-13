-- Deposit and withdrawal are independent gates for a payment rail: a method
-- can be open for deposits but closed for withdrawals, or vice versa.
-- Defaults to true so existing rails keep their current (unrestricted)
-- withdrawal behavior until an admin explicitly flips it off.
ALTER TABLE "payment_rail_config" ADD COLUMN "withdrawal_enabled" boolean DEFAULT true NOT NULL;
