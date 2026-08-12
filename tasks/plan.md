# Implementation Plan: Migrate Patient Frontend to Next.js App Router

> Status: completed. This file preserves the original migration plan. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the current source layout.

## เป้าหมายและขอบเขต

ย้ายเฉพาะ patient frontend จาก `index.html` + `app.js` ไปเป็น Next.js App Router + TypeScript โดยคงหน้าตาและ responsive behavior จาก `styles.css` เดิม ไม่แก้ backend, hospital dashboard, endpoint, payload/response shape หรือ authentication contract

สิ่งที่ต้องคงเดิม:

- API: `POST /api/patient/register/`, `POST /api/patient/login/`, `GET /api/patient/me/`, `GET /api/patient/queue/`
- Bearer token และ key `hospital_patient_access_token` ใน `localStorage`
- polling สถานะคิวทุก `10000` ms (หรือค่าจาก runtime config)
- runtime config: `API_BASE_URL` และ `STATUS_REFRESH_MS`
- flow 4 หน้า: ลงทะเบียน → login → สถานะคิว → บัญชีผู้ป่วย
- เนื้อหาภาษาไทย, validation, error/loading/empty states และ accessibility ที่มีอยู่

## แนวทางสถาปัตยกรรม

- ใช้ App Router (`app/layout.tsx`, `app/page.tsx`) แต่คงประสบการณ์แบบ single-page เพื่อไม่เปลี่ยน URL/QR Code และ flow เดิม
- ให้ `app/page.tsx` เป็น Client Component เพราะต้องใช้ form state, `localStorage`, timer และ browser APIs
- แยก API contract/types, API client, token storage และ polling ออกจาก UI เพื่อให้ทดสอบได้โดยไม่แตะ backend
- ย้าย `styles.css` เดิมเป็น `app/globals.css` ก่อน แล้วปรับ selector เฉพาะที่ JSX ต้องการเท่านั้น
- คง runtime config ผ่าน `public/runtime-config.js` และ typed `window.PATIENT_APP_ENV`; ไม่ hard-code backend URL
- ใช้ native `fetch`, native form validation และ React state; ไม่เพิ่ม state/form/data-fetching library
- เพิ่ม Vitest + React Testing Library เฉพาะ contract-critical behavior

## ลำดับงาน

### Task 1: ตั้งโครง Next.js + TypeScript

**งาน:** เปลี่ยน scripts/dependencies และเพิ่ม config ขั้นต่ำสำหรับ App Router โดยไม่สร้าง backend route ใหม่

**Acceptance criteria:**
- `npm run dev`, `npm run build`, `npm run test` เป็นคำสั่งหลัก
- TypeScript strict และ Next.js App Router build ได้
- runtime config ถูกโหลดก่อน UI อ่านค่า

**Verification:** `npm install`, `npm run build`

**Dependencies:** ไม่มี

