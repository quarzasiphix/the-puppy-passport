-- Local demo data for Anemalo. Realistic Polish/European names, cities and prices — no inflated
-- platform statistics; homepage counts are plain `select count(*)` against these rows.
--
-- All 10 demo accounts share the password: password123

-- ---------------------------------------------------------------------------------------------
-- Auth users (profiles + trigger fire automatically via public.handle_new_user)
-- ---------------------------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token, is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'customer@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Marta","last_name":"Zielińska","phone":"+48 601 111 222","country":"Poland","city":"Łódź"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'buyer@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Julia","last_name":"Kowalczyk","phone":"+48 555 123 456","country":"Poland","city":"Warsaw"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'breeder1@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Anna","last_name":"Kowalska","phone":"+48 601 222 333","country":"Poland","city":"Warsaw"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'breeder2@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Tomasz","last_name":"Nowak","phone":"+48 602 333 444","country":"Poland","city":"Kraków"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'breeder3-pending@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Katarzyna","last_name":"Wiśniewska","phone":"+48 603 444 555","country":"Poland","city":"Wrocław"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'foundation1@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Aleksandra","last_name":"Nowicka","phone":"+48 604 555 666","country":"Poland","city":"Poznań"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'foundation2-pending@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Bartłomiej","last_name":"Sikora","phone":"+48 605 666 777","country":"Poland","city":"Gdańsk"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated',
   'ops@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Kasia","last_name":"Woźniak","phone":"+48 606 777 888","country":"Poland","city":"Poznań"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated',
   'driver@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Marek","last_name":"Dąbrowski","phone":"+48 607 888 999","country":"Poland","city":"Poznań"}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
   'admin@anemalo.test', crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"first_name":"Anemalo","last_name":"Admin","phone":"+48 600 000 000","country":"Poland","city":"Warsaw"}',
   now(), now(), '', '', '', '', false, false);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000010'
);

-- ---------------------------------------------------------------------------------------------
-- Elevated roles (customer/buyer are the unrestricted baseline personas; the rest are gated)
-- ---------------------------------------------------------------------------------------------

insert into public.user_roles (user_id, role, status) values
  ('10000000-0000-0000-0000-000000000001', 'customer', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'buyer', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'breeder', 'active'),
  ('10000000-0000-0000-0000-000000000004', 'breeder', 'active'),
  ('10000000-0000-0000-0000-000000000005', 'breeder', 'pending'),
  ('10000000-0000-0000-0000-000000000006', 'foundation_member', 'active'),
  ('10000000-0000-0000-0000-000000000007', 'shelter_member', 'pending'),
  ('10000000-0000-0000-0000-000000000008', 'operations', 'active'),
  ('10000000-0000-0000-0000-000000000009', 'driver', 'active'),
  ('10000000-0000-0000-0000-000000000010', 'admin', 'active');

-- ---------------------------------------------------------------------------------------------
-- Organisations (2 approved kennels + 1 approved foundation). The breeder/shelter still
-- "waiting for verification" intentionally has no organisations row yet — only a verification.
-- ---------------------------------------------------------------------------------------------

insert into public.organisations (
  id, org_type, name, slug, logo_url, cover_image_url, description, country, city, public_location,
  association_name, membership_number, years_experience, response_time, transport_available,
  international_transport_available, verification_status, is_public, owner_user_id
) values
  ('20000000-0000-0000-0000-000000000001', 'kennel', 'Cichy Las Kennel', 'cichy-las',
   '/images/seed/puppy-1.jpg', '/images/seed/kennel-1.jpg',
   'Small family kennel raising golden and labrador retrievers with a focus on stable temperament and health-tested parents. Puppies grow up inside our home and finish early socialisation before going home.',
   'Poland', 'Warsaw', 'Warsaw, Poland', 'Związek Kynologiczny w Polsce (ZKwP / FCI)', 'ZKWP-WA-1184',
   14, 'under 4 hours', true, true, 'approved', true, '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000002', 'kennel', 'Wolna Dolina', 'wolna-dolina',
   '/images/seed/puppy-2.jpg', '/images/seed/kennel-2.jpg',
   'Working-line border collies and Australian shepherds bred for balanced drive and clear-headedness. All parents are hip, elbow and eye tested.',
   'Poland', 'Kraków', 'Kraków, Poland', 'ZKwP / FCI, member of Polish Border Collie Club', 'ZKWP-KR-0932',
   9, 'same day', true, true, 'approved', true, '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000003', 'foundation', 'Fundacja Ratunek dla Psów', 'ratunek-dla-psow',
   '/images/seed/puppy-5.jpg', '/images/seed/litter-1.jpg',
   'Foundation rehoming rescued and surrendered dogs across Wielkopolska, with foster homes and full veterinary checks before adoption.',
   'Poland', 'Poznań', 'Poznań, Poland', 'Krajowa Rada Fundacji Zwierzęcych', 'KRFZ-2019-0447',
   7, 'within 1 day', true, false, 'approved', true, '10000000-0000-0000-0000-000000000006');

