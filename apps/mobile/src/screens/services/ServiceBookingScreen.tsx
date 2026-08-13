import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { RootState } from '../../store';
import { VehicleType } from '../../types/product';
import { ServicePackage, ServiceCategory, TimeSlot, ServiceAddress } from '../../types/service';
import { fetchServicePackageById, fetchTimeSlots, createServiceBooking, uploadBookingImage } from '../../services/service.service';
import { AddressPickerSheet } from '../../components/services/AddressPickerSheet';
import { useStableIsDesktopUp } from '../../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../../components/desktop/shared/CompactBookingShell';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

type ParamList = { ServiceBooking: { packageId: string; categoryId: string } };

// File-local copy of screens/services/theme.ts's shared `colors` export,
// trimmed to the keys this screen actually uses -- theme.ts itself stays
// untouched (it's a static, light-only palette consumed by several other
// screens/components that haven't been converted yet).
// `white` stays pure white in both themes -- text/icons on the permanently-
// dark header bar and on colored buttons, never a card background here.
// `surface` is the actual input/card background (vehicle cards, text
// inputs, day/slot chips, summary cards, footer) and is the one that
// inverts. `primaryTint` is the pale "selected vehicle card" tint -- it was
// a hardcoded '#FFF4F1' that never changed, which would have left near-
// white ink text illegible against it in dark mode, so it's now a real
// dynamic token instead.
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  danger: '#D32F2F',
  surface: '#FFFFFF',
  primaryTint: '#FFF4F1',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#F1F2F4',
  pageBg: '#121212',
  white: '#FFFFFF',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  danger: '#FF6B6B',
  surface: '#1E1E1E',
  primaryTint: '#3A2420',
};
type Step = 'VEHICLE' | 'ISSUE' | 'ADDRESS' | 'SCHEDULE' | 'REVIEW';
const STEPS: Step[] = ['VEHICLE', 'ISSUE', 'ADDRESS', 'SCHEDULE', 'REVIEW'];

