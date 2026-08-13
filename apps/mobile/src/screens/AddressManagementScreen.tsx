import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  TextInput,
  ActivityIndicator, 
  Modal, 
  Platform,
  ScrollView,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import AddressMapPicker from '../components/shared/maps/AddressMapPicker';
import PlaceAutocompleteField from '../components/shared/PlaceAutocompleteField';
import {
  fetchMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  checkPincodeServiceable
} from '../services/address.service';
import { locationService } from '../services/location.service';
import { reverseGeocode, GeocodeSuccess } from '../services/geocode.service';
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';
import { notify, confirm } from '../utils/notify';

// `secondary` is a fixed dark header/button bar (already dark in light mode),
// deliberately unchanged in dark mode. `white` is text-on-that-bar blended
// with card backgrounds -- `surface` is the one that actually inverts.
const LIGHT_COLORS = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
  success: '#34C759',
  warning: '#F5A300',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  pageBg: '#121212',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  lightGray: '#1E1E1E',
  success: '#4FE092',
  warning: '#F5B94D',
};

export default function AddressManagementScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // States
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);

  // Form input states
  const [title, setTitle] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [formattedAddress, setFormattedAddress] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [fetchingGPS, setFetchingGPS] = useState(false);
  // null = not checked yet (or check failed/inconclusive) -- only ever shows
  // the warning on a confirmed `false`, never blocks typing or saving.
  const [pincodeServiceable, setPincodeServiceable] = useState<boolean | null>(null);
  // Kept separate from `loading` (which drives the list spinner) so the modal's
  // save button reflects only the save request -- and so an in-flight save can
  // actually disable the button instead of just relabelling it.
  const [saving, setSaving] = useState(false);

  const isDesktopUp = useStableIsDesktopUp();
  useFocusEffect(
    React.useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const loadAddresses = async () => {
    if (!token) return;
    setLoading(true);
    const data = await fetchMyAddresses(token);
    setAddresses(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAddresses();
  }, [token]);

  // Non-blocking heads-up only -- saving and checkout both still work
  // regardless; this just tells the customer up front instead of them only
  // finding out at "Place Order" that the pincode isn't covered yet. Debounced
  // so it doesn't fire a request per keystroke, and only ever fires on a
  // complete 6-digit pincode.
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
      setPincodeServiceable(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkPincodeServiceable(pincode);
      if (!cancelled) setPincodeServiceable(result);
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pincode]);

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setTitle('Home');
    setLine1('');
    setLine2('');
    setCity('');
    setState('');
    setPincode('');
    setCountry(null);
    setLat(null);
    setLng(null);
    setPlaceId(null);
    setFormattedAddress(null);
    setIsDefault(false);
    setPincodeServiceable(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (addr: any) => {
    setEditingAddress(addr);
    setTitle(addr.title);
    setLine1(addr.line1);
    setLine2(addr.line2 || '');
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
    setPincodeServiceable(null);
    setCountry(addr.country ?? null);
    setLat(addr.lat ?? null);
    setLng(addr.lng ?? null);
    setPlaceId(addr.placeId ?? null);
    setFormattedAddress(addr.formattedAddress ?? null);
    setIsDefault(addr.isDefault);
    setModalVisible(true);
  };

  // Shared by GPS detect, pin drag, and Places Autocomplete selection -- all
  // three represent the user pointing at a new location, so all three sync
  // every field to match, INCLUDING clearing a field this result has no
  // component for (e.g. switching from an address with a pincode to one
  // without) -- a component that's merely absent must not leave a previous
  // location's stale value sitting in the form.
  const applyGeocodeResult = (result: GeocodeSuccess) => {
    setLat(result.lat);
    setLng(result.lng);
    setPlaceId(result.placeId);
    setFormattedAddress(result.formattedAddress);
    setLine1(result.components.line1 || '');
    setCity(result.components.city || '');
    setState(result.components.state || '');
    setPincode(result.components.pincode || '');
    setCountry(result.components.country || null);
  };

  const handleGPSDetect = async () => {
    setFetchingGPS(true);
    try {
      const coords = await locationService.getCurrentLocation();
      if (!coords) {
        notify('GPS Error', 'Failed to retrieve coordinates. Please check your permissions.');
        return;
      }
      if (!token) return;
      const result = await reverseGeocode(token, coords.latitude, coords.longitude);
      if (result.ok) {
        applyGeocodeResult(result);
        notify('GPS Success', 'Location loaded successfully!');
      } else {
        // Still keep the raw coordinates even if reverse geocoding is
        // unavailable -- the pin/lat/lng are still useful without an address.
        setLat(coords.latitude);
        setLng(coords.longitude);
        notify('GPS Error', 'Got your location, but could not resolve it to an address. You can drop the pin manually.');
      }
    } catch (e) {
      console.error(e);
      notify('GPS Error', 'An error occurred while loading GPS.');
    } finally {
      setFetchingGPS(false);
    }
  };

  const handleMapPinChange = async (coords: { latitude: number; longitude: number }) => {
    // Always reflect the pin's raw position immediately; the address text
    // fields catch up once reverse geocoding resolves (or don't, if it's
    // unavailable -- the coordinates alone are still saved correctly).
    setLat(coords.latitude);
    setLng(coords.longitude);
    if (!token) return;
    const result = await reverseGeocode(token, coords.latitude, coords.longitude);
    if (result.ok) applyGeocodeResult(result);
  };

  const handleAutocompleteSelect = (result: GeocodeSuccess) => {
    applyGeocodeResult(result);
  };

  const handleSave = async () => {
    if (!token) return;
    if (saving) return; // guard against a double tap creating two addresses

    // `state` is required by POST/PUT /customers/me/addresses (see
    // customer.controller.ts). It was missing from this check, so a blank
    // State field passed client validation and came back as a 400 -- the
    // single most common "I can't save my address" failure. Validate exactly
    // the set the backend enforces, and name the offending fields.
    const missing = [
      [title, 'Address label'],
      [line1, 'Address line 1'],
      [city, 'City'],
      [state, 'State'],
      [pincode, 'Pincode'],
    ].filter(([value]) => !String(value ?? '').trim()).map(([, label]) => label);

    if (missing.length > 0) {
      notify('Missing details', `Please fill in: ${missing.join(', ')}.`);
      return;
    }

    // Trim on the way out so a stray space can't satisfy validation here and
    // then be stored (or fail) server-side.
    const payload = {
      title: title.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country,
      lat,
      lng,
      placeId,
      formattedAddress,
      isDefault,
    };

    setSaving(true);
    try {
      if (editingAddress) {
        // Edit mode
        const res = await updateMyAddress(token, editingAddress.id, payload);
        if (res.address) {
          setModalVisible(false);
          await loadAddresses();
          notify('Success', 'Address updated successfully!');
        } else {
          notify('Error', res.error || 'Failed to update address.');
        }
      } else {
        // Create mode
        const res = await createMyAddress(token, payload);
        if (res.address) {
          setModalVisible(false);
          await loadAddresses();
          notify('Success', 'Address created successfully!');
        } else {
          notify('Error', res.error || 'Failed to create address.');
        }
      }
    } finally {
      // Always clear, so a thrown/rejected save can't wedge the button in a
      // permanently disabled "Saving..." state.
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    confirm('Delete Address', 'Are you sure you want to delete this address?', async () => {
      if (!token) return;
      setLoading(true);
      const res = await deleteMyAddress(token, id);
      if (res.ok) {
        loadAddresses();
        notify('Success', 'Address deleted successfully.');
      } else {
        notify('Error', res.error || 'Failed to delete address.');
      }
      setLoading(false);
    }, 'Delete');
  };

  const handleSetDefault = async (addr: any) => {
    if (!token) return;
    setLoading(true);
    const res = await updateMyAddress(token, addr.id, { isDefault: true });
    if (res.address) {
      loadAddresses();
    } else {
      notify('Error', res.error || 'Failed to update address default status.');
    }
    setLoading(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.isDefault && styles.cardDefault]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleBadgeRow}>
          <Text style={styles.addressTitle}>{item.title}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>{t('address.default')}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardHeaderActions}>
          <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={styles.actionIcon}>
            <Ionicons name="create-outline" size={18} color={colors.textDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionIcon}>
            <Ionicons name="trash-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.addressLine}>{item.line1}</Text>
      {item.line2 ? <Text style={styles.addressLine}>{item.line2}</Text> : null}
      <Text style={styles.addressLine}>{item.city}, {item.state} - {item.pincode}</Text>

      {!item.isDefault && (
        <TouchableOpacity style={styles.setDefaultBtn} onPress={() => handleSetDefault(item)}>
          <Text style={styles.setDefaultText}>{t('address.setAsDefault')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('address.savedAddresses')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && !modalVisible && (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>{t('address.noSavedAddresses')}</Text>
                <Text style={styles.emptySubtitle}>{t('address.noSavedAddressesSubtitle')}</Text>
              </View>
            ) : null
          }
        />
      </CompactBookingShell>

      <CompactBookingShell maxWidth={880}>
        <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
          <Text style={styles.addButtonText}>{t('address.addNewAddress')}</Text>
        </TouchableOpacity>
        <MinimalFooter />
      </CompactBookingShell>

      {/* Address Form Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingAddress ? t('address.editAddress') : t('address.newAddress')}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textDark} />
                </TouchableOpacity>
              </View>

              {/* GPS Auto-detect */}
              <TouchableOpacity
                style={styles.gpsDetectBtn}
                onPress={handleGPSDetect}
                disabled={fetchingGPS}
              >
                <Ionicons name="locate-outline" size={16} color={colors.white} />
                <Text style={styles.gpsDetectText}>
                  {fetchingGPS ? t('address.locating') : t('address.getCurrentGpsLocation')}
                </Text>
              </TouchableOpacity>

              {token && (
                <View style={{ marginTop: 4, marginBottom: 12 }}>
                  <PlaceAutocompleteField token={token} onSelect={handleAutocompleteSelect} placeholder={t('address.searchForAddress')} />
                </View>
              )}

              {/* Draggable pin confirmation for the detected/searched/entered
                  address -- falls back to an honest placeholder when no
                  Google Maps key is configured (see config/maps.ts). */}
              <View style={{ marginBottom: 4 }}>
                <AddressMapPicker latitude={lat} longitude={lng} onChange={handleMapPinChange} height={160} />
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('address.addressLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Home"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('address.flatStreetName')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textMuted}
                    value={line1}
                    onChangeText={setLine1}
                    placeholder={t('address.placeholderLine1')}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('address.landmarkLocality')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textMuted}
                    value={line2}
                    onChangeText={setLine2}
                    placeholder={t('address.placeholderLine2')}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { width: '48%' }]}>
                    <Text style={styles.label}>{t('address.city')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholderTextColor={colors.textMuted}
                      value={city}
                      onChangeText={setCity}
                      placeholder="New Delhi"
                    />
                  </View>
                  <View style={[styles.inputGroup, { width: '48%' }]}>
                    <Text style={styles.label}>{t('address.state')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholderTextColor={colors.textMuted}
                      value={state}
                      onChangeText={setState}
                      placeholder="Delhi"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('address.pincode')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textMuted}
                    value={pincode}
                    onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="110001"
                    keyboardType="numeric"
                  />
                  {pincodeServiceable === false && (
                    <Text style={styles.serviceabilityWarning}>
                      {t('address.serviceabilityWarning')}
                    </Text>
                  )}
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{t('address.setAsDefaultAddress')}</Text>
                  <Switch value={isDefault} onValueChange={setIsDefault} />
                </View>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.modalSaveText}>
                    {saving ? t('address.saving') : t('address.saveAddress')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    backgroundColor: colors.secondary 
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  listContent: { padding: 16 },
  centerLoader: { padding: 16, alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
  },
  cardDefault: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  addressTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textDark },
  defaultBadge: { backgroundColor: '#FFEAEA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  defaultBadgeText: { fontSize: 8, fontWeight: 'bold', color: colors.primary },
  cardHeaderActions: { flexDirection: 'row' },
  actionIcon: { marginLeft: 12 },
  addressLine: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  setDefaultBtn: { marginTop: 12, alignSelf: 'flex-start' },
  setDefaultText: { fontSize: 12, fontWeight: 'bold', color: colors.primary },
  addButton: {
    margin: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: { color: colors.white, fontSize: 15, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textDark },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 16,
  },
  gpsDetectText: { color: colors.white, fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  form: { marginTop: 8 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 9, fontWeight: 'bold', color: colors.textMuted, marginBottom: 4 },
  serviceabilityWarning: { fontSize: 11, color: colors.warning, marginTop: 6, lineHeight: 15 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    color: colors.textDark,
    fontSize: 14,
  },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  switchLabel: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalSaveBtnDisabled: { opacity: 0.6 },
  modalSaveText: { color: colors.white, fontSize: 14, fontWeight: 'bold' }
});
