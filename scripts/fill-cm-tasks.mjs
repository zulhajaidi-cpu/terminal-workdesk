// Fill empty columns for Creative Marketing team tasks from Excel data
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const USER = {
  roro:     'ac3be84c-22ed-4b4a-b272-806126ab67e8',
  septian:  '85484139-3c9a-4338-ba70-31ab78d364cd',
  nanda:    '6be9742d-d395-4b85-80e0-0f883a44f748',
  siswanto: '99b7775c-5616-48d4-b25e-8996f4542652',
  raihan:   '2e7a9e85-dae7-4d7d-855d-31696da207b0', // "Rayhan" in Excel
  awan:     'c86a276c-a1c7-4b8b-a4b8-3f68c1bd75d6',
  zulhaj:   'dffc8167-520c-439a-823f-7c613d16c943',
}

const statusMap = {
  'Selesai':       'Completed',
  'Sedang proses': 'In Progress',
  'Belum Mulai':   'To Do',
}

// Each entry: { id, status, description, outputUrl, assignees }
const UPDATES = [
  {
    id: 'f7c70a04-14aa-4083-9e6f-51cb2dffb4fb',
    status: 'Completed',
    description: 'Content plan final, 25 ide konten tersusun, 8 original content ditandai jelas',
    outputUrl: 'https://docs.google.com/spreadsheets/d/107_imIHnWxxRVxsLAZYg_vnbMAhEiWbGQTlZm5kJhao/edit?usp=drivesdk',
    assignees: [USER.roro, USER.septian],
  },
  {
    id: '734963a6-7c84-4e9a-a50d-b4a45289dc23',
    status: 'In Progress',
    description: 'Minimal 10 konten selesai, termasuk beberapa original content',
    outputUrl: null,
    assignees: [USER.roro, USER.septian],
  },
  {
    id: '62599d76-d84b-40b7-afd1-7be1bb0ed5f1',
    status: 'To Do',
    description: 'Minimal 20 konten selesai dan konten unggulan siap push',
    outputUrl: null,
    assignees: [USER.roro, USER.septian],
  },
  {
    id: 'e7088bef-e99b-4bec-95bb-af49ba86d7b8',
    status: 'To Do',
    description: '25 konten selesai, 8 original content selesai, performa konten direkap',
    outputUrl: null,
    assignees: [USER.roro, USER.septian],
  },
  {
    id: '595e16e1-4981-42ae-b1b9-c7fbc1d4b990',
    status: 'Completed',
    description: 'Footage utama Godasantara 2 berhasil diproduksi lengkap sesuai kebutuhan konsep',
    outputUrl: null,
    assignees: [USER.roro, USER.septian],
  },
  {
    id: '7da09380-f0ce-4b23-83e1-82c5c5321d08',
    status: 'To Do',
    description: 'Draft editing selesai dan siap masuk final review',
    outputUrl: null,
    assignees: [USER.roro, USER.septian],
  },
  {
    id: 'a331e75f-28eb-48ca-b786-442d33036cf1',
    status: 'To Do',
    description: 'Output akhir Godasantara 2 selesai dan siap publikasi/distribusi',
    outputUrl: null,
    assignees: [USER.roro, USER.septian],
  },
  {
    id: '7e1b576a-acf7-409b-adb8-1980856f0e87',
    status: 'Completed',
    description: 'Target dan kebutuhan stok per produk tersusun jelas',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: '7b46cccc-14a9-4216-a9a3-2ac990a9364f',
    status: 'In Progress',
    description: 'Strategi marketplace aktif berjalan',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: '221c82dd-45b4-4c78-ae75-7ddbc56fe2f0',
    status: 'To Do',
    description: 'Rekap omzet, unit sold, dan merch sold tersedia',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: 'af5601d0-a0eb-46c3-a473-6805653e4488',
    status: 'To Do',
    description: 'Target Rp400 juta, 70 unit, 150 merch termonitor dan direkap',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: '7cc3c06f-f6f3-4ada-a878-b7974cd46db3',
    status: 'Completed',
    description: 'Data seller dan harga rendah teridentifikasi serta terdokumentasi',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: '477299e5-4567-4c76-8171-a98fa80a58f0',
    status: 'To Do',
    description: 'Laporan kontrol harga, bukti pembelian, dan tindak lanjut selesai',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: '47ec4218-c335-4084-9fa6-40d6f19fdc20',
    status: 'Completed',
    description: 'Produk prioritas, target mingguan, dan strategi push TikTok Shop tersusun',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: 'c0747533-68ab-46e0-8fe1-f583eb431816',
    status: 'To Do',
    description: 'Penjualan TikTok Shop termonitor dan realisasi 30 unit sold direkap',
    outputUrl: null,
    assignees: [USER.nanda, USER.siswanto],
  },
  {
    id: '28fdac15-a49a-4a35-bc90-6c5fcb02f81b',
    status: 'Completed',
    description: 'Konsep dan script video edukasi asuransi selesai',
    outputUrl: null,
    assignees: [USER.septian],
  },
  {
    id: '5a42589d-c174-4fd0-b165-c307eb7be7ce',
    status: 'To Do',
    description: 'Draft video edukasi asuransi tersedia',
    outputUrl: null,
    assignees: [USER.septian],
  },
  {
    id: '05288490-267a-4377-8916-3a48a5b3b958',
    status: 'To Do',
    description: 'Video edukasi asuransi final siap distribusi',
    outputUrl: null,
    assignees: [USER.septian],
  },
  {
    id: '8e89f9e1-677c-43cb-9387-2c531b8e4ede',
    status: 'To Do',
    description: 'File final tersimpan dan siap digunakan tim',
    outputUrl: null,
    assignees: [USER.septian],
  },
  {
    id: 'ed092153-4f1c-421e-8078-760836d2598e',
    status: 'Completed',
    description: 'Daftar 15 materi promosi tersusun',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '2425df0b-be28-466a-b1d2-4a80640fe042',
    status: 'Completed',
    description: 'Minimal 5 materi selesai',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '3d94734d-9750-411d-bbe3-dbad30fe2978',
    status: 'In Progress',
    description: 'Minimal 10–12 materi selesai',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '14bbd3aa-5b10-423b-b0de-b53774f16972',
    status: 'To Do',
    description: '15 materi promosi selesai dan siap digunakan',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '8d2bbf14-48ff-4f55-bbb6-6259bc11521c',
    status: 'Completed',
    description: 'Konsep pesan edukasi asuransi final',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '1c62d1f4-f212-4de5-a7ec-219298deb9eb',
    status: 'To Do',
    description: 'Draft materi edukasi asuransi selesai',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '96bfd72a-748c-4aa8-b007-91cfd5ab7b38',
    status: 'To Do',
    description: 'Materi final siap distribusi',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: 'f0b33275-2861-4815-8aa2-6695afbb0560',
    status: 'To Do',
    description: 'File final tersedia dalam format siap pakai',
    outputUrl: null,
    assignees: [USER.raihan, USER.awan],
  },
  {
    id: '5662d601-8522-4e01-9ccb-be9b62fcd01e',
    status: 'Completed',
    description: 'Desain merchandise final siap diajukan',
    outputUrl: null,
    assignees: [USER.awan, USER.raihan],
  },
  {
    id: 'f133c2cc-7214-4d0f-99e0-491fc0e92b8e',
    status: 'To Do',
    description: 'Data vendor dan estimasi biaya tersedia',
    outputUrl: null,
    assignees: [USER.awan, USER.raihan],
  },
  {
    id: '7b2bd7df-8252-4905-a49c-41ba0234d0c0',
    status: 'To Do',
    description: 'Vendor/opsi produksi terpilih',
    outputUrl: null,
    assignees: [USER.awan, USER.raihan],
  },
  {
    id: '721ab90c-0404-47ac-8522-4f53981c6807',
    status: 'To Do',
    description: 'Rencana produksi merchandise terdokumentasi',
    outputUrl: null,
    assignees: [USER.awan, USER.raihan],
  },
  {
    id: '56991baa-53ff-42cc-bae7-17abc3a9556a',
    status: 'Completed',
    description: 'Progres partner utama bergerak dan terdokumentasi',
    outputUrl: null,
    assignees: [USER.zulhaj, USER.roro, USER.nanda],
  },
  {
    id: '5f7895c3-0950-415f-9fe5-562f0d77e959',
    status: 'To Do',
    description: 'Checklist kebutuhan partner tersedia',
    outputUrl: null,
    assignees: [USER.zulhaj, USER.roro, USER.nanda],
  },
  {
    id: '25358002-216d-4eb8-b3d9-b5e1d1091309',
    status: 'To Do',
    description: 'Status Kredivo dan Akulaku terupdate',
    outputUrl: null,
    assignees: [USER.zulhaj, USER.roro, USER.nanda],
  },
  {
    id: 'b4deb1cd-258e-4126-a71a-26071933d9ca',
    status: 'To Do',
    description: 'Status leasing/paylater bulan Juni terdokumentasi jelas',
    outputUrl: null,
    assignees: [USER.zulhaj, USER.roro, USER.nanda],
  },
  {
    id: 'd5ebbde5-47e8-4f59-be87-f0d82f2144cb',
    status: 'Completed',
    description: 'Scope fitur dan kebutuhan sistem final',
    outputUrl: null,
    assignees: [USER.zulhaj],
  },
  {
    id: '56a4871d-3dcb-4639-8886-3c051b2e92c6',
    status: 'To Do',
    description: 'Struktur sistem dan draft UI/flow tersedia',
    outputUrl: null,
    assignees: [USER.zulhaj],
  },
  {
    id: '3a21f868-3d2a-4ecc-acde-d6ea2fb476eb',
    status: 'To Do',
    description: 'Prototype/app awal dapat diuji',
    outputUrl: null,
    assignees: [USER.zulhaj],
  },
  {
    id: 'c8fe997c-56e2-4b94-a7d2-b593653e83cb',
    status: 'To Do',
    description: 'App siap trial internal dengan catatan pengembangan',
    outputUrl: null,
    assignees: [USER.zulhaj],
  },
]

