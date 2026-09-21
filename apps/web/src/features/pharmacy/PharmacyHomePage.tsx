import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FileText, Package, ShoppingBag, Bell, ArrowRight, Power } from 'lucide-react'
import { usePharmacy } from './PharmacyContext'
import { usePharmacyBadges } from './PharmacyBadgesContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const fade = { hidden: { opacity: 0, y: 12 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.2 } }) }

export default function PharmacyHomePage() {
  const { pharmacie, loading, toggleEnService } = usePharmacy()
  const { ordonnances, notifications, stockAlertes, commandes } = usePharmacyBadges()

  if (loading) {
    return (
      <div className="flex flex-col gap-s-4">
        <Skeleton className="h-24 rounded-lg" />
        <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const kpis = [
    { label: 'Ordonnances en attente', value: ordonnances, href: '/pharmacie/ordonnances', icon: <FileText className="h-5 w-5" />, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Alertes stock', value: stockAlertes, href: '/pharmacie/stock', icon: <Package className="h-5 w-5" />, color: 'text-status-danger', bg: 'bg-status-danger/10' },
    { label: 'Commandes à traiter', value: commandes, href: '/pharmacie/commandes', icon: <ShoppingBag className="h-5 w-5" />, color: 'text-status-warning', bg: 'bg-status-warning/10' },
    { label: 'Notifications non lues', value: notifications, href: '/pharmacie/notifications', icon: <Bell className="h-5 w-5" />, color: 'text-ink-2', bg: 'bg-surface-2' },
  ]

  return (
    <div className="flex flex-col gap-s-6 pb-s-8">
      {/* En service toggle */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between rounded-lg border border-line bg-surface p-s-4"
      >
        <div className="flex flex-col gap-s-1">
          <p className="font-semibold text-ink">{pharmacie?.nom ?? 'Ma pharmacie'}</p>
          <div className="flex items-center gap-s-2">
            <span className={`h-2.5 w-2.5 rounded-full ${pharmacie?.en_service ? 'bg-primary' : 'bg-status-danger'}`} />
            <span className="text-small text-ink-2">
              {pharmacie?.en_service ? 'En service — visible sur la plateforme' : 'Hors service — non visible'}
            </span>
          </div>
        </div>
        <Button
          variant={pharmacie?.en_service ? 'secondary' : 'primary'}
          size="sm"
          leftIcon={<Power className="h-4 w-4" />}
          onClick={toggleEnService}
        >
          {pharmacie?.en_service ? 'Passer hors service' : 'Mettre en service'}
        </Button>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} custom={i} initial="hidden" animate="show" variants={fade}>
            <Link
              to={k.href}
              className="flex flex-col gap-s-3 rounded-lg border border-line bg-surface p-s-4 hover:shadow-sm transition-shadow"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${k.bg} ${k.color}`}>
                {k.icon}
              </div>
              <div>
                <p className={`font-display text-h1 font-semibold ${k.color}`}>{k.value}</p>
                <p className="text-micro text-ink-3 leading-tight">{k.label}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-3 self-end -mt-s-2" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Liens rapides */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <h2 className="mb-s-3 font-semibold text-ink">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-3">
          {[
            { to: '/pharmacie/ordonnances', label: 'Valider une ordonnance', icon: '💊' },
            { to: '/pharmacie/stock', label: 'Gérer le stock', icon: '📦' },
            { to: '/pharmacie/dispensations', label: 'Nouvelle dispensation', icon: '📋' },
            { to: '/pharmacie/patients', label: 'Fiche patient', icon: '👤' },
            { to: '/pharmacie/commandes', label: 'Passer une commande', icon: '🛒' },
            { to: '/pharmacie/pharmacie', label: 'Profil pharmacie', icon: '⚙️' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-s-3 rounded-md border border-line bg-surface px-s-4 py-s-3 text-small font-medium text-ink hover:bg-surface-2 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