insert into public.organisation_members (org_id, profile_id, member_role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'owner'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'owner'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', 'owner');

insert into public.user_verifications (
  user_id, verification_type, status, submitted_data, reviewed_at, reviewed_by
) values
  ('10000000-0000-0000-0000-000000000003', 'breeder', 'approved',
   jsonb_build_object('org_type', 'kennel', 'name', 'Cichy Las Kennel',
     'description', 'Golden retriever and labrador retriever kennel in Warsaw.',
     'country', 'Poland', 'city', 'Warsaw', 'public_location', 'Warsaw, Poland',
     'association_name', 'ZKwP / FCI', 'membership_number', 'ZKWP-WA-1184', 'years_experience', 14,
     'breeds', jsonb_build_array('Golden Retriever', 'Labrador Retriever')),
   now() - interval '395 days', '10000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000004', 'breeder', 'approved',
   jsonb_build_object('org_type', 'kennel', 'name', 'Wolna Dolina',
     'description', 'Border collie and Australian shepherd working-line kennel in Kraków.',
     'country', 'Poland', 'city', 'Kraków', 'public_location', 'Kraków, Poland',
     'association_name', 'ZKwP / FCI', 'membership_number', 'ZKWP-KR-0932', 'years_experience', 9,
     'breeds', jsonb_build_array('Border Collie', 'Australian Shepherd')),
   now() - interval '294 days', '10000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000005', 'breeder', 'pending',
   jsonb_build_object('org_type', 'kennel', 'name', 'Srebrna Rzeka',
     'description', 'Bernese mountain dog kennel in Wrocław, first litter planned for next year.',
     'country', 'Poland', 'city', 'Wrocław', 'public_location', 'Wrocław, Poland',
     'association_name', 'ZKwP / FCI', 'membership_number', 'ZKWP-WR-2201', 'years_experience', 2,
     'breeds', jsonb_build_array('Bernese Mountain Dog')),
   null, null),
  ('10000000-0000-0000-0000-000000000006', 'organisation', 'approved',
   jsonb_build_object('org_type', 'foundation', 'name', 'Fundacja Ratunek dla Psów',
     'description', 'Rehoming foundation based in Poznań.',
     'country', 'Poland', 'city', 'Poznań', 'public_location', 'Poznań, Poland',
     'association_name', 'Krajowa Rada Fundacji Zwierzęcych', 'membership_number', 'KRFZ-2019-0447',
     'years_experience', 7),
   now() - interval '195 days', '10000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000007', 'organisation', 'pending',
   jsonb_build_object('org_type', 'shelter', 'name', 'Schronisko Nadzieja',
     'description', 'Municipal shelter in Gdańsk applying to publish adoption listings.',
     'country', 'Poland', 'city', 'Gdańsk', 'public_location', 'Gdańsk, Poland', 'years_experience', 3),
   null, null),
  ('10000000-0000-0000-0000-000000000009', 'driver', 'approved',
   jsonb_build_object('note', 'Local transport driver, verified manually for the demo.'),
   now() - interval '150 days', '10000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000008', 'transport_employee', 'approved',
   jsonb_build_object('note', 'Operations staff, verified manually for the demo.'),
   now() - interval '150 days', '10000000-0000-0000-0000-000000000010');

insert into public.private_addresses (id, owner_org_id, country, city, street, building_number, address_label, is_verified) values
  ('25000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Poland', 'Warsaw', 'ul. Przykładowa', '12', 'Kennel pickup address', true),
  ('25000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Poland', 'Kraków', 'ul. Kwiatowa', '4', 'Kennel pickup address', true);

update public.organisations set private_address_id = '25000000-0000-0000-0000-000000000001' where id = '20000000-0000-0000-0000-000000000001';
update public.organisations set private_address_id = '25000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------------------------
-- Breeds
-- ---------------------------------------------------------------------------------------------

insert into public.breeds (id, name, slug, size_category, short_description) values
  ('30000000-0000-0000-0000-000000000001', 'Border Collie', 'border-collie', 'medium', 'Highly intelligent working and herding breed, needs structured activity.'),
  ('30000000-0000-0000-0000-000000000002', 'Golden Retriever', 'golden-retriever', 'large', 'Friendly, patient family companion, popular first-time-owner breed.'),
  ('30000000-0000-0000-0000-000000000003', 'Labrador Retriever', 'labrador-retriever', 'large', 'Easy-going, food-motivated, one of the most popular family breeds.'),
  ('30000000-0000-0000-0000-000000000004', 'German Shepherd', 'german-shepherd', 'large', 'Versatile working breed, confident and trainable.'),
  ('30000000-0000-0000-0000-000000000005', 'Australian Shepherd', 'australian-shepherd', 'medium', 'Energetic herding breed, thrives with an active owner.'),
  ('30000000-0000-0000-0000-000000000006', 'French Bulldog', 'french-bulldog', 'small', 'Compact, affectionate companion breed with a calm indoor energy level.'),
  ('30000000-0000-0000-0000-000000000007', 'Pomeranian', 'pomeranian', 'small', 'Small, alert companion breed with a dense double coat.'),
  ('30000000-0000-0000-0000-000000000008', 'Dachshund', 'dachshund', 'small', 'Long-bodied hound breed, originally bred for badger hunting.');

-- ---------------------------------------------------------------------------------------------
-- Parent dogs
-- ---------------------------------------------------------------------------------------------

insert into public.parent_dogs (id, kennel_id, breed_id, registered_name, call_name, sex, date_of_birth, color, pedigree_number, health_tests, titles) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   'Cichy Las Amber', 'Amber', 'female', '2021-03-14', 'Light cream', 'PKR.I-77213',
   '[{"test":"HD-A / ED-0","date":"2024-01-10"},{"test":"Eyes clear","date":"2025-02-01"}]', 'PL CH'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   'Sunfield Orion', 'Orion', 'male', '2020-06-02', 'Golden', 'SE-KENNEL-4471',
   '[{"test":"HD-A / ED-0","date":"2023-11-20"},{"test":"Eyes clear","date":"2025-01-15"}]', 'INT CH'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
   'Cichy Las Nutmeg', 'Nutmeg', 'female', '2021-09-22', 'Chocolate', 'PKR.I-79950',
   '[{"test":"HD-A / ED-0","date":"2024-05-06"}]', null),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'Wolna Dolina Iskra', 'Iskra', 'female', '2020-04-18', 'Tricolour', 'PKR.I-88214',
   '[{"test":"HD-A / ED-0","date":"2024-03-01"},{"test":"CEA / TNS / DNA clear","date":"2023-08-01"}]', 'PL CH, Working test I° pass'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'Northwind Storm', 'Storm', 'male', '2019-11-30', 'Black and white', 'UK KC AZ01234501',
   '[{"test":"HD-A / ED-0","date":"2023-09-14"},{"test":"MDR1 +/+","date":"2023-09-14"}]', 'INT CH, Agility Grade 6'),
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005',
   'Wolna Dolina Sara', 'Sara', 'female', '2021-01-09', 'Blue merle', 'PKR.I-90112',
   '[{"test":"HD-A / ED-0","date":"2024-06-11"}]', null);

