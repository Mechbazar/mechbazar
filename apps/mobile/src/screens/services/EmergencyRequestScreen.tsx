import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { jobService } from '@mechbazar/shared';
import { RootState } from '../../store';
import { VehicleType } from '../../types/product';
import { ServicePackage, ServiceCategory, ServiceAddress } from '../../types/service';
import { fetchServicePackageById } from '../../services/service.service';
import { AddressPickerSheet } from '../../components/services/AddressPickerSheet';
import { colors } from './theme';

// Instant emergency request. Deliberately NOT a variant of ServiceBookingScreen
// -- that screen's SCHEDULE step (date + time slot) has no meaning here: this
// is a breakdown, an admin assigns the nearest available mechanic the moment
// the customer submits, not on a slot someone picks. Rather than thread an
// "emergency mode" flag through every step of the scheduled wizard (and risk
// a future edit to that wizard silently reintroducing a date picker onto this
// flow), this is its own screen with its own four steps: VEHICLE -> ISSUE ->
// ADDRESS -> REVIEW.

type ParamList = { EmergencyRequest: { packageId: string; categoryId: string } };
type Step = 'VEHICLE' | 'ISSUE' | 'ADDRESS' | 'REVIEW';
const STEPS: Step[] = ['VEHICLE', 'ISSUE', 'ADDRESS', 'REVIEW'];

