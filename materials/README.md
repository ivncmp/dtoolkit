# materials/

Launch and marketing assets for dtoolkit. Everything needed to present, share, and promote the project.

## Structure

```
materials/
├── slides/          Presentation deck (HTML source + PDF export)
├── logos/           All product logos (dtoolkit, dbrain, dwork, dops)
├── screenshots/     Dashboard and CLI screenshots (add as needed)
├── diagrams/        Architecture and flow diagrams (add as needed)
└── social/          Social media posts, banners, og-images (add as needed)
```

## Slides

- **`slides/dtoolkit-deck.pdf`** — PDF export for sharing. Also served at [dtoolkit.dev/dtoolkit-deck.pdf](https://dtoolkit.dev/dtoolkit-deck.pdf).

The HTML source lives at `deck/index.html` (repo root). Edit there, print to PDF, and copy here.

## Logos

All logos live in `logos/`. Naming convention:

| File | Description |
|------|-------------|
| `logo.png` | dtoolkit icon (square, no text) |
| `logo-dtoolkit.png` | dtoolkit icon |
| `logo-dtoolkit-complete.png` | dtoolkit icon + wordmark |
| `logo-dbrain.png` | dbrain icon |
| `logo-dbrain-complete.png` | dbrain icon + wordmark |
| `logo-dwork.png` | dwork icon |
| `logo-dwork-complete.png` | dwork icon + wordmark |
| `logo-dops.png` | dops icon |
| `logo-dops-complete.png` | dops icon + wordmark |

## Adding new assets

Drop files in the relevant folder. Use descriptive filenames (`dashboard-dbrain-entities.png`, not `screenshot1.png`). No build step needed.
