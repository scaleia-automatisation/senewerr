import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Sparkles, User, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner } from '@/components/ui/Banner';

type FormData = { motif: string; notes_cliniques: string; diagnostic: string; plan_traitement: string; resume_patient: string };

function calcAge(dob: string) { return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000); }
function toBase64(file: File): Promise<string> {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.readAsDataURL(file); });
}

export default function ConsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const audioRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appt, setAppt] = useState<any>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [lastAppts, setLastAppts] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ motif: '', notes_cliniques: '', diagnostic: '', plan_traitement: '', resume_patient: '' });

  const draftKey = `consultation_draft_${appointmentId}`;

  useEffect(() => {
    if (!appointmentId) return;
    (async () => {
      setLoading(true);
      const { data: apptData, error: err } = await supabase.from('appointments')
        .select('*, profiles:patient_id(first_name, last_name, date_of_birth, gender, phone)').eq('id', appointmentId).single();
      if (err) { setError(err.message); setLoading(false); return; }
      setAppt(apptData);

      const saved = localStorage.getItem(draftKey);
      const draft = saved ? JSON.parse(saved) : {};
      setForm(f => ({ ...f, motif: apptData.reason ?? '', ...draft }));

      const { data: consData } = await supabase.from('consultations').select('id').eq('appointment_id', appointmentId).maybeSingle();
      setConsultationId(consData?.id ?? null);

      if (apptData.patient_id) {
        const [{ data: apts }, { data: rxs }] = await Promise.all([
          supabase.from('appointments').select('starts_at, status, professionals(speciality)').eq('patient_id', apptData.patient_id).neq('id', appointmentId).order('starts_at', { ascending: false }).limit(3),
          supabase.from('prescriptions').select('id, signed_at, prescription_items(id)').eq('patient_id', apptData.patient_id).not('status', 'in', '(expired,cancelled)'),
        ]);
        setLastAppts(apts ?? []);
        setPrescriptions(rxs ?? []);
      }
      setLoading(false);
    })();
  }, [appointmentId]);

  useEffect(() => {
    const id = setInterval(() => {
      setSaving(true);
      localStorage.setItem(draftKey, JSON.stringify(form));
      setTimeout(() => setSaving(false), 600);
    }, 30000);
    return () => clearInterval(id);
  }, [form, draftKey]);

  const setField = useCallback((k: keyof FormData) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value })), []);

  const handleAiSummary = async () => {
    setAiLoading('summary');
    const { data } = await supabase.functions.invoke('ai-pre-consultation-summary', { body: { appointmentId } });
    setAiSummary(data?.summary ?? null);
    setAiLoading(null);
  };

  const handleTranscribe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAiLoading('transcribe');
    const audio = await toBase64(file);
    const { data } = await supabase.functions.invoke('ai-transcribe-consultation', { body: { consultationId, audio, filename: file.name } });
    if (data?.structured) setForm(f => ({ ...f, notes_cliniques: data.structured.notes ?? f.notes_cliniques, diagnostic: data.structured.diagnostic ?? f.diagnostic, plan_traitement: data.structured.plan ?? f.plan_traitement }));
    setAiLoading(null);
    if (audioRef.current) audioRef.current.value = '';
  };

  const handleGenerateReport = async () => {
    setAiLoading('report');
    const { data } = await supabase.functions.invoke('ai-generate-report', { body: { type: 'compte_rendu_consultation', consultationId, form } });
    if (data?.text) setForm(f => ({ ...f, resume_patient: data.text }));
    setAiLoading(null);
  };

  const handleFinish = async () => {
    setAiLoading('finish');
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('end-consultation', { body: { appointmentId, consultationId, ...form } });
    if (err) { setError(err.message); setAiLoading(null); return; }
    localStorage.removeItem(draftKey);
    navigate(`/pro/ordonnances/nouvelle?consultation=${data?.consultationId ?? consultationId}`);
  };

  const patient = appt?.profiles;

  return (
    <div className="flex gap-s-5 p-s-4 h-full">
      {/* Left — Patient context */}
      <div className="w-72 shrink-0 flex flex-col gap-s-4">
        {loading ? <Skeleton className="h-32" /> : patient && (
          <Card className="p-s-4">
            <div className="flex items-center gap-s-3 mb-s-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                {patient.first_name?.[0]}{patient.last_name?.[0]}
              </div>
              <div>
                <p className="text-ink font-semibold">{patient.first_name} {patient.last_name}</p>
                <p className="text-ink-3 text-xs">{patient.date_of_birth ? `${calcAge(patient.date_of_birth)} ans` : ''} {patient.gender ? `· ${patient.gender}` : ''}</p>
              </div>
            </div>
            {patient.phone && <p className="text-ink-2 text-sm">{patient.phone}</p>}
          </Card>
        )}

        <Card className="p-s-4">
          <div className="flex items-center justify-between mb-s-3">
            <h4 className="text-ink font-medium text-sm flex items-center gap-1"><Sparkles size={14} />Résumé IA</h4>
            <Button variant="ghost" onClick={handleAiSummary} loading={aiLoading === 'summary'} className="text-xs px-2 py-1">Générer</Button>
          </div>
          {aiSummary ? (
            <details open><summary className="text-primary text-xs cursor-pointer">Voir le résumé</summary>
              <p className="text-ink-2 text-xs mt-2 whitespace-pre-wrap">{aiSummary}</p>
            </details>
          ) : <p className="text-ink-3 text-xs">Cliquez sur Générer pour obtenir un résumé IA de ce patient.</p>}
        </Card>

        <Card className="p-s-4">
          <h4 className="text-ink font-medium text-sm mb-s-3">Derniers RDV</h4>
          {lastAppts.length === 0 ? <p className="text-ink-3 text-xs">Aucun antécédent</p> :
            lastAppts.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-line last:border-0">
                <span className="text-ink-2 text-xs">{new Date(a.starts_at).toLocaleDateString('fr-FR')}</span>
                <StatusPill status={a.status} />
              </div>
            ))}
        </Card>

        <Card className="p-s-4">
          <h4 className="text-ink font-medium text-sm mb-s-3 flex items-center gap-1"><FileText size={14} />Ordonnances actives</h4>
          {prescriptions.length === 0 ? <p className="text-ink-3 text-xs">Aucune ordonnance active</p> :
            prescriptions.map(rx => (
              <div key={rx.id} className="py-1 border-b border-line last:border-0">
                <p className="text-ink-2 text-xs font-medium">ORD-{rx.id.slice(-7).toUpperCase()}</p>
                <p className="text-ink-3 text-xs">{new Date(rx.signed_at).toLocaleDateString('fr-FR')} · {rx.prescription_items?.length ?? 0} médicament(s)</p>
              </div>
            ))}
        </Card>
      </div>

      {/* Right — Consultation form */}
      <div className="flex-1 flex flex-col gap-s-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-ink text-lg font-semibold">Consultation</h2>
          {saving && <span className="text-ink-3 text-xs">Sauvegarde...</span>}
        </div>
        {error && <Banner kind="warning">{error}</Banner>}

        {[
          { key: 'motif', label: 'Motif de consultation', rows: 2 },
          { key: 'notes_cliniques', label: 'Notes cliniques', rows: 4 },
          { key: 'diagnostic', label: 'Diagnostic', rows: 3 },
          { key: 'plan_traitement', label: 'Plan de traitement', rows: 3 },
        ].map(({ key, label, rows }) => (
          <div key={key}>
            <label className="block text-ink-2 text-sm mb-1">{label}</label>
            <textarea rows={rows} value={form[key as keyof FormData]} onChange={setField(key as keyof FormData)}
              className="w-full border border-line rounded-md p-s-3 text-ink text-sm bg-surface resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-ink-2 text-sm">Résumé patient (optionnel)</label>
            <Button variant="ghost" onClick={handleGenerateReport} loading={aiLoading === 'report'} className="text-xs px-2 py-1">
              <Sparkles size={12} className="mr-1" />Générer avec l'IA
            </Button>
          </div>
          <textarea rows={3} value={form.resume_patient} onChange={setField('resume_patient')}
            className="w-full border border-line rounded-md p-s-3 text-ink text-sm bg-surface resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div className="flex items-center gap-s-3 pt-s-2 flex-wrap">
          <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleTranscribe} />
          <Button variant="secondary" loading={aiLoading === 'transcribe'} onClick={() => audioRef.current?.click()}>
            <Mic size={14} className="mr-1" />Transcrire l'audio
          </Button>
          <Button variant="primary" loading={aiLoading === 'finish'} onClick={handleFinish}>
            Terminer la consultation
          </Button>
        </div>
      </div>
    </div>
  );
}