-- ---------------------------------------------------------------------------------------------
-- Litters
-- ---------------------------------------------------------------------------------------------

insert into public.litters (id, kennel_id, breed_id, code, mother_id, father_id, birth_date, ready_date, puppy_count, male_count, female_count, association, registration_number, status, is_published) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   'Litter M — Cichy Las', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002',
   '2026-05-16', '2026-07-25', 4, 2, 2, 'ZKwP / FCI', 'ZKWP/2026/M/0231', 'applications_open', true),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'Litter R — Wolna Dolina', '40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000005',
   '2026-05-10', '2026-07-19', 3, 2, 1, 'ZKwP / FCI', 'ZKWP/2026/R/0198', 'applications_open', true),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005',
   'Litter S — Wolna Dolina', '40000000-0000-0000-0000-000000000006', null,
   null, null, null, null, null, null, null, 'planned', true),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
   'Litter N — Cichy Las', '40000000-0000-0000-0000-000000000003', null,
   '2026-04-02', '2026-06-11', 3, 1, 2, 'ZKwP / FCI', 'ZKWP/2026/N/0119', 'completed', true);

update public.litters set expected_birth_date = '2026-09-20' where id = '50000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------------------------
-- Animals (breeder puppies + one adoption listing)
-- ---------------------------------------------------------------------------------------------

