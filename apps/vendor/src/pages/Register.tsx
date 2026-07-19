import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { loginSuccess, updateVendorProfile } from '../store/slices/authSlice';
import type { RootState } from '../store';
import { Store, User, Building, Landmark, FileText, ArrowRight, CheckCircle } from 'lucide-react';
import { Button, Alert, Input } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Register() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStep = searchParams.get('step') || 'personal';
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  // Form States
  const [personal, setPersonal] = useState({ name: '', phone: '', email: '', password: '' });
  const [business, setBusiness] = useState({ storeName: '', gstNumber: '', panNumber: '', businessType: 'RETAIL', city: '', state: '' });
  const [bank, setBank] = useState({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });
  
  // Files
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const updateStep = (newStep: string) => {
    setSearchParams({ step: newStep });
    setStep(newStep);
  };

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneOnly = personal.phone.replace(/\D/g, '');
    if (phoneOnly.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/vendors/register`, {
        ...personal,
        phone: phoneOnly,
      });
      dispatch(loginSuccess(response.data));
      updateStep('business');
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to register. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/vendors/business`, business, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      dispatch(updateVendorProfile(response.data));
      updateStep('bank');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update business details.');
    } finally {
      setLoading(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}/vendors/bank`, bank, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      updateStep('documents');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update bank details.');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, type: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${auth.token}`
      }
    });

    await axios.post(`${API_URL}/vendors/documents`, {
      type,
      url: uploadRes.data.url
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
  };

  const handleDocumentsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panFile || !chequeFile) {
      setError('PAN and Cancelled Cheque are mandatory');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (gstFile) await uploadFile(gstFile, 'GST');
      await uploadFile(panFile, 'PAN');
      await uploadFile(chequeFile, 'CANCELLED_CHEQUE');

      // Finally submit for approval
      await axios.post(`${API_URL}/vendors/submit`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });

      navigate('/pending-approval');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload documents.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 'personal', title: 'Personal', icon: User },
    { id: 'business', title: 'Business', icon: Building },
    { id: 'bank', title: 'Bank Info', icon: Landmark },
    { id: 'documents', title: 'Documents', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-brand-dark text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        <div className="text-center mb-10">
          <Store className="w-12 h-12 text-brand-secondary mx-auto mb-4" />
          <h2 className="text-3xl font-extrabold text-white">Become a MechBazar Seller</h2>
          <p className="mt-2 text-gray-400">Complete your profile to start selling products to thousands of customers.</p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 w-full h-0.5 bg-brand-muted -z-10 transform -translate-y-1/2"></div>
            {steps.map((s, i) => {
              const isActive = s.id === step;
              const isPast = steps.findIndex(x => x.id === step) > i;
              return (
                <div key={s.id} className="flex flex-col items-center bg-brand-dark px-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-brand-secondary bg-brand-secondary/20 text-brand-secondary' : isPast ? 'border-green-500 bg-green-500/20 text-green-500' : 'border-brand-muted bg-brand-primary text-gray-500'}`}>
                    {isPast ? <CheckCircle className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-2 ${isActive ? 'text-brand-secondary font-medium' : 'text-gray-500'}`}>{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-brand-primary rounded-2xl border border-brand-muted shadow-2xl p-8">
          {error && (
            <Alert type="error" message={error} className="mb-6" />
          )}

          {step === 'personal' && (
            <form onSubmit={handlePersonalSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Full Name" type="text" required value={personal.name} onChange={e => setPersonal({...personal, name: e.target.value})} />
                <Input label="Phone Number" type="tel" required value={personal.phone} onChange={e => setPersonal({...personal, phone: e.target.value})} />
                <Input label="Email Address" type="email" required value={personal.email} onChange={e => setPersonal({...personal, email: e.target.value})} />
                <Input label="Password" type="password" required value={personal.password} onChange={e => setPersonal({...personal, password: e.target.value})} />
              </div>
              <Button type="submit" isLoading={loading} className="w-full">
                Continue to Business Details <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <p className="text-center text-sm text-gray-400 mt-4">Already have an account? <Link to="/login" className="text-brand-secondary">Login</Link></p>
            </form>
          )}

          {step === 'business' && (
            <form onSubmit={handleBusinessSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Store / Company Name" type="text" required value={business.storeName} onChange={e => setBusiness({...business, storeName: e.target.value})} />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Business Type</label>
                  <select value={business.businessType} onChange={e => setBusiness({...business, businessType: e.target.value})} className="w-full bg-brand-dark border border-brand-muted rounded-xl py-3 px-4 text-white focus:outline-none focus:border-brand-secondary">
                    <option value="RETAIL">Retailer</option>
                    <option value="WHOLESALE">Wholesaler</option>
                    <option value="MANUFACTURER">Manufacturer</option>
                  </select>
                </div>
                <Input label="GST Number (Optional)" type="text" value={business.gstNumber} onChange={e => setBusiness({...business, gstNumber: e.target.value})} />
                <Input label="PAN Number" type="text" required value={business.panNumber} onChange={e => setBusiness({...business, panNumber: e.target.value})} />
                <Input label="City" type="text" required value={business.city} onChange={e => setBusiness({...business, city: e.target.value})} />
                <Input label="State" type="text" required value={business.state} onChange={e => setBusiness({...business, state: e.target.value})} />
              </div>
              <Button type="submit" isLoading={loading} className="w-full">
                Continue to Bank Details <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          )}

          {step === 'bank' && (
            <form onSubmit={handleBankSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Account Holder Name" type="text" required value={bank.accountHolderName} onChange={e => setBank({...bank, accountHolderName: e.target.value})} />
                <Input label="Bank Name" type="text" required value={bank.bankName} onChange={e => setBank({...bank, bankName: e.target.value})} />
                <Input label="Account Number" type="text" required value={bank.accountNumber} onChange={e => setBank({...bank, accountNumber: e.target.value})} />
                <Input label="IFSC Code" type="text" required value={bank.ifscCode} onChange={e => setBank({...bank, ifscCode: e.target.value})} />
              </div>
              <Button type="submit" isLoading={loading} className="w-full">
                Continue to Documents <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          )}

          {step === 'documents' && (
            <form onSubmit={handleDocumentsSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="border border-brand-muted rounded-xl p-4 bg-brand-dark">
                  <label className="block text-sm font-medium text-gray-300 mb-2">PAN Card Copy *</label>
                  <input type="file" required accept="image/*,.pdf" onChange={e => setPanFile(e.target.files?.[0] || null)} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary/10 file:text-brand-secondary hover:file:bg-brand-secondary/20 cursor-pointer" />
                </div>
                <div className="border border-brand-muted rounded-xl p-4 bg-brand-dark">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cancelled Cheque *</label>
                  <input type="file" required accept="image/*,.pdf" onChange={e => setChequeFile(e.target.files?.[0] || null)} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary/10 file:text-brand-secondary hover:file:bg-brand-secondary/20 cursor-pointer" />
                </div>
                <div className="border border-brand-muted rounded-xl p-4 bg-brand-dark">
                  <label className="block text-sm font-medium text-gray-300 mb-2">GST Certificate (Optional)</label>
                  <input type="file" accept="image/*,.pdf" onChange={e => setGstFile(e.target.files?.[0] || null)} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary/10 file:text-brand-secondary hover:file:bg-brand-secondary/20 cursor-pointer" />
                </div>
              </div>
              
              <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-xl p-4">
                <p className="text-sm text-brand-secondary">By submitting, you agree to our Terms of Service and allow our team to verify your business details. Approval may take 1-2 business days.</p>
              </div>

              <Button type="submit" isLoading={loading} className="w-full">
                Submit Application <CheckCircle className="ml-2 w-5 h-5" />
              </Button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
