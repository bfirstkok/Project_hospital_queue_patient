# Frontend architecture

## Start here

The application is a single patient portal implemented with Next.js App Router. `src/app/page.tsx` owns navigation between the client-side views without changing the URL used by the hospital QR code.

```text
src/app/page.tsx
├─ registration    → src/features/registration/      (today's symptom + book a queue)
├─ patient profile → src/features/patient-profile/   (name/health/address/emergency — shared form)
├─ login/PIN       → src/features/auth/
├─ queue           → src/features/queue/
├─ account         → src/features/account/
└─ settings        → src/features/settings/
```

`src/features/patient-profile/PatientProfileForm.tsx` is the single source of the patient
intake fields. It is rendered both by `registration` (new patient) and by `account` (edit
profile) — do not re-inline those fields anywhere else.

Login is national-ID only today and the PIN is client-side (localStorage) as a stopgap.
The current backend contract is [BACKEND_API_SPEC.md](BACKEND_API_SPEC.md); the server-side
PIN + email/OTP recovery that the backend team needs to build is
[BACKEND_HANDOFF.md](BACKEND_HANDOFF.md). ThaID login was removed.

## Responsibilities

- `src/app/`: Next.js layout, page orchestration, metadata, and global CSS.
- `src/features/<name>/`: One user flow and its colocated tests. Feature-only hooks stay here.
- `src/shared/api/`: The four backend endpoints and their TypeScript contracts.
- `src/shared/auth/`: The browser access-token storage boundary.
- `src/shared/config/`: Reads `public/runtime-config.js` at runtime.
- `src/shared/ui/`: UI used across more than one feature.

## Dependency direction

```text
app → features → shared
```

Shared code must not import from a feature. Features may not import from each other; `src/app/page.tsx` coordinates them.

## Adding or changing a feature

1. Add UI and feature-only logic under `src/features/<feature>/`.
2. Keep its tests beside the implementation as `*.test.ts` or `*.test.tsx`.
3. Add shared code only after at least two features need it.
4. Keep backend calls in `src/shared/api/patient-api.ts` and update `types.ts` from the real API contract.
5. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Contracts that must remain stable

- Backend endpoints are listed in `README.md`.
- Access token key: `hospital_patient_access_token`.
- Queue refresh defaults to `10000` ms and is configurable at runtime.
- The backend and hospital dashboard are separate systems; do not add proxy routes or server actions without an explicit architecture change.
