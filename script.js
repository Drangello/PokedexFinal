let url = `https://pokeapi.co/api/v2/pokemon?offset=0&limit=20`;
let allLoadedPokemons = [];
let buttonsInfo = ['evoButton', 'infoButton', 'statsButton'];
let isMuted = false;
let cryAudio = null;
let currentPokemonIndex = 0;

async function fetchPokes() {
    let pokes = await fetch(url);
    let firstPokemons = await pokes.json();
    url = firstPokemons.next;

    let startIndex = allLoadedPokemons.length;

    firstPokemons.results.forEach(pokemon => allLoadedPokemons.push(pokemon));

    await loadPokemonDetails(startIndex);
    toggleMute();
}

async function loadPokemonDetails(startIndex = 0) {
    for (let i = startIndex; i < allLoadedPokemons.length; i++) {
        if (allLoadedPokemons[i].data) continue;
        let fetchedData = await fetch(allLoadedPokemons[i].url);
        let singlePokemon = await fetchedData.json();
        allLoadedPokemons[i].data = singlePokemon;
        renderCard(singlePokemon);
    }
}
function searchPokemon() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const main = document.getElementById('main');
    main.innerHTML = '';

    if (query.length < 3) {
        showAllCachedPokemons();
        return;
    }

    const filtered = allLoadedPokemons.filter(poke =>
        poke.name.toLowerCase().includes(query)
    );
    if (filtered.length === 0) {
        main.innerHTML = `<p>Keine Pokémon gefunden 😢</p>`;
        return;
    }
    for (const poke of filtered) {
        if (poke.data) renderCard(poke.data);
    }
}

function showAllCachedPokemons() {
    const main = document.getElementById('main');
    main.innerHTML = '';
    for (const poke of allLoadedPokemons) {
        if (poke.data) renderCard(poke.data);
    }
}

async function renderCard(pokemon) {
    const main = document.getElementById('main');
    let card = document.createElement('div');
    card.classList.add('card');
    card.innerHTML += renderCardTemplate(pokemon);
    card.addEventListener('click', () => {
        showFulldetails(pokemon);
    });
    main.appendChild(card);
}

function showTypes(pokemon) {
    if (pokemon.types.length > 1) {
        return `<span style="background-color:var(--${pokemon.types[0].type.name})">${pokemon.types[0].type.name}</span>
        <span style="background-color:var(--${pokemon.types[1].type.name})">${pokemon.types[1].type.name}</span>`;
    } else {
        return `<span style="background-color:var(--${pokemon.types[0].type.name})">${pokemon.types[0].type.name}</span>`;
    }
}

function showFulldetails(pokemon) {
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => {
        toggleOverlay('hidden');
    });
    toggleOverlay('visible');

    currentPokemonIndex = allLoadedPokemons.findIndex(p => p.name === pokemon.name);
    renderpokefullCard(pokemon);
    addButtonsListeners(pokemon);
}

function toggleOverlay(state) {
    let overlay = document.getElementById('overlay');
    overlay.style.visibility = state;
    if (cryAudio) cryAudio.pause();
}

function renderpokefullCard(pokemon) {
    let fullCard = document.getElementById('fullCard');
    playCry(pokemon.id);
    fullCard.innerHTML = '';
    fullCard.innerHTML += renderCardTemplate(pokemon);
    fullCard.innerHTML += renderButtons();
    fullCard.innerHTML += renderInfobox();
}

async function addButtonsListeners(pokemon) {
    buttonsInfo.forEach(buttonId => {
        let button = document.getElementById(buttonId);
        button.addEventListener('click', async () => {
            let infobox = document.getElementById('infobox');
            infobox.innerHTML = '';
            infobox.innerHTML = await fillInfobox(pokemon, buttonId);
        });
    });
}

