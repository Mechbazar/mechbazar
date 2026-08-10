import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Button, Card, Icon3D, Input } from '../components/ui';
import type { RootState } from '../store';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

export default function AppSettings() {
  const { token } = useSelector((state: RootState) => state.auth);
  const headers = { Authorization: `Bearer ${token}` };

  const [currentLatest, setCurrentLatest] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/app-config/mobile-version`);
        setCurrentLatest(res.data.latestVersion);
        setVersion(res.data.latestVersion);
      } catch (error) {
        console.error('Failed to fetch mobile app version setting', error);
        toast.error('Failed to load app settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/app-config/mobile-version`, { version: version.trim() }, { headers });
      setCurrentLatest(res.data.latestVersion);
      toast.success('Latest version updated.');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update version.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="gear" size={30} eager /> App Settings
        </h1>
        <p className="text-content-secondary mt-1 text-sm">
          Controls the customer mobile app's "Check for Updates" screen -- set this after every release so the app can tell customers a newer version exists.
        </p>
      </div>

      <Card padding="md">
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <p className="text-sm text-danger-600 dark:text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2">{error}</p>
          )}
          <Input
            label="Mobile app latest version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g. 1.0.0"
            disabled={loading}
          />
          <p className="text-content-muted text-xs">
            {currentLatest
              ? `Currently set to ${currentLatest}. Must match the version published in apps/mobile/package.json (x.y.z format).`
              : 'Not set yet -- the app currently treats every version as up to date.'}
          </p>
          <Button type="submit" isLoading={saving} disabled={saving || loading}>Save</Button>
        </form>
      </Card>
    </motion.div>
  );
}