insert into public.animals (
  id, listing_category, litter_id, organization_id, name, slug, breed_id, sex, color, date_of_birth,
  price, currency, description, availability_status, is_published, transport_available, international_transport_available, is_featured
) values
  ('60000000-0000-0000-0000-000000000001', 'breeder_puppy', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Maja', 'maja', '30000000-0000-0000-0000-000000000002', 'female', 'Light cream', '2026-05-16',
   6500, 'PLN', 'Maja is a warm, curious puppy who is confident with new people and gentle with children.', 'available', true, true, true, true),
  ('60000000-0000-0000-0000-000000000002', 'breeder_puppy', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Kora', 'kora', '30000000-0000-0000-0000-000000000002', 'female', 'Golden', '2026-05-16',
   6500, 'PLN', 'Kora is playful and food-motivated, quick to settle into a new routine.', 'applications_open', true, true, true, false),
  ('60000000-0000-0000-0000-000000000003', 'breeder_puppy', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Fabian', 'fabian', '30000000-0000-0000-0000-000000000002', 'male', 'Golden', '2026-05-16',
   6200, 'PLN', 'Fabian is the calmest of the litter, a good match for a first-time owner.', 'reserved', true, true, true, false),
  ('60000000-0000-0000-0000-000000000004', 'breeder_puppy', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Nero', 'nero', '30000000-0000-0000-0000-000000000002', 'male', 'Cream', '2026-05-16',
   6200, 'PLN', 'Nero is confident and food-driven, a strong candidate for obedience work.', 'draft', false, true, true, false),
  ('60000000-0000-0000-0000-000000000005', 'breeder_puppy', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'Rico', 'rico', '30000000-0000-0000-0000-000000000001', 'male', 'Tricolour', '2026-05-10',
   7200, 'PLN', 'Rico is the most thoughtful puppy in his litter, always assessing before acting. Ideal for sport homes.', 'applications_open', true, true, true, true),
  ('60000000-0000-0000-0000-000000000006', 'breeder_puppy', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'Bree', 'bree', '30000000-0000-0000-0000-000000000001', 'female', 'Black and white', '2026-05-10',
   7000, 'PLN', 'Bree is a soft, cooperative puppy with a strong work ethic already showing at 8 weeks.', 'available', true, true, false, false),
  ('60000000-0000-0000-0000-000000000007', 'breeder_puppy', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'Django', 'django', '30000000-0000-0000-0000-000000000001', 'male', 'Blue merle', '2026-05-10',
   7000, 'PLN', 'Django is high-drive and quick to learn — best suited to an active sport or working home.', 'sold', false, true, true, false),
  ('60000000-0000-0000-0000-000000000008', 'breeder_puppy', '50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'Coco', 'coco', '30000000-0000-0000-0000-000000000003', 'female', 'Chocolate', '2026-04-02',
   5800, 'PLN', 'Coco is easy-going and food motivated — a classic labrador in the making.', 'sold', false, true, true, false),
  ('60000000-0000-0000-0000-000000000009', 'breeder_puppy', '50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'Iza', 'iza', '30000000-0000-0000-0000-000000000003', 'female', 'Chocolate', '2026-04-02',
   5800, 'PLN', 'Iza is a little more independent than her littermates and enjoys exploring alone.', 'unavailable', true, true, true, false),
  ('60000000-0000-0000-0000-000000000010', 'breeder_puppy', '50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'Bruno', 'bruno', '30000000-0000-0000-0000-000000000003', 'male', 'Black', '2026-04-02',
   5900, 'PLN', 'Bruno is stable and self-assured, comfortable with children and other dogs.', 'sold', false, true, true, false),
  ('60000000-0000-0000-0000-000000000011', 'adoption', null, '20000000-0000-0000-0000-000000000003',
   'Reksio', 'reksio', '30000000-0000-0000-0000-000000000004', 'male', 'Black and tan', '2023-02-01',
   null, 'PLN', 'Reksio was surrendered by his previous family after a move abroad. Neutered, vaccinated, good with other dogs.', 'available', true, true, false, false);

