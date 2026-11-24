# 7TECH Gallery

An immersive 3D gallery for [7TECH](https://seventech.uz) products. Visitors walk a dark, curved corridor where every product hangs as a framed piece under its own spotlight, grouped into collections marked by backlit signs hanging from the ceiling.

**Live:** https://7tech-gallery.vercel.app

## Features

- **Walkable 3D corridor.** A circular hall with products on both walls. Move with the scroll wheel, a swipe or the arrow keys.
- **Gallery lighting.** Each piece has its own ceiling-hung spotlight, and the polished floor softly reflects the room.
- **Collections.** Each collection opens with a backlit sign on chains, followed by its products.
- **Close-up view.** Click a product to walk up to it and see its details, price and a link to the store. Click it again to step back.
- **Search.** Type to find a product, and the camera walks straight to it.
- **List view.** A plain grid of every collection, for browsing without the 3D scene.
- **Responsive.** Tuned for desktop and phones, with touch controls and a wider camera view on portrait screens.
- **Accessible defaults.** Respects `prefers-reduced-motion`, supports keyboard navigation in search, and keeps a semantic index of collections.

## Tech stack

| Layer     | Technology                                    |
| --------- | --------------------------------------------- |
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI        | React 19, TypeScript, CSS Modules             |
| 3D        | [three.js](https://threejs.org)               |
| Hosting   | [Vercel](https://vercel.com)                  |

## Getting started

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/Javokhiir/7TECH-Gallery.git
cd 7TECH-Gallery
npm install
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `npm run dev`            | Start the development server             |
| `npm run build`          | Create a production build                |
| `npm run start`          | Serve the production build               |
| `npm run fetch-products` | Refresh the product catalogue and images |

## Project structure

```
src/
├── app/                   # routes, root layout, global styles
├── components/
│   ├── corridor.ts        # three.js scene: corridor, lighting, signs, camera, input
│   ├── Gallery.tsx        # page shell: 3D view, list view, overlays
│   ├── Header.tsx         # top bar with live product search
│   ├── SearchResults.tsx  # search dropdown
│   ├── ProductCard.tsx    # product details shown in close-up
│   └── LoadingVeil.tsx    # loading screen
├── data/data.json         # product catalogue snapshot
└── lib/logo.ts            # 7TECH logo as vector paths
public/img/                # product images
scripts/                   # catalogue refresh script
```

## Deployment

The site runs on Vercel. To deploy the current state to production:

```bash
npx vercel deploy --prod
```

## Credits

Product names, images, the 7TECH logo and the brand typeface are the property of 7TECH. The brand typeface is loaded from 7TECH's own servers and is not included in this repository.
