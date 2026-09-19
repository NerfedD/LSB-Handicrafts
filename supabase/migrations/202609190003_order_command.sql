-- BUG-01, BUG-02, BUG-03, BUG-05: one transaction per order action.
--
-- WHAT WAS WRONG. Every stock-moving action on an order was a LOOP OF SEPARATE
-- WRITES from the browser: persistStockChanges() sent one PATCH per inventory
-- row, one after another, and then the order row was written separately. Three
-- distinct faults came out of that shape.
--
--   A failure half way through leaves the rest committed (BUG-01). Row one is
--   already saved when row two is refused, the order write never happens, the
--   person presses the button again -- and row one is deducted a SECOND time.
--   Stock 64 -> 60 -> 56, for one order that should have ended at 60.
--
--   Two people overwrite each other (BUG-02). Each browser worked out the new
--   stock from its own snapshot and sent it as an ABSOLUTE number, matched only
--   on id. Two orders completed at once against 64 left 56 instead of 52: the
--   later write carried a total that had never heard of the earlier one.
--
--   An empty shelf list looked like success (BUG-03). With inventory still
--   loading, the ledger mapped over nothing, the loop found nothing to write
--   and reported ok, and the order was stamped Completed with a commitment date
--   while not one unit moved.
--
-- WHAT THIS DOES INSTEAD. The browser still does the ledger arithmetic -- that
-- is where the tested rules live, and porting them here would put one rule in
-- two places that can disagree. What it sends is no longer a set of finished
-- totals but the DELTAS, and they are applied here: in one transaction, against
-- rows locked FOR UPDATE, as stock = stock + delta. Two sessions queue on the
-- lock instead of racing, a delta naming a row that does not exist aborts
-- everything rather than passing silently, and nothing commits unless all of it
-- does.
--
-- Shaped after private.workshop_command, which already does this for the
-- purchasing and production side: advisory lock on a request id, a dedup table
-- so a retried request replays its stored answer instead of running twice, row
-- locks, and a thin SECURITY INVOKER wrapper in public.
--
-- WHAT IS DELIBERATELY NOT HERE. Whether an order is fully settled is decided
-- by the browser and arrives inside the patch, rather than being recomputed in
-- SQL. outstandingOf() is one rule; a second copy of it here is how two copies
-- drift apart. This function checks STATUS, which is its own business, and
-- applies what it is handed.
--
-- The activity log stays a browser write, as it is today. It is a record of
-- what somebody did, not part of the money, and pulling it in here would have
-- every action logged twice until every call site had moved.

create table if not exists private.order_requests (
  request_id uuid primary key,
  actor_id   bigint not null,
  action     text   not null,
  payload    jsonb  not null,
  result     jsonb  not null,
  at         timestamptz not null default now()
);
alter table private.order_requests enable row level security;
revoke all on private.order_requests from public, anon, authenticated;

