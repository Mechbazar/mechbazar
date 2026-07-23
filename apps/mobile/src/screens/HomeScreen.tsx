// Used for native builds only -- HomeScreen.web.tsx shadows this file on web
// (desktop width renders HomeScreenDesktop.tsx, narrower web widths render
// HomeScreenMobile.tsx, a deliberate byte-for-byte duplicate of this file's
// original content kept in sync manually). If you change native/mobile Home
// behavior here, mirror the change in HomeScreenMobile.tsx.
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Dimensions, 
  Animated, 
  ImageBackground,
  Alert,
  Modal,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import { addToCart, updateQuantity } from '../store/cartSlice';
import { setVehicleType } from '../store/appSlice';
import { fetchCategories, getTrendingProducts, fetchBanners } from '../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../services/wishlist.service';
import { VehicleType, Category, Product } from '../types/product';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

// Premium Design System Colors
const colors = {
  primary: '#E53935',     // Brand Red
  primaryDark: '#B71C1C', 
  secondary: '#1C1C1E',   // Steel charcoal
  darkInk: '#111112',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',      // Creamy clean content bg
  borderLight: '#E8ECEF',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
  success: '#34C759'
};

const SERVICES = [
  { id: 's1', type: 'wash', name: 'Premium Wash', price: 199 },
  { id: 's2', type: 'ac', name: 'AC Servicing', price: 499 },
  { id: 's3', type: 'oil', name: 'Oil Change', price: 399 },
  { id: 's4', type: 'battery', name: 'Battery Service', price: 999 },
  { id: 's5', type: 'tyre', name: 'Tyre Service', price: 149 },
  { id: 's6', type: 'brake', name: 'Brake Service', price: 299 },
  { id: 's7', type: 'spa', name: 'Car Spa', price: 799 },
  { id: 's8', type: 'emergency', name: 'Emergency Help', price: 499 }
];

import Svg, { Rect, Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';

const ServiceIllustration = ({ type }: { type: string }) => {
  switch (type) {
    case 'wash':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="washGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#washGrad)" />
            <Path d="M 25,40 C 25,40 30,25 45,25 L 65,25 C 65,25 75,30 80,40 Z" fill="none" stroke="#E53935" strokeWidth="2.5" />
            <Circle cx="35" cy="40" r="5" fill="#FFFFFF" />
            <Circle cx="65" cy="40" r="5" fill="#FFFFFF" />
            <Circle cx="50" cy="15" r="2" fill="#E53935" />
            <Circle cx="45" cy="18" r="1.5" fill="#FFFFFF" />
            <Circle cx="55" cy="18" r="1.5" fill="#FFFFFF" />
            <Circle cx="40" cy="20" r="1" fill="#E53935" />
            <Circle cx="60" cy="20" r="1" fill="#FFFFFF" />
          </Svg>
        </View>
      );
    case 'ac':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="acGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#acGrad)" />
            <Path d="M 50,15 L 50,45 M 35,30 L 65,30 M 39,20 L 61,40 M 39,40 L 61,20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <Path d="M 46,18 L 50,22 L 54,18 M 46,42 L 50,38 L 54,42 M 38,26 L 42,30 L 38,34 M 62,26 L 58,30 L 62,34" stroke="#E53935" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </Svg>
        </View>
      );
    case 'oil':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="oilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#oilGrad)" />
            <Path d="M 35,45 L 35,25 L 42,20 L 48,20 L 48,25 L 55,27 L 55,45 Z" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
            <Path d="M 65,30 C 65,35 60,38 60,38 C 60,38 55,35 55,30 C 55,27 60,24 60,24 C 60,24 65,27 65,30 Z" fill="#E53935" />
            <Path d="M 25,20 L 30,25 M 23,17 C 25,19 25,22 23,24" stroke="#E53935" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
      );
    case 'battery':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="battGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#battGrad)" />
            <Rect x="25" y="22" width="50" height="26" rx="4" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
            <Rect x="32" y="16" width="10" height="6" fill="#E53935" rx="1" />
            <Rect x="58" y="16" width="10" height="6" fill="#FFFFFF" rx="1" />
            <Path d="M 35,28 L 39,28 M 37,26 L 37,30" stroke="#E53935" strokeWidth="1.5" />
            <Path d="M 61,28 L 65,28" stroke="#FFFFFF" strokeWidth="1.5" />
          </Svg>
        </View>
      );
    case 'tyre':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="tyreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#tyreGrad)" />
            <Circle cx="50" cy="30" r="18" fill="none" stroke="#FFFFFF" strokeWidth="4" />
            <Circle cx="50" cy="30" r="10" fill="none" stroke="#E53935" strokeWidth="2" />
            <Path d="M 50,19 L 50,41 M 39,30 L 61,30" stroke="#FFFFFF" strokeWidth="1.5" />
          </Svg>
        </View>
      );
    case 'brake':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="brakeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#brakeGrad)" />
            <Circle cx="50" cy="30" r="18" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
            <Circle cx="50" cy="30" r="6" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
            <Path d="M 33,18 C 36,13 42,11 48,11 L 46,24 C 43,24 38,26 33,18 Z" fill="#E53935" />
          </Svg>
        </View>
      );
    case 'spa':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="spaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#spaGrad)" />
            <Path d="M 20,38 C 20,38 25,23 40,23 L 65,23 C 65,23 75,28 78,38 Z" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <Circle cx="32" cy="38" r="5" fill="#E53935" />
            <Circle cx="62" cy="38" r="5" fill="#E53935" />
            <Path d="M 45,15 L 47,18 L 50,15 L 47,12 Z" fill="#FFD700" />
            <Path d="M 75,18 L 76,20 L 78,18 L 76,16 Z" fill="#FFFFFF" />
          </Svg>
        </View>
      );
    case 'emergency':
      return (
        <View style={styles.svgCardContainer}>
          <Svg height="90" width="100%" viewBox="0 0 100 60">
            <Defs>
              <LinearGradient id="emGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#2C3540" />
                <Stop offset="100%" stopColor="#1C2229" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="60" fill="url(#emGrad)" />
            <Path d="M 50,15 L 75,45 L 25,45 Z" fill="none" stroke="#E53935" strokeWidth="3" strokeLinejoin="round" />
            <Path d="M 50,26 L 50,35 M 50,39 L 50,41" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </Svg>
        </View>
      );
    default:
      return null;
  }
};

