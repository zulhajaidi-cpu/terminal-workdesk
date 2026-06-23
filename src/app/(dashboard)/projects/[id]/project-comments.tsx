'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { Send, Trash2, AtSign, MessageSquare } from 'lucide-react'
import { addComment, deleteComment } from './actions'

interface Comment {
  id: string
  content: string
  createdAt: string | Date
  userId: string
  userName: string
  userAvatar: string | null
  userRole: string
  isOptimistic?: boolean
}

interface Props {
  projectId: string
  initialComments: Comment[]
  currentUser: { id: string; fullName: string; avatarUrl: string | null; role: string }
  allUsers: { id: string; fullName: string }[]
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', spv_manager: 'Manager', head_director: 'Direktur',
  leader_divisi: 'SPV', staff: 'Staff',
}
const ROLE_COLORS: Record<string, string> = {
  super_admin: '#F59E0B', spv_manager: '#EF4444', head_director: '#A855F7',
  leader_divisi: 'var(--blue)', staff: 'var(--text-muted)',
}

function fmtTime(iso: string | Date) {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' WIB'
}

function UserAvatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <img src={url} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'rgba(255,106,26,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#FF8A4C', flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

/* Render @mentions as highlighted and URLs as clickable links */
function CommentContent({ text }: { text: string }) {
  const URL_RE = /(https?:\/\/[^\s]+)/g
  const urlParts = text.split(URL_RE)
  return (
    <span>
      {urlParts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--blue)', textDecoration: 'underline', wordBreak: 'break-all' }}>
              {part}
            </a>
          )
        }
        // Handle @mentions within plain text
        return part.split(/(@\w+)/g).map((sub, j) =>
          sub.startsWith('@') ? (
            <span key={`${i}-${j}`} style={{ color: '#FF8A4C', fontWeight: 700, background: 'rgba(255,106,26,0.1)', borderRadius: '4px', padding: '0 3px' }}>
              {sub}
            </span>
          ) : (
            <span key={`${i}-${j}`}>{sub}</span>
          )
        )
      })}
    </span>
  )
}

