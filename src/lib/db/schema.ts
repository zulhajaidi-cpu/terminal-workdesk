import {
  pgTable, pgEnum, uuid, text, boolean, smallint,
  integer, bigint, numeric, timestamp, date, jsonb, unique, index
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Enums ──────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['super_admin','spv_manager','leader_divisi','staff','head_director','spectator'])
export const projectStatusEnum = pgEnum('project_status', ['Draft','Waiting Approval','Not Started','In Progress','Need Review','Revision','Completed','On Hold','Cancelled'])
export const taskStatusEnum = pgEnum('task_status', ['To Do','In Progress','Need Review','Revision','Completed','On Hold','Cancelled'])
export const priorityEnum = pgEnum('priority_level', ['Low','Medium','High','Urgent'])
export const approvalStatusEnum = pgEnum('approval_request_status', ['Pending','Approved','Rejected','Revision'])
export const approvalTypeEnum = pgEnum('approval_type', ['project','budget','asset','kpi'])
export const approverRoleEnum = pgEnum('approver_role', ['spv','manager','director'])
export const approvalActionEnum = pgEnum('approval_action', ['pending','approve','reject','revision'])
export const kpiStatusEnum = pgEnum('kpi_status', ['Draft','Reviewed','Final'])
export const eventTypeEnum = pgEnum('event_type', ['Meeting','Shooting','Visit','Deadline','Other','Event Internal','Event External','Photoshoot','Training','Lainnya'])
export const pointSourceEnum = pgEnum('point_source', ['task','project','kpi','kudos','bonus','manual','progress','quiz','streak'])
export const assetStatusEnum = pgEnum('asset_status', ['Draft','Need Review','Approved','Rejected','Archived'])
export const budgetPaymentEnum = pgEnum('budget_payment_status', ['Draft','Waiting Approval','Approved','Used','Partially Paid','Paid','Rejected'])
export const notificationTypeEnum = pgEnum('notification_type', ['task_assigned','deadline','overdue','approval_request','approval_result','mention','kpi_reminder','asset_new','project_done','revision_requested','budget_exceeded','event_assigned','gamification'])

// ── Tables ─────────────────────────────────────────────────────────────

export const divisions = pgTable('divisions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  description: text('description'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
})

export const users = pgTable('users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  email:      text('email').notNull().unique(),
  username:   text('username').unique(),
  fullName:   text('full_name').notNull(),
  avatarUrl:  text('avatar_url'),
  bio:        text('bio'),
  role:       userRoleEnum('role').notNull().default('staff'),
  divisionId: uuid('division_id').references(() => divisions.id),
  isActive:   boolean('is_active').notNull().default(true),
  pendingApproval: boolean('pending_approval').notNull().default(false),
  passwordHash: text('password_hash').notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:  timestamp('deleted_at', { withTimezone: true }),
})

export const projects = pgTable('projects', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  projectCode:         text('project_code').notNull().unique(),
  name:                text('name').notNull(),
  divisionId:          uuid('division_id').notNull().references(() => divisions.id),
  projectType:         text('project_type').notNull().default('General'),
  picId:               uuid('pic_id').notNull().references(() => users.id),
  objective:           text('objective').notNull(),
  deliverables:        text('deliverables').notNull(),
  startDate:           date('start_date').notNull(),
  deadline:            date('deadline').notNull(),
  status:              projectStatusEnum('status').notNull().default('Draft'),
  priority:            priorityEnum('priority').notNull().default('Medium'),
  progress:            integer('progress').notNull().default(0),
  budgetPlanned:       bigint('budget_planned', { mode: 'number' }),
  budgetApproved:      bigint('budget_approved', { mode: 'number' }),
  budgetActual:        bigint('budget_actual', { mode: 'number' }).notNull().default(0),
  approvalStatus:      approvalStatusEnum('approval_status'),
  currentApprovalStep: smallint('current_approval_step'),
  attachmentUrl:       text('attachment_url'),
  notes:               text('notes'),
  isOverdue:           boolean('is_overdue').notNull().default(false),
  createdBy:           uuid('created_by').notNull().references(() => users.id),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:           timestamp('deleted_at', { withTimezone: true }),
})

export const projectMembers = pgTable('project_members', {
  id:        uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  addedAt:   timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.projectId, t.userId)])

