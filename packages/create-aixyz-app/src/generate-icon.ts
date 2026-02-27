import { randomInt } from "node:crypto";
import sharp from "sharp";

// Vibrant colors that look good as backgrounds
const PALETTE = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
  "#06b6d4",
];

function randomColor(): string {
  return PALETTE[randomInt(PALETTE.length)] as string;
}

// Relative luminance per WCAG 2.1
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastColor(bg: string): string {
  return luminance(bg) > 0.179 ? "#000000" : "#ffffff";
}

function buildSvg(bg: string, fg: string): string {
  return `<svg width="256" height="256" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="24" height="24" rx="2" fill="${bg}"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M6.96388 5.15701C7.13522 5.05191 7.33432 4.99702 7.53297 5.00012C7.73163 5.00323 7.91978 5.06416 8.07077 5.1743L17.1705 11.8148C17.3129 11.9186 17.4156 12.0614 17.4657 12.2251C17.5158 12.3888 17.5109 12.5659 17.4518 12.7342C17.3927 12.9024 17.2819 13.0541 17.1335 13.1702C16.9851 13.2862 16.8058 13.3613 16.6182 13.386L13.9133 13.7438L16.5299 17.6214C16.6588 17.8126 16.6964 18.0487 16.6343 18.2779C16.5722 18.507 16.4155 18.7103 16.1988 18.8431C15.982 18.9759 15.723 19.0274 15.4785 18.9861C15.2341 18.9448 15.0244 18.8142 14.8954 18.623L12.2804 14.7461L10.817 16.9431C10.7157 17.0957 10.5696 17.2201 10.3973 17.3008C10.2249 17.3814 10.0341 17.4146 9.84892 17.3961C9.66375 17.3776 9.49259 17.3083 9.35712 17.1969C9.22166 17.0855 9.12798 16.9371 9.08796 16.7704L6.52209 6.12374C6.47934 5.94713 6.49896 5.75862 6.57819 5.58491C6.65742 5.41121 6.79223 5.26112 6.96353 5.15591L6.96388 5.15701Z" fill="${fg}"/>
</svg>`;
}

export async function generateIcon(outputPath: string): Promise<void> {
  const bg = randomColor();
  const fg = contrastColor(bg);
  const svg = buildSvg(bg, fg);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}