create or replace function private.order_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor    public.staff;
  ord      public.orders;
  dlv      public.deliveries;
  previous private.order_requests;
  result   jsonb;
  delta       jsonb;
  product_id  bigint;
  moved_id    bigint;
  units       integer;
  left_on_shelf integer;
  order_id    bigint;
  delivery_id bigint;
  touched     bigint[] := '{}';
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  select * into actor from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'Active';
  if actor.id is null then raise exception 'An active staff account is needed.'; end if;
  if p_request_id is null then raise exception 'A request reference is needed.'; end if;

  -- Replay protection. Retries of one request serialize here, before the record
  -- of it is read, so two arriving together cannot both find nothing.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from private.order_requests where request_id = p_request_id;
  if found then
    if previous.actor_id <> actor.id or previous.action <> p_action or previous.payload <> p_data then
      raise exception 'This request has changed. Close the form and try again.';
    end if;
    return previous.result;
  end if;

  order_id    := nullif(p_data ->> 'orderId', '')::bigint;
  delivery_id := nullif(p_data ->> 'deliveryId', '')::bigint;
  if order_id is null then raise exception 'Which order is not clear.'; end if;

  select * into ord from public.orders where id = order_id for update;
  if not found then raise exception 'That order no longer exists.'; end if;

  if delivery_id is not null then
    select * into dlv from public.deliveries where id = delivery_id for update;
    if not found then raise exception 'That delivery no longer exists.'; end if;
  end if;

  case p_action
    when 'complete' then
      if ord.status <> 'Pending' then
        raise exception 'Only an order that is still waiting can be marked done.';
      end if;
    when 'reopen' then
      if ord.status <> 'Completed' then
        raise exception 'Only a finished order can be put back to waiting.';
      end if;
    when 'cancel' then
      if ord.status = 'Cancelled' then
        raise exception 'This order has already been called off.';
      end if;
    when 'refund' then
      null;
    when 'dispatch' then
      -- BUG-05. A fully refunded order is Cancelled, and its delivery used to
      -- be left on the board as an ordinary job: the crew could load a van for
      -- goods nobody was sending and whose money had already gone back.
      if ord.status = 'Cancelled' then
        raise exception 'This order has been called off, so nothing can go out on it.';
      end if;
    when 'arrive' then
      if delivery_id is null then raise exception 'Which delivery is not clear.'; end if;
    else
      raise exception 'That order action is not supported.';
  end case;

  for delta in select * from jsonb_array_elements(coalesce(p_data -> 'deltas', '[]'::jsonb)) loop
    product_id := nullif(delta ->> 'productId', '')::bigint;
    units      := nullif(delta ->> 'delta', '')::integer;
    if product_id is null or units is null then
      raise exception 'A stock change on this order could not be read.';
    end if;

    if units <> 0 then
      update public.inventory
         set stock = stock + units
       where id = product_id
       returning id, stock into moved_id, left_on_shelf;

      -- No such row means the browser was working from a list it never loaded.
      -- Aborting here takes the order write with it, which is the whole point.
      if moved_id is null then
        raise exception 'One of the products on this order is not on the shelf list.';
      end if;
      if left_on_shelf < 0 then
        raise exception 'There is not enough of one of these products left to do that.';
      end if;
      touched := touched || moved_id;
    end if;
  end loop;

  -- Only keys actually present in the patch are written, so an action that does
  -- not touch money cannot blank it. The money guard trigger still fires on this
  -- UPDATE and still reads the real caller's JWT even though this runs SECURITY
  -- DEFINER, so refunds and cancellations stay manager-only exactly as before.
  update public.orders set
    items              = coalesce(p_data -> 'order' -> 'items', items),
    status             = coalesce(p_data -> 'order' ->> 'status', status),
    stock_committed_at = case when p_data -> 'order' ? 'stockCommittedAt'
                           then nullif(p_data -> 'order' ->> 'stockCommittedAt', '')::timestamptz
                           else stock_committed_at end,
    backorder_status   = coalesce(p_data -> 'order' ->> 'backorderStatus', backorder_status),
    refunded_amount    = coalesce((p_data -> 'order' ->> 'refundedAmount')::numeric, refunded_amount),
    refund_history     = coalesce(p_data -> 'order' -> 'refundHistory', refund_history),
    total_amount       = coalesce((p_data -> 'order' ->> 'totalAmount')::numeric, total_amount)
  where id = order_id
  returning * into ord;

  if delivery_id is not null and p_data ? 'delivery' then
    update public.deliveries set
      status         = coalesce(p_data -> 'delivery' ->> 'status', status),
      items_manifest = coalesce(p_data -> 'delivery' -> 'itemsManifest', items_manifest),
      driver         = coalesce(p_data -> 'delivery' ->> 'driver', driver)
    where id = delivery_id
    returning * into dlv;
  end if;

  result := jsonb_build_object(
    'order', to_jsonb(ord),
    'delivery', case when dlv.id is not null then to_jsonb(dlv) else null end,
    'inventory', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory i where i.id = any(touched)
    ), '[]'::jsonb)
  );

  insert into private.order_requests(request_id, actor_id, action, payload, result)
    values (p_request_id, actor.id, p_action, p_data, result);
  return result;
end $fn$;

revoke all on function private.order_command(text, jsonb, uuid) from public, anon;
grant execute on function private.order_command(text, jsonb, uuid) to authenticated;

create or replace function public.order_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select private.order_command(p_action, p_data, p_request_id);
$fn$;
revoke all on function public.order_command(text, jsonb, uuid) from public, anon;
grant execute on function public.order_command(text, jsonb, uuid) to authenticated;
