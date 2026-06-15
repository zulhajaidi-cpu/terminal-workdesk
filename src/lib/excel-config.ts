/**
 * Shared column definitions for Excel import/export/template
 * Used by /api/excel/{template,export,import}
 */

export type ExcelEntity = 'projects' | 'tasks' | 'kpi'

export interface ColSpec {
  key: string          // internal field key
  header: string       // Excel column header (Indonesian)
  example: string      // example value shown in template
  required?: boolean
  note?: string        // hint, shown in instruction row
}

export interface EntityConfig {
  label: string
  sheetName: string
  fileName: string
  columns: ColSpec[]
}

export const EXCEL_CONFIGS: Record<ExcelEntity, EntityConfig> = {
  projects: {
    label: 'Projects',
    sheetName: 'Projects',
    fileName: 'projects',
    columns: [
      { key: 'projectCode',    header: 'Kode Project',              example: 'CM-100',                       required: true,  note: 'unik, wajib diisi' },
      { key: 'name',           header: 'Nama Project',              example: 'Kampanye Promo Sky',           required: true },
      { key: 'division',       header: 'Divisi',                    example: 'Creative Marketing',           required: true,  note: 'sesuai nama divisi di sistem' },
      { key: 'projectType',    header: 'Tipe Project',              example: 'Campaign',                     note: 'General / Campaign / Event / Internal / dll' },
      { key: 'pic',            header: 'PIC (Penanggung Jawab)',    example: 'Raihan',                       required: true,  note: '1 orang, nama lengkap sesuai sistem' },
      { key: 'priority',       header: 'Prioritas',                 example: 'High',                         note: 'Low / Medium / High / Urgent' },
      { key: 'objective',      header: 'Objective / Tujuan',        example: 'Meningkatkan awareness brand', required: true },
      { key: 'deliverables',   header: 'Deliverables / Output',     example: '10 konten feed + 4 reels',     required: true },
      { key: 'startDate',      header: 'Tanggal Mulai',             example: '2026-06-01',                   required: true,  note: 'YYYY-MM-DD' },
      { key: 'deadline',       header: 'Deadline',                  example: '2026-06-30',                   required: true,  note: 'YYYY-MM-DD' },
      { key: 'budgetPlanned',  header: 'Budget Rencana (Rp)',       example: '5000000',                      note: 'angka tanpa titik/koma' },
      { key: 'support',        header: 'Tim Support',               example: 'Nanda, Siswanto',              note: 'anggota pendukung — pisahkan dengan koma (,), maks 5 orang' },
      { key: 'status',         header: 'Status',                    example: 'Draft',                        note: 'Draft / Not Started / In Progress / Need Review / Revision / Completed / On Hold' },
      { key: 'progress',       header: 'Progress (%)',              example: '0',                            note: 'diisi otomatis dari task; isi manual jika tidak ada task' },
      { key: 'attachmentUrl',  header: 'Link Attachment / Brief',   example: 'https://drive.google.com/…',  note: 'Google Drive, URL dokumen, atau brief' },
      { key: 'notes',          header: 'Catatan Tambahan',          example: '',                             note: 'informasi lain untuk tim' },
    ],
  },
  tasks: {
    label: 'Tasks',
    sheetName: 'Tasks',
    fileName: 'tasks',
    columns: [
      { key: 'name',        header: 'Nama Task',           example: 'Desain poster promo',          required: true },
      { key: 'division',    header: 'Divisi',              example: 'Creative Marketing',           required: true,  note: 'sesuai nama divisi di sistem' },
      { key: 'projectCode', header: 'Kode Project',        example: 'CM-100',                       note: 'opsional — kosongkan jika bukan task project' },
      { key: 'status',      header: 'Status',              example: 'To Do',                        note: 'To Do / In Progress / Need Review / Completed / On Hold / Cancelled' },
      { key: 'priority',    header: 'Prioritas',           example: 'Medium',                       note: 'Low / Medium / High / Urgent' },
      { key: 'dueDate',     header: 'Due Date',            example: '2026-06-20',                   required: true,  note: 'YYYY-MM-DD' },
      { key: 'description', header: 'Deskripsi / Target',  example: 'Detail pekerjaan yang harus dilakukan' },
      { key: 'outputUrl',   header: 'Link Output',         example: 'https://drive.google.com/…',  note: 'link hasil kerja / deliverable' },
      { key: 'assignee',    header: 'Assignee',            example: 'Raihan',                       note: 'nama lengkap user sesuai sistem' },
    ],
  },
  kpi: {
    label: 'KPI',
    sheetName: 'KPI',
    fileName: 'kpi',
    columns: [
      { key: 'user',            header: 'Nama User',       example: 'Raihan',                  required: true,  note: 'nama lengkap user' },
      { key: 'periodMonth',     header: 'Bulan',           example: '6',                       required: true,  note: '1-12' },
      { key: 'periodYear',      header: 'Tahun',           example: '2026',                    required: true },
      { key: 'kpiName',         header: 'Nama KPI',        example: 'Jumlah konten dipublish', required: true },
      { key: 'weight',          header: 'Bobot (%)',       example: '20',                      required: true },
      { key: 'target',          header: 'Target',          example: '30' },
      { key: 'realization',     header: 'Realisasi',       example: '28' },
      { key: 'maxScore',        header: 'Skor Maksimal',   example: '100',                     required: true },
      { key: 'autoScore',       header: 'Skor Otomatis',   example: '' },
      { key: 'finalScore',      header: 'Skor Final',      example: '93' },
      { key: 'status',          header: 'Status',          example: 'Draft',                   note: 'Draft / Reviewed / Final' },
      { key: 'evaluationNote',  header: 'Catatan Evaluasi', example: '' },
      { key: 'improvementPlan', header: 'Rencana Perbaikan', example: '' },
    ],
  },
}

export const VALID = {
  projectStatus: ['Draft', 'Waiting Approval', 'Not Started', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold', 'Cancelled'],
  taskStatus:    ['To Do', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold', 'Cancelled'],
  priority:      ['Low', 'Medium', 'High', 'Urgent'],
  kpiStatus:     ['Draft', 'Reviewed', 'Final'],
}
