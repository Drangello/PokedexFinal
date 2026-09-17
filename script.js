let url = "https://pokeapi.co/api/v2/pokemon?offset=0&limit=20";
let allLoadedPokemons = [];
const buttonsInfo = ["statsButton", "evoButton", "infoButton"];
let isMuted = false;
let cryAudio = null;
let currentPokemonIndex = 0;
let isLoading = false;
let hasCompletedInitialLoad = false;
let lastFocusedElement = null;

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    document.getElementById("searchInput").addEventListener("input", searchPokemon);
    document.getElementById("loadBtn").addEventListener("click", fetchPokes);
    document.getElementById("muteBtn").addEventListener("click", toggleMute);
    document.getElementById("closeBtn").addEventListener("click", () => toggleOverlay(false));
    document.getElementById("prevBtn").addEventListener("click", showPreviousPokemon);
    document.getElementById("nextBtn").addEventListener("click", showNextPokemon);
    document.getElementById("overlay").addEventListener("click", closeOverlayOnBackdrop);
    document.addEventListener("keydown", handleOverlayKeyboard);

    updateMuteButton();
    fetchPokes();
}

async function fetchPokes() {
    if (isLoading || !url) return;

    const main = document.getElementById("main");
    const startIndex = allLoadedPokemons.length;
    const masterballClosed = hasCompletedInitialLoad
        ? closeMasterballForLoading()
        : startInitialMasterballLoading();
    isLoading = true;
    main.setAttribute("aria-busy", "true");
    setLoadButtonState(true);

    try {
        const firstPokemons = await fetchJson(url);
        const nextUrl = firstPokemons.next;

        firstPokemons.results.forEach((pokemon) => allLoadedPokemons.push(pokemon));

        try {
            await loadPokemonDetails(startIndex);
        } catch (error) {
            allLoadedPokemons.splice(startIndex);
            throw error;
        }

        url = nextUrl;
        document.getElementById("loadBtn").removeAttribute("title");
        renderCurrentPokemonView();
    } catch (error) {
        console.error("Pokémon konnten nicht geladen werden:", error);
        showLoadError();
    } finally {
        await masterballClosed;

        if (!hasCompletedInitialLoad) await completeInitialLoad();
        else await openMasterballAfterLoading();

        isLoading = false;
        main.setAttribute("aria-busy", "false");
        setLoadButtonState(false);
    }
}

async function loadPokemonDetails(startIndex = 0) {
    const unloadedPokemons = allLoadedPokemons.slice(startIndex).filter((pokemon) => !pokemon.data);

    await Promise.all(unloadedPokemons.map(async (pokemon) => {
        pokemon.data = await fetchJson(pokemon.url);
    }));
}

