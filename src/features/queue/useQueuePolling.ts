import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { QueueData } from "@/shared/api/types";
import { getRuntimeConfig } from "@/shared/config/runtime-config";

// พารามิเตอร์ตัวเลือกสำหรับ Hook useQueuePolling
interface UseQueuePollingOptions {
  enabled: boolean;                               // เปิดใช้งานการดึงข้อมูลคิวหรือไม่
  token: string;                                  // Access Token สำหรับเรียก API
  initialQueue?: Partial<QueueData> | null;       // ข้อมูลคิวเริ่มต้น (ถ้ามี)
  onUnauthorized: () => void;                     // Callback เมื่อ Token หมดอายุ (HTTP 401)
}

/**
 * Custom Hook สำหรับดึงข้อมูลสถานะคิวของผู้ป่วยแบบอัตโนมัติเป็นระยะ (Background Queue Polling)
 *
 * กลไกการทำงานที่สำคัญ (เตรียมตอบคำถามเรื่อง Real-time Architecture ในการสอบ):
 * 1. ดึงข้อมูลคิวครั้งแรกทันทีที่เปิดหน้านี้
 * 2. สร้าง Timer ด้วย `setInterval` เพื่อ Polling ข้อมูลตามรอบเวลา `statusRefreshMs` (เช่น ทุก 10 วินาที)
 * 3. ทำการอัปเดตแบบเงียบ (Silent Refresh: silent = true) เพื่อไม่ให้หน้าจอกระพริบหรือแสดง Spinner รบกวนผู้ป่วย
 * 4. หากเซิร์ฟเวอร์ตอบกลับ 401 Unauthorized จะเรียก `onUnauthorized` เพื่อให้ผู้ป่วยเข้าสู่ระบบใหม่
 * 5. หากเซิร์ฟเวอร์ตอบกลับ 404 (ไม่มีคิวที่รอดำเนินการ) จะปรับสถานะคิวเป็น null โดยไม่แสดงข้อผิดพลาด
 *
 * @param {UseQueuePollingOptions} options - การตั้งค่า Polling
 * @returns ออบเจกต์ที่ประกอบด้วย { queue, error, loading, initialLoading, refresh, clearActiveQueue }
 */
export function useQueuePolling({ enabled, token, initialQueue, onUnauthorized }: UseQueuePollingOptions) {
  const [queue, setQueue] = useState<Partial<QueueData> | null>(initialQueue || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(Boolean(enabled && token && !initialQueue));
  const onUnauthorizedRef = useRef(onUnauthorized);

  // เก็บ ref ของ onUnauthorized เพื่อป้องกันไม่ให้ useEffect รันซ้ำโดยไม่จำเป็น
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  // ฟังก์ชันดึงข้อมูลสถานะคิวล่าสุดจาก API
  const refresh = useCallback(async (silent = false) => {
    if (!token) {
      setInitialLoading(false);
      return;
    }
    // หากไม่ใช่การดึงแบบเงียบ จะแสดงสถานะ Loading
    if (!silent) setLoading(true);
    try {
      const data = await patientApi.queue(token);
      setQueue(data);
      setError("");
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถอัปเดตสถานะได้");
      // กรณี Token หมดอายุ หรือสิทธิ์ไม่ถูกต้อง
      if (apiError.status === 401) onUnauthorizedRef.current();
      // กรณีไม่พบคิวที่ยังรอดำเนินการ (ตรวจเสร็จแล้วหรือยกเลิกแล้ว)
      else if (apiError.status === 404) {
        setQueue(null);
        setError("");
      }
      else setError(apiError.message);
    } finally {
      if (!silent) setLoading(false);
      setInitialLoading(false);
    }
  }, [token]);

  // Effect เริ่มการ Polling เมื่อเงื่อนไขเปิดใช้งานครบถ้วน
  useEffect(() => {
    if (!enabled || !token) {
      setInitialLoading(false);
      return;
    }
    void refresh();
    // ตั้งเวลา Polling ดึงข้อมูลเบื้องหลังตามระยะเวลาคอนฟิก
    const timer = window.setInterval(() => void refresh(true), getRuntimeConfig().statusRefreshMs);
    return () => window.clearInterval(timer);
  }, [enabled, token, refresh]);

  // ล้างสถานะคิวปัจจุบันออกจากหน้าจอ
  const clearActiveQueue = useCallback(() => {
    setQueue(null);
  }, []);

  return { queue, error, loading, initialLoading, refresh, clearActiveQueue };
}