let updated = 0
for (const u of UPDATES) {
  const completedAt = u.status === 'Completed' ? new Date() : null
  await sql`
    UPDATE tasks SET
      status       = ${u.status},
      description  = ${u.description},
      output_url   = ${u.outputUrl},
      completed_at = ${completedAt},
      updated_at   = now()
    WHERE id = ${u.id}
  `
  // replace-all assignees
  await sql`DELETE FROM task_assignees WHERE task_id = ${u.id}`
  for (const uid of u.assignees) {
    await sql`INSERT INTO task_assignees (task_id, user_id) VALUES (${u.id}, ${uid}) ON CONFLICT DO NOTHING`
  }
  updated++
  process.stdout.write(`\r${updated}/${UPDATES.length} updated...`)
}

// Recalc progress for all projects these tasks belong to
const projectIds = await sql`
  SELECT DISTINCT project_id FROM tasks
  WHERE id = ANY(${UPDATES.map(u => u.id)}) AND project_id IS NOT NULL
`
for (const { project_id } of projectIds) {
  await sql`
    UPDATE projects SET
      progress = (
        SELECT ROUND(
          COUNT(*) FILTER (WHERE status = 'Completed') * 100.0 /
          GREATEST(COUNT(*), 1)
        )
        FROM tasks WHERE project_id = ${project_id} AND deleted_at IS NULL
      ),
      updated_at = now()
    WHERE id = ${project_id}
  `
}

console.log(`\nDone! ${updated} tasks updated, ${projectIds.length} project progress recalculated.`)
