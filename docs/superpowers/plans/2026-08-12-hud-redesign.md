# HUD Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the 5 screens (Painel, Criar Jogador, Pré-jogo, Pós-jogo, Histórico) to the "videogame HUD" orange design from the Claude Design project `d1c8e61c` — mobile-first, angular clipped panels, segmented bars, tier-colored badges — with zero engine changes.

**Architecture:** Tailwind v4 theme tokens + a few CSS component classes in `index.css`; a pure `src/ui/derive.ts` module for display-only computations (category averages, season OVR delta, per-game XP breakdown, pre-game multiplier estimate) tested with vitest; each screen file restyled in place keeping all existing handlers/state/logic.

**Tech Stack:** React 19, react-router 7, Tailwind CSS v4 (`@theme`), vitest. No new dependencies.

## Global Constraints

- Zero changes under `src/engine/` and `src/storage.ts`. All new display math lives in `src/ui/derive.ts` and only calls exported pure engine functions.
- Mobile-first: content column `max-w-[430px] mx-auto`; bottom sticky nav; top sticky header.
- Fonts: display = `'Chakra Petch'` (weights 500/600/700), body = `'Barlow'` (400/500/600). Chakra Petch replaces Barlow Condensed everywhere.
- Palette (custom tokens): bg `#0a0908`, panel `#0d0c0b`, panel2 `#100f0e`, line `#221e1b`, line2 `#2a2521`, ink `#f5f1ee`, mut `#77706a`, mut2 `#8a8078`. Orange = stock Tailwind `orange-*` (`#f97316` = orange-500).
- Tier colors: 0 `text-stone-600`, 1 Bronze `#e0a35c` (border/bg from `#c2792a`), 2 Prata `slate-300`, 3 Ouro `yellow-400`, 4 HOF `red-400`, 5 Lenda `purple-400`.
- Angular corners via clip-path utility (cut top-right + bottom-left), grid background overlay on the page shell.
- All existing copy stays pt-BR. Design's fictional "XP PARA 77" overall bar is NOT grounded in the engine → omitted (hero shows OVR + season delta instead).
- Design's 3-step wizard on Criar Jogador is presentation only → kept as one scrollable page with the HUD styling (stepper omitted).
- After every task: `npx vitest run` passes and `npx tsc -b` clean; commit.

---

### Task 1: Foundation — fonts, tokens, Layout

**Files:**
- Modify: `index.html` (font link)
- Modify: `src/index.css` (theme + component classes, replaces current `@layer components`)
- Modify: `src/ui/Layout.tsx` (top header + bottom nav shell)
- Delete usage check: `src/App.css` (verify unused; delete if not imported)

**Interfaces:**
- Produces: CSS classes used by all later tasks: `.hud-panel`, `.hud-panel-hot`, `.clip-corner`, `.clip-corner-lg`, `.hud-label`, `.hud-chip`, `.hud-chip-active`, `.btn-cta`, `.btn-ghost`, `.input` (restyled), `.stat` (Chakra Petch), `.seg`, `.seg-on`, `.seg-off`; font utilities `font-display` (Chakra Petch) via `--font-display`.

- [ ] **Step 1: index.html — swap font families**

Replace the Google Fonts href with:
```
https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap
```

- [ ] **Step 2: index.css — tokens + components**

