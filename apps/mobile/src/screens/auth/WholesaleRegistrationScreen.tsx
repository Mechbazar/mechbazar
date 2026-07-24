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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loginSuccess } from '../../store/authSlice';
import { API_BASE_URL } from '../../services/api';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import Container from '../../components/desktop/shared/Container';
import { spacing as deskSpacing, radius as deskRadius } from '../../theme/tokens';

const colors = {
  primary: '#DA3830',
  secondary: '#1B1B1B',
  steel: '#242C35',
  white: '#FFFFFF',
  textMuted: '#9AA5B1',
  border: '#343E4A'
};

const BUSINESS_TYPES = ['Workshop', 'Retailer', 'Wholesaler', 'Distributor'];

// Shared field list rendered by both the native/mobile-web form and the
// desktop card below -- same state/handlers, only the surrounding chrome
// differs. Kept as a render function (not a component) so it closes over the
// parent's state directly instead of threading ~10 props through.
type FormProps = {
  companyName: string; setCompanyName: (v: string) => void;
  contactPerson: string; setContactPerson: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  gstNumber: string; setGstNumber: (v: string) => void;
  businessType: string; setBusinessType: (v: string) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  isLoading: boolean;
  showTypeDropdown: boolean; setShowTypeDropdown: (v: boolean) => void;
  handleRegister: () => void;
};

function WholesaleForm(p: FormProps) {
  return (
    <>
      <Text style={styles.label}>Company / Store Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter store name"
        placeholderTextColor="#7c8590"
        value={p.companyName}
        onChangeText={p.setCompanyName}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>Contact Person Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#7c8590"
        value={p.contactPerson}
        onChangeText={p.setContactPerson}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>Mobile Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="10-digit mobile number"
        placeholderTextColor="#7c8590"
        keyboardType="phone-pad"
        maxLength={10}
        value={p.phone}
        onChangeText={p.setPhone}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>Email Address *</Text>
      <TextInput
        style={styles.input}
        placeholder="business@example.com"
        placeholderTextColor="#7c8590"
        keyboardType="email-address"
        autoCapitalize="none"
        value={p.email}
        onChangeText={p.setEmail}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>Password *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter secure password"
        placeholderTextColor="#7c8590"
        secureTextEntry
        value={p.password}
        onChangeText={p.setPassword}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>GSTIN (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="15-digit GST Number"
        placeholderTextColor="#7c8590"
        autoCapitalize="characters"
        maxLength={15}
        value={p.gstNumber}
        onChangeText={p.setGstNumber}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>Business Type *</Text>
      <TouchableOpacity
        style={styles.dropdownTrigger}
        onPress={() => p.setShowTypeDropdown(!p.showTypeDropdown)}
        activeOpacity={0.8}
        disabled={p.isLoading}
      >
        <Text style={styles.dropdownTriggerText}>{p.businessType}</Text>
        <Ionicons name={p.showTypeDropdown ? 'chevron-up' : 'chevron-down'} size={20} color={colors.white} />
      </TouchableOpacity>

      {p.showTypeDropdown && (
        <View style={styles.dropdownContainer}>
          {BUSINESS_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.dropdownItem, type === p.businessType && styles.dropdownItemActive]}
              onPress={() => {
                p.setBusinessType(type);
                p.setShowTypeDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemText}>{type}</Text>
              {type === p.businessType && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>City *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter city"
        placeholderTextColor="#7c8590"
        value={p.city}
        onChangeText={p.setCity}
        editable={!p.isLoading}
      />

      <Text style={styles.label}>State *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter state"
        placeholderTextColor="#7c8590"
        value={p.state}
        onChangeText={p.setState}
        editable={!p.isLoading}
      />

      <TouchableOpacity
        style={[styles.registerButton, p.isLoading && styles.disabledButton]}
        onPress={p.handleRegister}
        disabled={p.isLoading}
        activeOpacity={0.85}
      >
        <Text style={styles.registerButtonText}>
          {p.isLoading ? 'Registering...' : 'Submit Registration'}
        </Text>
      </TouchableOpacity>
    </>
  );
}

// Desktop-only (>=1024px). Registers as a full-page screen (see
// setDesktopFullPageScreenActive below) so DesktopAppShell skips its default
// boxed content area + full marketing DesktopFooter -- that footer was
// rendering directly under this short form's un-stretched content on tall
// viewports (the reported "large white section" / "footer overlapping
// content"), since this screen never opted out of the shell's default layout
// the way WelcomeScreen already does. A compact card + lightweight footer,
// mirroring WelcomeScreen's own desktop layout since these two screens are
// the same auth flow (linked via "Create Wholesale Account" / back).
function DesktopWholesaleLayout({ navigation, ...form }: FormProps & { navigation: any }) {
  return (
    <View style={desktopStyles.page}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={desktopStyles.backLink} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
        <Text style={desktopStyles.backLinkText}>Back to Login</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={desktopStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Container style={desktopStyles.center}>
          <View style={desktopStyles.card}>
            <Text style={desktopStyles.title}>Wholesale Registration</Text>
            <Text style={desktopStyles.subtitle}>Register your business for bulk pricing and wholesale features.</Text>
            <WholesaleForm {...form} />
          </View>
        </Container>
      </ScrollView>

      <View style={desktopStyles.footer}>
        <Container style={desktopStyles.footerRow}>
          <Text style={desktopStyles.footerCopy}>© {new Date().getFullYear()} MechBazar. All rights reserved.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('HelpCenter')}>
            <Text style={desktopStyles.footerLink}>Contact</Text>
          </TouchableOpacity>
        </Container>
      </View>
    </View>
  );
}

export default function WholesaleRegistrationScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const { isDesktopUp } = useBreakpoint();

  useFocusEffect(React.useCallback(() => {
    setDesktopFullPageScreenActive(true);
    return () => setDesktopFullPageScreenActive(false);
  }, []));

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

  const formProps: FormProps = {
    companyName, setCompanyName, contactPerson, setContactPerson, phone, setPhone,
    email, setEmail, password, setPassword, gstNumber, setGstNumber,
    businessType, setBusinessType, city, setCity, state, setState,
    isLoading, showTypeDropdown, setShowTypeDropdown, handleRegister,
  };

  if (isDesktopUp) {
    return <DesktopWholesaleLayout navigation={navigation} {...formProps} />;
  }

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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtext}>Register your business for bulk pricing and wholesale features.</Text>
          <WholesaleForm {...formProps} />
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
    flexGrow: 1,
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

// Desktop-only (>=1024px, see DesktopWholesaleLayout above). Same dark brand
// palette as the native screen and as WelcomeScreen's own desktop layout.
const desktopStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.secondary },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: deskSpacing.lg,
    paddingTop: deskSpacing.md,
  },
  backLinkText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: deskSpacing.xl },
  center: { alignItems: 'center' },
  card: {
    width: 560,
    maxWidth: '100%',
    backgroundColor: colors.steel,
    borderRadius: deskRadius.lg,
    padding: deskSpacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: deskSpacing.lg, lineHeight: 19 },
  footer: { borderTopWidth: 1, borderTopColor: '#1E252D' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: deskSpacing.sm,
  },
  footerCopy: { color: colors.textMuted, fontSize: 12 },
  footerLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
