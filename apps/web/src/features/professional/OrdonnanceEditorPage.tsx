import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, AlertTriangle, Pill, QrCode, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

// ── Mini-dataset médicaments sénégalais ────────────────────────────────────────
const MED_DATASET: string[] = [
  'Paracétamol 500mg', 'Paracétamol 1000mg',
  'Ibuprofène 400mg',
  'Amoxicilline 500mg', 'Amoxicilline 1g',
  'Amoxicilline/Acide clavulanique 500mg/125mg',
  'Cotrimoxazole 480mg', 'Cotrimoxazole 960mg',
  'Métronidazole 250mg', 'Métronidazole 500mg',
  'Chloroquine 100mg', 'Chloroquine 150mg',
  'Arteméther/Luméfantrine 20mg/120mg (Coartem)',
  'Artésunate 50mg', 'Artésunate 200mg',
  'Quinine 300mg',
  'Doxycycline 100mg',
  'Ciprofloxacine 500mg',
  'Azithromycine 250mg', 'Azithromycine 500mg',
  'Céfixime 200mg', 'Céfixime 400mg',
  'Oméprazole 20mg', 'Oméprazole 40mg',
  'Metformine 500mg', 'Metformine 850mg', 'Metformine 1000mg',
  'Glibenclamide 2.5mg', 'Glibenclamide 5mg',
  'Captopril 25mg', 'Captopril 50mg',
  'Amlodipine 5mg', 'Amlodipine 10mg',
  'Hydrochlorothiazide 25mg',
  'Furosémide 40mg',
  'Losartan 50mg', 'Losartan 100mg',
  'Atorvastatine 10mg', 'Atorvastatine 20mg',
  'Acide acétylsalicylique 100mg',
  'Diclofénac 50mg', 'Diclofénac 75mg',
  'Tramadol 50mg', 'Tramadol 100mg',
  'Prednisolone 5mg',
  'Dexaméthasone 0.5mg', 'Dexaméthasone 4mg',
  'Salbutamol 100mcg/dose',
  'Beclométhasone 250mcg/dose',
  'Fer + Acide folique 200mg/0.4mg',
  'Vitamine C 500mg',
  'Zinc 20mg',
  'Albendazole 400mg',
  'Mébendazole 500mg',
  'Ivermectine 3mg', 'Ivermectine 6mg',
  'Fluconazole 150mg',
  'Nystatine 500 000 UI',
  'Pénicilline V 500mg',
  'Benzathine pénicilline 1.2M UI',
  'Ranitidine 150mg',
  'Morphine 10mg',
  'Codéine 30mg',
]

interface Medicament {
  id: string
  nom: string
  dosage: string
  posologie: string
  duree: string
  quantite: string
  instructions: string
}

interface PatientInfo {
  id: string
  nom: string
  allergies: string[]
}

