# 🐾 Sit-Here — Windows 97 Dog Walking MVP

A fully functional dog walking marketplace app with a locked-in Windows 97 retro aesthetic, built as a React web prototype ready for production deployment and eventual iOS/SwiftUI translation.

![Windows 97 Theme](https://img.shields.io/badge/Theme-Windows%2097-008080?style=flat-square)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.1-38B2AC?style=flat-square&logo=tailwind-css)

## 🚀 Live Demo

**Deploy to Vercel:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sentient-llm/2Sit-Here)

## ✨ Features

### For Dog Owners 🐕
- **Schedule Walks**: 4-step booking flow with walker directory, date/time picker, and checkout
- **Live GPS Tracking**: Real-time map showing walker's location during active walks (5s polling)
- **Report Cards**: Receive detailed walk summaries with mood, potty breaks, distance, notes
- **Rating System**: Rate your walker 1-5 stars after each walk
- **Chat**: Real-time messaging with your assigned walker
- **Vet Finder**: Emergency vet directory with 24/7 listings and call-to-action buttons

### For Dog Walkers 🦮
- **Dashboard**: Accept/decline booking requests, view upcoming walks
- **Live Walk Mode**: GPS broadcasting every 30s with distance/time tracking
- **Submit Reports**: Post-walk report card submission with detailed walk data
- **Earnings Tracker**: Daily/weekly/monthly earnings dashboard with walk history
- **Chat**: Direct messaging with dog owners
- **Availability Toggle**: Set status (Available / On Walk / Off Duty)

### Tech Highlights 💻
- **Windows 97 UI**: Teal desktop, navy title bars, 3D beveled borders, VT323 pixel font, Start Menu, BSOD error screens
- **Supabase Backend**: 13 KV endpoints for walks, profiles, chat, reports, notifications, live GPS
- **Auth Flow**: Sign up/sign in with Supabase Auth (JWT sessions, auto email confirmation)
- **Mobile-First**: Responsive design optimized for 375px+ viewports
- **Launch Checklist**: Built-in MVP control center with live API test runner and QA sign-off tracker

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript |
| **Routing** | React Router 7.13 |
| **Styling** | Tailwind CSS v4.1 |
| **Backend** | Supabase Edge Functions (Hono + Deno) |
| **Database** | Supabase KV Store |
| **Auth** | Supabase Auth (JWT) |
| **Maps** | MapLibre GL (react-map-gl) |
| **Build** | Vite 6.3 |
| **Deploy** | Vercel (configured) |

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/sentient-llm/2Sit-Here.git
cd 2Sit-Here

# Install dependencies
pnpm install

# The app is configured to run in Figma Make environment
# For local development, you'll need to set up Supabase:
# 1. Create a Supabase project at https://supabase.com
# 2. Deploy /supabase/functions/server to your Supabase project
# 3. Update /utils/supabase/info.tsx with your project credentials
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push this repo to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Deploy (config in `vercel.json` is pre-configured)
4. Your app goes live at `https://your-project.vercel.app`

