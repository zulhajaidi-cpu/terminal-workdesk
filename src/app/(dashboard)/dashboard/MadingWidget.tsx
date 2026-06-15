'use client'

import { useState, useTransition } from 'react'
import { createMadingPost, deleteMadingPost } from './mading-actions'
import { Avatar } from '@/components/ui/avatar'
import { Megaphone, Plus, X, Send, ImageIcon, Trash2 } from 'lucide-react'

export interface MadingPost {
  id: string
  title: string
  content: string
  mediaUrl: string | null
  createdAt: string
  creatorName: string
  creatorAvatar: string | null
  creatorRole: string
}

interface Props {
  posts: MadingPost[]
  canPost: boolean
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:    'Super Admin',
  head_director:  'Direktur',
  spv_manager:    'Manager',
  leader_divisi:  'SPV',
  staff:          'Staff',
}

function formatWIB(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' WIB'
}

export function MadingWidget({ posts: initialPosts, canPost }: Props) {
  const [posts, setPosts] = useState<MadingPost[]>(initialPosts)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createMadingPost(formData)
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
      }
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const res = await deleteMadingPost(id)
      if (!res.error) {
        setPosts(prev => prev.filter(p => p.id !== id))
      }
      setDeletingId(null)
    })
  }

  return (
    <div style={{ background: '#161a23', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,106,26,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={16} color="#FF6A1A" />
          </span>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: '#EDF0F5' }}>Mading Digital</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: '#6B7385', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Pengumuman</div>
          </div>
        </div>
        {canPost && (
          <button onClick={() => setOpen(true)} style={{ width: 32, height: 32, borderRadius: 10, background: '#FF6A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
            <Plus size={18} color="#fff" />
          </button>
        )}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380 }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6B7385', fontSize: 13, padding: '32px 0' }}>Belum ada pengumuman. 📋</div>
        ) : posts.map(post => (
          <PostCard key={post.id} post={post} canDelete={canPost} onDelete={handleDelete} deletingId={deletingId} />
        ))}
      </div>

      {/* Create Modal */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setOpen(false)}>
          <div style={{ background: '#1c1f2b', borderRadius: 28, border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,106,26,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={18} color="#FF6A1A" />
                </span>
                <div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: '#EDF0F5' }}>Tulis Pengumuman</div>
                  <div style={{ fontSize: 11, color: '#6B7385' }}>Akan tampil di Mading Digital</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="#6B7385" />
              </button>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#A5AEC0', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Judul</label>
                <input name="title" placeholder="Judul pengumuman..." required maxLength={120}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: '#EDF0F5', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#A5AEC0', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Isi Pesan</label>
                <textarea name="content" placeholder="Tulis pengumuman di sini..." required rows={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: '#EDF0F5', fontSize: 14, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A5AEC0', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  <ImageIcon size={12} /> Link Gambar / GIF (opsional)
                </label>
                <input name="mediaUrl" placeholder="https://..." type="url"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: '#EDF0F5', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'IBM Plex Mono',monospace" }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </div>

              {error && (
                <div style={{ background: 'rgba(255,75,75,0.12)', border: '1px solid rgba(255,75,75,0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#FF6B6B' }}>{error}</div>
              )}

              <button type="submit" disabled={pending}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: pending ? 'rgba(255,106,26,0.4)' : '#FF6A1A', border: 'none', borderRadius: 14, padding: '12px 20px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: pending ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk',sans-serif" }}>
                <Send size={15} />
                {pending ? 'Mengirim...' : 'Kirim Pengumuman'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        cursor: 'zoom-out',
      }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 20, background: 'rgba(255,255,255,0.1)',
          border: 'none', borderRadius: 8, width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#EDF0F5',
        }}>
        <X size={18} />
      </button>
      <img
        src={url} alt="media full"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '90vh',
          objectFit: 'contain', borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          cursor: 'default',
        }}
      />
    </div>
  )
}

function PostCard({ post, canDelete, onDelete, deletingId }: { post: MadingPost; canDelete: boolean; onDelete: (id: string) => void; deletingId: string | null }) {
  const isDeleting = deletingId === post.id
  const [lightbox, setLightbox] = useState<string | null>(null)
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 16px', opacity: isDeleting ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      {lightbox && <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <Avatar name={post.creatorName} imageUrl={post.creatorAvatar ?? undefined} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap' as const }}>{post.creatorName}</span>
            <span style={{ fontSize: 10, background: 'rgba(255,106,26,0.14)', color: '#FFB489', borderRadius: 6, padding: '1px 7px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }}>
              {ROLE_LABEL[post.creatorRole] ?? post.creatorRole}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace", marginTop: 1 }}>{formatWIB(post.createdAt)}</div>
        </div>
        {canDelete && (
          <button onClick={() => onDelete(post.id)} disabled={isDeleting}
            title="Hapus pengumuman"
            style={{ background: 'transparent', border: 'none', cursor: isDeleting ? 'not-allowed' : 'pointer', padding: '4px', borderRadius: 6, color: '#6B7385', flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF6B6B' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7385' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif", marginBottom: 5 }}>{post.title}</div>
      <div style={{ fontSize: 13, color: '#A5AEC0', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }}>{post.content}</div>
      {post.mediaUrl && (
        <div style={{ marginTop: 10 }}>
          <img
            src={post.mediaUrl} alt="media" loading="lazy"
            onClick={() => setLightbox(post.mediaUrl)}
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover' as const, borderRadius: 12, display: 'block', cursor: 'zoom-in' }}
          />
        </div>
      )}
    </div>
  )
}