insert into public.animal_images (animal_id, image_url, display_order, is_cover, caption) values
  ('60000000-0000-0000-0000-000000000001', '/images/seed/puppy-1.jpg', 0, true, 'Maja at 8 weeks'),
  ('60000000-0000-0000-0000-000000000001', '/images/seed/puppy-3.jpg', 1, false, null),
  ('60000000-0000-0000-0000-000000000002', '/images/seed/puppy-3.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000003', '/images/seed/puppy-6.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000004', '/images/seed/puppy-1.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000005', '/images/seed/puppy-2.jpg', 0, true, 'Rico exploring the garden'),
  ('60000000-0000-0000-0000-000000000005', '/images/seed/puppy-4.jpg', 1, false, null),
  ('60000000-0000-0000-0000-000000000006', '/images/seed/puppy-4.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000007', '/images/seed/puppy-2.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000008', '/images/seed/puppy-3.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000009', '/images/seed/puppy-3.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000010', '/images/seed/puppy-4.jpg', 0, true, null),
  ('60000000-0000-0000-0000-000000000011', '/images/seed/puppy-5.jpg', 0, true, 'Reksio at the foster home');

-- ---------------------------------------------------------------------------------------------
-- Buyer applications + reservation
-- ---------------------------------------------------------------------------------------------

insert into public.buyer_applications (
  id, animal_id, litter_id, buyer_id, organization_id, application_type, buyer_city, buyer_country,
  phone, housing_type, has_garden, has_children, previous_experience, intended_purpose,
  collection_method, message, status, breeder_response, submitted_at
) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'purchase',
   'Warsaw', 'Poland', '+48 555 123 456', 'house', true, false, '10 years with a golden retriever',
   'Family companion', 'pickup', 'We would love to welcome Fabian into our home.', 'approved',
   'Approved — looking forward to arranging collection.', now() - interval '10 days'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'purchase',
   'Warsaw', 'Poland', '+48 555 123 456', 'house', true, false, 'First-time owner, breed-focused research',
   'Sport', 'domestic_transport', 'Interested in agility training with Rico.', 'under_review', null, now() - interval '4 days'),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'purchase',
   'Warsaw', 'Poland', '+48 555 123 456', 'house', true, false, 'Grew up with dogs at home',
   'Family companion', 'pickup', 'Kora caught our eye immediately.', 'waiting_list', null, now() - interval '2 days');

insert into public.reservations (
  animal_id, litter_id, buyer_id, organization_id, application_id, status, agreed_price, currency,
  deposit_amount, deposit_status, agreement_status, planned_collection_date, collection_method
) values
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'confirmed', 6200, 'PLN',
   1000, 'paid', 'signed', '2026-07-25', 'pickup');

insert into public.saved_animals (buyer_id, animal_id) values
  ('10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005');

-- ---------------------------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------------------------

insert into public.vehicles (id, name, registration_number, vehicle_type, active, crates, temperature_monitoring, camera_available) values
  ('80000000-0000-0000-0000-000000000001', 'Anemalo Transporter 1', 'PO 1234H', 'van', true,
   '[{"size":"medium","quantity":6},{"size":"large","quantity":2}]', true, true);

insert into public.drivers (id, profile_id, name, contact, availability_status, internal_verification_status, emergency_contact) values
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'Marek Dąbrowski', '+48 607 888 999',
   'available', 'verified', 'Ewa Dąbrowska +48 607 888 111');

insert into public.transport_operator_authorisations (authorisation_type, authorisation_number, issuing_authority, valid_from, expiry_date, countries_covered, status) values
  ('type_2', 'PL-TRANS-2025-0042', 'Główny Inspektorat Weterynarii', '2025-01-01', '2027-12-31', array['Poland', 'Germany', 'Netherlands'], 'active');

-- ---------------------------------------------------------------------------------------------
-- Transport requests
-- ---------------------------------------------------------------------------------------------

