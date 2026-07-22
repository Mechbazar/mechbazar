import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setVehicleType } from '../../../store/appSlice';
import { VehicleType } from '../../../types/product';
import { fetchManufacturers, fetchModels, fetchVariants } from '../../../services/product.service';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

interface Option { id: string; name: string }

function Dropdown({
  label, value, options, disabled, onSelect,
}: { label: string; value: string; options: Option[]; disabled?: boolean; onSelect: (opt: Option) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]} numberOfLines={1}>
          {value || (disabled ? '--' : 'Select')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />

        {open && (
          <View style={styles.panel}>
            <ScrollView style={styles.panelScroll}>
              {options.length === 0 ? (
                <Text style={styles.panelEmpty}>No options</Text>
              ) : (
                options.map(opt => (
                  <Pressable
                    key={opt.id}
                    style={styles.panelItem}
                    onPress={() => { onSelect(opt); setOpen(false); }}
                  >
                    <Text style={styles.panelItemText}>{opt.name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </Pressable>
    </View>
  );
}

interface VehicleFinderProps {
  onFind: (selection: { brandName?: string; modelName?: string; year?: string; variantName?: string }) => void;
  onClear: () => void;
  hasActiveSelection: boolean;
}

const currentYear = new Date().getFullYear();
const YEARS: Option[] = Array.from({ length: currentYear - 2007 }, (_, i) => {
  const y = String(currentYear - i);
  return { id: y, name: y };
});

// Same cascade (manufacturer -> model -> variant, plus a client-generated
// year list) and the same services VehicleSelectionScreen already uses for
// the garage "add a vehicle" flow -- no new endpoints.
export default function VehicleFinder({ onFind, onClear, hasActiveSelection }: VehicleFinderProps) {
  const dispatch = useDispatch();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);

  const [brands, setBrands] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [variants, setVariants] = useState<Option[]>([]);

  const [selectedBrand, setSelectedBrand] = useState<Option | null>(null);
  const [selectedModel, setSelectedModel] = useState<Option | null>(null);
  const [selectedYear, setSelectedYear] = useState<Option | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Option | null>(null);

  useEffect(() => {
    fetchManufacturers(vehicleType === VehicleType.CAR ? 'CAR' : 'BIKE').then(setBrands);
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedVariant(null);
  }, [vehicleType]);

  useEffect(() => {
    if (!selectedBrand) { setModels([]); return; }
    fetchModels(selectedBrand.id).then(setModels);
    setSelectedModel(null);
    setSelectedVariant(null);
  }, [selectedBrand]);

  useEffect(() => {
    if (!selectedModel) { setVariants([]); return; }
    fetchVariants(selectedModel.id).then(setVariants);
    setSelectedVariant(null);
  }, [selectedModel]);

  const canFind = !!selectedBrand && !!selectedModel;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="car-sport-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>Find Parts by Vehicle</Text>
      </View>

      <View style={styles.typeToggle}>
        <Pressable
          style={[styles.typeBtn, vehicleType === VehicleType.CAR && styles.typeBtnActive]}
          onPress={() => dispatch(setVehicleType(VehicleType.CAR))}
        >
          <Text style={[styles.typeBtnText, vehicleType === VehicleType.CAR && styles.typeBtnTextActive]}>Car</Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, vehicleType === VehicleType.BIKE && styles.typeBtnActive]}
          onPress={() => dispatch(setVehicleType(VehicleType.BIKE))}
        >
          <Text style={[styles.typeBtnText, vehicleType === VehicleType.BIKE && styles.typeBtnTextActive]}>Bike</Text>
        </Pressable>
      </View>

      <View style={styles.fieldsRow}>
        <Dropdown label="Brand" value={selectedBrand?.name || ''} options={brands} onSelect={setSelectedBrand} />
        <Dropdown label="Model" value={selectedModel?.name || ''} options={models} disabled={!selectedBrand} onSelect={setSelectedModel} />
        <Dropdown label="Year" value={selectedYear?.name || ''} options={YEARS} disabled={!selectedModel} onSelect={setSelectedYear} />
        <Dropdown label="Engine / Variant" value={selectedVariant?.name || ''} options={variants} disabled={!selectedModel} onSelect={setSelectedVariant} />
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.findBtn, !canFind && styles.findBtnDisabled]}
          disabled={!canFind}
          onPress={() => onFind({
            brandName: selectedBrand?.name,
            modelName: selectedModel?.name,
            year: selectedYear?.name,
            variantName: selectedVariant?.name,
          })}
        >
          <Text style={styles.findBtnText}>Find Parts</Text>
        </Pressable>
        {hasActiveSelection && (
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              setSelectedBrand(null); setSelectedModel(null); setSelectedYear(null); setSelectedVariant(null);
              onClear();
            }}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  typeBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.pageBg, borderWidth: 1, borderColor: colors.borderLight,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  typeBtnTextActive: { color: colors.white },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexGrow: 1, minWidth: 160, zIndex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 40, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.pageBg,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { fontSize: 13, color: colors.textDark, fontWeight: '600', flexShrink: 1 },
  triggerPlaceholder: { color: colors.textMuted, fontWeight: '400' },
  panel: {
    position: 'absolute' as any, top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: colors.white, borderRadius: radius.sm, maxHeight: 220, zIndex: 20,
    ...shadows.lg,
  },
  panelScroll: { maxHeight: 220 },
  panelEmpty: { padding: spacing.sm, fontSize: 12, color: colors.textMuted },
  panelItem: { paddingVertical: 10, paddingHorizontal: spacing.sm },
  panelItemText: { fontSize: 13, color: colors.textDark },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  findBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  findBtnDisabled: { opacity: 0.4 },
  findBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  clearBtn: { borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: 1, borderColor: colors.borderLight },
  clearBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
});
