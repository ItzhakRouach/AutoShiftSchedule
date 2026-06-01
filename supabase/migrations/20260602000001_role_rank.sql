-- Role hierarchy: a numeric rank on roles. A higher-ranked role automatically
-- qualifies an employee for all lower-ranked roles (expansion is applied in the
-- adapter — see src/lib/schedule/map-rows.ts). Default rank=1 (lowest).
alter table roles add column if not exists rank smallint not null default 1;

-- Standard security-domain ranks, keyed on role name within each workplace.
update roles set rank = 1 where name = 'מאבטח';
update roles set rank = 2 where name = 'מוקדן';
update roles set rank = 3 where name = 'אחמ״ש';
