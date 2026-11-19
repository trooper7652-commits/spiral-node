import styles from "./Sim.module.css";

/** Static device with the real Home frame, shown while the simulator chunk loads. Pure markup. */
export default function StillDevice() {
  return (
    <div className={styles.sim}>
      <div className={styles.still}>
        <div className={styles.stillInner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pixelated" src="/art/device-olive.png" width={400} height={264} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`pixelated ${styles.stillScreen}`} src="/art/home-still.png" width={250} height={122} alt="Pixel-art Spiral Node, a landscape olive pager: the e-ink screen across the top shows the Home screen; below it are Back and Home keys on the left and a round spiral wheel with a copper ring on the right." />
        </div>
      </div>
    </div>
  );
}
