# Implementation Plan: Auth-First Gate, ThaID Gateway & 6-Digit Security PIN

## Overview
ปรับระบบ Authentication และ Security Flow ให้หน้า Login เป็นหน้าหลักสำหรับผู้ที่ยังไม่ได้เข้าสู่ระบบ, เพิ่มหน้าจำลองการเชื่อมต่อ ThaID D.DOPA, ระบบความปลอดภัยรหัส PIN 6 หลัก (Unlock / Setup / Change PIN) และจัดระเบียบหน้า Settings

## Task List

### Phase 1: Authentication & ThaID Connection
- [ ] Task 1.1: สร้างโมดูลจัดการความปลอดภัยรหัส PIN (`pin-storage.ts`)
- [ ] Task 1.2: สร้างหน้าจอเชื่อมต่อ ThaID Digital ID Gateway (`ThaidConnectView.tsx`)
- [ ] Task 1.3: ปรับปรุง `LoginView.tsx` รองรับการเด้งไปหน้า ThaID และเปลี่ยนปุ่มลงทะเบียนใหม่

### Phase 2: Security PIN & App Lock
- [ ] Task 2.1: สร้างหน้าจอ Numeric Keypad PIN 6 หลัก (`PinAuthView.tsx`) รองรับ Unlock / Setup / Change PIN
- [ ] Task 2.2: อัปเดต `SettingsView.tsx` ให้มีเมนูจัดการ PIN และจัดหมวดหมู่ขนาดฟอนต์/การแจ้งเตือน
- [ ] Task 2.3: ปรับปรุง `SiteShell.tsx` ให้ Header สะอาดตาโดยย้าย Font Scaler ไปไว้ใน Settings

### Phase 3: Root Flow Integration & Testing
- [ ] Task 3.1: อัปเดต `page.tsx` ให้เป็น Auth-First (Login Gate / Persistent Session / PIN Lock)
- [ ] Task 3.2: เพิ่ม CSS Styling ใน `globals.css` สำหรับ Keypad PIN และหน้า ThaID
- [ ] Task 3.3: รันการทดสอบ Unit Tests และ Next.js Production Build
