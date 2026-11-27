import { useIsFocused } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Platform,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "./Motion";

type CarouselOptions = {
  interval?: number;
  initialIndex?: number;
  sideInset?: number;
};

export function usePagedCarousel(
  count: number,
  contentKey: string,
  { interval, initialIndex = 0, sideInset = 0 }: CarouselOptions = {},
) {
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const track = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState(0);
  const inset = Math.min(sideInset, Math.max(0, (viewport - 180) / 2));
  const width = viewport - 2 * inset;
  const end = Math.max(0, count - 1);
  const first = Math.max(0, Math.min(initialIndex, end));
  const [index, setIndex] = useState(first);
  const [dragging, setDragging] = useState(false);
  const current = Math.max(0, Math.min(index, end));

  useEffect(() => {
    setIndex(first);
    setDragging(false);
    track.current?.scrollTo({ x: first * width, animated: false });
  }, [contentKey, first, width]);

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
    const timer = setTimeout(() => goTo((current + 1) % count), interval);
    return () => clearTimeout(timer);
  }, [
    contentKey,
    count,
    current,
    dragging,
    focused,
    goTo,
    interval,
    reducedMotion,
    width,
  ]);

  // RN Web snaps the wrapped children using CSS. The inset keeps each card centered.
  const pagination: ScrollViewProps = inset
    ? {
        contentContainerStyle: { paddingHorizontal: inset },
        ...(Platform.OS === "web"
          ? {
              pagingEnabled: true,
              style: { scrollPaddingInline: `${inset}px` } as ViewStyle,
            }
          : {
              snapToInterval: width,
              decelerationRate: "fast",
              disableIntervalMomentum: true,
              overScrollMode: "never",
            }),
      }
    : { pagingEnabled: true };

  return {
    current,
    width,
    goTo,
    onLayout: ({ nativeEvent }: LayoutChangeEvent) =>
      setViewport(nativeEvent.layout.width),
    scrollProps: {
      ref: track,
      horizontal: true,
      ...pagination,
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
            Math.min(end, Math.round(nativeEvent.contentOffset.x / width)),
          ),
        );
      },
    },
  };
}
