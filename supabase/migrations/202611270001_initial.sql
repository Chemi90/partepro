-- PartePro: deny-by-default relational model. No business-table writes granted to API roles.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.technicians (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  name text not null check (length(name) between 1 and 120),
  initials text not null check (length(initials) between 1 and 4),
  color text not null check (color in ('teal','violet','amber')), unique(org_id,id)
);
create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  role text not null check(role in ('owner','dispatcher','technician')),
  technician_id uuid,
  foreign key (org_id,technician_id) references public.technicians(org_id,id),
  check ((role = 'technician' and technician_id is not null) or (role <> 'technician' and technician_id is null))
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  name text not null check(length(name) between 1 and 120), contact text not null check(length(contact) between 1 and 120),
  email text not null check(length(email) between 3 and 254), phone text not null check(length(phone)<=30),
  address text not null check(length(address)<=240), unique(org_id,id)
);
create table public.catalog (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  name text not null check(length(name) between 1 and 120), unit text not null check(length(unit) between 1 and 20),
  price_cents integer not null check(price_cents between 0 and 10000000), kind text not null check(kind in ('service','material')),
  unique(org_id,id)
);
create table public.requests (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  code text not null, customer_id uuid not null, title text not null check(length(btrim(title)) between 1 and 120),
  description text not null check(length(btrim(description)) between 1 and 2000),
  priority text not null check(priority in ('low','normal','urgent')),
  status text not null default 'new' check(status in ('new','quoted','accepted','completed')),
  created_at timestamptz not null default now(),
  foreign key(org_id,customer_id) references public.customers(org_id,id), unique(org_id,id), unique(org_id,code)
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), code text not null,
  request_id uuid not null unique, subtotal_cents integer not null check(subtotal_cents>=0),
  tax_cents integer not null check(tax_cents>=0), total_cents integer not null check(total_cents between 0 and 100000000),
  status text not null default 'draft' check(status in ('draft','accepted')), created_at timestamptz not null default now(),
  foreign key(org_id,request_id) references public.requests(org_id,id), unique(org_id,id), unique(org_id,code),
  check(total_cents=subtotal_cents+tax_cents), check(tax_cents=round(subtotal_cents::numeric*21/100))
);
create table public.quote_items (
  org_id uuid not null, quote_id uuid not null, catalog_id uuid not null,
  quantity integer not null check(quantity between 1 and 100),
  unit_price_cents integer not null check(unit_price_cents between 0 and 10000000), name text not null check(length(name) between 1 and 120),
  primary key(quote_id,catalog_id), foreign key(org_id,quote_id) references public.quotes(org_id,id),
  foreign key(org_id,catalog_id) references public.catalog(org_id,id)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), code text not null,
  request_id uuid not null unique, quote_id uuid not null unique, technician_id uuid,
  status text not null default 'pending' check(status in ('pending','scheduled','completed')),
  start_at timestamptz, duration_minutes integer not null default 60 check(duration_minutes between 15 and 480),
  report text check(length(btrim(report)) between 1 and 4000), completed_at timestamptz,
  foreign key(org_id,request_id) references public.requests(org_id,id), foreign key(org_id,quote_id) references public.quotes(org_id,id),
  foreign key(org_id,technician_id) references public.technicians(org_id,id), unique(org_id,id), unique(org_id,code),
  check ((status='pending' and technician_id is null and start_at is null and report is null and completed_at is null)
    or (status='scheduled' and technician_id is not null and start_at is not null and report is null and completed_at is null)
    or (status='completed' and technician_id is not null and start_at is not null and report is not null and completed_at is not null))
);
create table public.job_materials (
  org_id uuid not null, job_id uuid not null, catalog_id uuid not null,
  quantity integer not null check(quantity between 1 and 100), primary key(job_id,catalog_id),
  foreign key(org_id,job_id) references public.jobs(org_id,id), foreign key(org_id,catalog_id) references public.catalog(org_id,id)
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  text text not null check(length(text) between 1 and 500), kind text not null check(kind in ('request','quote','job')),
  actor_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create index requests_customer on public.requests(org_id,customer_id);
create index jobs_assignment on public.jobs(org_id,technician_id,start_at);
create index activities_recent on public.activities(org_id,created_at desc);
create index memberships_org on public.memberships(org_id);

create table private.rate_buckets (key text primary key, window_start timestamptz not null, count integer not null check(count>=0));
revoke all on all tables in schema private from public,anon,authenticated;

create function private.current_org() returns uuid language sql stable security definer set search_path='' as $$
  select org_id from public.memberships where user_id=(select auth.uid())
$$;
create function private.current_role() returns text language sql stable security definer set search_path='' as $$
  select role from public.memberships where user_id=(select auth.uid())
$$;
create function private.current_technician() returns uuid language sql stable security definer set search_path='' as $$
  select technician_id from public.memberships where user_id=(select auth.uid())
$$;
revoke all on function private.current_org(), private.current_role(), private.current_technician() from public, anon;
grant execute on function private.current_org(), private.current_role(), private.current_technician() to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.technicians enable row level security;
alter table public.customers enable row level security;
alter table public.catalog enable row level security;
alter table public.requests enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.jobs enable row level security;
alter table public.job_materials enable row level security;
alter table public.activities enable row level security;

create policy own_membership on public.memberships for select to authenticated using(user_id=(select auth.uid()));
create policy own_org on public.organizations for select to authenticated using(id=(select private.current_org()));
create policy visible_technicians on public.technicians for select to authenticated using(org_id=(select private.current_org()) and ((select private.current_role())<>'technician' or id=(select private.current_technician())));
create policy own_catalog on public.catalog for select to authenticated using(org_id=(select private.current_org()));
create policy assigned_jobs on public.jobs for select to authenticated using(org_id=(select private.current_org()) and ((select private.current_role())<>'technician' or technician_id=(select private.current_technician())));
create policy visible_requests on public.requests for select to authenticated using(org_id=(select private.current_org()) and ((select private.current_role())<>'technician' or exists(select 1 from public.jobs j where j.request_id=requests.id)));
create policy visible_customers on public.customers for select to authenticated using(org_id=(select private.current_org()) and ((select private.current_role())<>'technician' or exists(select 1 from public.requests r where r.customer_id=customers.id)));
create policy visible_quotes on public.quotes for select to authenticated using(org_id=(select private.current_org()) and ((select private.current_role())<>'technician' or exists(select 1 from public.jobs j where j.quote_id=quotes.id)));
create policy visible_quote_items on public.quote_items for select to authenticated using(org_id=(select private.current_org()) and exists(select 1 from public.quotes q where q.id=quote_items.quote_id));
create policy visible_job_materials on public.job_materials for select to authenticated using(org_id=(select private.current_org()) and exists(select 1 from public.jobs j where j.id=job_materials.job_id));
create policy management_activities on public.activities for select to authenticated using(org_id=(select private.current_org()) and (select private.current_role()) in ('owner','dispatcher'));

revoke all on public.organizations,public.memberships,public.technicians,public.customers,public.catalog,public.requests,public.quotes,public.quote_items,public.jobs,public.job_materials,public.activities from public,anon,authenticated;
grant select on public.organizations,public.memberships,public.technicians,public.customers,public.catalog,public.requests,public.quotes,public.quote_items,public.jobs,public.job_materials,public.activities to authenticated;

create function public.get_workspace() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null or private.current_org() is null then raise insufficient_privilege; end if;
  return jsonb_build_object(
    'customers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'contact',contact,'email',email,'phone',phone,'address',address) order by name) from public.customers),'[]'::jsonb),
    'technicians',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'initials',initials,'color',color) order by name) from public.technicians),'[]'::jsonb),
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'priceCents',price_cents,'kind',kind) order by name) from public.catalog),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'customerId',customer_id,'title',title,'description',description,'priority',priority,'status',status,'createdAt',created_at) order by created_at desc,id) from public.requests),'[]'::jsonb),
    'quotes',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'code',q.code,'requestId',q.request_id,'subtotalCents',q.subtotal_cents,'taxCents',q.tax_cents,'totalCents',q.total_cents,'status',q.status,'createdAt',q.created_at,
      'items',coalesce((select jsonb_agg(jsonb_build_object('catalogId',i.catalog_id,'quantity',i.quantity,'unitPriceCents',i.unit_price_cents,'name',i.name) order by i.catalog_id) from public.quote_items i where i.quote_id=q.id),'[]'::jsonb)) order by q.created_at desc,q.id) from public.quotes q),'[]'::jsonb),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'code',j.code,'requestId',j.request_id,'quoteId',j.quote_id,'status',j.status,'technicianId',j.technician_id,'startAt',j.start_at,'durationMinutes',j.duration_minutes,'report',j.report,'completedAt',j.completed_at,
      'materials',coalesce((select jsonb_agg(jsonb_build_object('catalogId',m.catalog_id,'quantity',m.quantity) order by m.catalog_id) from public.job_materials m where m.job_id=j.id),'[]'::jsonb)) order by j.code desc) from public.jobs j),'[]'::jsonb),
    'activities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'text',text,'kind',kind,'createdAt',created_at) order by created_at desc,id) from public.activities),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_workspace() from public,anon;
