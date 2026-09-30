/**
 * Mapping centralisé des icônes Séné Wérr → Lucide Icons
 * Garantit la cohérence sur toutes les pages : une même icône
 * pour une même action ou concept, sans redéfinition locale.
 */
import {
  Home, FolderOpen, Calendar, Stethoscope, ClipboardList, FlaskConical,
  Pill, Package, ShieldCheck, FileText, Bell, Settings, Search,
  Plus, Pencil, Trash2, Filter, Download, Share2, Check, X, XCircle,
  ChevronLeft, ArrowLeft, CircleCheckBig, Ban, Clock, RefreshCw,
  AlertTriangle, CheckCircle2, Loader2, Info, Timer, History, LogOut,
  Users, User, Building2, Briefcase, HeartPulse, Landmark, ShieldOff,
  BarChart3, TrendingUp, Map, Phone, Mail, Globe, Lock, Eye, EyeOff,
  CreditCard, Wallet, QrCode, Smartphone, ChevronRight, ExternalLink,
  Upload, Camera, Image, Grid3X3, List, LayoutDashboard, Inbox,
} from 'lucide-react'

/* ── Navigation ─────────────────────────────────────────────────────────── */
export const NavIcons = {
  accueil: Home,
  dossier: FolderOpen,
  rendezvous: Calendar,
  consultations: Stethoscope,
  prescriptions: ClipboardList,
  examens: FlaskConical,
  medicaments: Pill,
  reservations: Package,
  couverture: ShieldCheck,
  documents: FileText,
  notifications: Bell,
  parametres: Settings,
  statistiques: BarChart3,
  historique: History,
  dashboard: LayoutDashboard,
  messages: Inbox,
} as const

/* ── Actions ─────────────────────────────────────────────────────────────── */
export const ActionIcons = {
  ajouter: Plus,
  modifier: Pencil,
  supprimer: Trash2,
  rechercher: Search,
  filtrer: Filter,
  telecharger: Download,
  partager: Share2,
  confirmer: Check,
  refuser: X,
  valider: CircleCheckBig,
  annuler: XCircle,
  fermer: X,
  retour: ArrowLeft,
  retourChevron: ChevronLeft,
  suivant: ChevronRight,
  lienExterne: ExternalLink,
  uploader: Upload,
  camera: Camera,
  image: Image,
  grille: Grid3X3,
  liste: List,
  deconnexion: LogOut,
} as const

/* ── Statuts ─────────────────────────────────────────────────────────────── */
export const StatusIcons = {
  enAttente: Clock,
  enCours: Loader2,
  confirme: CheckCircle2,
  valide: CircleCheckBig,
  refuse: Ban,
  annule: XCircle,
  termine: CheckCircle2,
  expire: Timer,
  aCompleter: AlertTriangle,
  info: Info,
  succes: CheckCircle2,
  erreur: AlertTriangle,
  actualiser: RefreshCw,
} as const

/* ── Acteurs ─────────────────────────────────────────────────────────────── */
export const ActorIcons = {
  patient: User,
  pharmacie: Package,
  professionnel: Stethoscope,
  etablissement: Building2,
  mutuelle: ShieldCheck,
  ipm: Briefcase,
  assurance: Landmark,
  sante: HeartPulse,
  famille: Users,
  admin: Lock,
} as const

/* ── Contact / Coordonnées ───────────────────────────────────────────────── */
export const ContactIcons = {
  telephone: Phone,
  email: Mail,
  site: Globe,
  carte: Map,
  qrcode: QrCode,
  mobile: Smartphone,
} as const

/* ── Sécurité ────────────────────────────────────────────────────────────── */
export const SecurityIcons = {
  cadenas: Lock,
  voir: Eye,
  masquer: EyeOff,
  bouclier: ShieldCheck,
  bouclierOff: ShieldOff,
} as const

/* ── Finance ─────────────────────────────────────────────────────────────── */
export const FinanceIcons = {
  paiement: CreditCard,
  portefeuille: Wallet,
  tendance: TrendingUp,
} as const

/* ── Tailles normalisées d'icônes ────────────────────────────────────────── */
export const IconSize = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const

export type IconSizeKey = keyof typeof IconSize
