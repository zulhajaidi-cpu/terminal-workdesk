'use client'

import { useState, useTransition } from 'react'
import {
  createMadingPost, deleteMadingPost,
  toggleMadingReaction, getMadingComments, addMadingComment, deleteMadingComment,
  type MadingCommentRow,
} from './mading-actions'
import { Avatar } from '@/components/ui/avatar'
import { Megaphone, Plus, X, Send, ImageIcon, Trash2, MessageCircle, ThumbsUp } from 'lucide-react'
import { CharacterCardModal } from '../leaderboard/character-card-modal'

export interface MadingReaction { emoji: string; count: number }

export interface MadingPost {
  id: string
  title: string
  content: string
  mediaUrl: string | null
  createdAt: string
  creatorId: string | null
  creatorName: string
  creatorAvatar: string | null
  creatorRole: string
  reactions: MadingReaction[]
  myReaction: string | null
  commentCount: number
}

interface Props {
  posts: MadingPost[]
  canPost: boolean
  canModerate: boolean
  currentUserId: string
}

// Reaksi ala Facebook
const REACTIONS: { emoji: string; label: string; color: string }[] = [
  { emoji: '👍', label: 'Suka',  color: 'var(--blue)' },
  { emoji: '❤️', label: 'Cinta', color: '#FF4D6D' },
  { emoji: '😆', label: 'Haha',  color: 'var(--gold)' },
  { emoji: '😮', label: 'Wow',   color: 'var(--gold)' },
  { emoji: '😢', label: 'Sedih', color: 'var(--gold)' },
  { emoji: '😡', label: 'Marah', color: '#FF6A1A' },
]

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