### Netlify
1. Run `pnpm build`
2. Drag `/dist` folder to [app.netlify.com/drop](https://app.netlify.com/drop)
3. Add `_redirects` file: `/* /index.html 200`

### Cloudflare Pages
1. Connect GitHub repo at [pages.cloudflare.com](https://pages.cloudflare.com)
2. Build command: `pnpm build`
3. Output directory: `dist/`

## 📁 Project Structure

```
2Sit-Here/
├── src/
│   ├── app/
│   │   ├── App.tsx              # Root component
│   │   ├── Root.tsx             # Desktop shell (Start Menu, taskbar, icons)
│   │   ├── routes.tsx           # React Router config
│   │   ├── components/
│   │   │   ├── Win97Window.tsx  # Windows 97 UI components
│   │   │   ├── ErrorBoundary.tsx # BSOD error screens
│   │   │   └── ui/              # Radix UI components
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Supabase auth state
│   │   ├── pages/
│   │   │   ├── owner/           # Dog owner pages
│   │   │   ├── walker/          # Dog walker pages
│   │   │   ├── LaunchChecklist.tsx # MVP control center
│   │   │   └── Login.tsx        # Auth page
│   │   ├── lib/
│   │   │   ├── api.ts           # API client with auto-refresh JWT
│   │   │   └── supabase.ts      # Supabase client
│   │   └── data/
│   │       ├── mockData.ts      # Demo walkers/vets for empty states
│   │       └── walkStore.ts     # In-memory walk session state
│   └── styles/
│       ├── index.css            # Global styles
│       ├── theme.css            # Tailwind theme tokens
│       └── fonts.css            # VT323 pixel font
├── supabase/
│   └── functions/
│       └── server/
│           ├── index.tsx        # Hono web server (13 endpoints)
│           └── kv_store.tsx     # KV database utilities
├── utils/
│   └── supabase/
│       └── info.tsx             # Supabase project credentials
├── vercel.json                  # Vercel SPA config + security headers
├── vite.config.ts               # Vite build config
└── package.json                 # Dependencies
```

## 🎯 API Endpoints

All endpoints are prefixed with `/make-server-f29bc816/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/signup` | POST | Create new user (owner/walker) |
| `/dog-profile` | GET/POST | Owner's dog profile |
| `/walker-profile` | GET/POST | Walker profile |
| `/walker-directory` | GET | Public walker listing |
| `/walker-availability` | GET/PUT | Walker status toggle |
| `/walks` | GET/POST | Owner bookings |
| `/walks/cancel` | POST | Cancel booking |
| `/walks/status` | PUT | Update walk status (walker) |
| `/walker-walks` | GET | Walker assignments |
| `/walk-live-position` | GET/PUT/DELETE | Live GPS broadcast |
| `/reports` | GET/POST | Report cards |
| `/owner-rating` | PUT | Rate walker |
| `/messages` | GET/POST | Chat messages |
| `/notifications` | GET | User notifications |
| `/notifications/read` | PUT | Mark notifications read |
| `/walker-stats` | GET | Earnings dashboard data |

## 🎨 Design System

The Windows 97 theme is locked and consistent across all screens:

- **Colors**: Teal desktop (`#008080`), navy titlebar (`#000080`), gray panels (`#C0C0C0`)
- **Typography**: VT323 monospace pixel font for headers, MS Sans Serif for body
- **Borders**: 3D beveled edges with highlight/shadow (`border-top: #FFF, border-bottom: #808080`)
- **Icons**: Emoji-based (🐾 🦮 📅 💬 📋 🏥)
- **Sounds**: None (silent retro aesthetic)

## 📋 MVP Scope (v1.0)

### ✅ Shipping Now
- [x] Auth (sign up/sign in/sign out)
- [x] Schedule walk (4-step flow with mock payment)
- [x] Live GPS tracking
- [x] Report cards with ratings
- [x] Real-time chat
- [x] Vet finder (static data)
- [x] Notifications (in-app badge)
- [x] Walker earnings dashboard
- [x] Windows 97 UI theme
- [x] Mobile-responsive design

### ⏳ Post-MVP (v1.1+)
- [ ] Stripe payments integration
- [ ] Photo uploads (Supabase Storage)
- [ ] Web Push notifications
- [ ] Google Maps API for vet search
- [ ] Recurring walk schedules
- [ ] Walker background checks (Checkr API)

### 🔜 Future (v2.0)
- [ ] iOS app (SwiftUI + same Supabase backend)
- [ ] Android app (Kotlin)
- [ ] Public marketplace mode
- [ ] Geosearch for walkers
- [ ] Bidding system

## 🧪 Testing

Built-in **Launch Checklist** page (`/launch`) includes:

- **API Test Suite**: Live tests for all 13 endpoints with pass/fail results
- **QA Checklist**: 28-item manual sign-off list (persisted to localStorage)
- **Deployment Guide**: Step-by-step Vercel/Netlify/Cloudflare instructions
- **Readiness Score**: Combined metric (API tests + QA) with go/no-go indicator

Access at: `http://localhost:5173/launch` (or `/launch` on deployed app)

## 🔒 Security

- **CORS**: Open headers for web access (configured in server)
- **Auth**: JWT tokens with auto-refresh (60s expiry check)
- **Secrets**: Service role key never exposed to frontend
- **Headers**: Content Security Policy via `vercel.json`
- **Input**: No SQL injection risk (KV store, not SQL)

## 🤝 Contributing

This is a MVP prototype. For production use:

1. **Replace mock payment** with real Stripe integration
2. **Add vet API** (Google Places or Yelp Fusion)
3. **Enable photo uploads** (Supabase Storage bucket already configured)
4. **Set up email server** for Supabase Auth (currently `email_confirm: true` auto-confirms)
5. **Add analytics** (PostHog, Mixpanel, or Segment)

## 📄 License

MIT © 2026 Sit-Here Team

## 🙏 Acknowledgments

Built with [Figma Make](https://figma.com) and Claude Code. Powered by:
- [Supabase](https://supabase.com) - Backend infrastructure
- [Vercel](https://vercel.com) - Deployment platform
- [Tailwind CSS](https://tailwindcss.com) - Styling framework
- Windows 97 - Design inspiration 💾

---

**Made with 🐾 by [@sentient-llm](https://github.com/sentient-llm)**
