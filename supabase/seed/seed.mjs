/**
 * KOCHU catalog seed.
 *
 * Run:  npm run db:seed
 *       (node --env-file=.env.seed supabase/seed/seed.mjs)
 *
 * Uses the service-role key, so it bypasses RLS entirely. That is the point --
 * every table it writes is admin-only or RPC-only for real clients. The key
 * lives in .env.seed, which is gitignored, and must never reach src/.
 *
 * Plain .mjs rather than .ts on purpose: --experimental-strip-types needs
 * Node 22.6+, and a seed script isn't worth a transpile step.
 *
 * Idempotent: re-running upserts by slug/code/email rather than duplicating.
 * Guest orders are the one exception -- see the "orders" section below for why.
 *
 * Deliberately broad, not just a happy-path catalog. Every state the UI or
 * admin panel needs to render correctly gets at least one real row:
 *   - a DRAFT product (admin-only visibility)
 *   - an ARCHIVED product (admin-only visibility)
 *   - a product fully sold out (every variant stock = 0)
 *   - a product partially sold out (one variant at 0, others fine)
 *   - a product at low-stock on every variant (urgency badge)
 *   - two "One Size" single-variant products (the "every product has >=1
 *     variant" invariant, exercised by a non-sized item, not just multi-size)
 *   - sale pricing (compare_at_minor) on two products
 *   - a live drop with real products attached
 *   - a VIP-only upcoming drop (existing: structured-corset/winter-preview)
 *   - an ENDED drop, whose product is correctly invisible once RLS re-checks
 *     drop_is_live() -- this is what exposed a live/upcoming/ended
 *     classification bug in getDrops() during Phase 4, fixed alongside this
 *   - an unpublished (DRAFT-equivalent) drop, admin-only
 *   - discount codes in every state: active, fixed-amount, expired, exhausted,
 *     inactive
 *   - guest orders in a spread of statuses, created through the real
 *     create_order() RPC (never a direct insert -- see below)
 *   - one MFS transaction left AWAITING_VERIFICATION, for the admin queue
 *
 * Product photography: only the original four items have real photos
 * (public/products/kochu-*.png, from the old app). Everything added here
 * uses a generated solid-colour placeholder (see makePlaceholder below) --
 * there is no real photography for them and this script deliberately never
 * fetches images from the network.
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Create .env.seed (see .env.example) and run via `npm run db:seed`.',
  )
  process.exit(1)
}

if (SERVICE_KEY.startsWith('eyJ') === false && SERVICE_KEY.startsWith('sb_secret_') === false) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY does not look like a known key format. Continuing anyway.')
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const taka = (amount) => Math.round(amount * 100) // BDT -> poisha
const days = (n) => new Date(Date.now() + n * 86_400_000).toISOString()

/** Convert a local PNG to WebP and upload it, returning the storage path. */
async function uploadImage(bucket, objectPath, localFile) {
  const source = await readFile(path.join(ROOT, localFile))
  const webp = await sharp(source).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  return uploadBuffer(bucket, objectPath, webp)
}

/**
 * A flat-colour square with a slightly darker band across the lower third --
 * enough visual texture to not look like a broken image, deliberately not
 * trying to pass as real photography. No text: SVG-to-raster text rendering
 * depends on system fonts being present, which isn't reliable across dev
 * machines and CI, and a plain swatch is honest about what it is.
 */
