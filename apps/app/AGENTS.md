# app (TanStack Router) — rules

TanStack Router, Vite + React 19. Tailwind + shadcn/ui. Feature-based architecture.

## Imports & Modularity

- A feature is a self-contained module in `src/features/<feature-name>/`: imports **within the same feature** use relative paths (`./`, `../`); imports of the **shared layer** use the `@/` alias.
- A feature imports the shared layer (`@/utils`, `@/lib`, `@/hooks`, `@/services`, `@/components/*`), never another feature.
- The shared layer never imports a feature.
- `src/routes/` route files stay thin: define route parameters, loaders, metadata heads, and mount the feature page component and necessary providers only.
- Each feature exports its public pages, components, and types via its root `index.ts`.

## Feature Structure & Decomposition

- **One component per file — no exceptions.** A file exports exactly one component, even when the extra one is small. Each component moves to its own file named after it (PascalCase with feature prefix), and imports are updated.
- Keep components small and single-purpose. Split when one mixes concerns (layout + fetch + mutation + dialog). The entry page component is a clean composition; each sub-part lives in its own file under `components/`. Push state down to where it is used; the parent holds only what it coordinates.
- A feature's own parts go in purpose folders: `components/`, `hooks/`, `context/`, `services/`, `utils/`.
  - A feature with multiple pages or complex sub-flows groups its components by page or sub-domain (e.g. `components/overview/`, `components/rtl-readiness/`).
- Component files use the feature name as a PascalCase prefix (`DashboardProjectsPage.tsx`, `AuthSignInPage.tsx`, `EditorSidebarResizer.tsx`, `SiteChrome.tsx`, `MarketingPricingPage.tsx`). File name = exported component name.
- Domain service files carry a `.service.ts` suffix (`projects.service.ts`, `documents.service.ts`, `sites.service.ts`, `analytics.service.ts`).
- Types live next to the code that produces them (API-response types in service, prop interfaces exported alongside components).

## Services & Query Keys

- Centralized query keys live in `src/services/queryKeys.ts`.
- Domain service hooks live in `src/services/<domain>.service.ts` and delegate to query keys and API clients.

## Design & RTL

- The layout supports bidirectional rendering (LTR and RTL Arabic). Use logical CSS utilities (`ms-`/`me-`, `ps-`/`pe-`, `text-start`/`text-end`, `border-s-`/`border-e-`) rather than physical left/right rules whenever text direction matters.
