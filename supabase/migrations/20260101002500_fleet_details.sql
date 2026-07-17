alter table public.vehicles
  add column make text,
  add column model text,
  add column year integer,
  add column country_of_registration text,
  add column insurance_expiry_date date,
  add column last_cleaning_date date;

alter table public.drivers
  add column home_region text,
  add column qualification_status text not null default 'unverified';
