-- Demo accounts for sophros, in the LOCAL database only (scripts/demo.sh up). Every case the dashboard
-- handles: a ban and a new account on the same iPhone, a selfie to compare, a selfie owed, reports
-- (3 reporters, underage), flagged chat photos, a second look at a photo, support requests, an export.
--
-- Triggers are off while they go in (session_replication_role = replica): no email, push, Stream or R2
-- call, no Realtime event. Every row is written here, derived rows included. The accounts have no card
-- and photo_count 0, so the app's Discover never shows them. Emails end in @demo.sophros.test and ids
-- start with de000000-, which is how down.sql finds them.
set session_replication_role = replica;

create temp table demo (
  n int primary key,
  name text, email text, phone text, gender public.gender, birthdate date, lang text,
  created interval, active interval, hold public.moderation_state, onboarded boolean,
  lat double precision, lng double precision, neighborhood text, bio text, sports text[]
);

insert into demo values
  (1,  'Léa',     'lea',     '33611000001', 'woman', '1996-04-12', 'fr', '90 days', '10 minutes', null,     true,  48.867, 2.363, 'Canal Saint-Martin', 'Runner du dimanche, grimpeuse le mercredi. Cherche quelqu''un pour les 10 km de Paris.', '{running,climbing}'),
  (2,  'Hugo',    'hugo',    '33611000002', 'man',   '1990-01-03', 'fr', '60 days', '3 days',     'banned', true,  48.853, 2.349, 'Latin Quarter', 'Coach sportif certifié, programmes sur mesure.', '{strength,running}'),
  (3,  'Hugo',    'hugo.m',  '33611000003', 'man',   '1990-01-03', 'fr', '1 day',   '2 hours',    'review', true,  48.851, 2.352, 'Latin Quarter', 'Nouveau ici. Coach, programmes sur mesure.', '{strength}'),
  (4,  'Camille', 'camille', '33611000004', 'woman', '1998-07-21', 'fr', '20 days', '1 hour',     'review', true,  48.884, 2.340, 'Montmartre', 'Yoga le matin, padel le soir.', '{yoga,padel}'),
  (5,  'Inès',    'ines',    '33611000005', 'woman', '1999-02-02', 'fr', '12 days', '5 hours',    'selfie', true,  48.840, 2.320, 'Montparnasse', 'Mannequin, marathon en préparation.', '{running}'),
  (6,  'Mehdi',   'mehdi',   '33611000006', 'man',   '1993-11-30', 'fr', '45 days', '30 minutes', 'review', true,  45.764, 4.835, 'Presqu''île', 'Foot à 5 et vélo.', '{football,cycling}'),
  (7,  'Sarah',   'sarah',   '447700900007','woman', '1995-05-09', 'en', '30 days', '2 hours',    null,     true,  48.870, 2.310, 'Batignolles', 'Swimmer, new in Paris.', '{swimming,triathlon}'),
  (8,  'Tom',     'tom',     '33611000008', 'man',   '1997-08-15', 'fr', '25 days', '20 minutes', null,     true,  48.860, 2.380, 'Oberkampf', 'Crossfit et bonne humeur.', '{crossfit}'),
  (9,  'Chloé',   'chloe',   '33611000009', 'woman', '2000-03-03', 'fr', '8 days',  '1 day',      null,     true,  48.830, 2.355, 'Butte-aux-Cailles', 'Trail et randonnée.', '{trail,hiking}'),
  (10, 'Nathan',  'nathan',  '34600000010', 'man',   '1994-12-01', 'es', '5 days',  '3 hours',    null,     true,  48.845, 2.370, 'Bastille', 'Surfeur exilé à Paris.', '{surfing,skateboarding}'),
  (11, 'Emma',    'emma',    '4915100000011','woman','1992-06-18', 'de', '70 days', '6 hours',    null,     true,  52.520, 13.405, 'Mitte', 'Rudern und Radfahren.', '{rowing,cycling}'),
  (12, 'Lucas',   'lucas',   null,          'man',   '2001-10-10', 'fr', '1 day',   '1 day',      null,     false, null,   null,  '', '', '{}'),
  (13, 'Jade',    'jade',    '33611000013', 'woman', '2007-09-01', 'fr', '4 days',  '4 hours',    'review', true,  48.890, 2.390, 'Belleville', 'Danse et volley. J''ai 16 ans mais chut.', '{dance,volleyball}'),
  (14, 'Paul',    'paul',    '33611000014', 'man',   '1991-03-27', 'fr', '50 days', '1 hour',     null,     true,  48.872, 2.370, 'Canal Saint-Martin', 'Running club le jeudi, tennis le week-end.', '{running,runClub,tennis}');

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- MARK: Accounts

