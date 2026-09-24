"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueData } from "@/shared/api/types";

// คีย์สำหรับบันทึกการตั้งค่าเปิด/ปิดเสียงแจ้งเตือนใน localStorage
const STORAGE_KEY_NOTIF = "hospital_queue_sound_enabled";

/**
 * สังเคราะห์เสียงกริ่งแจ้งเตือน 3 จังหวะ (Chime) ด้วย Web Audio API
 * (จุดเด่นทางเทคนิค: สังเคราะห์คลื่นเสียง Sine Wave เองในโค้ด โดยไม่ต้องพึ่งพาไฟล์ mp3 จากภายนอก ทำให้โหลดไวและทำงานได้แม้ออฟไลน์)
 *
 * ระดับความถี่ของตัวโน้ต: โน้ต C5 (523.25Hz) -> โน้ต E5 (659.25Hz) -> โน้ต G5 (783.99Hz)
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

    // เล่นเสียง 3 โน้ตต่อเนื่องไล่ระดับ: C5 -> E5 -> G5
    playTone(523.25, now, 0.4);
    playTone(659.25, now + 0.18, 0.4);
    playTone(783.99, now + 0.36, 0.6);
  } catch {
    // ดักจับข้อผิดพลาดกรณีเบราว์เซอร์บล็อก Autoplay ก่อนที่ผู้ใช้จะโต้ตอบกับหน้าเว็บ
  }
}

/**
 * สั่งให้อุปกรณ์มือถือสั่นเตือนผ่าน Browser Vibration API (Haptic Feedback)
 * รูปแบบจังหวะการสั่น: สั่น 300ms -> พัก 150ms -> สั่น 300ms -> พัก 150ms -> สั่นยาว 500ms
 */
function triggerVibration() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
  } catch {
    // ข้ามกรณีอุปกรณ์ไม่รองรับการสั่น
  }
}

/**
 * ดึงสถานะการเปิด/ปิดเสียงแจ้งเตือนที่เคยบันทึกไว้ใน localStorage
 *
 * @returns {boolean} true หากเปิดเสียงไว้ (ค่าเริ่มต้นคือ true)
 */
function getInitialSoundState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_NOTIF);
    if (saved !== null) return saved === "true";
  } catch {
    // ข้ามข้อผิดพลาดของ storage
  }
  return true;
}

/**
 * React Custom Hook สำหรับจัดการระบบเสียงและสั่นแจ้งเตือนเมื่อใกล้ถึงคิวตรวจ (`useQueueNotification`)
 *
 * กลไกการทำงานสำคัญ (เตรียมอธิบายในการสอบวิทยานิพนธ์):
 * 1. ตรวจจับการเปลี่ยนแปลงของคิว: เช่น เหลือคิวก่อนหน้า <= 3 คิว หรือ สถานะเปลี่ยนเป็น "กำลังเรียกพบแพทย์"
 * 2. ป้องกันการส่งเสียงซ้ำซ้อน (Deduplication) ด้วย `lastNotifiedKey` ref
 * 3. ส่งสัญญาณเตือนทั้งเสียงสังเคราะห์และระบบสั่นบนมือถือ
 * 4. คืนค่าฟังก์ชัน `toggleNotification` และ `triggerTestAlert` สำหรับทดสอบระบบ
 *
 * @param {Partial<QueueData> | null | undefined} queue - ข้อมูลคิวปัจจุบันของผู้ป่วย
 */
export function useQueueNotification(queue: Partial<QueueData> | null | undefined) {
  const [enabled, setEnabled] = useState<boolean>(getInitialSoundState);
  const [alertActive, setAlertActive] = useState<boolean>(false);
  const lastNotifiedKey = useRef<string>("");

  // ฟังก์ชันสลับสถานะเปิด/ปิดเสียงแจ้งเตือน
  const toggleNotification = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_NOTIF, String(next));
      } catch {
        // ข้ามข้อผิดพลาดของ storage
      }
      if (next) {
        playChimeSound();
        triggerVibration();
      }
      return next;
    });
  }, []);

  // Effect ตรวจสอบเงื่อนไขว่าต้องส่งเสียงเตือนหรือไม่เมื่อข้อมูลคิวอัปเดต
  useEffect(() => {
    if (!queue || !enabled) return;

    const pos = queue.queue_position;
    const status = queue.status_label || "";
    // เงื่อนไข: ใกล้ถึงคิว (เหลือ 1-3 คิว) หรือ อยู่ในสถานะกำลังเรียกตรวจ
    const isNearQueue = typeof pos === "number" && pos > 0 && pos <= 3;
    const isCalling = status.includes("เรียก") || status.includes("ห้องตรวจ") || pos === 1;

    const notificationKey = `${queue.queue_number || ""}-${pos}-${status}`;

    // หากเข้าเงื่อนไขและยังไม่เคยแจ้งเตือนสำหรับสถานะนี้มาก่อน ให้เล่นเสียงเตือนทันที
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
