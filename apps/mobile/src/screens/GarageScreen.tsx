import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, NavigationProp } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { setActiveVehicle, removeVehicleFromGarage, updateVehicleInGarage, hydrateGarage } from '../store/appSlice';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { fetchMyVehicles, updateMyVehicle, deleteMyVehicle } from '../services/garage.service';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';

const colors = {
  primary: '#DA3830',
  secondary: '#F29F05',
  accent: '#BF3617',
  dark: '#111111',
  light: '#F8F8F8',
  white: '#FFFFFF',
  gray: '#E0E0E0',
  textDark: '#1C1C1C',
  textLight: '#777777',
  success: '#28A745',
};

export default function GarageScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const { token } = useSelector((state: RootState) => state.auth);

  // Modal edit states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [nickname, setNickname] = useState('');
  const [trim, setTrim] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { isDesktopUp } = useBreakpoint();
  // Independent of the data-refetch useFocusEffect below -- kept separate so
  // this shell-registration concern doesn't get tangled with the vehicle
  // refetch logic.
  useFocusEffect(
    React.useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!token) { setIsLoading(false); return; }
      let cancelled = false;
      setIsLoading(true);
      fetchMyVehicles(token).then(vehicles => {
        if (cancelled) return;
        const active = vehicles.find(v => v.isDefault) || vehicles[0] || null;
        dispatch(hydrateGarage({ myGarage: vehicles, activeVehicleId: active?.id ?? null }));
        setIsLoading(false);
      });
      return () => { cancelled = true; };
    }, [token])
  );

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    const prevGarage = myGarage;
    dispatch(setActiveVehicle(id));
    const result = await updateMyVehicle(token, id, { isDefault: true });
    setBusyId(null);
    if (!result.vehicle) {
      dispatch(hydrateGarage({ myGarage: prevGarage, activeVehicleId: prevGarage.find(v => v.isDefault)?.id ?? null }));
      Alert.alert('Error', result.error || 'Failed to set default vehicle');
    }
  };

  const handleDeleteVehicle = (id: string) => {
    Alert.alert('Delete Vehicle', 'Are you sure you want to remove this vehicle from your garage?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setBusyId(id);
          const result = await deleteMyVehicle(token, id);
          setBusyId(null);
          if (!result.ok) {
            Alert.alert('Error', result.error || 'Failed to remove vehicle');
            return;
          }
          dispatch(removeVehicleFromGarage(id));
          Alert.alert('Deleted', 'Vehicle removed.');
        }
      }
    ]);
  };

  const handleOpenEditModal = (veh: any) => {
    setSelectedVehicle(veh);
    setNickname(veh.nickname || '');
    setTrim(veh.trim || '');
    setRegistrationNumber(veh.registrationNumber || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedVehicle || !token) return;
    setSavingEdit(true);
    const result = await updateMyVehicle(token, selectedVehicle.id, { nickname, trim, registrationNumber });
    setSavingEdit(false);
    if (!result.vehicle) {
      Alert.alert('Error', result.error || 'Failed to update vehicle');
      return;
    }
    dispatch(updateVehicleInGarage({ ...selectedVehicle, nickname, trim, registrationNumber }));
    setEditModalVisible(false);
    Alert.alert('Success', 'Vehicle details updated successfully!');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.white} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>My Garage</Text>
        <Text style={styles.headerSubtitle}>Manage your vehicles</Text>
      </View>
      <HeaderCartButton />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
      <FlatList
        data={myGarage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyTitle}>Your garage is empty</Text>
            <Text style={styles.emptySubtitle}>Add a vehicle to find compatible parts instantly.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.vehicleCard, item.isDefault && styles.activeCard]}
            onPress={() => handleSetDefault(item.id)}
            activeOpacity={0.9}
          >
            {item.isDefault && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeText}>★ Active</Text>
              </View>
            )}
            
            <View style={styles.cardContent}>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>{item.nickname || `${item.brand} ${item.model}`}</Text>
                <Text style={styles.vehicleMake}>{item.year} • {item.trim}</Text>
                <Text style={styles.vehicleVariant}>{item.engine} • {item.transmission} • {item.fuelType}</Text>
              </View>
              <View style={styles.actionsColumn}>
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color={colors.textLight} style={styles.actionBtn} />
                ) : (
                  <>
                    <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={styles.actionBtn}>
                      <Ionicons name="create-outline" size={18} color={colors.textDark} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteVehicle(item.id)} style={styles.actionBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.accent} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
      </CompactBookingShell>
      )}

      <CompactBookingShell maxWidth={880}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('VehicleSelection')}
        >
          <Text style={styles.addButtonText}>+ Add New Vehicle</Text>
        </TouchableOpacity>
        <MinimalFooter />
      </CompactBookingShell>

      {/* Edit Vehicle Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Vehicle Details</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>NICKNAME / DESCRIPTION</Text>
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="e.g. My Primary Car"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>TRIM / VARIANT</Text>
                <TextInput
                  style={styles.input}
                  value={trim}
                  onChangeText={setTrim}
                  placeholder="e.g. VXI / LXI"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>REGISTRATION NUMBER</Text>
                <TextInput
                  style={styles.input}
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  placeholder="e.g. DL-01-AB-1234"
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity style={[styles.saveBtn, savingEdit && { opacity: 0.7 }]} onPress={handleSaveEdit} disabled={savingEdit}>
                <Text style={styles.saveBtnText}>{savingEdit ? 'Saving...' : 'Save Vehicle Details'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light },
  flexFill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.primary },
  backButton: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.white },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  
  listContainer: { padding: 16 },
  vehicleCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, borderWidth: 1.5, borderColor: 'transparent' },
  activeCard: { borderColor: colors.secondary, backgroundColor: '#FFFDF9' },
  
  activeBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  activeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  
  cardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleInfo: { flex: 1, paddingRight: 60 },
  vehicleName: { fontSize: 16, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  vehicleMake: { fontSize: 13, color: colors.textDark, fontWeight: '600' },
  vehicleVariant: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  
  actionsColumn: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 8 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: colors.textLight, textAlign: 'center', lineHeight: 18 },

  addButton: { margin: 16, backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center', elevation: 2, shadowColor: colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  addButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textDark },
  form: { marginTop: 8 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 9, fontWeight: 'bold', color: colors.textLight, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    color: colors.textDark,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: colors.white, fontSize: 14, fontWeight: 'bold' }
});