insert into auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at,
    phone_confirmed_at, created_at, updated_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data)
  select pg_temp.uid(n), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    email || '@demo.sophros.test', phone, '', now() - created, case when phone is not null then now() - created end,
    now() - created, now(), now() - active - interval '1 hour', jsonb_build_object('language', lang),
    '{"provider": "email", "providers": ["email"]}'
  from demo;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select pg_temp.uid(n)::text, pg_temp.uid(n), jsonb_build_object('sub', pg_temp.uid(n), 'email', email || '@demo.sophros.test'),
    'email', now() - created, now(), now() - active
  from demo;
-- Léa also signs in with Apple.
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values ('001234.demo.lea', pg_temp.uid(1), '{"sub": "001234.demo.lea"}', 'apple', now() - interval '80 days', now(), now() - interval '2 days');

insert into public.profiles (id, name, birthdate, gender, interested_in, neighborhood, bio, goal, favorite_spot,
    sport_ids, photo_count, onboarded_at, paused, last_active_at, created_at, language, moderation)
  select pg_temp.uid(n), name, birthdate, gender,
    case when gender = 'woman' then '{man}'::public.gender[] else '{woman}'::public.gender[] end,
    neighborhood, bio, case when onboarded then 'Trouver un partenaire d''entraînement régulier' else '' end,
    case when onboarded then 'Parc des Buttes-Chaumont' else '' end,
    sports, 0, case when onboarded then now() - created + interval '20 minutes' end,
    hold is not null, now() - active, now() - created, lang, hold
  from demo;

insert into public.profile_sports (user_id, sport_id, per_week, position)
  select pg_temp.uid(n), s.sport, 1 + (n + s.i::int) % 4, s.i - 1
  from demo, unnest(sports) with ordinality as s(sport, i);

insert into public.profile_prompts (user_id, position, question, answer)
  select pg_temp.uid(n), 0, 'Mon spot préféré', 'Les quais de Seine au lever du soleil'
  from demo where onboarded;

insert into public.wallets (user_id, super_likes, boosts, premium_until)
  select pg_temp.uid(n), case n when 1 then 3 else 0 end, case n when 1 then 2 else 0 end,
    case n when 14 then now() + interval '20 days' end
  from demo;

insert into private.locations (user_id, geo, updated_at)
  select pg_temp.uid(n), extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography, now() - active
  from demo where lat is not null;

-- Holds: the owner's own pause, the history.
insert into private.moderation_holds (user_id, was_paused) select pg_temp.uid(n), false from demo where hold is not null;

insert into private.moderation_log (user_id, state, note, actor, created_at) values
  (pg_temp.uid(2), 'review', 'reported by 3 people in 30 days', null, now() - interval '9 days'),
  (pg_temp.uid(2), 'banned', 'Scam: asked 3 members for money for a coaching programme', 'maya@demo.sophros.test', now() - interval '8 days'),
  (pg_temp.uid(3), 'review', 'device used by a closed account', null, now() - interval '20 hours'),
  (pg_temp.uid(4), 'selfie', 'Photos look professional, check it''s her', 'maya@demo.sophros.test', now() - interval '2 days'),
  (pg_temp.uid(4), 'review', 'selfie sent', null, now() - interval '3 hours'),
  (pg_temp.uid(5), 'selfie', 'Photos match a model''s public account', 'maya@demo.sophros.test', now() - interval '1 day'),
  (pg_temp.uid(6), 'review', 'reported by 3 people in 30 days', null, now() - interval '6 hours'),
  (pg_temp.uid(13), 'review', 'reported as underage', null, now() - interval '2 hours');

-- The ban's marks: the same email, phone or sign-in can't come back.
insert into private.identity_marks (kind, hash, state, user_id)
  select kind, hash, 'banned', pg_temp.uid(2) from private.account_identities(pg_temp.uid(2));

-- MARK: Photos

