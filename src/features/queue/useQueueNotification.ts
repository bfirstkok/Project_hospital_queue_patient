"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueData } from "@/shared/api/types";

const STORAGE_KEY_NOTIF = "hospital_queue_sound_enabled";

/**
 * Synthesizes a gentle 3-tone chime using Web Audio API without requiring external audio asset files.
 * Chime notes: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz).
 */
function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // 3-tone gentle chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
    playTone(523.25, now, 0.4);
    playTone(659.25, now + 0.18, 0.4);
    playTone(783.99, now + 0.36, 0.6);
  } catch {
    // Ignore audio autoplay restrictions if user has not interacted
  }
}

/**
 * Triggers haptic feedback via the browser's Vibration API.
 * Rhythm: 300ms on -> 150ms off -> 300ms on -> 150ms off -> 500ms on.
 */
function triggerVibration() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      // Vibrate pattern: 300ms on, 150ms off, 300ms on, 150ms off, 500ms on
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
  } catch {
    // Ignore vibration errors
  }
}

/**
 * Retrieves the persisted sound notification preference from local storage.
 *
 * @returns {boolean} True if sound is enabled (default: true).
 */
function getInitialSoundState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_NOTIF);
    if (saved !== null) return saved === "true";
  } catch {
    // Ignore localStorage errors
  }
  return true;
}

/**
 * Custom hook for patient queue chime audio and vibration alerts.
 *
 * Responsibilities:
 * 1. Monitors queue changes (e.g. remaining queues <= 3 or status becomes "calling").
 * 2. Deduplicates triggers via `lastNotifiedKey` ref.
 * 3. Plays Web Audio synth chime and triggers phone vibration.
 * 4. Exposes `toggleNotification` for user preference switching.
 *
 * @param {Partial<QueueData> | null | undefined} queue - Active queue record.
 */
export function useQueueNotification(queue: Partial<QueueData> | null | undefined) {
  const [enabled, setEnabled] = useState<boolean>(getInitialSoundState);
  const [alertActive, setAlertActive] = useState<boolean>(false);
  const lastNotifiedKey = useRef<string>("");

  const toggleNotification = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_NOTIF, String(next));
      } catch {
        // Ignore
      }
      if (next) {
        playChimeSound();
        triggerVibration();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!queue || !enabled) return;

    const pos = queue.queue_position;
    const status = queue.status_label || "";
    const isNearQueue = typeof pos === "number" && pos > 0 && pos <= 3;
    const isCalling = status.includes("เรียก") || status.includes("ห้องตรวจ") || pos === 1;

    const notificationKey = `${queue.queue_number || ""}-${pos}-${status}`;

    if ((isNearQueue || isCalling) && lastNotifiedKey.current !== notificationKey) {
      lastNotifiedKey.current = notificationKey;
      setAlertActive(true);
      playChimeSound();
      triggerVibration();
    }
  }, [queue, enabled]);

  return {
    enabled,
    alertActive,
    toggleNotification,
    triggerTestAlert: () => {
      playChimeSound();
      triggerVibration();
      setAlertActive(true);
    },
  };
}
