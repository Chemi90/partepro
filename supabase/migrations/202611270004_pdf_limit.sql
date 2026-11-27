-- Persistent per-user limit for authenticated PDF generation across serverless instances.
create function public.consume_pdf_rate_limit() returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if auth.uid() is null
    or private.current_org() is null
    or coalesce(private.current_role(),'') not in ('owner','dispatcher','technician')
  then raise insufficient_privilege; end if;

  insert into private.rate_buckets as b(key,window_start,count)
    values('pdf:'||auth.uid(),date_trunc('minute',now()),1)
    on conflict(key) do update
      set window_start=excluded.window_start,
          count=case when b.window_start=excluded.window_start then least(b.count+1,1000) else 1 end
    returning count into n;
  return n<=20;
end $$;
revoke all on function public.consume_pdf_rate_limit() from public,anon;
grant execute on function public.consume_pdf_rate_limit() to authenticated;