create temp table demo_media as
  select n, pos, pg_temp.uid(n) as user_id, 'u/' || pg_temp.uid(n) || '/demo/p' || pos || '.jpg' as key,
    case
      when n = 9 and pos = 2 then 'pending'
      when n = 10 and pos = 2 then 'pending'
      else 'approved'
    end::public.media_status as status,
    case when n = 9 and pos = 2 then now() - interval '2 hours' end as review_requested_at,
    now() - (select created from demo d where d.n = x.n) + interval '30 minutes' + pos * interval '1 minute' as created_at
  from (select n from demo where onboarded) x, generate_series(0, case when n in (1, 4, 14) then 3 else 2 end) pos;
update demo_media set created_at = now() - interval '3 hours' where n = 10 and pos = 2;

insert into public.profile_media (user_id, kind, key, position, width, height, status, created_at, review_requested_at)
  select user_id, 'photo', key, pos, 600, 800, status, created_at, review_requested_at from demo_media;

-- MARK: Matches, chats, sessions

create temp table demo_matches (a int, b int, days int, ended_by int);
insert into demo_matches values (1, 14, 20, null), (6, 7, 10, null), (4, 8, 6, null), (2, 7, 12, 7), (1, 9, 3, null);

insert into public.swipes (swiper, target, action, created_at)
  select pg_temp.uid(a), pg_temp.uid(b), 'like'::public.swipe_action, now() - (days || ' days')::interval - interval '1 hour' from demo_matches
  union all
  select pg_temp.uid(b), pg_temp.uid(a), 'like'::public.swipe_action, now() - (days || ' days')::interval from demo_matches
  union all
  select pg_temp.uid(s), pg_temp.uid(t), act::public.swipe_action, now() - (s || ' hours')::interval
  from (values (8, 5, 'like'), (8, 9, 'like'), (8, 11, 'like'), (8, 13, 'superlike'), (10, 4, 'pass'), (3, 1, 'like')) v(s, t, act);

insert into public.matches (user_a, user_b, created_at, ended_at, ended_by)
  select least(pg_temp.uid(a), pg_temp.uid(b)), greatest(pg_temp.uid(a), pg_temp.uid(b)), now() - (days || ' days')::interval,
    case when ended_by is not null then now() - interval '9 days' end, pg_temp.uid(ended_by)
  from demo_matches;

insert into public.sessions (match_id, proposer_id, sport_id, options, chosen_at, title, note, status, created_at)
  select m.id, pg_temp.uid(14), 'running', array[date_trunc('day', now()) + interval '1 day 8 hours'],
    date_trunc('day', now()) + interval '1 day 8 hours', 'Footing canal', '8 km tranquille, départ République', 'accepted',
    now() - interval '2 days'
  from public.matches m where m.user_a = pg_temp.uid(1) and m.user_b = pg_temp.uid(14);

insert into public.blocks (blocker, blocked, created_at) values
  (pg_temp.uid(7), pg_temp.uid(6), now() - interval '5 hours'),
  (pg_temp.uid(11), pg_temp.uid(8), now() - interval '4 days');

-- MARK: Reports

insert into public.reports (reporter, reported, reason, details, created_at, handled_at, handled_by, resolution) values
  (pg_temp.uid(7), pg_temp.uid(6), 'harassment', 'Insults after I declined a session. Screenshots available.', now() - interval '7 hours', null, null, null),
  (pg_temp.uid(11), pg_temp.uid(6), 'harassment', 'Aggressive messages at 2 am.', now() - interval '3 days', null, null, null),
  (pg_temp.uid(1), pg_temp.uid(6), 'spam', 'Keeps sending the same link.', now() - interval '6 hours', null, null, null),
  (pg_temp.uid(4), pg_temp.uid(8), 'inappropriate_photos', 'Sent explicit photos in the chat without asking.', now() - interval '1 day', null, null, null),
  (pg_temp.uid(14), pg_temp.uid(13), 'underage', 'Says she''s 16 in her bio.', now() - interval '2 hours', null, null, null),
  (pg_temp.uid(7), pg_temp.uid(2), 'spam', 'Asked for 49 euros for a coaching programme.', now() - interval '9 days', now() - interval '8 days', 'maya@demo.sophros.test', 'Scam confirmed in 3 conversations, banned'),
  (pg_temp.uid(9), pg_temp.uid(10), 'fake', 'His photos are on someone else''s Instagram.', now() - interval '2 days', now() - interval '1 day', 'maya@demo.sophros.test', 'Reverse image search found nothing, no action');

