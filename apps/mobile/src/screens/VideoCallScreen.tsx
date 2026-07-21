import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Alert,
  Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  textMuted: '#8E8E93',
  darkOverlay: 'rgba(0,0,0,0.6)',
  success: '#34C759',
};

type ParamList = {
  VideoCall: {
    mechanicName: string;
    mechanicAvatar: string;
  };
};

export default function VideoCallScreen() {
  const route = useRoute<RouteProp<ParamList, 'VideoCall'>>();
  const navigation = useNavigation<any>();
  const { mechanicName = 'Verified Mechanic', mechanicAvatar } = route.params || {};

  // Calling States
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  // Animations
  const ringAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Ringer pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Simulate connection after 2.5 seconds
    const connectTimer = setTimeout(() => {
      setCallStatus('Connected');
    }, 2500);

    return () => clearTimeout(connectTimer);
  }, []);

  // Duration Timer
  useEffect(() => {
    if (callStatus === 'Connected' && !callEnded) {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus, callEnded]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallEnded(true);
    Alert.alert(
      'Diagnostics Complete',
      `${mechanicName} recommends scheduling a General Doorstep Visit to verify your brake calipers.`,
      [
        { 
          text: 'Dismiss', 
          onPress: () => navigation.goBack() 
        },
        { 
          text: 'Book Visit Now', 
          onPress: () => {
            navigation.goBack();
            navigation.navigate('MainTabs', { screen: 'Services' });
          },
          style: 'default'
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background mechanic video feed simulation */}
      {callStatus === 'Connected' ? (
        <View style={styles.mainFeedContainer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&q=80' }} 
            style={styles.fullScreenVideo} 
          />
          {/* Transparent Dark Overlay */}
          <View style={styles.videoOverlay} />
        </View>
      ) : (
        <View style={styles.connectingContainer}>
          <Animated.View style={[styles.avatarBackPulse, { transform: [{ scale: ringAnim }] }]} />
          <Image 
            source={{ uri: mechanicAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80' }} 
            style={styles.connectingAvatar} 
          />
          <Text style={styles.mechNameText}>{mechanicName}</Text>
          <Text style={styles.statusText}>{callStatus}</Text>
        </View>
      )}

      {/* Local Front Camera Preview (Selfie PIP) */}
      {callStatus === 'Connected' && !isCameraOff && (
        <View style={styles.pipWindow}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80' }} 
            style={styles.pipVideo} 
          />
        </View>
      )}

      {/* Top Banner overlay when connected */}
      {callStatus === 'Connected' && (
        <View style={styles.topInfoRow}>
          <View style={styles.badgeRow}>
            <View style={styles.liveBadge} />
            <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
          </View>
          <Text style={styles.topMechName}>{mechanicName} (Verified)</Text>
        </View>
      )}

      {/* Call Controls HUD at bottom */}
      <View style={styles.hudOverlay}>
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.controlCircle, isMuted && styles.controlCircleActive]}
            onPress={() => setIsMuted(!isMuted)}
          >
            <Ionicons 
              name={isMuted ? "mic-off" : "mic"} 
              size={24} 
              color={isMuted ? colors.white : colors.white} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlCircle, styles.endCallBtn]}
            onPress={handleEndCall}
          >
            <Ionicons name="call" size={28} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlCircle, isCameraOff && styles.controlCircleActive]}
            onPress={() => setIsCameraOff(!isCameraOff)}
          >
            <Ionicons 
              name={isCameraOff ? "videocam-off" : "videocam"} 
              size={24} 
              color={colors.white} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D11' },
  connectingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  connectingAvatar: { width: 120, height: 120, borderRadius: 60, zIndex: 10, borderWidth: 3, borderColor: colors.primary },
  avatarBackPulse: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(229, 57, 53, 0.25)', zIndex: 1 },
  mechNameText: { color: colors.white, fontSize: 20, fontWeight: 'bold', marginTop: 24, marginBottom: 8 },
  statusText: { color: colors.textMuted, fontSize: 14 },
  
  mainFeedContainer: { ...StyleSheet.absoluteFill },
  fullScreenVideo: { width: '100%', height: '100%', resizeMode: 'cover' },
  videoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },

  pipWindow: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 90,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 4,
  },
  pipVideo: { width: '100%', height: '100%', resizeMode: 'cover' },

  topInfoRow: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  liveBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 },
  durationText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },
  topMechName: { color: colors.white, fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },

  hudOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '70%',
  },
  controlCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlCircleActive: {
    backgroundColor: colors.primary,
  },
  endCallBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.primary,
    transform: [{ rotate: '135deg' }],
  }
});