grant execute on function public.get_workspace() to authenticated;

create function private.assert_keys(value jsonb, keys text[]) returns void language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(value) is distinct from 'object' or not (value ?& keys)
    or exists(select 1 from jsonb_object_keys(value) k where not(k=any(keys))) then
    raise exception using errcode='22023',message='Invalid shape';
  end if;
end $$;
create function private.validate_selections(items jsonb, allow_empty boolean) returns void language plpgsql immutable set search_path='' as $$
declare item jsonb;
begin
  if jsonb_typeof(items) is distinct from 'array' then raise exception using errcode='22023',message='Invalid items'; end if;
  if jsonb_array_length(items)>20 or (not allow_empty and jsonb_array_length(items)<1) then raise exception using errcode='22023',message='Invalid items'; end if;
  for item in select value from jsonb_array_elements(items) loop
    perform private.assert_keys(item,array['catalogId','quantity']);
    if jsonb_typeof(item->'catalogId') is distinct from 'string' or jsonb_typeof(item->'quantity') is distinct from 'number'
      or (item->>'quantity') !~ '^[0-9]+$' or (item->>'quantity')::numeric not between 1 and 100 then
      raise exception using errcode='22023',message='Invalid selection';
    end if;
    perform (item->>'catalogId')::uuid;
  end loop;
  if (select count(distinct (value->>'catalogId')::uuid) from jsonb_array_elements(items))<>jsonb_array_length(items) then
    raise exception using errcode='22023',message='Duplicate selection';
  end if;
