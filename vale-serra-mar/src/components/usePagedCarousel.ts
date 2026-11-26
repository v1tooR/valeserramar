import { useIsFocused } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";
import { useReducedMotion } from "./Motion";

export function usePagedCarousel(
  count: number,
  contentKey: string,
  interval?: number,
) {
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const track = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const current = Math.max(0, Math.min(index, count - 1));

  useEffect(() => {
    setIndex(0);
    setDragging(false);
    track.current?.scrollTo({ x: 0, animated: false });
  }, [contentKey, width]);

  const goTo = useCallback(
    (next: number) => {
      if (!width || next < 0 || next >= count || next === current) return;
      track.current?.scrollTo({
        x: next * width,
        animated: !reducedMotion && Math.abs(next - current) === 1,
      });
      setIndex(next);
    },
    [count, current, reducedMotion, width],
  );

  const move = useCallback(
    (step: number) => {
      if (count > 1) goTo((current + step + count) % count);
    },
    [count, current, goTo],
  );

  useEffect(() => {
    if (
      !interval ||
      !focused ||
      reducedMotion ||
      dragging ||
      count < 2 ||
      !width
    )
      return;
    const timer = setTimeout(() => move(1), interval);
    return () => clearTimeout(timer);
  }, [
    contentKey,
    count,
    dragging,
    focused,
    interval,
    move,
    reducedMotion,
    width,
  ]);

  return {
    current,
    width,
    goTo,
    move,
    onLayout: ({ nativeEvent }: LayoutChangeEvent) =>
      setWidth(nativeEvent.layout.width),
    scrollProps: {
      ref: track,
      horizontal: true,
      pagingEnabled: true,
      bounces: false,
      showsHorizontalScrollIndicator: false,
      scrollEventThrottle: 32,
      onScrollBeginDrag: () => setDragging(true),
      onScrollEndDrag: () => setDragging(false),
      onScroll: ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!width) return;
        setIndex(
          Math.max(
            0,
            Math.min(
              count - 1,
              Math.round(nativeEvent.contentOffset.x / width),
            ),
          ),
        );
      },
    },
  };
}