-- MARK: Flagged media (the silent checks)

insert into public.media_flags (user_id, context, key, verdict, labels, created_at, reviewed_at, reviewed_by)
  select pg_temp.uid(n), ctx, k, verdict, labels::text[], now() - (hrs || ' hours')::interval,
    case when done then now() - interval '1 hour' end, case when done then 'maya@demo.sophros.test' end
  from (values
    (8, 'chat', 'u/de000000-0000-4000-8000-000000000008/chat/demo/c1.jpg', 'rejected', '{Explicit Nudity,Nudity}', 20, false),
    (8, 'chat', 'u/de000000-0000-4000-8000-000000000008/chat/demo/c2.jpg', 'rejected', '{Explicit Nudity}', 19, false),
    (8, 'chat', 'u/de000000-0000-4000-8000-000000000008/chat/demo/c3.jpg', 'review', '{Suggestive,Revealing Clothes}', 30, false),
    (8, 'chat', 'u/de000000-0000-4000-8000-000000000008/chat/demo/c4.jpg', 'review', '{Suggestive}', 72, true),
    (2, 'chat', 'u/de000000-0000-4000-8000-000000000002/chat/demo/c1.jpg', 'rejected', '{Graphic Violence}', 200, false),
    (7, 'chat', 'u/de000000-0000-4000-8000-000000000007/chat/demo/c1.jpg', 'review', '{Swimwear or Underwear}', 5, false),
    (10, 'profile', 'u/de000000-0000-4000-8000-000000000010/demo/p2.jpg', 'review', '{Suggestive,Partially Exposed}', 3, false),
    (9, 'profile', 'u/de000000-0000-4000-8000-000000000009/demo/p2.jpg', 'rejected', '{Alcohol,Drinking}', 26, false)
  ) v(n, ctx, k, verdict, labels, hrs, done);

-- MARK: Verifications

insert into private.selfie_checks (user_id, path, created_at)
  values (pg_temp.uid(4), pg_temp.uid(4) || '/demo/selfie.jpg', now() - interval '3 hours');

-- MARK: Support

insert into private.support_requests (reference, user_id, email, language, topic, message, context, created_at, handled_at, handled_by) values
  ('DR-DEMO01', pg_temp.uid(2), 'hugo@demo.sophros.test', 'fr', 'A mistake?', 'Je ne comprends pas pourquoi mon compte est bloqué, je suis coach diplômé et je proposais juste mes services.', '{"hold": "banned", "app": "1.0 (42)", "screen": "hold"}', now() - interval '7 days', null, null),
  ('DR-DEMO02', pg_temp.uid(4), 'camille@demo.sophros.test', 'fr', 'Verification', 'J''ai envoyé mon selfie il y a 3 heures, c''est long ?', '{"hold": "review", "app": "1.0 (42)"}', now() - interval '40 minutes', null, null),
  ('DR-DEMO03', null, 'jo.doe@demo.sophros.test', 'en', 'Sign-up', 'I never get the SMS code, I tried 4 times with my UK number.', '{"screen": "phone", "app": "1.0 (42)"}', now() - interval '5 hours', null, null),
  ('DR-DEMO04', pg_temp.uid(11), 'emma@demo.sophros.test', 'de', 'Your data', 'Ich möchte wissen, welche Daten ihr über mich speichert.', '{"app": "1.0 (41)"}', now() - interval '1 day', null, null),
  ('DR-DEMO05', pg_temp.uid(1), 'lea@demo.sophros.test', 'fr', 'Purchases', 'Mon boost n''a pas marché hier soir.', '{"app": "1.0 (42)"}', now() - interval '3 days', now() - interval '2 days', 'sam@demo.sophros.test');

insert into private.data_requests (user_id, created_at) values (pg_temp.uid(11), now() - interval '1 day');

-- MARK: Purchases

insert into public.purchase_events (id, type, user_id, product_id, environment, event_at, effect) values
  ('demo-evt-1', 'INITIAL_PURCHASE', pg_temp.uid(14), 'so.drafft.app.tempo.monthly', 'PRODUCTION', now() - interval '10 days', 'premium_until ' || to_char(now() + interval '20 days', 'YYYY-MM-DD')),
  ('demo-evt-2', 'NON_RENEWING_PURCHASE', pg_temp.uid(1), 'so.drafft.app.boost.5', 'PRODUCTION', now() - interval '4 days', '+5 boost'),
  ('demo-evt-3', 'NON_RENEWING_PURCHASE', pg_temp.uid(1), 'so.drafft.app.superlike.3', 'SANDBOX', now() - interval '30 days', '+3 superlike');

