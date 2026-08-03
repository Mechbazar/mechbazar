import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  AlertTriangle, MapPin, Search, Navigation, Wrench, PhoneCall, RefreshCw, X, Clock,
} from 'lucide-react';
import { Card, Badge, Loader } from '@mechbazar/shared/web';
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

  if (loading && !data) return <Loader fullScreen />;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap gap-3">
        <StatCard icon={Search} label="Pending Assignment" value={data?.stats.pendingAssignment ?? 0} color="text-warning-500" />
        <StatCard icon={Navigation} label="En Route" value={data?.stats.enRoute ?? 0} color="text-info-500" />
        <StatCard icon={Wrench} label="Working" value={data?.stats.working ?? 0} color="text-primary-500" />
        <StatCard icon={AlertTriangle} label="Needs Reassignment Today" value={data?.stats.needsReassignmentToday ?? 0} color="text-danger-500" />
        <StatCard icon={MapPin} label="Mechanics Online" value={data?.stats.mechanicsOnline ?? 0} color="text-success-500" />
      </div>

      <Card className="p-0 overflow-hidden">
        <LocationMapView markers={mapMarkers} height={340} emptyLabel="No active jobs or online mechanics right now" />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-100">Active Jobs</h2>
          <div className="flex gap-2">
            {(['all', 'critical', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-sm font-semibold capitalize ${
                  filter === f ? 'bg-primary-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {f}
              </button>
            ))}
            <button onClick={load} className="px-3 py-1.5 rounded text-sm font-semibold bg-neutral-800 text-neutral-300 hover:bg-neutral-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-400 border-b border-neutral-800">
                <th className="pb-2 pr-4">Job</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Age</th>
                <th className="pb-2 pr-4">Mechanic</th>
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2">Alert</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="border-b border-neutral-900 hover:bg-neutral-950 cursor-pointer"
                >
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-neutral-100">{job.isEmergency ? '🚨 ' : ''}#{job.bookingNumber}</div>
                    <div className="text-neutral-500 text-xs">{job.category} · {job.vehicle}</div>
                  </td>
                  <td className="py-3 pr-4"><Badge variant="info">{STATUS_LABEL[job.status] || job.status}</Badge></td>
                  <td className="py-3 pr-4 text-neutral-300">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatAge(job.ageSeconds)}</span>
                  </td>
                  <td className="py-3 pr-4 text-neutral-300">
                    {job.technician ? (
                      <span className={job.technician.locationStale ? 'text-warning-400' : ''}>
                        {job.technician.name || 'Unnamed'}{job.technician.locationStale ? ' (GPS stale)' : ''}
                      </span>
                    ) : (
                      <span className="text-neutral-600">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-neutral-300">{job.customer.name || job.customer.phone}</td>
                  <td className="py-3 pr-4 text-neutral-300">₹{job.amount}</td>
                  <td className="py-3">
                    {job.alert.level !== 'ok' ? (
                      <Badge variant={ALERT_BADGE[job.alert.level]}>{job.alert.reason}</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {filteredJobs.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-neutral-500">No jobs match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
      <div className={`p-2 rounded-lg bg-neutral-800 ${color}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-2xl font-bold text-neutral-100">{value}</div>
        <div className="text-xs text-neutral-500">{label}</div>
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
      alert(err?.response?.data?.error || 'Failed to assign');
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
      alert(err?.response?.data?.error || 'Failed to return to queue');
    } finally {
      setBusy(false);
    }
  };

  const handleForceStatus = async () => {
    if (!forceStatus || reason.trim().length < 5) {
      alert('Pick a status and enter a reason (at least 5 characters).');
      return;
    }
    if (!confirm(`Force this job to ${forceStatus}? This bypasses the customer's OTP verification and is logged.`)) return;
    setBusy(true);
    try {
      await liveOpsService.forceStatus(token, job.id, forceStatus, reason.trim());
      onChanged();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to force status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-neutral-900 w-full md:max-w-2xl md:rounded-xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-neutral-100">#{job.bookingNumber}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><div className="text-neutral-500">Status</div><div className="text-neutral-100 font-semibold">{STATUS_LABEL[job.status]}</div></div>
          <div><div className="text-neutral-500">Amount</div><div className="text-neutral-100 font-semibold">₹{job.amount}</div></div>
          <div><div className="text-neutral-500">Customer</div><div className="text-neutral-100">{job.customer.name} · {job.customer.phone}</div></div>
          <div>
            <div className="text-neutral-500">Mechanic</div>
            <div className="text-neutral-100">
              {job.technician ? `${job.technician.name || 'Unnamed'} · ${job.technician.phone || 'n/a'}` : 'Unassigned'}
            </div>
          </div>
          <div><div className="text-neutral-500">Start OTP</div><div className="text-neutral-100">{job.verification.startOtpVerifiedAt ? 'Verified' : 'Not yet'}</div></div>
          <div><div className="text-neutral-500">Completion OTP</div><div className="text-neutral-100">{job.verification.completionOtpVerifiedAt ? 'Verified' : 'Not yet'}</div></div>
          <div><div className="text-neutral-500">Distance travelled</div><div className="text-neutral-100">{job.tracking.distanceTravelledKm} km</div></div>
          <div><div className="text-neutral-500">Photos</div><div className="text-neutral-100">{job.photoCount}</div></div>
        </div>

        {detail?.timeline && (
          <div className="mb-4">
            <div className="text-neutral-500 text-sm mb-2">Timeline</div>
            <div className="flex flex-wrap gap-2">
              {detail.timeline.map((step: any) => (
                <Badge key={step.key} variant={step.done ? 'success' : 'neutral'} size="sm">{step.label}</Badge>
              ))}
            </div>
          </div>
        )}

        {detail?.dispatchOffers?.length > 0 && (
          <div className="mb-4">
            <div className="text-neutral-500 text-sm mb-2">Assignment Offer</div>
            <div className="space-y-1 text-sm">
              {detail.dispatchOffers.map((o: any) => (
                <div key={o.id} className="flex justify-between text-neutral-300">
                  <span>{o.technicianName || 'Unknown'}{o.distanceKm != null ? ` · ${o.distanceKm.toFixed(1)}km` : ''}</span>
                  <Badge size="sm" variant={o.status === 'ACCEPTED' ? 'success' : o.status === 'DECLINED' || o.status === 'EXPIRED' ? 'danger' : 'neutral'}>{o.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {!job.technician && technicians.length > 0 && (
          <div className="mb-4">
            <div className="text-neutral-500 text-sm mb-2">Assign Manually</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {technicians.map((t) => (
                <button
                  key={t.id}
                  disabled={busy || t.isBusy}
                  onClick={() => handleAssign(t.id)}
                  className="w-full flex justify-between items-center px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-left"
                >
                  <span className="text-neutral-100">{t.name || 'Unnamed'} · ⭐{t.rating.toFixed(1)}</span>
                  <span className="text-neutral-400 text-xs">{t.distanceKm != null ? `${t.distanceKm.toFixed(1)}km` : ''}{t.isBusy ? ' · busy' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {job.status === 'MECHANIC_ASSIGNED' && (
          <button
            disabled={busy}
            onClick={handleReturnToQueue}
            className="w-full mb-4 px-4 py-2 rounded bg-info-600 hover:bg-info-500 text-white font-semibold disabled:opacity-50"
          >
            Return to Queue (mechanic not responding)
          </button>
        )}

        <div className="border-t border-neutral-800 pt-4">
          <div className="flex items-center gap-1 text-warning-400 text-sm mb-2">
            <AlertTriangle className="w-4 h-4" /> Force Status (audited, bypasses customer OTP)
          </div>
          <div className="flex gap-2 mb-2">
            <select
              value={forceStatus}
              onChange={(e) => setForceStatus(e.target.value)}
              className="flex-1 bg-neutral-800 text-neutral-100 rounded px-3 py-2 text-sm"
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
            className="w-full bg-neutral-800 text-neutral-100 rounded px-3 py-2 text-sm mb-2"
            rows={2}
          />
          <button
            disabled={busy}
            onClick={handleForceStatus}
            className="w-full px-4 py-2 rounded bg-danger-600 hover:bg-danger-500 text-white font-semibold disabled:opacity-50"
          >
            Apply Override
          </button>
        </div>

        {job.customer.phone && (
          <a
            href={`tel:${job.customer.phone}`}
            className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <PhoneCall className="w-4 h-4" /> Call Customer
          </a>
        )}
      </div>
    </div>
  );
}
