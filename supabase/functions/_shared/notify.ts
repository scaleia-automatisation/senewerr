import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NotifyOptions {
  eventType: string
  recipientId: string       // user_id (= profile_id = auth.uid()) of the recipient
  recipientRole?: string    // optional role filter
  data: Record<string, unknown>  // template interpolation data
  priority?: 'low' | 'normal' | 'high' | 'critical'
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''))
}

export async function notify(db: SupabaseClient, opts: NotifyOptions): Promise<void> {
  const { eventType, recipientId, recipientRole, data, priority } = opts

  // Fetch all active templates for this event type
  // channel enum: in_app | email | push | sms | whatsapp
  const { data: templates } = await db
    .from('notification_templates')
    .select('*')
    .eq('event_type', eventType)
    .eq('enabled', true)

  if (!templates?.length) return

  const inAppTemplates = templates.filter(t => t.channel === 'in_app' && (!recipientRole || !t.recipient_role || t.recipient_role === recipientRole))
  const emailTemplates = templates.filter(t => t.channel === 'email' && (!recipientRole || !t.recipient_role || t.recipient_role === recipientRole))
  const pushTemplates  = templates.filter(t => t.channel === 'push'  && (!recipientRole || !t.recipient_role || t.recipient_role === recipientRole))

  // Create in-app notification (first matching in_app template)
  let notifId: string | null = null
  for (const tmpl of inAppTemplates) {
    const title   = interpolate(tmpl.title_template, data)
    const message = interpolate(tmpl.message_template, data)
    const effectivePriority = priority ?? tmpl.priority

    const { data: notif } = await db.from('notifications').insert({
      user_id:        recipientId,
      type:           eventType,
      event_type:     eventType,
      badge_category: tmpl.badge_category,
      priority:       effectivePriority,
      data,
      title,
      message,
    }).select('id').single()
    notifId = notif?.id ?? null
    break
  }

  // Helper to get latest notification id if we didn't create in-app one
  const getNotifId = async (): Promise<string | null> => {
    if (notifId) return notifId
    const { data: n } = await db.from('notifications')
      .select('id')
      .eq('user_id', recipientId)
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return n?.id ?? null
  }

  // Queue email delivery
  for (const tmpl of emailTemplates) {
    const effectivePriority = priority ?? tmpl.priority
    const nid = await getNotifId()
    if (nid) {
      await db.from('notification_deliveries').insert({
        notification_id: nid,
        channel:         'email',
        status:          'queued',
        scheduled_at:    ['high', 'critical'].includes(effectivePriority)
          ? new Date().toISOString()
          : new Date(Date.now() + 60000).toISOString(),
      })
    }
    break
  }

  // Queue push delivery
  for (const tmpl of pushTemplates) {
    const nid = await getNotifId()
    if (nid) {
      await db.from('notification_deliveries').insert({
        notification_id: nid,
        channel:         'push',
        status:          'queued',
        scheduled_at:    new Date().toISOString(),
      })
    }
    break
  }
}
