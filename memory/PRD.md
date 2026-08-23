# OrthoVault — Product Requirements

<!-- v9: (1) Backend split into modules: config.py, db.py, deps.py, models.py, storage.py, emailing.py, routes/{auth,patients,files,ai}.py — server.py is now a slim assembly. (2) Emergent Resend integration for invite emails: guardrail gate + server-side template + POST /api/auth/invites returns `emailed` flag. (3) Bulk invite endpoint POST /api/auth/invites/bulk (up to 100 emails, dedupes, reports invalid/updated/emailed). (4) Idle Watch: 30+ day idle members get a subtle IDLE badge on the Team screen. -->
<!-- v8: Added Invite by Email + Team Activity Log. Admins can pre-authorize colleagues by email/role, copy a ready-to-share sign-in link, revoke pending invites, and see each member's "Active X ago" timestamp. -->


## Purpose
OrthoVault is a HIPAA-mindful mobile app for Orthopedic Surgeons to securely store & manage patient clinical records, X-rays/scans, PDFs, DOCX reports, and clinical videos (gait, ROM, arthroscopy).

## Users
- Orthopedic Surgeons (single-user per device, PIN + biometric protected)

## Core Features Implemented (v1.0)
### Auth
- Removed — app opens directly to the Dashboard (per user request)

### Patient Records (CRUD)
- Fields: Name, Age, Sex (Male/Female/Other), Country Code + Mobile, Chief-Complaint History, Date of Surgery (DatePicker), Result / Outcome
- Media attachments: Pre-operative, Post-operative, Videos — multi-file
- Accepted formats: Images (jpg/png/heic), PDFs, DOC/DOCX, DICOM (as attachment), Videos (mp4/mov)

### Dashboard
- Global search bar (Name, Mobile, or History/Diagnosis)
- 13 dynamic sort chips (Newest/Oldest Surgery, Name A–Z / Z–A, Age Asc/Desc, Sex, Mobile #, History A–Z, Most Pre-op, Most Post-op, Result A–Z, With Video)
- Patient cards with demographics + Pre/Post X-ray thumbnail stack
- Floating "+ Add Patient" FAB

### Patient Detail
- Sticky header (Name, Age, Sex, Mobile, DOS)
- 5 tabs: Info, History, Compare, Results, Video
- Compare tab: split-screen Pre-op vs Post-op X-ray on black light-box background
- Tap image → full-screen viewer with pinch-to-zoom, double-tap reset, pan
- PDF/DOC → opens in system browser via expo-web-browser
- Video → in-line native player (expo-video)

### Settings
- Light / Dark / System theme
- Biometric toggle
- Change PIN
- Cloud sync status (backend MongoDB — ACTIVE)
- Google Drive backup (marked "Coming soon")

## Tech
- Frontend: Expo SDK 54, expo-router, react-native-gesture-handler, expo-video, expo-image-picker, expo-document-picker, expo-local-authentication, expo-secure-store
- Backend: FastAPI + MongoDB (Motor), Emergent Managed Object Storage for file blobs
- All files uploaded via `/api/upload` → served via `/api/files/{path}`
- Patient CRUD via `/api/patients`

## Design
- Clinical slate/teal palette (Brand: `#0F766E` light / `#14B8A6` dark)
- WCAG AA contrast for surgical-light readability
- No emojis — Ionicons only

## Deferred / Not in MVP
- Google Drive backup (UI placeholder present, marked "Coming soon")
- Full DICOM rendering (DICOM files accepted as attachments, viewed via external app)
- Offline queue for sync (currently backend is source of truth)
