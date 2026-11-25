/** CSS px of 100vh as the probe resolved it; unlike innerHeight it does not move when a phone's toolbars show or hide. */
export const vhPx = () => document.querySelector<HTMLElement>("[data-vh]")?.getBoundingClientRect().height || innerHeight;
