import { describe, expect, it } from "vitest";
import { BANDS, BAND_ROWS, bandCam, type BandScene } from "../../lib/world/band";
import { layerOffset } from "../../lib/world/pixel";

describe("band", () => {
  it("each scene's camera puts its main layer's chosen row at the top of the band", () => {
    for (const scene of Object.keys(BANDS) as BandScene[]) {
      const { top, depth } = BANDS[scene];
      for (const w of [200, 480, 576]) {
        const o = layerOffset(bandCam(scene), depth, { w: 576, h: 360 }, { w, h: BAND_ROWS });
        expect(o.y, scene).toBe(top);
        expect(top + BAND_ROWS, scene).toBeLessThanOrEqual(360);
      }
    }
  });

  it("every scene has its own wide manifest", () => {
    for (const { url } of Object.values(BANDS)) expect(url).toMatch(/^\/world\/[a-z-]+\/wide\/manifest\.json$/);
  });
});
