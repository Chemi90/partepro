-- SEC-01: persist attempt limits even when a business transaction is rejected.
alter function public.apply_workspace_action(jsonb) set schema private;
revoke all on function private.apply_workspace_action(jsonb) from public,anon,authenticated;

create function public.apply_workspace_action(p_action jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; result jsonb;
begin
  if auth.uid() is null or private.current_org() is null then raise insufficient_privilege; end if;
  insert into private.rate_buckets as b(key,window_start,count) values('attempt:'||auth.uid(),date_trunc('minute',now()),1)
    on conflict(key) do update set window_start=excluded.window_start,count=case when b.window_start=excluded.window_start then least(b.count+1,1000) else 1 end returning count into n;
  if n>60 then return jsonb_build_object('error',true,'code','P0429'); end if;
  begin
    result:=private.apply_workspace_action(p_action);
  exception when others then
    -- This subtransaction rolls back all business changes. The outer counter commits.
    return jsonb_build_object('error',true,'code',sqlstate);
  end;
  return result;
end $$;
revoke all on function public.apply_workspace_action(jsonb) from public,anon;
grant execute on function public.apply_workspace_action(jsonb) to authenticated;

-- Trusted administrative provisioning only, never used by workspace API handlers.
grant all on public.organizations,public.memberships,public.technicians,public.customers,public.catalog,public.requests,public.quotes,public.quote_items,public.jobs,public.job_materials,public.activities to service_role;
