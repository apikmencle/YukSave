# YukSave

Download video TikTok tanpa watermark — tempel link, dapat file dalam
hitungan detik. Dibangun dengan Next.js (App Router), Supabase, dan
di-deploy ke Vercel.

## Struktur project

```
app/
  page.tsx           -> UI utama (paste link + hasil download)
  admin/page.tsx      -> Dashboard analytics (password-protected)
  api/parse/route.ts -> API route: parsing + caching + rate limit
  api/admin/          -> API auth + stats untuk dashboard admin
lib/
  parsers/tiktok.ts   -> Chain of fallback parsers (tikwm, dst.)
  supabase.ts         -> Supabase server client
  admin-auth.ts       -> Validasi session cookie admin
supabase/
  schema.sql          -> Tabel `downloads` (cache + rate limiting)
```

## Cara jalanin secara lokal

```bash
npm install
cp .env.local.example .env.local
# isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IP_HASH_SECRET,
# ADMIN_PASSWORD, dan ADMIN_SESSION_SECRET di .env.local
npm run dev
```

## Setup Supabase

1. Buat project baru di https://supabase.com
2. Buka SQL editor, jalankan isi `supabase/schema.sql`
3. Salin `Project URL` dan `service_role` key (Settings > API) ke `.env.local`

## Dashboard Admin

Buka `/admin` untuk lihat statistik: total download, download 24 jam
dan 7 hari terakhir, serta link yang paling sering diminta.

- `ADMIN_PASSWORD` — password untuk masuk ke `/admin`, pilih yang kuat
- `ADMIN_SESSION_SECRET` — string acak panjang untuk menandatangani
  session cookie (bukan password, isi bebas asal panjang & rahasia,
  misal hasil dari `openssl rand -hex 32`)

## Deploy ke Vercel

1. Push repo ini ke GitHub
2. Import project di https://vercel.com/new
3. Tambahkan environment variables yang sama (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SECRET`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`) di pengaturan project Vercel
4. Deploy

## Catatan penting

- **Parser TikTok tidak resmi**: endpoint yang dipakai (`tikwm.com`)
  bisa berubah atau mati sewaktu-waktu karena bukan API resmi TikTok.
  Sudah disiapkan struktur fallback chain di `lib/parsers/tiktok.ts` —
  tambahkan parser kedua di sana begitu kamu punya endpoint cadangan.
- **Rate limiting**: dibatasi 10 request/menit per IP (di-HMAC pakai
  `IP_HASH_SECRET`, bukan IP mentah yang disimpan) lewat tabel
  `downloads` di Supabase. Ubah `RATE_LIMIT_PER_MINUTE` di
  `app/api/parse/route.ts` sesuai kebutuhan. Jaga `IP_HASH_SECRET`
  tetap rahasia dan jangan dipakai ulang di environment lain — kalau
  ini bocor, hash IP di database bisa di-brute-force balik.
- **Caching**: hasil parsing di-cache 1 jam per URL supaya request yang
  sama tidak fetch ulang ke TikTok.
- Proyek ini untuk penggunaan pribadi/edukasi — hormati hak cipta
  kreator dan ToS platform sumber.

## Langkah lanjutan yang disarankan

- Tambahkan parser fallback kedua (server lain selain tikwm)
- Tambahkan halaman FAQ + SEO copy untuk kata kunci pencarian
- Pertimbangkan fitur premium (batch download, no-ads) untuk monetisasi