insert into public.transport_requests (
  id, request_number, requester_profile_id, request_purpose, ownership_changing, animal_id,
  animal_name, breed_free_text, sex, has_passport, has_microchip, rabies_valid,
  pickup_country, pickup_city, pickup_area_approx, pickup_address_exact,
  destination_country, destination_city, destination_area_approx, destination_address_exact,
  earliest_date, latest_date, flexible_dates, delivery_type, number_of_animals,
  is_domestic, is_sale, is_ownership_change, health_certificate_required, medically_fit_for_transport,
  compliance_review_result, requested_service_type, status, visibility,
  confirmed_accurate, confirmed_authority, confirmed_will_provide_documents, confirmed_understands_review,
  confirmed_understands_publication_not_confirmation, assigned_vehicle_id, assigned_driver_id
) values
  ('a0000000-0000-0000-0000-000000000001', 'TR-2026-000001', '10000000-0000-0000-0000-000000000001', 'own_dog', false, null,
   'Fitch', 'Mixed breed, medium', 'male', true, true, true,
   'Poland', 'Warsaw', 'Śródmieście district', 'ul. Przykładowa 12/4',
   'Netherlands', 'Amsterdam', 'Amsterdam-West', 'Voorbeeldstraat 8',
   '2026-08-01', '2026-08-10', true, 'meeting_point', 1,
   false, false, false, true, true,
   'eligible_for_quotation', 'shared', 'ready_for_scheduling', 'community_visible',
   true, true, true, true, true, '80000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001'),

  ('a0000000-0000-0000-0000-000000000002', 'TR-2026-000002', '10000000-0000-0000-0000-000000000002', 'own_dog', false, null,
   'Luna', 'Beagle', 'female', true, true, true,
   'Poland', 'Warsaw', 'Mokotów district', 'ul. Puławska 100',
   'Poland', 'Kraków', 'Podgórze district', 'ul. Kalwaryjska 55',
   '2026-07-22', '2026-07-22', false, 'home_delivery', 1,
   true, false, false, false, true,
   'eligible_for_quotation', 'individual', 'in_transport', 'private',
   true, true, true, true, true, null, null),

  ('a0000000-0000-0000-0000-000000000003', 'TR-2026-000003', '10000000-0000-0000-0000-000000000001', 'relocation', false, null,
   'Max', 'German Shepherd', 'male', true, true, true,
   'Poland', 'Poznań', 'Grunwald district', null,
   'Germany', 'Berlin', 'Charlottenburg', null,
   '2026-07-30', '2026-08-02', false, 'meeting_point', 1,
   false, false, false, true, true,
   'eligible_for_quotation', 'express', 'quotation_sent', 'private',
   true, true, true, true, true, null, null),

  ('a0000000-0000-0000-0000-000000000004', 'TR-2026-000004', '10000000-0000-0000-0000-000000000001', 'own_dog', false, null,
   'Bianca', 'Cavalier King Charles Spaniel', 'female', true, true, true,
   'Netherlands', 'Rotterdam', 'Kralingen', null,
   'Poland', 'Wrocław', 'Krzyki district', null,
   '2026-08-05', '2026-08-12', true, 'home_delivery', 1,
   false, false, false, true, true,
   'eligible_for_quotation', 'vip', 'accepted_by_customer', 'private',
   true, true, true, true, true, null, null),

  ('a0000000-0000-0000-0000-000000000005', 'TR-2026-000005', '10000000-0000-0000-0000-000000000006', 'foundation_rescue', true, '60000000-0000-0000-0000-000000000011',
   'Reksio', 'German Shepherd', 'male', false, true, true,
   'Poland', 'Poznań', 'Foundation foster network', null,
   'Netherlands', 'Utrecht', 'Utrecht city', null,
   '2026-08-15', '2026-08-25', true, 'meeting_point', 1,
   false, false, true, true, true,
   'eligible_for_quotation', 'shared', 'documents_under_review', 'community_visible',
   true, true, true, true, true, '80000000-0000-0000-0000-000000000001', null),

  ('a0000000-0000-0000-0000-000000000006', 'TR-2026-000006', '10000000-0000-0000-0000-000000000002', 'purchased_puppy', true, null,
   'Nala', 'French Bulldog', 'female', false, false, false,
   'Poland', 'Gdańsk', 'Wrzeszcz district', null,
   'Poland', 'Warsaw', 'Wola district', null,
   '2026-07-28', '2026-08-05', true, 'meeting_point', 1,
   true, true, true, true, null,
   'documents_missing', 'individual', 'missing_information', 'private',
   true, true, false, true, true, null, null),

  ('a0000000-0000-0000-0000-000000000007', 'TR-2026-000007', '10000000-0000-0000-0000-000000000002', 'purchased_puppy', true, null,
   'Otto', 'Dachshund', 'male', true, true, false,
   'Czech Republic', 'Brno', 'Brno-střed', null,
   'Poland', 'Katowice', 'Śródmieście', null,
   '2026-08-10', '2026-08-20', true, 'meeting_point', 1,
   false, true, true, true, null,
   'veterinary_review_required', 'individual', 'veterinary_hold', 'private',
   true, true, true, true, true, null, null);

