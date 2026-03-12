# Travvip CRM

A full-featured Travel CRM built with Next.js 14 and Supabase.

## Features

- Multi-tenant organization management
- Role-based access control (Super Admin, Org Admin, Agent)
- Query management with itinerary builder
- PDF generation for travel itineraries
- Email notifications on organization approval/rejection
- Hotels, packages, activities, routes, and transport management

## Tech Stack

- **Frontend & Backend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS + Shadcn/UI
- **PDF Generation**: Playwright

## Quick Start

### Prerequisites

- Node.js 18+ (recommended: 20+)
- Yarn or npm
- Supabase account

### Environment Variables

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: Email notifications
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Installation

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

### Deployment

#### Vercel (Recommended)

1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

#### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

#### Self-hosted

```bash
yarn build
yarn start
```

## Project Structure

```
├── app/
│   ├── api/                 # API routes (all backend logic)
│   │   └── [[...path]]/     # Catch-all API handler
│   ├── (auth)/              # Auth pages (login, register)
│   └── (dashboard)/         # Dashboard pages
├── components/              # React components
│   └── ui/                  # Shadcn UI components
├── contexts/                # React contexts (Auth, Data)
├── lib/                     # Utilities and helpers
│   ├── supabase.js          # Supabase client
│   ├── pdfTemplate.js       # PDF template generator
│   └── api-helpers.js       # API utilities
└── public/                  # Static assets
```

## API Endpoints

All API routes are handled by `/api/[[...path]]/route.js`:

- `GET/POST /api/queries` - Query management
- `GET/POST /api/hotels` - Hotel management
- `GET/POST /api/packages` - Package management
- `GET/POST /api/activities` - Activity management
- `GET/PUT /api/organization` - Organization settings
- `POST /api/pdf/generate` - PDF generation
- `GET /api/tenant-organizations` - Multi-tenant management

## Test Credentials

- **Super Admin**: newadmin@travelcrm.com / TravelCRM2025!

## License

MIT
