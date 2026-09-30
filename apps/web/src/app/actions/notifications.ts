'use server'
import { sendNotification, sendBulkNotifications, type NotifPayload } from '@/lib/notifications'

export async function sendNotificationAction(payload: NotifPayload) {
  return sendNotification(payload)
}

export async function sendBulkNotificationsAction(payloads: NotifPayload[]) {
  return sendBulkNotifications(payloads)
}