```css
@import "tailwindcss";

@theme {
  --color-hud-bg: #0a0908;
  --color-hud-panel: #0d0c0b;
  --color-hud-panel2: #100f0e;
  --color-hud-line: #221e1b;
  --color-hud-line2: #2a2521;
  --color-hud-ink: #f5f1ee;
  --color-hud-mut: #77706a;
  --color-hud-mut2: #8a8078;
  --color-bronze: #c2792a;
  --color-bronze-light: #e0a35c;
  --font-display: "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Barlow", ui-sans-serif, system-ui, sans-serif;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-hud-bg);
  color: var(--color-hud-ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

@keyframes hudPulse { 0%,100%{opacity:.4} 50%{opacity:.85} }

@layer components {
  .clip-corner { clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)); }
  .clip-corner-lg { clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px)); }
  .hud-panel { @apply border border-hud-line bg-hud-panel/85 p-4; }
  .hud-panel-hot { @apply border border-orange-500/30 p-4 clip-corner-lg; background: linear-gradient(150deg, #1f1611, #0d0c0b 70%); }
  .hud-label { @apply font-display text-[10px] tracking-[.16em] text-hud-mut uppercase; }
  .hud-title { @apply font-display text-sm font-bold tracking-[.14em] uppercase; }
  .hud-chip { @apply border border-hud-line px-3 py-2 text-center font-display text-xs font-semibold tracking-[.08em] text-hud-mut2 uppercase; }
  .hud-chip-active { @apply border-orange-500/55 bg-orange-500/15 text-orange-300; }
  .btn-cta { @apply bg-orange-500 py-3 text-center font-display text-sm font-bold tracking-[.1em] text-[#160b03] uppercase clip-corner disabled:opacity-40; }
  .btn-ghost { @apply border border-hud-line2 px-3 py-2 text-center text-sm font-medium text-stone-300; }
  .input { @apply border border-hud-line2 bg-hud-panel2 px-2 py-1.5 text-hud-ink; }
  .stat { font-family: var(--font-display); font-weight: 700; font-variant-numeric: tabular-nums; }
  .page-grid {
    background-image: linear-gradient(rgba(249,115,22,.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(249,115,22,.05) 1px, transparent 1px);
    background-size: 34px 34px;
  }
}
```
Remove old `.card`, `.btn`, `.page-title` — Tasks 3-7 replace their usages. Until then build may show them missing only if removed early, so: keep `.btn`, `.card`, `.page-title` as aliases during transition (`.btn { @apply btn-ghost; }` etc.) and delete them in Task 7's cleanup step.

- [ ] **Step 3: Layout.tsx — HUD shell**

```tsx
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Painel' },
  { to: '/pregame', label: 'Pré' },
  { to: '/postgame', label: 'Pós' },
  { to: '/history', label: 'Hist' },
]

const TITLES: Record<string, string> = {
  '/': 'Career HUD', '/pregame': 'Pré-jogo', '/postgame': 'Pós-jogo',
  '/history': 'Histórico', '/new': 'Criar jogador',
}

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col page-grid">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-500/20 bg-hud-bg/90 px-4 py-3.5 backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 bg-orange-500 shadow-[0_0_10px_#f97316]" />
          <span className="font-display text-[15px] font-bold uppercase tracking-[.14em]">{TITLES[pathname] ?? 'Career HUD'}</span>
        </span>
        <span className="font-display text-[11px] tracking-[.16em] text-orange-400">2K25</span>
      </header>
      <main className="flex-1 p-4"><Outlet /></main>
      <nav className="sticky bottom-0 z-10 flex gap-1.5 border-t border-orange-500/20 bg-hud-bg/90 px-3 pb-3.5 pt-2.5 backdrop-blur">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center font-display text-[11px] font-bold uppercase tracking-[.1em] ${
                isActive ? 'border border-orange-500/55 bg-orange-500/15 text-orange-300' : 'border border-hud-line text-hud-mut2'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```
Header right-side badge shows season year on `/` when career exists — skip (Layout has no career access; static "2K25" is fine).

- [ ] **Step 4: Verify** — `npx vitest run` passes, `npx tsc -b` clean, `npm run dev` renders all pages (old styles degraded but functional).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: HUD design tokens, fonts and app shell"`

---

### Task 2: derive.ts — display helpers + tests

**Files:**
- Create: `src/ui/derive.ts`
- Test: `src/ui/derive.test.ts`

