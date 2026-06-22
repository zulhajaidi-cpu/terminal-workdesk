import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// ── quiz_questions: bank soal statis terkurasi ───────────────────────────
await sql`
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question text NOT NULL,
    options jsonb NOT NULL,            -- array of string (2-4 opsi)
    correct_index smallint NOT NULL,
    explanation text NOT NULL,         -- kunci jawaban edukatif
    category text NOT NULL DEFAULT 'Umum',
    difficulty text NOT NULL DEFAULT 'easy',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ quiz_questions ready')

// ── quiz_attempts: 1 percobaan per user per hari ─────────────────────────
await sql`
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    question_id uuid NOT NULL REFERENCES quiz_questions(id),
    quiz_date date NOT NULL,
    selected_index smallint NOT NULL,
    is_correct boolean NOT NULL,
    exp_awarded integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`
await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempts_user_day ON quiz_attempts(user_id, quiz_date)`
console.log('✓ quiz_attempts ready (unique user+day)')

// ── rule EXP quiz (idempotent) ───────────────────────────────────────────
await sql`
  INSERT INTO gamification_rules (event_key, points, is_active)
  VALUES ('quiz_correct', 15, true)
  ON CONFLICT (event_key) DO NOTHING
`
console.log('✓ gamification_rules quiz_correct = 15')

