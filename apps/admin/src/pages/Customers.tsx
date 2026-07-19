import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Users as UsersIcon, CheckCircle, XCircle, Phone, Search } from 'lucide-react';
import { Badge, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function UsersPage() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
                  <td className="p-4 text-right">
                    {user.accountType === 'WHOLESALE' && !user.isBusinessVerified ? (
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
                    ) : (
                      <button className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors cursor-not-allowed opacity-50">
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
