-- 20260719000001_phone_local_format.sql
-- Phones are now stored in local form (0504551558) instead of E.164 (972504551558):
-- the app displays/inputs local dashed numbers, and wa.me links re-normalize to
-- E.164 at click time. Convert existing well-formed E.164 rows: drop the '972'
-- country code and prepend a trunk '0'. Guarded to '972' + 8–9 digits so any
-- legacy/raw or already-local values are left untouched.

update employees
set phone = '0' || substring(phone from 4)
where phone ~ '^972[0-9]{8,9}$';