**Interfaces:**
- Consumes: `attributesByCategory`, `estimateOverall` (attributes.ts); `qualityMultiplier`, `ageMultiplier`, `contextMultiplier` (multipliers.ts); `categoryXp` (categoryXp.ts); `styleCategoryMult` (playStyles.ts); `goalBonus` (goals.ts); `ageAt` (recalc.ts); types.
- Produces:
  - `categoryAverages(career: Career): Record<Category, number>` — rounded mean attribute value per category.
  - `seasonOvrDelta(career: Career): number` — current estimated OVR minus season-start OVR (last `ovrAfter` of previous season, else OVR from `initialAttributes`).
  - `gameXpBreakdown(career: Career, game: Game, seasonIndex: number): { total: number; byCategory: [Category, number][] }` — recomputes display XP for a played game from pure functions (sorted desc, zero categories dropped).
  - `preGameMultiplier(career: Career, home: boolean, playoffs: boolean): number` — ageMult × contextMult with `win: false`.

- [ ] **Step 1: Write failing tests** (`src/ui/derive.test.ts`) covering: category average of known career fixture; delta 0 for fresh career and >0 after ovrAfter games; breakdown total equals sum of categories and respects style multiplier; preGameMultiplier for u21 home = 1.3.
- [ ] **Step 2: Run** `npx vitest run src/ui/derive.test.ts` — FAIL (module not found).
- [ ] **Step 3: Implement `derive.ts`** using only the exported engine functions listed above; `gameXpBreakdown` mirrors `applyGameXp` math (`raw[cat] * qualityMult * ageMult * ctxMult * styleMult + min(goalBonus, gameXp * goalBonusCap)`) without mutating anything.
- [ ] **Step 4: Run** full `npx vitest run` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: pure display helpers for HUD screens"`

---

### Task 3: Painel (Dashboard.tsx)

**Files:**
- Modify: `src/ui/Dashboard.tsx`

**Interfaces:**
- Consumes: Task 1 classes; `categoryAverages`, `seasonOvrDelta` from derive.ts. All existing handlers unchanged (`addChallenge`, `removeChallenge`, `newSeason`, `deleteCareer`, `handleExport`, `handleImport`).

Sections top-to-bottom (design `Painel.dc.html`):
- [ ] **Step 1: Hero** — `.hud-panel-hot` with orange border `border-orange-500/30`: kicker line `POS · TEAM · HEIGHT CM` (hud-label orange), name (`font-display text-[29px] font-bold uppercase`), chips row (style name active chip + `{age} ANOS` ghost chip); right column OVR label + `text-[58px] stat text-orange-400` with `text-shadow` glow via `drop-shadow`, delta `▲ n NA TEMP.` green (`text-green-400`, hide if ≤0 show `—`). No XP bar (see Global Constraints).
- [ ] **Step 2: Upgrades liberados** — amber panel (`border-amber-400/40`, gradient bg, clip-corner-lg): pulsing diamond (`animate-[hudPulse_2.4s_ease-in-out_infinite]`), count `String(n).padStart(2,'0')`; each instruction as row `bg-hud-bg/60 border-l-2 border-amber-400 px-3 py-2.5` rendering `i.text`; CTA `.btn-cta` "Apliquei tudo no 2K" (existing onClick). Empty state: plain panel "Nenhuma pendência."
- [ ] **Step 3: Atributos equalizer** — `.hud-panel`: header "Atributos" + `35 EM 8 CATEGORIAS`; 8 vertical bars (`h-[76px]` track `bg-[#171412]`, fill height `${avg}%`), orange gradient fill + orange value for style-focused cats (`styleCategoryMult(career.playStyle, cat) > 1`), stone gradient otherwise; labels 3PT MID INT LL PLY REB DEF FIS mapped from `three,mid,inside,ft,playmaking,rebounding,defense,physical`. Footer: `LARANJA = FOCO DO ESTILO {getStyle(...).name.toUpperCase()}` + "Abrir lista" toggle (`useState`) revealing the existing per-attribute `AttrRow` list grouped by category.
- [ ] **Step 4: Badges** — header row "Badges" + `NN / 40 ATIVAS` (tier>0 count, zero-padded); grid-cols-2 of badge cards: colored border/gradient by tier (Global Constraints tier colors), name + tier label, 5-segment progress bar (segments = progress within current tier: `pct/20` full segments, `bg-{tier-color}` on, `bg-stone-900` off). Collapsed: first 4 badges with tier>0 (fallback first 4); "Ver todas as badges" toggle shows all.
- [ ] **Step 5: Desafio ativo** — `.hud-panel` per challenge: title + `NN / NN` orange counter, description + reward text, streak segment bar (`flex gap-1`, on = `bg-orange-500 shadow`, off `bg-stone-900`), buttons Remover (`.btn-ghost`) + select+Criar desafio (existing logic, restyled with `.input` + `.btn-ghost`).
- [ ] **Step 6: Médias** — 5-tile grid `grid-cols-5 gap-px bg-hud-line border border-hud-line`, tiles `bg-hud-panel` with `stat text-xl` values, 3P% tile orange. Keep existing null-guard copy.
- [ ] **Step 7: Gestão** — `hud-label` "GESTÃO DA CARREIRA" + `grid-cols-2 gap-2`: Exportar JSON, Importar JSON (label+hidden input), Nova temporada (orange ghost `border-orange-500/40 text-orange-300`) with style select above it, Apagar carreira (`border-red-400/35 text-red-400`).
- [ ] **Step 8: Verify** — vitest + tsc + manual dev-server pass through all Dashboard actions.
- [ ] **Step 9: Commit** — `git commit -m "feat: Painel HUD redesign"`

