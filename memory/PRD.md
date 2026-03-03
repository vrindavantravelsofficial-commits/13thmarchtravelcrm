# Travvip CRM - Product Requirements Document

## Original Problem Statement
The user wants to prepare a new version of their Next.js application for deployment on a Hostinger VPS KVM 1 server. This involves adding Docker configuration from an older deployed version and implementing various features and bug fixes.

## Core Requirements
1. Make the new application version deployable using Docker
2. Add an "unbook" option on the Operations page
3. Implement detailed lead activity timeline tracking (user actions)
4. Optimize application performance for instant page loading
5. Fix bugs related to PDF generation, data display, and UI layout
6. Add feature to share quotes in text format for WhatsApp
7. Ensure final application is ready for deployment

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend & DB**: Supabase (PostgreSQL, Auth)
- **Deployment**: Docker, Docker Compose
- **State Management**: React Context API with localStorage caching
- **PDF Generation**: Puppeteer
- **Performance**: Optimistic UI updates, caching strategies

## Key Features
- Query/Lead Management
- Quote/Itinerary Builder with PDF export
- Operations Dashboard
- Hotel, Transport, Routes, Activities Management
- Organization Settings
- Multi-tenant support

## Completed Features
- [x] Docker configuration setup
- [x] Unbook service feature
- [x] Enhanced activity logging for lead timeline
- [x] Operations page performance optimization
- [x] App-wide speed improvements (caching, pre-fetching)
- [x] PDF generation optimization
- [x] PDF layout fixes (pricing, headers, footers)
- [x] Share quote as text (WhatsApp integration)

## Current Session - Dec 2025

### Completed
- **WhatsApp Share Text Format Fix**: Fixed the `generateTextFormat` function to:
  - Add travel agency name at the top header
  - Add the user's name who created the quote ("Quote By: [Name]")
  - Use correct organization data from dedicated API endpoint
  - Show actual day-wise itinerary with route titles and activities
  - Fix activities display using correct data structure (`act.name` instead of looking up by `act.activityId`)
  - Properly display hotel and transport selections with saved data

### Code Changes
- `app/(dashboard)/itinerary/[id]/page.js`:
  - Added `user` to `useAuth()` destructuring
  - Added `organization` state to store org data
  - Added organization API fetch in `fetchAllData()`
  - Rewrote `generateTextFormat()` function with proper data flow

## Pending Tasks
- **P1**: Verify lead timeline correctly shows user names for each action
- **P0**: Final deployment to Hostinger VPS KVM 1 server

## Key Files
- `/app/frontend/app/(dashboard)/itinerary/[id]/page.js` - Itinerary builder with PDF export and text sharing
- `/app/frontend/app/(dashboard)/operations/page.js` - Operations dashboard
- `/app/frontend/app/(dashboard)/queries/[id]/page.js` - Query detail page
- `/app/frontend/app/api/pdf/generate/route.js` - PDF generation API
- `/app/frontend/contexts/AuthContext.js` - Authentication context
- `/app/frontend/app/api/[[...path]]/route.js` - Catch-all API handler

## Database Schema (Supabase)
- `queries` - Customer queries/leads
- `itineraries` - Quote versions per query
- `hotels`, `transports`, `routes`, `activities` - Master data
- `organizations` - Travel agency settings
- `users` - User accounts
- `tenant_organizations` - Multi-tenant org data
