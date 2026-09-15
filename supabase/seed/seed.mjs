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
 * Plain .mjs rather than .ts on purpose: this machine runs Node 20.14, which
 * predates --experimental-strip-types (Node 22.6+). A seed script is not worth
 * a transpile step.
 *
 * Idempotent: re-running upserts by slug rather than duplicating the catalog.
 *
 * Ports the content of the old scripts/seed.ts, with two changes:
 *   - prices are BDT poisha, not USD decimal strings
 *   - every product gets real size variants, because stock now lives on the
 *     variant and never on the product
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

if (SERVICE_KEY.startsWith('eyJ') === false) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY does not look like a JWT. Continuing anyway.')
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

  const { error } = await db.storage
    .from(bucket)
    .upload(objectPath, webp, { contentType: 'image/webp', upsert: true })

  if (error) throw new Error(`upload ${bucket}/${objectPath}: ${error.message}`)
  console.log(`  ↑ ${bucket}/${objectPath}  (${(webp.length / 1024).toFixed(0)} KB, was ${(source.length / 1024).toFixed(0)} KB)`)
  return objectPath
}

/** Insert-or-update a row by its slug, returning the row. */
async function upsertBySlug(table, row) {
  const { data, error } = await db.from(table).upsert(row, { onConflict: 'slug' }).select().single()
  if (error) throw new Error(`${table}/${row.slug}: ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------

const COLLECTION = {
  slug: 'summer-elegance-2024',
  title: 'Summer Elegance 2024',
  season: 'Summer 2024',
  description: 'Ethereal summer collection featuring flowing silhouettes and light fabrics',
  sort_order: 1,
  is_active: true,
}

/**
 * Prices carried over from the old USD seed, repriced for the Dhaka market.
 * Relative ordering is preserved: pants < skirt < shirt < corset.
 * `stock` is the old per-product number, split across sizes below.
 */
const PRODUCTS = [
  {
    slug: 'tailored-pants',
    name: 'Tailored Pants',
    category: 'Pants',
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
    description: 'Oversized cream silk button-up with gold embroidery details',
    details: ' 100% mulberry silk with hand-worked gold embroidery. Dry clean only.',
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
    description: 'Flowing A-line black midi skirt with gold pleating details',
    details: 'Crepe with pressed gold-thread pleating. Cold hand wash.',
    price: taka(4800),
    image: 'public/products/kochu-skirt-1.png',
    sizes: [['XS', 2], ['S', 4], ['M', 4], ['L', 2]],
  },
  {
    slug: 'structured-corset',
    name: 'Structured Corset',
    category: 'Corsets',
    description: 'Structured black satin corset with gold lacing details',
    details: 'Boned satin with adjustable gold lacing. Spot clean only.',
    price: taka(6900),
    image: 'public/products/kochu-corset-1.png',
    // Deliberately low, so the low-stock alert on the admin dashboard has
    // something to show on a fresh install.
    sizes: [['XS', 1], ['S', 3], ['M', 3], ['L', 1]],
  },
]

const ARTICLES = [
  {
    slug: 'the-art-of-luxury-minimalism',
    title: 'The Art of Luxury Minimalism',
    abstract: 'Discover how less can be more in luxury fashion. Explore the philosophy behind minimalist design.',
    content:
      "Luxury minimalism is more than just a style — it's a philosophy. In this article, we explore how the restraint of materials and colour palettes can create powerful fashion statements.\n\nThe discipline is subtractive. Every seam that stays has earned its place.",
  },
  {
    slug: 'sustainable-fashion-forward',
    title: 'Sustainable Fashion Forward',
    abstract: 'Learn about our commitment to sustainable and ethical fashion practices.',
    content:
      "At KOCHU, sustainability is not just a buzzword. We're committed to creating beautiful pieces while respecting our planet and the artisans who craft them.\n\nWe produce in small runs, in Dhaka, and we name our workshops.",
  },
  {
    slug: 'the-power-of-tailoring',
    title: 'The Power of Tailoring',
    abstract: 'How perfect tailoring transforms a piece from good to exceptional.',
    content:
      'The difference between ordinary and extraordinary fashion lies in the details. Perfect tailoring can elevate any garment, making it uniquely yours.\n\nFit is the only luxury that cannot be bought off a rack.',
  },
]

/**
 * Two drops, shaped for the Phase 1 visibility tests:
 *   - `midnight-gold` is live now: its products are publicly purchasable.
 *   - `winter-preview` opens to VIPs now but to the public in a week, so
 *     `drop_access` holders can buy it and anon cannot even see it.
 */
const DROPS = [
  {
    slug: 'midnight-gold',
    title: 'Midnight Gold',
    description: 'A six-piece capsule in black satin and antique gold.',
    starts_at: days(-2),
    ends_at: days(30),
    is_published: true,
  },
  {
    slug: 'winter-preview',
    title: 'Winter Preview',
    description: 'Early access for members. Public launch in one week.',
    early_access_at: days(-0.04), // ~1 hour ago
    starts_at: days(7),
    access_key: 'KOCHUVIP',
    is_published: true,
  },
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

  // -- collection -----------------------------------------------------------
  const collection = await upsertBySlug('collections', COLLECTION)
  const coverPath = await uploadImage(
    'collections',
    `${collection.id}/cover.webp`,
    'public/collections/summer-2024.png',
  )
  await db.from('collections').update({ cover_image: coverPath }).eq('id', collection.id)
  console.log(`✓ collection ${collection.slug}`)

  // -- drops ----------------------------------------------------------------
  const drops = {}
  for (const d of DROPS) {
    const row = await upsertBySlug('drops', d)
    drops[d.slug] = row
    console.log(`✓ drop ${row.slug}`)
  }

  // -- products, variants, images -------------------------------------------
  for (const [index, p] of PRODUCTS.entries()) {
    // Put the last product behind the VIP-only drop so the gate has a subject.
    const dropId = index === PRODUCTS.length - 1 ? drops['winter-preview'].id : null

    const product = await upsertBySlug('products', {
      slug: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      details: p.details,
      price_minor: p.price,
      compare_at_minor: p.compare_at ?? null,
      collection_id: collection.id,
      drop_id: dropId,
      status: 'ACTIVE',
      is_featured: p.is_featured ?? false,
    })

    const imagePath = await uploadImage('products', `${product.id}/main.webp`, p.image)

    await db.from('product_images').delete().eq('product_id', product.id)
    const { error: imgError } = await db
      .from('product_images')
      .insert({ product_id: product.id, path: imagePath, alt: p.name, sort_order: 0 })
    if (imgError) throw new Error(`product_images/${p.slug}: ${imgError.message}`)

    const variants = p.sizes.map(([label, stock], i) => ({
      product_id: product.id,
      label,
      sku: `KCH-${p.slug.toUpperCase().replace(/-/g, '')}-${label}`,
      stock,
      sort_order: i,
      is_active: true,
    }))

    const { error: varError } = await db
      .from('product_variants')
      .upsert(variants, { onConflict: 'product_id,label' })
    if (varError) throw new Error(`product_variants/${p.slug}: ${varError.message}`)

    const total = p.sizes.reduce((sum, [, s]) => sum + s, 0)
    console.log(
      `✓ product ${product.slug}  ৳${(p.price / 100).toLocaleString('en-BD')}  ` +
        `${p.sizes.length} sizes, ${total} units${dropId ? '  [winter-preview, VIP only]' : ''}`,
    )
  }

  // -- articles -------------------------------------------------------------
  for (const a of ARTICLES) {
    const article = await upsertBySlug('articles', {
      ...a,
      collection_id: collection.id,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    const imagePath = await uploadImage(
      'articles',
      `${article.id}/cover.webp`,
      'public/collections/summer-2024.png',
    )
    await db.from('articles').update({ featured_image: imagePath }).eq('id', article.id)
    console.log(`✓ article ${article.slug}`)
  }

  // -- a discount code to exercise validate_discount() ----------------------
  const { error: codeError } = await db
    .from('discount_codes')
    .upsert(
      {
        code: 'WELCOME10',
        description: '10% off a first order',
        type: 'PERCENT',
        value: 10,
        min_order_minor: taka(2000),
        max_uses: 500,
        is_active: true,
      },
      { onConflict: 'code' },
    )
  if (codeError) throw new Error(`discount_codes: ${codeError.message}`)
  console.log('✓ discount code WELCOME10')

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
