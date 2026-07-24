import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Tag } from 'lucide-react';
import { Card, Badge, Loader, Alert } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

interface PlatformCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderValue: number;
  vehicleType: 'CAR' | 'BIKE' | null;
}

export default function Coupons() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [coupons, setCoupons] = useState<PlatformCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`${API_URL}/coupons/active`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setCoupons(res.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load coupons'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Tag className="w-7 h-7 text-primary" /> Coupons</h1>
        <p className="text-neutral-400 mt-1">Platform-wide promo codes currently live -- these can apply to orders containing your products.</p>
      </div>

      <Alert type="info" className="!rounded-3xl">
        <p className="text-xs">Promo codes are created and funded by MechBazar at the platform level, not per-seller. This page shows what's currently active so you can factor it into pricing.</p>
      </Alert>

      {error ? (
        <Alert type="error" message={error} className="!rounded-3xl" />
      ) : coupons.length === 0 ? (
        <Card variant="dark" className="!rounded-3xl">
          <div className="text-center py-8">
            <Tag className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
            <p className="text-neutral-300 font-medium">No active coupons right now</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <Card key={c.id} variant="dark" className="!rounded-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-primary font-mono">{c.code}</p>
                  <p className="text-white font-semibold mt-1">
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                  </p>
                  <p className="text-neutral-500 text-xs mt-1">Min order ₹{c.minOrderValue}</p>
                </div>
                <Badge variant="neutral" className="!rounded-lg">{c.vehicleType ? (c.vehicleType === 'CAR' ? 'Car' : 'Bike') : 'All'}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
