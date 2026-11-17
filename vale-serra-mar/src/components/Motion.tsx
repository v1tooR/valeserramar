import { Alert } from "./Dialogs";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  type ViewProps,
} from "react-native";
import * as Haptics from "expo-haptics";
import { errorMessage } from "../api/client";
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const event = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => event.remove();
  }, []);
  return reduced;
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Tap({
  style,
  onPress,
  onPressIn,
  onPressOut,
  children,
  disabled,
  ...props
}: PressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scale.stopAnimation();
    };
  }, [scale]);
  const animate = (toValue: number) => {
    if (!reduced)
      Animated.spring(scale, {
        toValue,
        speed: 32,
        bounciness: 4,
        useNativeDriver: Platform.OS !== "web",
      }).start();
  };
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled || busy}
      accessibilityState={{
        ...props.accessibilityState,
        disabled: disabled || busy,
        busy,
      }}
      style={[
        typeof style === "function" ? style({ pressed }) : style,
        {
          transform: [{ scale }],
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
      ]}
      onPressIn={(e) => {
        setPressed(true);
        animate(0.97);
        onPressIn?.(e);
        if (Platform.OS !== "web" && !reduced)
          void Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={(e) => {
        setPressed(false);
        animate(1);
        onPressOut?.(e);
      }}
      onPress={async (e) => {
        if (lock.current) return;
        lock.current = true;
        try {
          const result = onPress?.(e) as unknown;
          if (
            result &&
            typeof (result as Promise<unknown>).then === "function"
          ) {
            setBusy(true);
            await result;
          }
        } catch (error) {
          Alert.alert("Não foi possível concluir", errorMessage(error));
        } finally {
          lock.current = false;
          if (mounted.current) setBusy(false);
        }
      }}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          {busy && (
            <ActivityIndicator
              color="#1D6B54"
              style={{
                position: "absolute",
                right: 8,
                top: 8,
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
              }}
            />
          )}
        </>
      )}
    </AnimatedPressable>
  );
}
export function Entrance({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 280,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [reduced, value]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
