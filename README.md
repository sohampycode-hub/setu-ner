# SETU-NER (सेतु-NER)

> **Sovereign Disaster Logistics & Dynamic Accessibility Intelligence Platform for North East India**  
> *Developed for Smart India Hackathon (SIH) 2026 • Problem Statement: SIH26002 • Category: Software*

[![Production Deployment](https://img.shields.io/badge/Deployment-Live%20on%20Vercel-success?style=flat-square&logo=vercel)](https://setu-ner.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/PostgreSQL-15%20%2B%20PostGIS-336791?style=flat-square&logo=postgresql)](https://postgis.net/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 📌 Executive Summary

Arterial highways across the North Eastern Region (NER)—such as the vital Siliguri Corridor and NH-10—frequently experience catastrophic disruptions caused by landslides, flash floods, and seismic shifts. Standard navigation tools often fail in disaster operations because they conflate unresolved bottlenecks with historical detours and lack deterministic route-closure enforcement.

**SETU-NER** is an operational logistics and spatial gating engine built for **MDoNER, NDMA, and state DDMAs**. It enforces programmatic highway closures, synchronizes cross-district heavy earthmoving assets, and enables air-gapped checkpoint validation during cellular backhaul collapses.

---

## ⚡ Core Technical Innovations

1. **Deterministic Hazard Collision Gating**  
   Intercepts transit permit requisitions before departure. If a corridor contains a verified active landslide, the engine dynamically tags the manifest with `TRANSIT PROHIBITED`, halting non-emergency vehicular convoys while preserving Apex emergency overrides.
2. **Decoupled Real-Time Vector Cartography**  
   Renders over 8,000 national highway vectors purely client-side via Leaflet GIS and PostGIS. Resolved incidents clear dynamically from spatial index structures, preventing outdated phantom detours.
3. **Inter-District Machinery Telemetry (Single-DLO Invariant)**  
   Synchronizes heavy excavation assets (JCBs, Bailey bridge components) across adjacent district disaster desks via Supabase Realtime Change Data Capture (CDC) with sub-50ms fanout latency.
4. **Air-Gapped Offline Caching & Cryptographic Verification**  
   Maintains interactive vector navigation in `OFFLINE MODE` via IndexedDB/localStorage during total cellular blackouts. Generates tamper-evident dynamic SVG QR transit passes audited at border sentry checkposts via an unauthenticated verification endpoint (`/verify-manifest`).

---

## 🛠️ System Architecture & Technology Stack

```text
[ External Telemetry: Open-Meteo API | OSM Overpass Highway Vectors | NDMA Directives ]
                                   │
                                   ▼
[ Next.js 15 Edge App Router & API Handlers (/api/incidents, /api/risk, /api/manifests) ]
                                   │
           ┌───────────────────────┴───────────────────────┐
           ▼                                               ▼
[ Core Intelligence Gating Engine ]              [ Client-Side Resilience Engine ]
  • Deterministic Spatial Intersect                • Leaflet GIS Vector Canvas (GisMap.js)
  • Dynamic Route Risk Evaluator                   • Offline Storage Queue (offlineQueue.js)
  • Single-DLO Relational Invariant                • Cryptographic QR Signer & Decoder
           │
           ▼
[ Supabase PostgreSQL 15 + PostGIS Spatial Engine (CDC Realtime Pub/Sub) ]

```

* **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS, Leaflet GIS
* **Backend:** Next.js Serverless API Handlers, PostgreSQL 15, PostGIS Spatial Extensions
* **Realtime Protocol:** Supabase Realtime CDC (Change Data Capture over WebSockets)
* **Geospatial Processing:** PostGIS `ST_Intersects`, `ST_Buffer`, GeoJSON District & Corridor Geometries
* **Hosting:** Vercel Edge Network

---

## 📂 Project Repository Structure

```text
logixhub
├─ .eslintrc.json
├─ jsconfig.json
├─ LICENSE
├─ next.config.mjs
├─ package-lock.json
├─ package.json
├─ postcss.config.mjs
├─ README.md
├─ src
│  ├─ app
│  │  ├─ admin
│  │  │  ├─ dashboard
│  │  │  │  └─ page.js              # Ministry Apex / Administrative oversight & SLAs
│  │  │  └─ login
│  │  │     └─ page.js              # Administrative authentication desk
│  │  ├─ api
│  │  │  ├─ admin
│  │  │  │  ├─ approvals            # Apex corridor & administrative approval pipeline
│  │  │  │  ├─ district-roads       # District-level road state APIs
│  │  │  │  ├─ provision-officer    # Field sentry & officer credential provisioning
│  │  │  │  └─ requisitions         # Inter-district heavy asset allocation endpoints
│  │  │  ├─ analytics
│  │  │  │  └─ district             # District-specific spatial risk analytics
│  │  │  ├─ districts
│  │  │  │  └─ list                 # North Eastern district registry & boundaries
│  │  │  ├─ incidents               # Real-time incident reporting & lifecycle CRUD
│  │  │  ├─ ingest
│  │  │  │  ├─ district-exact       # High-precision territorial ingest
│  │  │  │  ├─ districts            # Boundary shapefile & GeoJSON ingestion
│  │  │  │  ├─ highways             # OSM Overpass national highway vector ingestion
│  │  │  │  └─ roads
│  │  │  │     ├─ refresh-weather   # Open-Meteo real-time atmospheric sync
│  │  │  │     └─ route.js          # Road segment status & geometry queries
│  │  │  ├─ manifests               # Dynamic cryptographic transit manifest issuance
│  │  │  ├─ risk
│  │  │  │  └─ evaluate             # Dynamic corridor risk calculation engine
│  │  │  ├─ risk-assessment         # Geodetic threat scoring & slope stability
│  │  │  ├─ routing
│  │  │  │  └─ navigate             # Gated spatial pathfinding & detour logic
│  │  │  └─ seed-users              # Initial RBAC fixture bootstrapping
│  │  ├─ auth
│  │  │  ├─ dlo-login               # District Logistics Officer authentication
│  │  │  ├─ login                   # Unified role-based access portal
│  │  │  ├─ officer-login           # Sentry / Field Patrol login portal
│  │  │  └─ page.js                 # Authentication directory index
│  │  ├─ dashboard
│  │  │  ├─ admin                   # Ministry Apex Strategic Console
│  │  │  ├─ dlo                     # District Logistics Officer machinery desk
│  │  │  └─ field                   # Field Patrol inspection dashboard
│  │  ├─ dlo
│  │  │  └─ dashboard               # Direct DLO corridor restoral & stockpile desk
│  │  ├─ officer
│  │  │  └─ dashboard               # Ground verification & sentry route gating
│  │  ├─ verify-manifest            # Public unauthenticated sentry QR checkpost portal
│  │  ├─ layout.js                  # Root application layout & Gov header/footer wrappers
│  │  ├─ page.js                    # Live GIS Radar, highway polylines & citizen portal
│  │  ├─ globals.css                # Global styles & Tailwind CSS utility layers
│  │  └─ favicon.ico                # Platform browser icon
│  ├─ components
│  │  ├─ DistrictMap.js             # Focused district territorial GIS component
│  │  ├─ emblems
│  │  │  └─ NationalEmblem.js       # Statutory Indian emblem vector components
│  │  ├─ GisMap.js                  # Core Leaflet vector cartography & corridor renderer
│  │  ├─ GovBanner.js               # Statutory institutional government header banner
│  │  ├─ GovFooter.js               # Standard institutional footer & compliance notes
│  │  ├─ GovHeader.js               # Ministry navigation & accessibility bar
│  │  ├─ LocationPickerMap.js       # Geotagged coordinate selection modal
│  │  ├─ ManifestArchiveModal.js    # Historical transit pass record explorer
│  │  ├─ Navbar.js                  # Role-based portal navigation & live telemetry status
│  │  ├─ OfficerManifestArchiveModal.js # Field officer transit slip inspection modal
│  │  ├─ RiskEngineSync.js          # Real-time WebSocket / CDC threat sync listener
│  │  └─ TransitManifestModal.js    # Dynamic SVG cryptographic pass generator
│  ├─ middleware.js                 # Next.js edge route protection & RBAC guards
│  └─ utils
│     ├─ audioAlert.js              # Critical incident acoustic notification handler
│     ├─ auth.js                   # Client auth session validation & token helpers
│     ├─ offlineQueue.js           # IndexedDB / localStorage offline action queue
│     └─ supabase.js               # Supabase client instantiation & CDC channels
└─ tailwind.config.js               # Tailwind design system & theme tokens

```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites

* Node.js `>= 18.18.0`
* npm / pnpm / yarn
* Supabase project with PostGIS extension enabled

### 2. Clone and Install

```bash
git clone [https://github.com/sohampycode-hub/setu-ner.git](https://github.com/sohampycode-hub/setu-ner.git)
cd setu-ner
npm install

```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local

```

Fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

```

### 4. Database Setup & Migrations

Run the SQL migrations inside your Supabase SQL editor to initialize tables, PostGIS indexes, and real-time CDC channels.

### 5. Start the Development Server

```bash
npm run dev

```

Open [http://localhost:3000](http://localhost:3000?utm_source=gemini) in your browser.

---

## 🔒 Security & Data Governance

* **Role-Based Access Control (RBAC):** Middleware and Supabase Row-Level Security (RLS) protect write endpoints across Field Patrol, DLO, and Ministry Apex desks.
* **Cryptographic Tamper-Resistance:** Verification tokens are generated using dynamic cryptographic hashing, verifiable without administrative exposure at checkpoints.
* **Zero Vendor Lock-in:** Built entirely on open GIS standards (PostGIS, GeoJSON, OSM Overpass), eliminating recurring proprietary licensing fees.

---

## 👥 Development Team (Team LogixHub)

* **Institution:** Maulana Abul Kalam Azad University of Technology (MAKAUT), West Bengal
* **Track:** Smart India Hackathon (SIH) 2026 — Transportation & Logistics (Software)
* **Production URL:** [https://setu-ner.vercel.app/](https://setu-ner.vercel.app/?utm_source=gemini)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](https://www.google.com/search?q=LICENSE&utm_source=gemini) file for details.

```
