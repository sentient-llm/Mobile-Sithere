-- Run manually in a Supabase SQL editor or psql session with test JWT context.
-- Replace UUIDs with real owner/walker/unrelated auth user IDs.

-- Owner context:
-- select set_config('request.jwt.claim.sub', 'OWNER_UUID', true);
-- select * from public.pets where owner_id = 'OWNER_UUID';
-- insert into public.pets (owner_id, name, breed) values ('OWNER_UUID', 'Max', 'Golden Retriever');

-- Walker context:
-- select set_config('request.jwt.claim.sub', 'WALKER_UUID', true);
-- select * from public.walker_profiles where user_id = 'WALKER_UUID';
-- select * from public.walk_requests where walker_id = 'WALKER_UUID';

-- Unrelated user context should return no rows for private owner/walker data:
-- select set_config('request.jwt.claim.sub', 'UNRELATED_UUID', true);
-- select * from public.pets where owner_id = 'OWNER_UUID';
-- select * from public.reports where owner_id = 'OWNER_UUID' or walker_id = 'WALKER_UUID';
-- select * from public.payments where owner_id = 'OWNER_UUID' or walker_id = 'WALKER_UUID';
