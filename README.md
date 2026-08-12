# Hospital Queue Patient Portal

Patient-facing OPD queue portal built with Next.js App Router and TypeScript. It keeps the existing hospital backend contract unchanged.

## Requirements

- Node.js 20.9 or newer

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run the static build

The backend currently allows the patient portal origin at `http://127.0.0.1:5500`. Build and serve the exported site with:

```powershell
$env:PATIENT_API_BASE_URL="https://hospital.bfirstkok.me"
npm run build

cd dist
python -m http.server 5500 --bind 127.0.0.1
```

Open `http://127.0.0.1:5500`. Stop the server with `Ctrl+C`.

## Project structure

```text
src/
├─ app/                 Next.js entrypoint and global styles
├─ features/            Patient-facing flows, grouped by feature
│  ├─ account/
│  ├─ auth/
│  ├─ queue/
│  └─ registration/
└─ shared/              Code reused by multiple features
   ├─ api/              Backend contract, types, and fetch client
   ├─ auth/             Browser token storage
   ├─ config/           Runtime environment configuration
   └─ ui/               Shared layout components
```

Tests live next to the source file they cover. Import application code through the `@/` alias. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding a feature.

## Runtime configuration

The client reads `window.PATIENT_APP_ENV` from `public/runtime-config.js` before the interactive UI starts.

For a production build, set the values below. The build writes `public/runtime-config.js`; do not commit a deployment-specific URL.

```powershell
$env:PATIENT_API_BASE_URL="https://hospital.bfirstkok.me"
$env:PATIENT_STATUS_REFRESH_MS="10000"
npm run build
```

`PATIENT_API_BASE_URL` must use HTTPS except for `localhost` or `127.0.0.1`. Copy [.env.example](.env.example) as a reference for local deployment settings.

## Verification

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

## Backend contract retained

- `POST /api/patient/register/`
- `POST /api/patient/login/`
- `GET /api/patient/me/`
- `GET /api/patient/queue/`
- Browser storage key: `hospital_patient_access_token`
- Queue refresh: `STATUS_REFRESH_MS`, default `10000` ms

No Next.js API route is used. The hospital backend and dashboard are outside this repository and are not modified.
