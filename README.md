This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set a unique `BETTER_AUTH_SECRET` (at least 32 characters). Add Stripe values only if testing billing.
3. Start PostgreSQL using Docker Compose: `docker compose up -d`.
4. Apply the shared schema: `npm run db:migrate`.
5. Start Next.js: `npm run dev` and open [http://localhost:3000](http://localhost:3000).

If Docker is unavailable, run PostgreSQL 16+ locally and set `DATABASE_URL` to that database. Keep local and production schemas in sync by committing Drizzle migrations under `db/migrations/`.

### Railway deployment

Create a Railway PostgreSQL service, then configure the web service with `DATABASE_URL` from the Postgres service, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and the required Stripe variables. Run `npm run db:migrate` against Railway before deploying the application. Use Railway's private/internal database URL when the web service is on the same Railway project; use the public URL only when required, with TLS enabled.

Better Auth stores password hashes and sessions in PostgreSQL. Existing Supabase users, password hashes, data, and sessions are not automatically copied by this setup; plan and verify a separate export/import and password reset or credential migration before cutover.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
