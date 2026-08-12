# Frontend architecture

## Start here

The application is a single patient portal implemented with Next.js App Router. `src/app/page.tsx` owns navigation between four client-side views without changing the URL used by the hospital QR code.

```text
src/app/page.tsx
├─ registration → src/features/registration/
├─ login        → src/features/auth/
├─ queue        → src/features/queue/
└─ account      → src/features/account/
```

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