-- MARK: Devices, IPs, sessions

create temp table demo_devices (n int, install uuid, model text, os text, app text, build text, locale text, tz text, ip inet, country text, opens int, first_ago interval, last_ago interval);
insert into demo_devices values
  (1,  'de0000aa-0000-4000-8000-000000000001', 'iPhone17,1', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '82.64.10.21', 'FR', 214, '90 days', '10 minutes'),
  (2,  'de0000aa-0000-4000-8000-000000000002', 'iPhone14,5', '18.6', '1.0', '40', 'fr_FR', 'Europe/Paris', '91.170.12.34', 'FR', 88, '60 days', '3 days'),
  (3,  'de0000aa-0000-4000-8000-000000000002', 'iPhone14,5', '18.6', '1.0', '42', 'fr_FR', 'Europe/Paris', '91.170.12.34', 'FR', 6, '1 day', '2 hours'),
  (4,  'de0000aa-0000-4000-8000-000000000004', 'iPhone16,2', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '78.193.4.7', 'FR', 57, '20 days', '1 hour'),
  (5,  'de0000aa-0000-4000-8000-000000000005', 'iPhone15,3', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '37.170.2.90', 'FR', 31, '12 days', '5 hours'),
  (5,  'de0000aa-0000-4000-8000-000000000055', 'iPhone12,1', '17.7', '1.0', '41', 'uk_UA', 'Europe/Kyiv', '46.219.33.12', 'UA', 3, '11 days', '9 days'),
  (6,  'de0000aa-0000-4000-8000-000000000006', 'iPhone13,2', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '90.12.77.3', 'FR', 140, '45 days', '30 minutes'),
  (7,  'de0000aa-0000-4000-8000-000000000007', 'iPhone17,2', '26.0', '1.0', '42', 'en_GB', 'Europe/Paris', '82.64.10.99', 'FR', 76, '30 days', '2 hours'),
  (8,  'de0000aa-0000-4000-8000-000000000008', 'iPhone16,1', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '176.160.5.8', 'FR', 97, '25 days', '20 minutes'),
  (9,  'de0000aa-0000-4000-8000-000000000009', 'iPhone15,4', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '109.23.4.56', 'FR', 18, '8 days', '1 day'),
  (10, 'de0000aa-0000-4000-8000-000000000010', 'iPhone14,7', '18.5', '1.0', '42', 'es_ES', 'Europe/Madrid', '88.26.1.9', 'FR', 12, '5 days', '3 hours'),
  (11, 'de0000aa-0000-4000-8000-000000000011', 'iPhone17,3', '26.0', '1.0', '41', 'de_DE', 'Europe/Berlin', '93.214.5.61', 'DE', 45, '70 days', '6 hours'),
  (12, 'de0000aa-0000-4000-8000-000000000012', 'iPhone11,8', '18.7', '1.0', '42', 'fr_FR', 'Europe/Paris', '92.184.100.3', 'FR', 2, '1 day', '1 day'),
  (13, 'de0000aa-0000-4000-8000-000000000013', 'iPhone13,1', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '92.184.100.3', 'FR', 9, '4 days', '4 hours'),
  (14, 'de0000aa-0000-4000-8000-000000000014', 'iPhone17,1', '26.0', '1.0', '42', 'fr_FR', 'Europe/Paris', '82.64.10.21', 'FR', 160, '50 days', '1 hour');

insert into private.devices (user_id, install_id, model, os_version, app_version, app_build, locale, timezone, ip, country, opens, first_seen_at, last_seen_at)
  select pg_temp.uid(n), install, model, os, app, build, locale, tz, ip, country, opens, now() - first_ago, now() - last_ago from demo_devices;

insert into private.ips (user_id, ip, country, first_seen_at, last_seen_at)
  select pg_temp.uid(n), ip, country, now() - first_ago, now() - last_ago from demo_devices
  on conflict do nothing;
