export const ROLE_LABELS: Record<string, string> = {
  spectator:     'Spectator',
  staff:         'Staff',
  leader_divisi: 'SPV',
  spv_manager:   'Manager',
  head_director: 'Direktur',
  super_admin:   'Super Admin',
}

export const ROLE_COLORS: Record<string, string> = {
  spectator:     '#8B93A6',
  staff:         '#6B7385',
  leader_divisi: '#A78BFA',
  spv_manager:   '#4A9EFF',
  head_director: '#F59E0B',
  super_admin:   '#FF6A1A',
}

// Urutan hierarki untuk dropdown (terendah ke tertinggi)
export const ROLE_OPTIONS = [
  { value: 'spectator',     label: 'Spectator' },
  { value: 'staff',         label: 'Staff' },
  { value: 'leader_divisi', label: 'SPV' },
  { value: 'spv_manager',   label: 'Manager' },
  { value: 'head_director', label: 'Direktur' },
  { value: 'super_admin',   label: 'Super Admin' },
]

// Akun read-only — bisa lihat semua data tapi semua mutasi diblokir oleh middleware (src/middleware.ts)
export const isSpectator = (role: string) => role === 'spectator'

// Siapa yang bisa melihat SEMUA divisi (+ dapat dropdown filter divisi). Hanya Staff yang dibatasi
// ke divisinya sendiri; SPV/Manager/Direktur/Spectator/Super Admin lihat semua.
export const canSeeAllDivisions = (role: string) => role !== 'staff'

export const canManageUsers = (role: string) =>
  role === 'super_admin'

export const canCreateProject = (role: string) =>
  ['super_admin', 'spv_manager', 'leader_divisi'].includes(role)

export const canEditProject = (role: string) =>
  ['super_admin', 'spv_manager', 'head_director', 'leader_divisi'].includes(role)

export const canApprove = (role: string) =>
  ['super_admin', 'spv_manager', 'head_director'].includes(role)

// KPI: hanya SPV ke atas yang bisa input KPI (untuk anggotanya)
export const canManageKpi = (role: string) =>
  ['super_admin', 'spv_manager', 'head_director', 'leader_divisi'].includes(role)

// Siapa yang bisa melihat KPI orang lain (spectator ikut, krn ini hanya hak LIHAT)
export const canViewOthersKpi = (role: string) =>
  ['super_admin', 'spv_manager', 'head_director', 'leader_divisi', 'spectator'].includes(role)

// Import/export Excel — SPV, Manager, Direktur (dan Super Admin)
export const canBulkData = (role: string) =>
  ['super_admin', 'spv_manager', 'head_director', 'leader_divisi'].includes(role)

// Budget hanya terlihat oleh SPV, Manager, Direktur, Super Admin (tidak Staff, tidak Spectator)
export const canViewBudget = (role: string) =>
  ['super_admin', 'spv_manager', 'head_director', 'leader_divisi'].includes(role)

// Kelola katalog reward & proses serah-terima klaim: hanya Direktur & Super Admin
export const canManageRewards = (role: string) =>
  ['super_admin', 'head_director'].includes(role)

// Kelola bank soal kuis (tambah/nonaktifkan): hanya Super Admin
export const canManageQuiz = (role: string) =>
  role === 'super_admin'
