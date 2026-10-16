create table public.crm_cloud_state(owner_id uuid primary key references auth.users(id), version bigint not null default 1, updated_at timestamptz not null default now());
create table public.crm_cloud_parts(owner_id uuid not null references auth.users(id), part_key text not null, data jsonb not null, primary key(owner_id,part_key));
create table public.crm_cloud_history(id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id), version bigint not null, previous_parts jsonb not null, saved_at timestamptz not null default now());
alter table public.crm_cloud_state enable row level security;
alter table public.crm_cloud_parts enable row level security;
alter table public.crm_cloud_history enable row level security;
create policy own_state on public.crm_cloud_state for select to authenticated using(owner_id=(select auth.uid()));
create policy own_parts on public.crm_cloud_parts for select to authenticated using(owner_id=(select auth.uid()));
create policy own_history on public.crm_cloud_history for select to authenticated using(owner_id=(select auth.uid()));
grant select on public.crm_cloud_state,public.crm_cloud_parts,public.crm_cloud_history to authenticated;
revoke all on public.crm_cloud_state,public.crm_cloud_parts,public.crm_cloud_history from anon;
create function public.crm_commit(p_expected bigint,p_parts jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); current_version bigint; previous jsonb;
begin
 if who is null or who <> '7752d038-f954-4223-8e19-d7485fb30710'::uuid then raise exception 'Work account sign-in required'; end if;
 if jsonb_typeof(p_parts)<>'object' then raise exception 'Invalid workspace'; end if;
 select version into current_version from public.crm_cloud_state where owner_id=who for update;
 if current_version is distinct from p_expected then raise exception 'CRM_CONFLICT: Cloud changed. Your browser copy has been retained.'; end if;
 select coalesce(jsonb_object_agg(part_key,data),'{}'::jsonb) into previous from public.crm_cloud_parts where owner_id=who and part_key in(select jsonb_object_keys(p_parts));
 insert into public.crm_cloud_history(owner_id,version,previous_parts) values(who,current_version,previous);
 insert into public.crm_cloud_parts(owner_id,part_key,data) select who,key,value from jsonb_each(p_parts) on conflict(owner_id,part_key) do update set data=excluded.data;
 update public.crm_cloud_state set version=version+1,updated_at=clock_timestamp() where owner_id=who returning version into current_version;
 return current_version;
end $$;
revoke all on function public.crm_commit(bigint,jsonb) from public,anon;
grant execute on function public.crm_commit(bigint,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('clm-crm-private','clm-crm-private',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/avif']) on conflict(id) do nothing;
create policy crm_private_read on storage.objects for select to authenticated using(bucket_id='clm-crm-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy crm_private_insert on storage.objects for insert to authenticated with check(bucket_id='clm-crm-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
