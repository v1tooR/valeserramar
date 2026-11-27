import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { photoSource } from "../assets";
import type { Business, Photo } from "../domain/models";
import { colors as c, styles as s } from "../theme";
import { Tap } from "./Motion";
import { Icon } from "./ui";
import { usePagedCarousel } from "./usePagedCarousel";

export const bannerAspectRatio = 4 / 3;
const photosPerPage = 4;

export function businessPhotos({
  photo,
  gallery,
}: Pick<Business, "photo" | "gallery">) {
  const sources = [photo, ...gallery].map((item) =>
    typeof item === "string" ? item.trim() : item,
  );
  return [...new Set(sources.filter(Boolean))];
}

export function BannerImage({
  photo,
  aspectRatio = bannerAspectRatio,
}: {
  photo: Photo;
  aspectRatio?: number;
}) {
  const source = photoSource(photo);
  const [fillBackground, setFillBackground] = useState(false);
  return (
    <View style={[styles.letterbox, { aspectRatio }]}>
      {fillBackground && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={source}
            style={styles.backdrop}
            resizeMode="cover"
            resizeMethod="resize"
            blurRadius={22}
          />
          <View style={styles.shade} />
        </View>
      )}
      <Image
        source={source}
        style={styles.image}
        resizeMode="contain"
        resizeMethod="resize"
        onLoad={({ nativeEvent }) => {
          const { width, height } = nativeEvent.source ?? {};
          setFillBackground(
            !width || !height || Math.abs(width / height - aspectRatio) > 0.025,
          );
        }}
      />
    </View>
  );
}

function PhotoPagination({
  index,
  count,
  onChange,
  pages = false,
}: {
  index: number;
  count: number;
  onChange: (index: number) => void;
  pages?: boolean;
}) {
  return (
    <View style={styles.pagination}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={
          pages ? "Página anterior de fotos" : "Foto anterior"
        }
        disabled={index === 0}
        onPress={() => onChange(index - 1)}
        style={styles.arrow}
      >
        <Icon name="chevron-left" />
      </Tap>
      <Text style={styles.counter} accessibilityLiveRegion="polite">
        {index + 1} / {count}
      </Text>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={pages ? "Próxima página de fotos" : "Próxima foto"}
        disabled={index === count - 1}
        onPress={() => onChange(index + 1)}
        style={styles.arrow}
      >
        <Icon name="chevron-right" />
      </Tap>
    </View>
  );
}

export function BusinessPhotos({
  photos,
  onOpen,
}: {
  photos: Photo[];
  onOpen: (index: number) => void;
}) {
  const pageCount = Math.ceil((photos.length - 1) / photosPerPage);
  const { current, width, onLayout, scrollProps, goTo } = usePagedCarousel(
    pageCount,
    JSON.stringify(photos),
  );

  function thumbnails(page: number) {
    return (
      <View style={styles.thumbnails}>
        {Array.from({ length: photosPerPage }, (_, slot) => {
          const index = page * photosPerPage + slot + 1;
          const photo = photos[index];
          return photo ? (
            <Tap
              key={photo}
              accessibilityRole="button"
              accessibilityLabel={`Ver foto ${index} completa`}
              focusable={current === page}
              style={[styles.thumbnail, styles.thumbButton]}
              onPress={() => onOpen(index)}
            >
              <Image
                source={photoSource(photo)}
                style={styles.image}
                resizeMode="cover"
                resizeMethod="resize"
                accessible={false}
              />
            </Tap>
          ) : (
            <View key={index} style={styles.thumbnail} />
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.media}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel="Ver banner completo"
        style={styles.banner}
        onPress={() => onOpen(0)}
      >
        <BannerImage key={photos[0]} photo={photos[0]} aspectRatio={1} />
        <View style={styles.zoom}>
          <Icon name="maximize-2" size={17} color={c.white} />
        </View>
      </Tap>
      {pageCount > 0 && (
        <View style={styles.gallery}>
          <Text style={s.heading}>Fotos</Text>
          {pageCount === 1 ? (
            thumbnails(0)
          ) : (
            <>
              <View onLayout={onLayout} testID="photo-strip">
                {width > 0 && (
                  <ScrollView {...scrollProps}>
                    {Array.from({ length: pageCount }, (_, page) => (
                      <View
                        key={page}
                        style={{ width }}
                        accessibilityElementsHidden={current !== page}
                        importantForAccessibility={
                          current === page ? "auto" : "no-hide-descendants"
                        }
                        aria-hidden={current !== page}
                      >
                        {thumbnails(page)}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
              <PhotoPagination
                index={current}
                count={pageCount}
                onChange={goTo}
                pages
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function PhotoViewer({
  photos,
  initialIndex,
}: {
  photos: Photo[];
  initialIndex: number;
}) {
  const { current, goTo, width, onLayout, scrollProps } = usePagedCarousel(
    photos.length,
    JSON.stringify(photos),
    { initialIndex },
  );
  return (
    <View style={s.grow}>
      <View onLayout={onLayout} style={styles.viewer} testID="photo-viewer">
        {width > 0 && (
          <ScrollView {...scrollProps} style={s.grow}>
            {photos.map((photo, index) => (
              <View
                key={photo}
                style={[styles.viewerSlide, { width }]}
                accessibilityElementsHidden={current !== index}
                importantForAccessibility={
                  current === index ? "auto" : "no-hide-descendants"
                }
                aria-hidden={current !== index}
              >
                {Math.abs(index - current) <= 1 && (
                  <Image
                    source={photoSource(photo)}
                    style={styles.image}
                    resizeMode="contain"
                    resizeMethod="resize"
                    accessible
                    accessibilityLabel={
                      index === 0
                        ? "Banner do estabelecimento"
                        : `Foto ${index}`
                    }
                  />
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      {photos.length > 1 && (
        <PhotoPagination
          index={current}
          count={photos.length}
          onChange={goTo}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  media: { gap: 14 },
  banner: { borderRadius: 18, backgroundColor: c.soft, overflow: "hidden" },
  letterbox: { width: "100%", overflow: "hidden", backgroundColor: "#172F28" },
  image: { width: "100%", height: "100%" },
  backdrop: { width: "100%", height: "100%", transform: [{ scale: 1.12 }] },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 39, 31, 0.24)",
  },
  zoom: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(15, 39, 31, 0.88)",
  },
  gallery: { gap: 8 },
  thumbnails: { flexDirection: "row", gap: 8 },
  thumbnail: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  thumbButton: { backgroundColor: c.soft },
  pagination: {
    ...s.row,
    justifyContent: "center",
    gap: 14,
    paddingVertical: 4,
  },
  counter: {
    minWidth: 56,
    textAlign: "center",
    color: c.dark,
    fontSize: 13,
    fontWeight: "700",
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: c.soft,
  },
  viewer: { flex: 1, minHeight: 0, backgroundColor: "#101C18" },
  viewerSlide: { height: "100%", padding: 8 },
});
