import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Calendar, Pill, FolderClosed, Bell } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { ActionTile } from '@/components/ui/ActionTile'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { CodeDisplay } from '@/components/ui/CodeDisplay'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const } },
}

export default function PatientHome() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Bienvenue'

  return (
    <div className="flex flex-col gap-s-6">
      {/* En-tête */}
      <header className="flex items-start justify-between gap-s-3">
        <div>
          <p className="text-small text-ink-3">Bonjour</p>
          <h1 className="text-h1 font-semibold text-ink">{firstName}</h1>
          <p className="mt-s-1 text-body text-ink-2">Que voulez-vous faire ?</p>
        </div>
        <div className="flex items-center gap-s-2">
          <div className="relative">
            <IconButton aria-label="Notifications" variant="secondary" onClick={() => navigate('/patient/notifications')}>
              <Bell className="h-5 w-5" />
            </IconButton>
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-s-1 text-micro font-medium text-accent-fg">
              2
            </span>
          </div>
          <Avatar fallback={profile?.full_name ?? 'Patient'} size="md" />
        </div>
      </header>

      {/* Tuiles d'action */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-s-3"
      >
        {[
          { icon: <Search className="h-6 w-6" />, label: 'Trouver un médecin', to: '/patient/rendez-vous' },
          { icon: <Calendar className="h-6 w-6" />, label: 'Prendre rendez-vous', to: '/patient/rendez-vous' },
          { icon: <Pill className="h-6 w-6" />, label: 'Trouver un médicament', to: '/patient/pharmacie' },
          { icon: <FolderClosed className="h-6 w-6" />, label: 'Mes documents', to: '/patient/documents' },
        ].map(tile => (
          <motion.div key={tile.label} variants={item}>
            <ActionTile icon={tile.icon} label={tile.label} onClick={() => navigate(tile.to)} className="w-full" />
          </motion.div>
        ))}
      </motion.div>

      {/* Mon actualité */}
      <section className="flex flex-col gap-s-3">
        <h2 className="text-micro font-semibold uppercase tracking-[0.06em] text-ink-3">Mon actualité</h2>

        <Card variant="interactive">
          <div className="flex items-start justify-between gap-s-3">
            <div>
              <p className="text-small text-ink-3">aujourd'hui 15:00</p>
              <p className="mt-s-1 font-medium text-ink">Dr Aminata Ndiaye</p>
              <p className="text-small text-ink-2">Clinique Kër Santé</p>
            </div>
            <StatusPill status="pending" label="À venir" />
          </div>
          <div className="mt-s-4 flex gap-s-2">
            <Button size="sm">Je suis arrivé</Button>
            <Button size="sm" variant="ghost">Détails</Button>
          </div>
        </Card>

        <Card variant="interactive">
          <div className="flex items-start justify-between gap-s-3">
            <div>
              <p className="font-medium text-ink">Ma réservation · MED-45872</p>
              <p className="text-small text-ink-2">Pharmacie Liberté</p>
            </div>
            <StatusPill status="progress" label="En préparation" />
          </div>
          <div className="mt-s-4">
            <CodeDisplay code="4827" label="Code de retrait" />
          </div>
        </Card>

        <Card variant="interactive">
          <div className="flex items-start justify-between gap-s-3">
            <div>
              <p className="font-medium text-ink">Dernière ordonnance · ORD-458721</p>
              <p className="text-small text-ink-2">Dr Sow · 12 sept.</p>
            </div>
          </div>
          <div className="mt-s-4">
            <Button size="sm" variant="secondary" onClick={() => navigate('/patient/pharmacie')}>
              Trouver mon médicament
            </Button>
          </div>
        </Card>
      </section>
    </div>
  )
}