-- The 7 rows above supply request_number literals directly, never touching
-- public.transport_request_seq — left alone, the very next row created through the normal
-- set_transport_request_number() trigger (nextval() starting at 1) would generate 'TR-2026-000001'
-- and collide with the first seeded row. Advancing the sequence past every literal used above is
-- the real fix (found while testing create_transport_draft() directly against a freshly reset
-- database — this is a pre-existing gap the RPC was the first real caller to actually hit, since
-- every previous transport-creating test/flow happened to supply its own request_number).
select setval('public.transport_request_seq', 7, true);

-- transport_request_animals: one position-1 row per request, mirroring exactly what
-- 20260101006500_transport_request_animals.sql's backfill does for a database that already has
-- real transport_requests rows when it runs (this seed always loads after migrations, so that
-- backfill sees an empty table here — this manually reproduces its effect against the seed data so
-- local development and tests see the same fully-populated shape a real upgraded database would).
insert into public.transport_request_animals (
  transport_request_id, position, animal_id, name, breed_free_text, sex
) values
  ('a0000000-0000-0000-0000-000000000001', 1, null, 'Fitch', 'Mixed breed, medium', 'male'),
  ('a0000000-0000-0000-0000-000000000002', 1, null, 'Luna', 'Beagle', 'female'),
  ('a0000000-0000-0000-0000-000000000003', 1, null, 'Max', 'German Shepherd', 'male'),
  ('a0000000-0000-0000-0000-000000000004', 1, null, 'Bianca', 'Cavalier King Charles Spaniel', 'female'),
  ('a0000000-0000-0000-0000-000000000005', 1, '60000000-0000-0000-0000-000000000011', 'Reksio', 'German Shepherd', 'male'),
  ('a0000000-0000-0000-0000-000000000006', 1, null, 'Nala', 'French Bulldog', 'female'),
  ('a0000000-0000-0000-0000-000000000007', 1, null, 'Otto', 'Dachshund', 'male');

