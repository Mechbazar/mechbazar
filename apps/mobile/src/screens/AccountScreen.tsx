import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Image, 
  Modal, 
  Dimensions, 
  Switch,
  Platform,
  Share,
  ActivityIndicator,
  Linking,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { RootState } from '../store';
import { logout, updateUserSuccess } from '../store/authSlice';
import { API_BASE_URL, SERVER_ORIGIN } from '../services/api';
import { fetchMyBookings, cancelServiceBooking } from '../services/service.service';

const { width } = Dimensions.get('window');

const colors = {
  primary: '#E53935',     // Brand Red
  primaryLight: '#FF573C',
  secondary: '#1C1C1E',   // Dark Steel
  darkInk: '#111112',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',      // Cream Clean Bg
  borderLight: '#E8ECEF',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
  success: '#34C759',
  warning: '#FF9500'
};

const MOCK_COUPONS = [
  { code: 'MECH250', desc: 'Get ₹250 OFF on doorstep mechanic service.' },
  { code: 'SPARE10', desc: 'Save flat 10% on genuine Castrol and Bosch spares.' },
  { code: 'WASHFREE', desc: 'Free foam wash on ordering spares above ₹3,000.' }
];

const HeaderBackground = () => (
  <View style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%">
      <Defs>
        <LinearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#1C232B" />
          <Stop offset="100%" stopColor="#0B0D11" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#headerGrad)" />
    </Svg>
  </View>
);

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const activeVehicleId = useSelector((state: RootState) => state.app.activeVehicleId);
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const activeVehicle = myGarage.find(v => v.id === activeVehicleId);

  // Live Database States
  const [bookings, setBookings] = useState<any[]>([]);
  const [addressCount, setAddressCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // UI States
  const [isCouponsVisible, setIsCouponsVisible] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isAboutModalVisible, setIsAboutModalVisible] = useState(false);
  const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
  const [isChangePhoneModalVisible, setIsChangePhoneModalVisible] = useState(false);

  // Change Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Change Phone Form States
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  
  // Section Collapse/Expand states
  const [isSupportExpanded, setIsSupportExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false);

  useEffect(() => {
    // Hydrate application settings from cache
    const hydrateSettings = async () => {
      try {
        const savedDarkMode = await AsyncStorage.getItem('@mechbazar_dark_mode');
        if (savedDarkMode !== null) {
          setIsDarkMode(savedDarkMode === 'true');
        }
        const savedNotifications = await AsyncStorage.getItem('@mechbazar_notifications');
        if (savedNotifications !== null) {
          setIsNotificationsEnabled(savedNotifications === 'true');
        }
        const savedLanguage = await AsyncStorage.getItem('@mechbazar_language');
        if (savedLanguage !== null) {
          setSelectedLanguage(savedLanguage);
        }
      } catch (e) {
        console.error(e);
      }
    };
    hydrateSettings();
  }, []);

  const handleToggleDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
    try {
      await AsyncStorage.setItem('@mechbazar_dark_mode', String(value));
      Alert.alert('Settings', value ? 'Dark mode enabled.' : 'Light mode enabled.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    setIsNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem('@mechbazar_notifications', String(value));
      Alert.alert('Notifications', value ? 'Push notifications enabled. You will receive updates about your bookings.' : 'Push notifications disabled.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectLanguage = async (lang: string) => {
    setSelectedLanguage(lang);
    setIsLanguageModalVisible(false);
    try {
      await AsyncStorage.setItem('@mechbazar_language', lang);
      Alert.alert('Language', `App language updated to ${lang}.`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }
    setIsLoadingData(true);
    setTimeout(() => {
      setIsLoadingData(false);
      setIsChangePasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully!');
    }, 1500);
  };

  const handleSendPhoneOtp = () => {
    if (!newPhone.trim() || newPhone.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setIsVerifyingPhone(true);
    setTimeout(() => {
      setIsVerifyingPhone(false);
      setIsOtpSent(true);
      Alert.alert('Verification Code Sent', 'A 6-digit OTP code has been sent to your new mobile number.');
    }, 1200);
  };

  const handleVerifyAndUpdatePhone = () => {
    if (!otpCode.trim() || otpCode.length < 4) {
      Alert.alert('Validation Error', 'Please enter a valid OTP code.');
      return;
    }
    setIsVerifyingPhone(true);
    setTimeout(() => {
      setIsVerifyingPhone(false);
      setIsChangePhoneModalVisible(false);
      setIsOtpSent(false);
      setOtpCode('');
      
      if (user) {
        dispatch(updateUserSuccess({
          ...user,
          phone: newPhone
        }));
      }
      setNewPhone('');
      Alert.alert('Success', 'Phone number updated successfully!');
    }, 1500);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your Mech Bazar account? All saved vehicles, addresses, and wallet balance will be permanently lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Permanently Delete', 
          style: 'destructive',
          onPress: () => {
            setIsLoadingData(true);
            setTimeout(async () => {
              setIsLoadingData(false);
              dispatch(logout());
              await AsyncStorage.removeItem('@auth_token');
              await AsyncStorage.removeItem('@auth_user');
              Alert.alert('Deleted', 'Your account has been deleted.');
            }, 2000);
          }
        }
      ]
    );
  };

  const loadDatabaseData = async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      // 1. Fetch Service Bookings from Database
      const bookingsData = await fetchMyBookings(token);
      setBookings(bookingsData);

      // 3. Fetch Saved Addresses Count
      const addrRes = await fetch(`${API_BASE_URL}/customers/me/addresses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        setAddressCount(addrData.length);
      }

      // 4. Fetch Unread Notifications Count
      const notifRes = await fetch(`${API_BASE_URL}/customers/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const unread = notifData.filter((n: any) => !n.isRead).length;
        setNotificationCount(unread);
      }
    } catch (e) {
      console.error('Error fetching dashboard database data:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, [token]);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out of Mech Bazar?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this service booking?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            const res = await cancelServiceBooking(token, bookingId, 'Requested from Customer Profile');
            if (res.ok) {
              Alert.alert('Cancelled', 'Your service booking has been cancelled successfully.');
              loadDatabaseData(); // Reload details
            } else {
              Alert.alert('Error', res.error || 'Failed to cancel service booking.');
            }
          }
        }
      ]
    );
  };

  const handleEditProfileImage = () => {
    Alert.alert('Profile Photo', 'Choose from gallery or take a new photo to update.');
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile details edit form is loading...');
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: 'Join Mech Bazar today! Use code MECHREF500 to get ₹500 referral bonus in your wallet on registration.',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* PREMIUM PROFILE HEADER */}
        <View style={styles.profileHeaderCard}>
          <HeaderBackground />
          
          <View style={styles.headerTopRow}>
            {/* Avatar block with camera edit */}
            <View style={styles.avatarWrapper}>
              <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cameraIconBox}>
                  <Ionicons name="camera" size={12} color={colors.white} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Profile Info block */}
            <View style={styles.infoWrapper}>
              <Text style={styles.profileName}>{user?.name || 'Customer User'}</Text>
              <Text style={styles.profilePhone}>{user?.phone || '+91 9876543210'}</Text>
              <Text style={styles.profileCustId}>Cust ID: MB-CUST{user?.id ? user.id.slice(0, 5).toUpperCase() : '847'}</Text>
              
              {/* Badge tier */}
              <View style={styles.badgeRow}>
                <View style={styles.membershipBadge}>
                  <Text style={styles.membershipText}>
                    {user?.accountType === 'WHOLESALE' ? 'PLATINUM WHOLESALE' : 'GOLD RETAIL'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Loyalty & progress row */}
          <View style={styles.loyaltyRow}>
            <View style={styles.loyaltyBox}>
              <Text style={styles.loyaltyLabel}>LOYALTY BALANCE</Text>
              <Text style={styles.loyaltyValue}>850 Points</Text>
            </View>
            <View style={styles.progressBox}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Profile Completion</Text>
                <Text style={styles.progressVal}>80%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: '80%' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* QUICK ACTIONS SCROLLER */}
        <View style={styles.quickActionsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('EditProfile')}>
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#FFECEB' }]}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Garage')}>
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#EBFBEE' }]}>
                <Ionicons name="car-outline" size={20} color="#2B8A3E" />
              </View>
              <Text style={styles.quickActionLabel}>My Garage</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Wishlist')}>
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#E8F7FF' }]}>
                <Ionicons name="heart-outline" size={20} color="#1C7ED6" />
              </View>
              <Text style={styles.quickActionLabel}>Wishlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('AddressManagement')}>
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#FFF9DB' }]}>
                <Ionicons name="location-outline" size={20} color="#F59F00" />
              </View>
              <Text style={styles.quickActionLabel}>Addresses ({addressCount})</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Notifications')}>
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#F8F0FC' }]}>
                <Ionicons name="notifications-outline" size={20} color="#9C36B5" />
              </View>
              <Text style={styles.quickActionLabel}>Alerts ({notificationCount})</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => Alert.alert('Wallet', `Your ledger balance: ₹${user?.wallet || '0.00'}`)}>
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#FFF0F6' }]}>
                <Ionicons name="wallet-outline" size={20} color="#D6336C" />
              </View>
              <Text style={styles.quickActionLabel}>Wallet</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* LOADING INDICATOR FOR LIVE DATABASE CONTENT */}
        {isLoadingData && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Syncing database...</Text>
          </View>
        )}

        {/* MY VEHICLES SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Vehicles</Text>
          {myGarage.length > 0 ? (
            myGarage.map((veh) => (
              <View key={veh.id} style={styles.vehicleCard}>
                <View style={styles.vehHeaderRow}>
                  <View style={styles.vehicleLogoContainer}>
                    <Text style={{ fontSize: 24 }}>🚗</Text>
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.vehicleName}>{veh.brand} {veh.model}</Text>
                    <Text style={styles.vehicleMeta}>{veh.year} • {veh.fuelType || 'Petrol'}</Text>
                    <Text style={styles.vehicleReg}>Reg Number: {veh.id ? `DL-${veh.id.slice(0, 2).toUpperCase()}-XX-8921` : 'Not Registered'}</Text>
                  </View>
                  <View style={[styles.insuranceStatusTag, { backgroundColor: '#EBFBEE' }]}>
                    <Text style={[styles.insuranceStatusText, { color: '#2B8A3E' }]}>Insurance Active</Text>
                  </View>
                </View>
                <View style={styles.serviceDueRow}>
                  <Ionicons name="time-outline" size={14} color={colors.warning} />
                  <Text style={styles.serviceDueText}>Next Service Due: 24 Aug 2026</Text>
                </View>
                <View style={styles.vehicleBtnRow}>
                  <TouchableOpacity style={styles.vehicleSecondaryBtn} onPress={() => Alert.alert('Vehicle Specifications', `Specs: Brand ${veh.brand}, Model ${veh.model}, Fuel ${veh.fuelType || 'Petrol'}.`)}>
                    <Text style={styles.vehicleSecondaryBtnText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.vehiclePrimaryBtn} onPress={() => navigation.navigate('Services')}>
                    <Text style={styles.vehiclePrimaryBtnText}>Book Service</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyVehCard}>
              <Ionicons name="car-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyVehText}>No vehicles saved in your garage.</Text>
              <TouchableOpacity style={styles.addVehOutlineBtn} onPress={() => navigation.navigate('Garage')}>
                <Text style={styles.addVehOutlineText}>+ Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SERVICE BOOKINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Bookings</Text>
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingTitleBox}>
                    <Ionicons name="construct-outline" size={20} color={colors.primary} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.bookingService}>{booking.package?.name || booking.category?.name || 'General Inspection'}</Text>
                      <Text style={styles.bookingVehicle}>{booking.vehicleBrand} {booking.vehicleModel}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusTag, 
                    { backgroundColor: booking.status === 'COMPLETED' ? '#EBFBEE' : '#E8F7FF' }
                  ]}>
                    <Text style={[
                      styles.statusTagText, 
                      { color: booking.status === 'COMPLETED' ? '#2B8A3E' : '#1C7ED6' }
                    ]}>
                      {booking.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookingDetailsRow}>
                  <View style={styles.bookingMetaCol}>
                    <Text style={styles.bookingLabel}>APPOINTMENT DATE</Text>
                    <Text style={styles.bookingValue}>{new Date(booking.scheduledDate).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.bookingMetaCol}>
                    <Text style={styles.bookingLabel}>ASSIGNED MECHANIC</Text>
                    <Text style={styles.bookingValue}>{booking.technician?.user?.name || 'Assigning soon...'}</Text>
                  </View>
                </View>
                <View style={styles.bookingCardBtnRow}>
                  <TouchableOpacity 
                    style={styles.bookingCallBtn}
                    onPress={() => {
                      if (booking.technician?.user?.phone) {
                        Alert.alert('Calling Mechanic', `Calling ${booking.technician.user.name} at ${booking.technician.user.phone}...`);
                      } else {
                        Alert.alert('Not Assigned', 'A doorstep mechanic will be assigned to your booking shortly.');
                      }
                    }}
                  >
                    <Ionicons name="call-outline" size={15} color={colors.secondary} />
                    <Text style={styles.bookingCallText}>Call</Text>
                  </TouchableOpacity>
                  
                  {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' ? (
                    <TouchableOpacity 
                      style={styles.bookingVideoBtn}
                      onPress={() => handleCancelBooking(booking.id)}
                    >
                      <Ionicons name="close-circle-outline" size={15} color={colors.primary} />
                      <Text style={styles.bookingVideoText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.bookingVideoBtn}
                      onPress={() => navigation.navigate('Services')}
                    >
                      <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                      <Text style={styles.bookingVideoText}>Book Again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>You have no service bookings yet.</Text>
            </View>
          )}
        </View>

        {/* WALLET & REWARDS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet & Rewards</Text>
          <View style={styles.walletCard}>
            <View style={styles.walletHeaderRow}>
              <View style={styles.walletHeaderCol}>
                <Text style={styles.walletLabel}>WALLET BALANCE</Text>
                <Text style={styles.walletAmount}>₹{user?.wallet ? user.wallet.toFixed(2) : '0.00'}</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.walletHeaderCol}>
                <Text style={styles.walletLabel}>REWARD COINS</Text>
                <Text style={styles.rewardCoinsVal}>1,200 Coins</Text>
              </View>
            </View>
            <View style={styles.walletBtnRow}>
              <TouchableOpacity style={styles.walletBtn} onPress={() => Alert.alert('Redeem Coins', 'Convert coins to wallet cashback. 100 Coins = ₹10.')}>
                <Ionicons name="ribbon-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.walletBtnText}>Redeem Coins</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.walletBtn} onPress={handleShareReferral}>
                <Ionicons name="share-social-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.walletBtnText}>Refer & Earn</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.couponsFullBtn} onPress={() => setIsCouponsVisible(true)}>
              <Text style={styles.couponsFullBtnText}>View Available Coupons (3 Active) ➔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PROMOTIONAL OFFERS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Promotions & Offers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            <View style={[styles.offerCard, { backgroundColor: '#FFF5F5', borderColor: '#FFA8A8' }]}>
              <Text style={styles.offerCardTitle}>Engine Oil discount</Text>
              <Text style={styles.offerCardDesc}>Save flat 10% on top synthetic engine lubricants.</Text>
            </View>
            <View style={[styles.offerCard, { backgroundColor: '#EBFBEE', borderColor: '#8CE99A' }]}>
              <Text style={styles.offerCardTitle}>Free Car Wash</Text>
              <Text style={styles.offerCardDesc}>Complimentary foam wash with every mechanic visit.</Text>
            </View>
            <View style={[styles.offerCard, { backgroundColor: '#E8F7FF', borderColor: '#74C0FC' }]}>
              <Text style={styles.offerCardTitle}>AC Servicing Off</Text>
              <Text style={styles.offerCardDesc}>Book AC gas refills and save flat ₹200 this week.</Text>
            </View>
          </ScrollView>
        </View>

        {/* COLLAPSIBLE MENUS (SUPPORT, SETTINGS, SECURITY) */}
        
        {/* SUPPORT COLLAPSIBLE CARD */}
        <View style={styles.collapsibleCard}>
          <TouchableOpacity 
            style={styles.collapsibleHeader} 
            onPress={() => setIsSupportExpanded(!isSupportExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.collapsibleTitleRow}>
              <Ionicons name="help-buoy-outline" size={20} color={colors.primary} />
              <Text style={styles.collapsibleTitle}>Support & Help Center</Text>
            </View>
            <Ionicons name={isSupportExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </TouchableOpacity>
          
          {isSupportExpanded && (
            <View style={styles.collapsibleContent}>
              <TouchableOpacity style={styles.collapsibleItem} onPress={() => navigation.navigate('HelpCenter')}>
                <Ionicons name="help-buoy-outline" size={16} color={colors.secondary} />
                <Text style={styles.collapsibleItemText}>FAQs & Articles</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.collapsibleItem} onPress={() => {
                const message = 'Hello Mech Bazar Support, I need help with my account.';
                const url = `https://wa.me/919876543210?text=${encodeURIComponent(message)}`;
                Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp support.'));
              }}>
                <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.secondary} />
                <Text style={styles.collapsibleItemText}>Start Live Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.collapsibleItem} onPress={() => {
                const message = 'Hello Mech Bazar Support, I need help with my bookings.';
                const url = `https://wa.me/919876543210?text=${encodeURIComponent(message)}`;
                Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not launch WhatsApp.'));
              }}>
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                <Text style={styles.collapsibleItemText}>WhatsApp Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.collapsibleItem} onPress={() => {
                Linking.openURL('tel:1800123456').catch(() => Alert.alert('Error', 'Call support is not available on this device.'));
              }}>
                <Ionicons name="call-outline" size={16} color={colors.secondary} />
                <Text style={styles.collapsibleItemText}>Call Support</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SETTINGS COLLAPSIBLE CARD */}
        <View style={styles.collapsibleCard}>
          <TouchableOpacity 
            style={styles.collapsibleHeader} 
            onPress={() => setIsSettingsExpanded(!isSettingsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.collapsibleTitleRow}>
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
              <Text style={styles.collapsibleTitle}>Application Settings</Text>
            </View>
            <Ionicons name={isSettingsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </TouchableOpacity>
          
          {isSettingsExpanded && (
            <View style={styles.collapsibleContent}>
              <View style={styles.collapsibleToggleItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="moon-outline" size={16} color={colors.secondary} />
                  <Text style={styles.collapsibleItemText}>Force Dark Mode</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={handleToggleDarkMode}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={isDarkMode ? '#FFFFFF' : '#f4f3f4'}
                />
              </View>

              <View style={styles.collapsibleToggleItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="notifications-outline" size={16} color={colors.secondary} />
                  <Text style={styles.collapsibleItemText}>Push Notifications</Text>
                </View>
                <Switch
                  value={isNotificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={isNotificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                />
              </View>

              <TouchableOpacity style={styles.collapsibleItem} onPress={() => setIsLanguageModalVisible(true)}>
                <Ionicons name="globe-outline" size={16} color={colors.secondary} />
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.collapsibleItemText}>App Language</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginRight: 8 }}>{selectedLanguage}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.collapsibleItem} onPress={() => setIsAboutModalVisible(true)}>
                <Ionicons name="information-circle-outline" size={16} color={colors.secondary} />
                <Text style={styles.collapsibleItemText}>About Application</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SECURITY COLLAPSIBLE CARD */}
        <View style={styles.collapsibleCard}>
          <TouchableOpacity 
            style={styles.collapsibleHeader} 
            onPress={() => setIsSecurityExpanded(!isSecurityExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.collapsibleTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={styles.collapsibleTitle}>Security & Privacy</Text>
            </View>
            <Ionicons name={isSecurityExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </TouchableOpacity>
          
          {isSecurityExpanded && (
            <View style={styles.collapsibleContent}>
              <TouchableOpacity style={styles.collapsibleItem} onPress={() => setIsChangePasswordModalVisible(true)}>
                <Ionicons name="key-outline" size={16} color={colors.secondary} />
                <Text style={styles.collapsibleItemText}>Change Password</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.collapsibleItem} onPress={() => setIsChangePhoneModalVisible(true)}>
                <Ionicons name="phone-portrait-outline" size={16} color={colors.secondary} />
                <Text style={styles.collapsibleItemText}>Change Phone Number</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.collapsibleItem} onPress={handleDeleteAccount}>
                <Ionicons name="trash-outline" size={16} color={colors.primary} />
                <Text style={[styles.collapsibleItemText, { color: colors.primary }]}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* LOGOUT OUTLINE ACTION BUTTON */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Dynamic Coupons Modal */}
      <Modal
        visible={isCouponsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCouponsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Available Coupons</Text>
            <Text style={styles.modalDesc}>Redeem these coupons on checkout to save flat discounts on spares and services.</Text>
            
            {MOCK_COUPONS.map((coupon, i) => (
              <View key={i} style={styles.couponRow}>
                <View style={styles.couponCodeBadge}>
                  <Text style={styles.couponCodeText}>{coupon.code}</Text>
                </View>
                <Text style={styles.couponDesc}>{coupon.desc}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsCouponsVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* App Language Selection Modal */}
      <Modal
        visible={isLanguageModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Select App Language</Text>
              <TouchableOpacity onPress={() => setIsLanguageModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.darkInk} />
              </TouchableOpacity>
            </View>

            {[
              'English',
              'Hindi (हिन्दी)',
              'Tamil (தமிழ்)',
              'Telugu (తెలుగు)',
              'Bengali (বাংলা)'
            ].map((lang) => (
              <TouchableOpacity 
                key={lang} 
                style={styles.langRow}
                onPress={() => handleSelectLanguage(lang)}
              >
                <Text style={[styles.langText, selectedLanguage === lang && styles.langTextActive]}>
                  {lang}
                </Text>
                {selectedLanguage === lang && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* About Application Modal */}
      <Modal
        visible={isAboutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsAboutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <Ionicons name="settings" size={48} color={colors.primary} style={{ marginBottom: 12 }} />
              <Text style={styles.modalTitle}>Mech Bazar</Text>
              <Text style={styles.aboutVersion}>Version 2.4.0 (Build 902)</Text>
              <Text style={styles.aboutSub}>Everything Your Vehicle Needs, Delivered to Your Doorstep.</Text>
            </View>

            <View style={styles.aboutInfoSection}>
              <View style={styles.aboutInfoRow}>
                <Text style={styles.aboutInfoLabel}>Developer</Text>
                <Text style={styles.aboutInfoVal}>Mech Bazar Team</Text>
              </View>
              <View style={styles.aboutInfoRow}>
                <Text style={styles.aboutInfoLabel}>Server Status</Text>
                <Text style={[styles.aboutInfoVal, { color: colors.success }]}>Online</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.aboutUpdateBtn}
              onPress={() => Alert.alert('Check for Updates', 'You are running the latest version!')}
            >
              <Text style={styles.aboutUpdateBtnText}>Check for Updates</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsAboutModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={isChangePasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChangePasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setIsChangePasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.darkInk} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>CURRENT PASSWORD</Text>
                <TextInput 
                  style={styles.modalTextInput}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="••••••••"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>NEW PASSWORD</Text>
                <TextInput 
                  style={styles.modalTextInput}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Minimum 6 characters"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>CONFIRM NEW PASSWORD</Text>
                <TextInput 
                  style={styles.modalTextInput}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                />
              </View>

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleChangePassword}>
                <Text style={styles.modalSaveBtnText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Phone Number Modal */}
      <Modal
        visible={isChangePhoneModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChangePhoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Change Phone Number</Text>
              <TouchableOpacity onPress={() => setIsChangePhoneModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.darkInk} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>NEW MOBILE NUMBER</Text>
                <TextInput 
                  style={styles.modalTextInput}
                  keyboardType="numeric"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="e.g. 9876543210"
                  editable={!isOtpSent}
                />
              </View>

              {isOtpSent && (
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>ENTER 6-DIGIT OTP</Text>
                  <TextInput 
                    style={styles.modalTextInput}
                    keyboardType="numeric"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder="123456"
                  />
                </View>
              )}

              {isOtpSent ? (
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleVerifyAndUpdatePhone} disabled={isVerifyingPhone}>
                  <Text style={styles.modalSaveBtnText}>
                    {isVerifyingPhone ? 'Verifying...' : 'Verify & Update Number'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSendPhoneOtp} disabled={isVerifyingPhone}>
                  <Text style={styles.modalSaveBtnText}>
                    {isVerifyingPhone ? 'Sending...' : 'Send Verification OTP'}
                  </Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: colors.pageBg 
  },
  scrollContent: { 
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110 
  },
  profileHeaderCard: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
  },
  cameraIconBox: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  infoWrapper: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 2,
  },
  profileCustId: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  membershipBadge: {
    backgroundColor: '#FFEAEA',
    borderWidth: 1,
    borderColor: '#FFA8A8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  membershipText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.primary,
  },
  loyaltyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF10',
    paddingTop: 16,
  },
  loyaltyBox: {
    flex: 1.2,
  },
  loyaltyLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loyaltyValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 2,
  },
  progressBox: {
    flex: 2,
    marginLeft: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  progressVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.white,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#FFFFFF15',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  quickActionsSection: {
    marginBottom: 20,
  },
  quickActionsScroll: {
    paddingRight: 16,
  },
  quickActionBtn: {
    alignItems: 'center',
    width: 76,
    marginRight: 8,
  },
  quickActionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  quickActionLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.secondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    marginLeft: 6,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  statusChipTextActive: {
    color: colors.white,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 12,
    letterSpacing: 0.25,
  },
  vehicleCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
  },
  vehHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  vehicleMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  vehicleReg: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  insuranceStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  insuranceStatusText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  serviceDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9DB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
  },
  serviceDueText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#E67E22',
    marginLeft: 6,
  },
  vehicleBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleSecondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '46%',
    alignItems: 'center',
  },
  vehicleSecondaryBtnText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  vehiclePrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '46%',
    alignItems: 'center',
  },
  vehiclePrimaryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyVehCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 24,
    alignItems: 'center',
  },
  emptyVehText: {
    fontSize: 12,
    color: colors.textMuted,
    marginVertical: 12,
  },
  addVehOutlineBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  addVehOutlineText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
  },
  orderTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 10,
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  orderDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  orderProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  orderProductImg: {
    width: 44,
    height: 44,
    borderRadius: 6,
    resizeMode: 'contain',
  },
  orderProductName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  orderProductAmount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  orderCardBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderSecondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 8,
    width: '46%',
    alignItems: 'center',
  },
  orderSecondaryText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderPrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    width: '46%',
    alignItems: 'center',
  },
  orderPrimaryText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bookingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 10,
    marginBottom: 12,
  },
  bookingTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingService: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  bookingVehicle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  bookingDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bookingMetaCol: {
    width: '46%',
  },
  bookingLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  bookingValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.secondary,
    marginTop: 2,
  },
  bookingCardBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bookingCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 8,
    width: '46%',
    justifyContent: 'center',
  },
  bookingCallText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  bookingVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    width: '46%',
    justifyContent: 'center',
  },
  bookingVideoText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletHeaderCol: {
    width: '46%',
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  walletAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.secondary,
    marginTop: 4,
  },
  rewardCoinsVal: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
  },
  walletBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingVertical: 8,
    width: '48%',
    justifyContent: 'center',
  },
  walletBtnText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  couponsFullBtn: {
    backgroundColor: '#FFEAEA',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  couponsFullBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  offerCard: {
    width: 190,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginRight: 10,
  },
  offerCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.secondary,
    marginBottom: 4,
  },
  offerCardDesc: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
  },
  collapsibleCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapsibleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.secondary,
    marginLeft: 10,
  },
  collapsibleContent: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  collapsibleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  collapsibleItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 10,
  },
  collapsibleToggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: 24,
  },
  logoutText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: colors.primary, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
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
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.secondary,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  couponCodeBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  couponCodeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  couponDesc: {
    marginLeft: 10,
    fontSize: 11,
    color: colors.secondary,
    flex: 1,
  },
  modalCloseBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  modalCloseBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  langText: {
    fontSize: 14,
    color: colors.darkInk,
  },
  langTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  aboutVersion: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.darkInk,
    marginTop: 4,
  },
  aboutSub: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  aboutInfoSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 12,
    marginVertical: 12,
  },
  aboutInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  aboutInfoLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  aboutInfoVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.darkInk,
  },
  aboutUpdateBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  aboutUpdateBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalForm: {
    marginTop: 8,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginBottom: 6,
  },
  modalTextInput: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    color: colors.darkInk,
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalSaveBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  }
});
