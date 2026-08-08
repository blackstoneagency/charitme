-- Remove only columns that the corresponding migration introduced. Columns
-- already present in production were never marked and remain untouched.

do $$
declare
  owned record;
begin
  for owned in
    select namespace.nspname as schema_name,
           relation.relname as table_name,
           attribute.attname as column_name
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and not attribute.attisdropped
      and col_description(relation.oid, attribute.attnum) = 'charitme:migration:20260829000000'
  loop
    execute format(
      'alter table %I.%I drop column %I',
      owned.schema_name,
      owned.table_name,
      owned.column_name
    );
  end loop;
end
$$;
