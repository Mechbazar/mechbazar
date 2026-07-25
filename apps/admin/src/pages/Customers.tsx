import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Users as UsersIcon, CheckCircle, XCircle, Phone, Search, MapPin, Mail, Car, Package, Wrench, Trash2, AlertTriangle } from 'lucide-react';
import { Badge, Button, Dialog, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import LocationMapView from '../components/maps/LocationMapView';

function InfoRow({ label, value, icon }: { label: string; value: any; icon?: ReactNode }) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-100 flex items-center gap-1.5 mt-0.5 break-all">
        {icon}{value || '-'}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-center">
      <div className="text-xl font-bold text-neutral-100">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

function HistoryRow({ title, status, amount, date }: { title: string; status: string; amount?: number; date?: string }) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-bold text-neutral-100">{title}</div>
        <div className="text-xs text-neutral-400">{date ? new Date(date).toLocaleDateString() : ''}</div>
      </div>
      <div className="text-right">
        <Badge variant="primary" className="!rounded-full !text-[10px]">{status}</Badge>
        {amount != null && <div className="text-xs text-neutral-400 mt-1">₹{Number(amount).toLocaleString('en-IN')}</div>}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // The row that opened the details dialog (used for the header while the full
  // record loads), the on-demand detail payload, and the delete confirm step.
  const [activeCustomer, setActiveCustomer] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch (error) {
      console.error('Failed to fetch customers', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (customer: any) => {
    setActiveCustomer(customer);
    setDetail(null);
    setDetailError('');
    setConfirmDelete(false);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API_URL}/customers/${customer.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetail(res.data);
    } catch (error: any) {
      console.error('Failed to fetch customer details', error);
      setDetailError(error?.response?.data?.error || 'Failed to load customer details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setActiveCustomer(null);
    setDetail(null);
    setDetailError('');
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    if (!activeCustomer) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/customers/${activeCustomer.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      closeDetails();
      fetchCustomers();
    } catch (error: any) {
      console.error('Failed to delete customer', error);
      // The backend refuses to delete customers that still have orders or
      // bookings -- surface that reason rather than a generic failure.
      setDetailError(error?.response?.data?.error || 'Failed to delete customer.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (filter !== 'ALL' && c.accountType !== filter) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search)) ||
        (c.companyName && c.companyName.toLowerCase().includes(search))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-100 flex items-center">
          <UsersIcon className="w-8 h-8 mr-3 text-primary-500" />
          Customers
        </h1>
        <div className="flex bg-neutral-950 rounded-lg border border-neutral-800 p-1">
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${filter === 'ALL' ? 'bg-primary-500 text-neutral-950' : 'text-neutral-400 hover:text-neutral-100'}`}
            onClick={() => setFilter('ALL')}
          >All</button>
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${filter === 'RETAIL' ? 'bg-primary-500 text-neutral-950' : 'text-neutral-400 hover:text-neutral-100'}`}
            onClick={() => setFilter('RETAIL')}
          >Retail (B2C)</button>
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${filter === 'WHOLESALE' ? 'bg-primary-500 text-neutral-950' : 'text-neutral-400 hover:text-neutral-100'}`}
            onClick={() => setFilter('WHOLESALE')}
          >Wholesale (B2B)</button>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center">
        <Search className="w-5 h-5 text-neutral-400 mr-3" />
        <input 
          type="text" 
          placeholder="Search by name, phone, or company..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-neutral-100 w-full"
        />
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center">
          <UsersIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-neutral-100 mb-2">No Customers Found</h3>
          <p className="text-neutral-400">No customers match your current filters.</p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 border-b border-neutral-800">
                <th className="p-4 text-sm font-semibold text-neutral-400">Customer Details</th>
                <th className="p-4 text-sm font-semibold text-neutral-400">Account Type</th>
                <th className="p-4 text-sm font-semibold text-neutral-400">B2B Info</th>
                <th className="p-4 text-sm font-semibold text-neutral-400">Orders</th>
                <th className="p-4 text-sm font-semibold text-neutral-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredCustomers.map(user => (
                <tr key={user.id} className="hover:bg-neutral-950/70 transition-colors">
                  <td className="p-4">
                    <div className="text-sm font-bold text-neutral-100">{user.name || 'Unknown User'}</div>
                    <div className="text-xs text-neutral-400 flex items-center mt-1">
                      <Phone className="w-3 h-3 mr-1" /> {user.phone}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={user.accountType === 'WHOLESALE' ? 'primary' : 'success'} className="!rounded-full !text-[10px] uppercase tracking-wider">
                      {user.accountType}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {user.accountType === 'WHOLESALE' ? (
                      <div>
                        <div className="text-sm font-medium text-neutral-100">{user.companyName || 'N/A'}</div>
                        {user.gstNumber && <div className="text-xs text-neutral-400">GST: {user.gstNumber}</div>}
                        <div className="mt-1">
                          {user.isBusinessVerified ? (
                            <span className="flex items-center text-xs text-green-500"><CheckCircle className="w-3 h-3 mr-1"/> Verified B2B</span>
                          ) : (
                            <span className="flex items-center text-xs text-primary-500"><XCircle className="w-3 h-3 mr-1"/> Pending Verification</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-neutral-100 font-medium">{user._count?.orders || 0} Orders</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-3">
                      {user.accountType === 'WHOLESALE' && !user.isBusinessVerified && (
                        <button
                          onClick={async () => {
                            try {
                              await axios.patch(`${API_URL}/customers/${user.id}`, { isBusinessVerified: true }, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              fetchCustomers();
                            } catch (err) {
                              console.error(err);
                              alert('Failed to approve B2B');
                            }
                          }}
                          className="text-neutral-950 bg-primary-500 hover:bg-primary-600 px-3 py-1 rounded text-xs font-bold transition-colors"
                        >
                          Approve B2B
                        </button>
                      )}
                      <button
                        onClick={() => openDetails(user)}
                        className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {activeCustomer && (
        <Dialog
          isOpen={!!activeCustomer}
          onClose={closeDetails}
          title={activeCustomer.name || 'Customer Details'}
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full gap-3">
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => { setDetailError(''); setConfirmDelete(true); }}
                disabled={detailLoading || deleting || confirmDelete}
              >
                Delete User
              </Button>
              <Button variant="ghost" size="sm" onClick={closeDetails}>Close</Button>
            </div>
          }
        >
          {detailLoading ? (
            <div className="py-10 flex justify-center"><Loader /></div>
          ) : (
            <div className="space-y-5">
              {detailError && (
                <div className="bg-danger-500/10 border border-danger-500/40 rounded-lg p-3 text-sm text-danger-500 flex items-start">
                  <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {confirmDelete && (
                <div className="bg-neutral-950 border border-danger-500/50 rounded-lg p-4">
                  <p className="text-sm font-bold text-neutral-100 mb-1">Delete this customer permanently?</p>
                  <p className="text-xs text-neutral-400 mb-3">
                    {activeCustomer.name || 'This user'} ({activeCustomer.phone}) and their saved addresses, garage,
                    wishlist and notifications will be removed. Customers with orders or service bookings cannot be
                    deleted. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="danger" size="sm" onClick={handleDelete} isLoading={deleting}>
                      Yes, delete permanently
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Profile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow label="Phone" value={activeCustomer.phone} icon={<Phone className="w-3.5 h-3.5" />} />
                <InfoRow label="Email" value={detail?.email || activeCustomer.email || '-'} icon={<Mail className="w-3.5 h-3.5" />} />
                <InfoRow label="Account Type" value={activeCustomer.accountType} />
                <InfoRow
                  label="Joined"
                  value={detail?.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '-'}
                />
                {activeCustomer.accountType === 'WHOLESALE' && (
                  <>
                    <InfoRow label="Company" value={detail?.companyName || activeCustomer.companyName || '-'} />
                    <InfoRow label="GST" value={detail?.gstNumber || activeCustomer.gstNumber || '-'} />
                    <InfoRow label="B2B Status" value={activeCustomer.isBusinessVerified ? 'Verified' : 'Pending verification'} />
                  </>
                )}
              </div>

              {/* Activity counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Orders" value={detail?._count?.orders ?? activeCustomer._count?.orders ?? 0} />
                <StatTile label="Bookings" value={detail?._count?.serviceBookings ?? 0} />
                <StatTile label="Reviews" value={detail?._count?.reviews ?? 0} />
                <StatTile label="Wishlist" value={detail?._count?.wishlists ?? 0} />
              </div>

              {/* Addresses */}
              <Section title="Saved Addresses" icon={<MapPin className="w-4 h-4" />}>
                {(!detail?.addresses || detail.addresses.length === 0) ? (
                  <p className="text-neutral-400 text-sm italic">No saved addresses.</p>
                ) : (
                  <>
                    <LocationMapView
                      markers={detail.addresses
                        .filter((a: any) => a.lat != null && a.lng != null)
                        .map((a: any) => ({ id: a.id, lat: a.lat, lng: a.lng, label: a.title }))}
                      height={220}
                      emptyLabel="No geocoded addresses to show on map"
                    />
                    <div className="space-y-3 mt-3">
                      {detail.addresses.map((addr: any) => (
                        <div key={addr.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-neutral-100">{addr.title}</span>
                            {addr.isDefault && <Badge variant="primary" className="!rounded-full !text-[10px]">Default</Badge>}
                          </div>
                          <p className="text-sm text-neutral-400 flex items-start">
                            <MapPin className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
                            {addr.formattedAddress || `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city}, ${addr.state} ${addr.pincode}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Section>

              {/* Garage */}
              <Section title="Garage" icon={<Car className="w-4 h-4" />}>
                {(!detail?.userVehicles || detail.userVehicles.length === 0) ? (
                  <p className="text-neutral-400 text-sm italic">No vehicles added.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.userVehicles.map((v: any) => (
                      <div key={v.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-neutral-100">
                            {v.brand} {v.model} {v.year ? `(${v.year})` : ''}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {v.vehicleType}{v.fuelType ? ` · ${v.fuelType}` : ''}{v.registrationNumber ? ` · ${v.registrationNumber}` : ''}
                          </div>
                        </div>
                        {v.isDefault && <Badge variant="primary" className="!rounded-full !text-[10px]">Default</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Recent orders */}
              <Section title="Recent Orders" icon={<Package className="w-4 h-4" />}>
                {(!detail?.orders || detail.orders.length === 0) ? (
                  <p className="text-neutral-400 text-sm italic">No orders yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.orders.map((o: any) => (
                      <HistoryRow
                        key={o.id}
                        title={`#${String(o.id).slice(0, 8).toUpperCase()}`}
                        status={o.status}
                        amount={o.finalAmount}
                        date={o.createdAt}
                      />
                    ))}
                  </div>
                )}
              </Section>

              {/* Recent bookings */}
              <Section title="Recent Service Bookings" icon={<Wrench className="w-4 h-4" />}>
                {(!detail?.serviceBookings || detail.serviceBookings.length === 0) ? (
                  <p className="text-neutral-400 text-sm italic">No service bookings yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.serviceBookings.map((b: any) => (
                      <HistoryRow
                        key={b.id}
                        title={`#${b.bookingNumber}`}
                        status={b.status}
                        amount={b.finalAmount}
                        date={b.createdAt}
                      />
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
