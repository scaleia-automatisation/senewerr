import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner } from '@/components/ui/Banner';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 27 }, (_, i) => {
  const h = 7 + Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});
const DAY_OPTS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map((l, i) => ({ label: l, value: String(i + 1) }));
const DURATION_OPTS = [15, 20, 30, 45, 60].map(d => ({ label: `${d} min`, value: String(d) }));

function getWeekBounds(offset = 0) {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mon = new Date(now); mon.setDate(now.getDate() - day + offset * 7); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
  return { start: mon, end: sun, days: Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; }) };
}

export default function AgendaPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [proId, setProId] = useState<string | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [apptDetail, setApptDetail] = useState<any>(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ dayOfWeek: '1', startTime: '08:00', endTime: '18:00', slotDuration: '30', breakStart: '', breakEnd: '', validFrom: new Date().toISOString().slice(0,10) });
  const [scheduleResult, setScheduleResult] = useState<any>(null);

  const { start, end, days } = getWeekBounds(weekOffset);
  const today = new Date(); today.setHours(0,0,0,0);

  const fetchPro = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('professionals').select('id').eq('profile_id', profile.id).single();
    setProId(data?.id ?? null);
  }, [profile?.id]);

  const fetchSlots = useCallback(async () => {
    if (!proId) return;
    setLoading(true);
    const { data, error: err } = await supabase.from('appointment_slots')
      .select('*, appointments(id, status, reason, type, starts_at, patient_id, profiles:patient_id(first_name, last_name, date_of_birth))')
      .eq('professional_id', proId).gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString());
    if (err) setError(err.message); else setSlots(data ?? []);
    setLoading(false);
  }, [proId, start, end]);

  useEffect(() => { fetchPro(); }, [fetchPro]);
  useEffect(() => { if (proId) fetchSlots(); }, [proId, fetchSlots]);

  useEffect(() => {
    if (!selectedApptId) { setApptDetail(null); return; }
    supabase.from('appointments').select('*, profiles:patient_id(first_name, last_name, date_of_birth, phone), prescriptions(id)')
      .eq('id', selectedApptId).single().then(({ data }) => setApptDetail(data));
  }, [selectedApptId]);

  const handleStartConsultation = async () => {
    setActionLoading(true);
    await supabase.functions.invoke('start-consultation', { body: { appointmentId: selectedApptId } });
    setActionLoading(false);
    navigate(`/pro/consultation/${selectedApptId}`);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    await supabase.functions.invoke('cancel-appointment', { body: { appointmentId: selectedApptId } });
    setActionLoading(false); setCancelModal(false); setSelectedApptId(null); fetchSlots();
  };

  const handleScheduleSubmit = async () => {
    setActionLoading(true);
    const { data } = await supabase.functions.invoke('schedule-add', { body: scheduleForm });
    setScheduleResult(data); setActionLoading(false);
  };

  const slotMap: Record<string, any[]> = {};
  slots.forEach(s => {
    const key = `${new Date(s.starts_at).toDateString()}_${new Date(s.starts_at).toTimeString().slice(0,5)}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(s);
  });

  return (
    <div className="flex flex-col gap-s-4 p-s-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-s-3">
          <Button variant="ghost" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft size={16} /></Button>
          <span className="text-ink font-medium">{start.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} – {end.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</span>
          <Button variant="ghost" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight size={16} /></Button>
          <Button variant="ghost" onClick={() => setWeekOffset(0)} className="text-primary text-sm">Aujourd'hui</Button>
        </div>
        <Button variant="secondary" onClick={() => { setScheduleModal(true); setScheduleResult(null); }}>
          <Plus size={14} className="mr-1" /> Configurer horaires
        </Button>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}

      <div className="flex gap-s-4">
        <div className="flex-1 overflow-auto border border-line rounded-md">
          <div className="grid grid-cols-8 border-b border-line">
            <div className="p-s-2 text-ink-3 text-xs" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} className={`p-s-2 text-center text-xs font-medium ${isToday ? 'text-primary bg-primary/10' : 'text-ink-2'}`}>
                  <div>{DAYS[i]}</div>
                  <div className={`text-base ${isToday ? 'text-primary font-bold' : 'text-ink'}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {loading ? <Skeleton className="h-64 w-full" /> : HOURS.map(time => (
            <div key={time} className="grid grid-cols-8 border-b border-line min-h-[2.5rem]">
              <div className="p-s-2 text-ink-3 text-xs text-right pr-2">{time}</div>
              {days.map((d, i) => {
                const key = `${d.toDateString()}_${time}`;
                const daySlots = slotMap[key] ?? [];
                return (
                  <div key={i} className="border-l border-line p-0.5">
                    {daySlots.map((s, si) => {
                      const appt = s.appointments?.[0];
                      if (appt) {
                        const name = `${appt.profiles?.first_name ?? ''} ${appt.profiles?.last_name ?? ''}`.trim();
                        return (
                          <button key={si} onClick={() => setSelectedApptId(appt.id)}
                            className="w-full text-left bg-primary/15 border border-primary/40 rounded p-0.5 text-xs text-primary truncate hover:bg-primary/25">
                            {name || 'Patient'}
                          </button>
                        );
                      }
                      return <div key={si} className="w-full h-full border border-dashed border-green-300/50 rounded opacity-60" />;
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {apptDetail && (
          <Card className="w-72 p-s-4 flex flex-col gap-s-3 shrink-0">
            <div className="flex items-start justify-between">
              <h3 className="text-ink font-semibold">{apptDetail.profiles?.first_name} {apptDetail.profiles?.last_name}</h3>
              <button onClick={() => setSelectedApptId(null)}><X size={16} className="text-ink-3" /></button>
            </div>
            {apptDetail.profiles?.date_of_birth && <p className="text-ink-2 text-sm">{Math.floor((Date.now() - new Date(apptDetail.profiles.date_of_birth).getTime()) / 31557600000)} ans</p>}
            <div className="flex gap-s-2 flex-wrap">
              {apptDetail.type && <span className="text-xs bg-surface-2 px-2 py-0.5 rounded-pill text-ink-2">{apptDetail.type}</span>}
              <StatusPill status={apptDetail.status} />
            </div>
            {apptDetail.reason && <p className="text-ink-2 text-sm">{apptDetail.reason}</p>}
            {apptDetail.starts_at && <p className="text-ink-3 text-xs flex items-center gap-1"><Clock size={12} />{new Date(apptDetail.starts_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>}
            <div className="flex flex-col gap-s-2 pt-s-2">
              {['confirmed','paid','patient_arrived','in_consultation'].includes(apptDetail.status) && (
                <Button variant="primary" loading={actionLoading} fullWidth onClick={handleStartConsultation}>
                  {apptDetail.status === 'in_consultation' ? 'Terminer la consultation' : 'Démarrer la consultation'}
                </Button>
              )}
              {apptDetail.status === 'patient_arrived' && (
                <Button variant="secondary" fullWidth onClick={() => supabase.functions.invoke('notify-patient', { body: { appointmentId: selectedApptId, type: 'delay' } })}>
                  Retard — notifier patient
                </Button>
              )}
              <Button variant="ghost" fullWidth onClick={() => setCancelModal(true)}>Annuler ce rendez-vous</Button>
            </div>
          </Card>
        )}
      </div>

      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="Annuler le rendez-vous">
        <p className="text-ink-2 mb-s-4">Êtes-vous sûr de vouloir annuler ce rendez-vous ? Le patient sera notifié.</p>
        <div className="flex gap-s-3 justify-end">
          <Button variant="ghost" onClick={() => setCancelModal(false)}>Retour</Button>
          <Button variant="danger" loading={actionLoading} onClick={handleCancel}>Confirmer l'annulation</Button>
        </div>
      </Modal>

      <Modal open={scheduleModal} onClose={() => setScheduleModal(false)} title="Configurer les horaires">
        {scheduleResult ? (
          <div className="flex flex-col gap-s-3">
            <Banner kind="info">{scheduleResult.slotsGenerated} créneaux générés avec succès.</Banner>
            <Button variant="primary" onClick={() => { setScheduleModal(false); fetchSlots(); }}>Fermer</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-s-3">
            <Select label="Jour de la semaine" options={DAY_OPTS} value={scheduleForm.dayOfWeek} onChange={v => setScheduleForm(f => ({...f, dayOfWeek: v}))} />
            <div className="grid grid-cols-2 gap-s-3">
              <Input label="Début" type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm(f => ({...f, startTime: e.target.value}))} />
              <Input label="Fin" type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm(f => ({...f, endTime: e.target.value}))} />
            </div>
            <Select label="Durée des créneaux" options={DURATION_OPTS} value={scheduleForm.slotDuration} onChange={v => setScheduleForm(f => ({...f, slotDuration: v}))} />
            <div className="grid grid-cols-2 gap-s-3">
              <Input label="Pause début (optionnel)" type="time" value={scheduleForm.breakStart} onChange={e => setScheduleForm(f => ({...f, breakStart: e.target.value}))} />
              <Input label="Pause fin (optionnel)" type="time" value={scheduleForm.breakEnd} onChange={e => setScheduleForm(f => ({...f, breakEnd: e.target.value}))} />
            </div>
            <Input label="Valide à partir du" type="date" value={scheduleForm.validFrom} onChange={e => setScheduleForm(f => ({...f, validFrom: e.target.value}))} />
            <div className="flex gap-s-3 justify-end pt-s-2">
              <Button variant="ghost" onClick={() => setScheduleModal(false)}>Annuler</Button>
              <Button variant="primary" loading={actionLoading} onClick={handleScheduleSubmit}>Générer les créneaux</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
