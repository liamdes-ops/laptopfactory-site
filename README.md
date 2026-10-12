# LaptopFactory

A responsive website for LaptopFactory, a refurbished computer and repair shop in Bardez, Goa. It includes a live stock catalog, a private admin page, and Vercel serverless API routes backed by Supabase.

## Pages

- `index.html` — shop overview and paths to buying or repairs
- `products.html` — refurbished computer categories and current in-stock listings
- `repairs.html` — repair contact information
- `contact.html` — location, phone, WhatsApp, map directions, and listed opening-time note
- `admin.html` — private stock management at `/admin.html`

## Inventory setup

The website uses a separate Supabase project for LaptopFactory. Do not add this table to another client site's database.

1. In the Supabase SQL Editor for the LaptopFactory project, run `supabase/inventory-schema.sql`.
2. Create the admin account in Supabase Auth and confirm its email. The site does not allow public account sign-up.
3. In the Vercel project settings, add these environment variables for Production and Preview:

   - `SUPABASE_URL` — the project's URL
   - `SUPABASE_PUBLISHABLE_KEY` — the publishable key
   - `SUPABASE_SECRET_KEY` — the secret key; keep this server-side and out of GitHub
   - `LAPTOPFACTORY_ADMIN_EMAILS` — the allowed admin email addresses, comma-separated if there is more than one

   For existing projects, the API also accepts the legacy names `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. New setups should use the publishable and secret keys.
4. Redeploy after saving the environment variables. Sign in at `/admin.html` and add the actual stock. Nothing is prefilled, so the public site won't show invented products or prices.

The public API only returns active items with a quantity above zero. Admin changes are handled by Vercel Functions under `api/`; the secret key is never sent to the browser. Public database reads are limited by the RLS policy in the SQL setup.

Opening the HTML files directly with `file://` does not run the API. View the live inventory and admin panel through the deployed Vercel site (or run it with the Vercel development server).

Items support a name, type, brand, model, condition, specifications, INR price, quantity, optional HTTPS photo URL, and a visibility toggle. The admin can add, edit, and permanently delete entries. Product cards reveal device details with a keyboard- and touch-friendly flip. Image upload is not included; use a hosted HTTPS image URL if a product photo is needed.

## Deploying

Keep the Vercel project's root directory set to the folder containing these files. When the site is connected to GitHub, pushing these files to its connected branch deploys the static pages and `/api` Functions together.

The site uses plain HTML, CSS, and JavaScript. The API routes use Node.js built-ins and Vercel's Node.js Functions, with no client-side database package.
