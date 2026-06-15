import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Creating chat tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS chat_channels (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      description TEXT,
      type        TEXT NOT NULL DEFAULT 'general', -- general | division | direct
      division_id UUID REFERENCES divisions(id),
      created_by  UUID REFERENCES users(id),
      is_archived BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `
  console.log('  + chat_channels')

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id      UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES users(id),
      content         TEXT NOT NULL,
      reply_to_id     UUID REFERENCES chat_messages(id),
      attachment_url  TEXT,
      attachment_name TEXT,
      is_edited       BOOLEAN NOT NULL DEFAULT false,
      edited_at       TIMESTAMP WITH TIME ZONE,
      deleted_at      TIMESTAMP WITH TIME ZONE,
      created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `
  console.log('  + chat_messages')

  await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id),
      emoji      TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      UNIQUE(message_id, user_id, emoji)
    )
  `
  console.log('  + chat_reactions')

  await sql`
    CREATE TABLE IF NOT EXISTS chat_read_status (
      user_id      UUID NOT NULL REFERENCES users(id),
      channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, channel_id)
    )
  `
  console.log('  + chat_read_status')

  await sql`
    CREATE TABLE IF NOT EXISTS chat_members (
      channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id),
      joined_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      PRIMARY KEY (channel_id, user_id)
    )
  `
  console.log('  + chat_members')

  // Seed default channels: #umum, #pengumuman, #random
  await sql`
    INSERT INTO chat_channels (name, description, type)
    VALUES
      ('umum',        'Channel umum untuk semua anggota', 'general'),
      ('pengumuman',  'Pengumuman resmi dari manajemen',  'general'),
      ('random',      'Obrolan santai & off-topic',       'general')
    ON CONFLICT DO NOTHING
  `
  console.log('  + seeded default channels')

  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