export const tasks = pgTable('tasks', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),
  projectId:        uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  divisionId:       uuid('division_id').notNull().references(() => divisions.id),
  createdBy:        uuid('created_by').notNull().references(() => users.id),
  dueDate:          timestamp('due_date', { withTimezone: true }).notNull(),
  priority:         priorityEnum('priority').notNull().default('Medium'),
  status:           taskStatusEnum('status').notNull().default('To Do'),
  description:      text('description'),
  checklist:        jsonb('checklist'),
  attachmentUrl:    text('attachment_url'),
  outputUrl:        text('output_url'),
  reviewResult:     text('review_result'),
  recurringRule:    text('recurring_rule'),
  reminderAt:       timestamp('reminder_at', { withTimezone: true }),
  completedAt:      timestamp('completed_at', { withTimezone: true }),
  isOverdue:        boolean('is_overdue').notNull().default(false),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  category:         text('category').default('Daily'),
  progressPct:      smallint('progress_pct').default(0),
  picId:            uuid('pic_id').references(() => users.id, { onDelete: 'set null' }),
  checked:          boolean('checked').notNull().default(false),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
})

export const taskAssignees = pgTable('task_assignees', {
  id:         uuid('id').primaryKey().defaultRandom(),
  taskId:     uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId:     uuid('user_id').notNull().references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.taskId, t.userId)])

