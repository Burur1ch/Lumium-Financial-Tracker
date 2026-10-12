<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# How this file works

This file is an instruction source for coding agents.
If an agent loads this repository instructions, it should treat this file as high-priority project guidance.

## Agent workflow expectations

1. Read this file before making code changes.
2. Read project context files listed below.
3. For framework-sensitive changes, verify behavior against local Next.js docs in node_modules/next/dist/docs.
4. Reuse existing project patterns instead of introducing parallel architectures.

## Project context files

- AI_PROJECT_OVERVIEW.md
- AI_FILE_MAP.md

## Coding conventions for this repository

- Keep business logic in server actions (primarily app/dashboard/actions.ts).
- Keep route data fetching in route files under app/dashboard.
- Keep reusable UI in components/dashboard.
- Route all user-facing strings through store/translations.ts.
- Route currency/date display through hooks/useI18n.ts and components/money.tsx.
- Preserve strict TypeScript behavior and avoid weakening types without clear reason.

## Practical notes

- Authentication uses Better Auth sessions; proxy redirects are optimistic, and protected server actions/routes must validate the session.
- Preferences are persisted client-side with Zustand.
- Reports and dashboard widgets depend on period query params and should remain URL-driven.
- If changing auth/data schema assumptions, update related server actions and UI states together.
