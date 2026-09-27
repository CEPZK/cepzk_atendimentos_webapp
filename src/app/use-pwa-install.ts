"use client";

import { useState, useSyncExternalStore } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

// Module-level prompt storage so that an early beforeinstallprompt event
// fired before the React component mounts is never missed.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  promptListeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Prevent the default mini-infobar on mobile browsers
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyPromptListeners();
  });
}

function subscribePrompt(callback: () => void) {
  promptListeners.add(callback);
  return () => {
    promptListeners.delete(callback);
  };
}

/** Helper to set or reset the prompt during tests. */
export function setDeferredPromptForTesting(
  prompt: BeforeInstallPromptEvent | null,
) {
  deferredPrompt = prompt;
  notifyPromptListeners();
}

function checkIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMq =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
    true;
  return Boolean(isStandaloneMq || isIosStandalone);
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)")
      : null;

  mql?.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);

  return () => {
    mql?.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function checkIsIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

function checkIsChromeIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return checkIsIOS() && /crios/i.test(ua);
}

const noopSubscribe = () => () => {};

export function usePwaInstall() {
  const [hasPromptAccepted, setHasPromptAccepted] = useState(false);

  // Sync with standalone media query / installed state
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    checkIsStandalone,
    () => false,
  );

  // Sync with user agent platform
  const isIOS = useSyncExternalStore(noopSubscribe, checkIsIOS, () => false);
  const isChromeIOS = useSyncExternalStore(
    noopSubscribe,
    checkIsChromeIOS,
    () => false,
  );

  // Sync with module-level deferredPrompt
  const currentPrompt = useSyncExternalStore(
    subscribePrompt,
    () => deferredPrompt,
    () => null,
  );

  const promptInstall = async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!currentPrompt) {
      return "unavailable";
    }

    try {
      const promptEvent = currentPrompt;
      deferredPrompt = null;
      notifyPromptListeners();

      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setHasPromptAccepted(true);
      }
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  };

  return {
    isStandalone: isStandalone || hasPromptAccepted,
    isIOS,
    isChromeIOS,
    canPromptNative: Boolean(currentPrompt),
    promptInstall,
  };
}
