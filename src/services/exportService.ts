import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import type { Color, PaletteColor } from '@/types';
import { isLightColor } from '@/utils/colors';

// ============================================
// Export Result Types
// ============================================

export interface ExportResult {
  success: boolean;
  message: string;
  filePath?: string;
  data?: string;
}

// ============================================
// Text/Code Export Functions
// ============================================

/**
 * Generate HEX list from colors
 */
export function generateHexList(colors: (Color | PaletteColor)[]): string {
  return colors.map((c) => c.hex).join('\n');
}

/**
 * Generate RGB list from colors
 */
export function generateRgbList(colors: (Color | PaletteColor)[]): string {
  return colors
    .map((c) => `rgb(${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b})`)
    .join('\n');
}

/**
 * Generate HSL list from colors
 */
export function generateHslList(colors: (Color | PaletteColor)[]): string {
  return colors
    .map((c) => `hsl(${c.hsl.h}, ${c.hsl.s}%, ${c.hsl.l}%)`)
    .join('\n');
}

/**
 * Generate CSS variables from colors
 */
export function generateCssVariables(
  colors: (Color | PaletteColor)[],
  prefix: string = 'color'
): string {
  const variables = colors
    .map((c, i) => `  --${prefix}-${i + 1}: ${c.hex};`)
    .join('\n');
  return `:root {\n${variables}\n}`;
}

/**
 * Generate SCSS variables from colors
 */
export function generateScssVariables(
  colors: (Color | PaletteColor)[],
  prefix: string = 'color'
): string {
  return colors
    .map((c, i) => `$${prefix}-${i + 1}: ${c.hex};`)
    .join('\n');
}

/**
 * Generate Tailwind config from colors
 */
export function generateTailwindConfig(
  colors: (Color | PaletteColor)[],
  paletteName?: string
): string {
  const name = paletteName?.toLowerCase().replace(/\s+/g, '-') || 'palette';
  const colorEntries = colors
    .map((c, i) => `      '${i + 1}': '${c.hex}',`)
    .join('\n');

  return `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        '${name}': {
${colorEntries}
        },
      },
    },
  },
};`;
}

/**
 * Generate JSON export from colors
 */
