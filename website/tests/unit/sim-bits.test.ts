import { describe, expect, it } from "vitest";
import { H, ROW_BYTES, W, toImageData, unpackFrame } from "../../lib/sim/bits";

describe("bits", () => {
  const bits = new Uint8Array(ROW_BYTES * H);
  bits[0] = 0x80; // (0,0)
  bits[31] = 0x40 | 0x3f; // (249,0) plus padding bits 5..0 set: must be ignored
  bits[32] = 0x80; // (0,1)
  const px = unpackFrame(bits);

  it("has the right size", () => {
    expect([W, H, ROW_BYTES]).toEqual([250, 122, 32]);
    expect(px.length).toBe(250 * 122);
  });
  it("unpacks known pixels, MSB first, 32 bytes per row", () => {
    expect(px[0]).toBe(1);
    expect(px[249]).toBe(1);
    expect(px[250]).toBe(1);
    expect(px[1]).toBe(0);
    expect(px[248]).toBe(0);
    expect(px[251]).toBe(0);
    expect(px.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("paints ink and paper", () => {
    const d = toImageData(px, [10, 20, 30], [200, 210, 220]);
    expect(d.length).toBe(250 * 122 * 4);
    expect([...d.slice(0, 4)]).toEqual([10, 20, 30, 255]);
    expect([...d.slice(4, 8)]).toEqual([200, 210, 220, 255]);
  });
});