async function fetchJson(fetchUrl) {
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status} für ${fetchUrl}`);
    return response.json();
}

function startInitialMasterballLoading() {
    const loader = document.getElementById("initialLoader");
    loader.classList.add("is-fetching");
    return Promise.resolve();
}

function closeMasterballForLoading() {
    const loader = document.getElementById("initialLoader");
    const topHalf = loader.querySelector(".loader-half--top");
    const loadingText = loader.querySelector(".loader-copy");
    const transitionFinished = waitForMasterballTransition(topHalf);

    loadingText.textContent = "Weitere Pokémon werden geladen …";
    document.body.classList.add("masterball-active");
    loader.classList.add("is-opening", "is-fetching", "is-closing");
    loader.hidden = false;

    // Der Layout-Read setzt den geöffneten Startzustand, bevor der Ball zufährt.
    loader.getBoundingClientRect();
    loader.classList.remove("is-opening");

    return transitionFinished.finally(() => loader.classList.remove("is-closing"));
}

async function completeInitialLoad() {
    const searchInput = document.getElementById("searchInput");

    hasCompletedInitialLoad = true;
    searchInput.disabled = false;
    document.body.classList.add("app-ready");
    await openMasterballAfterLoading();
}

async function openMasterballAfterLoading() {
    const loader = document.getElementById("initialLoader");
    const topHalf = loader.querySelector(".loader-half--top");
    const transitionFinished = waitForMasterballTransition(topHalf);

    loader.classList.remove("is-fetching", "is-closing");
    loader.classList.add("is-opening");
    await transitionFinished;

    loader.hidden = true;
    document.body.classList.remove("initial-loading", "masterball-active");
}

function waitForMasterballTransition(element) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return new Promise((resolve) => requestAnimationFrame(resolve));
    }

    return new Promise((resolve) => {
        const handleTransitionEnd = (event) => {
            if (event.target !== element || event.propertyName !== "transform") return;
            element.removeEventListener("transitionend", handleTransitionEnd);
            resolve();
        };

        element.addEventListener("transitionend", handleTransitionEnd);
    });
}

function setLoadButtonState(loading) {
    const button = document.getElementById("loadBtn");
    const label = button.querySelector(".load-button-label");

    button.classList.toggle("is-loading", loading);
    button.disabled = loading || !url;
    button.setAttribute("aria-busy", String(loading));

    if (loading) label.textContent = "Pokémon werden geladen …";
    else if (!url) label.textContent = "Alle Pokémon geladen";
    else label.textContent = "Mehr Pokémon laden";
}

function showLoadError() {
    if (allLoadedPokemons.length === 0) {
        renderMessage("Verbindung fehlgeschlagen", "Die Pokémon konnten nicht geladen werden. Bitte versuche es über den Button erneut.");
        return;
    }

    const button = document.getElementById("loadBtn");
    button.title = "Das Nachladen ist fehlgeschlagen. Bitte erneut versuchen.";
}

function searchPokemon() {
    renderCurrentPokemonView();
}

function renderCurrentPokemonView() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();

    if (query.length === 0) {
        showAllCachedPokemons();
        return;
    }

    if (query.length < 2) {
        renderMessage("Noch ein Buchstabe", "Die Suche startet ab zwei Buchstaben.");
        return;
    }

    const filteredPokemons = allLoadedPokemons.filter((pokemon) =>
        pokemon.data && pokemon.name.toLowerCase().includes(query)
    );

    if (filteredPokemons.length === 0) {
        renderMessage("Kein Pokémon gefunden", `Für „${query}“ gibt es unter den bereits geladenen Pokémon keinen Treffer.`);
        return;
    }

    renderPokemonList(filteredPokemons);
}

function showAllCachedPokemons() {
    const cachedPokemons = allLoadedPokemons.filter((pokemon) => pokemon.data);
    renderPokemonList(cachedPokemons);
}

function renderPokemonList(pokemons) {
    const main = document.getElementById("main");
    const fragment = document.createDocumentFragment();
    main.innerHTML = "";

    pokemons.forEach((pokemon) => renderCard(pokemon.data, fragment));
    main.appendChild(fragment);
}

function renderMessage(title, message) {
    const main = document.getElementById("main");
    const emptyState = document.createElement("p");
    const heading = document.createElement("strong");

    heading.textContent = title;
    emptyState.className = "empty-state";
    emptyState.append(heading, document.createTextNode(message));
    main.replaceChildren(emptyState);
}

function renderCard(pokemon, target = document.getElementById("main")) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Details zu ${pokemon.name} öffnen`);
    card.innerHTML = renderCardTemplate(pokemon);
    applyTypeTheme(card, pokemon);

    card.addEventListener("click", () => showFulldetails(pokemon));
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showFulldetails(pokemon);
        }
    });

    target.appendChild(card);
}

function renderCardTemplate(pokemon) {
    const sprite = getShinySprite(pokemon);

    return `
        <div class="card-heading">
            <h2 class="pokemon-name">${escapeHtml(pokemon.name)}</h2>
            <span class="pokemon-id">${formatPokemonId(pokemon.id)}</span>
        </div>
        <img class="pokemon-sprite" src="${sprite}" alt="Shiny ${escapeHtml(pokemon.name)}" loading="lazy">
        <div class="type-list" aria-label="Pokémon-Typen">
            ${showTypes(pokemon)}
        </div>
    `;
}

function showTypes(pokemon) {
    return pokemon.types.map(({ type }) => {
        const typeName = getSafeTypeName(type.name);
        return `<span class="type-badge type-${typeName}">${escapeHtml(type.name)}</span>`;
    }).join("");
}

function applyTypeTheme(element, pokemon) {
    const typeNames = pokemon.types.map(({ type }) => getSafeTypeName(type.name));
    const firstType = typeNames[0] || "normal";
    const secondType = typeNames[1] || firstType;

    element.classList.remove("type-single", "type-dual");
    element.classList.add(typeNames.length > 1 ? "type-dual" : "type-single");
    element.style.setProperty("--type-1", `var(--${firstType})`);
    element.style.setProperty("--type-2", `var(--${secondType})`);
}

function getSafeTypeName(typeName) {
    const knownTypes = [
        "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
        "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
    ];
    return knownTypes.includes(typeName) ? typeName : "normal";
}

