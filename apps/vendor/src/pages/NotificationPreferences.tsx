import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { BellRing, Info } from 'lucide-react';
import { Card, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import ToggleSwitch from '../components/ToggleSwitch';

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
  { key: 'offers', label: 'Offers', description: 'New offers and discounts available on the platform.' },
  { key: 'promotions', label: 'Promotions', description: 'Marketing campaigns and promotional announcements.' },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Updates about service bookings on the platform.' },
  { key: 'payments', label: 'Payments', description: 'Payment and payout status alerts for your store.' },
  { key: 'wallet', label: 'Wallet', description: 'Wallet balance changes and transaction alerts.' },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates related to mechanic and service-job activity.' },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Approvals, catalog reviews, and other vendor account updates.' },
  { key: 'reminders', label: 'Reminders', description: 'Reminders about pending actions on your account.' },
];

export default function NotificationPreferences() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  // Tracks which row has a PATCH in flight so its switch disables instead of
  // letting a fast second click race the first request's rollback.
  const [pending, setPending] = useState<Partial<Record<PreferenceKey, boolean>>>({});

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
    try {
      await axios.patch(
        `${API_URL}/customers/notification-preferences`,
        { [key]: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      // Roll back this row only -- other rows already saved stay as-is.
      setPrefs((p) => ({ ...p, [key]: !next }));
    } finally {
      setPending((p) => {
        const { [key]: _removed, ...rest } = p;
        return rest;
      });
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-content-primary flex items-center gap-2">
          <BellRing className="w-7 h-7 text-primary" /> Notification Preferences
        </h1>
        <p className="text-content-secondary mt-1">Choose which notifications you'd like to receive.</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-content-secondary">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <span>
          Order, payment, OTP, and account status alerts are always sent regardless of these settings -- they're
          never silenced.
        </span>
      </div>

      <Card variant="dark" className="!rounded-3xl !p-0 divide-y divide-border-default">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="font-semibold text-content-primary">{row.label}</p>
              <p className="text-sm text-content-secondary mt-0.5">{row.description}</p>
            </div>
            <ToggleSwitch
              checked={prefs[row.key]}
              onChange={() => handleToggle(row.key)}
              disabled={!!pending[row.key]}
              label={row.label}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