// ── Seed bank soal (idempotent: skip kalau sudah ada soal) ───────────────
const existing = await sql`SELECT COUNT(*)::int AS n FROM quiz_questions`
if (existing[0].n > 0) {
  console.log(`· quiz_questions sudah berisi ${existing[0].n} soal, seed dilewati`)
} else {
  const Q = [
    // ── Creative Marketing ──
    { q: 'Dalam marketing funnel, tahap "Awareness" bertujuan untuk?',
      o: ['Menutup penjualan secepatnya', 'Membuat calon audiens mengenal brand', 'Menagih pembayaran', 'Mengurus retur barang'],
      c: 1, e: 'Awareness adalah puncak funnel: tujuannya memperkenalkan brand ke audiens baru, belum berjualan langsung.', cat: 'Creative Marketing' },
    { q: 'Istilah "CTA" pada sebuah konten promosi berarti?',
      o: ['Creative Team Asset', 'Call To Action', 'Cost To Acquire', 'Content Tone Analysis'],
      c: 1, e: 'CTA = Call To Action, ajakan eksplisit ke audiens (mis. "Beli sekarang", "Daftar di sini").', cat: 'Creative Marketing' },
    { q: 'Metrik "engagement rate" di media sosial mengukur?',
      o: ['Jumlah followers total', 'Interaksi (like/komen/share) relatif terhadap jangkauan', 'Biaya iklan per klik', 'Durasi video'],
      c: 1, e: 'Engagement rate = interaksi dibagi reach/followers — mengukur seberapa aktif audiens merespons, bukan sekadar jumlah pengikut.', cat: 'Creative Marketing' },

    // ── Branding ──
    { q: 'Apa yang dimaksud "brand consistency"?',
      o: ['Sering ganti logo agar segar', 'Tampilan & pesan brand seragam di semua kanal', 'Memakai banyak warna sekaligus', 'Menyalin gaya kompetitor'],
      c: 1, e: 'Brand consistency menjaga elemen visual & verbal (logo, warna, tone) tetap seragam di semua titik sentuh agar mudah dikenali.', cat: 'Branding' },
    { q: '"Brand voice" mengacu pada?',
      o: ['Volume musik di iklan', 'Kepribadian & gaya bahasa khas brand', 'Suara MC saat event', 'Jenis font logo'],
      c: 1, e: 'Brand voice adalah kepribadian brand yang konsisten dalam cara berkomunikasi — mis. santai, profesional, atau berani.', cat: 'Branding' },
    { q: 'Palet warna brand sebaiknya didokumentasikan di?',
      o: ['Brand guideline', 'Invoice', 'Kontrak kerja', 'Laporan pajak'],
      c: 0, e: 'Brand guideline mendokumentasikan warna, logo, tipografi, dan aturan pakai agar brand tampil konsisten lintas tim.', cat: 'Branding' },

    // ── Design ──
    { q: 'Mode warna yang tepat untuk desain yang akan DICETAK adalah?',
      o: ['RGB', 'CMYK', 'HSL', 'Hex'],
      c: 1, e: 'CMYK (Cyan-Magenta-Yellow-Key/Black) dipakai untuk cetak; RGB untuk layar digital.', cat: 'Design' },
    { q: 'Format gambar yang mendukung latar TRANSPARAN adalah?',
      o: ['JPG', 'PNG', 'BMP', 'PDF teks'],
      c: 1, e: 'PNG mendukung kanal alpha (transparansi). JPG tidak mendukung area transparan.', cat: 'Design' },
    { q: 'Prinsip "white space" (ruang kosong) dalam desain berguna untuk?',
      o: ['Membuang area sia-sia', 'Memberi napas & fokus pada elemen penting', 'Menghemat tinta', 'Menambah jumlah teks'],
      c: 1, e: 'White space mengarahkan mata, meningkatkan keterbacaan, dan menonjolkan elemen utama — bukan ruang terbuang.', cat: 'Design' },
    { q: 'Format file desain yang berbasis VEKTOR (tak pecah saat diperbesar)?',
      o: ['JPG', 'PNG', 'SVG', 'GIF'],
      c: 2, e: 'SVG adalah vektor sehingga tetap tajam di ukuran apa pun; JPG/PNG/GIF berbasis piksel (raster).', cat: 'Design' },

    // ── Video Editing ──
    { q: 'Istilah "B-roll" dalam video editing adalah?',
      o: ['Rekaman utama wawancara', 'Footage pendukung untuk memperkaya cerita', 'Musik latar', 'Subtitle'],
      c: 1, e: 'B-roll adalah footage tambahan (suasana, detail) yang menutup potongan dan memperkuat narasi di atas A-roll utama.', cat: 'Video Editing' },
    { q: 'Frame rate "24fps" pada video umumnya memberi kesan?',
      o: ['Sangat patah-patah', 'Sinematik seperti film', 'Slow motion ekstrem', 'Gambar diam'],
      c: 1, e: '24fps adalah standar film dan memberi nuansa sinematik. Frame rate lebih tinggi (60fps) terasa lebih "halus/real".', cat: 'Video Editing' },
    { q: 'Rasio aspek yang paling cocok untuk konten Reels/TikTok (vertikal) adalah?',
      o: ['16:9', '1:1', '9:16', '4:3'],
      c: 2, e: '9:16 adalah rasio vertikal penuh layar ponsel, ideal untuk Reels, TikTok, dan Stories.', cat: 'Video Editing' },

    // ── Product Knowledge: kendaraan listrik (fakta umum & aman) ──
    { q: 'Satuan kapasitas baterai yang menunjukkan "seberapa jauh bisa menempuh" umumnya dinyatakan dalam?',
      o: ['Watt-hour (Wh)', 'Desibel (dB)', 'Lumen (lm)', 'Pascal (Pa)'],
      c: 0, e: 'Kapasitas energi baterai diukur dalam Watt-hour (Wh) atau Amp-hour (Ah); makin besar Wh, umumnya makin jauh jarak tempuh.', cat: 'Product Knowledge' },
    { q: 'Pada kendaraan listrik, "regenerative braking" berfungsi untuk?',
      o: ['Menambah bobot kendaraan', 'Mengisi ulang sebagian energi saat mengerem', 'Mengeraskan klakson', 'Mematikan lampu otomatis'],
      c: 1, e: 'Regenerative braking mengubah energi pengereman menjadi listrik untuk mengisi ulang baterai, menambah efisiensi.', cat: 'Product Knowledge' },
    { q: 'Jenis motor yang umum dipakai pada sepeda/motor listrik modern adalah?',
      o: ['Motor uap', 'Motor BLDC (brushless DC)', 'Mesin diesel', 'Turbin angin'],
      c: 1, e: 'Motor BLDC (Brushless DC) efisien, minim perawatan, dan responsif — lazim pada sepeda & motor listrik masa kini.', cat: 'Product Knowledge' },
  ]

  for (const item of Q) {
    await sql`
      INSERT INTO quiz_questions (question, options, correct_index, explanation, category)
      VALUES (${item.q}, ${JSON.stringify(item.o)}, ${item.c}, ${item.e}, ${item.cat})
    `
  }
  console.log(`✓ seeded ${Q.length} soal kuis`)
}

console.log('\n✅ migrate-quiz done')
