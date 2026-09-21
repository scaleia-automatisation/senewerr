import {
  Home, Calendar, FileText, ShoppingBag, Heart, CreditCard,
  FolderClosed, Users, Bell, User, Pill, Stethoscope, Building2,
  LayoutDashboard, ClipboardList, Package, BarChart2, Settings,
  Wallet, AlertTriangle, Shield, FileCheck, Video, HelpCircle,
} from 'lucide-react'
import type { SpaceNav } from '@/components/layout/nav-types'

const ic = 'h-5 w-5'

export const PATIENT_NAV: SpaceNav = {
  roleLabel: 'Patient',
  links: [
    { href: '/patient',              label: 'Accueil',       icon: <Home className={ic} />,          primary: true },
    { href: '/patient/rendez-vous',  label: 'Rendez-vous',   icon: <Calendar className={ic} />,      primary: true },
    { href: '/patient/ordonnances',  label: 'Ordonnances',   icon: <FileText className={ic} />,      primary: true },
    { href: '/patient/reservations', label: 'Réservations',  icon: <ShoppingBag className={ic} />,   primary: true },
    { href: '/patient/mutuelle',     label: 'Ma mutuelle',   icon: <Heart className={ic} /> },
    { href: '/patient/paiements',    label: 'Paiements',     icon: <CreditCard className={ic} /> },
    { href: '/patient/documents',    label: 'Documents',     icon: <FolderClosed className={ic} /> },
    { href: '/patient/famille',      label: 'Famille',       icon: <Users className={ic} /> },
    { href: '/patient/notifications', label: 'Notifications', icon: <Bell className={ic} /> },
    { href: '/patient/profil',       label: 'Profil',        icon: <User className={ic} /> },
  ],
}

export const PROFESSIONAL_NAV: SpaceNav = {
  roleLabel: 'Professionnel de santé',
  links: [
    { href: '/pro',                 label: "Aujourd'hui",   icon: <LayoutDashboard className={ic} />, primary: true },
    { href: '/pro/agenda',          label: 'Agenda',        icon: <Calendar className={ic} />,        primary: true },
    { href: '/pro/patients',        label: 'Patients',      icon: <Users className={ic} />,           primary: true },
    { href: '/pro/ordonnances',     label: 'Ordonnances',   icon: <FileText className={ic} />,        primary: true },
    { href: '/pro/consultations',   label: 'Consultations', icon: <Stethoscope className={ic} /> },
    { href: '/pro/teleconsultation', label: 'Téléconsultation', icon: <Video className={ic} /> },
    { href: '/pro/revenus',         label: 'Revenus',       icon: <Wallet className={ic} /> },
    { href: '/pro/notifications',   label: 'Notifications', icon: <Bell className={ic} /> },
    { href: '/pro/parametres',      label: 'Paramètres',    icon: <Settings className={ic} /> },
  ],
}

export const ESTABLISHMENT_NAV: SpaceNav = {
  roleLabel: 'Établissement de santé',
  links: [
    { href: '/etablissement',                label: "Aujourd'hui",  icon: <LayoutDashboard className={ic} />, primary: true },
    { href: '/etablissement/agenda',         label: 'Planning',     icon: <Calendar className={ic} />,        primary: true },
    { href: '/etablissement/professionnels', label: 'Médecins',     icon: <Users className={ic} />,           primary: true },
    { href: '/etablissement/chambres',       label: 'Salles',       icon: <Building2 className={ic} />,       primary: true },
    { href: '/etablissement/dossiers',       label: 'Dossiers',     icon: <FolderClosed className={ic} /> },
    { href: '/etablissement/statistiques',   label: 'Statistiques', icon: <BarChart2 className={ic} /> },
    { href: '/etablissement/notifications',  label: 'Notifications', icon: <Bell className={ic} /> },
    { href: '/etablissement/parametres',     label: 'Paramètres',   icon: <Settings className={ic} /> },
  ],
}

