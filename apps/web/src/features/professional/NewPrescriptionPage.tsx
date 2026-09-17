import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Plus, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Banner } from '@/components/ui/Banner';
import { Skeleton } from '@/components/ui/Skeleton';

const FORM_OPTS = ['comprimé','gélule','sirop','crème','pommade','injection','spray','suppositoire','autre'].map(f => ({ label: f, value: f }));
const DEFAULT_VALID = () => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString().slice(0,10); };
type Item = { medicine_name: string; dosage: string; form: string; quantity: string; frequency: string; duration_days: string; renewal_allowed: boolean };
const emptyItem = (): Item => ({ medicine_name: '', dosage: '', form: 'comprimé', quantity: '1', frequency: '', duration_days: '', renewal_allowed: false });

function calcAge(dob: string) { return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000); }

export default function NewPrescriptionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const consultationParam = searchParams.get('consultation');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [validUntil, setValidUntil] = useState(DEFAULT_VALID());
  const [success, setSuccess] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    if (!consultationParam || !profile?.id) return;
    (async () => {
      setLoading(true);
      const [{ data: consData }, { data: proData }] = await Promise.all([
        supabase.from('consultations').select('patient_id, profiles:patient_id(first_name, last_name, date_of_birth)').eq('id', consultationParam).single(),
        supabase.from('professionals').select('id').eq('profile_id', profile.id).single(),
      ]);
      if (consData) {
        setPatientId(consData.patient_id);
        setPatient(consData.profiles);
      }
      if (proData) setProId(proData.id);
      setLoading(false);
    })();
  }, [consultationParam, profile?.id]);

  const setItem = (i: number, field: keyof Item, value: string | boolean) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!patientId || !proId || !consultationParam) { setError('Données manquantes.'); return; }
    setSubmitting(true); setError(null);
    try {
      const { data: rx, error: rxErr } = await supabase.from('prescriptions').insert({
        patient_id: patientId, professional_id: proId, consultation_id: consultationParam,
        status: 'draft', valid_until: validUntil,
      }).select('id').single();
      if (rxErr || !rx) throw new Error(rxErr?.message ?? 'Erreur création ordonnance');

      const itemRows = items.map(it => ({
        prescription_id: rx.id, medicine_name: it.medicine_name, dosage: it.dosage,
        form: it.form, quantity: Number(it.quantity), frequency: it.frequency,
        duration_days: it.duration_days ? Number(it.duration_days) : null,
        renewal_allowed: it.renewal_allowed,
      }));
      const { error: itemErr } = await supabase.from('prescription_items').insert(itemRows);
      if (itemErr) throw new Error(itemErr.message);

      const { error: signErr } = await supabase.functions.invoke('sign-prescription', { body: { prescriptionId: rx.id } });
      if (signErr) throw new Error(signErr.message);

      setSuccess({ id: rx.id, number: `ORD-${rx.id.slice(-7).toUpperCase()}` });
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  };

  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : '…';
  const patientAge = patient?.date_of_birth ? ` (${calcAge(patient.date_of_birth)} ans)` : '';

  if (loading) return <div className="p-s-5"><Skeleton className="h-8 w-64 mb-s-4" /><Skeleton className="h-48 w-full" /></div>;

  if (success) return (
    <div className="p-s-5 max-w-lg mx-auto flex flex-col items-center gap-s-4 pt-16">
      <CheckCircle size={48} className="text-status-success" />
      <h2 className="text-ink text-xl font-semibold">Ordonnance signée</h2>
      <p className="text-ink-2">Numéro : <span className="font-mono font-semibold">{success.number}</span></p>
      <div className="flex flex-col gap-s-3 w-full">
        <Button variant="primary" fullWidth onClick={() => navigate(`/pro/ordonnances/${success.id}`)}>Voir l'ordonnance</Button>
        <Button variant="secondary" fullWidth onClick={() => { setSuccess(null); setItems([emptyItem()]); setValidUntil(DEFAULT_VALID()); }}>Nouvelle ordonnance</Button>
        <Button variant="ghost" fullWidth onClick={() => navigate('/pro/agenda')}>Retour à l'agenda</Button>
      </div>
    </div>
  );

  return (
    <div className="p-s-4 max-w-2xl mx-auto flex flex-col gap-s-4">
      <div>
        <h1 className="text-ink text-lg font-semibold">Nouvelle ordonnance</h1>
        <p className="text-ink-2 text-sm">Pour : <span className="font-medium">{patientName}{patientAge}</span></p>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}

      <div className="flex flex-col gap-s-3">
        {items.map((item, i) => (
          <Card key={i} className="p-s-4">
            <div className="flex items-start justify-between mb-s-3">
              <h3 className="text-ink font-medium text-sm">Médicament {i + 1}</h3>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="text-status-danger hover:opacity-70">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-s-3">
              <div className="col-span-2">
                <Input label="Médicament" value={item.medicine_name} onChange={e => setItem(i, 'medicine_name', e.target.value)} placeholder="Nom du médicament" />
              </div>
              <Input label="Dosage" value={item.dosage} onChange={e => setItem(i, 'dosage', e.target.value)} placeholder="ex: 500mg" />
              <Select label="Forme" options={FORM_OPTS} value={item.form} onChange={v => setItem(i, 'form', v)} />
              <Input label="Quantité" type="number" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
              <Input label="Fréquence" value={item.frequency} onChange={e => setItem(i, 'frequency', e.target.value)} placeholder="ex: 3x/jour" />
              <div className="col-span-2">
                <Input label="Durée (jours)" type="number" value={item.duration_days} onChange={e => setItem(i, 'duration_days', e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-s-2 mt-s-3 cursor-pointer">
              <input type="checkbox" checked={item.renewal_allowed} onChange={e => setItem(i, 'renewal_allowed', e.target.checked)}
                className="w-4 h-4 accent-primary" />
              <span className="text-ink-2 text-sm">Renouvellement autorisé</span>
            </label>
          </Card>
        ))}
      </div>

      <Button variant="secondary" onClick={addItem}>
        <Plus size={14} className="mr-1" />Ajouter un médicament
      </Button>

      <div>
        <Input label="Valable jusqu'au" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
      </div>

      <div className="flex gap-s-3 justify-end pt-s-2">
        <Link to="/pro/agenda"><Button variant="ghost">Annuler</Button></Link>
        <Button variant="primary" loading={submitting} onClick={handleSubmit}>
          Signer et publier l'ordonnance
        </Button>
      </div>
    </div>
  );
}
