import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'
import { canBulkData } from '@/lib/roles'
import { EXCEL_CONFIGS, ExcelEntity } from '@/lib/excel-config'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canBulkData(session.role)) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })

  const type = request.nextUrl.searchParams.get('type') as ExcelEntity
  const config = EXCEL_CONFIGS[type]
  if (!config) return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 })

  // Data sheet — header row + 1 example row (delete example before importing real data)
  const headers = config.columns.map(c => c.header + (c.required ? ' *' : ''))
  const exampleRow = config.columns.map(c => c.example)
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  ws['!cols'] = config.columns.map(c => ({ wch: Math.max(c.header.length + 4, 16) }))

  // Instructions sheet
  const guide: (string | undefined)[][] = [
    ['Kolom', 'Wajib?', 'Contoh', 'Keterangan'],
    ...config.columns.map(c => [c.header, c.required ? 'WAJIB' : 'opsional', c.example, c.note ?? '']),
    [],
    ['CATATAN:', 'Hapus baris contoh sebelum mengisi data asli. Baris pertama (header) jangan diubah/dihapus.'],
  ]
  const wsGuide = XLSX.utils.aoa_to_sheet(guide)
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 28 }, { wch: 45 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, config.sheetName)
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-${config.fileName}.xlsx"`,
    },
  })
}
