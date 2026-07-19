import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Modal, ScrollView } from 'react-native';
import { colors, Typography, Card, Button, Input } from '@mechbazar/shared';

// Mirrors apps/admin/src/pages/Vehicles.tsx exactly: it's a pure UI mock
// with no backend behind it at all (mockVehicles array, Save button doesn't
// persist). Per the confirmed decision, this stays a stub here too rather
// than inventing a fake backend integration — it becomes real once the
// panel/backend actually support vehicle master data.
const mockVehicles = [
  { id: 1, make: 'Honda', model: 'City', variant: 'VX', year: 2018, fuel: 'Petrol' },
  { id: 2, make: 'Hyundai', model: 'Creta', variant: 'SX', year: 2022, fuel: 'Diesel' },
];

export const VehicleMasterScreen = () => {
  const [vehicles] = useState(mockVehicles);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Vehicle Master</Typography>
        <Button title="+ Add New" size="sm" onPress={() => setModalOpen(true)} />
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Typography variant="h3">{item.make} {item.model}</Typography>
            <Typography variant="caption">{item.variant} • {item.year} • {item.fuel}</Typography>
            <Typography variant="caption" style={{ color: colors.primary, fontWeight: '600', marginTop: 8 }}>Edit</Typography>
          </Card>
        )}
      />

      <Modal visible={modalOpen} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>Add Vehicle</Typography>
          <Input placeholder="Make (e.g., Honda)" containerStyle={{ marginBottom: 12 }} />
          <Input placeholder="Model (e.g., City)" containerStyle={{ marginBottom: 12 }} />
          <Input placeholder="Variant (e.g., VX)" containerStyle={{ marginBottom: 12 }} />
          <Input placeholder="Year" keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />
          <Button title="Save" onPress={() => setModalOpen(false)} style={{ marginTop: 8 }} />
          <Button title="Cancel" variant="outline" onPress={() => setModalOpen(false)} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  card: { marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
});