async function makePlaceholder(hex) {
  const size = 1200
  const overlay = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="${Math.round(size * 0.66)}" width="${size}" height="${Math.round(size * 0.34)}" fill="black" fill-opacity="0.08"/></svg>`,
  )
  return sharp({
    create: { width: size, height: size, channels: 3, background: hex },
  })
    .composite([{ input: overlay }])
    .webp({ quality: 82 })
    .toBuffer()
}

async function uploadBuffer(bucket, objectPath, buffer) {
  const { error } = await db.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: 'image/webp', upsert: true })

  if (error) throw new Error(`upload ${bucket}/${objectPath}: ${error.message}`)
  console.log(`  ↑ ${bucket}/${objectPath}  (${(buffer.length / 1024).toFixed(0)} KB)`)
  return objectPath
}

async function uploadPlaceholder(bucket, objectPath, hex) {
  const webp = await makePlaceholder(hex)
  return uploadBuffer(bucket, objectPath, webp)
}

/** Insert-or-update a row by its slug, returning the row. */
async function upsertBySlug(table, row) {
  const { data, error } = await db.from(table).upsert(row, { onConflict: 'slug' }).select().single()
  if (error) throw new Error(`${table}/${row.slug}: ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const COLLECTIONS = [
  {
    slug: 'summer-elegance-2024',
    title: 'Summer Elegance 2024',
    season: 'Summer 2024',
    description: 'Ethereal summer collection featuring flowing silhouettes and light fabrics',
    sort_order: 1,
    is_active: true,
    color: '#e7d9c9',
  },
  {
    slug: 'autumn-neutrals',
    title: 'Autumn Neutrals',
    season: 'Autumn 2024',
    description: 'Warm, wearable neutrals built for transitional weather.',
    sort_order: 2,
    is_active: true,
    color: '#8a7862',
  },
  {
    slug: 'resort-wear',
    title: 'Resort Wear',
    season: 'Resort 2025',
    description: 'Lightweight linen and easy silhouettes for warm-weather travel.',
    sort_order: 3,
    is_active: true,
    color: '#d8c3a5',
  },
]

// ---------------------------------------------------------------------------
// Products
//
// Prices carried over in spirit from the old USD seed for the original four;
// everything else is priced to sit in the same range. `sizes` is
// [label, stock][]; stock=0 entries are deliberate (sold-out tests), not bugs.
// `collection` refers to a COLLECTIONS slug above, or null for "no collection"
// (also a real, exercised state -- PDP and ProductCard both have to handle a
// product with nothing to show for that field).
// ---------------------------------------------------------------------------

const PRODUCTS = [
  // -- Original four, real photography, Summer Elegance 2024 --------------
  {
    slug: 'tailored-pants',
    name: 'Tailored Pants',
    category: 'Pants',
    collection: 'summer-elegance-2024',
    description: 'Elegant high-waisted tailored pants with cream silk lining',
    details: 'Viscose blend with silk lining. Dry clean only. Made in Dhaka.',
    price: taka(4200),
    image: 'public/products/kochu-pants-1.png',
    is_featured: true,
    sizes: [['XS', 3], ['S', 4], ['M', 5], ['L', 3]],
  },
  {
    slug: 'silk-button-up-shirt',
    name: 'Silk Button-Up Shirt',
    category: 'Shirts',
    collection: 'summer-elegance-2024',
    description: 'Oversized cream silk button-up with gold embroidery details',
    details: '100% mulberry silk with hand-worked gold embroidery. Dry clean only.',
    price: taka(5500),
    compare_at: taka(6400),
    image: 'public/products/kochu-shirt-1.png',
    is_featured: true,
    sizes: [['S', 3], ['M', 4], ['L', 3]],
  },
  {
    slug: 'midi-skirt',
    name: 'Midi Skirt',
    category: 'Skirts',
    collection: 'summer-elegance-2024',
    description: 'Flowing A-line black midi skirt with gold pleating details',
    details: 'Crepe with pressed gold-thread pleating. Cold hand wash.',
    price: taka(4800),
    image: 'public/products/kochu-skirt-1.png',
    sizes: [['XS', 2], ['S', 4], ['M', 4], ['L', 2]],
  },
  {
    // VIP-only, behind winter-preview. Referenced by slug in
    // supabase/tests/rest_check.sh's "VIP drop product hidden" check --
    // keep this slug and its drop attachment stable.
    slug: 'structured-corset',
    name: 'Structured Corset',
    category: 'Corsets',
    collection: 'summer-elegance-2024',
    description: 'Structured black satin corset with gold lacing details',
    details: 'Boned satin with adjustable gold lacing. Spot clean only.',
    price: taka(6900),
    image: 'public/products/kochu-corset-1.png',
    drop: 'winter-preview',
    sizes: [['XS', 1], ['S', 3], ['M', 3], ['L', 1]],
  },

  // -- Autumn Neutrals, generated placeholders -----------------------------
  {
    slug: 'wool-trench-coat',
    name: 'Wool Trench Coat',
    category: 'Outerwear',
    collection: 'autumn-neutrals',
    description: 'Double-breasted wool trench in olive.',
    details: '80% wool, 20% nylon. Dry clean only.',
    price: taka(8900),
    color: '#5c6b47',
    sizes: [['S', 6], ['M', 8], ['L', 5], ['XL', 2]],
  },
  {
    slug: 'cashmere-turtleneck',
    name: 'Cashmere Turtleneck',
    category: 'Knitwear',
    collection: 'autumn-neutrals',
    description: 'Featherweight cashmere turtleneck in cream.',
    details: '100% cashmere. Hand wash cold.',
    price: taka(6200),
    compare_at: taka(7200),
    color: '#e9e2d3',
    sizes: [['XS', 4], ['S', 6], ['M', 6], ['L', 3]],
  },
  {
    slug: 'pleated-trousers',
    name: 'Pleated Trousers',
    category: 'Pants',
    collection: 'autumn-neutrals',
    description: 'Wide-leg pleated trousers in charcoal.',
    details: 'Wool blend. Dry clean only.',
    price: taka(4600),
    color: '#3a3a3d',
    sizes: [['XS', 3], ['S', 5], ['M', 5], ['L', 4]],
  },
  {
    // Partial sold-out: 38 is at 0, everything else is fine. Exercises
    // VariantPicker disabling one option while leaving siblings clickable.
    slug: 'leather-ankle-boots',
    name: 'Leather Ankle Boots',
    category: 'Accessories',
    collection: 'autumn-neutrals',
    description: 'Hand-finished leather ankle boots in brown.',
    details: 'Full-grain leather, leather sole.',
    price: taka(7400),
    color: '#6b4a34',
    sizes: [['38', 0], ['39', 2], ['40', 6], ['41', 4]],
  },

  // -- Resort Wear, generated placeholders ---------------------------------
  {
    slug: 'linen-shirt-dress',
    name: 'Linen Shirt Dress',
    category: 'Dresses',
    collection: 'resort-wear',
    description: 'Relaxed linen shirt dress in dusty rose.',
    details: '100% linen. Machine wash cold.',
    price: taka(5200),
    color: '#c9a9a0',
    sizes: [['XS', 2], ['S', 4], ['M', 4], ['L', 2]],
  },
  {
    slug: 'wide-leg-linen-pants',
    name: 'Wide-Leg Linen Pants',
    category: 'Pants',
    collection: 'resort-wear',
    description: 'Breathable wide-leg linen pants in sand.',
    details: '100% linen. Machine wash cold.',
    price: taka(3900),
    color: '#d3c0a0',
    sizes: [['S', 5], ['M', 6], ['L', 5]],
  },
  {
    // Low stock on every size -- StockBadge/urgency copy, not a sold-out state.
    slug: 'silk-camisole',
    name: 'Silk Camisole',
    category: 'Tops',
    collection: 'resort-wear',
    description: 'Bias-cut silk camisole in ivory.',
    details: '100% silk. Dry clean only.',
    price: taka(3200),
    color: '#f0e9dc',
    sizes: [['XS', 2], ['S', 3], ['M', 2]],
  },
  {
    // ARCHIVED: admin-only visibility. Anon/customer queries must never see it.
    slug: 'raffia-tote-bag',
    name: 'Raffia Tote Bag',
    category: 'Accessories',
    collection: 'resort-wear',
    description: 'Handwoven raffia tote, discontinued.',
    details: 'Natural raffia. Spot clean.',
    price: taka(2800),
    color: '#c4a876',
    status: 'ARCHIVED',
    sizes: [['One Size', 10]],
  },

  // -- No collection, generated placeholders -------------------------------
  {
    // DRAFT: admin-only visibility, the other half of the visibility gate.
    slug: 'classic-white-tee',
    name: 'Classic White Tee',
    category: 'Tops',
    collection: null,
    description: 'A basic not yet published.',
    details: '100% cotton.',
    price: taka(1800),
    color: '#f5f5f0',
    status: 'DRAFT',
    sizes: [['XS', 5], ['S', 8], ['M', 8], ['L', 5]],
  },
  {
    slug: 'denim-jacket',
    name: 'Denim Jacket',
    category: 'Outerwear',
    collection: null,
    description: 'Classic indigo denim jacket.',
    details: '100% cotton denim.',
    price: taka(4400),
    color: '#2b3a5c',
    is_featured: true,
    drop: 'midnight-gold',
    sizes: [['S', 6], ['M', 7], ['L', 6], ['XL', 3]],
  },
  {
    slug: 'pleated-midi-dress',
    name: 'Pleated Midi Dress',
    category: 'Dresses',
    collection: null,
    description: 'Fully pleated midi dress in burgundy.',
    details: 'Polyester crepe. Machine wash cold.',
    price: taka(7900),
    compare_at: taka(9200),
    color: '#5c2430',
    is_featured: true,
    drop: 'midnight-gold',
    sizes: [['XS', 2], ['S', 4], ['M', 4], ['L', 2]],
  },
  {
    // Fully sold out: every variant at 0. The "Sold out" full-product state,
    // not just a disabled option.
    slug: 'structured-blazer',
    name: 'Structured Blazer',
    category: 'Outerwear',
    collection: null,
    description: 'Sharp single-breasted blazer in black.',
    details: 'Wool blend. Dry clean only.',
    price: taka(6800),
    color: '#1c1c1e',
    sizes: [['S', 0], ['M', 0], ['L', 0]],
  },
  {
    // Second "One Size" product -- confirms single-variant products aren't
    // a special case anywhere in the query/UI layer.
    slug: 'silk-scarf',
    name: 'Silk Scarf',
    category: 'Accessories',
    collection: null,
    description: 'Hand-rolled silk scarf in gold.',
    details: '100% silk.',
    price: taka(2200),
    color: '#c9a24b',
    sizes: [['One Size', 15]],
  },
  {
    slug: 'canvas-sneakers',
    name: 'Canvas Sneakers',
    category: 'Accessories',
    collection: null,
    description: 'Minimal canvas sneakers in white.',
    details: 'Canvas upper, rubber sole.',
    price: taka(3400),
    color: '#eeeeee',
    sizes: [['37', 4], ['38', 6], ['39', 6], ['40', 4], ['41', 3]],
  },
  {
    // Attached to an ENDED drop -- correctly invisible to everyone once
    // drop_is_live() goes false. This is the case that exposed the
    // live/upcoming/ended classification bug in getDrops() during Phase 4.
    slug: 'flash-sale-tank',
    name: 'Flash Sale Tank',
    category: 'Tops',
    collection: null,
    description: 'A tank top from a drop that already ended.',
    details: '100% cotton.',
    price: taka(1500),
    color: '#d96b4f',
    drop: 'past-flash-sale',
    sizes: [['S', 3], ['M', 3]],
  },
]

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

const ARTICLES = [
  {
    slug: 'the-art-of-luxury-minimalism',
    title: 'The Art of Luxury Minimalism',
    abstract: 'Discover how less can be more in luxury fashion. Explore the philosophy behind minimalist design.',
    content:
      "Luxury minimalism is more than just a style — it's a philosophy. In this article, we explore how the restraint of materials and colour palettes can create powerful fashion statements.\n\nThe discipline is subtractive. Every seam that stays has earned its place.",
    collection: 'summer-elegance-2024',
    color: '#e7d9c9',
  },
  {
    slug: 'sustainable-fashion-forward',
    title: 'Sustainable Fashion Forward',
    abstract: 'Learn about our commitment to sustainable and ethical fashion practices.',
    content:
      "At KOCHU, sustainability is not just a buzzword. We're committed to creating beautiful pieces while respecting our planet and the artisans who craft them.\n\nWe produce in small runs, in Dhaka, and we name our workshops.",
    collection: 'summer-elegance-2024',
    color: '#e7d9c9',
  },
  {
    slug: 'the-power-of-tailoring',
    title: 'The Power of Tailoring',
    abstract: 'How perfect tailoring transforms a piece from good to exceptional.',
    content:
      'The difference between ordinary and extraordinary fashion lies in the details. Perfect tailoring can elevate any garment, making it uniquely yours.\n\nFit is the only luxury that cannot be bought off a rack.',
    collection: 'summer-elegance-2024',
    color: '#e7d9c9',
  },
  {
    slug: 'building-a-transitional-wardrobe',
    title: 'Building a Transitional Wardrobe',
    abstract: 'A handful of pieces that carry a wardrobe from one season into the next.',
    content:
      'A transitional wardrobe is not about owning more -- it is about owning pieces that carry weight in more than one season.\n\nA wool trench and a cashmere layer will outlast three fast-fashion coats.',
    collection: 'autumn-neutrals',
    color: '#8a7862',
  },
  {
    slug: 'notes-from-the-workshop',
    title: 'Notes from the Workshop',
    abstract: 'A short walkthrough of how a KOCHU piece actually gets made, from pattern to finish.',
    content:
      'Every piece starts as a paper pattern, cut and re-cut until the drape is right before a single seam is sewn.\n\nOur cutting table sits four people. On a good week, it never stops moving.',
    collection: null,
    color: '#3a3a3d',
  },
  {
    // Unpublished -- articles_select_published_or_admin (0007_rls.sql) must
    // hide this from anon/customer reads and show it to an admin.
    slug: 'upcoming-spring-preview-draft',
    title: 'Upcoming: Spring Preview (draft)',
    abstract: 'Internal draft, not yet published.',
    content: 'Placeholder content for an article still being written.',
    collection: null,
    color: '#d8c3a5',
    is_published: false,
  },
]

// ---------------------------------------------------------------------------
// Drops
//
//   - midnight-gold: live now, with real products attached (denim-jacket,
//     pleated-midi-dress via their own `drop` field above).
//   - winter-preview: VIP early access now, public in a week. Referenced by
//     slug in rest_check.sh -- keep stable.
//   - past-flash-sale: already ended. Its product (flash-sale-tank) must be
//     invisible to everyone now that the window has closed.
//   - spring-drop-draft: unpublished. Admin-only, exercises
//     drops_select_published_or_admin's other half.
// ---------------------------------------------------------------------------

const DROPS = [
  {
    slug: 'midnight-gold',
    title: 'Midnight Gold',
    description: 'A capsule in black satin and antique gold.',
    starts_at: days(-2),
    ends_at: days(30),
    is_published: true,
    color: '#1c1c1e',
  },
  {
    slug: 'winter-preview',
    title: 'Winter Preview',
    description: 'Early access for members. Public launch in one week.',
    early_access_at: days(-0.04), // ~1 hour ago
    starts_at: days(7),
    access_key: 'KOCHUVIP',
    is_published: true,
    color: '#2b2b3d',
  },
  {
    slug: 'past-flash-sale',
    title: 'Past Flash Sale',
    description: 'A 48-hour sale that has already ended.',
    starts_at: days(-14),
    ends_at: days(-12),
    is_published: true,
    color: '#7a2e2e',
  },
  {
    slug: 'spring-drop-draft',
    title: 'Spring Drop (unpublished)',
    description: 'Not yet announced.',
    starts_at: days(45),
    is_published: false,
    color: '#4a6b5c',
  },
]

// ---------------------------------------------------------------------------
// Discount codes -- one of each state the admin/checkout UI needs to handle.
// ---------------------------------------------------------------------------

const DISCOUNT_CODES = [
  {
    code: 'WELCOME10',
    description: '10% off a first order',
    type: 'PERCENT',
    value: 10,
    min_order_minor: taka(2000),
    max_uses: 500,
    used_count: 12,
    is_active: true,
  },
  {
    code: 'FLAT500',
    description: '৳500 off orders over ৳3,000',
    type: 'FIXED',
    value: taka(500),
    min_order_minor: taka(3000),
    max_uses: null,
    used_count: 3,
    is_active: true,
  },
  {
    code: 'EXPIRED5',
    description: 'Expired 5% code',
    type: 'PERCENT',
    value: 5,
    min_order_minor: 0,
    expires_at: days(-30),
    used_count: 8,
    is_active: true,
  },
  {
    code: 'MAXEDOUT',
    description: 'A code whose uses have run out',
    type: 'PERCENT',
    value: 15,
    min_order_minor: 0,
    max_uses: 1,
    used_count: 1,
    is_active: true,
  },
  {
    code: 'INACTIVE20',
    description: 'Manually disabled by an admin',
    type: 'PERCENT',
    value: 20,
    min_order_minor: 0,
    used_count: 0,
    is_active: false,
  },
]

const EARLY_ACCESS_SIGNUPS = [
  'amira.rahman@example.com',
  'tanvir.hasan@example.com',
  'nusrat.jahan@example.com',
  'farhan.ahmed@example.com',
  'sabrina.islam@example.com',
]

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${SUPABASE_URL}\n`)

  // -- store settings -------------------------------------------------------
  const { error: settingsError } = await db
    .from('store_settings')
    .update({
      free_shipping_threshold_minor: taka(5000),
      flat_shipping_minor: taka(80),
      bkash_number: '+8801XXXXXXXXX',
      nagad_number: '+8801XXXXXXXXX',
      support_email: 'hello@kochu.bd',
      support_phone: '+8801XXXXXXXXX',
      announcement: 'Free delivery on orders over ৳5,000',
    })
    .eq('id', true)
  if (settingsError) throw new Error(`store_settings: ${settingsError.message}`)
  console.log('✓ store settings')

  // -- collections ------------------------------------------------------------
  const collections = {}
  for (const c of COLLECTIONS) {
    const { color, ...row } = c
    const collection = await upsertBySlug('collections', row)
    const coverPath =
      collection.slug === 'summer-elegance-2024'
        ? await uploadImage('collections', `${collection.id}/cover.webp`, 'public/collections/summer-2024.png')
        : await uploadPlaceholder('collections', `${collection.id}/cover.webp`, color)
    await db.from('collections').update({ cover_image: coverPath }).eq('id', collection.id)
    collections[c.slug] = collection
    console.log(`✓ collection ${collection.slug}`)
  }

  // -- drops ------------------------------------------------------------------
  const drops = {}
  for (const d of DROPS) {
    const { color, ...row } = d
    const drop = await upsertBySlug('drops', row)
    const coverPath = await uploadPlaceholder('drops', `${drop.id}/cover.webp`, color)
    await db.from('drops').update({ cover_image: coverPath }).eq('id', drop.id)
    drops[d.slug] = drop
    console.log(`✓ drop ${drop.slug}`)
  }

  // -- products, variants, images ----------------------------------------------
  for (const p of PRODUCTS) {
    const product = await upsertBySlug('products', {
      slug: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      details: p.details,
      price_minor: p.price,
      compare_at_minor: p.compare_at ?? null,
      collection_id: p.collection ? collections[p.collection].id : null,
      drop_id: p.drop ? drops[p.drop].id : null,
      status: p.status ?? 'ACTIVE',
      is_featured: p.is_featured ?? false,
    })

    const imagePath = p.image
      ? await uploadImage('products', `${product.id}/main.webp`, p.image)
      : await uploadPlaceholder('products', `${product.id}/main.webp`, p.color)

    await db.from('product_images').delete().eq('product_id', product.id)
    const { error: imgError } = await db
      .from('product_images')
      .insert({ product_id: product.id, path: imagePath, alt: p.name, sort_order: 0 })
    if (imgError) throw new Error(`product_images/${p.slug}: ${imgError.message}`)

    const variants = p.sizes.map(([label, stock], i) => ({
      product_id: product.id,
      label,
      sku: `KCH-${p.slug.toUpperCase().replace(/-/g, '')}-${label.replace(/\s+/g, '')}`,
      stock,
      sort_order: i,
      is_active: true,
    }))

    const { error: varError } = await db
      .from('product_variants')
      .upsert(variants, { onConflict: 'product_id,label' })
    if (varError) throw new Error(`product_variants/${p.slug}: ${varError.message}`)

    const total = p.sizes.reduce((sum, [, s]) => sum + s, 0)
    const flags = [
      p.status === 'DRAFT' && 'DRAFT',
      p.status === 'ARCHIVED' && 'ARCHIVED',
      total === 0 && 'SOLD OUT',
      p.drop && `drop:${p.drop}`,
    ]
      .filter(Boolean)
      .join(', ')
    console.log(
      `✓ product ${product.slug}  ৳${(p.price / 100).toLocaleString('en-BD')}  ` +
        `${p.sizes.length} size(s), ${total} units${flags ? `  [${flags}]` : ''}`,
    )
  }

  // -- articles -------------------------------------------------------------
  for (const a of ARTICLES) {
    const { collection, color, ...rest } = a
    const article = await upsertBySlug('articles', {
      ...rest,
      collection_id: collection ? collections[collection].id : null,
      is_published: a.is_published ?? true,
      published_at: (a.is_published ?? true) ? new Date().toISOString() : null,
    })
    const imagePath = await uploadPlaceholder('articles', `${article.id}/cover.webp`, color)
    await db.from('articles').update({ featured_image: imagePath }).eq('id', article.id)
    console.log(`✓ article ${article.slug}${a.is_published === false ? '  [unpublished]' : ''}`)
  }

  // -- discount codes -----------------------------------------------------
  for (const code of DISCOUNT_CODES) {
    const { error } = await db.from('discount_codes').upsert(code, { onConflict: 'code' })
    if (error) throw new Error(`discount_codes/${code.code}: ${error.message}`)
    console.log(`✓ discount code ${code.code}`)
  }

  // -- early access signups --------------------------------------------------
  for (const email of EARLY_ACCESS_SIGNUPS) {
    const { error } = await db
      .from('early_access')
      .upsert({ email, source: 'seed' }, { onConflict: 'email' })
    if (error) throw new Error(`early_access/${email}: ${error.message}`)
  }
  console.log(`✓ ${EARLY_ACCESS_SIGNUPS.length} early access signups`)

  // -- guest orders, through the real create_order() RPC ---------------------
  //
  // Not a direct insert. orders/order_items have no INSERT policy for any
  // role (0007_rls.sql) by design -- create_order() is the only writer, even
  // for the service role, because it is also the only place that derives
  // price, decrements stock, and stamps status correctly. A direct insert
  // here would both violate that invariant and leave stock un-decremented,
  // silently drifting from what the products actually show as available.
  //
  // Idempotency key includes a date bucket rather than a raw timestamp, so
  // re-running the seed on the same day replays instead of piling up
  // duplicate orders -- each represents "the same demo order", not a new one.
  const today = new Date().toISOString().slice(0, 10)
  const variantId = async (slug, label) => {
    const { data } = await db
      .from('products')
      .select('product_variants(id, label)')
      .eq('slug', slug)
      .single()
    return data.product_variants.find((v) => v.label === label)?.id
  }

  const codVariant = await variantId('midi-skirt', 'M')
  const bkashVariant = await variantId('tailored-pants', 'S')
  const shippedVariant = await variantId('canvas-sneakers', '39')
  const cancelledVariant = await variantId('wide-leg-linen-pants', 'M')

  async function seedOrder(key, payload) {
    const { data, error } = await db.rpc('create_order', { payload: { ...payload, idempotency_key: key } })
    if (error) throw new Error(`create_order/${key}: ${error.message}`)
    return data
  }

  const shippingAddress = { line1: '12 Gulshan Avenue', city: 'Dhaka', district: 'Dhaka', postal_code: '1212' }

  // 1. COD, straight to PROCESSING.
  const codOrder = await seedOrder(`seed-cod-${today}`, {
    payment_method: 'COD',
    customer_name: 'Rina Chowdhury',
    phone: '+8801711000001',
    email: 'rina.chowdhury@example.com',
    shipping_address: shippingAddress,
    items: [{ variant_id: codVariant, quantity: 1 }],
  })
  console.log(`✓ order ${codOrder.order_number}  COD, PROCESSING${codOrder.replayed ? ' (replayed)' : ''}`)

  // 2. bKash, PENDING_PAYMENT until a TrxID is submitted.
  const bkashOrder = await seedOrder(`seed-bkash-${today}`, {
    payment_method: 'BKASH',
    customer_name: 'Kamal Uddin',
    phone: '+8801711000002',
    email: 'kamal.uddin@example.com',
    shipping_address: shippingAddress,
    items: [{ variant_id: bkashVariant, quantity: 2 }],
  })
  console.log(`✓ order ${bkashOrder.order_number}  BKASH, PENDING_PAYMENT${bkashOrder.replayed ? ' (replayed)' : ''}`)

  // Submit a TrxID against it, so the admin MFS queue has something real to
  // review -- left at AWAITING_VERIFICATION on purpose, not approved, since
  // approving it is precisely what the (not-yet-built) admin queue is for.
  if (!bkashOrder.replayed) {
    const { error: mfsError } = await db.rpc('submit_mfs_transaction', {
      p_order_id: bkashOrder.order_id,
      p_token: bkashOrder.guest_token,
      p_provider: 'BKASH',
      p_trx_id: `SEED${today.replace(/-/g, '')}A1`,
      p_msisdn: '+8801711000002',
    })
    if (mfsError && !mfsError.message.includes('TRX_ID_ALREADY_USED')) {
      throw new Error(`submit_mfs_transaction: ${mfsError.message}`)
    }
    console.log('  ↳ bKash TrxID submitted, AWAITING_VERIFICATION')
  }

  // 3 & 4. Two orders walked past their initial status, for the admin order
  // list / customer order-tracking UI to have non-trivial states to render.
  //
  // NOT done via admin_update_order_status(): that function checks is_admin()
  // internally using auth.uid(), which is NULL under the service-role
  // connection this script runs as (confirmed directly against the local
  // stack -- `set role service_role; select auth.uid()` returns null even
  // though service_role bypasses RLS entirely). RLS bypass and this
  // in-function authorization check are different mechanisms; only the
  // former applies to service_role. So the transition logic is replicated
  // here directly against the tables service_role can freely write, mirroring
  // exactly what 0006_functions.sql's admin_update_order_status does for
  // these two specific transitions -- this is seed-script-only, not a
  // pattern for the app to ever follow.
  const shippedOrder = await seedOrder(`seed-shipped-${today}`, {
    payment_method: 'COD',
    customer_name: 'Nadia Islam',
    phone: '+8801711000003',
    email: 'nadia.islam@example.com',
    shipping_address: { line1: '45 Banani Road 11', city: 'Dhaka', district: 'Dhaka', postal_code: '1213' },
    items: [{ variant_id: shippedVariant, quantity: 1 }],
  })
  if (!shippedOrder.replayed) {
    const { error } = await db
      .from('orders')
      .update({
        status: 'SHIPPED',
        shipped_at: new Date().toISOString(),
        tracking_code: 'PATHAO-SEED-001',
        courier: 'Pathao',
      })
      .eq('id', shippedOrder.order_id)
    if (error) throw new Error(`walk shippedOrder to SHIPPED: ${error.message}`)
  }
  console.log(`✓ order ${shippedOrder.order_number}  COD, walked to SHIPPED`)

  const cancelledOrder = await seedOrder(`seed-cancelled-${today}`, {
    payment_method: 'COD',
    customer_name: 'Sabbir Khan',
    phone: '+8801711000004',
    email: 'sabbir.khan@example.com',
    shipping_address: { line1: '7 Dhanmondi 27', city: 'Dhaka', district: 'Dhaka', postal_code: '1209' },
    items: [{ variant_id: cancelledVariant, quantity: 1 }],
  })
  if (!cancelledOrder.replayed) {
    // Mirrors admin_update_order_status's CANCELLED branch: restore stock
    // per line, guarded by stock_released so a replayed seed run can't
    // double-restore, then flip the order itself.
    const { data: order } = await db
      .from('orders')
      .select('stock_released, payment_status')
      .eq('id', cancelledOrder.order_id)
      .single()

    if (!order.stock_released) {
      const { data: items } = await db
        .from('order_items')
        .select('variant_id, quantity')
        .eq('order_id', cancelledOrder.order_id)
      for (const item of items) {
        if (!item.variant_id) continue
        const { data: variant } = await db
          .from('product_variants')
          .select('stock')
          .eq('id', item.variant_id)
          .single()
        const { error } = await db
          .from('product_variants')
          .update({ stock: variant.stock + item.quantity })
          .eq('id', item.variant_id)
        if (error) throw new Error(`restore stock for cancelledOrder: ${error.message}`)
      }
    }

    const { error } = await db
      .from('orders')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        stock_released: true,
        admin_note: 'Customer requested cancellation (seed data)',
        payment_status: order.payment_status === 'PAID' ? 'REFUNDED' : order.payment_status,
      })
      .eq('id', cancelledOrder.order_id)
    if (error) throw new Error(`walk cancelledOrder to CANCELLED: ${error.message}`)
  }
  console.log(`✓ order ${cancelledOrder.order_number}  COD, CANCELLED (stock restored)`)

  // 5. A discounted order, to prove validate_discount + create_order agree,
  // and to leave a real used_count increment on WELCOME10 from an actual
  // order rather than only the seeded starting number above.
  const discountedOrder = await seedOrder(`seed-discount-${today}`, {
    payment_method: 'COD',
    customer_name: 'Farzana Akter',
    phone: '+8801711000005',
    email: 'farzana.akter@example.com',
    shipping_address: { line1: '3 Uttara Sector 4', city: 'Dhaka', district: 'Dhaka', postal_code: '1230' },
    discount_code: 'FLAT500',
    items: [{ variant_id: await variantId('pleated-trousers', 'M'), quantity: 1 }],
  })
  // A replay omits total_minor entirely (create_order's replay branch
  // returns only order_id/guest_token/order_number/replayed) -- only report
  // a total when this run actually created the order.
  console.log(
    `✓ order ${discountedOrder.order_number}  COD with FLAT500` +
      (discountedOrder.replayed
        ? '  (replayed)'
        : `, total ৳${(discountedOrder.total_minor / 100).toLocaleString('en-BD')}`),
  )

  console.log(
    '\nDone.\n\n' +
      'Next: create your admin user through the app or the Supabase dashboard,\n' +
      'then promote it once by hand:\n\n' +
      "  update profiles set role = 'admin' where email = 'you@example.com';\n",
  )
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message)
  process.exit(1)
})
