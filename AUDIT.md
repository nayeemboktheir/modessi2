# Modessi — End-to-End Audit

Scope: database schema and RLS policies, all 15 edge functions, the storefront, the admin panel, and
build/deploy configuration. Every finding below was verified against the code on the `migration`
branch; anything that could not be confirmed by reading the source was dropped.

Ordered by severity. Line references are clickable.

---

## Critical — security

### 1. Every edge function is callable by anyone on the internet

The router in [supabase/functions/main/index.ts:58-69](supabase/functions/main/index.ts#L58-L69) only
verifies that the bearer token is *signed* by `JWT_SECRET`. The anon key is exactly such a token and
is baked into the public JS bundle. No function checks the caller's role except `create-admin-user`
and `reset-user-password`. Everything else runs on the service-role key with zero authorization:

| Function | What an anonymous caller can do |
|---|---|
| [send-sms](supabase/functions/send-sms/index.ts#L189) | Send arbitrary text to arbitrary numbers on the paid SMS account — no rate limit, no allowlist |
| [steadfast-courier](supabase/functions/steadfast-courier/index.ts#L100) | Create real COD consignments and set `status='processing'` on any order |
| [carrybee-courier](supabase/functions/carrybee-courier/index.ts#L170) | Same |
| [customer-history](supabase/functions/customer-history/index.ts#L57) | Dump any customer's name, order history and spend by phone number |
| [courier-history](supabase/functions/courier-history/index.ts#L30) / [combined-courier-history](supabase/functions/combined-courier-history/index.ts#L297) | Burn the paid BDCourier quota |
| [send-order-email](supabase/functions/send-order-email/index.ts#L28) | Send forged order emails to the shop inbox |
| [facebook-capi](supabase/functions/facebook-capi/index.ts#L89) / [google-analytics](supabase/functions/google-analytics/index.ts#L41) / [tiktok-events-api](supabase/functions/tiktok-events-api/index.ts#L79) | Inject fake conversions into the ad accounts |

`tiktok-events-api` is additionally in the router's default `PUBLIC_FUNCTIONS` set
([main/index.ts:41](supabase/functions/main/index.ts#L41)), so it needs no token at all.

**Fix direction:** each function must resolve the caller with `auth.getUser(token)` and check
`has_role(..., 'admin')` before doing anything, exactly as `reset-user-password` already does. The
genuinely public ones (`place-order`, the pixel forwarders) need their own validation and rate limits.

### 2. Anonymous read of every abandoned checkout

[Migration 20260121195758](supabase/migrations/20260121195758_a7b0389b-352b-45b4-9967-8b2b2544f844.sql)
grants `SELECT` and `UPDATE` on `draft_orders` to `anon` with `USING (true)`. That table holds name,
phone, street, district and cart contents. One anon-key request returns the PII of every customer who
ever started checkout, and any of those rows can be overwritten. The policy is named "by session" but
nothing filters by session.

### 3. Client-controlled price override on real products

[place-order/index.ts:417-421](supabase/functions/place-order/index.ts#L417-L421) trusts
`body.orderSource === 'manual'` — a plain request field, with no auth behind it — to accept
client-sent `price`, `customShippingCost`, `customDiscount` and `customAdvance`. The comment two
lines above claims totals are computed from DB values to prevent tampering. Anyone can place an order
for any product at any price, including a negative total.

### 4. `orders` and `order_items` accept anonymous inserts

Both have `INSERT ... WITH CHECK (true)`
([base migration](supabase/migrations/20260104175806_remix_migration_from_pg_dump.sql)), so the
`place-order` validation path can be bypassed entirely with a direct PostgREST insert.

---

## High — correctness and data loss

### 5. Order numbers collide and lose orders

[`generate_order_number()`](supabase/migrations/20260104175806_remix_migration_from_pg_dump.sql#L49)
builds `ORD-<date>-<4 random digits>` against a `UNIQUE` constraint on `order_number`. At ~100
orders/day that is roughly a 40% chance of at least one collision per day; the insert fails and the
customer sees "Failed to place order". Two identical `BEFORE INSERT` triggers
(`generate_order_number_trigger` and `set_order_number`) are also both attached to the table.

### 6. Manual orders with an advance payment always fail

[place-order/index.ts:530](supabase/functions/place-order/index.ts#L530) writes
`payment_status: 'partial'`, which is not in the `orders_payment_status_check` CHECK constraint
(`pending | paid | failed | refunded`). Every advance-payment order 500s.

### 7. Editing a product destroys size history and customer carts

[AdminProducts.tsx:349-360](src/pages/admin/AdminProducts.tsx#L349-L360) deletes all
`product_variations` for the product and re-inserts them with new IDs on *every* save. Because of
[migration 20260422101122](supabase/migrations/20260422101122_9862b4cf-c5e6-4f08-bceb-8ac0d9a174ed.sql),
that nulls `variation_id` on every historical `order_item` and cascade-deletes matching `cart_items`.
Fixing a typo in a description silently erases which size past orders were for and empties live carts.

### 8. Editing an order can leave it with zero line items

[OrderEditDialog.tsx:188-231](src/components/admin/OrderEditDialog.tsx#L188-L231) updates the order
and deletes its items in a `Promise.all`, then inserts the new items in a separate step with no
transaction. If the insert fails, the order keeps its total but has no items. The insert also
hardcodes `product_id: null, variation_id: null`, permanently severing edited orders from the catalog.

### 9. No stock control anywhere

`place-order` never checks or decrements stock, and no trigger does it either — nothing in
`supabase/functions` or `supabase/migrations` touches `stock` outside a one-off data fix. `stock` is
a display-only number edited by hand in AdminInventory. Overselling is unbounded, and
[AdminInventory.tsx:186](src/pages/admin/AdminInventory.tsx#L186) accepts negative values.

### 10. Customers see a UUID as their order number

[CheckoutPage.tsx:429](src/pages/CheckoutPage.tsx#L429) passes `orderNumber: order.id`, and
[createOrder](src/services/orderService.ts#L92) drops `data.orderNumber` from the response entirely.
The confirmation screen prints a raw UUID that matches nothing in the admin panel, the SMS, or the
invoice.

### 11. Landing-page checkout forms can never submit

The editor writes `settings.productId` (a string,
[SectionEditor.tsx:308](src/components/landing-builder/SectionEditor.tsx#L308)); the renderer reads
`settings.productIds` (an array, [LandingPage.tsx:160-161](src/pages/LandingPage.tsx#L160-L161)) and
bails when it is absent. Any checkout section built in the admin UI renders an empty product list
with a permanently disabled submit button.

### 12. `/reset-password` is not routed

`ResetPasswordPage.tsx` is never imported by [App.tsx](src/App.tsx); the catch-all route renders the
home page instead. Password-reset emails lead nowhere.

### 13. Sales reports silently truncate

[AdminReports.tsx:105-130](src/pages/admin/AdminReports.tsx#L105-L130) fetches orders with no
`.range()` or `.limit()`, so it is capped by whatever `PGRST_DB_MAX_ROWS` the stack sets (1000 on a
stock Supabase config). Past that, revenue and product stats reflect an arbitrary partial slice with
no warning. Same class of bug in [getDashboardStats](src/services/adminService.ts#L87), where revenue
is summed over a 200-row slice while the order count comes from a separate query — and all its counts
use `count: 'planned'`, which returns planner *estimates*, not real numbers.

### 14. Duplicate courier consignments

Neither [steadfast-courier](supabase/functions/steadfast-courier/index.ts#L118) nor
[carrybee-courier](supabase/functions/carrybee-courier/index.ts#L210) checks for an existing
`tracking_number` before creating a shipment. A double-click, a retry, or a bulk resend books — and
bills — a second COD delivery. The bulk buttons in
[AdminOrders.tsx:1403](src/pages/admin/AdminOrders.tsx#L1403) fire with no confirmation dialog,
unlike single-order delete.

---

## Medium

### 15. Courier caching and rate limiting do not work

[combined-courier-history](supabase/functions/combined-courier-history/index.ts#L14) keeps its 24h
cache and 2s throttle in module-level variables, but the self-hosted router spawns a fresh worker per
request ([main/index.ts:96](supabase/functions/main/index.ts#L96)), so both reset on every call.
Combined with [CombinedCourierHistoryInline](src/components/admin/CombinedCourierHistoryInline.tsx#L158)
firing one lookup per visible order row, opening the orders page hits the paid BDCourier API once per
customer, every time.

### 16. Ad-platform phone hashes are malformed

[facebook-capi:196-199](supabase/functions/facebook-capi/index.ts#L196-L199) and
[tiktok-events-api:180-183](supabase/functions/tiktok-events-api/index.ts#L180-L183) build
`"880" + "01712345678"` into `88001712345678`, keeping the leading zero. The correct E.164 form is
`8801712345678`. Every server-side conversion carries an unmatched phone hash, degrading attribution —
the main reason to run CAPI at all.

### 17. Plaintext PII in function logs

[facebook-capi:177](supabase/functions/facebook-capi/index.ts#L177) logs the raw email, phone, name,
city and zip before hashing. [send-sms:194](supabase/functions/send-sms/index.ts#L194) and
[customer-history:138](supabase/functions/customer-history/index.ts#L138) log phone numbers and order
history.

### 18. Internal function calls carry no auth header

`place-order` calls `send-order-email` and `send-sms` by URL with no `Authorization` header
([place-order:73](supabase/functions/place-order/index.ts#L73),
[:135](supabase/functions/place-order/index.ts#L135)). If those functions are not listed in
`FUNCTIONS_NO_VERIFY_JWT`, both 401 and the failures are swallowed by `catch` — orders succeed while
notifications silently never send.

### 19. Order emails come from Resend's sandbox sender

[send-order-email:182](supabase/functions/send-order-email/index.ts#L182) uses
`onboarding@resend.dev`, which only delivers to the Resend account owner. Customer-supplied name,
address and notes are also interpolated into the email HTML unescaped
([:88-179](supabase/functions/send-order-email/index.ts#L88-L179)) — HTML injection into the shop's
inbox.

### 20. Duplicate Purchase events on refresh

[OrderConfirmationPage](src/pages/OrderConfirmationPage.tsx#L80) guards firing with refs, but
`location.state` survives a browser reload, so refreshing re-fires Purchase with a *new* `eventId` —
deduplication fails and conversions inflate.

### 21. Admin route guard gaps

[AdminOrderProtection](src/pages/admin/AdminOrderProtection.tsx) is routed outside `AdminLayout` with
no auth check at all; [AdminLandingVideoSettings:14](src/pages/admin/AdminLandingVideoSettings.tsx#L14)
checks `user` but not `isAdmin`. RLS still blocks the data, but both UIs open for anyone. The
`isAdmin` result is also cached module-level for 5 minutes
([useAuth.tsx:18](src/hooks/useAuth.tsx#L18)), so a demoted admin keeps UI access until it expires.

### 22. Silent write failures

- [adminService.ts:360](src/services/adminService.ts#L360) discards the error from `.single()` on
  `user_roles` and falls through to an insert, creating duplicate role rows.
- [create-admin-user:132](supabase/functions/create-admin-user/index.ts#L132) treats a zero-row
  `update` as success, so the function can report success without granting admin.
- [AdminOrders.tsx:1017](src/pages/admin/AdminOrders.tsx#L1017) applies a bulk status change to the
  local UI for every selected order regardless of which updates actually failed.
- [CheckoutPage.tsx:283](src/pages/CheckoutPage.tsx#L283) ignores a `maybeSingle()` error and creates
  duplicate drafts.
- [AdminSiteSettings.tsx:56-102](src/pages/admin/AdminSiteSettings.tsx#L56-L102) writes back all four
  header fields from stale local state, clobbering a concurrent edit by another admin.

### 23. Bulk operations abort mid-way

[AdminWholesalePrices.tsx:213](src/pages/admin/AdminWholesalePrices.tsx#L213) throws on the first
failure inside the loop, leaving the catalog partially repriced with no report of which products
changed. [steadfast-status:132](supabase/functions/steadfast-status/index.ts#L132) and the courier
bulk loops are unbounded and sequential, so large batches exceed the router's 150s worker timeout
after some shipments are already billed. The courier bulk branch also skips the required-field
validation the single-order branch enforces
([steadfast-courier:118](supabase/functions/steadfast-courier/index.ts#L118)), and neither courier
`fetch` sets a timeout.

### 24. `steadfast-status` reads fields the API does not return

[steadfast-status:83-95](supabase/functions/steadfast-status/index.ts#L83-L95) pulls
`consignment.recipient_*` and `rider_*` from the tracking-status response, but those only exist on the
create-order response — every field except `current_status` is always `undefined`.

### 25. 2.1 MB single JS bundle

547 kB gzipped, confirmed by `npm run build`. No route-level code splitting, so every storefront
visitor on mobile data downloads all 24 admin pages plus recharts. The site logo is also a 590 kB PNG.

### 26. Out-of-stock products are purchasable in the UI

[ProductCard.tsx:189](src/components/products/ProductCard.tsx#L189) never checks `product.stock`;
[FashionHomePage.tsx:289](src/pages/FashionHomePage.tsx#L289) hardcodes `stock: 100` onto the cart
object; [cartSlice.ts:64](src/store/slices/cartSlice.ts#L64) clamps quantity at the low end only. The
Cotton Tarsel and Reyon Cotton landing pages do not disable sold-out colours, though the
near-identical Digital Tarsel page does.

### 27. AdminOrders loads the entire orders table into the browser

[AdminOrders.tsx:240-268](src/pages/admin/AdminOrders.tsx#L240-L268) pages through *all* orders with
their line items in 500-row batches, then filters client-side and caches the whole set in
`sessionStorage`, whose quota failure is swallowed at
[AdminOrders.tsx:158](src/pages/admin/AdminOrders.tsx#L158). `getAllOrders` in
[adminService.ts:240](src/services/adminService.ts#L240) does the same with 800-row batches.

---

## Low

### 28. Over-broad phone matching

`ilike.%<last 10 digits>%` in [customer-history:61](supabase/functions/customer-history/index.ts#L61)
and [combined-courier-history:170](supabase/functions/combined-courier-history/index.ts#L170) is a
substring match that can return a different customer's history.

### 29. Iframe allowlist is bypassable

[videoEmbed.ts:35](src/lib/videoEmbed.ts#L35) uses `url.hostname.includes(d)`, so
`youtube.com.evil.com` passes. [ProductLandingPage.tsx:344](src/pages/ProductLandingPage.tsx#L344)
skips the helper entirely and injects raw HTML by design.

### 30. Conditional hook in `SocialChatWidget`

[SocialChatWidget.tsx:21](src/components/SocialChatWidget.tsx#L21) calls `useQuery` after an early
`return null` — a rules-of-hooks violation and the one real error from `npm run lint`. Currently
latent: the component is never imported, so the WhatsApp/Messenger widget it implements never renders
even when an admin enables it.

### 31. Dead code

`HomePage.tsx`, `TulshiLandingPage.tsx`, `NotFound.tsx` (the `*` route renders the home page),
`AdminSteadfast.tsx`, `supabase/functions/index.ts`, `src/data/mockData.ts`, and the landing-builder
Row/Widget editors — none reachable from [App.tsx](src/App.tsx).

### 32. No per-page SEO

[index.html](index.html) hardcodes one title, description and `og:image` for all routes and there is
no react-helmet, so every product and landing page shares a generic Facebook link preview. No
`sitemap.xml` either.

### 33. Config drift

`netlify.toml`, `vercel.json` and `public/_redirects` are all present although deployment is to
Hostinger via `.htaccess`. The Resend key is read from `admin_settings` while the README says it is a
container secret. `bun.lock` and `bun.lockb` sit alongside the npm lockfile that CI actually uses.

### 34. Lint and tooling

`npm run lint` reports 123 errors and 21 warnings. caniuse-lite is 15 months stale.

---

## Suggested order of work

1. **#1** and **#2** — live data-exposure and cost-abuse paths reachable right now with nothing but
   the public anon key.
2. **#5** — quietly losing real orders today.
3. **#7** and **#8** — silent, irreversible data loss triggered by ordinary admin actions.
4. **#3**, **#4**, **#9** — order and inventory integrity.
5. Everything else.
