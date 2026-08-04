import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import type { RootState } from '../../store';
import {
  AlertTriangle, MapPin, Search, Navigation, Wrench, PhoneCall, RefreshCw, Clock,
} from 'lucide-react';
import { Card, Badge, Loader, Modal, DataTable } from '../../components/ui';
import type { Column } from '../../components/ui';
import { liveOpsService } from '../../services/liveOpsService';
import type { LiveOpsJobRow, LiveOpsResponse } from '../../services/liveOpsService';
import { getAdminSocket } from '../../services/adminRealtime';
import LocationMapView from '../../components/maps/LocationMapView';
import type { LocationMapMarker } from '../../components/maps/LocationMapView';

const POLL_MS = 6000;

const STATUS_LABEL: Record<string, string> = {
  PENDING_ADMIN_ASSIGNMENT: 'Pending Assignment',
  MECHANIC_ASSIGNED: 'Assigned', MECHANIC_ACCEPTED: 'Accepted', MECHANIC_ON_THE_WAY: 'En Route',
  ARRIVED: 'Arrived', WORK_STARTED: 'Work Started', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', REJECTED: 'Needs Reassignment',
};

const ALERT_BADGE: Record<string, 'success' | 'warning' | 'danger'> = { ok: 'success', warn: 'warning', critical: 'danger' };

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function LiveOps() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<LiveOpsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<LiveOpsJobRow | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'pending'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await liveOpsService.getLiveOps(token);
      setData(res);
    } catch (err) {
      console.error('Failed to load live ops', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Socket keeps the map feeling live between polls -- mechanic positions and
  // job-status flips render immediately rather than waiting up to POLL_MS.
  useEffect(() => {
    if (!token) return;
    const socket = getAdminSocket();
    socket.emit('admin:watch-live-map');
    const onUpdate = () => load();
    socket.on('admin:mechanic-location', onUpdate);
    socket.on('admin:job-update', onUpdate);
    return () => {
      socket.off('admin:mechanic-location', onUpdate);
      socket.off('admin:job-update', onUpdate);
      socket.emit('admin:unwatch-live-map');
    };
  }, [token, load]);

  // Keep the open detail panel in sync with the polling refresh instead of
  // going stale the moment a job's status changes underneath it.
  useEffect(() => {
    if (!selectedJob || !data) return;
    const fresh = data.jobs.find((j) => j.id === selectedJob.id);
    setSelectedJob(fresh || null);
  }, [data, selectedJob?.id]);

  const filteredJobs = useMemo(() => {
    const jobs = data?.jobs || [];
    if (filter === 'critical') return jobs.filter((j) => j.alert.level === 'critical');
    if (filter === 'pending') return jobs.filter((j) => j.status === 'PENDING_ADMIN_ASSIGNMENT' || j.status === 'REJECTED');
    return jobs;
  }, [data, filter]);

  const mapMarkers: LocationMapMarker[] = useMemo(() => {
    if (!data) return [];
    const jobMarkers: LocationMapMarker[] = data.jobs
      .filter((j) => j.customerLocation.lat != null && j.customerLocation.lng != null)
      .map((j) => ({
        id: `job-${j.id}`,
        lat: j.customerLocation.lat!,
        lng: j.customerLocation.lng!,
        label: `#${j.bookingNumber} · ${STATUS_LABEL[j.status]}`,
        color: j.alert.level === 'critical' ? 'red' : j.alert.level === 'warn' ? 'yellow' : 'green',
      }));
    const mechMarkers: LocationMapMarker[] = data.mechanics
      .filter((m) => m.lat != null && m.lng != null)
      .map((m) => ({
        id: `mech-${m.id}`,
        lat: m.lat!,
        lng: m.lng!,
        label: `${m.name || 'Mechanic'}${m.busy ? ' (on a job)' : ' (available)'}`,
        color: 'blue',
      }));
    return [...jobMarkers, ...mechMarkers];
  }, [data]);

  const columns: Column<LiveOpsJobRow>[] = [
    {
      key: 'job',
      header: 'Job',
      render: (job) => (
        <div>
          <div className="font-semibold text-content-primary">{job.isEmergency ? '🚨 ' : ''}#{job.bookingNumber}</div>
          <div className="text-content-muted text-xs">{job.category} · {job.vehicle}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (job) => <Badge variant="info" size="sm">{STATUS_LABEL[job.status] || job.status}</Badge> },
    {
      key: 'age',
      header: 'Age',
      render: (job) => (
        <span className="inline-flex items-center gap-1 text-content-secondary"><Clock className="w-3.5 h-3.5" />{formatAge(job.ageSeconds)}</span>
      ),
    },
    {
      key: 'mechanic',
      header: 'Mechanic',
      render: (job) => job.technician ? (
        <span className={job.technician.locationStale ? 'text-warning-500' : 'text-content-secondary'}>
          {job.technician.name || 'Unnamed'}{job.technician.locationStale ? ' (GPS stale)' : ''}
        </span>
      ) : (
        <span className="text-content-muted">Unassigned</span>
      ),
    },
    { key: 'customer', header: 'Customer', render: (job) => <span className="text-content-secondary">{job.customer.name || job.customer.phone}</span> },
    { key: 'amount', header: 'Amount', render: (job) => <span className="text-content-secondary">₹{job.amount}</span> },
    {
      key: 'alert',
      header: 'Alert',
      render: (job) => job.alert.level !== 'ok' ? (
        <Badge variant={ALERT_BADGE[job.alert.level]} size="sm">{job.alert.reason}</Badge>
      ) : (
        <Badge variant="success" size="sm">OK</Badge>
      ),
    },
  ];

  if (loading && !data) return <Loader fullScreen />;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap gap-3">
        <StatCard icon={Search} label="Pending Assignment" value={data?.stats.pendingAssignment ?? 0} color="text-warning-500" />
        <StatCard icon={Navigation} label="En Route" value={data?.stats.enRoute ?? 0} color="text-info-500" />
        <StatCard icon={Wrench} label="Working" value={data?.stats.working ?? 0} color="text-brand-primary" />
        <StatCard icon={AlertTriangle} label="Needs Reassignment Today" value={data?.stats.needsReassignmentToday ?? 0} color="text-danger-500" />
        <StatCard icon={MapPin} label="Mechanics Online" value={data?.stats.mechanicsOnline ?? 0} color="text-success-500" />
      </div>

      <Card padding="none" className="overflow-hidden">
        <LocationMapView markers={mapMarkers} height={340} emptyLabel="No active jobs or online mechanics right now" />
      </Card>

      <Card padding="none">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-default">
          <h2 className="text-base font-bold text-content-primary">Active Jobs</h2>
          <div className="flex gap-2">
            {(['all', 'critical', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
                  filter === f ? 'bg-brand-primary text-white' : 'bg-surface-sunken text-content-secondary hover:text-content-primary'
                }`}
              >
                {f}
              </button>
            ))}
            <button onClick={load} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-surface-sunken text-content-secondary hover:text-content-primary transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredJobs}
          rowKey={(job) => job.id}
          onRowClick={(job) => setSelectedJob(job)}
          className="rounded-none border-none shadow-none"
          emptyState={<div className="py-8 text-center text-content-muted">No jobs match this filter.</div>}
        />
      </Card>

      {selectedJob && token && (
        <JobDetailPanel job={selectedJob} token={token} onClose={() => setSelectedJob(null)} onChanged={load} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="flex-1 min-w-[150px] flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-surface-sunken ${color}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-2xl font-bold text-content-primary">{value}</div>
        <div className="text-xs text-content-muted">{label}</div>
      </div>
    </Card>
  );
}

function JobDetailPanel({
  job, token, onClose, onChanged,
}: { job: LiveOpsJobRow; token: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [technicians, setTechnicians] = useState<{ id: string; name: string | null; rating: number; distanceKm: number | null; isOnline: boolean; isBusy: boolean }[]>([]);
  const [reason, setReason] = useState('');
  const [forceStatus, setForceStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    liveOpsService.getJobDetail(token, job.id).then((res) => setDetail(res.job));
    if (!job.technician) {
      liveOpsService.getAssignableTechnicians(token, job.id).then(setTechnicians).catch(() => setTechnicians([]));
    }
  }, [job.id, token, job.technician]);

  const handleAssign = async (technicianId: string) => {
    setBusy(true);
    try {
      await liveOpsService.assign(token, job.id, technicianId);
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to assign');
    } finally {
      setBusy(false);
    }
  };

  const handleReturnToQueue = async () => {
    setBusy(true);
    try {
      await liveOpsService.redispatch(token, job.id);
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to return to queue');
    } finally {
      setBusy(false);
    }
  };

  const handleForceStatus = async () => {
    if (!forceStatus || reason.trim().length < 5) {
      toast.error('Pick a status and enter a reason (at least 5 characters).');
      return;
    }
    if (!confirm(`Force this job to ${forceStatus}? This bypasses the customer's OTP verification and is logged.`)) return;
    setBusy(true);
    try {
      await liveOpsService.forceStatus(token, job.id, forceStatus, reason.trim());
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to force status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`#${job.bookingNumber}`} size="xl">
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div><div className="text-content-muted">Status</div><div className="text-content-primary font-semibold">{STATUS_LABEL[job.status]}</div></div>
        <div><div className="text-content-muted">Amount</div><div className="text-content-primary font-semibold">₹{job.amount}</div></div>
        <div><div className="text-content-muted">Customer</div><div className="text-content-primary">{job.customer.name} · {job.customer.phone}</div></div>
        <div>
          <div className="text-content-muted">Mechanic</div>
          <div className="text-content-primary">
            {job.technician ? `${job.technician.name || 'Unnamed'} · ${job.technician.phone || 'n/a'}` : 'Unassigned'}
          </div>
        </div>
        <div><div className="text-content-muted">Start OTP</div><div className="text-content-primary">{job.verification.startOtpVerifiedAt ? 'Verified' : 'Not yet'}</div></div>
        <div><div className="text-content-muted">Completion OTP</div><div className="text-content-primary">{job.verification.completionOtpVerifiedAt ? 'Verified' : 'Not yet'}</div></div>
        <div><div className="text-content-muted">Distance travelled</div><div className="text-content-primary">{job.tracking.distanceTravelledKm} km</div></div>
        <div><div className="text-content-muted">Photos</div><div className="text-content-primary">{job.photoCount}</div></div>
      </div>

      {detail?.timeline && (
        <div className="mb-4">
          <div className="text-content-muted text-sm mb-2">Timeline</div>
          <div className="flex flex-wrap gap-2">
            {detail.timeline.map((step: any) => (
              <Badge key={step.key} variant={step.done ? 'success' : 'neutral'} size="sm">{step.label}</Badge>
            ))}
          </div>
        </div>
      )}

      {detail?.dispatchOffers?.length > 0 && (
        <div className="mb-4">
          <div className="text-content-muted text-sm mb-2">Assignment Offer</div>
          <div className="space-y-1 text-sm">
            {detail.dispatchOffers.map((o: any) => (
              <div key={o.id} className="flex justify-between text-content-secondary">
                <span>{o.technicianName || 'Unknown'}{o.distanceKm != null ? ` · ${o.distanceKm.toFixed(1)}km` : ''}</span>
                <Badge size="sm" variant={o.status === 'ACCEPTED' ? 'success' : o.status === 'DECLINED' || o.status === 'EXPIRED' ? 'danger' : 'neutral'}>{o.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {!job.technician && technicians.length > 0 && (
        <div className="mb-4">
          <div className="text-content-muted text-sm mb-2">Assign Manually</div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {technicians.map((t) => (
              <button
                key={t.id}
                disabled={busy || t.isBusy}
                onClick={() => handleAssign(t.id)}
                className="w-full flex justify-between items-center px-3 py-2 rounded-lg bg-surface-sunken hover:bg-surface-hover disabled:opacity-40 text-left transition-colors"
              >
                <span className="text-content-primary">{t.name || 'Unnamed'} · ⭐{t.rating.toFixed(1)}</span>
                <span className="text-content-muted text-xs">{t.distanceKm != null ? `${t.distanceKm.toFixed(1)}km` : ''}{t.isBusy ? ' · busy' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {job.status === 'MECHANIC_ASSIGNED' && (
        <button
          disabled={busy}
          onClick={handleReturnToQueue}
          className="w-full mb-4 px-4 py-2 rounded-xl bg-info-500 hover:bg-info-600 text-white font-semibold disabled:opacity-50 transition-colors"
        >
          Return to Queue (mechanic not responding)
        </button>
      )}

      <div className="border-t border-border-default pt-4">
        <div className="flex items-center gap-1 text-warning-600 dark:text-warning-400 text-sm mb-2">
          <AlertTriangle className="w-4 h-4" /> Force Status (audited, bypasses customer OTP)
        </div>
        <div className="flex gap-2 mb-2">
          <select
            value={forceStatus}
            onChange={(e) => setForceStatus(e.target.value)}
            className="flex-1 bg-surface-sunken border border-border-default text-content-primary rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-primary"
          >
            <option value="">Select status…</option>
            {['MECHANIC_ASSIGNED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED', 'COMPLETED', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required, logged to the audit trail)"
          className="w-full bg-surface-sunken border border-border-default text-content-primary rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:border-brand-primary"
          rows={2}
        />
        <button
          disabled={busy}
          onClick={handleForceStatus}
          className="w-full px-4 py-2 rounded-xl bg-danger-500 hover:bg-danger-600 text-white font-semibold disabled:opacity-50 transition-colors"
        >
          Apply Override
        </button>
      </div>

      {job.customer.phone && (
        <a
          href={`tel:${job.customer.phone}`}
          className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2 rounded-xl border border-border-default text-content-secondary hover:bg-surface-hover transition-colors"
        >
          <PhoneCall className="w-4 h-4" /> Call Customer
        </a>
      )}
    </Modal>
  );
}