---

### Task 4: Criar Jogador (CreatePlayer.tsx)

**Files:**
- Modify: `src/ui/CreatePlayer.tsx`

**Interfaces:**
- Consumes: Task 1 classes. Existing state/handlers (`submit`, `valid`, QuickEntry) unchanged.

- [ ] **Step 1: Identidade** — hud-label "IDENTIDADE"; name field as boxed input (`border-hud-line2 bg-hud-panel2` with inner hud-label "NOME", `font-display text-xl font-bold` input, transparent bg); grid-cols-4 boxed inputs TIME / ALTURA (CM) / IDADE / ANO; position as 5 `.hud-chip` pills (PG SG SF PF C, active = `.hud-chip-active`) replacing the select.
- [ ] **Step 2: Estilo de jogo** — hud-label header + "DEFINE O XP DAS CATEGORIAS"; horizontal scroll row (`flex gap-2 overflow-x-auto`) of `PLAY_STYLES` cards (`w-[150px] flex-none clip-corner`): name (display bold uppercase), `ref. {reference}` when present, chips of `catMults` entries where mult>1 formatted `{LABEL} ×{mult}` using the category abbreviation map from Task 3; selected card orange border/gradient, others `border-hud-line bg-hud-panel`. Click selects (`setPlayStyle`). Footer note `9 ESTILOS DISPONÍVEIS · ARRASTE PARA VER`.
- [ ] **Step 3: Atributos** — header "ATRIBUTOS COMO ESTÃO NO 2K" + `⚡ MODO RÁPIDO` chip button (existing `setQuick('attrs')`); keep grid of number inputs restyled with `.input stat`.
- [ ] **Step 4: Badges** — header + `TECLA 0-5 DEFINE O TIER` hint + `⚡ MODO RÁPIDO`; one `.hud-panel` list, each row: badge name + 6 tier boxes (`h-[30px] w-[30px] border font-display text-xs`) labeled `— B P O H L`; active box colored per tier (bronze/prata/ouro/HOF/Lenda tokens); click sets tier. Replaces the selects. Divider `h-px bg-hud-line` between rows. Footer `40 BADGES · SÓ AS QUE VOCÊ TEM PRECISAM DE TIER`.
- [ ] **Step 5: Footer actions** — row: (no Importar JSON here — import lives on Dashboard and CreatePlayer has no import handler; skip it) full-width `.btn-cta` "Começar carreira" with existing `disabled={!valid}`.
- [ ] **Step 6: QuickEntry modal** — restyle container to `.hud-panel-hot clip-corner-lg` with big orange stat number, segmented progress (`index/items.length` as 8 segments); keep all key handling.
- [ ] **Step 7: Verify** — create a career end-to-end in dev server (chips, style cards, quick modes, submit navigates to `/`). vitest + tsc.
- [ ] **Step 8: Commit** — `git commit -m "feat: Criar Jogador HUD redesign"`

