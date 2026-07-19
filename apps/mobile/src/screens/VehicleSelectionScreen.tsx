import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Animated, Dimensions, Modal, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { addVehicleToGarage } from '../store/appSlice';
import { RootState } from '../store';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { VehicleType } from '../types/product';
import { fetchManufacturers, fetchModels, fetchVariants } from '../services/product.service';
import { createMyVehicle } from '../services/garage.service';

const { width, height } = Dimensions.get('window');

// MechBazar Brand Colors
const colors = {
  primary: '#034C8C',
  secondary: '#F29F05',
  accent: '#BF3617',
  dark: '#111111',
  light: '#F8F8F8',
  white: '#FFFFFF',
  gray: '#E0E0E0',
  textDark: '#1C1C1C',
  textLight: '#777777',
  border: '#EEEEEE',
};

type Step = 'BRAND' | 'MODEL' | 'DETAILS';

export default function VehicleSelectionScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);
  const [isSaving, setIsSaving] = useState(false);

  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [step, setStep] = useState<Step>('BRAND');
  
  // Real Data State
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  // Selections
  const [selectedBrand, setSelectedBrand] = useState<{id: string, name: string} | null>(null);
  const [selectedModel, setSelectedModel] = useState<{id: string, name: string} | null>(null);
  
  // Config
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedFuel, setSelectedFuel] = useState<string>('');
  const [selectedEngine, setSelectedEngine] = useState<string>('');
  const [selectedTransmission, setSelectedTransmission] = useState<string>('');
  const [selectedTrim, setSelectedTrim] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  
  // Animation for Toggle
  const indicatorPosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchManufacturers().then(data => {
      setBrands(data);
    });
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      fetchModels(selectedBrand.id).then(data => {
        setModels(data);
      });
    }
  }, [selectedBrand]);

  useEffect(() => {
    if (selectedModel) {
      fetchVariants(selectedModel.id).then(data => {
        setVariants(data);
      });
    }
  }, [selectedModel]);
  
  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: vehicleType === VehicleType.CAR ? 0 : (width - 40) / 2,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    
    // Reset selections on type change
    setSelectedBrand(null);
    setSelectedModel(null);
    setStep('BRAND');
    setSearchQuery('');
  }, [vehicleType]);

  const handleSaveToGarage = async () => {
    if (!selectedBrand || !selectedModel) return;
    if (!token) {
      navigation.goBack();
      return;
    }

    setIsSaving(true);
    const result = await createMyVehicle(token, {
      vehicleType,
      brand: selectedBrand.name,
      model: selectedModel.name,
      year: selectedYear,
      fuelType: selectedFuel,
      engine: selectedEngine,
      transmission: selectedTransmission,
      trim: selectedTrim,
      isDefault: true,
      nickname: `${selectedBrand.name} ${selectedModel.name}`,
    });
    setIsSaving(false);

    if (!result.vehicle) {
      Alert.alert('Error', result.error || 'Failed to save vehicle');
      return;
    }

    dispatch(addVehicleToGarage(result.vehicle));
    navigation.goBack();
  };

  // --- RENDERING VIEWS --- //

  const renderToggle = () => (
    <View style={styles.toggleContainer}>
      <Animated.View style={[styles.toggleIndicator, { transform: [{ translateX: indicatorPosition }] }]} />
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={() => setVehicleType(VehicleType.CAR)}
      >
        <Text style={[styles.toggleText, vehicleType === VehicleType.CAR && styles.toggleTextActive]}>🚗 Cars</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={() => setVehicleType(VehicleType.BIKE)}
      >
        <Text style={[styles.toggleText, vehicleType === VehicleType.BIKE && styles.toggleTextActive]}>🏍️ Bikes</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBrandSelection = () => {
    const filtered = brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput 
            style={styles.searchInput} 
            placeholder={`Search ${vehicleType === VehicleType.CAR ? 'Car' : 'Bike'} Brands...`} 
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.brandCard}
              onPress={() => {
                setSelectedBrand({ id: item.id, name: item.name });
                setSearchQuery('');
                setStep('MODEL');
              }}
            >
              <View style={styles.brandLogoPlaceholder}>
                <Text style={styles.brandInitial}>{item.name.charAt(0)}</Text>
              </View>
              <Text style={styles.brandName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderModelSelection = () => {
    const filtered = models.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { setStep('BRAND'); setSearchQuery(''); }}>
            <Text style={styles.backButton}>⬅</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Model ({selectedBrand?.name})</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput 
            style={styles.searchInput} 
            placeholder={`Search Models...`} 
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.listItem}
              onPress={() => {
                setSelectedModel({ id: item.id, name: item.name });
                // Reset configs
                setSelectedYear('');
                setSelectedFuel('');
                setSelectedEngine('');
                setSelectedTransmission('');
                setSelectedTrim('');
                setStep('DETAILS');
              }}
            >
              <Text style={styles.listItemText}>{item.name}</Text>
              <Text style={styles.listItemChevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderDetailsBottomSheet = () => {
    const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
    const fuels = ['Petrol', 'Diesel', 'EV', 'CNG'];
    const engines = ['Standard', 'Turbo', '1000cc', '1500cc'];
    const transmissions = ['Manual', 'Automatic', 'AMT'];
    const trims = variants.map(v => v.name);

    const renderDropdown = (label: string, value: string, options: string[], onSelect: (val: string) => void) => (
      <View style={styles.dropdownGroup}>
        <Text style={styles.dropdownLabel}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
          {options.map(opt => (
            <TouchableOpacity 
              key={opt} 
              style={[styles.chip, value === opt && styles.chipActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );

    return (
      <Modal visible={step === 'DETAILS'} animationType="slide" transparent={true}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setStep('MODEL')} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{selectedBrand?.name} {selectedModel?.name}</Text>
              <TouchableOpacity onPress={() => setStep('MODEL')} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.bottomSheetSubtitle}>Select specifications to ensure 100% part compatibility</Text>
            
            <ScrollView style={styles.scrollSheet}>
              {renderDropdown('Model Year', selectedYear, years, setSelectedYear)}
              {renderDropdown('Fuel Type', selectedFuel, fuels, setSelectedFuel)}
              {renderDropdown('Engine / Capacity', selectedEngine, engines, setSelectedEngine)}
              {renderDropdown('Transmission', selectedTransmission, transmissions, setSelectedTransmission)}
              {renderDropdown('Variant / Trim', selectedTrim, trims, setSelectedTrim)}
            </ScrollView>

            <TouchableOpacity
              style={[styles.continueButton, (!selectedYear || !selectedFuel || isSaving) && styles.continueButtonDisabled]}
              disabled={!selectedYear || !selectedFuel || isSaving}
              onPress={handleSaveToGarage}
            >
              {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.continueButtonText}>Save & Continue</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.appBarBack}>
          <Text style={styles.appBarBackIcon}>⬅</Text>
        </TouchableOpacity>
        <Text style={[styles.appBarTitle, { flex: 1 }]}>Add to Garage</Text>
        <HeaderCartButton color="#1C1C1C" backgroundColor="rgba(0,0,0,0.05)" />
      </View>

      {step === 'BRAND' && renderToggle()}

      <View style={styles.content}>
        {step === 'BRAND' && renderBrandSelection()}
        {(step === 'MODEL' || step === 'DETAILS') && renderModelSelection()}
      </View>

      {renderDetailsBottomSheet()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light },
  appBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  appBarBack: { marginRight: 16, padding: 4 },
  appBarBackIcon: { fontSize: 20, color: colors.primary },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.textDark },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: '#E8F0F8', margin: 20, borderRadius: 30, position: 'relative', height: 48 },
  toggleIndicator: { position: 'absolute', width: '50%', height: '100%', backgroundColor: colors.primary, borderRadius: 30 },
  toggleButton: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  toggleText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  toggleTextActive: { color: colors.white },

  content: { flex: 1, paddingHorizontal: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: colors.textDark },

  gridContainer: { paddingBottom: 20 },
  brandCard: { flex: 1, backgroundColor: colors.white, margin: 6, borderRadius: 12, padding: 16, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  brandLogoPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F0F5FA', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandInitial: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
  brandName: { fontSize: 14, fontWeight: '600', color: colors.textDark },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { fontSize: 22, color: colors.textDark, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textDark },

  listContainer: { paddingBottom: 20 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, padding: 16, borderRadius: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  listItemText: { fontSize: 16, fontWeight: '500', color: colors.textDark },
  listItemChevron: { fontSize: 20, color: colors.textLight },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { flex: 1 },
  bottomSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: height * 0.8 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bottomSheetTitle: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  closeBtn: { padding: 4, backgroundColor: colors.gray, borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: colors.textDark },
  bottomSheetSubtitle: { fontSize: 14, color: colors.textLight, marginBottom: 20 },
  
  scrollSheet: { flexGrow: 0 },
  dropdownGroup: { marginBottom: 20 },
  dropdownLabel: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginBottom: 10 },
  chipContainer: { paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.light, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: '#FFF4E5', borderColor: colors.secondary },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.textDark },
  chipTextActive: { color: colors.secondary, fontWeight: '700' },

  continueButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  continueButtonDisabled: { backgroundColor: '#A0B4C8' },
  continueButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
