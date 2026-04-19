# Praxis

Financial calculators and utilities. Fast, private, no login required.

## Tools

- **DCF Modeler** — Discounted cash flow valuation with multi-scenario analysis and sensitivity tables
- **Engagement Economics** — Budget planning, ETC tracking, NSR, ANSR, EAF, margin, and NUI monitoring
- **Lease Accounting** — IFRS 16 and ASC 842 lease liability and right-of-use asset schedules
- **SaaS Scenario Planner** — ARR, MRR, churn, LTV, CAC — model unit economics across scenarios
- **VaultMerge** — Merge Brave browser passwords into a Vaultwarden export (runs entirely in-browser)

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview production build
```

## Architecture

```
src/
├── App.jsx              # Router
├── Home.jsx             # Homepage card grid
├── shared.jsx           # Tokens, icons, formatting utils
├── styles.css           # Design system (single source of truth)
├── components/          # Reusable UI blocks
│   ├── ToolShell.jsx    # Sidebar + content layout
│   ├── KpiCard.jsx      # Metric display with delta badge
│   ├── DataTable.jsx    # Financial data table
│   ├── FormControls.jsx # Input, Select, Segment, Section, Btn
│   └── Navbar.jsx       # Frosted breadcrumb bar
└── tools/               # One file per tool (logic only)
    ├── DcfModeler.jsx
    ├── EngEconomics.jsx
    ├── LeaseCalc.jsx
    ├── SaasPlanner.jsx
    └── VaultMerge.jsx
```

### Design change layers

| Layer | Files | What changes |
|-------|-------|-------------|
| **Tokens** | `styles.css`, `shared.jsx` | Colors, fonts, spacing, shadows |
| **Components** | `components/` | Layout patterns, UI blocks |
| **Tools** | `tools/` | Business logic only — never for design |

A full design overhaul touches layers 1–2. Tool files stay untouched.

## License

MIT
