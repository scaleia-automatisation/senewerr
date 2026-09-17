import { describe, it, expect } from 'vitest'
import { appointmentStatus, reservationStatus, coverageStatus, prescriptionStatus } from './status'

describe('mapping des statuts', () => {
  it('mappe les rendez-vous vers les libellés patient', () => {
    expect(appointmentStatus('pending')).toEqual({ kind: 'pending', label: 'À venir' })
    expect(appointmentStatus('completed')).toEqual({ kind: 'success', label: 'Terminée' })
    expect(appointmentStatus('cancelled')).toEqual({ kind: 'danger', label: 'Annulée' })
  })

  it('mappe les réservations', () => {
    expect(reservationStatus('ready')).toEqual({ kind: 'success', label: 'Prête' })
    expect(reservationStatus('pending')).toEqual({ kind: 'pending', label: 'À traiter' })
    expect(reservationStatus('expired')).toEqual({ kind: 'neutral', label: 'Expirée' })
  })

  it('mappe les prises en charge', () => {
    expect(coverageStatus('approved').kind).toBe('success')
    expect(coverageStatus('rejected').kind).toBe('danger')
  })

  it('mappe les ordonnances', () => {
    expect(prescriptionStatus('active').kind).toBe('progress')
    expect(prescriptionStatus('dispensed').kind).toBe('success')
  })

  it('retombe sur un statut neutre pour une valeur inconnue', () => {
    expect(appointmentStatus('xxx')).toEqual({ kind: 'neutral', label: '—' })
  })
})