export const PHARMACY_NAV: SpaceNav = {
  roleLabel: 'Pharmacie',
  links: [
    { href: '/pharmacie',                label: 'Accueil',       icon: <Home className={ic} />,         primary: true },
    { href: '/pharmacie/ordonnances',    label: 'Ordonnances',   icon: <FileText className={ic} />,     primary: true },
    { href: '/pharmacie/dispensations',  label: 'Dispensations', icon: <Pill className={ic} />,         primary: true },
    { href: '/pharmacie/patients',       label: 'Patients',      icon: <Users className={ic} />,        primary: true },
    { href: '/pharmacie/stock',          label: 'Stock',         icon: <Package className={ic} /> },
    { href: '/pharmacie/commandes',      label: 'Commandes',     icon: <ShoppingBag className={ic} /> },
    { href: '/pharmacie/paiements',      label: 'Paiements',     icon: <CreditCard className={ic} /> },
    { href: '/pharmacie/documents',      label: 'Documents',     icon: <FolderClosed className={ic} /> },
    { href: '/pharmacie/notifications',  label: 'Notifications', icon: <Bell className={ic} />,         primary: true },
    { href: '/pharmacie/pharmacie',      label: 'Ma pharmacie',  icon: <Building2 className={ic} /> },
  ],
}

export const MUTUAL_NAV: SpaceNav = {
  roleLabel: 'Mutuelle / Assurance',
  links: [
    { href: '/mutuelle',                  label: 'À traiter',    icon: <LayoutDashboard className={ic} />, primary: true },
    { href: '/mutuelle/prises-en-charge', label: 'Demandes',     icon: <FileCheck className={ic} />,       primary: true },
    { href: '/mutuelle/membres',          label: 'Assurés',      icon: <Users className={ic} />,           primary: true },
    { href: '/mutuelle/paiements',        label: 'Paiements',    icon: <CreditCard className={ic} />,      primary: true },
    { href: '/mutuelle/regles',           label: 'Règles',       icon: <ClipboardList className={ic} /> },
    { href: '/mutuelle/statistiques',     label: 'Statistiques', icon: <BarChart2 className={ic} /> },
    { href: '/mutuelle/notifications',    label: 'Notifications', icon: <Bell className={ic} /> },
    { href: '/mutuelle/parametres',       label: 'Paramètres',   icon: <Settings className={ic} /> },
  ],
}

export const ADMIN_NAV: SpaceNav = {
  roleLabel: 'Administrateur plateforme',
  links: [
    { href: '/admin',                label: 'À traiter',      icon: <LayoutDashboard className={ic} /> },
    { href: '/admin/utilisateurs',   label: 'Acteurs',        icon: <Users className={ic} /> },
    { href: '/admin/pharmacies',     label: 'Commandes',      icon: <ShoppingBag className={ic} /> },
    { href: '/admin/etablissements', label: 'Rendez-vous',    icon: <Calendar className={ic} /> },
    { href: '/admin/abonnements',    label: 'Paiements',      icon: <CreditCard className={ic} /> },
    { href: '/admin/litiges',        label: 'Litiges',        icon: <AlertTriangle className={ic} /> },
    { href: '/admin/verifications',  label: 'Vérifications',  icon: <Shield className={ic} /> },
    { href: '/admin/statistiques',   label: 'Analytics',      icon: <BarChart2 className={ic} /> },
    { href: '/admin/parametres',     label: 'Paramètres',     icon: <Settings className={ic} /> },
  ],
}

export const SUPER_ADMIN_NAV: SpaceNav = {
  roleLabel: 'Super administrateur',
  links: [
    { href: '/super-admin',                label: 'Console',      icon: <LayoutDashboard className={ic} /> },
    { href: '/super-admin/migrations',     label: 'Migrations',   icon: <FileText className={ic} /> },
    { href: '/super-admin/permissions',    label: 'Permissions',  icon: <Shield className={ic} /> },
    { href: '/super-admin/analytics',      label: 'Analytics',    icon: <BarChart2 className={ic} /> },
    { href: '/super-admin/platform',       label: 'Plateforme',   icon: <Settings className={ic} /> },
    { href: '/super-admin/aide',           label: 'Aide',         icon: <HelpCircle className={ic} /> },
  ],
}

/** Icônes ré-exportées pour l'accueil patient (ActionTiles). */
export { Stethoscope, Pill, Calendar, FolderClosed }