---

### Task 5: Pré-jogo (PreGame.tsx)

**Files:**
- Modify: `src/ui/PreGame.tsx`

**Interfaces:**
- Consumes: `preGameMultiplier` from derive.ts; `generateGoals` (existing); `getStyle`, `ageAt`-equivalent age calc (same formula as Dashboard: `startAge + seasons.length - 1`); `career.activeChallenges`.

- [ ] **Step 1: Context state** — add `const [home, setHome] = useState(true)` + `const [playoffs, setPlayoffs] = useState(false)`; chips row CASA / FORA ×1.15 (exclusive pair) + PLAYOFFS ×1.5 toggle chip; intro paragraph from design ("Cada meta cumprida injeta XP bônus… até +30%").
- [ ] **Step 2: Multiplier card** — `.hud-panel` flex: label MULTIPLICADOR ESTIMADO, sub `Idade {age} (×{ageMult}) · {Casa|Fora} · {getStyle(career.playStyle).name}`, right big `stat text-3xl text-orange-400` value `preGameMultiplier(career, home, playoffs).toFixed(2)×`.
- [ ] **Step 3: Missões** — button "Gerar metas" / "Gerar outras metas" (`.btn-ghost`) calls existing `roll(home, playoffs)`; render `career.nextGoals` as design cards (`clip-corner`, orange gradient): big number (parse leading number from `g.target` — use `g.target` directly, formatted per kind: `tpPct/fgPct` → `${target*100}%`, else `${target}+`), description, `BÔNUS → {CATEGORY_LABEL}` (+ `· FOCO {style}` when `styleCategoryMult > 1`).
- [ ] **Step 4: Desafio em andamento** — if `career.activeChallenges.length`, `.hud-panel` with hud-label DESAFIO EM ANDAMENTO and each challenge's `description` + `currentStreak/streakLen`.
- [ ] **Step 5: CTA** — "Estou pronto" `.btn-cta` as `<Link to="/postgame">` shown when `nextGoals` set.
- [ ] **Step 6: Verify + Commit** — vitest/tsc/dev; `git commit -m "feat: Pré-jogo HUD redesign"`

---

### Task 6: Pós-jogo (PostGame.tsx)

**Files:**
- Modify: `src/ui/PostGame.tsx`

**Interfaces:**
- Consumes: `gameXpBreakdown` from derive.ts (called with the registered game found via `career.lastResult.gameId` in the last season). Existing `submit`, validation, state unchanged.

- [ ] **Step 1: A partida** — hud-label + `.hud-panel` row: ADVERSÁRIO text input (boxed, display font), CASA/FORA chip pair, V/D chip pair (green `border-green-400/45 bg-green-400/10 text-green-400` / red equivalents), date input + PLAYOFFS chip toggle + DNP chip toggle beneath.
- [ ] **Step 2: Box score** — hud-label BOX SCORE; `grid-cols-4 gap-2` of stat tiles: label (9px hud-label) + number input (`stat text-2xl` transparent centered, border `hud-line2` bg `hud-panel2`); shooting splits FG/3PT/LL as three composite tiles (made/attempt inputs side by side + computed % below); 3PT tile orange-accented. Hidden when DNP.
- [ ] **Step 3: CTA** — `.btn-cta` "Registrar jogo" (existing submit). Errors list red above it.
- [ ] **Step 4: Resultado** — green panel (`border-green-400/30`, gradient, clip-corner-lg): pulsing diamond + `N / N METAS`; goal rows: ✓ green `border-l-2 border-green-400` + `+XP {CATEGORY}` / ✕ stone dimmed `SEM BÔNUS`.
- [ ] **Step 5: XP do jogo** — `.hud-panel`: header "XP do jogo" + orange `+{total}`; per-category horizontal bars (label, track `bg-[#171412]` fill orange gradient for top category / stone otherwise, width = value/max, right `+{n}` value) from `gameXpBreakdown`. Skip section when game was DNP or breakdown total is 0.
- [ ] **Step 6: Faça isso no 2K** — amber panel with `lastResult.instructions` rows (amber left border, `i.text`); footer link "Ver no painel →" (`Link to="/"`).
- [ ] **Step 7: Verify + Commit** — register a real game in dev; check XP panel sums; vitest/tsc; `git commit -m "feat: Pós-jogo HUD redesign"`