export function ProjectComments({ projectId, initialComments, currentUser, allUsers }: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  const [optimisticComments, addOptimistic] = useOptimistic(
    initialComments,
    (state: Comment[], newComment: Comment) => [...state, newComment],
  )

  /* ── Mention autocomplete ── */
  const mentionMatches = allUsers.filter(u =>
    u.id !== currentUser.id &&
    u.fullName.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setInput(val)

    // Detect @-trigger: find the last @ not followed by space
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const mentionMatch = before.match(/@(\w*)$/)
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }

    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function insertMention(name: string) {
    const cursor = textareaRef.current?.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after = input.slice(cursor)
    const replaced = before.replace(/@(\w*)$/, `@${name.split(' ')[0]} `)
    setInput(replaced + after)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') setShowMentions(false)
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = input.trim()
    if (!trimmed || isPending) return
    setError(null)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setShowMentions(false)

    // Optimistic update
    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      content: trimmed,
      createdAt: new Date(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      userAvatar: currentUser.avatarUrl,
      userRole: currentUser.role,
      isOptimistic: true,
    }

    startTransition(async () => {
      addOptimistic(optimistic)
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)
      try {
        await addComment(projectId, trimmed)
      } catch (err: any) {
        setError(err?.message ?? 'Gagal mengirim komentar')
      }
    })
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Hapus komentar ini?')) return
    try {
      await deleteComment(commentId, projectId)
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghapus')
    }
  }

  const canDelete = (comment: Comment) =>
    comment.userId === currentUser.id ||
    ['super_admin', 'spv_manager', 'head_director'].includes(currentUser.role)

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <MessageSquare size={15} style={{ color: '#FF8A4C' }} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
          Diskusi
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: '#FF8A4C',
          background: 'rgba(255,106,26,0.12)', borderRadius: '100px',
          padding: '1px 8px',
        }}>
          {optimisticComments.length}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace" }}>
            Gunakan @nama untuk sebut anggota
          </span>
        </div>
      </div>

      {/* Comment list */}
      <div style={{
        maxHeight: '480px',
        overflowY: 'auto',
        padding: optimisticComments.length === 0 ? '0' : '8px 0',
      }}>
        {optimisticComments.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <MessageSquare size={32} style={{ color: 'var(--text-faint)', margin: '0 auto 10px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Belum ada diskusi. Jadilah yang pertama berkomentar!</p>
          </div>
        ) : (
          optimisticComments.map((c, i) => {
            const isMe = c.userId === currentUser.id
            const prev = i > 0 ? optimisticComments[i - 1] : null
            const grouped = !!prev && prev.userId === c.userId &&
              new Date(c.createdAt).getTime() - new Date(prev.createdAt).getTime() < 3 * 60 * 1000

            return (
              <div
                key={c.id}
                style={{
                  padding: grouped ? '2px 16px 2px' : '10px 16px 2px',
                  opacity: c.isOptimistic ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Mine: right-aligned bubble style */}
                {isMe ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {!grouped && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {fmtTime(c.createdAt)}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF8A4C' }}>Kamu</span>
                        <UserAvatar name={c.userName} url={c.userAvatar} size={24} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                      {canDelete(c) && !c.isOptimistic && (
                        <button onClick={() => handleDelete(c.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px', display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                          className="comment-delete-btn">
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(255,106,26,0.22), rgba(255,138,76,0.16))',
                        border: '1px solid rgba(255,106,26,0.25)',
                        borderRadius: '16px 4px 16px 16px',
                        padding: '8px 14px',
                        maxWidth: '75%',
                      }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: 0 }}>
                          <CommentContent text={c.content} />
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Others: left-aligned with avatar */
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {!grouped
                      ? <UserAvatar name={c.userName} url={c.userAvatar} size={32} />
                      : <div style={{ width: 32, flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!grouped && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: ROLE_COLORS[c.userRole] ?? 'var(--text-secondary)' }}>
                            {c.userName}
                          </span>
                          <span style={{
                            fontSize: '9px', fontWeight: 600,
                            color: ROLE_COLORS[c.userRole] ?? 'var(--text-muted)',
                            background: `${ROLE_COLORS[c.userRole] ?? 'var(--text-muted)'}22`,
                            borderRadius: '100px', padding: '1px 6px',
                          }}>
                            {ROLE_LABELS[c.userRole] ?? c.userRole}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace" }}>
                            {fmtTime(c.createdAt)}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                        <div style={{
                          background: 'var(--surface-hover)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px 16px 16px 16px',
                          padding: '8px 14px',
                          maxWidth: '75%',
                        }}>
                          <p style={{ fontSize: '13px', color: '#D4D9E4', lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: 0 }}>
                            <CommentContent text={c.content} />
                          </p>
                        </div>
                        {canDelete(c) && !c.isOptimistic && (
                          <button onClick={() => handleDelete(c.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px', display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                            className="comment-delete-btn">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 16px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '9px', fontSize: '12px', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        position: 'relative',
      }}>
        {/* Mention dropdown */}
        {showMentions && mentionMatches.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '16px', right: '16px',
            background: 'var(--bg-hover)', border: '1px solid var(--border-strong)',
            borderRadius: '12px', overflow: 'hidden', zIndex: 20, marginBottom: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Sebut anggota
              </span>
            </div>
            {mentionMatches.slice(0, 6).map(m => (
              <button key={m.id} onClick={() => insertMention(m.fullName)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,106,26,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <AtSign size={13} style={{ color: '#FF8A4C', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{m.fullName}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '10px',
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '10px 12px',
        }}>
          <UserAvatar name={currentUser.fullName} url={currentUser.avatarUrl} size={28} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Tulis komentar… ketik @ untuk sebut anggota`}
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '13px', resize: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              lineHeight: 1.6, maxHeight: '120px', minHeight: '20px',
            }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isPending}
            style={{
              background: input.trim() && !isPending ? '#FF6A1A' : 'var(--border)',
              border: 'none', borderRadius: '10px', padding: '8px 14px',
              cursor: input.trim() && !isPending ? 'pointer' : 'default',
              color: input.trim() && !isPending ? '#fff' : 'var(--text-faint)',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 700, flexShrink: 0,
              transition: 'background 0.15s',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <Send size={14} />
            {isPending ? 'Mengirim…' : 'Kirim'}
          </button>
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px', paddingLeft: '4px' }}>
          Enter kirim · Shift+Enter baris baru
        </p>
      </div>

      {/* Hover show delete button — global style trick */}
      <style>{`
        .comment-delete-btn { opacity: 0 !important; }
        div:hover > div > .comment-delete-btn,
        div:hover > .comment-delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