const OFFERS = [
  { title: '⚡ Flash Sale', desc: 'Up to 60% OFF', code: 'FLASH60', color: '#FFF5F5', borderColor: '#FFA8A8' },
  { title: '🎁 Combo Deals', desc: 'Save flat ₹500', code: 'COMBO500', color: '#F8F0FC', borderColor: '#E599F7' },
  { title: '🔋 Battery Exchange', desc: 'Flat ₹1,000 Exchange Bonus', code: 'BATTSWAP', color: '#EBFBEE', borderColor: '#8CE99A' },
  { title: '🚚 Free Delivery', desc: 'No minimum order today', code: 'FREESHIP', color: '#E8F7FF', borderColor: '#74C0FC' }
];

export default function HomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const activeVehicleId = useSelector((state: RootState) => state.app.activeVehicleId);
  const activeVehicle = myGarage.find(v => v.id === activeVehicleId);

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(['Castrol Oil', 'Spark Plugs']);
  const [locationName, setLocationName] = useState('Fetching location...');
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [isHomeContentLoading, setIsHomeContentLoading] = useState(true);

  // Voice & Scanner States
  const [isVoiceSearchVisible, setIsVoiceSearchVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [voiceText, setVoiceText] = useState('Listening...');
  const [isListening, setIsListening] = useState(false);
  const [scannerMsg, setScannerMsg] = useState('Align barcode or QR code inside the frame');
  const [torchOn, setTorchOn] = useState(false);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isScannerVisible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 180,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [isScannerVisible]);

  useEffect(() => {
    if (isVoiceSearchVisible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isVoiceSearchVisible]);

  // Scroll View Ref for anchor jumps
  const mainScrollRef = useRef<ScrollView>(null);
  const bannerScrollRef = useRef<ScrollView>(null);

  const suggestions = ['Engine Oils', 'Brake Pads', 'Helmets', 'Car Wash Kit', 'Mechanics'];

  // Banner slide loop
  useEffect(() => {
    if (banners.length === 0) return;
    const bannerTimer = setInterval(() => {
      const nextIdx = (activeBannerIndex + 1) % banners.length;
      bannerScrollRef.current?.scrollTo({ x: nextIdx * width, animated: true });
      setActiveBannerIndex(nextIdx);
    }, 4500);
    return () => clearInterval(bannerTimer);
  }, [activeBannerIndex, banners]);

  // Load backend content
  useEffect(() => {
    setIsHomeContentLoading(true);
    Promise.all([
      fetchCategories(vehicleType).then(setCategories),
      getTrendingProducts(vehicleType).then(setTrendingProducts),
      fetchBanners(vehicleType).then(setBanners),
    ]).finally(() => setIsHomeContentLoading(false));
  }, [vehicleType]);

  useEffect(() => {
    if (!token) {
      setWishlist({});
      return;
    }
    fetchMyWishlist(token).then(items => {
      setWishlist(Object.fromEntries(items.map(i => [i.id, true])));
    });
  }, [token]);

  // Request location
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('New Delhi');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        let geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        if (geocode.length > 0) {
          const place = geocode[0];
          setLocationName(`${place.city || place.district || place.region || 'Delhi'}`);
        }
      } catch (error) {
        setLocationName('New Delhi');
      }
    })();
  }, []);

  // Animating Vehicle Switch Toggle Indicator
  const toggleIndicatorPosition = useRef(new Animated.Value(vehicleType === VehicleType.BIKE ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(toggleIndicatorPosition, {
      toValue: vehicleType === VehicleType.BIKE ? 1 : 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }, [vehicleType]);

  const toggleVehicleType = (type: VehicleType) => {
    dispatch(setVehicleType(type));
  };

  const handleSearch = () => {
    if (searchQuery.trim().length > 0) {
      if (!recentSearches.includes(searchQuery.trim())) {
        setRecentSearches(prev => [searchQuery.trim(), ...prev.slice(0, 4)]);
      }
      setIsSearchFocused(false);
      navigation.navigate('CategoryProducts', {
        categoryName: 'Search Results',
        initialSearchQuery: searchQuery,
        brandId: activeVehicle?.brand || undefined,
        modelId: activeVehicle?.model || undefined,
        year: activeVehicle?.year || undefined
      });
    }
  };

  const handleSuggestionPress = (term: string) => {
    setSearchQuery(term);
    setIsSearchFocused(false);
    navigation.navigate('CategoryProducts', {
      categoryName: 'Search Results',
      initialSearchQuery: term,
      brandId: activeVehicle?.brand || undefined,
      modelId: activeVehicle?.model || undefined,
      year: activeVehicle?.year || undefined
    });
  };

  const startVoiceSearch = () => {
    setVoiceText('Listening...');
    setIsListening(true);
    setIsVoiceSearchVisible(true);
    
    // Simulate speech recognition after 2 seconds
    setTimeout(() => {
      setVoiceText("Hearing 'brake pads'...");
      setTimeout(() => {
        setIsVoiceSearchVisible(false);
        setIsListening(false);
        setSearchQuery('brake pad');
        navigation.navigate('CategoryProducts', {
          categoryName: 'Search Results',
          initialSearchQuery: 'brake pad',
          brandId: activeVehicle?.brand || undefined,
          modelId: activeVehicle?.model || undefined,
          year: activeVehicle?.year || undefined
        });
      }, 1000);
    }, 2000);
  };

  const startBarcodeScan = () => {
    setScannerMsg('Align barcode or QR code inside the frame');
    setIsScannerVisible(true);
    
    // Simulate scanner detection after 2.5 seconds
    setTimeout(() => {
      setScannerMsg('Code Detected! Loading product...');
      setTimeout(() => {
        setIsScannerVisible(false);
        setSearchQuery('Castrol oil');
        navigation.navigate('CategoryProducts', {
          categoryName: 'Search Results',
          initialSearchQuery: 'Castrol oil',
          brandId: activeVehicle?.brand || undefined,
          modelId: activeVehicle?.model || undefined,
          year: activeVehicle?.year || undefined
        });
      }, 1000);
    }, 2500);
  };

  const handleWishlistToggle = async (id: string) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to save items to your wishlist.');
      return;
    }
    const wasWishlisted = !!wishlist[id];
    setWishlist(prev => ({ ...prev, [id]: !wasWishlisted }));
    const result = wasWishlisted ? await removeFromWishlist(token, id) : await addToWishlist(token, id);
    if (!result.ok) {
      setWishlist(prev => ({ ...prev, [id]: wasWishlisted }));
      Alert.alert('Error', result.error || 'Failed to update wishlist');
      return;
    }
    Alert.alert('Wishlist', !wasWishlisted ? 'Product added to wishlist.' : 'Product removed from wishlist.');
  };

  const handleShareProduct = (name: string) => {
    Alert.alert('Share Product', `Link to ${name} has been copied to your clipboard.`);
  };

  const handleEmergencyBreakdown = () => {
    Alert.alert(
      'Emergency Roadside Help',
      'Need immediate breakdown dispatch? A local service technician will be directed to your current location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call Dispatcher', 
          style: 'destructive', 
          onPress: () => Alert.alert('Request Sent', 'A verification agent is calling you back in 60 seconds.') 
        }
      ]
    );
  };

  const getProductQtyInCart = (prodId: string) => {
    const item = cartItems.find(i => i.id === prodId);
    return item ? item.qty : 0;
  };

  const handleProductCardQtyChange = (prod: Product, change: number) => {
    const currentQty = getProductQtyInCart(prod.id);
    const newQty = currentQty + change;
    dispatch(updateQuantity({ id: prod.id, qty: newQty }));
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top sticky logo / profiles bar */}
      <View style={styles.headerTop}>
        <Image 
          source={require('../../assets/mechbazar_logo.png')} 
          style={styles.headerLogo} 
          resizeMode="contain" 
        />
        
        {/* Right side icons row */}
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={() => navigation.navigate('Wishlist')}
          >
            <Ionicons name="heart-outline" size={22} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={() => navigation.navigate('Cart')}
          >
            {cartItemCount > 0 && (
              <View style={styles.badgeBubble}>
                <Text style={styles.badgeText}>{cartItemCount}</Text>
              </View>
            )}
            <Ionicons name="cart-outline" size={22} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={() => navigation.navigate('Notifications')}
          >
            <View style={[styles.badgeBubble, { backgroundColor: colors.primary, width: 8, height: 8, borderRadius: 4, top: 4, right: 4 }]} />
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={() => navigation.navigate('Account')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.white} />
          </TouchableOpacity>

          {/* User profile avatar */}
          <TouchableOpacity 
            style={styles.avatarBtn} 
            onPress={() => navigation.navigate('Account')}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{user?.name ? user.name[0] : 'U'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location row */}
      <View style={styles.locationBar}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <Text style={styles.locationLabel}>Deliver to - </Text>
        <TouchableOpacity 
          style={styles.locationSelectorRow} 
          onPress={() => Alert.alert('Change Location', 'GPS geocoding has set your delivery zone.')}
        >
          <Text style={styles.locationText} numberOfLines={1}>{locationName}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.white} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {/* Search Input bar */}
      <View style={styles.searchBarRow}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginLeft: 12 }} />
        <TextInput 
          style={styles.searchInput} 
          placeholder="Search genuine parts, accessories & services..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={startVoiceSearch} style={styles.searchSideBtn}>
          <Ionicons name="mic" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={startBarcodeScan} style={styles.searchSideBtn}>
          <Ionicons name="qr-code-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Segmented Cars/Bikes Toggle inside sticky header to avoid overlapping */}
      <View style={styles.toggleContainer}>
        <Animated.View
          style={[
            styles.toggleIndicator,
            {
              transform: [{
                translateX: toggleIndicatorPosition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, ((width - 32) / 2) - 4],
                }),
              }],
            },
          ]}
        />
        <TouchableOpacity style={styles.toggleButton} onPress={() => toggleVehicleType(VehicleType.CAR)}>
          <Text style={[styles.toggleText, vehicleType === VehicleType.CAR && styles.toggleTextActive]}>Cars 🚗</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleButton} onPress={() => toggleVehicleType(VehicleType.BIKE)}>
          <Text style={[styles.toggleText, vehicleType === VehicleType.BIKE && styles.toggleTextActive]}>Bikes 🏍️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBanners = () => {
    return (
      <View>
        <ScrollView 
          ref={bannerScrollRef}
          horizontal 
          pagingEnabled
          showsHorizontalScrollIndicator={false} 
          onScroll={(e) => {
            const scrollPos = e.nativeEvent.contentOffset.x;
            const index = Math.round(scrollPos / width);
            setActiveBannerIndex(index);
          }}
          scrollEventThrottle={16}
        >
          {banners.map((banner, index) => (
            <View key={banner.id} style={{ width }}>
              <ImageBackground 
                source={banner.image} 
                style={styles.fullBanner}
                imageStyle={{ borderRadius: 16 }}
              >
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitleText}>{banner.title}</Text>
                  <Text style={styles.bannerSubtitleText}>{banner.subtitle}</Text>
                  <Text style={styles.bannerOfferText}>{banner.offer}</Text>
                  
                  <TouchableOpacity style={styles.shopNowBtn} onPress={handleSearch}>
                    <Text style={styles.shopNowText}>Shop Now ➔</Text>
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            </View>
          ))}
        </ScrollView>
        <View style={styles.paginationContainer}>
          {banners.map((_, index) => (
            <View 
              key={index} 
              style={[
                styles.paginationDot, 
                activeBannerIndex === index ? styles.paginationDotActive : styles.paginationDotInactive
              ]} 
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        
        {/* Banner Section */}
        <View style={styles.bannerSection}>
          {renderBanners()}
        </View>

        {/* QUICK ACTIONS SECTION */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.quickGrid}>
            <TouchableOpacity 
              style={styles.quickCard} 
              onPress={() => mainScrollRef.current?.scrollTo({ y: 380, animated: true })}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#FFECEB' }]}>
                <Ionicons name="car" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel}>Spare Parts</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickCard} 
              onPress={() => mainScrollRef.current?.scrollTo({ y: 880, animated: true })}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#EBFBEE' }]}>
                <Ionicons name="build" size={24} color="#2B8A3E" />
              </View>
              <Text style={styles.quickLabel}>Home Mechanic</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickCard} 
              onPress={() => Alert.alert('Video Consultation', 'Connecting with a live consulting technician...')}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#E8F7FF' }]}>
                <Ionicons name="videocam" size={24} color="#1C7ED6" />
              </View>
              <Text style={styles.quickLabel}>Video Call</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickCard} 
              onPress={handleEmergencyBreakdown}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#FFF9DB' }]}>
                <Ionicons name="flash" size={24} color="#F59F00" />
              </View>
              <Text style={styles.quickLabel}>Breakdown</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickCard} 
              onPress={() => mainScrollRef.current?.scrollTo({ y: 380, animated: true })}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#F8F0FC' }]}>
                <Ionicons name="construct" size={24} color="#9C36B5" />
              </View>
              <Text style={styles.quickLabel}>Garage Tools</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickCard} 
              onPress={() => mainScrollRef.current?.scrollTo({ y: 1120, animated: true })}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#FFF0F6' }]}>
                <Ionicons name="gift" size={24} color="#D6336C" />
              </View>
              <Text style={styles.quickLabel}>Today's Deals</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SHOP BY CATEGORY SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
          </View>
          {isHomeContentLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                style={styles.categoryItem} 
                onPress={() => navigation.navigate('CategoryProducts', { 
                  categoryName: cat.name,
                  brandId: activeVehicle?.brand || undefined,
                  modelId: activeVehicle?.model || undefined,
                  year: activeVehicle?.year || undefined
                })}
              >
                <View style={styles.categoryIconCircle}>
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={styles.categoryIconImg} />
                  ) : (
                    <Text style={styles.categoryEmoji}>{cat.icon || '📦'}</Text>
                  )}
                </View>
                <Text style={styles.categoryLabelText} numberOfLines={2}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          )}
        </View>

        {/* SERVICES SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Doorstep Services</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Services')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {SERVICES.map((serv) => (
              <View key={serv.id} style={styles.serviceCard}>
                <ServiceIllustration type={serv.type} />
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{serv.name}</Text>
                  <Text style={styles.servicePrice}>Starts at ₹{serv.price}</Text>
                  <TouchableOpacity 
                    style={styles.serviceBookBtn}
                    onPress={() => navigation.navigate('Services')}
                  >
                    <Text style={styles.serviceBookBtnText}>Book Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* FEATURED / TRENDING PRODUCTS SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending {vehicleType === VehicleType.CAR ? 'Car Parts' : 'Bike Parts'}</Text>
          </View>
          
          {isHomeContentLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {trendingProducts.map((prod) => {
              const qtyInCart = getProductQtyInCart(prod.id);
              return (
                <View key={prod.id} style={styles.productCard}>
                  {/* Share & Wishlist overlay */}
                  <View style={styles.cardHeaderOverlay}>
                    <TouchableOpacity onPress={() => handleWishlistToggle(prod.id)} style={styles.badgeRoundBtn}>
                      <Ionicons 
                        name={wishlist[prod.id] ? "heart" : "heart-outline"} 
                        size={16} 
                        color={wishlist[prod.id] ? colors.primary : colors.textMuted} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShareProduct(prod.name)} style={[styles.badgeRoundBtn, { marginTop: 6 }]}>
                      <Ionicons name="share-social-outline" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    onPress={() => navigation.navigate('ProductDetails', { productId: prod.id })}
                    style={styles.imageContainer}
                  >
                    <Image source={{ uri: prod.image }} style={styles.productImage} />
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerText}>⏱ {prod.time}</Text>
                    </View>
                    {(prod.discountPercentage ?? 0) > 0 && (
                      <View style={styles.discountTag}>
                        <Text style={styles.discountTagText}>{prod.discountPercentage}% OFF</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                
                  <View style={styles.productInfo}>
                    <Text style={styles.productBrand}>{prod.brand}</Text>
                    <Text style={styles.productName} numberOfLines={2}>{prod.name}</Text>
                    
                    {/* Ratings */}
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color="#F5A300" />
                      <Text style={styles.ratingText}>{prod.rating} ({prod.reviewsCount} reviews)</Text>
                    </View>

                    {/* Stock status */}
                    <Text style={[styles.stockLabel, { color: prod.stockStatus === 'In Stock' ? colors.success : '#F5A300' }]}>
                      ● {prod.stockStatus}
                    </Text>

                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.originalPrice}>MRP ₹{prod.originalPrice}</Text>
                        <Text style={styles.price}>₹{prod.price}</Text>
                      </View>

                      {qtyInCart > 0 ? (
                        <View style={styles.qtyContainer}>
                          <TouchableOpacity 
                            style={styles.qtyBtn}
                            onPress={() => handleProductCardQtyChange(prod, -1)}
                          >
                            <Text style={styles.qtyBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyTextVal}>{qtyInCart}</Text>
                          <TouchableOpacity 
                            style={styles.qtyBtn}
                            onPress={() => handleProductCardQtyChange(prod, 1)}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.addButton}
                          onPress={() => dispatch(addToCart({ 
                            id: prod.id, 
                            name: prod.name, 
                            price: prod.price, 
                            originalPrice: prod.originalPrice, 
                            image: prod.image, 
                            isB2B: prod.isB2B,
                            moq: prod.moq,
                            vehicleType: prod.vehicleType
                          }))}
                        >
                          <Text style={styles.addButtonText}>ADD</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity 
                      style={styles.buyNowBtn}
                      onPress={() => {
                        if (qtyInCart === 0) {
                          dispatch(addToCart({ 
                            id: prod.id, 
                            name: prod.name, 
                            price: prod.price, 
                            originalPrice: prod.originalPrice, 
                            image: prod.image, 
                            isB2B: prod.isB2B,
                            moq: prod.moq,
                            vehicleType: prod.vehicleType
                          }));
                        }
                        navigation.navigate('Cart');
                      }}
                    >
                      <Text style={styles.buyNowBtnText}>Buy Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          )}
        </View>


        {/* TODAY'S OFFERS SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Special Offers</Text>
          </View>
          <View style={styles.offersGrid}>
            {OFFERS.map((offer, idx) => (
              <View 
                key={idx} 
                style={[styles.offerCard, { backgroundColor: offer.color, borderColor: offer.borderColor }]}
              >
                <Text style={styles.offerTitle}>{offer.title}</Text>
                <Text style={styles.offerDesc}>{offer.desc}</Text>
                <View style={styles.offerBadge}>
                  <Text style={styles.offerBadgeText}>{offer.code}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* TRUST ACCREDITATION SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Promises</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            <View style={styles.trustCard}><Text style={styles.trustCardText}>💯 Genuine Parts</Text></View>
            <View style={styles.trustCard}><Text style={styles.trustCardText}>🛠️ Verified Mechanics</Text></View>
            <View style={styles.trustCard}><Text style={styles.trustCardText}>🚀 Fast Delivery</Text></View>
            <View style={styles.trustCard}><Text style={styles.trustCardText}>🔒 Secure Payments</Text></View>
            <View style={styles.trustCard}><Text style={styles.trustCardText}>📞 24x7 Support</Text></View>
          </ScrollView>
        </View>

        {/* WHY CHOOSE MECH BAZAR SECTION */}
        <View style={[styles.section, { marginBottom: 12 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Why Choose Mech Bazar?</Text>
          </View>
          <View style={styles.whyGrid}>
            <View style={styles.whyCard}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
              <Text style={styles.whyTitle}>Doorstep Service</Text>
            </View>
            <View style={styles.whyCard}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
              <Text style={styles.whyTitle}>Expert Mechanics</Text>
            </View>
            <View style={styles.whyCard}>
              <Ionicons name="map-outline" size={24} color={colors.primary} />
              <Text style={styles.whyTitle}>Live Tracking</Text>
            </View>
            <View style={styles.whyCard}>
              <Ionicons name="videocam-outline" size={24} color={colors.primary} />
              <Text style={styles.whyTitle}>Video Assist</Text>
            </View>
            <View style={styles.whyCard}>
              <Ionicons name="ribbon-outline" size={24} color={colors.primary} />
              <Text style={styles.whyTitle}>Warranty Support</Text>
            </View>
            <View style={styles.whyCard}>
              <Ionicons name="arrow-undo-outline" size={24} color={colors.primary} />
              <Text style={styles.whyTitle}>Easy Returns</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* SEARCH SUGGESTIONS OVERLAY */}
      <Modal
        visible={isSearchFocused}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsSearchFocused(false)}
      >
        <SafeAreaView style={styles.overlaySafe}>
          <View style={styles.overlayContainer}>
            {/* Search inputs bar */}
            <View style={styles.overlayInputRow}>
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.overlayInput}
                placeholder="Search genuine parts, accessories & services..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoFocus={true}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={() => setIsSearchFocused(false)} style={styles.overlayCloseBtn}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Recents list */}
            {recentSearches.length > 0 && (
              <View style={styles.overlayBlock}>
                <View style={styles.overlayBlockHeader}>
                  <Text style={styles.overlayBlockTitle}>Recent Searches</Text>
                  <TouchableOpacity onPress={() => setRecentSearches([])}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.recentRow}>
                  {recentSearches.map((term, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={styles.recentItem}
                      onPress={() => handleSuggestionPress(term)}
                    >
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                      <Text style={styles.recentText}>{term}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Popular tags */}
            <View style={styles.overlayBlock}>
              <Text style={styles.overlayBlockTitle}>Popular Suggestions</Text>
              <View style={styles.suggestionsGrid}>
                {suggestions.map((term, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={styles.suggestionTag}
                    onPress={() => handleSuggestionPress(term)}
                  >
                    <Ionicons name="trending-up" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.suggestionTagText}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Voice Search Modal */}
      <Modal
        visible={isVoiceSearchVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVoiceSearchVisible(false)}
      >
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceCard}>
            <Text style={styles.voiceTitle}>Voice Search</Text>
            <Text style={styles.voiceSub}>{voiceText}</Text>
            
            <View style={styles.micPulseContainer}>
              <Animated.View style={[styles.micPulseBack, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.micCircle}>
                <Ionicons name="mic" size={32} color={colors.white} />
              </View>
            </View>

            {/* Simulating animation waves */}
            <View style={styles.waveContainer}>
              <View style={[styles.waveBar, { height: isListening ? 20 : 5 }]} />
              <View style={[styles.waveBar, { height: isListening ? 40 : 5 }]} />
              <View style={[styles.waveBar, { height: isListening ? 25 : 5 }]} />
              <View style={[styles.waveBar, { height: isListening ? 35 : 5 }]} />
              <View style={[styles.waveBar, { height: isListening ? 15 : 5 }]} />
            </View>

            <TouchableOpacity 
              style={styles.voiceCloseBtn}
              onPress={() => setIsVoiceSearchVisible(false)}
            >
              <Text style={styles.voiceCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Barcode/QR Scanner Modal */}
      <Modal
        visible={isScannerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsScannerVisible(false)}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR / Barcode</Text>
            <TouchableOpacity onPress={() => setIsScannerVisible(false)}>
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Viewfinder reticle */}
          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinderReticle}>
              {/* Corner brackets */}
              <View style={[styles.cornerBracket, styles.topLeftBracket]} />
              <View style={[styles.cornerBracket, styles.topRightBracket]} />
              <View style={[styles.cornerBracket, styles.bottomLeftBracket]} />
              <View style={[styles.cornerBracket, styles.bottomRightBracket]} />
              
              {/* Animated Laser Line */}
              <Animated.View 
                style={[
                  styles.scannerLaser, 
                  { transform: [{ translateY: scanAnim }] }
                ]} 
              />
            </View>
          </View>

          <View style={styles.scannerFooter}>
            <Text style={styles.scannerStatus}>{scannerMsg}</Text>
            <View style={styles.scannerActionRow}>
              <TouchableOpacity 
                style={styles.scannerActionBtn} 
                onPress={() => setTorchOn(!torchOn)}
              >
                <Ionicons 
                  name={torchOn ? "flash" : "flash-off"} 
                  size={20} 
                  color={colors.white} 
                />
                <Text style={styles.scannerActionText}>
                  Torch {torchOn ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.scannerActionBtn}
                onPress={() => {
                  setIsScannerVisible(false);
                  setSearchQuery('Spark Plug');
                  navigation.navigate('CategoryProducts', {
                    categoryName: 'Search Results',
                    initialSearchQuery: 'Spark Plug'
                  });
                }}
              >
                <Ionicons name="images-outline" size={20} color={colors.white} />
                <Text style={styles.scannerActionText}>Gallery</Text>
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
    backgroundColor: colors.pageBg 
  },
  header: { 
    backgroundColor: colors.secondary, 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    paddingBottom: 20, 
    zIndex: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12, 
    height: 38 
  },
  headerLogo: { 
    width: 110, 
    height: 34 
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 6,
    position: 'relative'
  },
  badgeBubble: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
    paddingHorizontal: 2
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold'
  },
  avatarBtn: {
    marginLeft: 8
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  avatarInitial: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  locationLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4
  },
  locationSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  locationText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold'
  },
  searchBarRow: { 
    flexDirection: 'row', 
    backgroundColor: colors.white, 
    borderRadius: 12, 
    alignItems: 'center', 
    height: 46, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20
  },
  searchInput: { 
    flex: 1, 
    fontSize: 14, 
    color: '#111', 
    height: '100%', 
    marginLeft: 8 
  },
  searchSideBtn: {
    padding: 8,
    marginRight: 4
  },
  toggleContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 20, 
    position: 'relative', 
    height: 40,
    padding: 3,
  },
  toggleIndicator: { 
    position: 'absolute', 
    width: '50%', 
    height: '100%', 
    backgroundColor: colors.primary, 
    borderRadius: 18,
    top: 3,
  },
  toggleButton: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1 
  },
  toggleText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: 'rgba(255,255,255,0.6)' 
  },
  toggleTextActive: { 
    color: '#FFF', 
    fontWeight: '900' 
  },
  bannerSection: { 
    zIndex: 1, 
    paddingBottom: 14, 
    paddingTop: 14 
  },
  fullBanner: { 
    width: width - 32, 
    height: 140, 
    marginHorizontal: 16, 
    justifyContent: 'center',
    overflow: 'hidden'
  },
  bannerOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    borderRadius: 16, 
    padding: 16, 
    justifyContent: 'center', 
    alignItems: 'flex-start' 
  },
  bannerTitleText: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: '#FFF', 
    textTransform: 'uppercase', 
    marginBottom: 2 
  },
  bannerSubtitleText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#FFF', 
    textTransform: 'uppercase', 
    marginBottom: 4 
  },
  bannerOfferText: { 
    fontSize: 12, 
    color: '#FFD700', 
    fontWeight: '700', 
    marginBottom: 10 
  },
  shopNowBtn: { 
    backgroundColor: colors.primary, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  shopNowText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 11, 
    textTransform: 'uppercase' 
  },
  paginationContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 8 
  },
  paginationDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    marginHorizontal: 3 
  },
  paginationDotActive: { 
    backgroundColor: colors.secondary, 
    width: 14 
  },
  paginationDotInactive: { 
    backgroundColor: '#D1D1D6' 
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickCard: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  quickIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.secondary,
    textAlign: 'center',
  },
  section: { 
    marginBottom: 22 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: colors.secondary,
    letterSpacing: 0.25
  },
  seeAllText: { 
    fontSize: 13, 
    color: colors.primary, 
    fontWeight: '700' 
  },
  categoriesContainer: { 
    paddingHorizontal: 16, 
    gap: 12, 
    paddingBottom: 4 
  },
  categoryItem: { 
    alignItems: 'center', 
    width: 72 
  },
  categoryIconCircle: { 
    width: 58, 
    height: 58, 
    borderRadius: 29, 
    backgroundColor: colors.white, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden'
  },
  categoryIconImg: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  categoryEmoji: { 
    fontSize: 22 
  },
  categoryLabelText: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: colors.secondary, 
    textAlign: 'center', 
    marginTop: 6, 
    height: 30, 
    lineHeight: 13 
  },
  serviceCard: {
    width: 150,
    backgroundColor: colors.white,
    borderRadius: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
    overflow: 'hidden',
  },
  svgCardContainer: {
    width: '100%',
    height: 90,
    overflow: 'hidden',
  },
  serviceInfo: {
    padding: 10,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.secondary,
    marginBottom: 2,
  },
  servicePrice: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
  },
  serviceBookBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  serviceBookBtnText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  productCard: { 
    width: 170, 
    backgroundColor: colors.white, 
    borderRadius: 16, 
    marginRight: 12, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: colors.borderLight, 
    position: 'relative' 
  },
  cardHeaderOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 5,
  },
  badgeRoundBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  imageContainer: { 
    position: 'relative', 
    height: 95, 
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: { 
    width: '90%', 
    height: '90%', 
    resizeMode: 'contain' 
  },
  timerBadge: { 
    position: 'absolute', 
    bottom: 2, 
    left: 2, 
    backgroundColor: '#F2F2F7', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6 
  },
  timerText: { 
    fontSize: 8, 
    fontWeight: 'bold', 
    color: colors.secondary 
  },
  discountTag: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountTagText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  productBrand: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  productInfo: { 
    flex: 1, 
    justifyContent: 'space-between' 
  },
  productName: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: colors.secondary, 
    marginBottom: 4, 
    height: 32, 
    lineHeight: 16 
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 9,
    color: colors.textMuted,
    marginLeft: 3,
    fontWeight: '600',
  },
  stockLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceRow: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8 
  },
  originalPrice: { 
    fontSize: 10, 
    color: colors.textMuted, 
    textDecorationLine: 'line-through' 
  },
  price: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: colors.secondary 
  },
  addButton: { 
    backgroundColor: colors.primary, 
    borderRadius: 8, 
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center' 
  },
  addButtonText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 11, 
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  qtyBtn: {
    paddingHorizontal: 4,
  },
  qtyBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  qtyTextVal: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  buyNowBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  buyNowBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  mechanicCard: {
    width: 250,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginRight: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mechHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mechAvatarBox: {
    position: 'relative',
  },
  mechAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    resizeMode: 'cover',
  },
  mechOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  mechName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  mechRating: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  mechDistance: {
    fontSize: 10,
    color: colors.textMuted,
  },
  mechBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mechCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mechCallText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mechBookBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  mechBookBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  mechBookText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  offersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  offerCard: {
    width: '46%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    margin: '2%',
    justifyContent: 'space-between',
  },
  offerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  offerDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginVertical: 6,
  },
  offerBadge: {
    backgroundColor: '#00000010',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  offerBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  trustCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  trustCardText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  whyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  whyCard: {
    width: '29.3%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 10,
    margin: '2%',
    alignItems: 'center',
  },
  whyTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.secondary,
    marginTop: 6,
    textAlign: 'center',
  },
  animatedGear: {
    position: 'absolute',
    top: 180,
    right: -40,
  },
  animatedBike: {
    position: 'absolute',
    bottom: 220,
    left: -40,
  },
  overlaySafe: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  overlayInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 20,
  },
  overlayInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: colors.secondary,
  },
  overlayCloseBtn: {
    padding: 4,
  },
  overlayBlock: {
    marginBottom: 24,
  },
  overlayBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overlayBlockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  clearText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  recentText: {
    fontSize: 12,
    color: colors.secondary,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  suggestionTagText: {
    fontSize: 12,
    color: colors.secondary,
  },
  // Voice Search Styles
  voiceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 18, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCard: {
    width: '85%',
    alignItems: 'center',
    padding: 24,
  },
  voiceTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  voiceSub: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 40,
    textAlign: 'center',
  },
  micPulseContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  micPulseBack: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(229, 57, 53, 0.3)',
  },
  micCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginBottom: 40,
  },
  waveBar: {
    width: 4,
    backgroundColor: colors.primary,
    marginHorizontal: 3,
    borderRadius: 2,
  },
  voiceCloseBtn: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF30',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  voiceCloseText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: 'bold',
  },

  // Barcode Scanner Styles
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 18, 0.98)',
    justifyContent: 'space-between',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scannerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderReticle: {
    width: 260,
    height: 200,
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cornerBracket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.primary,
  },
  topLeftBracket: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRightBracket: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeftBracket: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRightBracket: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannerLaser: {
    height: 2.5,
    backgroundColor: colors.primary,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scannerFooter: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
  },
  scannerStatus: {
    color: colors.white,
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  scannerActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  scannerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF10',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    width: '45%',
    justifyContent: 'center',
  },
  scannerActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  }
});