function MedRow({
  med, index, onChange, onRemove, allergenesDetectes,
}: {
  med: Medicament
  index: number
  onChange: (id: string, field: keyof Medicament, val: string) => void
  onRemove: (id: string) => void
  allergenesDetectes: string[]
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSugg, setShowSugg] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNomChange = (val: string) => {
    onChange(med.id, 'nom', val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (val.length >= 2) {
        const v = val.toLowerCase()
        const res = MED_DATASET.filter(m => m.toLowerCase().includes(v)).slice(0, 8)
        setSuggestions(res)
        setShowSugg(res.length > 0)
      } else {
        setSuggestions([])
        setShowSugg(false)
      }
    }, 150)
  }

  const isAllergen = allergenesDetectes.some(a =>
    med.nom.toLowerCase().includes(a.toLowerCase())
  )

  return (
    <div className={`relative rounded-lg border p-s-3 flex flex-col gap-s-2 ${isAllergen ? 'border-danger bg-danger/5' : 'border-line'}`}>
      {isAllergen && (
        <div className="flex items-center gap-s-2 rounded-md bg-danger/10 px-s-2 py-s-1">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <span className="text-micro text-danger font-medium">
            Allergie détectée — vérifier avant prescription
          </span>
        </div>
      )}

      <div className="flex items-start gap-s-2">
        <span className="mt-s-2 w-5 shrink-0 text-center text-micro text-ink-3 font-semibold">{index + 1}</span>

        {/* Médicament + autocomplete */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={med.nom}
            onChange={e => handleNomChange(e.target.value)}
            onFocus={() => { if (suggestions.length) setShowSugg(true) }}
            onBlur={() => setTimeout(() => setShowSugg(false), 200)}
            placeholder="Nom du médicament…"
            className={`w-full rounded-lg border px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none ${isAllergen ? 'border-danger focus:border-danger' : 'border-line focus:border-primary'}`}
          />
          <AnimatePresence>
            {showSugg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-50 mt-s-1 w-full rounded-lg border border-line bg-surface shadow-lg overflow-hidden"
              >
                {suggestions.map(s => (
                  <button key={s} type="button"
                    className="w-full px-s-3 py-s-2 text-left text-small hover:bg-surface-2 transition-colors"
                    onMouseDown={() => {
                      onChange(med.id, 'nom', s)
                      setShowSugg(false)
                    }}
                  >{s}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => onRemove(med.id)}
          className="mt-s-1 rounded p-s-1 text-ink-3 hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-s-2 pl-7">
        <input value={med.dosage} onChange={e => onChange(med.id, 'dosage', e.target.value)}
          placeholder="Dosage (ex: 1 comprimé)"
          className="rounded-lg border border-line px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
        <input value={med.posologie} onChange={e => onChange(med.id, 'posologie', e.target.value)}
          placeholder="Posologie (ex: 3×/jour)"
          className="rounded-lg border border-line px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
        <input value={med.duree} onChange={e => onChange(med.id, 'duree', e.target.value)}
          placeholder="Durée (ex: 7 jours)"
          className="rounded-lg border border-line px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
        <input value={med.quantite} onChange={e => onChange(med.id, 'quantite', e.target.value)}
          placeholder="Quantité (ex: 2 boîtes)"
          className="rounded-lg border border-line px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
      </div>

      <div className="pl-7">
        <input value={med.instructions} onChange={e => onChange(med.id, 'instructions', e.target.value)}
          placeholder="Instructions spéciales (optionnel)"
          className="w-full rounded-lg border border-line px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
      </div>
    </div>
  )
}

function newMed(): Medicament {
  return { id: crypto.randomUUID(), nom: '', dosage: '', posologie: '', duree: '', quantite: '', instructions: '' }
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function OrdonnanceEditorPage() {
  const { profile } = useAuth()
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()

  const patientIdParam     = searchParams.get('patient')
  const consultationIdParam = searchParams.get('consultation')
  const diagnosticParam    = searchParams.get('diagnostic')

  const [patients, setPatients] = useState<PatientInfo[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdParam ?? '')
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null)
  const [meds, setMeds] = useState<Medicament[]>([newMed()])
  const [notes, setNotes] = useState('')
  const [dureeValidite, setDureeValidite] = useState('30')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{
    ordonnance_id: string
    qr_data_url: string | null
    qr_token: string
    date_expiration: string
  } | null>(null)
  const [showPdf, setShowPdf] = useState(false)

  const db = supabase as any

  // Load patients list
  useEffect(() => {
    if (!profile?.id) return
    db.from('praticien_patients')
      .select('patient_id, patient:patient_id ( id, full_name )')
      .eq('praticien_id', profile.id)
      .eq('actif', true)
      .then(({ data }: any) => {
        const pts: PatientInfo[] = (data ?? []).map((r: any) => ({
          id:        r.patient?.id ?? r.patient_id,
          nom:       r.patient?.full_name ?? '—',
          allergies: [],
        }))
        setPatients(pts)
      })
  }, [profile?.id])

  // Load selected patient allergies
  useEffect(() => {
    if (!selectedPatientId) { setSelectedPatient(null); return }
    const fromList = patients.find(p => p.id === selectedPatientId)
    if (fromList) {
      // Load allergies from dossier
      db.from('dossiers_medicaux')
        .select('allergies')
        .eq('patient_id', selectedPatientId)
        .maybeSingle()
        .then(({ data }: any) => {
          setSelectedPatient({
            ...fromList,
            allergies: data?.allergies ?? [],
          })
        })
    }
  }, [selectedPatientId, patients])

  // Allergènes détectés dans la liste de médicaments
  const allergenesDetectes = selectedPatient?.allergies ?? []

  function addMed() { setMeds(m => [...m, newMed()]) }
  function removeMed(id: string) { setMeds(m => m.filter(x => x.id !== id)) }
  function changeMed(id: string, field: keyof Medicament, val: string) {
    setMeds(m => m.map(x => x.id === id ? { ...x, [field]: val } : x))
  }

  const hasAllergyConflict = allergenesDetectes.length > 0 && meds.some(m =>
    allergenesDetectes.some(a => m.nom.toLowerCase().includes(a.toLowerCase()))
  )

  async function handleSubmit() {
    if (!selectedPatientId) { toast.error('Sélectionnez un patient'); return }
    const validMeds = meds.filter(m => m.nom.trim())
    if (validMeds.length === 0) { toast.error('Ajoutez au moins un médicament'); return }

    if (hasAllergyConflict) {
      const ok = window.confirm(
        'Attention : un ou plusieurs médicaments correspondent à des allergies connues du patient. Confirmer quand même ?'
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      const expDate = new Date(Date.now() + parseInt(dureeValidite) * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.functions.invoke('create-ordonnance', {
        body: {
          patient_id:       selectedPatientId,
          consultation_id:  consultationIdParam ?? null,
          medicaments:      validMeds.map(m => ({
            nom:          m.nom.trim(),
            dosage:       m.dosage.trim() || null,
            posologie:    m.posologie.trim() || null,
            duree:        m.duree.trim() || null,
            quantite:     m.quantite.trim() || null,
            instructions: m.instructions.trim() || null,
          })),
          notes:            notes.trim() || null,
          date_expiration:  expDate,
        },
      })

      if (error) throw error

      setResult(data)
      toast.success('Ordonnance créée et QR généré')
    } catch (e: any) {
      console.error(e)
      toast.error('Erreur lors de la création de l\'ordonnance')
    } finally {
      setSaving(false)
    }
  }

  function printPdf() {
    if (!result || !selectedPatient) return
    const drNom = profile?.full_name ? `Dr. ${profile.full_name}` : ''
    const validMeds = meds.filter(m => m.nom.trim())
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Ordonnance</title>
<style>
  @media print { @page { size: A4; margin: 2cm; } }
  body { font-family: Arial, sans-serif; font-size: 12pt; color: #111; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .dr { font-size: 16pt; font-weight: bold; color: #1A7A4C; }
  .titre { font-size: 18pt; font-weight: bold; text-align: center; margin: 16px 0; border-bottom: 2px solid #1A7A4C; padding-bottom: 8px; }
  .patient { background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 16px; }
  .med { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
  .med-nom { font-weight: bold; font-size: 13pt; }
  .med-info { color: #444; margin-top: 2px; }
  .notes { margin-top: 16px; padding: 8px; border-left: 3px solid #1A7A4C; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .signature { text-align: right; }
  .qr-section { text-align: center; margin-top: 16px; }
  .qr-section img { width: 100px; height: 100px; }
  .expire { color: #666; font-size: 10pt; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="dr">${drNom}</div>
    <div>Médecin — Sénégal</div>
  </div>
  <div style="text-align:right">
    <div>Date : ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}</div>
  </div>
</div>

<div class="titre">ORDONNANCE MÉDICALE</div>

<div class="patient">
  <strong>Patient :</strong> ${selectedPatient.nom}
  ${selectedPatient.allergies.length > 0 ? `<br/><strong style="color:#d00">Allergies :</strong> ${selectedPatient.allergies.join(', ')}` : ''}
</div>

${validMeds.map((m, i) => `
<div class="med">
  <div class="med-nom">${i + 1}. ${m.nom}</div>
  ${m.dosage ? `<div class="med-info">Dosage : ${m.dosage}</div>` : ''}
  ${m.posologie ? `<div class="med-info">Posologie : ${m.posologie}</div>` : ''}
  ${m.duree ? `<div class="med-info">Durée : ${m.duree}</div>` : ''}
  ${m.quantite ? `<div class="med-info">Quantité : ${m.quantite}</div>` : ''}
  ${m.instructions ? `<div class="med-info"><em>${m.instructions}</em></div>` : ''}
</div>
`).join('')}

${notes ? `<div class="notes"><strong>Notes :</strong> ${notes}</div>` : ''}

<div class="footer">
  <div class="qr-section">
    ${result.qr_data_url ? `<img src="${result.qr_data_url}" alt="QR code" /><br/>` : ''}
    <div class="expire">Valide jusqu'au ${format(new Date(result.date_expiration), 'dd/MM/yyyy', { locale: fr })}</div>
  </div>
  <div class="signature">
    <br/><br/>
    <div style="border-top: 1px solid #111; padding-top: 4px; min-width: 150px">
      Signature et cachet
    </div>
  </div>
</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.print()
    }
  }

  // ── Result view (après création) ─────────────────────────────────────────
  if (result) {
    return (
      <div className="flex flex-col items-center gap-s-6 p-s-6 max-w-lg mx-auto">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <Pill className="h-8 w-8 text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-h3 font-semibold text-ink">Ordonnance créée</h2>
          <p className="mt-s-1 text-small text-ink-3">
            Valide jusqu'au {format(new Date(result.date_expiration), 'dd MMMM yyyy', { locale: fr })}
          </p>
        </div>

        {/* QR Code */}
        <div className="rounded-xl border border-line p-s-4 bg-surface flex flex-col items-center gap-s-3">
          {result.qr_data_url ? (
            <img src={result.qr_data_url} alt="QR code ordonnance" className="h-56 w-56 rounded-lg" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-line bg-surface-2">
              <QrCode className="h-12 w-12 text-ink-3 opacity-40" />
            </div>
          )}
          <p className="text-micro text-ink-3 text-center max-w-xs">
            Le pharmacien scanne ce QR pour valider l'ordonnance.
            Le code est signé et sécurisé côté serveur.
          </p>
        </div>

        <div className="flex flex-wrap gap-s-2 justify-center">
          <Button variant="primary" onClick={printPdf}>
            Imprimer PDF
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/pro/ordonnances/${result.ordonnance_id}`)}>
            Voir le détail
          </Button>
          <Button variant="ghost" onClick={() => navigate('/pro/ordonnances')}>
            Liste ordonnances
          </Button>
        </div>
      </div>
    )
  }

  // ── Editor view ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6 max-w-3xl mx-auto">
      <h1 className="text-h3 font-semibold text-ink">Nouvelle ordonnance</h1>

      {/* Patient */}
      <Card className="p-s-4 flex flex-col gap-s-3">
        <h2 className="text-small font-semibold text-ink">Patient</h2>
        <select
          value={selectedPatientId}
          onChange={e => setSelectedPatientId(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none"
        >
          <option value="">Sélectionner un patient…</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>

        {selectedPatient && selectedPatient.allergies.length > 0 && (
          <div className="flex items-start gap-s-2 rounded-lg bg-danger/10 p-s-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
            <div>
              <p className="text-small font-medium text-danger">Allergies connues</p>
              <p className="text-micro text-danger/80">{selectedPatient.allergies.join(' · ')}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Médicaments */}
      <Card className="p-s-4 flex flex-col gap-s-3">
        <h2 className="text-small font-semibold text-ink">Médicaments</h2>

        {meds.map((m, i) => (
          <MedRow
            key={m.id}
            med={m}
            index={i}
            onChange={changeMed}
            onRemove={removeMed}
            allergenesDetectes={allergenesDetectes}
          />
        ))}

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={addMed}
        >
          Ajouter un médicament
        </Button>
      </Card>

      {/* Notes + Durée validité */}
      <Card className="p-s-4 flex flex-col gap-s-3">
        <h2 className="text-small font-semibold text-ink">Informations complémentaires</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes pour le pharmacien ou le patient…"
          rows={3}
          className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none resize-none"
        />
        <div className="flex items-center gap-s-3">
          <label className="text-small text-ink-3 whitespace-nowrap">Validité :</label>
          <select
            value={dureeValidite}
            onChange={e => setDureeValidite(e.target.value)}
            className="rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none"
          >
            <option value="7">7 jours</option>
            <option value="14">14 jours</option>
            <option value="30">30 jours (défaut)</option>
            <option value="60">60 jours</option>
            <option value="90">90 jours</option>
          </select>
        </div>
      </Card>

      {/* Allergie globale warning */}
      {hasAllergyConflict && (
        <div className="flex items-center gap-s-2 rounded-lg border border-danger bg-danger/10 p-s-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
          <p className="text-small text-danger font-medium">
            Un ou plusieurs médicaments correspondent à des allergies connues du patient.
            Vérifiez avant de valider.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-s-2">
        <Button variant="ghost" onClick={() => navigate(-1)}>Annuler</Button>
        <Button
          variant="primary"
          leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Génération…' : 'Créer et générer QR'}
        </Button>
      </div>
    </div>
  )
}
