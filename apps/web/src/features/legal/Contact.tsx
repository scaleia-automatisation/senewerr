import { useState } from 'react'
import { LegalLayout } from './LegalLayout'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { Mail, MessageSquare, Shield } from 'lucide-react'

export const META = {
  title: 'Nous contacter | Medikool',
  description:
    "Contactez l'équipe Medikool pour toute question, problème technique, demande de facturation ou signalement. Réponse sous 48 heures ouvrées.",
}

const SUBJECT_OPTIONS = [
  { value: 'question_generale', label: 'Question générale' },
  { value: 'probleme_technique', label: 'Problème technique' },
  { value: 'facturation', label: 'Facturation / abonnement' },
  { value: 'signalement', label: 'Signalement' },
]

interface FormState {
  name: string
  email: string
  subject: string
  message: string
}

interface FormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}

export default function Contact() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Votre nom est requis.'
    if (!form.email.trim()) {
      errs.email = 'Votre adresse email est requise.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Adresse email invalide.'
    }
    if (!form.subject) errs.subject = 'Veuillez sélectionner un sujet.'
    if (!form.message.trim()) {
      errs.message = 'Votre message est requis.'
    } else if (form.message.trim().length < 20) {
      errs.message = 'Votre message doit contenir au moins 20 caractères.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const { error } = await (supabase as any)
        .from('contact_messages')
        .insert({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          subject: form.subject,
          message: form.message.trim(),
          created_at: new Date().toISOString(),
        })

      if (error) throw error
      setSubmitted(true)
    } catch (err) {
      console.error('Contact form error:', err)
      setSubmitError(
        "Une erreur est survenue lors de l'envoi de votre message. Merci de réessayer ou de nous écrire directement à contact@medikool.sn.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LegalLayout title="Nous contacter" lastUpdated="17 septembre 2026">
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <p className="text-body text-ink-2">
            Notre équipe est disponible du lundi au vendredi de 08h à 18h (WAT).
            Nous nous engageons à répondre à votre message dans un délai de{' '}
            <strong>48 heures ouvrées</strong>. Pour les urgences techniques en production,
            utilisez l'adresse{' '}
            <a href="mailto:support@medikool.sn" className="text-primary hover:underline">
              support@medikool.sn
            </a>.
          </p>
        </section>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-4">
          <Card className="p-s-4">
            <div className="flex items-start gap-s-3">
              <Mail className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-small font-semibold text-ink mb-s-1">Contact général</p>
                <a href="mailto:contact@medikool.sn" className="text-small text-primary hover:underline break-all">
                  contact@medikool.sn
                </a>
              </div>
            </div>
          </Card>
          <Card className="p-s-4">
            <div className="flex items-start gap-s-3">
              <MessageSquare className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-small font-semibold text-ink mb-s-1">Support technique</p>
                <a href="mailto:support@medikool.sn" className="text-small text-primary hover:underline break-all">
                  support@medikool.sn
                </a>
              </div>
            </div>
          </Card>
          <Card className="p-s-4">
            <div className="flex items-start gap-s-3">
              <Shield className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-small font-semibold text-ink mb-s-1">Données personnelles</p>
                <a href="mailto:dpo@medikool.sn" className="text-small text-primary hover:underline break-all">
                  dpo@medikool.sn
                </a>
              </div>
            </div>
          </Card>
        </div>

        {/* Form */}
        <section>
          <h2 data-toc id="formulaire" className="text-h2 font-semibold text-ink mb-s-4">
            Formulaire de contact
          </h2>

          {submitted ? (
            <Banner kind="info">
              <span>
                <strong>Message envoyé !</strong> Merci de nous avoir contactés. Nous vous
                répondrons dans les 48 heures ouvrées à l'adresse indiquée.
              </span>
            </Banner>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-s-4 max-w-lg">
              {submitError && (
                <Banner kind="warning">{submitError}</Banner>
              )}

              <Input
                label="Nom complet *"
                type="text"
                placeholder="Prénom Nom"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={errors.name}
                autoComplete="name"
              />

              <Input
                label="Adresse email *"
                type="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                error={errors.email}
                autoComplete="email"
              />

              <Select
                label="Sujet *"
                options={SUBJECT_OPTIONS}
                value={form.subject}
                onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}
                placeholder="Choisir un sujet…"
                error={errors.subject}
              />

              <Textarea
                label="Message *"
                placeholder="Décrivez votre demande en quelques lignes (20 caractères minimum)…"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                error={errors.message}
                rows={5}
                hint={
                  form.message.length > 0
                    ? `${form.message.length} caractère${form.message.length > 1 ? 's' : ''}`
                    : undefined
                }
              />

              {/* hCaptcha placeholder */}
              <div className="text-small text-ink-3 border border-dashed border-line rounded-sm px-s-3 py-s-2">
                [Protection anti-spam — à activer en production]
              </div>

              <Button
                type="submit"
                loading={submitting}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Envoyer le message
              </Button>
            </form>
          )}
        </section>

      </div>
    </LegalLayout>
  )
}
