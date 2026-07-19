import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, Typography, Card, Button, Input, Loader, vendorService } from '@mechbazar/shared';
import { CheckCircle, Circle } from 'lucide-react-native';

type DocType = 'GST' | 'PAN' | 'CANCELLED_CHEQUE';

const DOCUMENT_TYPES: { key: DocType; label: string; required: boolean }[] = [
  { key: 'PAN', label: 'PAN Card Copy', required: true },
  { key: 'CANCELLED_CHEQUE', label: 'Cancelled Cheque', required: true },
  { key: 'GST', label: 'GST Certificate (optional)', required: false },
];

const STEP_TITLES = ['Business Details', 'Bank Info', 'Documents', 'Review & Submit'];

const BUSINESS_TYPES = ['RETAIL', 'WHOLESALE', 'MANUFACTURER'];

// Steps 2-4 of vendor onboarding (personal/account creation already happened
// in RegisterScreen). Reached whenever an authenticated vendor's status is
// PENDING or REJECTED -- same single-scroll-wizard shape as the rider app's
// RegistrationScreen, adapted to the vendor's business/bank/documents fields.
export const OnboardingWizard = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const { data: profile, isLoading } = useQuery({ queryKey: ['vendor-profile'], queryFn: vendorService.getProfile });

  const [business, setBusiness] = useState({ storeName: '', gstNumber: '', panNumber: '', businessType: 'RETAIL', city: '', state: '' });
  const [bank, setBank] = useState({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });

  useEffect(() => {
    if (!profile) return;
    setBusiness((prev) => ({
      ...prev,
      storeName: profile.storeName && profile.storeName !== 'My Store' ? profile.storeName : '',
      gstNumber: profile.gstNumber || '',
      panNumber: profile.panNumber || '',
      businessType: profile.businessType || 'RETAIL',
      city: profile.user?.city || '',
      state: profile.user?.state || '',
    }));
    if (profile.bankAccounts?.[0]) {
      const b = profile.bankAccounts[0];
      setBank({ accountHolderName: b.accountHolderName, bankName: b.bankName, accountNumber: b.accountNumber, ifscCode: b.ifscCode });
    }
  }, [profile]);

  const uploadedTypes = new Set<string>((profile?.documents || []).map((d: any) => d.type));
  const hasBank = !!profile?.bankAccounts?.length;

  const businessMutation = useMutation({
    mutationFn: () => vendorService.updateBusiness(business),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-profile'] });
      setStep(1);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const bankMutation = useMutation({
    mutationFn: () => vendorService.addBankAccount(bank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-profile'] });
      Alert.alert('Saved', 'Bank account saved.');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const documentMutation = useMutation({
    mutationFn: ({ type, uri }: { type: DocType; uri: string }) =>
      vendorService.uploadDocument(type, uri, 'image/jpeg', `${type}-${Date.now()}.jpg`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-profile'] }),
    onError: (err: any) => Alert.alert('Upload failed', err.response?.data?.error || err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => vendorService.submitForApproval(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-profile'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  if (isLoading) return <Loader fullScreen />;

  const pickDocument = async (type: DocType) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      documentMutation.mutate({ type, uri: result.assets[0].uri });
    }
  };

  const goNext = () => {
    if (step === 0) {
      if (!business.storeName.trim() || !business.panNumber.trim() || !business.city.trim() || !business.state.trim()) {
        Alert.alert('Missing details', 'Fill in store name, PAN number, city and state.');
        return;
      }
      businessMutation.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const canSubmit = uploadedTypes.has('PAN') && uploadedTypes.has('CANCELLED_CHEQUE');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="h2">Seller Registration</Typography>
      <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
        Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
      </Typography>

      <Card style={{ marginTop: 16 }}>
        {step === 0 && (
          <View style={{ gap: 12 }}>
            <Input label="Store / Company Name" value={business.storeName} onChangeText={(v) => setBusiness({ ...business, storeName: v })} />
            <Typography variant="body" style={{ fontWeight: '600' }}>Business Type</Typography>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {BUSINESS_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setBusiness({ ...business, businessType: type })}
                  style={[styles.chip, business.businessType === type && styles.chipActive]}
                >
                  <Typography variant="caption" style={{ color: business.businessType === type ? '#ffffff' : colors.text }}>{type}</Typography>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="GST Number (optional)" value={business.gstNumber} onChangeText={(v) => setBusiness({ ...business, gstNumber: v })} />
            <Input label="PAN Number" autoCapitalize="characters" value={business.panNumber} onChangeText={(v) => setBusiness({ ...business, panNumber: v.toUpperCase() })} />
            <Input label="City" value={business.city} onChangeText={(v) => setBusiness({ ...business, city: v })} />
            <Input label="State" value={business.state} onChangeText={(v) => setBusiness({ ...business, state: v })} />
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: 12 }}>
            <Typography variant="body" style={{ fontWeight: '600' }}>Bank Account</Typography>
            <Input label="Account Holder Name" value={bank.accountHolderName} onChangeText={(v) => setBank({ ...bank, accountHolderName: v })} />
            <Input label="Bank Name" value={bank.bankName} onChangeText={(v) => setBank({ ...bank, bankName: v })} />
            <Input label="Account Number" keyboardType="numeric" value={bank.accountNumber} onChangeText={(v) => setBank({ ...bank, accountNumber: v })} />
            <Input label="IFSC Code" autoCapitalize="characters" value={bank.ifscCode} onChangeText={(v) => setBank({ ...bank, ifscCode: v.toUpperCase() })} />
            <Button title={hasBank ? 'Update Bank Account' : 'Save Bank Account'} onPress={() => bankMutation.mutate()} loading={bankMutation.isPending} />
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 10 }}>
            {DOCUMENT_TYPES.map((doc) => {
              const uploaded = uploadedTypes.has(doc.key);
              return (
                <TouchableOpacity key={doc.key} onPress={() => pickDocument(doc.key)} style={styles.docRow}>
                  {uploaded ? <CheckCircle color={colors.success} size={20} /> : <Circle color={colors.textSecondary} size={20} />}
                  <Typography variant="body" style={{ marginLeft: 10, flex: 1 }}>{doc.label}</Typography>
                  <Typography variant="caption" style={{ color: colors.primary }}>{uploaded ? 'Replace' : 'Upload'}</Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 3 && (
          <View>
            <Typography variant="body">Review your details on the previous steps, then submit for approval. This usually takes 1-2 business days.</Typography>
            {!canSubmit && (
              <View style={styles.missingBox}>
                <Typography variant="body" style={{ color: colors.danger, fontWeight: '700' }}>Missing before you can submit:</Typography>
                {!uploadedTypes.has('PAN') && <Typography variant="caption" style={{ color: colors.danger, marginTop: 4 }}>• PAN Card Copy</Typography>}
                {!uploadedTypes.has('CANCELLED_CHEQUE') && <Typography variant="caption" style={{ color: colors.danger, marginTop: 4 }}>• Cancelled Cheque</Typography>}
              </View>
            )}
            <Button
              title="Submit Application"
              onPress={() => submitMutation.mutate()}
              loading={submitMutation.isPending}
              disabled={!canSubmit}
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 24 }}>
        {step > 0 && <Button title="Back" variant="outline" onPress={goBack} style={{ flex: 1 }} />}
        {step < STEP_TITLES.length - 1 && (
          <Button title="Next" onPress={goNext} loading={businessMutation.isPending} style={{ flex: 1 }} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  missingBox: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#FEE2E2' },
});
