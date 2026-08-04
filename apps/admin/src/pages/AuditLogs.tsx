import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Card, Badge, Modal, DataTable, EmptyState, Icon3D } from '../components/ui';
import type { Column } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

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
const PAGE_SIZE = 25;

function actionBadge(action: string) {
  if (action.includes('DELETE')) return 'danger' as const;
  if (action.includes('REJECT')) return 'danger' as const;
  if (action.includes('CREATE') || action.includes('APPROVE')) return 'success' as const;
  return 'warning' as const;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 border-b border-border-default last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted">{label}</dt>
      <dd className="text-sm text-content-secondary min-w-0">{children}</dd>
    </div>
  );
}

export default function AuditLogs() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entity, setEntity] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

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
        setTotal(res.data.total || 0);
      })
      .catch(() => { if (!cancelled) setLogs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, page, entity]);

  const columns: Column<AuditLogEntry>[] = [
    { key: 'action', header: 'Action', render: (log) => <Badge variant={actionBadge(log.action)} size="sm">{log.action}</Badge> },
    { key: 'entity', header: 'Entity', render: (log) => <span className="text-sm text-content-secondary">{log.entity}{log.entityId ? ` #${log.entityId.slice(-6)}` : ''}</span> },
    {
      key: 'performedBy',
      header: 'Performed By',
      render: (log) => (
        <div>
          <p className="text-content-primary text-sm font-medium">{log.user?.name || 'Unknown'}</p>
          <p className="text-content-muted text-xs">{log.user?.role}</p>
        </div>
      ),
    },
    { key: 'details', header: 'Details', className: 'max-w-xs truncate', render: (log) => <span className="text-sm text-content-muted" title={log.details || ''}>{log.details || '—'}</span> },
    { key: 'ip', header: 'IP', render: (log) => <span className="text-xs text-content-muted font-mono">{log.ipAddress || '—'}</span> },
    { key: 'when', header: 'When', render: (log) => <span className="text-xs text-content-muted">{new Date(log.createdAt).toLocaleString('en-IN')}</span> },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-3"><Icon3D name="audit" size={30} eager /> Audit Logs</h1>
        <p className="text-content-secondary mt-1 text-sm">A record of who changed what -- vendor/rider/mechanic approvals, coupon and banner changes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((e) => (
          <button
            key={e}
            onClick={() => { setEntity(e); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${entity === e ? 'bg-brand-primary text-white' : 'bg-surface-card text-content-secondary hover:text-content-primary border border-border-default'}`}
          >
            {e === 'All' ? 'All' : e.replace(/([A-Z])/g, ' $1').trim()}
          </button>
        ))}
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={logs}
          rowKey={(log) => log.id}
          loading={loading}
          onRowClick={(log) => setSelected(log)}
          emptyState={<EmptyState icon="audit" title="No audit log entries" description={entity !== 'All' ? `No entries for ${entity} yet.` : 'Actions taken by admins will show up here.'} />}
          serverPagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
        />
      </Card>

      {/* The list payload already carries every column in full, so opening a
          row needs no extra fetch -- it just un-truncates `details` and shows
          the fields the table has no room for (full entity ID, phone). */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Audit Log Entry" size="xl">
        {selected && (
          <dl>
            <DetailRow label="Action">
              <Badge variant={actionBadge(selected.action)} size="sm">{selected.action}</Badge>
            </DetailRow>
            <DetailRow label="Entity">{selected.entity}</DetailRow>
            {selected.entityId && (
              <DetailRow label="Entity ID">
                <span className="font-mono text-xs break-all">{selected.entityId}</span>
              </DetailRow>
            )}
            <DetailRow label="Performed By">
              <p className="text-content-primary font-medium">{selected.user?.name || 'Unknown'}</p>
              <p className="text-content-muted text-xs">
                {selected.user?.role}
                {selected.user?.phone ? ` · ${selected.user.phone}` : ''}
              </p>
            </DetailRow>
            <DetailRow label="Details">
              <p className="whitespace-pre-wrap break-words">{selected.details || '—'}</p>
            </DetailRow>
            <DetailRow label="IP Address">
              <span className="font-mono text-xs">{selected.ipAddress || '—'}</span>
            </DetailRow>
            <DetailRow label="When">
              {new Date(selected.createdAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}
            </DetailRow>
            <DetailRow label="Log ID">
              <span className="font-mono text-xs break-all">{selected.id}</span>
            </DetailRow>
          </dl>
        )}
      </Modal>
    </motion.div>
  );
}
