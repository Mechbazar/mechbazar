import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle, Path, G } from 'react-native-svg';
import { loginSuccess } from '../../store/authSlice';
import { API_BASE_URL } from '../../services/api';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import Container from '../../components/desktop/shared/Container';
import { spacing as deskSpacing, radius as deskRadius } from '../../theme/tokens';

const { width } = Dimensions.get('window');

const colors = {
  primary: '#E23B22',     
  primaryLight: '#FF573C',
  secondary: '#161B21',   
  steel: '#242C35',       
  white: '#FFFFFF',
  textMuted: '#9AA5B1',
  border: '#2C3540'
};

const SvgBackground = ({ gearRotation, floatAnim }: any) => (
  <View style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%">
      <Defs>
        <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#1C232B" />
          <Stop offset="100%" stopColor="#0B0D11" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bgGrad)" />
    </Svg>
    
    {/* Subtle animated floating gear background overlay */}
    <Animated.View style={[
      styles.animatedGear,
      {
        transform: [
          {
            rotate: gearRotation.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg']
            })
          }
        ]
      }
    ]}>
      <Svg height="120" width="120" viewBox="0 0 100 100" opacity="0.04">
        <Circle cx="50" cy="50" r="30" stroke="#FFFFFF" strokeWidth="4" fill="none" />
        <Path d="M 50 10 L 50 20 M 50 80 L 50 90 M 10 50 L 20 50 M 80 50 L 90 50 M 22 22 L 29 29 M 71 71 L 78 78 M 22 78 L 29 71 M 71 22 L 78 29" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      </Svg>
    </Animated.View>

    {/* Subtle animated floating bike background outline overlay */}
    <Animated.View style={[
      styles.animatedBike,
      {
        transform: [
          {
            translateY: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 12]
            })
          }
        ]
      }
    ]}>
      <Svg height="100" width="150" viewBox="0 0 100 60" opacity="0.03">
        <Path d="M 15,35 L 45,15 L 65,35 L 45,50 L 20,45 Z" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="15" cy="45" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="70" cy="45" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      </Svg>
    </Animated.View>
  </View>
);

