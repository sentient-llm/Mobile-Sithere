create extension if not exists pgcrypto;

create type public.user_role as enum ('owner', 'walker', 'admin');
create type public.walk_status as enum ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled');
create type public.walk_session_status as enum ('not_started', 'active', 'paused', 'ended');
create type public.payment_status as enum ('requires_payment_method', 'requires_confirmation', 'processing', 'succeeded', 'cancelled', 'failed', 'refunded');
create type public.availability_status as enum ('available', 'busy', 'on_walk', 'off_duty');
create type public.notification_type as enum ('new_booking', 'booking_accepted', 'booking_declined', 'booking_cancelled', 'walk_started', 'walk_completed', 'report_ready', 'owner_rating', 'chat_message', 'payment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  email text not null,
  phone text,
  avatar_path text,
  apple_user_id text,
  stripe_customer_id text,
  stripe_account_id text,
  push_enabled boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (length(trim(email)) > 3),
  constraint profiles_full_name_not_blank check (length(trim(full_name)) > 0)
);

create table public.owner_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.walker_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text not null default '',
  rate_cents integer not null default 2200 check (rate_cents >= 0),
  tags text[] not null default array['Drop-in']::text[],
  years_experience integer not null default 0 check (years_experience >= 0),
  verified boolean not null default false,
  availability public.availability_status not null default 'available',
  service_radius_miles numeric(5, 2) not null default 5.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  breed text,
  age_years numeric(4, 1),
  weight_lbs numeric(5, 1),
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.walk_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete restrict,
  walker_id uuid references public.profiles(id) on delete set null,
  requested_start_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (20, 30, 45, 60)),
  service_name text not null default 'Drop-in Walk',
  status public.walk_status not null default 'pending',
  address text,
  notes text,
  walker_rate_cents integer not null default 0 check (walker_rate_cents >= 0),
  service_fee_cents integer not null default 200 check (service_fee_cents >= 0),
  total_cents integer generated always as (walker_rate_cents + service_fee_cents) stored,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.walk_assignments (
  id uuid primary key default gen_random_uuid(),
  walk_request_id uuid not null unique references public.walk_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid not null references public.profiles(id) on delete cascade,
  status public.walk_status not null default 'pending',
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.walk_sessions (
  id uuid primary key default gen_random_uuid(),
  walk_request_id uuid not null unique references public.walk_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete restrict,
  status public.walk_session_status not null default 'not_started',
  started_at timestamptz,
  ended_at timestamptz,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  distance_miles numeric(8, 3) not null default 0 check (distance_miles >= 0),
  potty_count integer not null default 0 check (potty_count >= 0),
  water_count integer not null default 0 check (water_count >= 0),
  photo_count integer not null default 0 check (photo_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_locations (
  walk_session_id uuid primary key references public.walk_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision,
  heading_degrees double precision,
  speed_mps double precision,
  elapsed_seconds integer not null default 0,
  distance_miles numeric(8, 3) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  walk_session_id uuid not null unique references public.walk_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete restrict,
  mood text not null,
  notes text,
  potty_pee integer not null default 0 check (potty_pee >= 0),
  potty_poop integer not null default 0 check (potty_poop >= 0),
  ate boolean not null default false,
  drank boolean not null default false,
  owner_rating integer check (owner_rating between 1 and 5),
  owner_comment text,
  owner_rated_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  walk_request_id uuid references public.walk_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (walk_request_id, owner_id, walker_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  walk_request_id uuid not null references public.walk_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid references public.profiles(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status public.payment_status not null default 'requires_payment_method',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.walker_payouts (
  id uuid primary key default gen_random_uuid(),
  walker_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending',
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios',
  token text not null,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create table public.vet_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  latitude double precision,
  longitude double precision,
  emergency boolean not null default false,
  hours text,
  rating numeric(2, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index walk_requests_owner_idx on public.walk_requests(owner_id, created_at desc);
create index walk_requests_walker_idx on public.walk_requests(walker_id, created_at desc);
create index walk_assignments_walker_idx on public.walk_assignments(walker_id, created_at desc);
create index reports_owner_idx on public.reports(owner_id, submitted_at desc);
create index reports_walker_idx on public.reports(walker_id, submitted_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_owner_profiles_updated_at before update on public.owner_profiles for each row execute function public.set_updated_at();
create trigger set_walker_profiles_updated_at before update on public.walker_profiles for each row execute function public.set_updated_at();
create trigger set_pets_updated_at before update on public.pets for each row execute function public.set_updated_at();
create trigger set_walk_requests_updated_at before update on public.walk_requests for each row execute function public.set_updated_at();
create trigger set_walk_assignments_updated_at before update on public.walk_assignments for each row execute function public.set_updated_at();
create trigger set_walk_sessions_updated_at before update on public.walk_sessions for each row execute function public.set_updated_at();
create trigger set_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();
create trigger set_conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_walker_payouts_updated_at before update on public.walker_payouts for each row execute function public.set_updated_at();
create trigger set_device_tokens_updated_at before update on public.device_tokens for each row execute function public.set_updated_at();
create trigger set_vet_locations_updated_at before update on public.vet_locations for each row execute function public.set_updated_at();

create or replace function public.create_walk_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.walker_id is not null then
    insert into public.walk_assignments (walk_request_id, owner_id, walker_id, status)
    values (new.id, new.owner_id, new.walker_id, new.status)
    on conflict (walk_request_id)
    do update set walker_id = excluded.walker_id, status = excluded.status, updated_at = now();
  end if;
  return new;
end;
$$;

create trigger create_walk_assignment_after_insert
after insert on public.walk_requests
for each row execute function public.create_walk_assignment();

create or replace function public.sync_walk_assignment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.walk_requests
  set status = new.status, updated_at = now()
  where id = new.walk_request_id;
  return new;
end;
$$;

create trigger sync_walk_assignment_status_after_update
after update of status on public.walk_assignments
for each row execute function public.sync_walk_assignment_status();

alter table public.profiles enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.walker_profiles enable row level security;
alter table public.pets enable row level security;
alter table public.walk_requests enable row level security;
alter table public.walk_assignments enable row level security;
alter table public.walk_sessions enable row level security;
alter table public.live_locations enable row level security;
alter table public.reports enable row level security;
alter table public.report_photos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.walker_payouts enable row level security;
alter table public.device_tokens enable row level security;
alter table public.vet_locations enable row level security;

create policy "profiles_select_related" on public.profiles for select using (
  auth.uid() = id
  or exists (select 1 from public.walk_requests wr where wr.owner_id = auth.uid() and wr.walker_id = profiles.id)
  or exists (select 1 from public.walk_requests wr where wr.walker_id = auth.uid() and wr.owner_id = profiles.id)
  or exists (select 1 from public.walker_profiles wp where wp.user_id = profiles.id and profiles.role = 'walker')
);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id);

create policy "owner_profiles_self" on public.owner_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "walker_profiles_public_select" on public.walker_profiles for select using (true);
create policy "walker_profiles_self_write" on public.walker_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pets_owner_all" on public.pets for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "pets_walker_assigned_read" on public.pets for select using (
  exists (select 1 from public.walk_requests wr where wr.pet_id = pets.id and wr.walker_id = auth.uid())
);

create policy "walk_requests_participants_select" on public.walk_requests for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "walk_requests_owner_insert" on public.walk_requests for insert with check (auth.uid() = owner_id);
create policy "walk_requests_owner_update" on public.walk_requests for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "walk_requests_walker_status_update" on public.walk_requests for update using (auth.uid() = walker_id) with check (auth.uid() = walker_id);

create policy "walk_assignments_participants" on public.walk_assignments for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "walk_assignments_walker_update" on public.walk_assignments for update using (auth.uid() = walker_id) with check (auth.uid() = walker_id);

create policy "walk_sessions_participants" on public.walk_sessions for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "walk_sessions_walker_all" on public.walk_sessions for all using (auth.uid() = walker_id) with check (auth.uid() = walker_id);

create policy "live_locations_participants_select" on public.live_locations for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "live_locations_walker_all" on public.live_locations for all using (auth.uid() = walker_id) with check (auth.uid() = walker_id);

create policy "reports_participants_select" on public.reports for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "reports_walker_insert" on public.reports for insert with check (auth.uid() = walker_id);
create policy "reports_owner_rate" on public.reports for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "report_photos_participants_select" on public.report_photos for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "report_photos_walker_insert" on public.report_photos for insert with check (auth.uid() = walker_id);

create policy "conversations_participants" on public.conversations for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "conversations_participant_insert" on public.conversations for insert with check (auth.uid() = owner_id or auth.uid() = walker_id);

create policy "messages_conversation_participants_select" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id and (c.owner_id = auth.uid() or c.walker_id = auth.uid()))
);
create policy "messages_sender_insert" on public.messages for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from public.conversations c where c.id = messages.conversation_id and (c.owner_id = auth.uid() or c.walker_id = auth.uid()))
);

create policy "notifications_self" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payments_owner_select" on public.payments for select using (auth.uid() = owner_id or auth.uid() = walker_id);
create policy "walker_payouts_self_select" on public.walker_payouts for select using (auth.uid() = walker_id);
create policy "device_tokens_self" on public.device_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vet_locations_public_read" on public.vet_locations for select using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-photos', 'pet-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('report-photos', 'report-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy "pet_photos_owner_select" on storage.objects for select using (
  bucket_id = 'pet-photos' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "pet_photos_owner_insert" on storage.objects for insert with check (
  bucket_id = 'pet-photos' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "pet_photos_owner_update" on storage.objects for update using (
  bucket_id = 'pet-photos' and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'pet-photos' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "report_photos_participant_select" on storage.objects for select using (
  bucket_id = 'report-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = (storage.foldername(name))[2]
  )
);
create policy "report_photos_walker_insert" on storage.objects for insert with check (
  bucket_id = 'report-photos' and auth.uid()::text = (storage.foldername(name))[2]
);

insert into public.vet_locations (name, address, phone, emergency, hours, rating)
values
  ('Pawsome Animal Hospital', '123 Oak Street', '(555) 123-4567', true, '24/7 Emergency', 4.8),
  ('Midtown Pet Care Center', '456 Elm Ave', '(555) 987-6543', false, 'Open until 10 PM', 4.6),
  ('Dr. Barks Animal Clinic', '789 Maple Blvd', '(555) 456-7890', false, 'Open until 8 PM', 4.5),
  ('City Vet Emergency Center', '321 Pine Road', '(555) 222-9999', true, '24/7 Emergency', 4.9)
on conflict do nothing;
