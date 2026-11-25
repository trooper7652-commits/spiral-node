import type { ProductImage } from "../lib/product";
import styles from "./PhotoSlot.module.css";

export default function PhotoSlot({ image }: { image: ProductImage }) {
  const soon = image.kind === "sketch" ? "sketch coming soon" : "photo coming soon";
  return (
    <figure className={styles.slot}>
      {image.src === null ? (
        <div className={styles.frame} role="img" aria-label={`${image.alt} (${soon})`} data-testid="placeholder">
          <span className={styles.soon}>{soon[0].toUpperCase() + soon.slice(1)}</span>
        </div>
      ) : (
        <img className={styles.img} src={image.src} alt={image.alt} width={1600} height={1200} loading="lazy" />
      )}
      <figcaption className={styles.caption}>{image.caption}</figcaption>
    </figure>
  );
}