function getShinySprite(pokemon) {
    return pokemon.sprites.front_shiny || pokemon.sprites.front_default || "";
}

function formatPokemonId(id) {
    return `#${String(id).padStart(3, "0")}`;
}

function showFulldetails(pokemon) {
    lastFocusedElement = document.activeElement;
    currentPokemonIndex = allLoadedPokemons.findIndex((entry) => entry.name === pokemon.name);
    renderpokefullCard(pokemon);
    toggleOverlay(true);
    document.getElementById("closeBtn").focus();
}

function renderpokefullCard(pokemon) {
    const fullCard = document.getElementById("fullCard");
    fullCard.dataset.pokemonId = String(pokemon.id);
    fullCard.innerHTML = `
        <div class="detail-hero">
            <div class="detail-copy">
                <span class="detail-id">${formatPokemonId(pokemon.id)}</span>
                <h2 class="detail-name">${escapeHtml(pokemon.name)}</h2>
                <div class="type-list" aria-label="Pokémon-Typen">${showTypes(pokemon)}</div>
            </div>
            <img class="detail-sprite" src="${getShinySprite(pokemon)}" alt="Shiny ${escapeHtml(pokemon.name)}">
        </div>
        <div class="detail-content">
            ${renderButtons()}
            ${renderInfobox(pokemon)}
        </div>
    `;

    applyTypeTheme(fullCard, pokemon);
    fullCard.scrollTop = 0;
    addButtonsListeners(pokemon);
    updateNavigationButtons();
    playCry(pokemon);
}

function renderButtons() {
    return `
        <div class="detail-tabs" role="tablist" aria-label="Pokémon-Details">
            <button id="statsButton" class="tab-button is-active" type="button" role="tab" aria-selected="true">Stats</button>
            <button id="evoButton" class="tab-button" type="button" role="tab" aria-selected="false">Evo</button>
            <button id="infoButton" class="tab-button" type="button" role="tab" aria-selected="false">Info</button>
        </div>
    `;
}

function renderInfobox(pokemon) {
    return `<div id="infobox" class="infobox" role="tabpanel">${showStats(pokemon.stats)}</div>`;
}

function addButtonsListeners(pokemon) {
    buttonsInfo.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        button.addEventListener("click", () => openDetailTab(pokemon, buttonId));
    });
}

