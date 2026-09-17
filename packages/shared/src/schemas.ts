import { z } from 'zod'

// ============================================================
// Schémas Zod partagés client/serveur
// ============================================================

export const phoneSchema = z.string()
  .regex(/^\+?[0-9\s\-()]{8,20}$/, 'Numéro de téléphone invalide')

export const xofAmountSchema = z.number()
  .int('Montant en entiers XOF')
  .nonnegative('Montant non négatif')

export const createAppointmentSchema = z.object({
  slotId:          z.string().uuid(),
  patientId:       z.string().uuid(),
  beneficiaryId:   z.string().uuid().optional(),
  professionalId:  z.string().uuid(),
  establishmentId: z.string().uuid(),
  appointmentType: z.enum(['in_person','teleconsultation']).default('in_person'),
  reason:          z.string().max(500).optional(),
  patientNotes:    z.string().max(1000).optional(),
})
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>

export const createReservationSchema = z.object({
  pharmacyId:      z.string().uuid(),
  prescriptionId:  z.string().uuid().optional(),
  items: z.array(z.object({
    pharmacyProductId:  z.string().uuid(),
    prescriptionItemId: z.string().uuid().optional(),
    quantity:           z.number().int().positive(),
  })).min(1),
  beneficiaryId:        z.string().uuid().optional(),
  insuranceProviderId:  z.string().uuid().optional(),
  insuranceMemberId:    z.string().uuid().optional(),
})
export type CreateReservationInput = z.infer<typeof createReservationSchema>

export const signPrescriptionSchema = z.object({
  prescriptionId: z.string().uuid(),
})
export type SignPrescriptionInput = z.infer<typeof signPrescriptionSchema>

export const sharePrescriptionSchema = z.object({
  prescriptionId: z.string().uuid(),
  pharmacyId:     z.string().uuid(),
  reservationId:  z.string().uuid().optional(),
})
export type SharePrescriptionInput = z.infer<typeof sharePrescriptionSchema>

export const geocodeSchema = z.object({
  address: z.string().min(3).max(500),
  city:    z.string().max(100).optional(),
})

export const promoCodeSchema = z.object({
  code: z.string().regex(/^[a-z]+[0-9]{2}$/i, 'Format code promo invalide (ex: hugo10)'),
})

export const createCheckoutSessionSchema = z.object({
  planCode:        z.string().optional(),
  creditPackCode:  z.string().optional(),
  billingInterval: z.enum(['monthly','yearly']).default('monthly'),
  promoCode:       z.string().optional(),
  successUrl:      z.string().url(),
  cancelUrl:       z.string().url(),
})
