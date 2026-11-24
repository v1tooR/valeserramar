import { unlink } from "node:fs/promises";
import sharp from "sharp";
import { fail } from "./security.js";

export const maxImageBytes = 8 * 1024 * 1024;
export const maxGalleryPhotos = 20;

export function checkGalleryLimit(gallery, previous = [], newFiles = 0) {
  const total = gallery.length + newFiles;
  if (total <= maxGalleryPhotos) return;
  if (newFiles || total > previous.length || gallery.some(photo => !previous.includes(photo)))
    fail(422, `A galeria pode ter até ${maxGalleryPhotos} fotos.`);
}

export async function saveWebp(input, path) {
  try {
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
    const { format } = await image.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(format))
      fail(422, "Formato de imagem indisponível.");
    await image.rotate().resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    }).webp({ quality: 82 }).toFile(path);
  } catch {
    await unlink(path).catch(() => {});
    fail(422, "Não foi possível ler a imagem. Tente JPG, PNG ou WebP.");
  }
}