const nextDays = (count: number) => {
  const days: { date: string; label: string; weekday: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.getDate().toString(),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  return days;
};

export default function ServiceBookingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ServiceBooking'>>();
  const { t } = useTranslation();
  const { packageId } = route.params;

  const { token } = useSelector((state: RootState) => state.auth);
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const activeVehicleId = useSelector((state: RootState) => state.app.activeVehicleId);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('VEHICLE');
  const [pkg, setPkg] = useState<ServicePackage | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);

  // Vehicle
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(activeVehicleId);
  const [registrationNumber, setRegistrationNumber] = useState('');

  // Issue
  const [issueDescription, setIssueDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);

  // Address
  const [selectedAddress, setSelectedAddress] = useState<ServiceAddress | null>(null);
  const [showAddressSheet, setShowAddressSheet] = useState(false);

  // Schedule
  const days = useMemo(() => nextDays(7), []);
  const [selectedDate, setSelectedDate] = useState(days[0].date);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Payment / submit. COD is the only method MechBazar supports -- there is no
  // payment gateway anywhere in the product, so this is a constant rather than
  // selectable state. The radio row below is kept purely so the user can see
  // what they are being charged and how.
  const paymentMethod = 'COD' as const;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDesktopUp = useStableIsDesktopUp();
  // Opts this screen into DesktopAppShell's "full page" mode on desktop --
  // skips the shell's default box+footer so this wizard gets the shorter
  // header and no marketing footer while it's the focused screen. Native/
  // mobile-web unaffected (isDesktopUp is always false there).
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  useEffect(() => {
    fetchServicePackageById(packageId).then((p) => {
      setPkg(p);
      setCategory(p?.category || null);
      setLoadingPkg(false);
    });
  }, [packageId]);

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlotId(null);
    fetchTimeSlots(selectedDate).then((slots) => {
      setTimeSlots(slots);
      setLoadingSlots(false);
    });
  }, [selectedDate]);

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
      case 'ADDRESS': return !!selectedAddress;
      case 'SCHEDULE': return !!selectedSlotId;
      default: return true;
    }
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.6,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const handleSubmit = async () => {
    if (!pkg || !category || !selectedGarageVehicle || !selectedAddress || !selectedSlotId || !token) return;
    setSubmitting(true);
    setError(null);

    const { booking, error: err } = await createServiceBooking(token, {
      // Garage vehicles now live on the backend (real UserVehicle rows), so the
      // booking links to the row; the snapshot fields below still travel so the
      // booking survives the vehicle later being edited.
      userVehicleId: selectedGarageVehicle.id,
      vehicleType: category.vehicleType,
      vehicleBrand: selectedGarageVehicle.brand,
      vehicleModel: selectedGarageVehicle.model,
      vehicleFuelType: selectedGarageVehicle.fuelType,
      vehicleRegistrationNumber: registrationNumber || null,
      categoryId: category.id,
      packageId: pkg.id,
      addressId: selectedAddress.id,
      scheduledDate: selectedDate,
      timeSlotId: selectedSlotId,
      issueDescription: issueDescription || undefined,
      payment_method: paymentMethod,
    });

    if (err || !booking) {
      setError(err || t('serviceBooking.failedToCreateBooking'));
      setSubmitting(false);
      return;
    }

    // Best-effort: upload attached photos after the booking exists. A failed
    // upload shouldn't block the customer from reaching their confirmed booking.
    for (const uri of images) {
      await uploadBookingImage(token, booking.id, uri, 'ISSUE');
    }

    setSubmitting(false);
    navigation.replace('ServiceTracking', { bookingId: booking.id });
  };

  const finalCost = pkg ? (pkg.discountPrice ?? pkg.price) : 0;

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={goBackStep} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{pkg?.name || t('serviceBooking.bookService')}</Text>
        <Text style={styles.headerSubtitle}>{t('serviceBooking.stepOf', { current: stepIndex + 1, total: STEPS.length })}</Text>
      </View>
    </View>
  );

  const renderProgress = () => (
    <CompactBookingShell>
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
        ))}
      </View>
    </CompactBookingShell>
  );

  const renderVehicleStep = () => (
    <CompactBookingShell style={styles.flexFill}>
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceBooking.whichVehicle')}</Text>
      {myGarage.length === 0 ? (
        <Text style={styles.helperText}>{t('serviceBooking.noVehicleYet')}</Text>
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
          {t('serviceBooking.serviceForMismatch', { type: category?.vehicleType === VehicleType.CAR ? t('serviceBooking.serviceForCars') : t('serviceBooking.serviceForBikes') })}
        </Text>
      )}

      <TouchableOpacity style={styles.addVehicleBtn} onPress={() => navigation.navigate('VehicleSelection')}>
        <Text style={styles.addVehicleBtnText}>{t('serviceBooking.addNewVehicle')}</Text>
      </TouchableOpacity>

      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t('serviceBooking.registrationNumberOptional')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('serviceBooking.regNumberPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={registrationNumber}
        onChangeText={setRegistrationNumber}
        autoCapitalize="characters"
      />
    </ScrollView>
    </CompactBookingShell>
  );

  const renderIssueStep = () => (
    <CompactBookingShell style={styles.flexFill}>
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceBooking.describeIssue')}</Text>
      <Text style={styles.helperText}>{t('serviceBooking.describeIssueHelper')}</Text>
      <TextInput
        style={styles.textArea}
        placeholder={t('serviceBooking.issuePlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={issueDescription}
        onChangeText={setIssueDescription}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t('serviceBooking.photosOptional')}</Text>
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
    </CompactBookingShell>
  );

  const renderAddressStep = () => (
    <CompactBookingShell style={styles.flexFill}>
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceBooking.whereShouldMechanicCome')}</Text>
      {selectedAddress ? (
        <TouchableOpacity style={styles.selectedAddressCard} onPress={() => setShowAddressSheet(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleName}>{selectedAddress.title}</Text>
            <Text style={styles.vehicleMeta}>
              {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
            </Text>
          </View>
          <Text style={styles.changeText}>{t('cart.change')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.addVehicleBtn} onPress={() => setShowAddressSheet(true)}>
          <Text style={styles.addVehicleBtnText}>{t('serviceBooking.selectSavedAddressOrAddNew')}</Text>
        </TouchableOpacity>
      )}
    </View>
    </CompactBookingShell>
  );

  const renderScheduleStep = () => (
    <CompactBookingShell style={styles.flexFill}>
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceBooking.pickDateTime')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {days.map((d) => (
          <TouchableOpacity
            key={d.date}
            style={[styles.dayChip, selectedDate === d.date && styles.dayChipActive]}
            onPress={() => setSelectedDate(d.date)}
          >
            <Text style={[styles.dayChipWeekday, selectedDate === d.date && styles.dayChipTextActive]}>{d.weekday}</Text>
            <Text style={[styles.dayChipDate, selectedDate === d.date && styles.dayChipTextActive]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.fieldLabel}>{t('serviceBooking.availableTimeSlots')}</Text>
      {loadingSlots ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.slotGrid}>
          {timeSlots.map((slot) => (
            <TouchableOpacity
              key={slot.id}
              disabled={slot.available === false}
              style={[
                styles.slotChip,
                selectedSlotId === slot.id && styles.slotChipActive,
                slot.available === false && styles.slotChipDisabled,
              ]}
              onPress={() => setSelectedSlotId(slot.id)}
            >
              <Text style={[
                styles.slotChipText,
                selectedSlotId === slot.id && styles.slotChipTextActive,
                slot.available === false && styles.slotChipTextDisabled,
              ]}>
                {slot.label}
              </Text>
            </TouchableOpacity>
          ))}
          {timeSlots.length === 0 && <Text style={styles.helperText}>{t('serviceBooking.noTimeSlotsConfigured')}</Text>}
        </View>
      )}
    </ScrollView>
    </CompactBookingShell>
  );

  const renderReviewStep = () => (
    <CompactBookingShell style={styles.flexFill}>
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceBooking.reviewAndPay')}</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('serviceBooking.service')}</Text><Text style={styles.summaryValue}>{pkg?.name}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('serviceBooking.vehicle')}</Text><Text style={styles.summaryValue}>{selectedGarageVehicle?.brand} {selectedGarageVehicle?.model}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('serviceBooking.address')}</Text><Text style={styles.summaryValue} numberOfLines={1}>{selectedAddress?.line1}</Text></View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('serviceBooking.slot')}</Text>
          <Text style={styles.summaryValue}>{selectedDate} · {timeSlots.find((s) => s.id === selectedSlotId)?.label}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.fieldLabel}>{t('serviceBooking.estimatedCost')}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{pkg?.name}</Text>
          <Text style={styles.summaryValue}>₹{finalCost}</Text>
        </View>
        <Text style={styles.helperText}>{t('serviceBooking.finalCostMayChange')}</Text>
      </View>

      <Text style={styles.fieldLabel}>{t('serviceBooking.paymentMethod')}</Text>
      <View style={[styles.paymentRow, styles.paymentRowActive]}>
        <View style={[styles.radioCircle, styles.radioCircleActive]}><View style={styles.radioDot} /></View>
        <Text style={styles.paymentText}>{t('serviceBooking.cashOnServiceCompletion')}</Text>
      </View>
      {/* MechBazar is Cash on Delivery only -- no payment gateway is
          integrated. A greyed-out "Pay Online (UPI / Card / Net Banking)" row
          used to sit here; it advertised a payment method that does not exist,
          which both stores treat as misleading functionality and which
          contradicts every published policy page. */}
      <Text style={styles.helperText}>
        {t('serviceBooking.codOnlyNotice')}
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
    </CompactBookingShell>
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

  if (!pkg || !category) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>😕</Text>
          <Text style={styles.stepTitle}>{t('serviceBooking.serviceNotFound')}</Text>
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
      {step === 'SCHEDULE' && renderScheduleStep()}
      {step === 'REVIEW' && renderReviewStep()}

      <View style={styles.footer}>
        <CompactBookingShell>
          <TouchableOpacity
            style={[styles.continueBtn, (!canContinue() || submitting) && styles.continueBtnDisabled]}
            disabled={!canContinue() || submitting}
            onPress={step === 'REVIEW' ? handleSubmit : goNext}
          >
            <Text style={styles.continueBtnText}>
              {submitting ? t('serviceBooking.placingBooking') : step === 'REVIEW' ? t('serviceBooking.confirmBooking', { cost: finalCost }) : t('common.continue')}
            </Text>
          </TouchableOpacity>
        </CompactBookingShell>
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

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  // Passed as CompactBookingShell's `style` prop so its desktop-only wrapper
  // View keeps filling the available height (matching what the ScrollView/
  // View it wraps would have gotten as a direct flex sibling) while also
  // gaining the horizontal max-width cap + centering.
  flexFill: { flex: 1 },
  // Permanently-dark branded header bar -- pinned fixed (see ServiceCategoryScreen).
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: LIGHT_COLORS.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 12, color: '#9AA5B1', marginTop: 2 },

  progressRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },
  progressDotActive: { backgroundColor: colors.primary },

  stepContent: { padding: 16, paddingBottom: 40 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  helperText: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 10 },

  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: colors.borderLight },
  vehicleCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  vehicleIcon: { fontSize: 26, marginRight: 12 },
  vehicleName: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 3 },
  vehicleMeta: { fontSize: 12, color: colors.textMuted },

  addVehicleBtn: { borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6 },
  addVehicleBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textDark, borderWidth: 1, borderColor: colors.borderLight },
  textArea: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 14, color: colors.textDark, borderWidth: 1, borderColor: colors.borderLight, minHeight: 110 },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: 72, height: 72, borderRadius: 10 },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: colors.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  imageRemoveText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  addImageBtn: { width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderColor: colors.borderLight, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addImageIcon: { fontSize: 24, color: colors.textMuted },

  selectedAddressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  changeText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  dayChip: { width: 56, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surface, marginRight: 10, borderWidth: 1, borderColor: colors.borderLight },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipWeekday: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
  dayChipDate: { fontSize: 16, color: colors.textDark, fontWeight: '800' },
  dayChipTextActive: { color: colors.white },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotChipDisabled: { opacity: 0.4 },
  slotChipText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  slotChipTextActive: { color: colors.white },
  slotChipTextDisabled: { color: colors.textMuted },

  summaryCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  summaryValue: { fontSize: 13, color: colors.textDark, fontWeight: '700', flex: 1.4, textAlign: 'right' },

  paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: colors.borderLight },
  paymentRowActive: { borderColor: colors.primary },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioCircleActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  paymentText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  comingSoonBadge: { marginLeft: 8, fontSize: 10, fontWeight: '700', color: colors.textMuted, backgroundColor: colors.borderLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },

  errorText: { color: colors.danger, fontSize: 13, marginTop: 8, marginBottom: 4 },

  footer: { padding: 16, paddingBottom: 28, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  continueBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: '#F0B2A5' },
  continueBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
});
