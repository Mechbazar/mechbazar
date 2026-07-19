import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, Image, TouchableOpacity } from 'react-native';
import { colors, Typography, Card, Button, Input, vendorService, Loader } from '@mechbazar/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Image as ImageIcon, Package } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

const VEHICLE_TYPE_OPTIONS = ['CAR', 'BIKE'];

export const ProductsScreen = () => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', mrp: '', price: '', stock: '', categoryId: '', brandId: '', vehicleType: 'CAR' });
  const [imageUri, setImageUri] = useState<string | null>(null);

  const { data: products, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-products'],
    queryFn: vendorService.getProducts,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: vendorService.getCategories,
  });
  const { data: brandsData } = useQuery({
    queryKey: ['vendor-brands'],
    queryFn: vendorService.getBrands,
  });
  const categories = categoriesData || [];
  const brands = brandsData || [];

  // Categories are unique per vehicleType -- only offer categories matching
  // the product's currently selected vehicle type.
  const categoriesForVehicleType = (vehicleType: string) =>
    categories.filter((c: any) => c.vehicleType === vehicleType);

  const handleVehicleTypeChange = (vehicleType: string) => {
    const stillValid = categoriesForVehicleType(vehicleType).some((c: any) => c.id === newProduct.categoryId);
    setNewProduct({
      ...newProduct,
      vehicleType,
      categoryId: stillValid ? newProduct.categoryId : (categoriesForVehicleType(vehicleType)[0]?.id || ''),
    });
  };

  const addMutation = useMutation({
    mutationFn: vendorService.addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
      setModalVisible(false);
      setImageUri(null);
      setNewProduct({ name: '', description: '', mrp: '', price: '', stock: '', categoryId: '', brandId: '', vehicleType: 'CAR' });
      Alert.alert('Success', 'Product added successfully');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: vendorService.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
      Alert.alert('Success', 'Product deleted');
    }
  });

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleAddSubmit = async () => {
    if (!newProduct.name || !newProduct.price) return Alert.alert('Error', 'Name and Price required');
    if (!newProduct.categoryId || !newProduct.brandId) return Alert.alert('Error', 'Category and Brand are required');
    let imageUrls = [];
    if (imageUri) {
      try {
        const uploadRes = await vendorService.uploadImage(imageUri, 'image/jpeg', 'product.jpg');
        imageUrls.push(uploadRes.url);
      } catch (e) {
        console.error('Image upload failed', e);
      }
    }
    
    addMutation.mutate({
      ...newProduct,
      mrp: parseFloat(newProduct.mrp) || parseFloat(newProduct.price),
      price: parseFloat(newProduct.price),
      stock: parseInt(newProduct.stock) || 0,
      images: imageUrls
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) }
    ]);
  };

  if (isLoading && !isRefetching) return <Loader size="large" style={{flex:1, backgroundColor: colors.background}} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Products</Typography>
        <Button title="Add New" onPress={() => setModalVisible(true)} />
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{textAlign:'center', marginTop:20}}>No products found.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.productCard}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.productImg} />
              ) : (
                <View style={[styles.productImg, {backgroundColor: colors.surfaceHover, justifyContent:'center', alignItems:'center'}]}>
                  <Package color={colors.textSecondary} size={24} />
                </View>
              )}
              <View style={{flex:1, marginLeft: 16}}>
                <Typography variant="h3">{item.name}</Typography>
                <Typography variant="body" style={{color: colors.primary}}>₹{item.price} • Stock: {item.stock}</Typography>
                <Typography variant="caption" style={{color: item.status==='APPROVED'?colors.success:colors.warning}}>{item.status} · {item.vehicleType === 'BIKE' ? '🏍️ Bike' : '🚗 Car'}</Typography>
              </View>
              <Button title="" onPress={() => handleDelete(item.id)} style={{backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 8}}>
                <Trash2 color="#fff" size={16} />
              </Button>
            </View>
          </Card>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
          <Typography variant="h2" style={{marginBottom: 16}}>Add New Product</Typography>
          <ScrollView>
            <Input label="Product Name" value={newProduct.name} onChangeText={t => setNewProduct({...newProduct, name: t})} />
            <Input label="Description" value={newProduct.description} onChangeText={t => setNewProduct({...newProduct, description: t})} multiline />
            <Input label="Price (₹)" value={newProduct.price} onChangeText={t => setNewProduct({...newProduct, price: t})} keyboardType="numeric" />
            <Input label="MRP (₹)" value={newProduct.mrp} onChangeText={t => setNewProduct({...newProduct, mrp: t})} keyboardType="numeric" />
            <Input label="Stock" value={newProduct.stock} onChangeText={t => setNewProduct({...newProduct, stock: t})} keyboardType="numeric" />

            <Typography variant="caption" style={{ marginBottom: 8 }}>Vehicle Type</Typography>
            <View style={styles.chipRow}>
              {VEHICLE_TYPE_OPTIONS.map((v) => (
                <TouchableOpacity key={v} style={[styles.chip, newProduct.vehicleType === v && styles.chipActive]} onPress={() => handleVehicleTypeChange(v)}>
                  <Typography variant="caption" style={{ color: newProduct.vehicleType === v ? '#fff' : colors.text }}>{v === 'CAR' ? '🚗 Car' : '🏍️ Bike'}</Typography>
                </TouchableOpacity>
              ))}
            </View>

            <Typography variant="caption" style={{ marginTop: 12, marginBottom: 8 }}>Category</Typography>
            <View style={styles.chipRow}>
              {categoriesForVehicleType(newProduct.vehicleType).map((c: any) => (
                <TouchableOpacity key={c.id} style={[styles.chip, newProduct.categoryId === c.id && styles.chipActive]} onPress={() => setNewProduct({ ...newProduct, categoryId: c.id })}>
                  <Typography variant="caption" style={{ color: newProduct.categoryId === c.id ? '#fff' : colors.text }}>{c.name}</Typography>
                </TouchableOpacity>
              ))}
            </View>

            <Typography variant="caption" style={{ marginTop: 12, marginBottom: 8 }}>Brand</Typography>
            <View style={styles.chipRow}>
              {brands.map((b: any) => (
                <TouchableOpacity key={b.id} style={[styles.chip, newProduct.brandId === b.id && styles.chipActive]} onPress={() => setNewProduct({ ...newProduct, brandId: b.id })}>
                  <Typography variant="caption" style={{ color: newProduct.brandId === b.id ? '#fff' : colors.text }}>{b.name}</Typography>
                </TouchableOpacity>
              ))}
            </View>


            <Button title="Pick Image" onPress={handlePickImage} variant="outline" style={{marginBottom: 16}} />
            {imageUri && <Image source={{uri: imageUri}} style={{width: 100, height: 100, borderRadius: 8, marginBottom: 16}} />}

            <Button title="Save Product" onPress={handleAddSubmit} loading={addMutation.isPending} />
            <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{marginTop: 12}} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  productCard: { marginBottom: 12 },
  productImg: { width: 60, height: 60, borderRadius: 8 },
  modalContainer: { flex: 1, backgroundColor: colors.background, padding: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
