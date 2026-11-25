"use client";
import { createContext, use, type CSSProperties, type ReactNode } from "react";
import type { Button } from "@/lib/sim/protocol";
import art from "../../public/art/device.json";
import styles from "./Sim.module.css";

export type Colourway = "olive" | "brown" | "black";
export const COLOURWAYS: Colourway[] = ["olive", "brown", "black"];

// Geometry from public/art/device.json (art px; 1 art px = 1 screen px).
const ART = { w: art.width, h: art.height, screen: art.screen, wheel: art.wheel, keys: art.keys };

/** body: the device art is drawn here; split: phone, screen over wheel. */
type Layout = "body" | "split";
type Ctx = { colourway: Colourway; layout: Layout };
const DeviceContext = createContext<Ctx>({ colourway: "olive", layout: "body" });

type RootProps = {
  colourway: Colourway;
  layout: Layout;
  /** CSS width of the 250 px screen: art px are cssWidth / 250 CSS px, so body art and canvas agree. */
  cssWidth: number;
  children: ReactNode;
};

/** The device: the body PNG with parts placed on it (desktop), or screen over wheel (phone). */
function Root({ colourway, layout, cssWidth, children, ...rest }: RootProps & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className">) {
  const k = cssWidth / ART.screen.w;
  const style = {
    "--k": `${k}px`,
    "--cw": `url(/art/device-${colourway}.png)`,
    "--screen-w": `${cssWidth}px`,
    "--dw": ART.w,
    "--dh": ART.h,
    "--sx": ART.screen.x,
    "--sy": ART.screen.y,
    "--wx": ART.wheel.cx - ART.wheel.r,
    "--wy": ART.wheel.cy - ART.wheel.r,
    "--wd": ART.wheel.r * 2,
    "--wcx": ART.wheel.cx,
    "--wcy": ART.wheel.cy,
    "--wcr": ART.wheel.centerR,
  } as CSSProperties;
  return (
    <DeviceContext value={{ colourway, layout }}>
      <div
        role="group"
        aria-label="Spiral Node simulator"
        {...rest}
        className={layout === "split" ? styles.split : styles.body}
        data-colourway={colourway}
        style={style}
      >
        {children}
      </div>
    </DeviceContext>
  );
}

function Screen({ children }: { children: ReactNode }) {
  const { layout } = use(DeviceContext);
  return (
    <div className={layout === "split" ? styles.screenSplit : styles.screenBody}>
      <div className={styles.screenInner}>{children}</div>
    </div>
  );
}

type WheelProps = {
  pressed: ReadonlySet<Button>;
  disabled: boolean;
  onPress: (b: Button, src: string) => void;
  onRelease: (b: Button, src: string) => void;
};

const WEDGES: { button: Exclude<Button, "select">; label: string; clip: string }[] = [
  { button: "up", label: "Up", clip: "polygon(50% 50%, 0 0, 100% 0)" },
  { button: "right", label: "Right", clip: "polygon(50% 50%, 100% 0, 100% 100%)" },
  { button: "down", label: "Down", clip: "polygon(50% 50%, 100% 100%, 0 100%)" },
  { button: "left", label: "Left", clip: "polygon(50% 50%, 0 100%, 0 0)" },
];

function Wheel({ pressed, disabled, onPress, onRelease }: WheelProps) {
  const { layout } = use(DeviceContext);
  const part = (b: Button, label: string, cls: string, clip?: string) => (
    <button
      type="button"
      key={b}
      data-wheel=""
      data-button={b}
      data-pressed={pressed.has(b) ? "" : undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cls}
      style={clip ? { clipPath: clip } : undefined}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress(b, "pointer");
      }}
      onPointerUp={() => onRelease(b, "pointer")}
      onPointerCancel={() => onRelease(b, "pointer")}
      onLostPointerCapture={() => onRelease(b, "pointer")}
      onContextMenu={(e) => e.preventDefault()}
    >
      {b === "select" && (
        <svg className={styles.ring} viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18" pathLength="1" />
        </svg>
      )}
    </button>
  );
  return (
    <div className={layout === "split" ? styles.wheelSplit : styles.wheelBody}>
      <div className={styles.wheelFace}>
        {WEDGES.map((w) => part(w.button, w.label, styles.wedge, w.clip))}
      </div>
      {part("select", "Select (hold for Back)", styles.centre)}
    </div>
  );
}

export const Device = Object.assign(Root, { Screen, Wheel });
export { ART };