insert into private.ips (user_id, ip, country, first_seen_at, last_seen_at) values
  (pg_temp.uid(1), '37.171.50.2', 'FR', now() - interval '40 days', now() - interval '12 days'),
  (pg_temp.uid(8), '37.171.50.2', 'FR', now() - interval '20 days', now() - interval '6 days');

insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent, ip, aal)
  select gen_random_uuid(), pg_temp.uid(n), now() - first_ago, now() - last_ago, (now() - last_ago)::timestamp,
    'drafft/' || build || ' CFNetwork/3826.500.131 Darwin/25.0.0', ip, 'aal1'
  from demo_devices where n <> 2;

insert into public.push_tokens (token, user_id, environment, updated_at)
  select 'demo' || md5(n::text || install::text), pg_temp.uid(n), 'production', now() - last_ago from demo_devices where n <> 2;

insert into private.device_checks (user_id, token, environment, flagged_at, updated_at)
  select pg_temp.uid(n), 'demo-devicecheck-token-' || n, 'production', case when n = 3 then now() - interval '20 hours' end, now() - last_ago
  from demo_devices where n in (1, 2, 3, 4, 6, 8, 14);

-- MARK: Staff and their trail

insert into private.staff (email, role, created_by, last_seen_at) values
  ('maya@demo.sophros.test', 'moderator', 'dev@drafft.local', now() - interval '1 hour'),
  ('sam@demo.sophros.test', 'support', 'dev@drafft.local', now() - interval '2 days')
  on conflict (email) do nothing;

insert into private.staff_notes (user_id, author, body, created_at) values
  (pg_temp.uid(6), 'maya@demo.sophros.test', 'Read the conversation with Sarah: insults after she declined. Two other reports the same week. Leaning towards a ban, second opinion welcome.', now() - interval '5 hours'),
  (pg_temp.uid(3), 'maya@demo.sophros.test', 'Same iPhone and same IP as Hugo (banned for a coaching scam). Same bio too.', now() - interval '18 hours'),
  (pg_temp.uid(8), 'sam@demo.sophros.test', 'Camille wrote to support about explicit photos from him.', now() - interval '20 hours');

insert into private.admin_audit (actor, action, user_id, target, reason, details, created_at) values
  ('maya@demo.sophros.test', 'conversation.view', pg_temp.uid(2), null, 'report: coaching scam', '{}', now() - interval '8 days 1 hour'),
  ('maya@demo.sophros.test', 'hold.set', pg_temp.uid(2), null, 'Scam: asked 3 members for money for a coaching programme', '{"from": "review", "to": "banned"}', now() - interval '8 days'),
  ('maya@demo.sophros.test', 'report.resolve', pg_temp.uid(2), null, 'Scam confirmed in 3 conversations, banned', '{}', now() - interval '8 days'),
  ('maya@demo.sophros.test', 'hold.set', pg_temp.uid(4), null, 'Photos look professional, check it''s her', '{"from": null, "to": "selfie"}', now() - interval '2 days'),
  ('maya@demo.sophros.test', 'hold.set', pg_temp.uid(5), null, 'Photos match a model''s public account', '{"from": null, "to": "selfie"}', now() - interval '1 day'),
  ('maya@demo.sophros.test', 'user.view', pg_temp.uid(3), null, null, '{}', now() - interval '18 hours'),
  ('maya@demo.sophros.test', 'note.add', pg_temp.uid(3), null, null, '{}', now() - interval '18 hours'),
  ('maya@demo.sophros.test', 'conversation.view', pg_temp.uid(6), null, 'report: harassment', '{}', now() - interval '5 hours'),
  ('maya@demo.sophros.test', 'note.add', pg_temp.uid(6), null, null, '{}', now() - interval '5 hours'),
  ('sam@demo.sophros.test', 'support.close', pg_temp.uid(1), 'DR-DEMO05', null, '{}', now() - interval '2 days'),
  ('maya@demo.sophros.test', 'flag.resolve', pg_temp.uid(8), null, 'swimsuit photo, fine', '{}', now() - interval '1 hour');

set session_replication_role = origin;

-- What demo.sh draws and uploads: key|label.
select key || '|' || replace(label, ' ', '_') from (
  select m.key, d.name || ' ' || (m.pos + 1) as label from demo_media m join demo d using (n)
  union all select key, 'chat photo' from public.media_flags where key like 'u/de000000-%/chat/%'
) k;
