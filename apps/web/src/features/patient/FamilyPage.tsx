import { useState, useEffect } from 'react'
import { Plus, Trash2, User } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

const schema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  last_name: z.string().min(1, 'Nom requis'),
  date_of_birth: z.string().min(1, 'Date de naissance requise'),
  gender: z.enum(['male','female','other']),
  relationship: z.string().min(1, 'Lien requis'),
})
type Form = z.infer<typeof schema>

interface FamilyMember {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  relationship: string
}

export default function FamilyPage() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'male' },
  })

  useEffect(() => { fetchMembers() }, [profile?.id])

  async function fetchMembers() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .eq('patient_id', profile.id)
      .order('created_at')
    setMembers(data ?? [])
    setLoading(false)
  }

  async function onSubmit(data: Form) {
    const { error } = await supabase.from('family_members').insert({ ...data, patient_id: profile?.id })
    if (!error) { setShowModal(false); reset(); await fetchMembers() }
  }

  async function deleteMember(id: string) {
    setDeleting(id)
    await supabase.from('family_members').delete().eq('id', id)
    setMembers(m => m.filter(x => x.id !== id))
    setDeleting(null)
  }

  function age(dob: string) {
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-display text-ink">Ma famille</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-s-1" />
          Ajouter
        </Button>
      </div>

      {loading && <div className="flex flex-col gap-s-3">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}</div>}

      {!loading && members.length === 0 && (
        <EmptyState
          title="Aucun bénéficiaire"
          description="Ajoutez vos proches pour prendre des rendez-vous en leur nom."
          action={<Button onClick={() => setShowModal(true)}>Ajouter un bénéficiaire</Button>}
        />
      )}

      <div className="flex flex-col gap-s-3">
        {members.map(m => (
          <Card key={m.id} className="p-s-4 flex items-center gap-s-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-surface-2 shrink-0">
              <User className="w-5 h-5 text-ink-3" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-ink">{m.first_name} {m.last_name}</p>
              <p className="text-small text-ink-3">{m.relationship} · {age(m.date_of_birth)} ans</p>
            </div>
            <Button
              variant="ghost"
              loading={deleting === m.id}
              onClick={() => deleteMember(m.id)}
              aria-label="Supprimer"
            >
              <Trash2 className="w-4 h-4 text-status-danger" />
            </Button>
          </Card>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Ajouter un bénéficiaire">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-s-3">
          <div className="grid grid-cols-2 gap-s-2">
            <Input label="Prénom" error={errors.first_name?.message} {...register('first_name')} />
            <Input label="Nom" error={errors.last_name?.message} {...register('last_name')} />
          </div>
          <Input label="Date de naissance" type="date" error={errors.date_of_birth?.message} {...register('date_of_birth')} />
          <Select
            label="Genre"
            options={[{ value:'male',label:'Homme' },{ value:'female',label:'Femme' },{ value:'other',label:'Autre' }]}
            value=""
            onValueChange={() => {}}
            {...register('gender')}
          />
          <Input label="Lien (ex: enfant, conjoint)" error={errors.relationship?.message} {...register('relationship')} />
          <Button type="submit" loading={isSubmitting} fullWidth>Ajouter</Button>
        </form>
      </Modal>
    </div>
  )
}
