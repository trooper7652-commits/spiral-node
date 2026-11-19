export const W = 250;
export const H = 122;
export const ROW_BYTES = 32; // 250 px -> 32 bytes, last 6 bits of each row are padding

export type RGB = [number, number, number];

/** 1 bit/pixel, MSB first, 32 bytes per row -> one byte per pixel (1 = black). */
export function unpackFrame(bits: Uint8Array): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = (bits[y * ROW_BYTES + (x >> 3)] >> (7 - (x & 7))) & 1;
  return out;
}

/** RGBA bytes ready for `new ImageData(...)`. */
export function toImageData(pixels: Uint8Array, ink: RGB, paper: RGB): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const c = pixels[i] ? ink : paper;
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}