---

### Task 7: Histórico (History.tsx) + cleanup

**Files:**
- Modify: `src/ui/History.tsx`
- Modify: `src/index.css` (remove `.btn`/`.card`/`.page-title` aliases)
- Delete: `src/App.css` if unreferenced

**Interfaces:**
- Consumes: existing `OvrChart`, `recentAverages`, `deleteGame`. `seasonOvrDelta` from derive.ts for header delta.

- [ ] **Step 1: Evolução panel** — `.hud-panel-hot`: hud-label EVOLUÇÃO DO OVERALL, big OVR (stat 44px orange) + `▲ {delta}` green; right column `{n} JOGOS` + `{first} → {last}`; keep `OvrChart` SVG restyled (stroke `#f97316`, fill `rgba(249,115,22,.14)`, endpoint circle); footer JOGO 01 / meio / fim labels.
- [ ] **Step 2: Season stat grid** — per season: 6 tiles (PPG RPG APG FG% 3P% W-L) in `grid-cols-3 gap-px` panel-grid style, 3P% orange.
- [ ] **Step 3: Game cards** — replace table with card list: left column opponent abbrev (display bold) + date `dd/mm`; divider; middle `PTS · REB · AST` line (stat) + goals segment mini-bar (`w-3.5 h-1` segments, met = orange) + `N/N METAS · CASA|FORA` caption; right V/D box (green/red bordered) . DNP games dimmed `opacity-60` with `NÃO JOGOU` and `—` box. Excluir: small `.btn-ghost` per card (keep confirm+recalc handler).
- [ ] **Step 4: Season filter** — keep seasons newest-first with season header `Temporada {year}` + W-L. (Design's TODOS/VITÓRIAS filter chips: skip — YAGNI, no user ask.)
- [ ] **Step 5: Cleanup** — grep repo for `\.btn\b|\bcard\b|page-title` class usage; remove aliases from index.css; delete `App.css` if `grep -r "App.css" src` is empty.
- [ ] **Step 6: Verify + Commit** — vitest/tsc/lint/dev; `git commit -m "feat: Histórico HUD redesign + legacy style cleanup"`

---

### Task 8: Final verification

- [ ] **Step 1:** `npx vitest run` — all green.
- [ ] **Step 2:** `npm run build` — tsc + vite clean.
- [ ] **Step 3:** `npm run lint` — clean.
- [ ] **Step 4:** Dev-server walkthrough: create career → pré-jogo metas → registrar jogo → painel upgrades → histórico. Screenshot each screen at 430px versus design files.
- [ ] **Step 5:** Commit any fixes; report.

## Self-Review Notes

- Spec coverage: all 5 design screens mapped to Tasks 3-7; shell/nav in Task 1; grounded-data gaps (overall XP bar, wizard stepper, history filter chips) explicitly resolved in Global Constraints/steps.
- Engine untouched; XP breakdown recomputed purely (mirrors `applyGameXp` including `goalBonusCap`).
- Type consistency: derive.ts signatures declared once in Task 2 and consumed by name in Tasks 3, 5, 6, 7.
