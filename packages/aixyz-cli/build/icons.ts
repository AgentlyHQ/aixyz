import sharp from "sharp";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

/** Icon source file extensions to look for, in priority order */
const ICON_EXTENSIONS = ["svg", "png", "jpeg", "jpg"] as const;

/** Returns the first matching icon file path, or null if none found. */
export function findIconFile(appDir: string): string | null {
  for (const ext of ICON_EXTENSIONS) {
    const iconPath = resolve(appDir, `icon.${ext}`);
    if (existsSync(iconPath)) return iconPath;
  }
  return null;
}

/**
 * Copy the icon to destPath as icon.png.
 * PNG sources are copied directly; other formats are converted via sharp.
 */
export async function copyAgentIcon(iconPath: string, destPath: string): Promise<void> {
  if (iconPath.endsWith(".png")) {
    cpSync(iconPath, destPath);
  } else {
    await sharp(iconPath).png().toFile(destPath);
  }
}

/**
 * Generate a favicon.ico at destPath from the given icon source.
 * Uses sharp to produce a 32×32 PNG, then wraps it in an ICO container.
 * Modern browsers support ICO files with embedded PNG data.
 */
export async function generateFavicon(iconPath: string, destPath: string): Promise<void> {
  const pngData = await sharp(iconPath)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buildIco(pngData, 32, 32));
}

/** Build a single-image ICO buffer with embedded PNG data. */
function buildIco(pngData: Buffer, width: number, height: number): Buffer {
  // ICONDIR header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(1, 4); // image count

  // ICONDIRENTRY (16 bytes); image data starts at offset 6 + 16 = 22
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width === 256 ? 0 : width, 0); // width  (0 means 256)
  entry.writeUInt8(height === 256 ? 0 : height, 1); // height (0 means 256)
  entry.writeUInt8(0, 2); // color count (0 = true color)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngData.length, 8); // size of image data
  entry.writeUInt32LE(22, 12); // offset to image data

  return Buffer.concat([header, entry, pngData]);
}
