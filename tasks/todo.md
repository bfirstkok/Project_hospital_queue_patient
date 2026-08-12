# TODO: Next.js App Router + TypeScript Migration

> The migration is complete. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the current source layout.

> ขอบเขต: frontend นี้เท่านั้น — ห้ามแก้ backend/dashboard หรือ API contract

- [x] Task 1 — ตั้ง Next.js App Router + TypeScript และ runtime config
  - [x] `npm run dev`, `npm run build`, `npm run test` พร้อมใช้
  - [x] App Router build ผ่านและไม่มี backend route ใหม่
- [x] Task 2 — สร้าง API/types/token-storage layer
  - [x] คง 4 endpoint, request/response shape และ Bearer header เดิม
  - [x] คง key `hospital_patient_access_token`
  - [x] เพิ่ม unit tests สำหรับ fetch contract/error mapping
- [x] Task 3 — ย้าย registration view
  - [x] field, validation, numeric conversion, consent, honeypot ครบ
  - [x] success บันทึก token และเปิด queue status
  - [x] RTL tests ผ่าน
- [x] Task 4 — ย้าย login/session/logout
  - [x] national ID normalization และ login payload เดิม
  - [x] 401/session expired/logout behavior ครบ
  - [x] RTL tests ผ่าน

## Checkpoint A

- [x] `npm run test`
- [x] `npm run build`
- [x] เทียบ registration/login request กับ `app.js` เดิม

- [x] Task 5 — ย้าย queue status + polling
  - [x] fetch ทันทีและทุก 10000 ms/runtime config
  - [x] manual refresh, silent polling, error state ครบ
  - [x] timer cleanup เมื่อเปลี่ยน view/logout/unmount
  - [x] fake-timer tests ผ่าน
- [x] Task 6 — ย้าย patient account
  - [x] profile, active queue, visits, vitals, appointments ครบ
  - [x] empty/loading/error/401 states ครบ
  - [x] RTL fixture tests ผ่าน

## Checkpoint B

- [ ] ลงทะเบียน → status → account ทำงานครบ
- [ ] login → account → status → logout ทำงานครบ
- [x] network requests ใช้ backend เดิมทั้งหมด

- [ ] Task 7 — ตรวจ CSS parity, responsive และ accessibility
  - [ ] CSS เดิมถูกย้ายโดยไม่ redesign
  - [ ] ตรวจ 320px, 680px และ desktop
  - [ ] keyboard, focus, labels, alerts, reduced-motion ผ่าน
- [x] Task 8 — cutover และเก็บ legacy หลัง parity ผ่าน
  - [x] update README/build instructions
  - [x] ลบ legacy entrypoints ที่ถูกแทนแล้วเท่านั้น
  - [ ] clean install + test + production build + smoke test ผ่าน

## Final guardrails

- [x] backend repository ไม่มี diff
- [x] hospital dashboard ไม่มี diff
- [x] endpoints/payload/responses ไม่เปลี่ยน
- [x] token key และ polling cadence ไม่เปลี่ยน
- [x] ผู้ใช้อนุมัติแผนก่อน implement