export default function EmergencyRequestScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'EmergencyRequest'>>();
  const { packageId } = route.params;

  const { token } = useSelector((state: RootState) => state.auth);
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const activeVehicleId = useSelector((state: RootState) => state.app.activeVehicleId);

  const [step, setStep] = useState<Step>('VEHICLE');
  const [pkg, setPkg] = useState<ServicePackage | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);

  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(activeVehicleId);
  const [registrationNumber, setRegistrationNumber] = useState('');

  const [issueDescription, setIssueDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [selectedAddress, setSelectedAddress] = useState<ServiceAddress | null>(null);
  const [showAddressSheet, setShowAddressSheet] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServicePackageById(packageId).then((p) => {
      setPkg(p);
      setCategory(p?.category || null);
      setLoadingPkg(false);
    });
  }, [packageId]);

  const selectedGarageVehicle = myGarage.find((v) => v.id === selectedGarageId) || null;
  const vehicleTypeMismatch = !!(category && selectedGarageVehicle && selectedGarageVehicle.vehicleType !== category.vehicleType);

  const stepIndex = STEPS.indexOf(step);
  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const goBackStep = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else navigation.goBack();
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 'VEHICLE': return !!selectedGarageVehicle && !vehicleTypeMismatch;
      case 'ISSUE': return true;
      case 'ADDRESS': return !!selectedAddress && selectedAddress.lat != null && selectedAddress.lng != null;
      default: return true;
    }
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.6, selectionLimit: 5,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const handleSubmit = async () => {
    if (!pkg || !category || !selectedGarageVehicle || !selectedAddress) return;
    setSubmitting(true);
    setError(null);

    const { job, error: err } = await jobService.createEmergencyJob({
      userVehicleId: selectedGarageVehicle.id,
      vehicleType: category.vehicleType as 'CAR' | 'BIKE',
      vehicleBrand: selectedGarageVehicle.brand,
      vehicleModel: selectedGarageVehicle.model,
      vehicleFuelType: selectedGarageVehicle.fuelType,
      vehicleRegistrationNumber: registrationNumber || undefined,
      categoryId: category.id,
      packageId: pkg.id,
      addressId: selectedAddress.id,
      issueDescription: issueDescription || undefined,
      landmark: landmark || undefined,
      // The address already carries geocoded coordinates -- send them
      // explicitly as the job's own pin rather than relying on the backend's
      // address-centroid fallback, since a breakdown is frequently not
      // exactly at a saved address.
      jobLat: selectedAddress.lat ?? undefined,
      jobLng: selectedAddress.lng ?? undefined,
    });

    if (err || !job) {
      setError(err || 'Failed to send your request. Please try again.');
      setSubmitting(false);
      return;
    }

    // Photos attach after the job exists, same best-effort pattern as the
    // scheduled flow -- a failed upload must not block reaching the tracking
    // screen while help is already on its way.
    for (const uri of images) {
      await jobService.uploadPhoto(job.id, uri, 'ISSUE');
    }

    setSubmitting(false);
    navigation.replace('EmergencyTracking', { bookingId: job.id });
  };

  const estimatedCost = pkg ? (pkg.discountPrice ?? pkg.price) : 0;

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={goBackStep} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>🚨 {pkg?.name || 'Emergency Assistance'}</Text>
        <Text style={styles.headerSubtitle}>Step {stepIndex + 1} of {STEPS.length}</Text>
      </View>
    </View>
  );

  const renderProgress = () => (
    <View style={styles.progressRow}>
      {STEPS.map((s, i) => (
        <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
      ))}
    </View>
  );

  const renderVehicleStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>Which vehicle broke down?</Text>
      {myGarage.length === 0 ? (
        <Text style={styles.helperText}>You haven't added a vehicle yet.</Text>
      ) : (
        myGarage.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.vehicleCard, selectedGarageId === v.id && styles.vehicleCardActive]}
            onPress={() => setSelectedGarageId(v.id)}
          >
            <Text style={styles.vehicleIcon}>{v.vehicleType === VehicleType.CAR ? '🚗' : '🏍️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleName}>{v.nickname || `${v.brand} ${v.model}`}</Text>
              <Text style={styles.vehicleMeta}>{v.year} · {v.fuelType}</Text>
            </View>
            {selectedGarageId === v.id && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
          </TouchableOpacity>
        ))
      )}

      {vehicleTypeMismatch && (
        <Text style={styles.errorText}>
          This service is for {category?.vehicleType === VehicleType.CAR ? 'cars' : 'bikes'} — pick a matching vehicle.
        </Text>
      )}

      <TouchableOpacity style={styles.addVehicleBtn} onPress={() => navigation.navigate('VehicleSelection')}>
        <Text style={styles.addVehicleBtnText}>+ Add New Vehicle</Text>
      </TouchableOpacity>

      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Registration Number (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. MH12AB1234"
        placeholderTextColor={colors.textMuted}
        value={registrationNumber}
        onChangeText={setRegistrationNumber}
        autoCapitalize="characters"
      />
    </ScrollView>
  );

  const renderIssueStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>What's wrong?</Text>
      <Text style={styles.helperText}>A quick description helps your mechanic arrive prepared with the right tools.</Text>
      <TextInput
        style={styles.textArea}
        placeholder="e.g. Flat tyre on the highway, car won't start..."
        placeholderTextColor={colors.textMuted}
        value={issueDescription}
        onChangeText={setIssueDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Nearby landmark (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Opposite City Mall, near the flyover"
        placeholderTextColor={colors.textMuted}
        value={landmark}
        onChangeText={setLandmark}
      />

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Photos (optional)</Text>
      <View style={styles.imageRow}>
        {images.map((uri, i) => (
          <View key={uri} style={styles.imageThumbWrap}>
            <Image source={{ uri }} style={styles.imageThumb} />
            <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
              <Text style={styles.imageRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 5 && (
          <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
            <Text style={styles.addImageIcon}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderAddressStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Where are you stuck?</Text>
      <Text style={styles.helperText}>Drop a pin or pick a saved address -- your mechanic is dispatched to this exact spot.</Text>
      {selectedAddress ? (
        <TouchableOpacity style={styles.selectedAddressCard} onPress={() => setShowAddressSheet(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleName}>{selectedAddress.title}</Text>
            <Text style={styles.vehicleMeta}>
              {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
            </Text>
          </View>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.addVehicleBtn} onPress={() => setShowAddressSheet(true)}>
          <Text style={styles.addVehicleBtnText}>Use My Location or Pick on Map</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <View style={styles.urgentBanner}>
        <Text style={styles.urgentIcon}>🚨</Text>
        <Text style={styles.urgentText}>Our team will assign the nearest available mechanic to your request right away.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Service</Text><Text style={styles.summaryValue}>{pkg?.name}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Vehicle</Text><Text style={styles.summaryValue}>{selectedGarageVehicle?.brand} {selectedGarageVehicle?.model}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Location</Text><Text style={styles.summaryValue} numberOfLines={1}>{selectedAddress?.line1}</Text></View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.fieldLabel}>Estimated Cost</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{pkg?.name}</Text>
          <Text style={styles.summaryValue}>₹{estimatedCost}</Text>
        </View>
        <Text style={styles.helperText}>Final cost may change if your mechanic finds additional work -- you'll be asked to approve it first.</Text>
      </View>

      <Text style={styles.helperText}>
        MechBazar is Cash on Service Completion only. You pay your mechanic in cash once the job is
        done and verified -- nothing is charged in advance.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
  );

  if (loadingPkg) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderProgress()}

      {step === 'VEHICLE' && renderVehicleStep()}
      {step === 'ISSUE' && renderIssueStep()}
      {step === 'ADDRESS' && renderAddressStep()}
      {step === 'REVIEW' && renderReviewStep()}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, (!canContinue() || submitting) && styles.continueBtnDisabled]}
          disabled={!canContinue() || submitting}
          onPress={step === 'REVIEW' ? handleSubmit : goNext}
        >
          <Text style={styles.continueBtnText}>
            {submitting ? 'Sending request...' : step === 'REVIEW' ? '🚨 Request Assistance Now' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>

      {token && (
        <AddressPickerSheet
          visible={showAddressSheet}
          token={token}
          onClose={() => setShowAddressSheet(false)}
          onSelect={(addr) => { setSelectedAddress(addr); setShowAddressSheet(false); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.danger },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  progressRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },
  progressDotActive: { backgroundColor: colors.danger },

  stepContent: { padding: 16, paddingBottom: 40 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  helperText: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 10 },

  urgentBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F0', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.danger },
  urgentIcon: { fontSize: 22, marginRight: 10 },
  urgentText: { flex: 1, fontSize: 13, color: colors.textDark, fontWeight: '600', lineHeight: 18 },

  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: colors.borderLight },
  vehicleCardActive: { borderColor: colors.primary, backgroundColor: '#FFF4F1' },
  vehicleIcon: { fontSize: 26, marginRight: 12 },
  vehicleName: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 3 },
  vehicleMeta: { fontSize: 12, color: colors.textMuted },

  addVehicleBtn: { borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6 },
  addVehicleBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  input: { backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textDark, borderWidth: 1, borderColor: colors.borderLight },
  textArea: { backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 14, color: colors.textDark, borderWidth: 1, borderColor: colors.borderLight, minHeight: 100 },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: 72, height: 72, borderRadius: 10 },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: colors.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  imageRemoveText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  addImageBtn: { width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderColor: colors.borderLight, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addImageIcon: { fontSize: 24, color: colors.textMuted },

  selectedAddressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  changeText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  summaryCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  summaryValue: { fontSize: 13, color: colors.textDark, fontWeight: '700', flex: 1.4, textAlign: 'right' },

  errorText: { color: colors.danger, fontSize: 13, marginTop: 8, marginBottom: 4 },

  footer: { padding: 16, paddingBottom: 28, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.borderLight },
  continueBtn: { backgroundColor: colors.danger, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: '#F0B2A5' },
  continueBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
