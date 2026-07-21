import React from 'react';
import { View, Text, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, vendorService } from '@mechbazar/shared';
import { Wrench } from 'lucide-react-native';
import { setAuth } from '../store';

export const LoginScreen = ({ navigation }: { navigation: any }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading(true);
      const data = await vendorService.login({ email, password });

      if (data.token) {
        await SecureStore.setItemAsync('token', data.token);
        dispatch(setAuth({ token: data.token, user: data.user }));
      } else {
        Alert.alert('Login Failed', 'No token received from server');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 50, height: 50,
            borderColor: colors.primary, borderWidth: 4,
            borderRadius: 12, justifyContent: 'center', alignItems: 'center',
            transform: [{ rotate: '45deg' }],
            marginRight: 16
          }}>
            <View style={{ transform: [{ rotate: '-45deg' }] }}>
              <Wrench color={colors.primary} size={28} />
            </View>
          </View>
          <Text style={{ fontSize: 36, fontWeight: '900', color: colors.primary, fontStyle: 'italic', letterSpacing: -1 }}>
            Mech Bazar
          </Text>
        </View>
        <Typography variant="body" style={{ color: colors.navy, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
          VENDOR PORTAL
        </Typography>
      </View>

      <View style={{ width: '100%' }}>
        <Input
          label="Email Address"
          placeholder="vendor@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Input
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          title="Login to Dashboard"
          onPress={handleLogin}
          loading={loading}
          style={{ width: '100%', marginTop: 24, paddingVertical: 16 }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: colors.navy }}>New seller? </Text>
          <Text
            style={{ color: colors.primary, fontWeight: '700' }}
            onPress={() => navigation.navigate('Register')}
          >
            Sign up
          </Text>
        </View>
      </View>
    </View>
  );
};
