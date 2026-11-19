"use client";
import { useEffect, type RefObject } from "react";
import { keyToButton } from "@/lib/sim/keys";
import type { Button } from "@/lib/sim/protocol";

const NOT_DEVICE_KEYS = 'input, select, textarea, summary, dialog, a, button:not([data-wheel])';

type Keys = {
  press: (b: Button, src: string) => void;
  release: (b: Button, src: string) => void;
  releaseAll: () => void;
};

/** Arrows, Enter/Space, Esc/Backspace (Back) and H (Home) drive the device. Listens on `scope` when given (the hero demo), else on the whole window. */
export function useDeviceKeys({ press, release, releaseAll }: Keys, running: boolean, scope?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!running) return;
    const target: HTMLElement | Window = scope?.current ?? window;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest(NOT_DEVICE_KEYS)) return;
      const b = keyToButton(e.key);
      if (!b) return;
      e.preventDefault();
      press(b, `key:${e.key}`);
    };
    const up = (e: KeyboardEvent) => {
      const b = keyToButton(e.key);
      if (b) release(b, `key:${e.key}`);
    };
    target.addEventListener("keydown", down as EventListener);
    target.addEventListener("keyup", up as EventListener);
    window.addEventListener("blur", releaseAll);
    const hide = () => document.hidden && releaseAll();
    document.addEventListener("visibilitychange", hide);
    return () => {
      target.removeEventListener("keydown", down as EventListener);
      target.removeEventListener("keyup", up as EventListener);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [running, press, release, releaseAll, scope]);
}
