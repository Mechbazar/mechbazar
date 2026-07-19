import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loginSuccess } from '../../store/authSlice';
import { API_BASE_URL } from '../../services/api';

const colors = {
  primary: '#E23B22',
  secondary: '#161B21',
  steel: '#242C35',
  white: '#FFFFFF',
  textMuted: '#9AA5B1',
  border: '#343E4A'
};

const BUSINESS_TYPES = ['Workshop', 'Retailer', 'Wholesaler', 'Distributor'];

export default function WholesaleRegistrationScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [businessType, setBusinessType] = useState('Workshop');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const handleRegister = async () => {
    // Validations
    if (!companyName || !contactPerson || !phone || !email || !password || !city || !state) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }
    if (phone.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(false);
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone,
          email,
          password,
          name: contactPerson,
          companyName,
          contactPerson,
          gstNumber: gstNumber || undefined,
          businessType: businessType.toUpperCase(),
          city,
          state,
          accountType: 'WHOLESALE'
        })
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert('Success', 'Wholesale registration successful!', [
          {
            text: 'OK',
            onPress: () => {
              dispatch(loginSuccess({
                user: data.user,
                token: data.token
              }));
            }
          }
        ]);
      } else {
        Alert.alert('Registration Failed', data.error || 'Something went wrong.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Network Error', `Could not complete registration: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wholesale Registration</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subtext}>Register your business for bulk pricing and wholesale features.</Text>

          {/* Form Fields */}
          <Text style={styles.label}>Company / Store Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter store name"
            placeholderTextColor="#7c8590"
            value={companyName}
            onChangeText={setCompanyName}
            editable={!isLoading}
          />

          <Text style={styles.label}>Contact Person Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#7c8590"
            value={contactPerson}
            onChangeText={setContactPerson}
            editable={!isLoading}
          />

          <Text style={styles.label}>Mobile Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit mobile number"
            placeholderTextColor="#7c8590"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            editable={!isLoading}
          />

          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="business@example.com"
            placeholderTextColor="#7c8590"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
          />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter secure password"
            placeholderTextColor="#7c8590"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />

          <Text style={styles.label}>GSTIN (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="15-digit GST Number"
            placeholderTextColor="#7c8590"
            autoCapitalize="characters"
            maxLength={15}
            value={gstNumber}
            onChangeText={setGstNumber}
            editable={!isLoading}
          />

          <Text style={styles.label}>Business Type *</Text>
          <TouchableOpacity 
            style={styles.dropdownTrigger} 
            onPress={() => setShowTypeDropdown(!showTypeDropdown)}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <Text style={styles.dropdownTriggerText}>{businessType}</Text>
            <Ionicons name={showTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.white} />
          </TouchableOpacity>

          {showTypeDropdown && (
            <View style={styles.dropdownContainer}>
              {BUSINESS_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.dropdownItem, type === businessType && styles.dropdownItemActive]}
                  onPress={() => {
                    setBusinessType(type);
                    setShowTypeDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{type}</Text>
                  {type === businessType && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter city"
            placeholderTextColor="#7c8590"
            value={city}
            onChangeText={setCity}
            editable={!isLoading}
          />

          <Text style={styles.label}>State *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter state"
            placeholderTextColor="#7c8590"
            value={state}
            onChangeText={setState}
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.registerButtonText}>
              {isLoading ? 'Registering...' : 'Submit Registration'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242C35'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40
  },
  subtext: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 24
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 8
  },
  input: {
    backgroundColor: colors.steel,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.white,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.steel,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  dropdownTriggerText: {
    fontSize: 15,
    color: colors.white
  },
  dropdownContainer: {
    backgroundColor: colors.steel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: 'hidden'
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C353F'
  },
  dropdownItemActive: {
    backgroundColor: '#1E252D'
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.white
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  disabledButton: {
    opacity: 0.7
  },
  registerButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.75
  }
});
