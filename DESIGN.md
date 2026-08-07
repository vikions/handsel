# Handsel Design System

## Direction

**Earnest Ledger** treats Handsel as a living work agreement rather than a generic crypto dashboard. The landing page is editorial and persuasive; product routes are quiet, precise operational surfaces. The shared visual memory is a signed work order: warm paper, ink, ruled structure, a restrained green approval mark, and clear settlement data.

## Modes

- Landing: Persuade. Instrument Serif may lead, with restrained atmospheric proof cards.
- Dashboard, Create, Agreement, Receipt: Operate. Manrope leads; motion communicates state only.
- Work Passport: Read. Objective wallet history and settlement evidence lead; no subjective reputation score.
- Analytics: Read. Large data may use IBM Plex Mono, but explanatory content stays compact.

## Palette

- Canvas: `#f3f0e8`
- Paper: `#fbfaf6`
- Raised paper: `#ffffff`
- Ink: `#20231e`
- Secondary ink: `#686b64`
- Hairline: `#d9d5ca`
- Hairline strong: `#bbb7ac`
- Approval green: `#496b5b`
- Approval wash: `#e7eee9`
- Warning: `#8a622c`
- Error: `#9a4838`

Green is reserved for primary actions, selected navigation, and positive state. It is not decorative.

## Typography

- Editorial display: Instrument Serif, regular, landing only.
- Product UI: Manrope, weights 500 to 700.
- Measurement: IBM Plex Mono for addresses, hashes, amounts, and counts only.
- Product headings use fixed sizes and never use serif.
- Labels use sentence case. Tracked uppercase is limited to status and compact data labels.

## Layout

- Product shell maximum width: 1240px.
- Product routes use a stable top navigation with a bottom rule rather than a floating pill.
- Dashboard hierarchy: page action, compact protocol strip, wallet agreement ledger.
- Create hierarchy: agreement fields on the left, readiness and amount summary on the right.
- Mobile collapses to one column below 760px with no horizontal scroll.

## Components

- Containers use 0 to 12px radius. Pills are reserved for status and compact navigation state.
- Lists use rules and whitespace, not repeated floating cards.
- Buttons are 44px minimum height with clear focus, active, disabled, and pending states.
- Form labels sit above controls. Inputs use a paper surface, 1px border, and strong focus ring.
- Empty states explain the next action in one sentence.
- Loading states preserve the final layout with skeletons.

## Motion

- Product routes use 160 to 220ms ease-out transitions for hover, focus, and state changes.
- No decorative page-load choreography in operational screens.
- Landing background motion remains slow, transform-only, and disabled under reduced motion.

## Do Not

- Do not add generic bento feature cards, gradient text, neon glows, purple palettes, or nested cards.
- Do not use display serif for product controls, dashboard headings, or form labels.
- Do not bury the primary agreement action under explanatory copy.
- Do not fabricate customer data, traction claims, or production availability.
