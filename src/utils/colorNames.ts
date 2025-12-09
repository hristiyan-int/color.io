import type { RGB } from '@/types';

interface NamedColor {
  name: string;
  rgb: RGB;
}

/**
 * Dictionary of 150+ named colors
 * Each color includes its common name and RGB values
 */
const COLOR_DICTIONARY: NamedColor[] = [
  // Reds
  { name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
  { name: 'Crimson', rgb: { r: 220, g: 20, b: 60 } },
  { name: 'Scarlet', rgb: { r: 255, g: 36, b: 0 } },
  { name: 'Ruby', rgb: { r: 224, g: 17, b: 95 } },
  { name: 'Cherry', rgb: { r: 222, g: 49, b: 99 } },
  { name: 'Wine', rgb: { r: 114, g: 47, b: 55 } },
  { name: 'Burgundy', rgb: { r: 128, g: 0, b: 32 } },
  { name: 'Maroon', rgb: { r: 128, g: 0, b: 0 } },
  { name: 'Brick', rgb: { r: 203, g: 65, b: 84 } },
  { name: 'Rose', rgb: { r: 255, g: 0, b: 127 } },
  { name: 'Salmon', rgb: { r: 250, g: 128, b: 114 } },
  { name: 'Coral', rgb: { r: 255, g: 127, b: 80 } },
  { name: 'Tomato', rgb: { r: 255, g: 99, b: 71 } },

  // Oranges
  { name: 'Orange', rgb: { r: 255, g: 165, b: 0 } },
  { name: 'Tangerine', rgb: { r: 255, g: 159, b: 0 } },
  { name: 'Pumpkin', rgb: { r: 255, g: 117, b: 24 } },
  { name: 'Carrot', rgb: { r: 237, g: 145, b: 33 } },
  { name: 'Apricot', rgb: { r: 251, g: 206, b: 177 } },
  { name: 'Peach', rgb: { r: 255, g: 218, b: 185 } },
  { name: 'Burnt Orange', rgb: { r: 204, g: 85, b: 0 } },
  { name: 'Rust', rgb: { r: 183, g: 65, b: 14 } },
  { name: 'Terracotta', rgb: { r: 226, g: 114, b: 91 } },
  { name: 'Amber', rgb: { r: 255, g: 191, b: 0 } },

  // Yellows
  { name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'Gold', rgb: { r: 255, g: 215, b: 0 } },
  { name: 'Honey', rgb: { r: 235, g: 150, b: 5 } },
  { name: 'Mustard', rgb: { r: 255, g: 219, b: 88 } },
  { name: 'Lemon', rgb: { r: 255, g: 247, b: 0 } },
  { name: 'Canary', rgb: { r: 255, g: 239, b: 0 } },
  { name: 'Butter', rgb: { r: 255, g: 255, b: 149 } },
  { name: 'Cream', rgb: { r: 255, g: 253, b: 208 } },
  { name: 'Champagne', rgb: { r: 247, g: 231, b: 206 } },
  { name: 'Blonde', rgb: { r: 250, g: 240, b: 190 } },

  // Greens
  { name: 'Green', rgb: { r: 0, g: 128, b: 0 } },
  { name: 'Lime', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Emerald', rgb: { r: 80, g: 200, b: 120 } },
  { name: 'Jade', rgb: { r: 0, g: 168, b: 107 } },
  { name: 'Mint', rgb: { r: 152, g: 255, b: 152 } },
  { name: 'Sage', rgb: { r: 176, g: 208, b: 176 } },
  { name: 'Forest', rgb: { r: 34, g: 139, b: 34 } },
  { name: 'Olive', rgb: { r: 128, g: 128, b: 0 } },
  { name: 'Moss', rgb: { r: 138, g: 154, b: 91 } },
  { name: 'Grass', rgb: { r: 124, g: 252, b: 0 } },
  { name: 'Seafoam', rgb: { r: 159, g: 226, b: 191 } },
  { name: 'Teal', rgb: { r: 0, g: 128, b: 128 } },
  { name: 'Pine', rgb: { r: 1, g: 121, b: 111 } },
  { name: 'Jungle', rgb: { r: 41, g: 171, b: 135 } },
  { name: 'Hunter', rgb: { r: 53, g: 94, b: 59 } },
  { name: 'Spring', rgb: { r: 0, g: 255, b: 127 } },
  { name: 'Pistachio', rgb: { r: 147, g: 197, b: 114 } },
  { name: 'Chartreuse', rgb: { r: 127, g: 255, b: 0 } },

  // Blues
  { name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
  { name: 'Sky', rgb: { r: 135, g: 206, b: 235 } },
  { name: 'Azure', rgb: { r: 0, g: 127, b: 255 } },
  { name: 'Navy', rgb: { r: 0, g: 0, b: 128 } },
  { name: 'Royal', rgb: { r: 65, g: 105, b: 225 } },
  { name: 'Cobalt', rgb: { r: 0, g: 71, b: 171 } },
  { name: 'Sapphire', rgb: { r: 15, g: 82, b: 186 } },
  { name: 'Ocean', rgb: { r: 0, g: 119, b: 190 } },
  { name: 'Cerulean', rgb: { r: 0, g: 123, b: 167 } },
  { name: 'Denim', rgb: { r: 21, g: 96, b: 189 } },
  { name: 'Steel', rgb: { r: 70, g: 130, b: 180 } },
  { name: 'Powder', rgb: { r: 176, g: 224, b: 230 } },
  { name: 'Baby Blue', rgb: { r: 137, g: 207, b: 240 } },
  { name: 'Ice', rgb: { r: 153, g: 255, b: 255 } },
  { name: 'Turquoise', rgb: { r: 64, g: 224, b: 208 } },
  { name: 'Aqua', rgb: { r: 0, g: 255, b: 255 } },
  { name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
  { name: 'Midnight', rgb: { r: 25, g: 25, b: 112 } },

  // Purples
  { name: 'Purple', rgb: { r: 128, g: 0, b: 128 } },
  { name: 'Violet', rgb: { r: 238, g: 130, b: 238 } },
  { name: 'Lavender', rgb: { r: 230, g: 230, b: 250 } },
  { name: 'Lilac', rgb: { r: 200, g: 162, b: 200 } },
  { name: 'Plum', rgb: { r: 142, g: 69, b: 133 } },
  { name: 'Orchid', rgb: { r: 218, g: 112, b: 214 } },
  { name: 'Grape', rgb: { r: 111, g: 45, b: 168 } },
  { name: 'Amethyst', rgb: { r: 153, g: 102, b: 204 } },
  { name: 'Mauve', rgb: { r: 224, g: 176, b: 255 } },
  { name: 'Indigo', rgb: { r: 75, g: 0, b: 130 } },
  { name: 'Eggplant', rgb: { r: 97, g: 64, b: 81 } },
  { name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
  { name: 'Fuchsia', rgb: { r: 255, g: 0, b: 255 } },
  { name: 'Periwinkle', rgb: { r: 204, g: 204, b: 255 } },

  // Pinks
  { name: 'Pink', rgb: { r: 255, g: 192, b: 203 } },
  { name: 'Hot Pink', rgb: { r: 255, g: 105, b: 180 } },
  { name: 'Blush', rgb: { r: 222, g: 93, b: 131 } },
  { name: 'Bubblegum', rgb: { r: 255, g: 193, b: 204 } },
  { name: 'Flamingo', rgb: { r: 252, g: 142, b: 172 } },
  { name: 'Watermelon', rgb: { r: 253, g: 70, b: 89 } },
  { name: 'Raspberry', rgb: { r: 227, g: 11, b: 92 } },
  { name: 'Rouge', rgb: { r: 169, g: 64, b: 118 } },
  { name: 'Dusty Rose', rgb: { r: 194, g: 137, b: 162 } },

  // Browns
  { name: 'Brown', rgb: { r: 139, g: 69, b: 19 } },
  { name: 'Chocolate', rgb: { r: 123, g: 63, b: 0 } },
  { name: 'Coffee', rgb: { r: 111, g: 78, b: 55 } },
  { name: 'Mocha', rgb: { r: 151, g: 114, b: 92 } },
  { name: 'Chestnut', rgb: { r: 149, g: 69, b: 53 } },
  { name: 'Cinnamon', rgb: { r: 210, g: 105, b: 30 } },
  { name: 'Caramel', rgb: { r: 255, g: 213, b: 145 } },
  { name: 'Tan', rgb: { r: 210, g: 180, b: 140 } },
  { name: 'Beige', rgb: { r: 245, g: 245, b: 220 } },
  { name: 'Khaki', rgb: { r: 195, g: 176, b: 145 } },
  { name: 'Sand', rgb: { r: 194, g: 178, b: 128 } },
  { name: 'Taupe', rgb: { r: 72, g: 60, b: 50 } },
  { name: 'Umber', rgb: { r: 99, g: 81, b: 71 } },
  { name: 'Sienna', rgb: { r: 160, g: 82, b: 45 } },
  { name: 'Mahogany', rgb: { r: 192, g: 64, b: 0 } },
  { name: 'Auburn', rgb: { r: 165, g: 42, b: 42 } },
  { name: 'Copper', rgb: { r: 184, g: 115, b: 51 } },
  { name: 'Bronze', rgb: { r: 205, g: 127, b: 50 } },

  // Neutrals
  { name: 'White', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'Ivory', rgb: { r: 255, g: 255, b: 240 } },
  { name: 'Pearl', rgb: { r: 234, g: 224, b: 200 } },
  { name: 'Snow', rgb: { r: 255, g: 250, b: 250 } },
  { name: 'Bone', rgb: { r: 227, g: 218, b: 201 } },
  { name: 'Linen', rgb: { r: 250, g: 240, b: 230 } },
  { name: 'Silver', rgb: { r: 192, g: 192, b: 192 } },
  { name: 'Ash', rgb: { r: 178, g: 190, b: 181 } },
  { name: 'Slate', rgb: { r: 112, g: 128, b: 144 } },
  { name: 'Charcoal', rgb: { r: 54, g: 69, b: 79 } },
  { name: 'Smoke', rgb: { r: 115, g: 130, b: 118 } },
  { name: 'Fog', rgb: { r: 175, g: 180, b: 175 } },
  { name: 'Gray', rgb: { r: 128, g: 128, b: 128 } },
  { name: 'Graphite', rgb: { r: 65, g: 65, b: 65 } },
  { name: 'Onyx', rgb: { r: 53, g: 56, b: 57 } },
  { name: 'Ebony', rgb: { r: 33, g: 36, b: 33 } },
  { name: 'Jet', rgb: { r: 52, g: 52, b: 52 } },
  { name: 'Black', rgb: { r: 0, g: 0, b: 0 } },

  // Special/Metallic
  { name: 'Rose Gold', rgb: { r: 183, g: 110, b: 121 } },
  { name: 'Brass', rgb: { r: 181, g: 166, b: 66 } },
  { name: 'Pewter', rgb: { r: 142, g: 142, b: 130 } },
];

/**
 * Calculate the Euclidean distance between two RGB colors
 */
function colorDistance(c1: RGB, c2: RGB): number {
  // Weighted distance for better perceptual matching
  // Human eyes are more sensitive to green
  const rMean = (c1.r + c2.r) / 2;
  const dR = c1.r - c2.r;
  const dG = c1.g - c2.g;
  const dB = c1.b - c2.b;

  // Weighted Euclidean distance
  const weightR = 2 + rMean / 256;
  const weightG = 4;
  const weightB = 2 + (255 - rMean) / 256;

  return Math.sqrt(
    weightR * dR * dR +
    weightG * dG * dG +
    weightB * dB * dB
  );
}

/**
 * Find the closest named color for a given RGB color
 */
export function getColorName(rgb: RGB): string {
  let closestColor = COLOR_DICTIONARY[0];
  let minDistance = Infinity;

  for (const namedColor of COLOR_DICTIONARY) {
    const distance = colorDistance(rgb, namedColor.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = namedColor;
    }
  }

  // Add shade modifiers based on lightness
  const lightness = (rgb.r + rgb.g + rgb.b) / 3;
  const referenceLightness = (closestColor.rgb.r + closestColor.rgb.g + closestColor.rgb.b) / 3;

  if (lightness < referenceLightness - 40) {
    return `Dark ${closestColor.name}`;
  } else if (lightness > referenceLightness + 40) {
    return `Light ${closestColor.name}`;
  }

  return closestColor.name;
}

/**
 * Get all colors in a specific category
 */
export function getColorsByCategory(category: string): NamedColor[] {
  const categories: Record<string, [number, number]> = {
    red: [0, 13],
    orange: [13, 23],
    yellow: [23, 33],
    green: [33, 51],
    blue: [51, 69],
    purple: [69, 83],
    pink: [83, 92],
    brown: [92, 110],
    neutral: [110, 128],
    special: [128, 131],
  };

  const range = categories[category.toLowerCase()];
  if (!range) return [];

  return COLOR_DICTIONARY.slice(range[0], range[1]);
}

/**
 * Search colors by name
 */
export function searchColorsByName(query: string): NamedColor[] {
  const lowerQuery = query.toLowerCase();
  return COLOR_DICTIONARY.filter((color) =>
    color.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get a random named color
 */
export function getRandomColor(): NamedColor {
  const index = Math.floor(Math.random() * COLOR_DICTIONARY.length);
  return COLOR_DICTIONARY[index];
}

/**
 * Export the full color dictionary for external use
 */
export function getAllNamedColors(): NamedColor[] {
  return [...COLOR_DICTIONARY];
}
