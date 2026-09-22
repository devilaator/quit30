import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

export const INTRO_TIMING = { fadeIn: 200, hold: 400, fadeOut: 300 } as const;
const REDUCED_TIMING = { fadeIn: 100, hold: 200, fadeOut: 100 };

/** Mount children immediately: the brand transition never gates app initialization. */
export function StartupIntro({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const [timing, setTiming] = useState<typeof REDUCED_TIMING>(INTRO_TIMING);

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    // Bound accessibility lookup; a slow native response must not prolong startup.
    const timeout = new Promise<boolean>(resolve => {
      fallback = setTimeout(() => resolve(false), 50);
    });
    void Promise.race([AccessibilityInfo.isReduceMotionEnabled().catch(() => false), timeout])
      .then(reduce => {
        if (!active) return;
        clearTimeout(fallback);
        const next = reduce ? REDUCED_TIMING : INTRO_TIMING;
        setTiming(next);
        animation = Animated.timing(progress, {
          toValue: next.fadeIn + next.hold + next.fadeOut,
          duration: next.fadeIn + next.hold + next.fadeOut,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        });
        animation.start(({ finished }) => { if (active && finished) setVisible(false); });
      });
    return () => { active = false; clearTimeout(fallback); animation?.stop(); };
  }, [progress]);

  const fadeOutAt = timing.fadeIn + timing.hold;
  const end = fadeOutAt + timing.fadeOut;
  const wordOpacity = progress.interpolate({
    inputRange: [0, timing.fadeIn, fadeOutAt, end], outputRange: [0, 1, 1, 0], extrapolate: 'clamp',
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, fadeOutAt, end], outputRange: [1, 1, 0], extrapolate: 'clamp',
  });
  return (
    <View style={styles.root}>
      <View style={styles.root} pointerEvents={visible ? 'none' : 'auto'}
        accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {visible && <View style={styles.overlay} accessibilityViewIsModal accessible accessibilityLabel="DEVILAATOR">
        <Animated.View style={[StyleSheet.absoluteFill, styles.background, { opacity: backdropOpacity }]} />
        <Animated.View style={[styles.word, { opacity: wordOpacity }]}>
          <Svg width="100%" height={80} viewBox="0 0 360 80" accessible={false}>
            <Defs>
              <LinearGradient id="devilaatorSignature" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#DB5551" />
                <Stop offset="34%" stopColor="#EC9251" />
                <Stop offset="65%" stopColor="#E7C66A" />
                <Stop offset="100%" stopColor="#70AD83" />
              </LinearGradient>
            </Defs>
            <SvgText x="180" y="52" textAnchor="middle" fontSize="39" fontWeight="700"
              letterSpacing="2" fill="url(#devilaatorSignature)">DEVILAATOR</SvgText>
          </Svg>
        </Animated.View>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141516' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  background: { backgroundColor: '#0C0D0E' },
  word: { width: '88%', maxWidth: 380 },
});
