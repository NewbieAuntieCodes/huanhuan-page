
/**
 * Checks if a given string is a valid hexadecimal color code.
 * @param colorString The string to check.
 * @returns True if the string is a hex color, false otherwise.
 */
export const isHexColor = (colorString: string): boolean => {
  if (!colorString || typeof colorString !== 'string') return false;
  const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  return hexColorRegex.test(colorString);
};

/**
 * Calculates whether black ('#000000') or white ('#FFFFFF') text
 * provides better contrast against a given hex background color.
 * Uses a simple luminance calculation.
 * @param hexBgColor The background color in hex format (e.g., '#RRGGBB' or '#RGB').
 * @returns '#000000' for light backgrounds, '#FFFFFF' for dark backgrounds.
 */
export const getContrastingTextColor = (hexBgColor: string): string => {
  if (!isHexColor(hexBgColor)) {
    return '#000000'; // Default to black if bg is not a valid hex
  }

  let r: number, g: number, b: number;

  if (hexBgColor.length === 4) { // #RGB format
    r = parseInt(hexBgColor[1] + hexBgColor[1], 16);
    g = parseInt(hexBgColor[2] + hexBgColor[2], 16);
    b = parseInt(hexBgColor[3] + hexBgColor[3], 16);
  } else { // #RRGGBB format
    r = parseInt(hexBgColor.substring(1, 3), 16);
    g = parseInt(hexBgColor.substring(3, 5), 16);
    b = parseInt(hexBgColor.substring(5, 7), 16);
  }

  // Calculate luminance (simple version, YIQ formula is more accurate but this is often sufficient)
  // const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Using HSP (Highly Sensitive Poo) equation for perceived brightness:
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));


  // If brightness is high (light color), use dark text. Otherwise, use light text.
  return hsp > 127.5 ? '#000000' : '#FFFFFF';
};