import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, Typography, Card, Button, Input, Loader, riderService } from '@mechbazar/shared';
import { Camera, CheckCircle, Circle } from 'lucide-react-native';

type DocType = 'AADHAAR' | 'DL_FRONT' | 'DL_BACK' | 'RC' | 'INSURANCE' | 'PUC';

const DOCUMENT_TYPES: { key: DocType; label: string }[] = [
  { key: 'AADHAAR', label: 'Aadhaar Card' },
  { key: 'DL_FRONT', label: 'Driving License (Front)' },
  { key: 'DL_BACK', label: 'Driving License (Back)' },
  { key: 'RC', label: 'Registration Certificate (RC)' },
  { key: 'INSURANCE', label: 'Vehicle Insurance' },
  { key: 'PUC', label: 'PUC Certificate (if applicable)' },
];

const STEP_TITLES = ['Personal & Address', 'Vehicle Details', 'Documents', 'Bank & UPI', 'Emergency Contact', 'Selfie', 'Review & Submit'];

// A single scrollable step-wizard rather than 7 separate navigator screens --
// same step-by-step UX (one section visible at a time, Next/Back), far less
// navigation-state/param-passing plumbing for what's ultimately one flat form
// submitted incrementally to PATCH /riders/me/registration.
export const RegistrationScreen = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const { data: profile, isLoading } = useQuery({ queryKey: ['rider-profile'], queryFn: riderService.getProfile });

  const [form, setForm] = useState({
    addressLine: '', city: '', state: '', pincode: '', aadhaarNumber: '',
    vehicleType: 'BIKE', vehicleModel: '', vehicleRegistrationNumber: '', licenseNumber: '',
    insurancePolicyNumber: '', pucNumber: '',
    upiId: '', emergencyContactName: '', emergencyContactPhone: '',
  });
  const [bankForm, setBankForm] = useState({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);

  // Pre-fill from whatever's already saved (relevant on resubmission after a
  // rejection, or if the app was closed mid-wizard).
  useEffect(() => {
    if (!profile) return;
    setForm((prev) => ({
      ...prev,
      addressLine: profile.addressLine || '',
      city: profile.city || '',
      state: profile.state || '',
      pincode: profile.pincode || '',
      aadhaarNumber: profile.aadhaarNumber || '',
      vehicleType: profile.vehicleType && profile.vehicleType !== 'UNSPECIFIED' ? profile.vehicleType : 'BIKE',
      vehicleModel: profile.vehicleModel || '',
      vehicleRegistrationNumber: profile.vehicleRegistrationNumber || '',
      licenseNumber: profile.licenseNumber && profile.licenseNumber !== 'PENDING' ? profile.licenseNumber : '',
      insurancePolicyNumber: profile.insurancePolicyNumber || '',
      pucNumber: profile.pucNumber || '',
      upiId: profile.upiId || '',
      emergencyContactName: profile.emergencyContactName || '',
      emergencyContactPhone: profile.emergencyContactPhone || '',
    }));
    if (profile.bankAccounts?.[0]) {
      const b = profile.bankAccounts[0];
      setBankForm({ accountHolderName: b.accountHolderName, bankName: b.bankName, accountNumber: b.accountNumber, ifscCode: b.ifscCode });
    }
  }, [profile]);

  const uploadedTypes = new Set<string>((profile?.documents || []).map((d: any) => d.type));
  const hasSelfie = uploadedTypes.has('SELFIE');
  const hasBank = !!profile?.bankAccounts?.length;

  const registrationMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => riderService.updateRegistration(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const bankMutation = useMutation({
    mutationFn: () => riderService.addBankAccount(bankForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-profile'] });
      Alert.alert('Saved', 'Bank account saved.');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const documentMutation = useMutation({
    mutationFn: ({ type, uri }: { type: string; uri: string }) =>
      riderService.uploadDocument(type, uri, 'image/jpeg', `${type}-${Date.now()}.jpg`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
    onError: (err: any) => Alert.alert('Upload failed', err.response?.data?.error || err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => riderService.submitForApproval(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
    onError: (err: any) => {
      const missing = err.response?.data?.missing;
      if (Array.isArray(missing)) {
        setMissingItems(missing);
      } else {
        Alert.alert('Error', err.response?.data?.error || err.message);
      }
    },
  });

  if (isLoading) return <Loader fullScreen />;

  const pickDocument = async (type: DocType) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      documentMutation.mutate({ type, uri: result.assets[0].uri });
    }
  };

  const captureSelfie = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Enable camera access to take your selfie.');
      return;
    }
    // Camera-only, no gallery picker -- this is the agreed "liveness" bar for
    // this app (a genuine anti-spoof check needs a 3rd-party vendor, which is
    // out of scope; camera-only + manual admin review deters a casual photo-
    // of-a-photo swap).
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, cameraType: ImagePicker.CameraType.front });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setSelfieUri(uri);
      documentMutation.mutate({ type: 'SELFIE', uri });
    }
  };

  const goNext = async () => {
    if (step === 0) {
      if (!form.addressLine.trim() || !form.city.trim() || !form.pincode.trim() || !form.aadhaarNumber.trim()) {
        Alert.alert('Missing details', 'Fill in your address and Aadhaar number.');
        return;
      }
      await registrationMutation.mutateAsync({
        addressLine: form.addressLine, city: form.city, state: form.state, pincode: form.pincode, aadhaarNumber: form.aadhaarNumber,
      });
    } else if (step === 1) {
      if (!form.vehicleModel.trim() || !form.vehicleRegistrationNumber.trim() || !form.licenseNumber.trim()) {
        Alert.alert('Missing details', 'Fill in your vehicle model, registration number, and license number.');
        return;
      }
      await registrationMutation.mutateAsync({
        vehicleType: form.vehicleType, vehicleModel: form.vehicleModel,
        vehicleRegistrationNumber: form.vehicleRegistrationNumber, licenseNumber: form.licenseNumber,
        insurancePolicyNumber: form.insurancePolicyNumber, pucNumber: form.pucNumber,
      });
    } else if (step === 4) {
      await registrationMutation.mutateAsync({
        upiId: form.upiId, emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone,
      });
    }
    setMissingItems([]);
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="h2">Rider Registration</Typography>
      <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
        Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
      </Typography>

      <Card style={{ marginTop: 16 }}>
        {step === 0 && (
          <View style={{ gap: 12 }}>
            <Input label="Address Line" value={form.addressLine} onChangeText={(v) => setForm({ ...form, addressLine: v })} />
            <Input label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
            <Input label="State" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
            <Input label="Pincode" keyboardType="numeric" value={form.pincode} onChangeText={(v) => setForm({ ...form, pincode: v })} />
            <Input label="Aadhaar Number" keyboardType="numeric" value={form.aadhaarNumber} onChangeText={(v) => setForm({ ...form, aadhaarNumber: v })} />
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: 12 }}>
            <Typography variant="body" style={{ fontWeight: '600' }}>Vehicle Type</Typography>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['BIKE', 'SCOOTER'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setForm({ ...form, vehicleType: type })}
                  style={[styles.chip, form.vehicleType === type && styles.chipActive]}
                >
                  <Typography variant="caption" style={{ color: form.vehicleType === type ? '#ffffff' : colors.text }}>{type}</Typography>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Vehicle Model" value={form.vehicleModel} onChangeText={(v) => setForm({ ...form, vehicleModel: v })} />
            <Input label="Vehicle Registration Number (RC No.)" autoCapitalize="characters" value={form.vehicleRegistrationNumber} onChangeText={(v) => setForm({ ...form, vehicleRegistrationNumber: v.toUpperCase() })} />
            <Input label="Driving License Number" autoCapitalize="characters" value={form.licenseNumber} onChangeText={(v) => setForm({ ...form, licenseNumber: v.toUpperCase() })} />
            <Input label="Insurance Policy Number" value={form.insurancePolicyNumber} onChangeText={(v) => setForm({ ...form, insurancePolicyNumber: v })} />
            <Input label="PUC Certificate Number (if applicable)" value={form.pucNumber} onChangeText={(v) => setForm({ ...form, pucNumber: v })} />
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
          <View style={{ gap: 12 }}>
            <Typography variant="body" style={{ fontWeight: '600' }}>Bank Account</Typography>
            <Input label="Account Holder Name" value={bankForm.accountHolderName} onChangeText={(v) => setBankForm({ ...bankForm, accountHolderName: v })} />
            <Input label="Bank Name" value={bankForm.bankName} onChangeText={(v) => setBankForm({ ...bankForm, bankName: v })} />
            <Input label="Account Number" keyboardType="numeric" value={bankForm.accountNumber} onChangeText={(v) => setBankForm({ ...bankForm, accountNumber: v })} />
            <Input label="IFSC Code" autoCapitalize="characters" value={bankForm.ifscCode} onChangeText={(v) => setBankForm({ ...bankForm, ifscCode: v.toUpperCase() })} />
            <Button title={hasBank ? 'Update Bank Account' : 'Save Bank Account'} variant="outline" onPress={() => bankMutation.mutate()} loading={bankMutation.isPending} />
            <Input label="UPI ID" autoCapitalize="none" value={form.upiId} onChangeText={(v) => setForm({ ...form, upiId: v })} />
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 12 }}>
            <Input label="Emergency Contact Name" value={form.emergencyContactName} onChangeText={(v) => setForm({ ...form, emergencyContactName: v })} />
            <Input label="Emergency Contact Phone" keyboardType="phone-pad" value={form.emergencyContactPhone} onChangeText={(v) => setForm({ ...form, emergencyContactPhone: v })} />
          </View>
        )}

        {step === 5 && (
          <View style={{ alignItems: 'center' }}>
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
            ) : hasSelfie ? (
              <View style={styles.selfiePlaceholder}>
                <CheckCircle color={colors.success} size={32} />
                <Typography variant="caption" style={{ marginTop: 8 }}>Selfie already uploaded</Typography>
              </View>
            ) : (
              <TouchableOpacity onPress={captureSelfie} style={styles.selfiePlaceholder}>
                <Camera color={colors.textSecondary} size={32} />
                <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 8 }}>Take a live selfie</Typography>
              </TouchableOpacity>
            )}
            {(selfieUri || hasSelfie) && (
              <Button title="Retake Selfie" variant="outline" onPress={captureSelfie} style={{ marginTop: 12 }} />
            )}
          </View>
        )}

        {step === 6 && (
          <View>
            <Typography variant="body">Review your details on the previous steps, then submit for review.</Typography>
            {missingItems.length > 0 && (
              <View style={styles.missingBox}>
                <Typography variant="body" style={{ color: colors.danger, fontWeight: '700' }}>Missing before you can submit:</Typography>
                {missingItems.map((m) => (
                  <Typography key={m} variant="caption" style={{ color: colors.danger, marginTop: 4 }}>• {m}</Typography>
                ))}
              </View>
            )}
            <Button
              title="Submit for Review"
              onPress={() => submitMutation.mutate()}
              loading={submitMutation.isPending}
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 24 }}>
        {step > 0 && <Button title="Back" variant="outline" onPress={goBack} style={{ flex: 1 }} />}
        {step < STEP_TITLES.length - 1 && (
          <Button title="Next" onPress={goNext} loading={registrationMutation.isPending} style={{ flex: 1 }} />
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
  selfiePreview: { width: 160, height: 160, borderRadius: 80 },
  selfiePlaceholder: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  missingBox: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#FEE2E2' },
});
