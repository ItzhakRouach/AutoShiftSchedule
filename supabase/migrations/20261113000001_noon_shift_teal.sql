-- 20261113000001_noon_shift_teal.sql — move the noon shift off the danger colour.
--
-- The seeded noon colour (#EB6A4E) is the same coral the UI uses for "low
-- coverage / needs attention" (--danger-2), so a normal noon shift read as a
-- warning. New workplaces now seed teal (SHIFT_META.noon in constants.ts);
-- this brings existing workplaces along.
--
-- Only rows still on the seeded default change: a workplace that picked its
-- own noon colour keeps it. Display-only — no assignment or request data is
-- touched.
update shift_types
   set color = '#0E9384'
 where key = 'noon'
   and upper(color) = '#EB6A4E';
