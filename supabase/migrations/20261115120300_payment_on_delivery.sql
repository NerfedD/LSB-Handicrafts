-- A delivered order can now be paid one of three ways:
--   full payment   paid as the order is written; payment_term_days is null
--   on delivery    due the day it is delivered;  payment_term_days = 0
--   payment terms  30 or 60 days from delivery, as before
-- 0 rides on the existing due-date logic (delivered day + 0), so reminders for
-- an unpaid delivery work unchanged. Interest on terms is not modelled yet:
-- the policy is still to be confirmed.
alter table public.orders drop constraint if exists orders_payment_term_check;
alter table public.orders add constraint orders_payment_term_check
  check (payment_term_days is null or payment_term_days in (0, 30, 60));