end $$;
revoke all on function private.assert_keys(jsonb,text[]),private.validate_selections(jsonb,boolean) from public,anon,authenticated;

create function public.apply_workspace_action(p_action jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  member public.memberships; org uuid; action text; r public.requests; q public.quotes; j public.jobs;
  product public.catalog; item jsonb; rid uuid; qid uuid; jid uuid; count_rows integer;
  subtotal bigint:=0; tax bigint; starts timestamptz; duration integer; tech uuid; result jsonb;
  log_text text; log_kind text; rate_count integer;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  select * into member from public.memberships where user_id=auth.uid();
  if not found then raise insufficient_privilege; end if;
  org:=member.org_id;
  -- Per-organization serialization prevents acceptance and scheduling races.
  perform 1 from public.organizations where id=org for update;
  insert into private.rate_buckets as b(key,window_start,count) values('mutate:'||auth.uid(),date_trunc('minute',now()),1)
  on conflict(key) do update set window_start=excluded.window_start,count=case when b.window_start=excluded.window_start then b.count+1 else 1 end returning count into rate_count;
  if rate_count>60 then raise exception using errcode='P0429',message='Rate limit'; end if;
  if jsonb_typeof(p_action) is distinct from 'object' or octet_length(p_action::text)>16384 then raise exception using errcode='22023',message='Invalid action'; end if;
  action:=p_action->>'type';
  if member.role='technician' and action is distinct from 'job.complete' then raise insufficient_privilege; end if;

  if action in ('request.create','request.update') then
    perform private.assert_keys(p_action,case when action='request.create' then array['type','customerId','title','description','priority'] else array['type','requestId','title','description','priority'] end);
    if jsonb_typeof(p_action->'title') is distinct from 'string' or jsonb_typeof(p_action->'description') is distinct from 'string'
      or length(btrim(p_action->>'title')) not between 1 and 120 or length(btrim(p_action->>'description')) not between 1 and 2000
      or (p_action->>'priority') is null or (p_action->>'priority') not in ('low','normal','urgent') then raise exception using errcode='22023',message='Invalid request'; end if;
    if action='request.create' then
      if not exists(select 1 from public.customers where org_id=org and id=(p_action->>'customerId')::uuid) then raise no_data_found; end if;
      select count(*) into count_rows from public.requests where org_id=org;
      if count_rows>=2000 then raise exception 'Workspace limit'; end if;
      insert into public.requests(org_id,code,customer_id,title,description,priority) values(org,'SOL-'||lpad((count_rows+1)::text,greatest(3,length((count_rows+1)::text)),'0'),(p_action->>'customerId')::uuid,btrim(p_action->>'title'),btrim(p_action->>'description'),p_action->>'priority') returning id into rid;
      log_text:='Nueva solicitud: '||btrim(p_action->>'title');
    else
      select * into r from public.requests where org_id=org and id=(p_action->>'requestId')::uuid;
      if not found then raise no_data_found; end if;
      if r.status<>'new' then raise exception 'Invalid transition'; end if;
      update public.requests set title=btrim(p_action->>'title'),description=btrim(p_action->>'description'),priority=p_action->>'priority' where id=r.id;
      log_text:='Solicitud actualizada: '||r.code;
    end if;
    log_kind:='request';
  elsif action='quote.create' then
    perform private.assert_keys(p_action,array['type','requestId','items']);
    perform private.validate_selections(p_action->'items',false);
    select * into r from public.requests where org_id=org and id=(p_action->>'requestId')::uuid;
    if not found then raise no_data_found; end if;
    if r.status<>'new' then raise exception 'Invalid transition'; end if;
    for item in select value from jsonb_array_elements(p_action->'items') loop
      select * into product from public.catalog where org_id=org and id=(item->>'catalogId')::uuid;
      if not found then raise no_data_found; end if;
      subtotal:=subtotal+product.price_cents::bigint*(item->>'quantity')::integer;
    end loop;
    tax:=round(subtotal::numeric*21/100);
    if subtotal+tax>100000000 then raise exception using errcode='22023',message='Quote limit'; end if;
    select count(*) into count_rows from public.quotes where org_id=org;
    insert into public.quotes(org_id,code,request_id,subtotal_cents,tax_cents,total_cents) values(org,'PRE-'||lpad((count_rows+1)::text,greatest(3,length((count_rows+1)::text)),'0'),r.id,subtotal,tax,subtotal+tax) returning id into qid;
    insert into public.quote_items(org_id,quote_id,catalog_id,quantity,unit_price_cents,name)
      select org,qid,c.id,(i.value->>'quantity')::integer,c.price_cents,c.name from jsonb_array_elements(p_action->'items') i join public.catalog c on c.id=(i.value->>'catalogId')::uuid and c.org_id=org;
    update public.requests set status='quoted' where id=r.id;
    log_text:='Presupuesto preparado para '||r.code; log_kind:='quote';
  elsif action='quote.accept' then
    perform private.assert_keys(p_action,array['type','quoteId']);
    select * into q from public.quotes where org_id=org and id=(p_action->>'quoteId')::uuid;
    if not found then raise no_data_found; end if;
    select * into r from public.requests where org_id=org and id=q.request_id;
    if q.status<>'draft' or r.status<>'quoted' then raise exception 'Invalid transition'; end if;
    update public.quotes set status='accepted' where id=q.id;
    update public.requests set status='accepted' where id=r.id;
    select count(*) into count_rows from public.jobs where org_id=org;
    insert into public.jobs(org_id,code,request_id,quote_id) values(org,'PAR-'||lpad((count_rows+1)::text,greatest(3,length((count_rows+1)::text)),'0'),r.id,q.id);
    log_text:='Presupuesto '||q.code||' aceptado. Intervención pendiente de planificar.'; log_kind:='quote';
  elsif action='job.schedule' then
    perform private.assert_keys(p_action,array['type','jobId','technicianId','startAt','durationMinutes']);
    select * into j from public.jobs where org_id=org and id=(p_action->>'jobId')::uuid;
    if not found then raise no_data_found; end if;
    if j.status='completed' then raise exception 'Invalid transition'; end if;
    tech:=(p_action->>'technicianId')::uuid;
    if not exists(select 1 from public.technicians where org_id=org and id=tech) then raise no_data_found; end if;
    if jsonb_typeof(p_action->'durationMinutes') is distinct from 'number' or (p_action->>'durationMinutes') !~ '^[0-9]+$'
      or jsonb_typeof(p_action->'startAt') is distinct from 'string' then raise exception using errcode='22023',message='Invalid schedule'; end if;
    starts:=(p_action->>'startAt')::timestamptz; duration:=(p_action->>'durationMinutes')::integer;
    if starts<now()-interval '1 minute' or starts>now()+interval '366 days' or duration not between 15 and 480 then raise exception using errcode='22023',message='Invalid schedule'; end if;
    if exists(select 1 from public.jobs other where other.org_id=org and other.id<>j.id and other.technician_id=tech and other.status='scheduled'
      and starts<other.start_at+make_interval(mins=>other.duration_minutes) and starts+make_interval(mins=>duration)>other.start_at) then raise exception 'Schedule conflict'; end if;
    update public.jobs set status='scheduled',technician_id=tech,start_at=starts,duration_minutes=duration where id=j.id;
    log_text:='Intervención '||j.code||' planificada.'; log_kind:='job';
  elsif action='job.complete' then
    perform private.assert_keys(p_action,array['type','jobId','report','materials']);
    select * into j from public.jobs where org_id=org and id=(p_action->>'jobId')::uuid;
    if not found then raise no_data_found; end if;
    if member.role='technician' and j.technician_id is distinct from member.technician_id then raise insufficient_privilege; end if;
    if j.status<>'scheduled' then raise exception 'Invalid transition'; end if;
    if jsonb_typeof(p_action->'report') is distinct from 'string' or length(btrim(p_action->>'report')) not between 1 and 4000 then raise exception using errcode='22023',message='Invalid report'; end if;
    perform private.validate_selections(p_action->'materials',true);
    for item in select value from jsonb_array_elements(p_action->'materials') loop
      if not exists(select 1 from public.catalog where org_id=org and id=(item->>'catalogId')::uuid and kind='material') then raise exception using errcode='22023',message='Invalid material'; end if;
    end loop;
    insert into public.job_materials(org_id,job_id,catalog_id,quantity)
      select org,j.id,(value->>'catalogId')::uuid,(value->>'quantity')::integer from jsonb_array_elements(p_action->'materials');
    update public.jobs set status='completed',report=btrim(p_action->>'report'),completed_at=now() where id=j.id;
    update public.requests set status='completed' where id=j.request_id;
    log_text:='Parte '||j.code||' finalizado y registrado.'; log_kind:='job';
  else raise exception using errcode='22023',message='Unknown action';
  end if;
  insert into public.activities(org_id,text,kind,actor_id) values(org,log_text,log_kind,auth.uid());
  delete from public.activities where id in(select id from public.activities where org_id=org order by created_at desc,id offset 2000);
  -- Never call the invoker snapshot while still SECURITY DEFINER: its queries would bypass RLS.
  -- The API performs a separate authenticated get_workspace() after this transaction.
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.apply_workspace_action(jsonb) from public,anon;
grant execute on function public.apply_workspace_action(jsonb) to authenticated;

create function public.consume_auth_rate_limit(p_ip text,p_identity text) returns boolean language plpgsql security definer set search_path='' as $$
declare n_ip integer; n_identity integer; bucket timestamptz:=to_timestamp(floor(extract(epoch from now())/900)*900);
begin
  if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
  if p_ip !~ '^[a-f0-9]{64}$' or p_identity !~ '^[a-f0-9]{64}$' or p_ip is null or p_identity is null then raise exception using errcode='22023',message='Invalid bucket'; end if;
  delete from private.rate_buckets where window_start<now()-interval '1 day';
  insert into private.rate_buckets as b(key,window_start,count) values('login-ip:'||p_ip,bucket,1)
    on conflict(key) do update set window_start=excluded.window_start,count=case when b.window_start=excluded.window_start then least(b.count+1,1000) else 1 end returning count into n_ip;
  insert into private.rate_buckets as b(key,window_start,count) values('login-user:'||p_identity,bucket,1)
    on conflict(key) do update set window_start=excluded.window_start,count=case when b.window_start=excluded.window_start then least(b.count+1,1000) else 1 end returning count into n_identity;
  return n_ip<=30 and n_identity<=8;
end $$;
revoke all on function public.consume_auth_rate_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_auth_rate_limit(text,text) to service_role;

-- Future objects do not accidentally become executable or writable via the Data API.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
