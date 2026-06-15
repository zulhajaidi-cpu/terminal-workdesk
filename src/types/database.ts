export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: UserRole
          division_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      divisions: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['divisions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['divisions']['Insert']>
      }
      projects: {
        Row: {
          id: string
          project_code: string
          name: string
          division_id: string
          project_type: string
          pic_id: string
          objective: string
          deliverables: string
          start_date: string
          deadline: string
          status: ProjectStatus
          priority: Priority
          progress: number
          budget_planned: number | null
          budget_approved: number | null
          budget_actual: number | null
          approval_status: ApprovalStatus | null
          current_approval_step: number | null
          attachment_url: string | null
          notes: string | null
          is_overdue: boolean
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'project_code' | 'progress' | 'is_overdue' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          name: string
          project_id: string | null
          division_id: string
          created_by: string
          due_date: string
          priority: Priority
          status: TaskStatus
          description: string | null
          checklist: Json | null
          attachment_url: string | null
          output_url: string | null
          review_result: string | null
          recurring_rule: string | null
          reminder_at: string | null
          completed_at: string | null
          is_overdue: boolean
          requires_approval: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'is_overdue' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      task_assignees: {
        Row: {
          id: string
          task_id: string
          user_id: string
          assigned_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_assignees']['Row'], 'id' | 'assigned_at'>
        Update: never
      }
      kpi_items: {
        Row: {
          id: string
          user_id: string
          period_month: number
          period_year: number
          kpi_name: string
          weight: number
          target: number | null
          realization: number | null
          max_score: number
          auto_score: number | null
          final_score: number | null
          evaluation_note: string | null
          improvement_plan: string | null
          status: KpiStatus
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['kpi_items']['Row'], 'id' | 'auto_score' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['kpi_items']['Insert']>
      }
      calendar_events: {
        Row: {
          id: string
          title: string
          event_type: EventType
          division_id: string | null
          related_project_id: string | null
          start_at: string
          end_at: string
          all_day: boolean
          location: string | null
          link: string | null
          reminder_rule: string | null
          created_by: string
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['calendar_events']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['calendar_events']['Insert']>
      }
      event_participants: {
        Row: {
          id: string
          event_id: string
          user_id: string
          role_in_event: string | null
          notified_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['event_participants']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['event_participants']['Insert']>
      }
      approval_requests: {
        Row: {
          id: string
          type: ApprovalType
          related_entity_type: string
          related_entity_id: string
          requested_by: string
          current_step: number
          status: ApprovalRequestStatus
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['approval_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['approval_requests']['Insert']>
      }
      approval_steps: {
        Row: {
          id: string
          approval_request_id: string
          step_order: number
          approver_role: ApproverRole
          approver_user_id: string | null
          action: ApprovalAction
          note: string | null
          acted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['approval_steps']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['approval_steps']['Insert']>
      }
      points_ledger: {
        Row: {
          id: string
          user_id: string
          division_id: string | null
          source_type: PointSource
          source_id: string | null
          points: number
          period_month: number
          period_year: number
          awarded_by: string | null
          reason: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['points_ledger']['Row'], 'id' | 'created_at'>
        Update: never
      }
      gamification_rules: {
        Row: {
          id: string
          event_key: string
          points: number
          is_active: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['gamification_rules']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['gamification_rules']['Insert']>
      }
      monthly_rewards: {
        Row: {
          id: string
          period_month: number
          period_year: number
          rank: number
          reward_name: string
          reward_image_link: string | null
          winner_user_id: string | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['monthly_rewards']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['monthly_rewards']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: NotificationType
          related_entity_type: string | null
          related_entity_id: string | null
          is_read: boolean
          send_email: boolean
          email_sent: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      assets: {
        Row: {
          id: string
          name: string
          category: string
          division_id: string
          drive_link: string
          version: string | null
          status: AssetStatus
          uploaded_by: string
          related_project_id: string | null
          description: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['assets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['assets']['Insert']>
      }
      budgets: {
        Row: {
          id: string
          project_id: string
          category: string
          planned: number
          approved: number | null
          actual: number
          vendor: string | null
          invoice_link: string | null
          reimburse_link: string | null
          payment_status: BudgetPaymentStatus
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>
      }
      project_comments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          content: string
          attachment_url: string | null
          is_edited: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['project_comments']['Row'], 'id' | 'is_edited' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['project_comments']['Insert']>
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          details: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      user_role: UserRole
      project_status: ProjectStatus
      task_status: TaskStatus
      priority: Priority
      approval_status: ApprovalStatus
      approval_request_status: ApprovalRequestStatus
      approval_type: ApprovalType
      approver_role: ApproverRole
      approval_action: ApprovalAction
      kpi_status: KpiStatus
      event_type: EventType
      point_source: PointSource
      asset_status: AssetStatus
      budget_payment_status: BudgetPaymentStatus
      notification_type: NotificationType
    }
  }
}

export type UserRole = 'super_admin' | 'spv_manager' | 'leader_divisi' | 'staff' | 'head_director'
export type ProjectStatus = 'Draft' | 'Waiting Approval' | 'Not Started' | 'In Progress' | 'Need Review' | 'Revision' | 'Completed' | 'On Hold' | 'Cancelled'
export type TaskStatus = 'To Do' | 'In Progress' | 'Need Review' | 'Revision' | 'Completed' | 'On Hold' | 'Cancelled'
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Revision'
export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Revision'
export type ApprovalType = 'project' | 'budget' | 'asset' | 'kpi'
export type ApproverRole = 'spv' | 'manager' | 'director'
export type ApprovalAction = 'pending' | 'approve' | 'reject' | 'revision'
export type KpiStatus = 'Draft' | 'Reviewed' | 'Final'
export type EventType = 'Meeting' | 'Shooting' | 'Visit' | 'Deadline' | 'Other'
export type PointSource = 'task' | 'project' | 'kpi' | 'kudos' | 'bonus'
export type AssetStatus = 'Draft' | 'Need Review' | 'Approved' | 'Rejected' | 'Archived'
export type BudgetPaymentStatus = 'Draft' | 'Waiting Approval' | 'Approved' | 'Used' | 'Partially Paid' | 'Paid' | 'Rejected'
export type NotificationType = 'task_assigned' | 'deadline' | 'overdue' | 'approval_request' | 'approval_result' | 'mention' | 'kpi_reminder' | 'asset_new' | 'project_done' | 'revision_requested' | 'budget_exceeded' | 'event_assigned' | 'gamification'