export function generateJsonExport(
  colors: (Color | PaletteColor)[],
  paletteName?: string
): string {
  const exportData = {
    name: paletteName || 'Untitled Palette',
    colors: colors.map((c, i) => ({
      position: i + 1,
      hex: c.hex,
      rgb: c.rgb,
      hsl: c.hsl,
      name: ('name' in c && c.name) || undefined,
    })),
    exportedAt: new Date().toISOString(),
    generator: 'Color.io',
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate Swift/SwiftUI code from colors
 */
export function generateSwiftCode(
  colors: (Color | PaletteColor)[],
  paletteName?: string
): string {
  const name = paletteName?.replace(/\s+/g, '') || 'Palette';
  const colorEntries = colors
    .map((c, i) => {
      const r = (c.rgb.r / 255).toFixed(3);
      const g = (c.rgb.g / 255).toFixed(3);
      const b = (c.rgb.b / 255).toFixed(3);
      return `    static let color${i + 1} = Color(red: ${r}, green: ${g}, blue: ${b})`;
    })
    .join('\n');

  return `import SwiftUI

extension Color {
    struct ${name} {
${colorEntries}
    }
}`;
}

/**
 * Generate Android XML colors from colors
 */
export function generateAndroidXml(
  colors: (Color | PaletteColor)[],
  prefix: string = 'palette'
): string {
  const colorEntries = colors
    .map((c, i) => `    <color name="${prefix}_color_${i + 1}">${c.hex}</color>`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
${colorEntries}
</resources>`;
}

// ============================================
// ASE (Adobe Swatch Exchange) Export
// ============================================

/**
 * Generate ASE binary data from colors
 * ASE format reference: https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/
 */
export function generateAseData(
  colors: (Color | PaletteColor)[],
  paletteName?: string
): ArrayBuffer {
  const name = paletteName || 'Color.io Palette';

  // Helper functions
  const writeUint32BE = (buffer: DataView, offset: number, value: number) => {
    buffer.setUint32(offset, value, false);
  };

  const writeUint16BE = (buffer: DataView, offset: number, value: number) => {
    buffer.setUint16(offset, value, false);
  };

  const writeFloat32BE = (buffer: DataView, offset: number, value: number) => {
    buffer.setFloat32(offset, value, false);
  };

  // Calculate buffer size
  // Header: 4 (signature) + 4 (version) + 4 (block count)
  // Group start: 2 (type) + 4 (length) + 2 (name length) + name * 2
  // Each color: 2 (type) + 4 (length) + 2 (name length) + name * 2 + 4 (RGB mode) + 12 (RGB values) + 2 (type)
  // Group end: 2 (type) + 4 (length)

  const nameLength = name.length + 1; // +1 for null terminator
  let bufferSize = 12; // Header
  bufferSize += 2 + 4 + 2 + nameLength * 2; // Group start

  for (const color of colors) {
    const colorName = (('name' in color && color.name) || color.hex).slice(0, 31);
    bufferSize += 2 + 4 + 2 + (colorName.length + 1) * 2 + 4 + 12 + 2;
  }

  bufferSize += 2 + 4; // Group end

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  let offset = 0;

  // Write header
  // Signature: "ASEF"
  view.setUint8(offset++, 0x41); // A
  view.setUint8(offset++, 0x53); // S
  view.setUint8(offset++, 0x45); // E
  view.setUint8(offset++, 0x46); // F

  // Version: 1.0
  writeUint16BE(view, offset, 1);
  offset += 2;
  writeUint16BE(view, offset, 0);
  offset += 2;

  // Block count: colors + group start + group end
  writeUint32BE(view, offset, colors.length + 2);
  offset += 4;

  // Group start block
  writeUint16BE(view, offset, 0xC001); // Group start type
  offset += 2;

  const groupBlockLength = 2 + nameLength * 2;
  writeUint32BE(view, offset, groupBlockLength);
  offset += 4;

  writeUint16BE(view, offset, nameLength);
  offset += 2;

  // Write group name (UTF-16BE)
  for (let i = 0; i < name.length; i++) {
    writeUint16BE(view, offset, name.charCodeAt(i));
    offset += 2;
  }
  writeUint16BE(view, offset, 0); // Null terminator
  offset += 2;

  // Write color blocks
  for (const color of colors) {
    const colorName = (('name' in color && color.name) || color.hex).slice(0, 31);
    const colorNameLength = colorName.length + 1;

    writeUint16BE(view, offset, 0x0001); // Color entry type
    offset += 2;

    const colorBlockLength = 2 + colorNameLength * 2 + 4 + 12 + 2;
    writeUint32BE(view, offset, colorBlockLength);
    offset += 4;

    writeUint16BE(view, offset, colorNameLength);
    offset += 2;

    // Write color name (UTF-16BE)
    for (let i = 0; i < colorName.length; i++) {
      writeUint16BE(view, offset, colorName.charCodeAt(i));
      offset += 2;
    }
    writeUint16BE(view, offset, 0); // Null terminator
    offset += 2;

    // Color mode: "RGB " (4 bytes)
    view.setUint8(offset++, 0x52); // R
    view.setUint8(offset++, 0x47); // G
    view.setUint8(offset++, 0x42); // B
    view.setUint8(offset++, 0x20); // Space

    // RGB values as floats (0-1)
    writeFloat32BE(view, offset, color.rgb.r / 255);
    offset += 4;
    writeFloat32BE(view, offset, color.rgb.g / 255);
    offset += 4;
    writeFloat32BE(view, offset, color.rgb.b / 255);
    offset += 4;

    // Color type: 0 = Global, 1 = Spot, 2 = Normal
    writeUint16BE(view, offset, 2);
    offset += 2;
  }

  // Group end block
  writeUint16BE(view, offset, 0xC002); // Group end type
  offset += 2;
  writeUint32BE(view, offset, 0);
  offset += 4;

  return buffer;
}

// ============================================
// SVG Generation
// ============================================

/**
 * Generate SVG palette image
 */
export function generateSvgPalette(
  colors: (Color | PaletteColor)[],
  options: {
    width?: number;
    height?: number;
    showHex?: boolean;
    showColorNames?: boolean;
    paletteName?: string;
  } = {}
): string {
  const {
    width = 800,
    height = 400,
    showHex = true,
    showColorNames = false,
    paletteName,
  } = options;

  const colorCount = colors.length;
  const swatchWidth = width / colorCount;
  const headerHeight = paletteName ? 60 : 0;
  const swatchHeight = height - headerHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="#1a1a1a"/>`;

  // Palette name header
  if (paletteName) {
    svg += `<text x="${width / 2}" y="38" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="24" font-weight="600">${escapeXml(paletteName)}</text>`;
  }

  // Color swatches
  colors.forEach((color, i) => {
    const x = i * swatchWidth;
    const y = headerHeight;

    // Swatch background
    svg += `<rect x="${x}" y="${y}" width="${swatchWidth}" height="${swatchHeight}" fill="${color.hex}"/>`;

    // Text color based on luminance
    const textColor = isLightColor(color.rgb) ? '#000000' : '#ffffff';
    const textY = y + swatchHeight - 20;

    if (showHex) {
      svg += `<text x="${x + swatchWidth / 2}" y="${textY}" text-anchor="middle" fill="${textColor}" font-family="monospace" font-size="14">${color.hex}</text>`;
    }

    if (showColorNames && 'name' in color && color.name) {
      const nameY = showHex ? textY - 24 : textY;
      svg += `<text x="${x + swatchWidth / 2}" y="${nameY}" text-anchor="middle" fill="${textColor}" font-family="system-ui, sans-serif" font-size="12">${escapeXml(color.name)}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// Export Actions
// ============================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<ExportResult> {
  try {
    await Clipboard.setStringAsync(text);
    return { success: true, message: 'Copied to clipboard', data: text };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to copy',
    };
  }
}

/**
 * Save file to device
 */
export async function saveFile(
  content: string | ArrayBuffer,
  fileName: string,
  _mimeType: string
): Promise<ExportResult> {
  try {
    const file = new File(Paths.cache, fileName);

    if (typeof content === 'string') {
      await file.write(content);
    } else {
      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(content);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      await FileSystemLegacy.writeAsStringAsync(file.uri, base64, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
    }

    return { success: true, message: 'File saved', filePath: file.uri };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save file',
    };
  }
}

/**
 * Save image to camera roll
 */
export async function saveToMediaLibrary(
  fileUri: string
): Promise<ExportResult> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, message: 'Permission to access media library denied' };
    }

    const asset = await MediaLibrary.createAssetAsync(fileUri);
    return {
      success: true,
      message: 'Saved to camera roll',
      filePath: asset.uri,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save to camera roll',
    };
  }
}

/**
 * Share content using native share sheet
 */
export async function shareContent(options: {
  fileUri?: string;
  message?: string;
  title?: string;
}): Promise<ExportResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { success: false, message: 'Sharing is not available on this device' };
    }

    if (options.fileUri) {
      await Sharing.shareAsync(options.fileUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: options.title || 'Share Palette',
      });
    }

    return { success: true, message: 'Shared successfully' };
  } catch (error) {
    // User cancelled or error
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to share',
    };
  }
}

// ============================================
// Main Export Functions
// ============================================

export type TextExportFormat =
  | 'hex'
  | 'rgb'
  | 'hsl'
  | 'css'
  | 'scss'
  | 'tailwind'
  | 'json'
  | 'swift'
  | 'android';

/**
 * Export palette as text in various formats
 */
export async function exportAsText(
  colors: (Color | PaletteColor)[],
  format: TextExportFormat,
  paletteName?: string
): Promise<ExportResult> {
  let text: string;

  switch (format) {
    case 'hex':
      text = generateHexList(colors);
      break;
    case 'rgb':
      text = generateRgbList(colors);
      break;
    case 'hsl':
      text = generateHslList(colors);
      break;
    case 'css':
      text = generateCssVariables(colors);
      break;
    case 'scss':
      text = generateScssVariables(colors);
      break;
    case 'tailwind':
      text = generateTailwindConfig(colors, paletteName);
      break;
    case 'json':
      text = generateJsonExport(colors, paletteName);
      break;
    case 'swift':
      text = generateSwiftCode(colors, paletteName);
      break;
    case 'android':
      text = generateAndroidXml(colors);
      break;
    default:
      return { success: false, message: 'Invalid format' };
  }

  return copyToClipboard(text);
}

/**
 * Export palette as SVG image
 */
export async function exportAsSvg(
  colors: (Color | PaletteColor)[],
  options: {
    paletteName?: string;
    showHex?: boolean;
    showColorNames?: boolean;
    saveToGallery?: boolean;
  } = {}
): Promise<ExportResult> {
  const svg = generateSvgPalette(colors, {
    paletteName: options.paletteName,
    showHex: options.showHex ?? true,
    showColorNames: options.showColorNames,
  });

  const fileName = `${options.paletteName?.replace(/\s+/g, '-') || 'palette'}-${Date.now()}.svg`;
  return saveFile(svg, fileName, 'image/svg+xml');
}

/**
 * Export palette as ASE (Adobe Swatch Exchange) file
 */
export async function exportAsAse(
  colors: (Color | PaletteColor)[],
  paletteName?: string
): Promise<ExportResult> {
  const aseData = generateAseData(colors, paletteName);
  const fileName = `${paletteName?.replace(/\s+/g, '-') || 'palette'}-${Date.now()}.ase`;

  const result = await saveFile(aseData, fileName, 'application/octet-stream');
  if (!result.success) return result;

  return shareContent({
    fileUri: result.filePath,
    title: 'Export ASE File',
  });
}

/**
 * Export palette as JSON file and share
 */
export async function exportAsJsonFile(
  colors: (Color | PaletteColor)[],
  paletteName?: string
): Promise<ExportResult> {
  const json = generateJsonExport(colors, paletteName);
  const fileName = `${paletteName?.replace(/\s+/g, '-') || 'palette'}-${Date.now()}.json`;

  const result = await saveFile(json, fileName, 'application/json');
  if (!result.success) return result;

  return shareContent({
    fileUri: result.filePath,
    title: 'Export JSON File',
  });
}

// ============================================
// Export Service Object
// ============================================

export const exportService = {
  // Text exports (copy to clipboard)
  exportAsText,
  copyToClipboard,

  // Text generators
  generateHexList,
  generateRgbList,
  generateHslList,
  generateCssVariables,
  generateScssVariables,
  generateTailwindConfig,
  generateJsonExport,
  generateSwiftCode,
  generateAndroidXml,

  // Image/File exports
  exportAsSvg,
  exportAsAse,
  exportAsJsonFile,
  generateSvgPalette,
  generateAseData,

  // File operations
  saveFile,
  saveToMediaLibrary,
  shareContent,
};

export default exportService;