export const taskProgressLogs = pgTable('task_progress_logs', {
  id:        uuid('id').primaryKey().defaultRandom(),
  taskId:    uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  note:      text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const kpiItems = pgTable('kpi_items', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull().references(() => users.id),
  periodMonth:     smallint('period_month').notNull(),
  periodYear:      smallint('period_year').notNull(),
  kpiName:         text('kpi_name').notNull(),
  weight:          numeric('weight', { precision: 5, scale: 2 }).notNull(),
  target:          numeric('target', { precision: 12, scale: 2 }),
  realization:     numeric('realization', { precision: 12, scale: 2 }),
  maxScore:        numeric('max_score', { precision: 5, scale: 2 }).notNull(),
  autoScore:       numeric('auto_score', { precision: 5, scale: 2 }),
  finalScore:      numeric('final_score', { precision: 5, scale: 2 }),
  evaluationNote:  text('evaluation_note'),
  improvementPlan: text('improvement_plan'),
  status:          kpiStatusEnum('status').notNull().default('Draft'),
  createdBy:       uuid('created_by').notNull().references(() => users.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
})

export const calendarEvents = pgTable('calendar_events', {
  id:               uuid('id').primaryKey().defaultRandom(),
  title:            text('title').notNull(),
  eventName:        text('event_name'),
  eventType:        eventTypeEnum('event_type').notNull().default('Other'),
  divisionId:       uuid('division_id').references(() => divisions.id),
  relatedProjectId: uuid('related_project_id').references(() => projects.id),
  startAt:          timestamp('start_at', { withTimezone: true }).notNull(),
  endAt:            timestamp('end_at', { withTimezone: true }).notNull(),
  allDay:           boolean('all_day').notNull().default(false),
  location:         text('location'),
  link:             text('link'),
  reminderRule:     text('reminder_rule'),
  createdBy:        uuid('created_by').notNull().references(() => users.id),
  notes:            text('notes'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
})

export const eventParticipants = pgTable('event_participants', {
  id:          uuid('id').primaryKey().defaultRandom(),
  eventId:     uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').notNull().references(() => users.id),
  roleInEvent: text('role_in_event'),
  notifiedAt:  timestamp('notified_at', { withTimezone: true }),
}, t => [unique().on(t.eventId, t.userId)])

export const approvalRequests = pgTable('approval_requests', {
  id:                uuid('id').primaryKey().defaultRandom(),
  type:              approvalTypeEnum('type').notNull().default('project'),
  relatedEntityType: text('related_entity_type').notNull(),
  relatedEntityId:   uuid('related_entity_id').notNull(),
  requestedBy:       uuid('requested_by').notNull().references(() => users.id),
  currentStep:       smallint('current_step').notNull().default(1),
  status:            approvalStatusEnum('status').notNull().default('Pending'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const approvalSteps = pgTable('approval_steps', {
  id:                uuid('id').primaryKey().defaultRandom(),
  approvalRequestId: uuid('approval_request_id').notNull().references(() => approvalRequests.id, { onDelete: 'cascade' }),
  stepOrder:         smallint('step_order').notNull(),
  approverRole:      approverRoleEnum('approver_role').notNull(),
  approverUserId:    uuid('approver_user_id').references(() => users.id),
  action:            approvalActionEnum('action').notNull().default('pending'),
  note:              text('note'),
  actedAt:           timestamp('acted_at', { withTimezone: true }),
})

export const assets = pgTable('assets', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),
  category:         text('category').notNull(),
  divisionId:       uuid('division_id').notNull().references(() => divisions.id),
  driveLink:        text('drive_link').notNull(),
  version:          text('version'),
  status:           assetStatusEnum('status').notNull().default('Draft'),
  uploadedBy:       uuid('uploaded_by').notNull().references(() => users.id),
  relatedProjectId: uuid('related_project_id').references(() => projects.id),
  description:      text('description'),
  tags:             text('tags').array(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
})

export const budgets = pgTable('budgets', {
  id:            uuid('id').primaryKey().defaultRandom(),
  projectId:     uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  category:      text('category').notNull(),
  planned:       bigint('planned', { mode: 'number' }).notNull().default(0),
  approved:      bigint('approved', { mode: 'number' }),
  actual:        bigint('actual', { mode: 'number' }).notNull().default(0),
  vendor:        text('vendor'),
  invoiceLink:   text('invoice_link'),
  reimburseLink: text('reimburse_link'),
  paymentStatus: budgetPaymentEnum('payment_status').notNull().default('Draft'),
  notes:         text('notes'),
  createdBy:     uuid('created_by').notNull().references(() => users.id),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:     timestamp('deleted_at', { withTimezone: true }),
})

export const projectComments = pgTable('project_comments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  projectId:     uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId:        uuid('user_id').notNull().references(() => users.id),
  content:       text('content').notNull(),
  attachmentUrl: text('attachment_url'),
  isEdited:      boolean('is_edited').notNull().default(false),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:     timestamp('deleted_at', { withTimezone: true }),
})

export const notifications = pgTable('notifications', {
  id:                uuid('id').primaryKey().defaultRandom(),
  userId:            uuid('user_id').notNull().references(() => users.id),
  title:             text('title').notNull(),
  message:           text('message').notNull(),
  type:              notificationTypeEnum('type').notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId:   uuid('related_entity_id'),
  isRead:            boolean('is_read').notNull().default(false),
  sendEmail:         boolean('send_email').notNull().default(false),
  emailSent:         boolean('email_sent').notNull().default(false),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pointsLedger = pgTable('points_ledger', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id),
  divisionId:  uuid('division_id').references(() => divisions.id),
  sourceType:  pointSourceEnum('source_type').notNull(),
  sourceId:    uuid('source_id'),
  points:      integer('points').notNull(),
  periodMonth: smallint('period_month').notNull(),
  periodYear:  smallint('period_year').notNull(),
  awardedBy:   uuid('awarded_by').references(() => users.id),
  reason:      text('reason'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const gamificationRules = pgTable('gamification_rules', {
  id:        uuid('id').primaryKey().defaultRandom(),
  eventKey:  text('event_key').notNull().unique(),
  points:    integer('points').notNull(),
  isActive:  boolean('is_active').notNull().default(true),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const badges = pgTable('badges', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  description: text('description'),
  icon:        text('icon'),
  criteriaKey: text('criteria_key'),
})

export const userBadges = pgTable('user_badges', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  badgeId:   uuid('badge_id').notNull().references(() => badges.id),
  awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
  period:    text('period'),
}, t => [unique().on(t.userId, t.badgeId)])

export const monthlyRewards = pgTable('monthly_rewards', {
  id:              uuid('id').primaryKey().defaultRandom(),
  periodMonth:     smallint('period_month').notNull(),
  periodYear:      smallint('period_year').notNull(),
  rank:            smallint('rank').notNull().default(1),
  rewardName:      text('reward_name').notNull(),
  rewardImageLink: text('reward_image_link'),
  winnerUserId:    uuid('winner_user_id').references(() => users.id),
  notes:           text('notes'),
  createdBy:       uuid('created_by').notNull().references(() => users.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.periodMonth, t.periodYear, t.rank)])

export const rewardCatalog = pgTable('reward_catalog', {
  id:          uuid('id').primaryKey().defaultRandom(),
  unlockType:  text('unlock_type').notNull().default('level'), // 'level' | 'badge' | 'manual'
  threshold:   integer('threshold'),
  badgeId:     uuid('badge_id').references(() => badges.id),
  name:        text('name').notNull(),
  description: text('description'),
  imageUrl:    text('image_url'),
  stock:       integer('stock'),
  isActive:    boolean('is_active').notNull().default(true),
  createdBy:   uuid('created_by').references(() => users.id),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rewardClaims = pgTable('reward_claims', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull().references(() => users.id),
  source:          text('source').notNull(), // 'monthly' | 'catalog'
  catalogId:       uuid('catalog_id').references(() => rewardCatalog.id),
  monthlyRewardId: uuid('monthly_reward_id').references(() => monthlyRewards.id),
  title:           text('title').notNull(),
  imageUrl:        text('image_url'),
  status:          text('status').notNull().default('claimed'), // 'claimed' | 'fulfilled' | 'rejected'
  periodMonth:     smallint('period_month'),
  periodYear:      smallint('period_year'),
  claimedAt:       timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt:     timestamp('fulfilled_at', { withTimezone: true }),
  fulfilledBy:     uuid('fulfilled_by').references(() => users.id),
  notes:           text('notes'),
})

export const quizQuestions = pgTable('quiz_questions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  question:     text('question').notNull(),
  options:      jsonb('options').notNull(),
  correctIndex: smallint('correct_index').notNull(),
  explanation:  text('explanation'),
  category:     text('category').notNull().default('Umum'),
  difficulty:   text('difficulty').notNull().default('easy'),
  points:       integer('points').notNull().default(15),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const quizAttempts = pgTable('quiz_attempts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id),
  questionId:    uuid('question_id').notNull().references(() => quizQuestions.id),
  quizDate:      date('quiz_date').notNull(),
  selectedIndex: smallint('selected_index').notNull(),
  isCorrect:     boolean('is_correct').notNull(),
  expAwarded:    integer('exp_awarded').notNull().default(0),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.userId, t.quizDate)])

export const userGameStats = pgTable('user_game_stats', {
  userId:        uuid('user_id').primaryKey().references(() => users.id),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActiveDate: date('last_active_date'),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const activityLogs = pgTable('activity_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id),
  action:     text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId:   uuid('entity_id').notNull(),
  details:    jsonb('details'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Relations ──────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  division: one(divisions, { fields: [users.divisionId], references: [divisions.id] }),
  projectsAsPic: many(projects),
  taskAssignees: many(taskAssignees),
  kpiItems: many(kpiItems),
}))

export const divisionsRelations = relations(divisions, ({ many }) => ({
  users: many(users),
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  division: one(divisions, { fields: [projects.divisionId], references: [divisions.id] }),
  pic: one(users, { fields: [projects.picId], references: [users.id] }),
  members: many(projectMembers),
  tasks: many(tasks),
  comments: many(projectComments),
  approvalRequests: many(approvalRequests),
  budgets: many(budgets),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  division: one(divisions, { fields: [tasks.divisionId], references: [divisions.id] }),
  assignees: many(taskAssignees),
}))

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskAssignees.userId], references: [users.id] }),
}))

// ── Chat ───────────────────────────────────────────────────────────────
export const chatChannels = pgTable('chat_channels', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  description: text('description'),
  type:        text('type').notNull().default('general'), // general | division | direct
  divisionId:  uuid('division_id').references(() => divisions.id),
  createdBy:   uuid('created_by').references(() => users.id),
  isArchived:  boolean('is_archived').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chatMessages = pgTable('chat_messages', {
  id:             uuid('id').primaryKey().defaultRandom(),
  channelId:      uuid('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),
  userId:         uuid('user_id').notNull().references(() => users.id),
  content:        text('content').notNull(),
  replyToId:      uuid('reply_to_id').references((): any => chatMessages.id),
  attachmentUrl:  text('attachment_url'),
  attachmentName: text('attachment_name'),
  isEdited:       boolean('is_edited').notNull().default(false),
  editedAt:       timestamp('edited_at', { withTimezone: true }),
  deletedAt:      timestamp('deleted_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chatReactions = pgTable('chat_reactions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  emoji:     text('emoji').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chatReadStatus = pgTable('chat_read_status', {
  userId:     uuid('user_id').notNull().references(() => users.id),
  channelId:  uuid('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.userId, t.channelId)])

export const chatMembers = pgTable('chat_members', {
  channelId: uuid('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  joinedAt:  timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.channelId, t.userId)])

export const userMoods = pgTable('user_moods', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  moodEmoji: text('mood_emoji').notNull(),
  moodLabel: text('mood_label').notNull(),
  moodDate:  date('mood_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.userId, t.moodDate)])

export const madingPosts = pgTable('mading_posts', {
  id:        uuid('id').primaryKey().defaultRandom(),
  title:     text('title').notNull(),
  content:   text('content').notNull(),
  mediaUrl:  text('media_url'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const madingReactions = pgTable('mading_reactions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  postId:    uuid('post_id').notNull().references(() => madingPosts.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  emoji:     text('emoji').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.postId, t.userId)])

export const madingComments = pgTable('mading_comments', {
  id:        uuid('id').primaryKey().defaultRandom(),
  postId:    uuid('post_id').notNull().references(() => madingPosts.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  content:   text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
