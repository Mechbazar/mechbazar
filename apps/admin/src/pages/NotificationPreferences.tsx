import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import type { RootState } from '../store';
import { Card, Checkbox, Icon3D } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

// Field names must match the backend's NotificationPreference model exactly
// -- GET/PATCH /api/customers/notification-preferences (see
// apps/backend/src/routes/customers.routes.ts, not touched here).
type PreferenceKey =
  | 'offers'
  | 'promotions'
  | 'serviceUpdates'
  | 'payments'
  | 'wallet'
  | 'mechanicUpdates'
  | 'vendorUpdates'
  | 'reminders';

type Preferences = Record<PreferenceKey, boolean>;

// Every field defaults to true server-side; mirrored here so a response
// that's missing a key (or a still-loading first render) never renders a
// row as "off" when it's actually on.
const DEFAULT_PREFERENCES: Preferences = {
  offers: true,
  promotions: true,
  serviceUpdates: true,
  payments: true,
  wallet: true,
  mechanicUpdates: true,
  vendorUpdates: true,
  reminders: true,
};

const ROWS: { key: PreferenceKey; label: string; description: string }[] = [
  { key: 'offers', label: 'Offers', description: 'New offers and discounts across the platform.' },
  { key: 'promotions', label: 'Promotions', description: 'Marketing campaigns and promotional announcements.' },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Updates about service bookings and jobs.' },
  { key: 'payments', label: 'Payments', description: 'Payment and payout status alerts.' },
  { key: 'wallet', label: 'Wallet', description: 'Wallet balance changes and transaction alerts.' },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates related to mechanic activity and job assignments.' },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Vendor approvals, onboarding, and store-related updates.' },
  { key: 'reminders', label: 'Reminders', description: 'Reminders about pending actions across the platform.' },
];

export default function NotificationPreferences() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  // Tracks which row has a PATCH in flight so its checkbox disables instead
  // of letting a fast second click race the first request's rollback.
  const [pending, setPending] = useState<Partial<Record<PreferenceKey, boolean>>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/customers/notification-preferences`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setPrefs({ ...DEFAULT_PREFERENCES, ...res.data }))
      .catch(() => setPrefs(DEFAULT_PREFERENCES))
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggle = async (key: PreferenceKey) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setPending((p) => ({ ...p, [key]: true }));
    setError('');
    try {
      await axios.patch(
        `${API_URL}/customers/notification-preferences`,
        { [key]: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e: any) {
      // Roll back this row only -- other rows already saved stay as-is.
      setPrefs((p) => ({ ...p, [key]: !next }));
      setError(e.response?.data?.error || 'Failed to update preference');
    } finally {
      setPending((p) => {
        const { [key]: _removed, ...rest } = p;
        return rest;
      });
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="bell" size={30} eager /> Notification Preferences
        </h1>
        <p className="text-content-secondary mt-1 text-sm">
          Choose which notification categories you'd like to receive.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 text-sm text-content-secondary">
        <Info size={16} className="text-brand-primary mt-0.5 flex-shrink-0" />
        <span>
          Order, payment, OTP, and account status alerts are always sent regardless of these settings -- they're
          never silenced.
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="text-content-muted text-sm py-8 text-center">Loading preferences…</div>
        ) : (
          <div className="divide-y divide-border-default">
            {ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4">
                <div>
                  <p className="font-semibold text-sm text-content-primary">{row.label}</p>
                  <p className="text-sm text-content-secondary mt-0.5">{row.description}</p>
                </div>
                <Checkbox
                  checked={prefs[row.key]}
                  disabled={!!pending[row.key]}
                  onChange={() => handleToggle(row.key)}
                  aria-label={row.label}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
