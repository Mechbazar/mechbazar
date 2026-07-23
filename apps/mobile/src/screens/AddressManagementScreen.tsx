import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Alert, 
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
import {
  fetchMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress
} from '../services/address.service';
import { locationService } from '../services/location.service';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
  success: '#34C759',
};

export default function AddressManagementScreen() {
  const navigation = useNavigation<any>();
  const { token } = useSelector((state: RootState) => state.auth);

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
  const [isDefault, setIsDefault] = useState(false);
  const [fetchingGPS, setFetchingGPS] = useState(false);

  const { isDesktopUp } = useBreakpoint();
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

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setTitle('Home');
    setLine1('');
    setLine2('');
    setCity('');
    setState('');
    setPincode('');
    setIsDefault(false);
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
    setIsDefault(addr.isDefault);
    setModalVisible(true);
  };

  const handleGPSDetect = async () => {
    setFetchingGPS(true);
    try {
      const coords = await locationService.getCurrentLocation();
      if (coords) {
        const address = await locationService.reverseGeocode(coords.latitude, coords.longitude);
        if (address) {
          setLine1(address.street || address.name || '');
          setLine2(address.city || '');
          setCity(address.city || '');
          setState(address.region || '');
          setPincode(address.postalCode || '');
          Alert.alert('GPS Success', 'Location loaded successfully!');
        } else {
          Alert.alert('GPS Error', 'Failed to resolve location address.');
        }
      } else {
        Alert.alert('GPS Error', 'Failed to retrieve coordinates. Please check your permissions.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('GPS Error', 'An error occurred while loading GPS.');
    } finally {
      setFetchingGPS(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (!title.trim() || !line1.trim() || !city.trim() || !pincode.trim()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    const payload = {
      title,
      line1,
      line2,
      city,
      state,
      pincode,
      isDefault,
    };

    setLoading(true);
    if (editingAddress) {
      // Edit mode
      const res = await updateMyAddress(token, editingAddress.id, payload);
      if (res.address) {
        setModalVisible(false);
        loadAddresses();
        Alert.alert('Success', 'Address updated successfully!');
      } else {
        Alert.alert('Error', res.error || 'Failed to update address.');
      }
    } else {
      // Create mode
      const res = await createMyAddress(token, payload);
      if (res.address) {
        setModalVisible(false);
        loadAddresses();
        Alert.alert('Success', 'Address created successfully!');
      } else {
        Alert.alert('Error', res.error || 'Failed to create address.');
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setLoading(true);
          const res = await deleteMyAddress(token, id);
          if (res.ok) {
            loadAddresses();
            Alert.alert('Success', 'Address deleted successfully.');
          } else {
            Alert.alert('Error', res.error || 'Failed to delete address.');
          }
          setLoading(false);
        }
      }
    ]);
  };

  const handleSetDefault = async (addr: any) => {
    if (!token) return;
    setLoading(true);
    const res = await updateMyAddress(token, addr.id, { isDefault: true });
    if (res.address) {
      loadAddresses();
    } else {
      Alert.alert('Error', res.error || 'Failed to update address default status.');
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
              <Text style={styles.defaultBadgeText}>★ Default</Text>
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
          <Text style={styles.setDefaultText}>Set as default</Text>
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
        <Text style={styles.headerTitle}>Saved Addresses</Text>
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
                <Text style={styles.emptyTitle}>No saved addresses found</Text>
                <Text style={styles.emptySubtitle}>Save your home, work, or garage locations for easy doorstep visits.</Text>
              </View>
            ) : null
          }
        />
      </CompactBookingShell>

      <CompactBookingShell maxWidth={880}>
        <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
          <Text style={styles.addButtonText}>+ Add New Address</Text>
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
                  {editingAddress ? 'Edit Address' : 'New Address'}
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
                  {fetchingGPS ? 'Locating...' : 'Get Current GPS Location'}
                </Text>
              </TouchableOpacity>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ADDRESS LABEL (e.g. Home, Work)</Text>
                  <TextInput 
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Home"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>FLAT / STREET NAME (Line 1)</Text>
                  <TextInput 
                    style={styles.input}
                    value={line1}
                    onChangeText={setLine1}
                    placeholder="House No, Apartment name, Street"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>LANDMARK / LOCALITY (Line 2)</Text>
                  <TextInput 
                    style={styles.input}
                    value={line2}
                    onChangeText={setLine2}
                    placeholder="Near main road, hospital"
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { width: '48%' }]}>
                    <Text style={styles.label}>CITY</Text>
                    <TextInput 
                      style={styles.input}
                      value={city}
                      onChangeText={setCity}
                      placeholder="New Delhi"
                    />
                  </View>
                  <View style={[styles.inputGroup, { width: '48%' }]}>
                    <Text style={styles.label}>STATE</Text>
                    <TextInput 
                      style={styles.input}
                      value={state}
                      onChangeText={setState}
                      placeholder="Delhi"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PINCODE</Text>
                  <TextInput 
                    style={styles.input}
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="110001"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Set as Default Address</Text>
                  <Switch value={isDefault} onValueChange={setIsDefault} />
                </View>

                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
                  <Text style={styles.modalSaveText}>
                    {loading ? 'Saving...' : 'Save Address'}
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
  modalSaveText: { color: colors.white, fontSize: 14, fontWeight: 'bold' }
});
