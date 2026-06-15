-- ============================================================
-- SEED USERS — Jalankan SETELAH schema.sql
-- CATATAN: Buat dulu user di Authentication → Users di Supabase
-- dengan email & password di bawah, lalu jalankan SQL ini
-- untuk mengisi data profil & role mereka.
--
-- Atau gunakan script ini SETELAH mendapat UUID dari auth.users
-- ============================================================

-- Cara pakai:
-- 1. Pergi ke Supabase → Authentication → Users → Add User
-- 2. Buat user dengan email & password di bawah
-- 3. Copy UUID-nya dari daftar users
-- 4. Paste UUID ke kolom 'id' di bawah
-- 5. Jalankan SQL ini

-- ============================================================
-- SAMPLE: Update user yang sudah dibuat via Auth
-- Ganti UUID sesuai hasil dari Authentication → Users
-- ============================================================

-- Contoh update setelah buat user manual:
-- UPDATE users SET
--   full_name = 'Ahmad Super Admin',
--   role = 'super_admin',
--   division_id = NULL,
--   is_active = TRUE
-- WHERE email = 'superadmin@goda.id';

-- UPDATE users SET
--   full_name = 'Budi SPV Manager',
--   role = 'spv_manager',
--   division_id = '11111111-1111-1111-1111-111111111111',
--   is_active = TRUE
-- WHERE email = 'spv@goda.id';

-- UPDATE users SET
--   full_name = 'Citra Leader Branding',
--   role = 'leader_divisi',
--   division_id = '11111111-1111-1111-1111-111111111111',
--   is_active = TRUE
-- WHERE email = 'leader.branding@goda.id';

-- UPDATE users SET
--   full_name = 'Rama Aditya',
--   role = 'staff',
--   division_id = '11111111-1111-1111-1111-111111111111',
--   is_active = TRUE
-- WHERE email = 'rama@goda.id';

-- UPDATE users SET
--   full_name = 'Direktur Goda',
--   role = 'head_director',
--   division_id = NULL,
--   is_active = TRUE
-- WHERE email = 'direktur@goda.id';
