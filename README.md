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
[ Next.js 15 Edge App Router & API Handlers (/api/incidents, /api/gating, /api/machinery) ]
                                   │
           ┌───────────────────────┴───────────────────────┐
           ▼                                               ▼
[ Core Intelligence Gating Engine ]              [ Client-Side Resilience Engine ]
  • Deterministic Spatial Intersect                • Leaflet GIS Vector Canvas
  • Restoral SLA Dynamic Calculator                • LocalStorage / IndexedDB Vector Cache
  • Single-DLO Relational Invariant                • Cryptographic QR Signer & Decoder
           │
           ▼
[ Supabase PostgreSQL 15 + PostGIS Spatial Engine (CDC Realtime Pub/Sub) ]

Frontend: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React, Leaflet GIS[cite: 2]

Backend: Next.js Serverless API Handlers, PostgreSQL 15, PostGIS Spatial Extensions[cite: 2]

Realtime Protocol: Supabase Realtime CDC (Change Data Capture over WebSockets)[cite: 2]

Geospatial Processing: PostGIS ST_Intersects, ST_Buffer, GeoJSON Polygonal Boundaries[cite: 2]

Hosting: Vercel Edge Network

📂 Project Repository Structure
Plaintext
```
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
│  │  │  │  └─ page.js
│  │  │  └─ login
│  │  │     └─ page.js
│  │  ├─ api
│  │  │  ├─ admin
│  │  │  │  ├─ approvals
│  │  │  │  │  └─ route.js
│  │  │  │  ├─ district-roads
│  │  │  │  │  └─ route.js
│  │  │  │  ├─ provision-officer
│  │  │  │  │  └─ route.js
│  │  │  │  └─ requisitions
│  │  │  │     └─ route.js
│  │  │  ├─ analytics
│  │  │  │  └─ district
│  │  │  │     └─ route.js
│  │  │  ├─ districts
│  │  │  │  └─ list
│  │  │  │     └─ route.js
│  │  │  ├─ incidents
│  │  │  │  └─ route.js
│  │  │  ├─ ingest
│  │  │  │  ├─ district-exact
│  │  │  │  │  └─ route.js
│  │  │  │  ├─ districts
│  │  │  │  │  └─ route.js
│  │  │  │  ├─ highways
│  │  │  │  │  └─ route.js
│  │  │  │  └─ roads
│  │  │  │     ├─ refresh-weather
│  │  │  │     │  └─ route.js
│  │  │  │     └─ route.js
│  │  │  ├─ manifests
│  │  │  │  └─ route.js
│  │  │  ├─ risk
│  │  │  │  └─ evaluate
│  │  │  │     └─ route.js
│  │  │  ├─ risk-assessment
│  │  │  │  └─ route.js
│  │  │  ├─ routing
│  │  │  │  └─ navigate
│  │  │  │     └─ route.js
│  │  │  └─ seed-users
│  │  │     └─ route.js
│  │  ├─ auth
│  │  │  ├─ dlo-login
│  │  │  │  └─ page.js
│  │  │  ├─ login
│  │  │  │  └─ page.js
│  │  │  ├─ officer-login
│  │  │  │  └─ page.js
│  │  │  └─ page.js
│  │  ├─ dashboard
│  │  │  ├─ admin
│  │  │  │  └─ page.js
│  │  │  ├─ dlo
│  │  │  │  └─ page.js
│  │  │  └─ field
│  │  │     └─ page.js
│  │  ├─ dlo
│  │  │  └─ dashboard
│  │  │     └─ page.js
│  │  ├─ favicon.ico
│  │  ├─ fonts
│  │  │  ├─ GeistMonoVF.woff
│  │  │  └─ GeistVF.woff
│  │  ├─ globals.css
│  │  ├─ layout.js
│  │  ├─ officer
│  │  │  └─ dashboard
│  │  │     └─ page.js
│  │  ├─ page.js
│  │  └─ verify-manifest
│  │     └─ page.js
│  ├─ components
│  │  ├─ DistrictMap.js
│  │  ├─ emblems
│  │  │  └─ NationalEmblem.js
│  │  ├─ GisMap.js
│  │  ├─ GovBanner.js
│  │  ├─ GovFooter.js
│  │  ├─ GovHeader.js
│  │  ├─ LocationPickerMap.js
│  │  ├─ ManifestArchiveModal.js
│  │  ├─ Navbar.js
│  │  ├─ OfficerManifestArchiveModal.js
│  │  ├─ RiskEngineSync.js
│  │  └─ TransitManifestModal.js
│  ├─ middleware.js
│  └─ utils
│     ├─ audioAlert.js
│     ├─ auth.js
│     ├─ offlineQueue.js
│     └─ supabase.js
└─ tailwind.config.js

```

---

## 🚀 Quickstart & Local Setup
1. Prerequisites
Node.js >= 18.18.0

npm / pnpm / yarn

Supabase project with PostGIS extension enabled

2. Clone and Install
Bash
git clone [https://github.com/sohampycode-hub/setu-ner.git](https://github.com/sohampycode-hub/setu-ner.git)
cd setu-ner
npm install
3. Environment Configuration
Create a .env.local file in the root directory:

```text

Bash
cp .env.example .env.local
Fill in your credentials:

Code snippet
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

```

4. Database Setup & Migrations
Run the SQL migration in supabase/migrations/ inside your Supabase SQL editor to initialize tables, PostGIS indexes, and real-time CDC channels.

5. Start the Development Server
Bash
npm run dev
Open http://localhost:3000 in your browser.

🔒 Security & Data Governance
Role-Based Access Control (RBAC): Supabase Row-Level Security (RLS) protects write endpoints across Field Patrol, DLO, and Ministry Apex desks.

Cryptographic Tamper-Resistance: Verification tokens are generated using dynamic cryptographic hashing, verifiable without administrative exposure at checkpoints.

Zero Vendor Lock-in: Built entirely on open GIS standards (PostGIS, GeoJSON, OSM Overpass), saving institutional expenditure compared to proprietary commercial licenses[cite: 2].

👥 Development Team (Team LogixHub)
Institution: Maulana Abul Kalam Azad University of Technology (MAKAUT), West Bengal

Production URL: https://setu-ner.vercel.app/

📄 License
This project is licensed under the MIT License — see the LICENSE file for details.


---
