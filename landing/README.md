# dtoolkit Landing Page

Landing page for the dtoolkit ecosystem. Built with Astro, React, and Tailwind CSS.

## Stack

- **Astro 6** — static site generator
- **React 19** — interactive components (ProductTabs)
- **Tailwind CSS 3** — utility-first styling
- **Vercel** — deployment

## Development

```bash
pnpm install
pnpm dev        # http://localhost:4321
```

## Build & Preview

```bash
pnpm build      # outputs to ./dist/
pnpm preview    # preview production build locally
```

## Structure

```
src/
├── components/
│   ├── Navbar.astro          # Fixed nav with scroll links
│   ├── Hero.astro            # Hero section with terminal demo
│   ├── Features.astro        # 4 feature cards with stagger animation
│   ├── ProductTabs.tsx       # Interactive tabs for dbrain/dcontext/dproxy/dwork (React)
│   ├── Ecosystem.astro       # 18 packages organized in 5 clusters
│   ├── Architecture.astro    # Visual dependency graph
│   ├── QuickStart.astro      # 3-step install guide with terminals
│   ├── CTA.astro             # Final call-to-action
│   ├── Terminal.astro        # Shared terminal code block component
│   └── Footer.astro          # Links to npm, GitHub, packages
├── layouts/
│   └── Layout.astro          # Base HTML layout with meta tags
├── pages/
│   └── index.astro           # Main page assembling all sections
└── styles/
    └── global.css            # CSS variables, Tailwind config, animations
```

## Design System

Colors use the same oklch palette as the dbrain/dwork dashboards:

- Background: `oklch(0.965 0.008 248)`
- Surface: `oklch(1 0 0)`
- Grid pattern: 36px lines from dashboard login screen
- Accent: brand purple `#7C3AED`

## Deployment

Deployed to Vercel. Push to `main` triggers automatic deploys.
