import art from "@/public/art/device.json";
import styles from "./DeviceInk.module.css";

const centred = (x: number, w: number) => x - w / 2;

/** The pager as an ink drawing from its geometry: the front, or the top face. */
export default function DeviceInk({ face, label }: { face: "front" | "top"; label?: string }) {
  const [w, h] = face === "front" ? [art.width, art.height] : [art.top.width, art.top.height];
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={styles.ink} focusable="false" {...a11y}>
      {face === "front" ? (
        <>
          <rect x={1} y={1} width={w - 2} height={h - 2} rx={28} className={styles.body} />
          <rect x={art.screen.x} y={art.screen.y} width={art.screen.w} height={art.screen.h} rx={4} className={styles.screen} />
          <rect x={art.keys.back.x} y={art.keys.back.y} width={art.keys.back.w} height={art.keys.back.h} rx={6} />
          <rect x={art.keys.home.x} y={art.keys.home.y} width={art.keys.home.w} height={art.keys.home.h} rx={6} />
          <circle cx={art.logo.cx} cy={art.logo.cy} r={art.logo.r} />
          <circle cx={art.wheel.cx} cy={art.wheel.cy} r={art.wheel.r} className={styles.ring} />
          <circle cx={art.wheel.cx} cy={art.wheel.cy} r={art.wheel.centerR} />
        </>
      ) : (
        <>
          <rect x={1} y={1} width={w - 2} height={h - 2} rx={18} className={styles.body} />
          {art.top.usb.map((u) => (
            <rect key={u.x} x={centred(u.x, u.w)} y={centred(u.y, u.h)} width={u.w} height={u.h} rx={4} />
          ))}
          <circle cx={art.top.light.x} cy={art.top.light.y} r={art.top.light.r} />
          <rect x={centred(art.top.power.x, art.top.power.w)} y={centred(art.top.power.y, art.top.power.h)} width={art.top.power.w} height={art.top.power.h} rx={3} />
        </>
      )}
    </svg>
  );
}