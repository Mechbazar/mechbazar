import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { ServiceAddress } from '../../types/service';
import { fetchMyAddresses, createMyAddress } from '../../services/address.service';
import { colors } from '../../screens/services/theme';

interface AddressPickerSheetProps {
  visible: boolean;
  token: string;
  onClose: () => void;
  onSelect: (address: ServiceAddress) => void;
}

const emptyForm = { title: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export const AddressPickerSheet: React.FC<AddressPickerSheetProps> = ({ visible, token, onClose, onSelect }) => {
  const [addresses, setAddresses] = useState<ServiceAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = async () => {
    setLoading(true);
    const data = await fetchMyAddresses(token);
    setAddresses(data);
    setLoading(false);
  };

  useEffect(() => {
    if (visible) {
      setShowAddForm(false);
      setForm(emptyForm);
      setCoords(null);
      setError(null);
      loadAddresses();
    }
  }, [visible]);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geocode.length > 0) {
        const place = geocode[0];
        setForm((f) => ({
          ...f,
          line1: f.line1 || [place.streetNumber, place.street].filter(Boolean).join(' '),
          city: f.city || place.city || place.district || '',
          state: f.state || place.region || '',
          pincode: f.pincode || place.postalCode || '',
        }));
      }
    } catch (err) {
      setError('Could not fetch current location');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.line1 || !form.city || !form.state || !form.pincode) {
      setError('Please fill in title, address line, city, state and pincode');
      return;
    }
    setSaving(true);
    setError(null);
    const { address, error: err } = await createMyAddress(token, {
      ...form,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
    setSaving(false);
    if (err || !address) {
      setError(err || 'Failed to save address');
      return;
    }
    onSelect(address);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{showAddForm ? 'Add New Address' : 'Select Address'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          {!showAddForm ? (
            <ScrollView style={styles.body}>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : (
                <>
                  {addresses.map((addr) => (
                    <TouchableOpacity key={addr.id} style={styles.addressCard} onPress={() => onSelect(addr)}>
                      <View style={styles.addressIconBox}>
                        <Text style={{ fontSize: 16 }}>{addr.isDefault ? '⭐' : '📍'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addressTitle}>{addr.title}</Text>
                        <Text style={styles.addressText} numberOfLines={2}>
                          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} {addr.pincode}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {addresses.length === 0 && (
                    <Text style={styles.emptyText}>No saved addresses yet. Add one below.</Text>
                  )}
                </>
              )}
              <TouchableOpacity style={styles.addNewBtn} onPress={() => setShowAddForm(true)}>
                <Text style={styles.addNewBtnText}>+ Add New Address</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView style={styles.body}>
              <TouchableOpacity style={styles.locationBtn} onPress={handleUseCurrentLocation} disabled={locating}>
                {locating ? <ActivityIndicator color={colors.primary} /> : (
                  <Text style={styles.locationBtnText}>📍 Use my current location</Text>
                )}
              </TouchableOpacity>

              <TextInput style={styles.input} placeholder="Address label (e.g. Home, Office)" placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
              <TextInput style={styles.input} placeholder="House no, building, street" placeholderTextColor={colors.textMuted} value={form.line1} onChangeText={(v) => setForm({ ...form, line1: v })} />
              <TextInput style={styles.input} placeholder="Landmark (optional)" placeholderTextColor={colors.textMuted} value={form.line2} onChangeText={(v) => setForm({ ...form, line2: v })} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="City" placeholderTextColor={colors.textMuted} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="State" placeholderTextColor={colors.textMuted} value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
              </View>
              <TextInput style={styles.input} placeholder="Pincode" placeholderTextColor={colors.textMuted} value={form.pincode} onChangeText={(v) => setForm({ ...form, pincode: v })} keyboardType="number-pad" />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save & Use This Address'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => setShowAddForm(false)}>
                <Text style={styles.backLinkText}>‹ Back to saved addresses</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: colors.borderLight },
  title: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  closeBtn: { fontSize: 20, color: colors.textMuted },
  body: { padding: 20 },

  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.pageBg, borderRadius: 12, padding: 14, marginBottom: 12 },
  addressIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  addressTitle: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  addressText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginVertical: 20 },

  addNewBtn: { borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  addNewBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  locationBtn: { backgroundColor: '#FFF4F1', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  locationBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  input: { backgroundColor: colors.pageBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textDark, marginBottom: 12 },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: 12 },

  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  backLink: { alignItems: 'center', marginTop: 14 },
  backLinkText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
