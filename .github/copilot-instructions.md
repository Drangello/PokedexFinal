# Copilot Instructions for Shinydex (modul7PokedexFinal)

## Project Overview
This is a client-side JavaScript web app for browsing Pokémon data ("Shinydex"). It fetches data from the public [PokeAPI](https://pokeapi.co/) and displays Pokémon cards with search and navigation features. The UI is styled with CSS and includes interactive overlays for detailed Pokémon info.

## Key Files
- `index.html`: Main HTML structure, loads `script.js` and `style.css`. Entry point for the app.
- `script.js`: All core logic for fetching, rendering, searching, and navigation. No build system; code runs directly in browser.
- `style.css`: Custom styles, including CSS variables for Pokémon types.
- `abra_icon-icons.com_67592.png`: Favicon and possible UI asset.

## Architecture & Data Flow
- **Data Source**: Uses PokeAPI (`https://pokeapi.co/api/v2/pokemon`) for all Pokémon data. Data is loaded in batches (pagination via `offset`/`limit`).
- **State Management**: Uses global JS arrays (`allLoadedPokemons`) to cache loaded Pokémon and their details. No external state management library.
- **Rendering**: Cards are rendered dynamically in the `main` element. Overlay section (`#overlay`) is used for full Pokémon details and navigation (next/prev buttons).
- **Search**: Input field filters cached Pokémon by name (minimum 3 characters to trigger search).
- **Audio**: There is logic for muting/unmuting Pokémon cries (audio), controlled by a global `isMuted` flag and `cryAudio` object.

## Developer Workflows
- **No build step**: Directly edit JS/CSS/HTML and reload in browser.
- **Debugging**: Use browser DevTools (console, network tab) for debugging. No automated tests or build scripts present.
- **Adding Features**: Extend `script.js` for new UI logic, API calls, or event handlers. Use CSS variables for new Pokémon types/colors.

## Project-Specific Patterns
- **Dynamic Card Rendering**: Use `renderCard(pokemon)` and `renderCardTemplate(pokemon)` for new card types.
- **Overlay Navigation**: Use `showFulldetails(pokemon)`, `showNextPokemon()`, and `showPreviousPokemon()` for overlay logic.
- **Type Colors**: Reference CSS variables (e.g., `var(--fire)`) for type-based coloring in UI.
- **Search UX**: Show a message if search query is less than 3 characters or no results found.
- **Button State**: Disable "LoadMore" button during fetch to prevent duplicate requests.

## Integration Points
- **External API**: All Pokémon data comes from PokeAPI. No other external dependencies.
- **Assets**: Only local image asset for favicon/UI.

## Conventions
- All logic is in a single JS file (`script.js`).
- Use semantic HTML and CSS classes for UI elements.
- Use global variables for app state.
- No frameworks or modules; pure JS/HTML/CSS.

## Example Patterns
```js
// Fetch and cache Pokémon
async function fetchPokes() { ... }

// Render a card
function renderCard(pokemon) { ... }

// Search logic
function searchPokemon() { ... }
```

## How to Extend
- Add new UI features by editing `script.js` and updating `index.html` as needed.
- Add new type colors in `:root` of `style.css`.
- For new API endpoints, follow the fetch/caching pattern in `fetchPokes` and `loadPokemonDetails`.

---
For questions or unclear conventions, review `script.js` for implementation details or ask for clarification.
