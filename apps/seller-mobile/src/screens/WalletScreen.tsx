import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal } from 'react-native';
import { colors, Typography, Card, Button, Input, vendorService, Loader } from '@mechbazar/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle } from 'lucide-react-native';

export const WalletScreen = () => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');

  const { data: walletData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-wallet'],
    queryFn: vendorService.getWalletDetails,
  });

  const withdrawMutation = useMutation({
    mutationFn: (amt: number) => vendorService.requestPayout(amt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-wallet'] });
      setModalVisible(false);
      setAmount('');
      Alert.alert('Success', 'Payout request submitted successfully');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || err.message)
  });

  const handleWithdraw = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return Alert.alert('Error', 'Enter a valid amount');
    if (num > (walletData?.balance || 0)) return Alert.alert('Error', 'Insufficient balance');
    
    withdrawMutation.mutate(num);
  };

  if (isLoading && !isRefetching) return <Loader size="large" style={{flex:1, backgroundColor: colors.background}} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          <WalletIcon color={colors.warning} size={32} style={{marginRight: 12}} />
          <View>
            <Typography variant="caption">Available Balance</Typography>
            <Typography variant="h1">₹ {walletData?.balance?.toFixed(2) || '0.00'}</Typography>
          </View>
        </View>
        <Button title="Withdraw" onPress={() => setModalVisible(true)} style={{marginTop: 16}} />
      </View>

      <Typography variant="h3" style={{padding: 16, paddingBottom: 8}}>Recent Transactions</Typography>
      <FlatList
        data={walletData?.transactions || []}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{textAlign:'center', marginTop:20}}>No transactions yet.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.txCard}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              {item.type === 'CREDIT' ? <ArrowUpCircle color={colors.success} size={24} /> : <ArrowDownCircle color={colors.danger} size={24} />}
              <View style={{flex:1, marginLeft: 12}}>
                <Typography variant="body">{item.description || item.type}</Typography>
                <Typography variant="caption" style={{color: colors.textSecondary}}>{new Date(item.date).toLocaleString()}</Typography>
              </View>
              <Typography variant="h3" style={{color: item.type === 'CREDIT' ? colors.success : colors.text}}>
                {item.type === 'CREDIT' ? '+' : '-'}₹{item.amount}
              </Typography>
            </View>
          </Card>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
          <Typography variant="h2" style={{marginBottom: 16}}>Request Payout</Typography>
          <Typography variant="body" style={{marginBottom: 24}}>Available Balance: ₹{walletData?.balance || 0}</Typography>
          
          <Input 
            label="Amount (₹)" 
            value={amount} 
            onChangeText={setAmount} 
            keyboardType="numeric" 
            placeholder="0.00"
          />
          
          <Button title="Submit Request" onPress={handleWithdraw} loading={withdrawMutation.isPending} />
          <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{marginTop: 12}} />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 24, backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.border },
  txCard: { marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: colors.background, padding: 24 }
});
