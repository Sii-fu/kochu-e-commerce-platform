-- Fixture for the two-session concurrency tests. Committed; cleaned up after.
delete from orders where idempotency_key like 'race-%';
delete from products where slug = 'race-prod';
delete from collections where slug = 'race-coll';

insert into collections (id, slug, title, season)
values ('00000000-0000-0000-0000-0000000000cc', 'race-coll', 'Race', 'Test');

insert into products (id, slug, name, category, price_minor, status, collection_id)
values ('00000000-0000-0000-0000-0000000000dd', 'race-prod', 'Race Product', 'Test',
        100000, 'ACTIVE', '00000000-0000-0000-0000-0000000000cc');

-- A: the single contested unit.
insert into product_variants (id, product_id, label, stock, sort_order)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-0000000000dd', 'A-last', 1, 0);

-- B: plenty of stock, so the only thing under test is the idempotency key.
insert into product_variants (id, product_id, label, stock, sort_order)
values ('22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-0000000000dd', 'B-double', 5, 1);

-- C: two variants locked in opposite order by the two carts.
insert into product_variants (id, product_id, label, stock, sort_order)
values ('33333333-3333-3333-3333-333333333333',
        '00000000-0000-0000-0000-0000000000dd', 'C-one', 5, 2),
       ('44444444-4444-4444-4444-444444444444',
        '00000000-0000-0000-0000-0000000000dd', 'C-two', 5, 3);
