-- Repeatable acceptance and authorization tests. Every fixture/write rolls back.
begin;
do $test$
<<checks>>
declare
  manager_id bigint := nextval('private.workshop_id_seq');
  worker_id bigint := nextval('private.workshop_id_seq');
  sales_id bigint := nextval('private.workshop_id_seq');
  supplier_id bigint := nextval('private.workshop_id_seq');
  product_id bigint := nextval('private.workshop_id_seq');
  inventory_id bigint := nextval('private.workshop_id_seq');
  suffix text := gen_random_uuid()::text;
  material_id bigint; order_id bigint; batch_id bigint; other_batch_id bigint;
  receipt_key uuid := gen_random_uuid(); completion_key uuid := gen_random_uuid();
  payload jsonb; result jsonb; failed boolean; before_log bigint;
begin
  insert into public.staff(id,name,role,status,email) values
    (manager_id,'Workshop test manager','Manager','Active','manager-'||suffix||'@example.invalid'),
    (worker_id,'Workshop test worker','Production Staff','Active','worker-'||suffix||'@example.invalid'),
    (sales_id,'Workshop test sales','Sales Staff','Active','sales-'||suffix||'@example.invalid');
  insert into public.suppliers(id,name) values(supplier_id,'Workshop verification supplier');
  insert into public.products(id,item_code,name,unit,pack_size) values(product_id,'TEST-'||suffix,'Verification Ball 8 inch','piece',1);
  insert into public.inventory(id,sku,name,category,stock,unit,pack_size) values(inventory_id,'TEST-'||suffix,'Verification Ball 8 inch','Test',0,'piece',1);
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000001','email','manager-'||suffix||'@example.invalid','role','authenticated')::text,true);
  set local role authenticated;

  result:=public.workshop_command('save_material',jsonb_build_object('sku','RAW-'||suffix,'name','Verification 2 inch sheet','material_type','sheet','unit','sheet','low_stock_threshold',20),gen_random_uuid());
  material_id:=(result->>'id')::bigint;
  result:=public.workshop_command('save_order',jsonb_build_object('supplier_id',supplier_id,'raw_material_id',material_id,'quantity_ordered',50,'unit_price',100,'expected_delivery_date','2026-09-19'),gen_random_uuid());
  order_id:=(result->>'id')::bigint;
  assert result->>'status'='Delivery Scheduled','ETA should set scheduled status';
  assert (result->>'total_cost')::numeric=5000,'server computes total cost';
  perform public.workshop_command('order_status',jsonb_build_object('id',order_id,'status','In Transit'),gen_random_uuid());
  payload:=jsonb_build_object('id',order_id,'arrived',50,'damaged',2,'reason','Broken edges/corners');
  result:=public.workshop_command('receive_delivery',payload,receipt_key);
  assert (result->>'quantity_usable')::integer=48,'50 arrived minus 2 damaged must accept 48';
  assert result->>'claim_status'='Needs review','damaged delivery flags claim';
  assert (select stock=48 from public.raw_materials where id=material_id),'receipt updates raw stock';
  perform public.workshop_command('receive_delivery',payload,receipt_key);
  assert (select stock=48 from public.raw_materials where id=material_id),'retry must not double count';
  failed:=false;
  begin perform public.workshop_command('receive_delivery',payload,gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'a new request cannot receive the same order twice';
  failed:=false;
  begin perform public.workshop_command('receive_delivery',payload||'{"arrived":49}'::jsonb,receipt_key);
  exception when raise_exception then failed:=true; end;
  assert failed,'same request key cannot be reused with changed counts';
  failed:=false;
  begin update public.raw_materials set stock=999 where id=material_id;
  exception when insufficient_privilege then failed:=true; end;
  assert failed,'direct material stock writes must be denied';
  result:=public.workshop_command('review_claim',jsonb_build_object('id',order_id,'reason','Supplier agreed to replace damaged sheets on a new order.'),gen_random_uuid());
  assert result->>'claim_status'='Resolved','manager can record claim outcome';
  assert (select stock=48 from public.raw_materials where id=material_id),'claim resolution cannot silently increase stock';

  perform public.workshop_command('save_recipe',jsonb_build_object('product_id',product_id,'raw_material_id',material_id,'material_qty',45,'output_qty',100),gen_random_uuid());
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000002','email','worker-'||suffix||'@example.invalid','role','authenticated')::text,true);
  failed:=false;
  begin perform public.workshop_command('save_order',jsonb_build_object('supplier_id',supplier_id),gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'production worker cannot place purchases';
  payload:=jsonb_build_object('product_id',product_id,'raw_material_id',material_id,'material_qty',45,'output_qty',100,'assigned_staff_id',worker_id);
  result:=public.workshop_command('start_batch',payload,gen_random_uuid()); batch_id:=(result->>'id')::bigint;
  assert (select stock=48 from public.raw_materials where id=material_id),'queuing allocates without deducting';
  failed:=false;
  begin perform public.workshop_command('start_batch',payload,gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'another batch must not overallocate the same stock';
  failed:=false;
  begin perform public.workshop_command('complete_batch',jsonb_build_object('id',batch_id,'produced',100,'damaged',5,'material_qty',45,'reason','Broke during hotwire/cutting'),gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'cannot skip quality check';
  perform public.workshop_command('batch_status',jsonb_build_object('id',batch_id,'status','In Progress'),gen_random_uuid());
  perform public.workshop_command('batch_status',jsonb_build_object('id',batch_id,'status','Quality Check'),gen_random_uuid());
  select count(*) into before_log from public.activity_log;
  failed:=false;
  begin perform public.workshop_command('complete_batch',jsonb_build_object('id',batch_id,'produced',100,'damaged',101,'material_qty',45,'reason','Broke during hotwire/cutting'),gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'damage cannot exceed processed output';
  assert (select stock=48 from public.raw_materials where id=material_id),'invalid completion changes no raw stock';
  assert (select count(*)=before_log from public.activity_log),'failed operation writes no activity';
  payload:=jsonb_build_object('id',batch_id,'produced',100,'damaged',5,'material_qty',45,'reason','Broke during hotwire/cutting');
  result:=public.workshop_command('complete_batch',payload,completion_key);
  assert (select stock=95 from public.inventory where id=inventory_id),'100 produced minus 5 damaged adds 95';
  assert (select stock=3 from public.raw_materials where id=material_id),'completion consumes 45 of 48 sheets';
  assert (select damaged_quantity=5 and logged_by_staff_id=worker_id from public.production_defect_logs d where d.batch_id=checks.batch_id),'records 5 defects and worker';
  assert (select sum(u.quantity)=45 from public.production_material_usage u where u.batch_id=checks.batch_id),'material lot provenance totals 45';
  perform public.workshop_command('complete_batch',payload,completion_key);
  assert (select stock=95 from public.inventory where id=inventory_id),'retry completion is idempotent';

  -- Insufficient material and pack conversion, with transaction rollback.
  result:=public.workshop_command('start_batch',jsonb_build_object('product_id',product_id,'raw_material_id',material_id,'material_qty',3,'output_qty',10,'assigned_staff_id',worker_id),gen_random_uuid());
  other_batch_id:=(result->>'id')::bigint;
  perform public.workshop_command('batch_status',jsonb_build_object('id',other_batch_id,'status','In Progress'),gen_random_uuid());
  perform public.workshop_command('batch_status',jsonb_build_object('id',other_batch_id,'status','Quality Check'),gen_random_uuid());
  failed:=false;
  begin perform public.workshop_command('complete_batch',jsonb_build_object('id',other_batch_id,'produced',10,'damaged',0,'material_qty',4),gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'cannot consume more stock than available';
  -- Force a failure after both stock updates, and verify the entire function
  -- rolls back: no half-completed batch or stock movement is left behind.
  reset role;
  update public.raw_material_lots set remaining=0 where raw_material_id=material_id;
  set local role authenticated;
  failed:=false;
  begin perform public.workshop_command('complete_batch',jsonb_build_object('id',other_batch_id,'produced',10,'damaged',0,'material_qty',3),gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'inconsistent lot ledger must reject completion';
  assert (select stock=3 from public.raw_materials where id=material_id),'failed lot write rolls back raw material deduction';
  assert (select stock=95 from public.inventory where id=inventory_id),'failed lot write rolls back finished stock addition';
  assert (select status='Quality Check' from public.production_batches where id=other_batch_id),'failed lot write rolls back completion status';
  reset role;
  update public.raw_material_lots set remaining=3 where raw_material_id=material_id;
  update public.inventory set pack_size=5 where id=inventory_id;
  set local role authenticated;
  failed:=false;
  begin perform public.workshop_command('complete_batch',jsonb_build_object('id',other_batch_id,'produced',9,'damaged',0,'material_qty',3),gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'partial selling packs are refused';
  perform public.workshop_command('complete_batch',jsonb_build_object('id',other_batch_id,'produced',10,'damaged',0,'material_qty',3),gen_random_uuid());
  assert (select stock=97 from public.inventory where id=inventory_id),'10 pieces add 2 packs, not 10 packs';

  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000003','email','sales-'||suffix||'@example.invalid','role','authenticated')::text,true);
  failed:=false;
  begin perform public.workshop_command('start_batch',payload,gen_random_uuid());
  exception when raise_exception then failed:=true; end;
  assert failed,'sales staff cannot start production';
  set local role anon;
  failed:=false;
  begin perform public.workshop_command('save_material','{}',gen_random_uuid());
  exception when insufficient_privilege then failed:=true; end;
  assert failed,'anonymous callers cannot invoke workshop writes';
  reset role;
end $test$;
rollback;
select 'Purchasing, 48 usable sheets, 95 good pieces, 45 consumed, 5 defects, retry protection, allocation, whole packs and role boundaries passed; all test records rolled back.' as verification;