export function MadingWidget({ posts: initialPosts, canPost, canModerate, currentUserId }: Props) {
  const [posts, setPosts] = useState<MadingPost[]>(initialPosts)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cardUserId, setCardUserId] = useState<string | null>(null)

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
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,106,26,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={16} color="#FF6A1A" />
          </span>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Mading Digital</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Pengumuman</div>
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
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 0' }}>Belum ada pengumuman. 📋</div>
        ) : posts.map(post => (
          <PostCard key={post.id} post={post} canDelete={canPost} onDelete={handleDelete} deletingId={deletingId}
            canModerate={canModerate} currentUserId={currentUserId} onOpenCard={setCardUserId} />
        ))}
      </div>

      {/* Create Modal */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setOpen(false)}>
          <div style={{ background: '#1c1f2b', borderRadius: 28, border: '1px solid var(--border-strong)', width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,106,26,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={18} color="#FF6A1A" />
                </span>
                <div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Tulis Pengumuman</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Akan tampil di Mading Digital</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'var(--border)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Judul</label>
                <input name="title" placeholder="Judul pengumuman..." required maxLength={120}
                  style={{ width: '100%', background: 'var(--surface-hover)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Isi Pesan</label>
                <textarea name="content" placeholder="Tulis pengumuman di sini..." required rows={4}
                  style={{ width: '100%', background: 'var(--surface-hover)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  <ImageIcon size={12} /> Link Gambar / GIF (opsional)
                </label>
                <input name="mediaUrl" placeholder="https://..." type="url"
                  style={{ width: '100%', background: 'var(--surface-hover)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'IBM Plex Mono',monospace" }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                />
              </div>

              {error && (
                <div style={{ background: 'rgba(255,75,75,0.12)', border: '1px solid rgba(255,75,75,0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>{error}</div>
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

      {/* Character card (klik nama/foto penulis atau komentator) */}
      {cardUserId && <CharacterCardModal userId={cardUserId} onClose={() => setCardUserId(null)} />}
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
          position: 'absolute', top: 16, right: 20, background: 'var(--border-strong)',
          border: 'none', borderRadius: 8, width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-primary)',
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

function PostCard({ post, canDelete, onDelete, deletingId, canModerate, currentUserId, onOpenCard }: {
  post: MadingPost; canDelete: boolean; onDelete: (id: string) => void; deletingId: string | null
  canModerate: boolean; currentUserId: string; onOpenCard: (userId: string) => void
}) {
  const isDeleting = deletingId === post.id
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Reaction state (managed locally setelah aksi server)
  const [reactions, setReactions] = useState<MadingReaction[]>(post.reactions)
  const [myReaction, setMyReaction] = useState<string | null>(post.myReaction)
  const [showPicker, setShowPicker] = useState(false)
  const [, startReact] = useTransition()

  // Comment state
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<MadingCommentRow[] | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const totalReactions = reactions.reduce((s, r) => s + r.count, 0)
  const topEmojis = reactions.slice(0, 3).map(r => r.emoji)
  const myReactionMeta = REACTIONS.find(r => r.emoji === myReaction)

  function react(emoji: string) {
    setShowPicker(false)
    startReact(async () => {
      const res = await toggleMadingReaction(post.id, emoji)
      if (res.success) {
        setReactions(res.reactions ?? [])
        setMyReaction(res.myReaction ?? null)
      }
    })
  }

  async function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && comments === null) {
      setLoadingComments(true)
      const res = await getMadingComments(post.id)
      setComments(res.comments ?? [])
      setLoadingComments(false)
    }
  }

  function submitComment() {
    const text = commentText.trim()
    if (!text || postingComment) return
    setPostingComment(true)
    startReact(async () => {
      const res = await addMadingComment(post.id, text)
      if (res.success && res.comment) {
        setComments(prev => [...(prev ?? []), res.comment!])
        setCommentCount(c => c + 1)
        setCommentText('')
      }
      setPostingComment(false)
    })
  }

  function removeComment(id: string) {
    startReact(async () => {
      const res = await deleteMadingComment(id)
      if (res.success) {
        setComments(prev => (prev ?? []).filter(c => c.id !== id))
        setCommentCount(c => Math.max(0, c - 1))
      }
    })
  }

  return (
    <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', opacity: isDeleting ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      {lightbox && <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span onClick={() => post.creatorId && onOpenCard(post.creatorId)} style={{ cursor: post.creatorId ? 'pointer' : 'default', display: 'flex', flexShrink: 0 }} title="Lihat kartu karakter">
          <Avatar name={post.creatorName} imageUrl={post.creatorAvatar ?? undefined} size="sm" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span onClick={() => post.creatorId && onOpenCard(post.creatorId)}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap' as const, cursor: post.creatorId ? 'pointer' : 'default' }}
              title="Lihat kartu karakter">{post.creatorName}</span>
            <span style={{ fontSize: 10, background: 'rgba(255,106,26,0.14)', color: 'var(--peach)', borderRadius: 6, padding: '1px 7px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }}>
              {ROLE_LABEL[post.creatorRole] ?? post.creatorRole}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 1 }}>{formatWIB(post.createdAt)}</div>
        </div>
        {canDelete && (
          <button onClick={() => onDelete(post.id)} disabled={isDeleting}
            title="Hapus pengumuman"
            style={{ background: 'transparent', border: 'none', cursor: isDeleting ? 'not-allowed' : 'pointer', padding: '4px', borderRadius: 6, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif", marginBottom: 5 }}>{post.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }}>{post.content}</div>
      {post.mediaUrl && (
        <div style={{ marginTop: 10 }}>
          <img
            src={post.mediaUrl} alt="media" loading="lazy"
            onClick={() => setLightbox(post.mediaUrl)}
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover' as const, borderRadius: 12, display: 'block', cursor: 'zoom-in' }}
          />
        </div>
      )}

      {/* ── Reaction summary + comment count ── */}
      {(totalReactions > 0 || commentCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
          {totalReactions > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-flex' }}>{topEmojis.map((e, i) => <span key={i} style={{ marginLeft: i ? -3 : 0, fontSize: 13 }}>{e}</span>)}</span>
              <span>{totalReactions}</span>
            </div>
          ) : <span />}
          {commentCount > 0 && (
            <button onClick={toggleComments} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>
              {commentCount} komentar
            </button>
          )}
        </div>
      )}

      {/* ── Action bar: Suka / Komentar ── */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}
          onMouseEnter={() => setShowPicker(true)} onMouseLeave={() => setShowPicker(false)}>
          {showPicker && (
            // paddingBottom (bukan marginBottom) supaya celah di antara tombol "Suka" dan
            // popup tetap bagian dari kotak div ini — pakai marginBottom sebelumnya membuat
            // celah kosong yang memicu mouseleave sebelum kursor sampai ke popup.
            <div style={{ position: 'absolute', bottom: '100%', left: 0, paddingBottom: 6, zIndex: 20 }}>
              <div style={{ background: '#1c1f2b', border: '1px solid var(--border-strong)', borderRadius: 100, padding: '5px 8px', display: 'flex', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {REACTIONS.map(r => (
                  <button key={r.emoji} onClick={() => react(r.emoji)} title={r.label}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 2, transition: 'transform 0.12s', borderRadius: 8 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.35)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}>
                    {r.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => react(myReaction ?? '👍')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 8, color: myReactionMeta ? myReactionMeta.color : '#9aa3b5', fontSize: 12.5, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
            {myReactionMeta ? <span style={{ fontSize: 15 }}>{myReactionMeta.emoji}</span> : <ThumbsUp size={14} />}
            {myReactionMeta ? myReactionMeta.label : 'Suka'}
          </button>
        </div>
        <button onClick={toggleComments}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 8, color: showComments ? '#FF6A1A' : '#9aa3b5', fontSize: 12.5, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
          <MessageCircle size={14} /> Komentar
        </button>
      </div>

      {/* ── Comment section ── */}
      {showComments && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loadingComments ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>Memuat komentar...</div>
          ) : (comments && comments.length > 0) ? (
            comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span onClick={() => c.userId && onOpenCard(c.userId)} style={{ cursor: c.userId ? 'pointer' : 'default', display: 'flex', flexShrink: 0 }} title="Lihat kartu karakter">
                  <Avatar name={c.userName ?? '?'} imageUrl={c.userAvatar ?? undefined} size="sm" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ background: 'var(--surface-hover)', borderRadius: 12, padding: '7px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span onClick={() => c.userId && onOpenCard(c.userId)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif", cursor: c.userId ? 'pointer' : 'default' }} title="Lihat kartu karakter">{c.userName ?? 'Pengguna'}</span>
                      {c.userRole && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{ROLE_LABEL[c.userRole] ?? c.userRole}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#C7CDD9', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }}>{c.content}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, paddingLeft: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace" }}>{formatWIB(c.createdAt)}</span>
                    {(c.userId === currentUserId || canModerate) && (
                      <button onClick={() => removeComment(c.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}>
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>Belum ada komentar. Jadilah yang pertama! 💬</div>
          )}

          {/* Comment input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              placeholder="Tulis komentar..." rows={1} maxLength={1000}
              style={{ flex: 1, background: 'var(--surface-hover)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'none' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const, lineHeight: 1.4 }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.5)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            />
            <button onClick={submitComment} disabled={postingComment || !commentText.trim()}
              style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 12, background: (postingComment || !commentText.trim()) ? 'rgba(255,106,26,0.35)' : '#FF6A1A', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (postingComment || !commentText.trim()) ? 'not-allowed' : 'pointer' }}>
              <Send size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

