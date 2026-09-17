import { useState } from 'react'
import { Plus, Search, Moon, Sun, Calendar, Pill } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { formatFCFA, formatFCFACompact, formatRelativeDateTime } from '@/lib/utils'
import {
  Button, IconButton, Input, Textarea, PhoneInput, OTPInput, Select, Switch,
  Badge, StatusPill, Card, CardHeader, CardTitle, CardDescription, CardContent,
  ActionTile, Avatar, OrgLogo, Spinner, Skeleton, SkeletonLines, EmptyState,
  Banner, Modal, Tabs, TabsList, TabsTrigger, TabsContent, Separator, Timeline,
  Stepper, KpiTile, CodeDisplay, NotificationItem, SearchBar, SlotPicker, Table,
  BarChart, LineChart, DonutChart, Gauge,
} from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-s-4 border-b border-line py-s-6">
      <h2 className="font-display text-h2 font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-s-4">{children}</div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-s-3">{children}</div>
}

const CHART_DATA = [
  { label: 'Lun', value: 12 }, { label: 'Mar', value: 19 }, { label: 'Mer', value: 8 },
  { label: 'Jeu', value: 22 }, { label: 'Ven', value: 17 }, { label: 'Sam', value: 25 },
]

export default function DesignSystemPage() {
  const { toggle } = useTheme()
  const [modalOpen, setModalOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [slot, setSlot] = useState<string>()

  return (
    <div className="mx-auto min-h-screen max-w-container bg-bg px-s-5 py-s-6">
      <header className="mb-s-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-display font-semibold text-ink">Design System</h1>
          <p className="text-body text-ink-2">Medikool — « Kool Clinic » · usage interne</p>
        </div>
        <IconButton aria-label="Basculer le thème" variant="secondary" onClick={toggle}>
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
        </IconButton>
      </header>

      <Section title="Couleurs">
        <Row>
          {['bg', 'surface', 'surface-2', 'primary', 'primary-soft', 'accent', 'accent-soft'].map(c => (
            <div key={c} className="flex flex-col items-center gap-s-1">
              <div className={`h-14 w-14 rounded-md border border-line bg-${c}`} />
              <span className="text-micro text-ink-3">{c}</span>
            </div>
          ))}
        </Row>
        <Row>
          {(['success', 'pending', 'progress', 'danger', 'neutral'] as const).map(s => (
            <StatusPill key={s} status={s} label={s} />
          ))}
        </Row>
      </Section>

      <Section title="Typographie">
        <p className="font-display text-display font-semibold text-ink">Display · Fraunces</p>
        <p className="font-display text-h1 font-semibold text-ink">Titre H1</p>
        <p className="text-h2 font-semibold text-ink">Titre H2</p>
        <p className="text-body text-ink">Corps · Inter Tight — lisible sur mobile.</p>
        <p className="text-small text-ink-2">Small · texte secondaire</p>
        <p className="text-micro text-ink-3">Micro · méta</p>
        <p className="text-body tabular-nums text-ink">{formatFCFA(4000)} · {formatFCFACompact(1200000)}</p>
        <p className="text-body text-ink">{formatRelativeDateTime(new Date())}</p>
      </Section>

      <Section title="Boutons — états">
        <Row>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="accent">Accent</Button>
        </Row>
        <Row>
          <Button loading>Chargement</Button>
          <Button disabled>Désactivé</Button>
          <Button leftIcon={<Plus className="h-4 w-4" />}>Avec icône</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row>
          <IconButton aria-label="Ajouter"><Plus className="h-5 w-5" /></IconButton>
          <IconButton aria-label="Rechercher" variant="secondary"><Search className="h-5 w-5" /></IconButton>
        </Row>
      </Section>

      <Section title="Champs">
        <div className="grid max-w-md gap-s-4">
          <Input label="Nom complet" placeholder="Mamadou Diop" />
          <Input label="Montant" suffix="FCFA" placeholder="4 000" />
          <Input label="Email" error="Adresse invalide" defaultValue="abc" />
          <PhoneInput label="Téléphone" />
          <Textarea label="Message" placeholder="Votre message…" />
          <Select label="Spécialité" options={[{ value: 'cardio', label: 'Cardiologie' }, { value: 'derma', label: 'Dermatologie' }]} />
          <div className="flex flex-col gap-s-2">
            <span className="text-small font-medium text-ink-2">Code (OTP)</span>
            <OTPInput length={4} value={otp} onChange={setOtp} />
          </div>
          <Switch label="Téléconsultation" description="Activer les rendez-vous vidéo" />
          <SearchBar smart placeholder="Recherche intelligente…" />
        </div>
      </Section>

      <Section title="Cartes & tuiles">
        <div className="grid gap-s-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Carte standard</CardTitle>
              <CardDescription>Description secondaire</CardDescription>
            </CardHeader>
            <CardContent><p className="text-body text-ink-2">Contenu de la carte.</p></CardContent>
          </Card>
          <Card variant="highlight">
            <CardTitle>Carte mise en avant</CardTitle>
          </Card>
          <ActionTile icon={<Calendar className="h-6 w-6" />} label="Prendre rendez-vous" />
          <ActionTile icon={<Pill className="h-6 w-6" />} label="Trouver un médicament" />
        </div>
      </Section>

      <Section title="Statuts, badges & code">
        <Row>
          <Badge>Neutre</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Succès</Badge>
        </Row>
        <CodeDisplay code="4827" label="Code de retrait" />
      </Section>

      <Section title="Avatars & logos">
        <Row>
          <Avatar fallback="Mamadou Diop" size="sm" />
          <Avatar fallback="Aminata Ndiaye" size="md" />
          <Avatar fallback="Ousmane Fall" size="lg" />
          <OrgLogo name="Clinique Kër Santé" size="lg" />
        </Row>
      </Section>

      <Section title="Créneaux (SlotPicker)">
        <SlotPicker
          value={slot}
          onSelect={setSlot}
          slots={[
            { time: '09:00', state: 'available' },
            { time: '09:30', state: 'available' },
            { time: '10:00', state: 'full' },
            { time: '10:30', state: 'unavailable' },
            { time: '11:00', state: 'available' },
          ]}
        />
      </Section>

      <Section title="Parcours (Stepper)">
        <Stepper steps={['Ordonnance', 'Pharmacie', 'Paiement', 'Retrait']} current={2} />
      </Section>

      <Section title="Timeline">
        <Timeline
          items={[
            { id: '1', status: 'success', title: 'Réservation acceptée', meta: 'aujourd\'hui 09:12' },
            { id: '2', status: 'progress', title: 'En préparation', meta: 'aujourd\'hui 10:40' },
            { id: '3', status: 'neutral', title: 'Prête au retrait', meta: 'à venir' },
          ]}
        />
      </Section>

      <Section title="Métriques">
        <div className="grid gap-s-4 sm:grid-cols-3">
          <KpiTile label="Rendez-vous" value="128" countTo={128} variation={12} sparkline={[4, 8, 6, 12, 9, 14]} />
          <KpiTile label="Revenus" value={formatFCFACompact(1250000)} variation={-4} />
          <KpiTile label="Taux de retrait" value="92%" />
        </div>
        <div className="grid gap-s-4 md:grid-cols-2">
          <Card><CardTitle>Barres</CardTitle><CardContent><BarChart data={CHART_DATA} /></CardContent></Card>
          <Card><CardTitle>Ligne</CardTitle><CardContent><LineChart data={CHART_DATA} /></CardContent></Card>
          <Card><CardTitle>Donut</CardTitle><CardContent><DonutChart data={CHART_DATA.slice(0, 4)} /></CardContent></Card>
          <Card className="flex items-center justify-center"><Gauge value={92} label="Retraits" /></Card>
        </div>
      </Section>

      <Section title="Onglets">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Aujourd'hui</TabsTrigger>
            <TabsTrigger value="b">Semaine</TabsTrigger>
            <TabsTrigger value="c">Mois</TabsTrigger>
          </TabsList>
          <TabsContent value="a"><p className="text-body text-ink-2">Contenu du jour.</p></TabsContent>
          <TabsContent value="b"><p className="text-body text-ink-2">Contenu de la semaine.</p></TabsContent>
          <TabsContent value="c"><p className="text-body text-ink-2">Contenu du mois.</p></TabsContent>
        </Tabs>
      </Section>

      <Section title="Bannières & notifications">
        <Banner kind="info">Nouvelle version disponible.</Banner>
        <Banner kind="warning">Maintenance prévue dimanche 22 h.</Banner>
        <Banner kind="offline">Connexion perdue — mode lecture seule.</Banner>
        <div className="max-w-md rounded-lg border border-line bg-surface">
          <NotificationItem title="Rendez-vous confirmé" body="Dr Ndiaye · aujourd'hui 15:00" time="il y a 5 min" onDismiss={() => {}} />
          <NotificationItem title="Réservation prête" body="Pharmacie Liberté" time="il y a 1 h" read onDismiss={() => {}} />
        </div>
      </Section>

      <Section title="Tableau (responsive)">
        <Table
          rowKey={r => r.id}
          columns={[
            { key: 'ref', header: 'Référence', render: r => r.ref },
            { key: 'patient', header: 'Patient', render: r => r.patient },
            { key: 'statut', header: 'Statut', render: r => <StatusPill status={r.kind} label={r.statut} /> },
          ]}
          rows={[
            { id: '1', ref: 'MED-45872', patient: 'M. Diop', statut: 'Prête', kind: 'success' as const },
            { id: '2', ref: 'MED-45873', patient: 'A. Ndiaye', statut: 'En cours', kind: 'progress' as const },
          ]}
        />
      </Section>

      <Section title="États de chargement / vide">
        <div className="flex flex-wrap gap-s-4">
          <Spinner />
          <div className="w-64"><SkeletonLines lines={3} /></div>
          <Skeleton className="h-24 w-40" />
        </div>
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="Aucun rendez-vous à venir"
          description="Prenez rendez-vous avec un médecin près de chez vous."
          action={<Button>Trouver un médecin</Button>}
        />
      </Section>

      <Section title="Modale">
        <Button onClick={() => setModalOpen(true)}>Ouvrir la modale</Button>
        <Modal open={modalOpen} onOpenChange={setModalOpen} title="Confirmer le retrait" description="Saisissez le code fourni au patient.">
          <div className="flex flex-col gap-s-4">
            <OTPInput length={4} />
            <Separator />
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button onClick={() => setModalOpen(false)}>Confirmer</Button>
            </div>
          </div>
        </Modal>
      </Section>
    </div>
  )
}
