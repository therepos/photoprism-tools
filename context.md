# Praxis — Context

## What is this?
A collection of browser-based financial calculators and utilities. No backend, no auth, no database. Everything runs client-side.

## Tech stack
- React 18 + Vite
- No CSS framework — custom design system in `styles.css` + `shared.jsx`
- No routing library — simple state-based routing in `App.jsx`

## Design system
Apple-inspired: system font stack, light #F5F5F7 background, white cards with subtle shadows, generous whitespace. Tokens are defined in two places:
- `src/styles.css` — CSS custom properties (used by global styles)
- `src/shared.jsx` — JS object `T` (used by inline styles in components)

These must stay in sync. If you change a color in one, change it in the other.

## Architecture rules
1. **Tool files never touch CSS.** A tool in `src/tools/` imports shared components, defines its inputs/calculations, and returns JSX. It never declares styles beyond layout-specific inline styles.
2. **Components are generic.** `KpiCard`, `DataTable`, `ToolShell` etc. know nothing about DCF or leases. They accept data and render it.
3. **shared.jsx is the single import.** Tokens, formatters, icons, and the tool manifest all live here. Don't create new utility files — add to `shared.jsx`.

## Adding a new tool
1. Create `src/tools/MyTool.jsx`
2. Import `ToolShell`, `KpiCard`, `DataTable`, `Input`, `Section` etc.
3. Define your state, calculations (in `useMemo`), sidebar inputs, and result display
4. Add a case to `App.jsx` switch
5. Add an entry to `TOOLS` array in `shared.jsx`

## Key components
- `ToolShell` — Every tool page wrapper. Provides navbar + sidebar + content area.
- `KpiCard` — Headline metric with optional delta badge (green/red).
- `DataTable` — Financial table with header row, right-aligned numeric columns, monospace numbers.
- `FormControls` — `Input`, `Select`, `Segment` (Apple-style toggle), `Section`, `Btn`, `InfoBox`.
- `Navbar` — Frosted glass breadcrumb bar with back button and action buttons.
