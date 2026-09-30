import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' F CFA'
}

export function formatDate(date: string | Date, locale = 'fr-FR'): string {
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

export function formatDateTime(date: string | Date, locale = 'fr-FR'): string {
  return new Date(date).toLocaleString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function reservationExpiresAt(createdAt: Date, hasPaid: boolean): Date {
  const ms = hasPaid ? 72 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000
  return new Date(createdAt.getTime() + ms)
}

export function isReservationExpired(createdAt: Date, hasPaid: boolean): boolean {
  return new Date() > reservationExpiresAt(createdAt, hasPaid)
}
