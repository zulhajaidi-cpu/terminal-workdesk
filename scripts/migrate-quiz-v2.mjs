import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// ── Tambah kolom points + jadikan explanation opsional ───────────────────
await sql`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 15`
await sql`ALTER TABLE quiz_questions ALTER COLUMN explanation DROP NOT NULL`
console.log('✓ kolom points ditambah, explanation jadi nullable')

// ── Bank Soal Terminal GODA v1 (100 soal) ────────────────────────────────
// Format tiap item: [pertanyaan, [A,B,C,D], correctIndex, kategori, poin]
const GK = 'GODA Knowledge', PK = 'Product Knowledge', BR = 'Branding'
const CM = 'Creative Marketing', PE = 'Product & EV Knowledge', RT = 'Retail & Marketplace'
const EV = 'EV News', PT = 'Psychology Trap'

const BANK = [
  // ── Level 1 — Rookie Terminal (5) ──
  ['GODA bergerak di bidang utama apa?', ['Fashion','Kendaraan listrik','Makanan','Properti'], 1, GK, 5],
  ['Produk utama GODA yang sering dibahas adalah?', ['Sepeda listrik dan motor listrik','Kamera dan tripod','Laptop dan printer','Furnitur rumah'], 0, GK, 5],
  ['Project Godasantara Episode 2 mengambil lokasi utama di mana?', ['Bali','Bromo','Bandung','Surabaya'], 1, GK, 5],
  ['GODA EV Shield berkaitan dengan apa?', ['Program asuransi/perlindungan unit','Program makan siang','Program desain logo','Program absensi'], 0, GK, 5],
  ['Terminal Workdesk digunakan untuk apa?', ['Tracking pekerjaan, KPI, dan gamification','Mengedit video saja','Membuat invoice hotel','Mengganti baterai'], 0, GK, 5],
  ['Komunitas/VIP customer GODA yang pernah dibahas bernama?', ['GODA C','GODA Food','GODA Travel','GODA Music'], 0, GK, 5],
  ['Marketplace yang pernah dibahas untuk penjualan GODA adalah?', ['Shopee, Tokopedia, TikTok Shop','Amazon, eBay, Etsy','Steam, Epic, Origin','Netflix, Spotify, Disney'], 0, GK, 5],
  ['Project leasing GODA pernah membahas kerja sama dengan?', ['Kredivo dan Akulaku','Netflix dan Disney','Canva dan Figma','PLN dan PDAM'], 0, GK, 5],
  ['Event "Only Goda" lebih dekat dengan konsep apa?', ['VIP client dialogue/forum','Lomba makan','Turnamen futsal','Festival kuliner'], 0, GK, 5],
  ['GODA Tour The Java berkaitan dengan apa?', ['Perjalanan jarak jauh untuk membuktikan ketahanan/performa','Launching parfum','Audisi musik','Program magang'], 0, GK, 5],
  ['GD001 Lemon memiliki karakter visual yang paling dekat dengan?', ['Compact, cute, pastel/feminine','Off-road ekstrem','Military tactical','Luxury black-gold'], 0, PK, 5],
  ['GD123 Neo memiliki karakter yang paling dekat dengan?', ['Retro Japanese style','Futuristic racing only','Formal corporate','Heavy truck'], 0, PK, 5],
  ['GD299 Mecha Starship berkaitan dengan segmen apa?', ['E-moto high end','Sepeda anak TK','Produk dapur','Aksesoris kantor'], 0, PK, 5],
  ['Galactic Series berisi nama-nama seperti?', ['Helix, Helios, Sunray, Altair, Zenith','Apple, Banana, Mango','Alpha, Beta, Gamma saja','North, South, West'], 0, PK, 5],
  ['SKY/GD007 dalam percakapan kita termasuk kategori?', ['Unit sepeda listrik','Aplikasi kasir','Nama hotel','Nama campaign makanan'], 0, PK, 5],

  // ── Level 2 — Brand Explorer (10) ──
  ['Branding bukan hanya soal logo, tetapi juga soal?', ['Persepsi, pesan, pengalaman, dan konsistensi','Warna saja','Font saja','Harga saja'], 0, BR, 10],
  ['Tagline yang baik seharusnya?', ['Singkat, mudah diingat, dan mencerminkan janji brand','Panjang dan sulit dibaca','Berisi semua fitur teknis','Tidak perlu relevan'], 0, BR, 10],
  ['Brand trust paling kuat dibangun melalui?', ['Konsistensi, kualitas, aftersales, dan bukti nyata','Caption panjang','Warna mencolok saja','Diskon tanpa batas'], 0, BR, 10],
  ['Dalam campaign original vs imitasi, pesan terbaik adalah?', ['Menunjukkan bukti value produk asli','Mengejek customer','Menyerang semua kompetitor','Tidak memberi informasi'], 0, BR, 10],
  ['Visual promosi yang baik harus membuat audience memahami pesan dalam?', ['Beberapa detik pertama','Setelah membaca 10 menit','Setelah meeting internal','Setelah tanya admin'], 0, BR, 10],
  ['Positioning brand berarti?', ['Cara brand ingin dipahami di benak target market','Cara menyimpan file desain','Cara mengganti password','Cara mengirim barang'], 0, BR, 10],
  ['Target audience penting karena membantu tim menentukan?', ['Bahasa, visual, pesan, dan channel komunikasi','Warna favorit pribadi desainer','Jadwal makan siang','Ukuran meja kerja'], 0, BR, 10],
  ['Tone komunikasi GODA untuk customer sebaiknya?', ['Jelas, meyakinkan, edukatif, dan mudah dipahami','Terlalu teknis dan membingungkan','Merendahkan customer','Tanpa CTA'], 0, BR, 10],
  ['Dalam branding, konsistensi visual berguna untuk?', ['Membuat brand mudah dikenali','Membuat desain selalu ramai','Menghapus kebutuhan strategi','Mengganti fungsi produk'], 0, BR, 10],
  ['Brand yang kuat biasanya punya?', ['Identitas, pesan, pengalaman, dan bukti','Logo saja','Diskon saja','Warna saja'], 0, BR, 10],
  ['"Yang asli memberikan bukti lebih dari sekadar murah" paling cocok untuk campaign apa?', ['Original GODA vs produk imitasi','Promo makanan','Lowongan kerja','Reminder absensi'], 0, BR, 10],
  ['KV dalam event branding berarti?', ['Key Visual','Key Volume','Keyboard Version','Kilometer Value'], 0, BR, 10],
  ['Jika desain bagus tapi pesannya tidak jelas, kemungkinan besar audience akan?', ['Bingung dan tidak menangkap value','Langsung membeli','Otomatis loyal','Mengerti semua fitur'], 0, BR, 10],
  ['Elemen penting dalam poster produk adalah?', ['Headline, visual produk, benefit, dan CTA','Semua teks kecil','Tanpa produk','Tanpa arah baca'], 0, BR, 10],
  ['Brand storytelling berguna untuk?', ['Membuat pesan produk lebih emosional dan mudah diingat','Menghilangkan informasi produk','Membuat campaign selalu mahal','Mengganti fungsi retail'], 0, BR, 10],

  // ── Level 3 — Creative Marketing (15) ──
  ['Soft selling berarti menjual dengan cara?', ['Cerita, edukasi, problem-solution','Paksa beli','Hanya menampilkan harga','Tanpa konteks'], 0, CM, 15],
  ['Hard selling berarti?', ['Menjual langsung dengan promo, benefit, dan CTA jelas','Tidak menyebut produk','Hanya cerita personal','Tanpa ajakan beli'], 0, CM, 15],
  ['Konten edukasi produk sebaiknya dibuat?', ['Sederhana dan dekat dengan kebutuhan customer','Sangat teknis tanpa contoh','Panjang tanpa struktur','Tanpa visual'], 0, CM, 15],
  ['Konten FYP yang baik untuk brand tetap harus punya?', ['Relevansi produk dan tujuan komunikasi','Musik viral saja','Caption kosong','Visual asal ramai'], 0, CM, 15],
  ['CTA adalah singkatan dari?', ['Call To Action','Creative Text Area','Campaign Target Ads','Customer Type Analysis'], 0, CM, 15],
  ['Contoh CTA yang tepat untuk promosi dealer adalah?', ['Kunjungi dealer GODA terdekat','Semoga suka','Terserah kamu','Produk ini ada'], 0, CM, 15],
  ['Hook dalam konten berfungsi untuk?', ['Menarik perhatian di awal','Menutup video','Menentukan invoice','Mengatur stok'], 0, CM, 15],
  ['Angle "hemat biaya transportasi" cocok untuk produk?', ['Sepeda listrik dan motor listrik','Sofa ruang tamu','Botol minum saja','Kamera studio'], 0, CM, 15],
  ['Konten testimoni berguna untuk meningkatkan?', ['Kepercayaan calon customer','Ukuran file','Jumlah font','Warna background'], 0, CM, 15],
  ['Jika konten banyak views tetapi tidak menghasilkan leads, yang perlu dicek adalah?', ['Relevansi audience, CTA, dan funnel','Warna sepatu talent','Jam makan tim','Nama folder'], 0, CM, 15],
  ['Dalam campaign BBM naik, pesan yang lebih aman adalah?', ['Edukasi alternatif mobilitas yang lebih hemat','Menakut-nakuti customer','Menyerang pihak tertentu','Membuat klaim tanpa data'], 0, CM, 15],
  ['Konten original dalam target tim berarti?', ['Ide kreatif asli yang tidak hanya mengikuti tren','Repost konten lama','Copy mentah dari kompetitor','Video tanpa konsep'], 0, CM, 15],
  ['Thumbnail konten berfungsi untuk?', ['Menarik klik dan memberi gambaran isi','Mengganti isi video','Menyembunyikan pesan','Menghapus caption'], 0, CM, 15],
  ['Copywriting yang baik harus fokus pada?', ['Benefit untuk audience','Kebanggaan internal saja','Istilah sulit','Kalimat sepanjang mungkin'], 0, CM, 15],
  ['Dalam carousel edukasi, slide pertama sebaiknya berisi?', ['Hook atau masalah utama','Legal disclaimer panjang','Semua detail teknis','Daftar nama tim'], 0, CM, 15],

  // ── Level 4 — Product Guardian (15) ──
  ['SGS adalah singkatan dari?', ['Smart Go System','Safe Gear Speed','Super Green Style','Speed Guard System'], 0, PE, 15],
  ['SDS adalah singkatan dari?', ['Safe Driving System','Smart Design System','Sales Data Sheet','Super Drive Speed'], 0, PE, 15],
  ['Contoh fitur dalam SDS adalah?', ['E-ABS, TCS, Auto-P, SSPO, HAC','Logo, font, warna','Kamera, tripod, lighting','Diskon, voucher, cashback'], 0, PE, 15],
  ['TCS berfungsi untuk membantu?', ['Menjaga traksi agar roda tidak mudah slip','Mengubah warna body','Mengisi daya HP','Mengatur musik'], 0, PE, 15],
  ['HAC / Hill Hold berguna saat kendaraan berada di?', ['Tanjakan','Ruang meeting','Gudang desain','Parkiran mall saja'], 0, PE, 15],
  ['E-ABS berkaitan dengan sistem apa?', ['Pengereman','Audio','Lampu dekorasi','Kunci kontak manual'], 0, PE, 15],
  ['Auto-P berkaitan dengan fitur?', ['Parking otomatis','Kamera otomatis','Posting otomatis','Packing otomatis'], 0, PE, 15],
  ['Boost Mode berfungsi untuk?', ['Memberikan tenaga tambahan sesuai sistem kendaraan','Mengganti warna lampu','Menghapus data customer','Mengubah desain poster'], 0, PE, 15],
  ['IoT Start berarti kendaraan dapat dihubungkan dengan?', ['Sistem pintar/aplikasi','Kompor listrik','Mesin cuci','Televisi analog'], 0, PE, 15],
  ['Phone Charge pada unit berarti?', ['Bisa membantu mengisi daya perangkat','Bisa mencetak invoice','Bisa mengganti ban','Bisa mengirim email'], 0, PE, 15],
  ['Jarak tempuh kendaraan listrik dipengaruhi oleh?', ['Kapasitas baterai, beban, medan, kecepatan','Warna helm saja','Nama produk saja','Ukuran logo saja'], 0, PE, 15],
  ['Charger yang tidak sesuai spesifikasi dapat menyebabkan?', ['Risiko kerusakan dan pengisian tidak optimal','Unit makin cepat tanpa batas','Warna body berubah','Ban menjadi baru'], 0, PE, 15],
  ['Baterai pada EV berfungsi untuk?', ['Menyimpan energi listrik','Mengatur desain poster','Menentukan nama campaign','Menyimpan foto produk'], 0, PE, 15],
  ['Sepeda listrik cocok diposisikan untuk kebutuhan?', ['Mobilitas harian jarak dekat','Penerbangan antarnegara','Angkutan tambang berat','Kapal laut'], 0, PE, 15],
  ['Motor listrik memiliki keunggulan komunikasi berupa?', ['Lebih hemat operasional dan ramah lingkungan','Wajib pakai bensin','Tidak butuh baterai','Tidak perlu perawatan sama sekali'], 0, PE, 15],

  // ── Level 5 — Retail Fighter (20) ──
  ['Dealer perlu training sebelum program leasing karena?', ['Agar paham alur, benefit, dan cara menjelaskan ke customer','Agar bisa desain logo','Agar bisa edit video','Agar bisa membuat lagu'], 0, RT, 20],
  ['Jika customer bertanya "bisa cicilan?", jawaban terbaik adalah?', ['Jelaskan mitra leasing, tenor, syarat, dan alur pengajuan','Jawab "tidak tahu"','Suruh cari sendiri','Abaikan'], 0, RT, 20],
  ['Stok marketplace harus akurat agar menghindari?', ['Cancel order, keterlambatan, penalti, dan turunnya performa toko','Desain terlalu bagus','Foto terlalu terang','Caption terlalu pendek'], 0, RT, 20],
  ['Harga online terlalu rendah dapat merusak?', ['Struktur harga dan kepercayaan dealer','Warna produk','Kapasitas baterai','Ukuran ban'], 0, RT, 20],
  ['Materi promosi dealer harus memuat?', ['Benefit, fitur, harga/promo, cara beli, dan CTA','Hanya logo kecil','Teks panjang tanpa produk','Tanpa informasi kontak'], 0, RT, 20],
  ['Jika produk habis tetapi pesanan masuk, tindakan paling aman adalah?', ['Update stok dan komunikasikan status dengan jelas','Tetap proses tanpa barang','Diam saja','Salahkan customer'], 0, RT, 20],
  ['Program leasing membantu customer karena?', ['Memberikan opsi pembayaran/cicilan','Membuat produk gratis','Menghapus garansi','Mengurangi kebutuhan edukasi'], 0, RT, 20],
  ['Untuk aktivasi dealer Kredivo, data yang dibutuhkan sebaiknya?', ['Diisi lengkap melalui form yang disiapkan','Dikirim acak di grup','Tidak perlu data','Hanya nama panggilan'], 0, RT, 20],
  ['Retail yang baik tidak hanya menjual, tetapi juga?', ['Edukasi, follow up, dan menjaga trust customer','Menekan customer','Menghindari pertanyaan','Menyembunyikan informasi'], 0, RT, 20],
  ['Customer handling yang baik saat komplain adalah?', ['Dengarkan, validasi, cek data, dan beri solusi sesuai SOP','Membalas emosi','Mengabaikan','Menyalahkan customer dulu'], 0, RT, 20],
  ['Jika customer membandingkan produk murah imitasi, jawaban terbaik adalah?', ['Bandingkan fitur, keamanan, garansi, aftersales, dan value','Langsung marah','Bilang semua murah pasti jelek','Tidak menjawab'], 0, RT, 20],
  ['Promosi marketplace yang sehat harus tetap menjaga?', ['Margin, stok, harga, dan performa toko','Harga asal turun','Klaim tanpa bukti','Stok fiktif'], 0, RT, 20],
  ['Leads marketplace perlu ditindaklanjuti agar?', ['Peluang konversi meningkat','Chat menumpuk','Produk hilang','Desain berubah'], 0, RT, 20],
  ['Pengiriman terlambat di marketplace dapat berdampak pada?', ['Penalti dan performa toko turun','Warna unit berubah','Baterai membesar','Customer otomatis puas'], 0, RT, 20],
  ['Aktivasi asuransi penting dijelaskan di toko karena?', ['Customer perlu tahu syarat perlindungan berlaku','Agar toko terlihat ramai','Agar poster penuh tulisan','Agar harga naik'], 0, RT, 20],

  // ── Level 6 — EV News Hunter (25) ──
  ['Berapa rencana subsidi motor listrik Indonesia yang banyak diberitakan pada 2026?', ['Rp500 ribu','Rp1 juta','Rp5 juta','Rp20 juta'], 2, EV, 25],
  ['Target awal insentif EV Indonesia 2026 mencakup berapa motor listrik?', ['1.000 unit','10.000 unit','100.000 unit','1 juta unit langsung'], 2, EV, 25],
  ['Selain motor listrik, insentif EV Indonesia 2026 juga menargetkan?', ['Mobil listrik','Kapal pesiar','Pesawat komersial','Sepeda manual'], 0, EV, 25],
  ['Menurut data global terbaru yang pernah dibahas, penjualan mobil listrik global pada 2025 mencapai lebih dari?', ['2 juta unit','5 juta unit','10 juta unit','20 juta unit'], 3, EV, 25],
  ['Pangsa mobil listrik terhadap penjualan mobil global 2025 diperkirakan sekitar?', ['5%','10%','25%','80%'], 2, EV, 25],
  ['Proyeksi penjualan mobil listrik global 2026 yang pernah dibahas berada di kisaran?', ['3 juta unit','8 juta unit','23 juta unit','100 juta unit'], 2, EV, 25],
  ['Registrasi EV global Mei 2026 dilaporkan naik sekitar berapa secara year-on-year?', ['3%','30%','70%','100%'], 0, EV, 25],
  ['Registrasi EV global Mei 2026 mencapai sekitar?', ['180 ribu unit','500 ribu unit','1,8 juta unit','18 juta unit'], 2, EV, 25],
  ['Wilayah yang dilaporkan mengalami pertumbuhan kuat EV pada Mei 2026 adalah?', ['Eropa','Antartika','Bulan','Samudra Pasifik'], 0, EV, 25],
  ['Salah satu faktor yang membuat pasar EV sensitif adalah?', ['Insentif, harga BBM, dan daya beli','Warna poster saja','Nama admin','Ukuran file desain'], 0, EV, 25],
  ['Jika subsidi motor listrik berjalan, dampak marketing yang mungkin terjadi adalah?', ['Awareness EV meningkat dan minat pembelian bisa naik','Semua produk otomatis gratis','Dealer tidak perlu menjual','Konten tidak dibutuhkan'], 0, EV, 25],
  ['Dari sisi campaign, isu biaya BBM paling aman dikaitkan dengan?', ['Alternatif mobilitas yang lebih hemat','Serangan politik','Klaim palsu','Menakuti customer'], 0, EV, 25],
  ['Saat membuat konten berbasis berita EV, tim harus?', ['Verifikasi sumber dan tanggal berita','Langsung posting tanpa cek','Pakai rumor grup','Mengubah data seenaknya'], 0, EV, 25],
  ['Kenapa berita insentif EV perlu dicek berkala?', ['Regulasi dan pelaksanaan bisa berubah','Karena desainnya sulit','Karena baterai berubah warna','Karena dealer tidak butuh info'], 0, EV, 25],
  ['Data EV global paling tepat dipakai untuk?', ['Insight pasar, edukasi, dan angle campaign','Klaim produk tanpa bukti','Menyerang semua kompetitor','Menghapus strategi lokal'], 0, EV, 25],

  // ── Level 7 — Psychology Trap (25) ──
  ['5 mesin membuat 5 unit dalam 5 menit. Berapa lama 100 mesin membuat 100 unit?', ['5 menit','10 menit','50 menit','100 menit'], 0, PT, 25],
  ['Dokter memberi 3 obat, diminum setiap 30 menit. Berapa lama sampai obat habis?', ['30 menit','60 menit','90 menit','120 menit'], 1, PT, 25],
  ['Semua motor listrik adalah kendaraan listrik. Apakah semua kendaraan listrik pasti motor listrik?', ['Ya','Tidak','Tergantung warna','Tergantung dealer'], 1, PT, 25],
  ['Harga dicoret dari Rp10 juta jadi Rp7 juta. Apakah pasti murah?', ['Pasti','Belum tentu, perlu bandingkan value dan harga pasar','Pasti rugi','Pasti palsu'], 1, PT, 25],
  ['Banyak like berarti banyak penjualan. Benar atau salah?', ['Benar selalu','Salah, belum tentu menghasilkan konversi','Pasti omzet naik','Pasti produk habis'], 1, PT, 25],
  ['Konten viral selalu berarti campaign berhasil. Benar atau salah?', ['Benar','Salah, harus lihat objektif campaign','Pasti benar jika views tinggi','Benar jika caption panjang'], 1, PT, 25],
  ['Desain bagus pasti menjual. Benar atau salah?', ['Benar','Salah, harus jelas pesan, benefit, dan CTA','Selalu benar','Tidak perlu produk'], 1, PT, 25],
  ['Customer bilang "kompetitor lebih murah". Respon terbaik adalah?', ['Bandingkan fitur, garansi, aftersales, keamanan, dan value','Langsung emosi','Bilang customer salah','Jangan dibalas'], 0, PT, 25],
  ['Jika semua orang di tim setuju dengan ide pertama, risiko yang perlu diwaspadai adalah?', ['Groupthink','Diskon','Garansi','Charging'], 0, PT, 25],
  ['Pertanyaan jebakan biasanya menguji kemampuan apa?', ['Fokus, logika, dan tidak asal asumsi','Kecepatan mengetik saja','Hafalan warna','Jumlah followers'], 0, PT, 25],
]

// Idempotency: kalau bank GODA sudah pernah di-seed, lewati.
const marker = await sql`SELECT COUNT(*)::int AS n FROM quiz_questions WHERE category = ${GK}`
if (marker[0].n > 0) {
  console.log(`· Bank GODA sudah ada (${marker[0].n} soal GODA Knowledge), seed dilewati`)
} else {
  for (const [q, opts, ci, cat, pts] of BANK) {
    // explanation = null → engine fallback "Jawaban yang benar: <opsi>"
    await sql`
      INSERT INTO quiz_questions (question, options, correct_index, explanation, category, points)
      VALUES (${q}, ${JSON.stringify(opts)}, ${ci}, NULL, ${cat}, ${pts})
    `
  }
  console.log(`✓ ${BANK.length} soal Bank GODA v1 ditambahkan`)
}

const total = await sql`SELECT COUNT(*)::int AS n FROM quiz_questions WHERE is_active = true`
console.log(`Total soal aktif sekarang: ${total[0].n}`)
console.log('\n✅ migrate-quiz-v2 done')
