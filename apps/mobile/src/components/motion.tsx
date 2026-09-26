import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** The native driver isn't available on web; Animated falls back to JS there. */
export const nativeDriver = Platform.OS !== "web";

/** True when the user asked their OS to reduce motion. Loops stop and reveals show immediately. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

// ── Scroll-triggered reveals ────────────────────────────────

type Listener = () => void;
const ScrollContext = createContext<{ subscribe: (l: Listener) => () => void } | null>(null);

/** A ScrollView that lets <Reveal> children know when they scroll into view. */
export function RevealScrollView({ children, ref, ...props }: ScrollViewProps & { children: ReactNode; ref?: Ref<ScrollView> }) {
  const listeners = useRef(new Set<Listener>());
  const [ctx] = useState(() => ({
    subscribe: (l: Listener) => {
      listeners.current.add(l);
      return () => listeners.current.delete(l);
    },
  }));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    props.onScroll?.(e);
    listeners.current.forEach((l) => l());
  };
  return (
    <ScrollContext.Provider value={ctx}>
      <ScrollView ref={ref} {...props} onScroll={onScroll} scrollEventThrottle={32}>
        {children}
      </ScrollView>
    </ScrollContext.Provider>
  );
}

/** Fades and slides its children up the first time they scroll into view. */
export function Reveal({ children, delay = 0, style, onReveal }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; onReveal?: () => void }) {
  const ref = useRef<View>(null);
  const reduced = useReducedMotion();
  const onRevealRef = useRef(onReveal);
  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);
  const [progress] = useState(() => new Animated.Value(0));
  const shown = useRef(false);
  const scroll = useContext(ScrollContext);
  const { height } = useWindowDimensions();

  useEffect(() => {
    const check = () => {
      if (shown.current) return;
      ref.current?.measureInWindow((_x, y) => {
        if (shown.current || y > height * 0.92) return;
        shown.current = true;
        onRevealRef.current?.();
        if (reduced) return progress.setValue(1);
        Animated.timing(progress, { toValue: 1, duration: 650, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
      });
    };
    const first = setTimeout(check, 50); // after layout
    const unsubscribe = scroll?.subscribe(check);
    return () => {
      clearTimeout(first);
      unsubscribe?.();
    };
  }, [scroll, height, delay, progress, reduced]);

  return (
    <Animated.View
      ref={ref}
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ── Small effects ───────────────────────────────────────────

/** Scales and fades in when mounted. Give it a new key to replay. */
export function Pop({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, friction: 6, tension: 120, useNativeDriver: nativeDriver }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Gently pulses forever, to invite a tap. */
export function Pulse({ children, active = true, style }: { children: ReactNode; active?: boolean; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!active || reduced) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, active, reduced]);
  return <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }]}>{children}</Animated.View>;
}

/** Bounces whenever `value` changes, e.g. a headcount going up. */
export function Bump({ value, children, style }: { value: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(1));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    v.setValue(1.25);
    Animated.spring(v, { toValue: 1, friction: 4, tension: 160, useNativeDriver: nativeDriver }).start();
  }, [value, v]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** A soft color glow that drifts slowly in the background. */
export function Glow({ color, size, style, duration = 9000, drift = 40 }: { color: string; size: number; style?: StyleProp<ViewStyle>; duration?: number; drift?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, reduced]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-drift, drift] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [drift / 2, -drift / 2] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
          ],
        },
        style,
      ]}
    />
  );
}

/** Cycles through words with a slide-and-fade. */
export function RotatingWord({ words, interval = 2200, render }: { words: string[]; interval?: number; render: (word: string) => ReactNode }) {
  const [i, setI] = useState(0);
  const [v] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: nativeDriver }).start(() => {
        setI((n) => (n + 1) % words.length);
        Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.5)), useNativeDriver: nativeDriver }).start();
      });
    }, interval);
    return () => clearInterval(timer);
  }, [v, words.length, interval, reduced]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      {render(words[i]!)}
    </Animated.View>
  );
}

/** An endless horizontal ticker of its children. */
export function Marquee({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!width || reduced) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -width, duration: (width / speed) * 1000, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [width, speed, x, reduced]);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <View style={{ overflow: "hidden", width: "100%" }}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        <View onLayout={onLayout} style={{ flexDirection: "row" }}>
          {children}
        </View>
        <View style={{ flexDirection: "row" }}>{children}</View>
      </Animated.View>
    </View>
  );
}
