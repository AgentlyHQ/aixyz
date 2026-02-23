import sharp from "sharp";
import { cpSync, existsSync, mkdirSync } from "fs";
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
 * Uses sharp to resize to 32×32 and output as ICO.
 */
export async function generateFavicon(iconPath: string, destPath: string): Promise<void> {
  mkdirSync(dirname(destPath), { recursive: true });
  await sharp(iconPath)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFormat("ico")
    .toFile(destPath);
}
