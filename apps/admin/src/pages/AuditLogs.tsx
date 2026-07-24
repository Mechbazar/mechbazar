import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Loader, Badge } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string; phone: string; role: string } | null;
}

const ENTITY_FILTERS = ['All', 'Vendor', 'ServiceTechnician', 'DeliveryPartner', 'Coupon', 'Banner'];

function actionBadge(action: string) {
  if (action.includes('DELETE')) return 'danger' as const;
  if (action.includes('REJECT')) return 'danger' as const;
  if (action.includes('CREATE') || action.includes('APPROVE')) return 'success' as const;
  return 'warning' as const;
}

export default function AuditLogs() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entity, setEntity] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API_URL}/admin/audit-logs`, {
        params: { page, ...(entity !== 'All' ? { entity } : {}) },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (cancelled) return;
        setLogs(res.data.logs);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => { if (!cancelled) setLogs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, page, entity]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><ScrollText className="w-7 h-7 text-primary-500" /> Audit Logs</h1>
        <p className="text-neutral-400 mt-1">A record of who changed what -- vendor/rider/mechanic approvals, coupon and banner changes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((e) => (
          <button
            key={e}
            onClick={() => { setEntity(e); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${entity === e ? 'bg-primary-500 text-white' : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'}`}
          >
            {e === 'All' ? 'All' : e.replace(/([A-Z])/g, ' $1').trim()}
          </button>
        ))}
      </div>

      <Card variant="dark" className="!p-0 overflow-hidden">
        {loading ? (
          <Loader />
        ) : logs.length === 0 ? (
          <p className="text-neutral-400 text-sm p-8 text-center">No audit log entries{entity !== 'All' ? ` for ${entity}` : ''} yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-950 text-xs text-neutral-400 font-semibold uppercase">
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Performed By</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">IP</th>
                  <th className="p-4">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-900/50">
                    <td className="p-4"><Badge variant={actionBadge(log.action)} className="!rounded-lg">{log.action}</Badge></td>
                    <td className="p-4 text-sm text-neutral-300">{log.entity}{log.entityId ? ` #${log.entityId.slice(-6)}` : ''}</td>
                    <td className="p-4">
                      <p className="text-white text-sm font-medium">{log.user?.name || 'Unknown'}</p>
                      <p className="text-neutral-500 text-xs">{log.user?.role}</p>
                    </td>
                    <td className="p-4 text-sm text-neutral-400 max-w-xs truncate" title={log.details || ''}>{log.details || '—'}</td>
                    <td className="p-4 text-xs text-neutral-500 font-mono">{log.ipAddress || '—'}</td>
                    <td className="p-4 text-xs text-neutral-500">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-neutral-800">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
