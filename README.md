# Tromb Producciones — sitio web

Landing estática (HTML + CSS + JS, sin build) publicada con GitHub Pages.

- `index.html` — página
- `styles.css`, `visual-refresh.css` — estilos
- `animations.js` — animaciones generales (compilado desde `animations.ts` con `npm run build`)
- `media.js` — sliders, galería, video en celular y entrada de personajes
- `assets/` — fotos, video, logos y favicon

## Test E2E

```bash
node tests/e2e.mjs
```

Requiere Node 22+ y Google Chrome. Levanta un servidor local y recorre el sitio en escritorio, tablet y celular.