async function fillInfobox(pokemon, buttonId) {
    if (buttonId === 'evoButton') return await getEvolutionLine(pokemon.species.url);
    else if (buttonId === 'infoButton') return await getPokeInfo(pokemon.species.url);
    else return showStats(pokemon.stats);
}

async function getPokeInfo(url) {
    let result = await fetch(url);
    let resultJson = await result.json();
    return resultJson.flavor_text_entries[0].flavor_text.replace("\f", " ");
}

function renderCardTemplate(pokemon) {
    return `
    <div>
        <h2>${pokemon.name}</h2>
        <h2>#${pokemon.id}</h2>
    </div>
    <img src="${pokemon.sprites.front_shiny}" alt="">
    <div id="types">
        ${showTypes(pokemon)}
    </div>
    `;
}

function showStats(stats) {
    return `
    <table>
      <tr>
        <td>Stat Name</td>
        <td>Value</td>
      </tr>
      ${renderTable(stats)}
    </table>
    `;
}

function renderTable(stats) {
    let container = '';
    for (let i = 0; i < stats.length; i++) {
        container += `
        <tr>
          <td>${stats[i].stat.name}</td>
          <td>${stats[i].base_stat}</td>
        </tr>
        `;
    }
    return container;
}

function renderButtons() {
    return `
    <div>
        <button id="statsButton">STATS</button>
        <button id="evoButton">EVO</button>
        <button id="infoButton">INFO</button>
    </div>
    `;
}

function renderInfobox() {
    return `<div id="infobox"></div>`;
}

async function getEvolutionLine(speciesUrl) {
    let speciesRes = await fetch(speciesUrl);
    let species = await speciesRes.json();
    let chainRes = await fetch(species.evolution_chain.url);
    let chain = await chainRes.json();

    let evoList = [];
    let node = chain.chain;
    if (node) {
        for (let i = 0; i < 3; i++) {
            if (node.species) {
                let speciesName = node.species.name;
                let pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesName}`);
                let poke = await pokeRes.json();

                evoList.push({
                    weight: poke.weight,
                    name: poke.name,
                    id: poke.id,
                    img: poke.sprites.front_shiny
                });

                node = (node.evolves_to && node.evolves_to[0]) ? node.evolves_to[0] : [];
            }
        }
    }
    return renderEvolution(evoList);
}

function renderEvolution(evoList) {
    let evoDetails = '';
    for (let i = 0; i < evoList.length; i++) {
        evoDetails += `
        <div class="evo-item">
            <div class="evo-stage">${i === 0 ? 'Baby' : i === 1 ? 'Normal' : 'Evolved'}</div>
            <img class="evo-img" src="${evoList[i].img || ''}" alt="${evoList[i].name || ''}">
            <div class="evo-name">${evoList[i].name || ''}</div>
            <div class="evo-id">#${evoList[i].id ?? ''}</div>
        </div>`;
    }
    return `<div class="evo-grid">${evoDetails}</div>`;
}

async function showNextPokemon() {
    if (currentPokemonIndex < allLoadedPokemons.length - 1) {
        currentPokemonIndex++;
        let poke = allLoadedPokemons[currentPokemonIndex];
        let data = poke.data || await (await fetch(poke.url)).json();
        renderpokefullCard(data);
        addButtonsListeners(data);
    }
}

async function showPreviousPokemon() {
    if (currentPokemonIndex > 0) {
        currentPokemonIndex--;
        let poke = allLoadedPokemons[currentPokemonIndex];
        let data = poke.data || await (await fetch(poke.url)).json();
        renderpokefullCard(data);
        addButtonsListeners(data);
    }
}

function playCry(id) {
    cryAudio = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`);
    if (!isMuted) cryAudio.play();
}

function toggleMute() {
    document.getElementById("muteBtn").addEventListener("click", () => {
        isMuted = !isMuted;
        let button = document.getElementById("muteBtn");
        if (button) {
            button.textContent = !isMuted ? "🔊" : "🔇";
        }
    });
}