const GradientButton = ({ onPress, children, disabled, isLoading }: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        activeOpacity={0.85}
        style={styles.gradientBtnContainer}
      >
        <View style={StyleSheet.absoluteFill}>
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={colors.primaryLight} />
                <Stop offset="100%" stopColor={colors.primary} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={disabled ? "#4A5562" : "url(#btnGrad)"} rx="12" ry="12" />
          </Svg>
        </View>
        <View style={styles.btnContent}>
          {isLoading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            children
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Shared by both the native/mobile-web layout and the desktop layout below
// -- same dev-only API base URL switcher, just rendered from either branch.
const ApiSettingsModal = ({
  visible, tempBaseUrl, setTempBaseUrl, onSave, onReset, onClose,
}: {
  visible: boolean; tempBaseUrl: string; setTempBaseUrl: (v: string) => void;
  onSave: () => void; onReset: () => void; onClose: () => void;
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>API Server Configuration</Text>
        <Text style={styles.modalDesc}>Change backend API base URL for testing environment updates.</Text>

        <TextInput
          style={styles.modalInput}
          value={tempBaseUrl}
          onChangeText={setTempBaseUrl}
          placeholder="http://<IP>:<PORT>/api"
          placeholderTextColor="#6B7480"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.modalBtnRow}>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onReset}>
            <Text style={styles.modalSecondaryBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClose}>
            <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalPrimaryBtn} onPress={onSave}>
            <Text style={styles.modalPrimaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Desktop-only login layout (>=1024px). Reuses every piece of state/logic
// from WelcomeScreen unchanged -- send-otp/login/register calls, validation,
// GradientButton -- only the JSX/layout differs from the native/mobile-web
// version below. Split screen (banner+trust content left, centered login
// card right) instead of one stacked full-height column, so the form is
// visible without scrolling at 1366x768 and the leftover width isn't empty
// space. Sits under DesktopHeader (kept as-is -- already has logo/search/
// categories/nav from the earlier header-compaction pass) via
// setDesktopFullPageScreenActive, which also skips the shell's full
// marketing DesktopFooter in favor of the compact one rendered here.
function DesktopWelcomeLayout({
  mobile, otp, isOtpSent, isLoading, phoneError,
  handlePhoneChange, setOtp, handleSendOtp, handleLogin,
  onOpenSettings, navigation,
}: any) {
  return (
    <View style={desktopStyles.page}>
      <Pressable
        style={desktopStyles.settingsIconBtn}
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Developer settings"
      >
        <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
      </Pressable>

      <Container style={desktopStyles.center}>
        <View style={desktopStyles.splitRow}>
          {/* LEFT: hero copy + banner + benefits */}
          <View style={desktopStyles.leftCol}>
            <Text style={desktopStyles.heroTitle}>India's Smart Vehicle Marketplace</Text>
            <Text style={desktopStyles.heroSubtitle}>Car Parts • Bike Parts • Home Mechanic Services</Text>

            <Image
              source={require('../../../assets/car_banner.jpg')}
              style={desktopStyles.bannerImage}
              resizeMode="cover"
            />

            <View style={desktopStyles.benefitsRow}>
              <View style={desktopStyles.benefitItem}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                <Text style={desktopStyles.benefitText}>Genuine Parts</Text>
              </View>
              <View style={desktopStyles.benefitItem}>
                <Ionicons name="home-outline" size={18} color={colors.primary} />
                <Text style={desktopStyles.benefitText}>Doorstep Service</Text>
              </View>
              <View style={desktopStyles.benefitItem}>
                <Ionicons name="flash-outline" size={18} color={colors.primary} />
                <Text style={desktopStyles.benefitText}>Fast Delivery</Text>
              </View>
            </View>
          </View>

          {/* RIGHT: login card */}
          <View style={desktopStyles.rightCol}>
            <View style={desktopStyles.card}>
              <Text style={desktopStyles.welcomeBack}>Welcome Back</Text>
              <Text style={desktopStyles.continueWith}>Continue with Mobile Number</Text>

              <Text style={desktopStyles.inputLabel}>Mobile Number</Text>
              <View style={[desktopStyles.inputRow, phoneError ? desktopStyles.inputRowError : null]}>
                <View style={desktopStyles.flagBox}>
                  <Text style={desktopStyles.flagText}>🇮🇳</Text>
                  <Text style={desktopStyles.countryCode}>+91</Text>
                  <View style={desktopStyles.verticalDivider} />
                </View>
                <TextInput
                  style={desktopStyles.mobileInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor="#6B7480"
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={handlePhoneChange}
                  editable={!isOtpSent && !isLoading}
                />
              </View>
              {!!phoneError && (
                <View style={desktopStyles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color={colors.primary} />
                  <Text style={desktopStyles.errorText}>{phoneError}</Text>
                </View>
              )}

              {isOtpSent && (
                <View style={desktopStyles.otpSection}>
                  <Text style={desktopStyles.inputLabel}>Enter OTP</Text>
                  <View style={desktopStyles.inputRow}>
                    <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={{ marginRight: 10 }} />
                    <TextInput
                      style={desktopStyles.mobileInput}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#6B7480"
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      editable={!isLoading}
                    />
                  </View>
                </View>
              )}

              <GradientButton
                onPress={isOtpSent ? handleLogin : handleSendOtp}
                isLoading={isLoading}
                disabled={mobile.length < 10}
              >
                <Text style={desktopStyles.primaryBtnText}>{isOtpSent ? 'Verify & Login' : 'Request OTP'}</Text>
              </GradientButton>

              <Pressable
                style={({ hovered }: any) => [desktopStyles.wholesaleBtn, hovered && desktopStyles.wholesaleBtnHovered]}
                onPress={() => navigation.navigate('WholesaleRegistration')}
                accessibilityRole="button"
              >
                <Text style={desktopStyles.wholesaleBtnText}>Create Wholesale Account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Container>

      <View style={desktopStyles.footer}>
        <Container style={desktopStyles.footerRow}>
          <Text style={desktopStyles.footerCopy}>© {new Date().getFullYear()} MechBazar. All rights reserved.</Text>
          <View style={desktopStyles.footerLinks}>
            <Text style={desktopStyles.footerStatic}>Privacy Policy</Text>
            <Text style={desktopStyles.footerDot}>•</Text>
            <Text style={desktopStyles.footerStatic}>Terms</Text>
            <Text style={desktopStyles.footerDot}>•</Text>
            <Pressable onPress={() => navigation.navigate('HelpCenter')}>
              <Text style={desktopStyles.footerLink}>Contact</Text>
            </Pressable>
          </View>
        </Container>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();

  // States
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [activeBaseUrl, setActiveBaseUrl] = useState(API_BASE_URL);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [tempBaseUrl, setTempBaseUrl] = useState(API_BASE_URL);
  const { isDesktopUp } = useBreakpoint();

  useFocusEffect(React.useCallback(() => {
    setDesktopFullPageScreenActive(true);
    return () => setDesktopFullPageScreenActive(false);
  }, []));

  // Animations
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const heroSlideAnim = useRef(new Animated.Value(30)).current;
  const inputFadeAnim = useRef(new Animated.Value(0)).current;
  const gearRotation = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start entry animations
    Animated.parallel([
      Animated.timing(logoFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.timing(heroSlideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      }),
      Animated.timing(inputFadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true
      })
    ]).start();

    // Start background loops
    Animated.loop(
      Animated.timing(gearRotation, {
        toValue: 1,
        duration: 25000,
        useNativeDriver: true
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);

  const handlePhoneChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, '');
    setMobile(numeric);
    if (numeric.length > 0 && numeric.length < 10) {
      setPhoneError('Mobile number must be exactly 10 digits.');
    } else {
      setPhoneError('');
    }
  };

  const handleSendOtp = async () => {
    if (mobile.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${activeBaseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile })
      });
      const data = await res.json();
      setIsLoading(false);
      if (res.ok) {
        setIsOtpSent(true);
        if (data.otp) {
          Alert.alert('OTP Sent', `OTP Code is: ${data.otp} (it is also printed in your backend terminal logs).`);
        } else {
          Alert.alert('OTP Sent', 'An OTP has been sent to your phone.');
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setIsLoading(false);
      Alert.alert('Error', 'Could not connect to server. Check if backend is running.');
    }
  };

  const handleLogin = async () => {
    if (otp.length < 6) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit OTP.');
      return;
    }
    
    setIsLoading(true);
    try {
      let res = await fetch(`${activeBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, otp })
      });
      
      let data = await res.json();

      if (res.status === 401 && data.error?.includes('User not found')) {
        res = await fetch(`${activeBaseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phone: mobile, 
            otp, 
            name: 'Customer User',
            accountType: 'RETAIL'
          })
        });
        data = await res.json();
      }

      if (res.ok) {
        dispatch(loginSuccess({
          user: data.user,
          token: data.token
        }));
      } else {
        Alert.alert('Authentication Failed', data.error || 'Authentication failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Network Error', `Failed to authenticate: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = () => {
    setActiveBaseUrl(tempBaseUrl);
    setIsSettingsVisible(false);
    Alert.alert('Settings Updated', `API base URL set to:\n${tempBaseUrl}`);
  };

  const resetSettings = () => {
    setTempBaseUrl(API_BASE_URL);
    setActiveBaseUrl(API_BASE_URL);
    setIsSettingsVisible(false);
    Alert.alert('Settings Reset', `API base URL reset to default:\n${API_BASE_URL}`);
  };

  if (isDesktopUp) {
    return (
      <>
        <DesktopWelcomeLayout
          mobile={mobile}
          otp={otp}
          isOtpSent={isOtpSent}
          isLoading={isLoading}
          phoneError={phoneError}
          handlePhoneChange={handlePhoneChange}
          setOtp={setOtp}
          handleSendOtp={handleSendOtp}
          handleLogin={handleLogin}
          navigation={navigation}
          onOpenSettings={() => {
            setTempBaseUrl(activeBaseUrl);
            setIsSettingsVisible(true);
          }}
        />
        <ApiSettingsModal
          visible={isSettingsVisible}
          tempBaseUrl={tempBaseUrl}
          setTempBaseUrl={setTempBaseUrl}
          onSave={saveSettings}
          onReset={resetSettings}
          onClose={() => setIsSettingsVisible(false)}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SvgBackground gearRotation={gearRotation} floatAnim={floatAnim} />
      
      {/* Top Header Settings Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity 
          style={styles.settingsIconBtn} 
          onPress={() => {
            setTempBaseUrl(activeBaseUrl);
            setIsSettingsVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardContainer}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={false}
        >
          <View style={styles.mainContent}>
            
            {/* LOGO */}
            <Animated.View style={[styles.logoSection, { opacity: logoFadeAnim }]}>
              <Image 
                source={require('../../../assets/mechbazar_logo.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
              />
            </Animated.View>

            {/* HERO TEXTS */}
            <Animated.View style={[
              styles.heroSection, 
              { 
                opacity: logoFadeAnim,
                transform: [{ translateY: heroSlideAnim }] 
              }
            ]}>
              <Text style={styles.heroTitle}>India's Smart Vehicle Marketplace</Text>
              <Text style={styles.heroSubtitle}>Car Parts • Bike Parts • Home Mechanic Services</Text>
              <Text style={styles.heroDescription}>
                Order genuine spare parts, book expert mechanics at home, and get instant assistance—all in one app.
              </Text>
            </Animated.View>

            {/* FEATURE BADGES */}
            <View style={styles.badgeRow}>
              <View style={styles.featureBadge}>
                <Text style={styles.badgeText}>🚗 Genuine Parts</Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={styles.badgeText}>🏍 Bike & Car Support</Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={styles.badgeText}>🔧 Home Service</Text>
              </View>
            </View>

            {/* TRUST INDICATORS */}
            <View style={styles.trustGrid}>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Verified Mechanics</Text></View>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Genuine Products</Text></View>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Fast Delivery</Text></View>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Secure OTP Login</Text></View>
            </View>

            {/* LOGIN INPUT CARD */}
            <Animated.View style={[styles.authContainer, { opacity: inputFadeAnim }]}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputRow, phoneError ? styles.inputRowError : null]}>
                <View style={styles.flagBox}>
                  <Text style={styles.flagText}>🇮🇳</Text>
                  <Text style={styles.countryCode}>+91</Text>
                  <View style={styles.verticalDivider} />
                </View>
                <TextInput
                  style={styles.mobileInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor="#6B7480"
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={handlePhoneChange}
                  editable={!isOtpSent && !isLoading}
                  autoFocus={true}
                />
              </View>
              {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

              {isOtpSent && (
                <View style={styles.otpSection}>
                  <Text style={styles.inputLabel}>Enter OTP</Text>
                  <View style={styles.otpInputRow}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.otpInput}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#6B7480"
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      editable={!isLoading}
                    />
                  </View>
                </View>
              )}

              <GradientButton 
                onPress={isOtpSent ? handleLogin : handleSendOtp} 
                isLoading={isLoading}
                disabled={mobile.length < 10}
              >
                <Text style={styles.primaryBtnText}>
                  {isOtpSent ? 'Verify & Login' : 'Send OTP'}
                </Text>
              </GradientButton>
            </Animated.View>

          </View>

          {/* FOOTER */}
          <View style={styles.footerContainer}>
            <View style={styles.footerTextRow}>
              <TouchableOpacity onPress={() => navigation.navigate('WholesaleRegistration')} activeOpacity={0.7}>
                <Text style={styles.linkText}>Create Wholesale Account</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic API Configuration Modal (Top-Right Settings) */}
      <Modal
        visible={isSettingsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>API Server Configuration</Text>
            <Text style={styles.modalDesc}>Change backend API base URL for testing environment updates.</Text>
            
            <TextInput
              style={styles.modalInput}
              value={tempBaseUrl}
              onChangeText={setTempBaseUrl}
              placeholder="http://<IP>:<PORT>/api"
              placeholderTextColor="#6B7480"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={resetSettings}>
                <Text style={styles.modalSecondaryBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setIsSettingsVisible(false)}>
                <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={saveSettings}>
                <Text style={styles.modalPrimaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1116',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  settingsIconBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF10',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF15',
  },
  animatedGear: {
    position: 'absolute',
    top: 50,
    right: -20,
  },
  animatedBike: {
    position: 'absolute',
    bottom: 80,
    left: -30,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logoImage: {
    width: 170,
    height: 52,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroDescription: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 18,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
  },
  featureBadge: {
    backgroundColor: '#242C3570',
    borderWidth: 1,
    borderColor: '#343E4A50',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
    marginHorizontal: -4,
  },
  trustItem: {
    width: '46%',
    margin: 3,
    backgroundColor: '#1E252D50',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#FFFFFF05',
  },
  trustItemText: {
    color: '#8FA0B3',
    fontSize: 10,
    fontWeight: '600',
  },
  authContainer: {
    backgroundColor: colors.steel,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2026',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343E4A',
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 4,
  },
  inputRowError: {
    borderColor: colors.primary,
  },
  flagBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagText: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 6,
  },
  verticalDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#343E4A',
    marginHorizontal: 12,
  },
  mobileInput: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
  },
  errorText: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  otpSection: {
    marginTop: 14,
  },
  otpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2026',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343E4A',
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  otpInput: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
  },
  gradientBtnContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    borderRadius: 12,
  },
  btnContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.steel,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#1B2026',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343E4A',
    color: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 24,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
  },
  modalSecondaryBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  }
});

// Desktop-only (>=1024px, see DesktopWelcomeLayout above). Same dark brand
// palette (`colors` above) as the native screen -- this is a layout change,
// not a re-theme.
const desktopStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0E1116' },
  settingsIconBtn: {
    position: 'absolute' as any,
    top: deskSpacing.md,
    right: deskSpacing.md,
    zIndex: 10,
    padding: 8,
    backgroundColor: '#FFFFFF0D',
    borderRadius: deskRadius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF15',
  },
  center: { flex: 1, justifyContent: 'center', paddingVertical: deskSpacing.xl },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: deskSpacing.xxl,
  },
  leftCol: { flex: 1.15 },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
    marginBottom: deskSpacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerImage: {
    width: '100%',
    height: 320,
    borderRadius: deskRadius.lg,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: deskSpacing.lg,
    marginTop: deskSpacing.md,
  },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  rightCol: { width: 480, maxWidth: 480, flexShrink: 0, alignItems: 'stretch' },
  card: {
    backgroundColor: colors.steel,
    borderRadius: deskRadius.lg,
    padding: deskSpacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  welcomeBack: { fontSize: 22, fontWeight: '800', color: colors.white },
  continueWith: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: deskSpacing.lg },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.white, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2026',
    borderRadius: deskRadius.md,
    borderWidth: 1,
    borderColor: '#343E4A',
    paddingHorizontal: 12,
    height: 50,
  },
  inputRowError: { borderColor: colors.primary },
  flagBox: { flexDirection: 'row', alignItems: 'center' },
  flagText: { fontSize: 17 },
  countryCode: { fontSize: 15, fontWeight: '600', color: colors.white, marginLeft: 6 },
  verticalDivider: { width: 1, height: 20, backgroundColor: '#343E4A', marginHorizontal: 12 },
  mobileInput: { flex: 1, fontSize: 15, color: colors.white, outlineStyle: 'none' as any },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  errorText: { color: colors.primary, fontSize: 12 },
  otpSection: { marginTop: deskSpacing.md },
  primaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
  },
  wholesaleBtn: {
    marginTop: deskSpacing.md,
    height: 44,
    borderRadius: deskRadius.md,
    borderWidth: 1.5,
    borderColor: '#343E4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wholesaleBtnHovered: { borderColor: colors.primary },
  wholesaleBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: '#1E252D' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: deskSpacing.sm,
  },
  footerCopy: { color: colors.textMuted, fontSize: 12 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerStatic: { color: colors.textMuted, fontSize: 12 },
  footerLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  footerDot: { color: '#3A4552', fontSize: 12 },
});
