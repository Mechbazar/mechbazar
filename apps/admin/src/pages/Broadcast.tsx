import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Send, Clock, X } from 'lucide-react';
import type { RootState } from '../store';
import { Card, Button, Input, Select, Icon3D, Loader, EmptyState } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

type Audience = 'ALL_CUSTOMERS' | 'ALL_VENDORS' | 'ALL_TECHNICIANS' | 'ALL_RIDERS';

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'ALL_CUSTOMERS', label: 'All Customers' },
  { value: 'ALL_VENDORS', label: 'All Vendors' },
  { value: 'ALL_TECHNICIANS', label: 'All Mechanics' },
  { value: 'ALL_RIDERS', label: 'All Riders' },
];

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  audience: { audience: Audience; city?: string; state?: string; language?: string };
  sendAt: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  sentCount: number | null;
  failureReason: string | null;
}

// Composer for admin.controller.ts's broadcastNotification/createScheduledNotification
// -- previously the only way to broadcast was the Dashboard's bare title/body
// quick action with no audience refinement and no way to schedule ahead.
export default function Broadcast() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL_CUSTOMERS');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [language, setLanguage] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [sendAt, setSendAt] = useState('');
  const [sending, setSending] = useState(false);

  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(true);

  const fetchScheduled = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/admin/notifications/scheduled`, { headers: { Authorization: `Bearer ${token}` } });
      setScheduled(res.data);
    } catch {
      // Non-fatal -- the composer above still works even if this list fails to load.
    } finally {
      setLoadingScheduled(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setTitle('');
    setBody('');
    setCity('');
    setState('');
    setLanguage('');
    setSchedule(false);
    setSendAt('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (schedule && !sendAt) {
      toast.error('Pick a date and time to schedule this for');
      return;
    }

    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        language: language.trim() || undefined,
      };

      if (schedule) {
        await axios.post(
          `${API_URL}/admin/notifications/scheduled`,
          { ...payload, sendAt: new Date(sendAt).toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Broadcast scheduled');
        fetchScheduled();
      } else {
        const res = await axios.post(`${API_URL}/admin/notifications/broadcast`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success(`Sent to ${res.data.sent} recipient${res.data.sent === 1 ? '' : 's'}`);
      }
      resetForm();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const cancelScheduled = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/admin/notifications/scheduled/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setScheduled((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'CANCELLED' } : s)));
      toast.success('Scheduled broadcast cancelled');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to cancel');
    }
  };

  const pendingScheduled = scheduled.filter((s) => s.status === 'PENDING');
  const pastScheduled = scheduled.filter((s) => s.status !== 'PENDING');

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="megaphone" size={30} eager /> Broadcast Notifications
        </h1>
        <p className="text-content-secondary mt-1 text-sm">
          Send a push + in-app notification to a role, optionally narrowed by city, state, or language, right now or at a scheduled time.
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali Sale is live!" maxLength={100} />
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Up to 40% off on selected parts, today only."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border bg-surface-card text-content-primary placeholder-content-muted border-border-default focus:outline-none focus:ring-4 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>

          <Select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Pune" />
            <Input label="State (optional)" value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" />
            <Input label="Language (optional)" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="hi" />
          </div>

          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="rounded" />
            Schedule for later instead of sending immediately
          </label>

          {schedule && (
            <Input
              label="Send at"
              type="datetime-local"
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            />
          )}

          <Button onClick={handleSubmit} isLoading={sending} icon={schedule ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}>
            {schedule ? 'Schedule Broadcast' : 'Send Now'}
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-content-primary mb-3">Scheduled</h2>
        {loadingScheduled ? (
          <Loader />
        ) : pendingScheduled.length === 0 && pastScheduled.length === 0 ? (
          <EmptyState icon="bell" title="No scheduled broadcasts" description="Broadcasts you schedule for later will show up here." />
        ) : (
          <Card padding="none">
            <div className="divide-y divide-border-default">
              {[...pendingScheduled, ...pastScheduled].map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-content-primary truncate">{s.title}</p>
                    <p className="text-sm text-content-secondary mt-0.5 truncate">{s.body}</p>
                    <p className="text-xs text-content-muted mt-1">
                      {AUDIENCE_OPTIONS.find((a) => a.value === s.audience.audience)?.label}
                      {s.audience.city ? ` · ${s.audience.city}` : ''}
                      {s.audience.state ? ` · ${s.audience.state}` : ''}
                      {s.audience.language ? ` · lang:${s.audience.language}` : ''}
                      {' · '}{new Date(s.sendAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        s.status === 'PENDING'
                          ? 'bg-brand-primary/10 text-brand-primary'
                          : s.status === 'SENT'
                            ? 'bg-success-500/10 text-success-600 dark:text-success-400'
                            : s.status === 'FAILED'
                              ? 'bg-danger-500/10 text-danger-600 dark:text-danger-400'
                              : 'bg-surface-hover text-content-muted'
                      }`}
                    >
                      {s.status === 'SENT' && s.sentCount != null ? `SENT (${s.sentCount})` : s.status}
                    </span>
                    {s.status === 'PENDING' && (
                      <button onClick={() => cancelScheduled(s.id)} className="text-content-muted hover:text-danger-500" aria-label="Cancel">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