**Files likely touched:** `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `app/layout.tsx`, `public/runtime-config.js`

### Task 2: ล็อก API contract ด้วย TypeScript

**งาน:** สร้าง types สำหรับ registration/login/profile/queue/visits/appointments และ API client ที่รักษา URL, JSON body, `{ ok, error, errors }` handling และ Bearer header เดิม

**Acceptance criteria:**
- endpoint/method/body/header ตรงกับ `app.js` เดิม
- response/error types ครอบคลุมทุก field ที่ UI ใช้
- token storage ใช้ key เดิมและไม่อ่าน `localStorage` ระหว่าง SSR

**Verification:** unit tests mock `fetch` ตรวจ URL, method, body, Authorization และ error mapping

**Dependencies:** Task 1

**Files likely touched:** `lib/types.ts`, `lib/api.ts`, `lib/auth-storage.ts`, `lib/config.ts`, `lib/api.test.ts`

### Task 3: ย้าย shell และ registration flow

**งาน:** แปลง header/footer/form จาก HTML เป็น semantic JSX พร้อม state สำหรับ payload, validation, loading, field error, honeypot และ success transition

**Acceptance criteria:**
- ส่ง field และการแปลง `age`, `height_cm`, `weight_kg`, `consent` เหมือนเดิม
- เมื่อสำเร็จบันทึก `access_token` และเปิด status view
- หน้าตา desktop/mobile ยังคง CSS เดิมและ keyboard/screen reader ใช้งานได้

**Verification:** RTL ทดสอบ required validation, payload conversion, success และ API error; manual responsive check

**Dependencies:** Task 2

**Files likely touched:** `app/page.tsx`, `components/RegistrationView.tsx`, `components/SiteShell.tsx`, `app/globals.css`, `components/RegistrationView.test.tsx`

### Task 4: ย้าย login และ session actions

**งาน:** สร้าง login view, saved-account entry และ logout โดยคง national ID normalization กับ session behavior เดิม

**Acceptance criteria:**
- login ส่ง `{ national_id }` และบันทึก access token เดิม
- 401/ไม่มี token พากลับ login พร้อมข้อความ session expired
- logout ลบ token, หยุด timer และ reset login state

**Verification:** RTL ทดสอบ login success/error, 401 redirect และ logout

**Dependencies:** Task 2

**Files likely touched:** `app/page.tsx`, `components/LoginView.tsx`, `components/SiteShell.tsx`, `components/LoginView.test.tsx`

### Checkpoint A: Foundation + Auth

- `npm run test` และ `npm run build` ผ่าน
- registration/login payload และ token key เทียบกับ vanilla implementation แล้วไม่เปลี่ยน

### Task 5: ย้าย queue status และ polling

**งาน:** สร้าง status view พร้อม manual refresh และ polling lifecycle ที่เรียก queue API ทันที จากนั้นทุก 10 วินาที และ cleanup เมื่อเปลี่ยน view/unmount/logout

**Acceptance criteria:**
- แสดง queue number, label, instruction, position, room และ updated time เหมือนเดิม
- silent polling ไม่รบกวน manual loading state
- ไม่มี timer ซ้ำหรือ request ต่อหลังออกจาก status view

**Verification:** Vitest fake timers ตรวจ immediate fetch, 10-second interval และ cleanup; RTL ตรวจ render/error state

**Dependencies:** Task 2, Task 4

**Files likely touched:** `hooks/useQueuePolling.ts`, `components/QueueStatusView.tsx`, `hooks/useQueuePolling.test.ts`, `components/QueueStatusView.test.tsx`

### Task 6: ย้าย patient account

**งาน:** สร้าง account view สำหรับ profile, active queue, visit history และ appointments โดยใช้ typed response จาก `/api/patient/me/`

**Acceptance criteria:**
- แสดงข้อมูล/placeholder `–`, empty states, Thai date formatting และ vitals เหมือนเดิม
- active queue เปิด full status view ได้
- API error และ unauthorized state แยกกันชัดเจน

**Verification:** RTL fixture tests ครอบคลุมข้อมูลครบ, ข้อมูลว่าง, active queue และ 401

**Dependencies:** Task 2, Task 4, Task 5

**Files likely touched:** `components/AccountView.tsx`, `components/ProfileDetails.tsx`, `components/VisitHistory.tsx`, `components/AppointmentHistory.tsx`, `components/AccountView.test.tsx`

### Checkpoint B: Core flow

- flow ลงทะเบียน → status → account และ login → account → status ทำงานครบ
- polling/request ทั้งหมดใช้ backend เดิม ไม่มี Next API route หรือ dashboard change

### Task 7: เก็บ CSS เดิมและปรับ accessibility/responsive

**งาน:** ตรวจ class mapping หลังแปลง JSX, focus behavior, alerts, labels, loading/disabled states และ breakpoint เดิม

**Acceptance criteria:**
- visual hierarchy และ layout เดิมไม่ถดถอยที่ mobile/desktop
- ไม่มี console hydration warning หรือ missing React key
- prefers-reduced-motion, focus-visible และ alert semantics ยังทำงาน

**Verification:** manual check ที่ 320px, 680px และ desktop; keyboard-only walkthrough; `npm run build`

**Dependencies:** Tasks 3-6

**Files likely touched:** `app/globals.css`, `components/*.tsx`

### Task 8: Cutover และลบ legacy หลัง parity ผ่าน

**งาน:** ปรับ README/build instructions และลบ legacy entrypoints เฉพาะเมื่อ Next implementation ผ่าน checkpoints ทั้งหมด

**Acceptance criteria:**
- repository มี frontend entrypoint ชุดเดียว
- deployment ยังรับ API/runtime config เดิมและ QR Code เปิดหน้า root ได้
- ไม่มีการแก้ไฟล์หรือ contract ใน backend/dashboard repository

**Verification:** clean install, `npm run test`, `npm run build`, เปิด production build แล้วทำ smoke test ครบ 4 views

**Dependencies:** Tasks 1-7

**Files likely touched:** `README.md`, `scripts/build.mjs`, `index.html`, `app.js`, `config.js`, `styles.css`

## ความเสี่ยงและวิธีลดความเสี่ยง

| ความเสี่ยง | ระดับ | วิธีลดความเสี่ยง |
|---|---|---|
| React payload เปลี่ยนชนิดหรือชื่อ field | สูง | Contract tests เทียบ request จาก implementation เดิม |
| `window`/`localStorage` ทำให้ SSR หรือ hydration พัง | สูง | เข้าถึงเฉพาะ Client Component/effect และแยก storage adapter |
| polling ซ้ำหลัง navigation/logout | กลาง | fake-timer tests และ cleanup effect ทุกครั้ง |
| CSS selector เดิมไม่ match JSX | กลาง | ย้าย CSS แบบ untouched ก่อน แล้วตรวจ class/view selector ทีละ view |
| runtime API URL หายตอน deploy | สูง | คง `runtime-config.js`; smoke test production output ด้วย URL จริง |

## Definition of Done

- `npm run test` และ `npm run build` ผ่านจาก clean install
- 4 user flows และ responsive/accessibility checks ผ่าน
- API endpoints, payloads, responses, token key และ polling cadence ไม่เปลี่ยน
- backend และ hospital dashboard ไม่มี diff
- ผู้ใช้ review และอนุมัติแผนก่อนเริ่ม implement