-- transport_parties: requester on every request (mirrors the migration's unconditional backfill),
-- plus a few real illustrative party rows so the previously-unused table has genuine seed data to
-- develop and test against — Reksio's rescue transport is requested by foundation1 acting for their
-- own foundation (a real sender-org case), and TR-2026-000001 has a real external delivery contact
-- (the exact free-text-only shape release/receive_authorized_by always had).
insert into public.transport_parties (transport_request_id, party_role, profile_id) values
  ('a0000000-0000-0000-0000-000000000001', 'requester', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'requester', '10000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003', 'requester', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'requester', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'requester', '10000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000006', 'requester', '10000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000007', 'requester', '10000000-0000-0000-0000-000000000002');

insert into public.transport_parties (transport_request_id, party_role, organisation_id) values
  ('a0000000-0000-0000-0000-000000000005', 'sender', '20000000-0000-0000-0000-000000000003');

insert into public.transport_parties (transport_request_id, party_role, external_name, external_phone) values
  ('a0000000-0000-0000-0000-000000000001', 'delivery_contact', 'Marta de Vries', '+31 6 1234 5678');

insert into public.quotations (transport_request_id, service_type, pickup, destination, planned_date_range, base_price, total_price, currency, expiry_date, status, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'shared', 'Warsaw, Poland', 'Amsterdam, Netherlands', '1–10 Aug 2026', 260, 320, 'EUR', '2026-07-28', 'accepted', '10000000-0000-0000-0000-000000000008'),
  ('a0000000-0000-0000-0000-000000000003', 'express', 'Poznań, Poland', 'Berlin, Germany', '30 Jul – 2 Aug 2026', 340, 410, 'EUR', '2026-07-27', 'sent', '10000000-0000-0000-0000-000000000008'),
  ('a0000000-0000-0000-0000-000000000004', 'vip', 'Rotterdam, Netherlands', 'Wrocław, Poland', '5–12 Aug 2026', 520, 640, 'EUR', '2026-08-01', 'accepted', '10000000-0000-0000-0000-000000000008');

insert into public.transport_status_history (transport_request_id, status, changed_at, changed_by, customer_note) values
  ('a0000000-0000-0000-0000-000000000001', 'submitted', now() - interval '9 days', '10000000-0000-0000-0000-000000000001', 'Request submitted.'),
  ('a0000000-0000-0000-0000-000000000001', 'quotation_prepared', now() - interval '7 days', '10000000-0000-0000-0000-000000000008', 'Quotation prepared for the Warsaw–Amsterdam shared route.'),
  ('a0000000-0000-0000-0000-000000000001', 'ready_for_scheduling', now() - interval '2 days', '10000000-0000-0000-0000-000000000008', 'Documents accepted — awaiting final route confirmation.'),

  ('a0000000-0000-0000-0000-000000000002', 'submitted', now() - interval '3 days', '10000000-0000-0000-0000-000000000002', 'Request submitted.'),
  ('a0000000-0000-0000-0000-000000000002', 'scheduled', now() - interval '2 days', '10000000-0000-0000-0000-000000000008', 'Scheduled for domestic pickup.'),
  ('a0000000-0000-0000-0000-000000000002', 'in_transport', now() - interval '1 hours', '10000000-0000-0000-0000-000000000009', 'On the way to Kraków.'),

  ('a0000000-0000-0000-0000-000000000003', 'submitted', now() - interval '5 days', '10000000-0000-0000-0000-000000000001', 'Request submitted.'),
  ('a0000000-0000-0000-0000-000000000003', 'quotation_sent', now() - interval '2 days', '10000000-0000-0000-0000-000000000008', 'Express quotation sent — awaiting your acceptance.'),

  ('a0000000-0000-0000-0000-000000000004', 'submitted', now() - interval '6 days', '10000000-0000-0000-0000-000000000001', 'Request submitted.'),
  ('a0000000-0000-0000-0000-000000000004', 'quotation_sent', now() - interval '4 days', '10000000-0000-0000-0000-000000000008', 'VIP quotation sent.'),
  ('a0000000-0000-0000-0000-000000000004', 'accepted_by_customer', now() - interval '3 days', '10000000-0000-0000-0000-000000000001', 'Quotation accepted.'),

  ('a0000000-0000-0000-0000-000000000005', 'submitted', now() - interval '4 days', '10000000-0000-0000-0000-000000000006', 'Request submitted on behalf of the foundation.'),
  ('a0000000-0000-0000-0000-000000000005', 'documents_under_review', now() - interval '1 days', '10000000-0000-0000-0000-000000000008', 'Reviewing adoption and health documents.'),

  ('a0000000-0000-0000-0000-000000000006', 'submitted', now() - interval '2 days', '10000000-0000-0000-0000-000000000002', 'Request submitted.'),
  ('a0000000-0000-0000-0000-000000000006', 'missing_information', now() - interval '1 days', '10000000-0000-0000-0000-000000000008', 'Microchip number and passport are still missing — please upload when available.'),

  ('a0000000-0000-0000-0000-000000000007', 'submitted', now() - interval '3 days', '10000000-0000-0000-0000-000000000002', 'Request submitted.'),
  ('a0000000-0000-0000-0000-000000000007', 'veterinary_hold', now() - interval '1 days', '10000000-0000-0000-0000-000000000008', 'On hold pending a valid rabies vaccination / health certificate review.');

insert into public.routes (id, route_name, departure_date, origin_country, origin_region, destination_countries, destination_regions, vehicle_id, driver_id, max_capacity, status) values
  ('b0000000-0000-0000-0000-000000000001', 'Warsaw–Amsterdam shared route', '2026-08-08', 'Poland', 'Mazowieckie',
   array['Netherlands'], array['North Holland'], '80000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 6, 'confirmed');

insert into public.route_assignments (route_id, transport_request_id, compatibility_checked, compatibility_notes, assigned_by)
select 'b0000000-0000-0000-0000-000000000001', tr.id, true, 'Both animals travel well with others, compatible crate sizes.', '10000000-0000-0000-0000-000000000008'
from public.transport_requests tr
where tr.id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005');

update public.transport_requests
set assigned_route_id = 'b0000000-0000-0000-0000-000000000001'
where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005');