async function openDetailTab(pokemon, buttonId) {
    const infobox = document.getElementById("infobox");
    const fullCard = document.getElementById("fullCard");
    const requestedPokemonId = String(pokemon.id);
    const tabButtons = buttonsInfo.map((id) => document.getElementById(id));

    tabButtons.forEach((button) => {
        const isActive = button.id === buttonId;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    if (buttonId === "statsButton") {
        infobox.innerHTML = showStats(pokemon.stats);
        return;
    }

    infobox.innerHTML = '<div class="panel-loading">Daten werden geladen …</div>';
    tabButtons.forEach((button) => { button.disabled = true; });

    try {
        const content = await fillInfobox(pokemon, buttonId);
        if (fullCard.dataset.pokemonId === requestedPokemonId) infobox.innerHTML = content;
    } catch (error) {
        console.error("Detaildaten konnten nicht geladen werden:", error);
        if (fullCard.dataset.pokemonId === requestedPokemonId) {
            infobox.innerHTML = '<p class="panel-error">Diese Detaildaten konnten gerade nicht geladen werden.</p>';
        }
    } finally {
        if (fullCard.dataset.pokemonId === requestedPokemonId) {
            tabButtons.forEach((button) => { button.disabled = false; });
        }
    }
}

async function fillInfobox(pokemon, buttonId) {
    if (buttonId === "evoButton") return getEvolutionLine(pokemon.species.url);
    if (buttonId === "infoButton") return getPokeInfo(pokemon.species.url);
    return showStats(pokemon.stats);
}

async function getPokeInfo(speciesUrl) {
    const species = await fetchJson(speciesUrl);
    const englishEntry = species.flavor_text_entries.find((entry) => entry.language.name === "en");
    const fallbackEntry = species.flavor_text_entries[0];
    const flavorText = (englishEntry || fallbackEntry)?.flavor_text || "Keine Beschreibung verfügbar.";
    const cleanText = flavorText.replace(/[\f\n\r]+/g, " ");

    return `<p class="info-text">${escapeHtml(cleanText)}</p>`;
}

function showStats(stats) {
    return `<div class="stat-list">${renderTable(stats)}</div>`;
}

function renderTable(stats) {
    const statLabels = {
        hp: "HP",
        attack: "Angriff",
        defense: "Verteidigung",
        "special-attack": "Spez.-Angriff",
        "special-defense": "Spez.-Vert.",
        speed: "Initiative"
    };

    return stats.map((stat) => {
        const statName = stat.stat.name;
        const value = Number(stat.base_stat) || 0;
        const percentage = Math.min(100, Math.round((value / 180) * 100));

        return `
            <div class="stat-row">
                <span class="stat-name">${statLabels[statName] || escapeHtml(statName)}</span>
                <span class="stat-number">${value}</span>
                <span class="stat-track" aria-label="${escapeHtml(statName)}: ${value}">
                    <span class="stat-fill" style="--stat-value: ${percentage}%"></span>
                </span>
            </div>
        `;
    }).join("");
}

async function getEvolutionLine(speciesUrl) {
    const species = await fetchJson(speciesUrl);
    const chain = await fetchJson(species.evolution_chain.url);
    const evoList = [];
    let node = chain.chain;

    for (let stage = 0; node?.species && stage < 3; stage++) {
        const pokemon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${node.species.name}`);
        evoList.push({
            name: pokemon.name,
            id: pokemon.id,
            img: getShinySprite(pokemon)
        });
        node = node.evolves_to?.[0];
    }

    return renderEvolution(evoList);
}

function renderEvolution(evoList) {
    const stages = ["Basis", "Entwicklung", "Final"];

    const evoDetails = evoList.map((pokemon, index) => `
        ${index > 0 ? '<span class="evo-arrow" aria-hidden="true">→</span>' : ""}
        <div class="evo-item">
            <span class="evo-stage">${stages[index]}</span>
            <img class="evo-img" src="${pokemon.img}" alt="Shiny ${escapeHtml(pokemon.name)}">
            <span class="evo-name">${escapeHtml(pokemon.name)}</span>
            <span class="evo-id">${formatPokemonId(pokemon.id)}</span>
        </div>
    `).join("");

    return `<div class="evo-grid">${evoDetails}</div>`;
}

async function showNextPokemon() {
    await navigatePokemon(1);
}

async function showPreviousPokemon() {
    await navigatePokemon(-1);
}

async function navigatePokemon(direction) {
    const nextIndex = currentPokemonIndex + direction;
    if (nextIndex < 0 || nextIndex >= allLoadedPokemons.length) return;

    currentPokemonIndex = nextIndex;
    const entry = allLoadedPokemons[currentPokemonIndex];
    const pokemon = entry.data || await fetchJson(entry.url);
    entry.data = pokemon;
    renderpokefullCard(pokemon);
}

function updateNavigationButtons() {
    document.getElementById("prevBtn").disabled = currentPokemonIndex <= 0;
    document.getElementById("nextBtn").disabled = currentPokemonIndex >= allLoadedPokemons.length - 1;
}

function playCry(pokemon) {
    if (cryAudio) {
        cryAudio.pause();
        cryAudio.currentTime = 0;
    }

    const cryUrl = pokemon.cries?.latest
        || `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemon.id}.ogg`;
    cryAudio = new Audio(cryUrl);
    cryAudio.muted = isMuted;

    if (!isMuted) cryAudio.play().catch(() => {
        // Manche Browser blockieren Audio, bis der Benutzer mit der Seite interagiert hat.
    });
}

function toggleMute() {
    isMuted = !isMuted;
    if (cryAudio) cryAudio.muted = isMuted;
    updateMuteButton();
}

function updateMuteButton() {
    const button = document.getElementById("muteBtn");
    button.setAttribute("aria-label", isMuted ? "Pokémon-Rufe einschalten" : "Pokémon-Rufe stummschalten");
    button.setAttribute("aria-pressed", String(isMuted));
}

function toggleOverlay(isVisible) {
    const overlay = document.getElementById("overlay");
    overlay.classList.toggle("is-visible", isVisible);
    overlay.setAttribute("aria-hidden", String(!isVisible));
    document.body.classList.toggle("overlay-open", isVisible);

    if (!isVisible) {
        if (cryAudio) cryAudio.pause();
        if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    }
}

function closeOverlayOnBackdrop(event) {
    if (event.target === event.currentTarget) toggleOverlay(false);
}

function handleOverlayKeyboard(event) {
    const overlayIsOpen = document.getElementById("overlay").classList.contains("is-visible");
    if (!overlayIsOpen) return;

    if (event.key === "Escape") toggleOverlay(false);
    if (event.key === "ArrowLeft") showPreviousPokemon();
    if (event.key === "ArrowRight") showNextPokemon();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
