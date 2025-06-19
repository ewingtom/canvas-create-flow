/**
 * Utilities for handling PPTX unit conversions
 */

// Standard PowerPoint slide dimensions (in EMU)
export const DEFAULT_SLIDE_WIDTH_EMU = 12192000;  // 16:9 format
export const DEFAULT_SLIDE_HEIGHT_EMU = 6858000;

// Target rendering dimensions
export const RENDER_WIDTH = 960;
export const RENDER_HEIGHT = 540;

// Constants for unit conversion
export const EMU_PER_INCH = 914400;
export const EMU_PER_POINT = 12700;
export const PIXELS_PER_INCH = 96;

/**
 * Calculate the scale factor based on original slide dimensions and target render size
 */
export function calculateScaleFactor(
  slideWidthEmu: number = DEFAULT_SLIDE_WIDTH_EMU,
  targetWidth: number = RENDER_WIDTH
): number {
  return targetWidth / (slideWidthEmu / EMU_PER_INCH * PIXELS_PER_INCH);
}

/**
 * Convert EMU to pixels with proper scaling
 * @param emu EMU value to convert
 * @param scaleFactor Optional scale factor (defaults to 1)
 * @returns Pixel value
 */
export function emuToPixels(emu: number, scaleFactor: number = 1): number {
  // EMU to inches, then inches to pixels
  return (emu / EMU_PER_INCH) * PIXELS_PER_INCH * scaleFactor;
}

/**
 * Convert EMU to pixels for X coordinates, applying proper scaling for slide width
 */
export function emuToScaledX(emu: number, slideWidthEmu: number = DEFAULT_SLIDE_WIDTH_EMU): number {
  const scaleFactor = calculateScaleFactor(slideWidthEmu);
  return emuToPixels(emu, scaleFactor);
}

/**
 * Convert EMU to pixels for Y coordinates, applying proper scaling for slide height
 */
export function emuToScaledY(emu: number, slideHeightEmu: number = DEFAULT_SLIDE_HEIGHT_EMU): number {
  const scaleFactor = calculateScaleFactor(DEFAULT_SLIDE_WIDTH_EMU); // Keep same scale as width
  return emuToPixels(emu, scaleFactor);
}

/**
 * Convert EMU to points (used for font sizes)
 */
export function emuToPoints(emu: number): number {
  return emu / EMU_PER_POINT;
}

/**
 * Convert points to pixels
 */
export function pointsToPixels(points: number): number {
  return points * PIXELS_PER_INCH / 72; // 72 points per inch
}
