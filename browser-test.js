const pages = await fetch("http://127.0.0.1:9333/json").then((response) => response.json());
const page = pages.find((entry) => entry.type === "page" && entry.url === "http://127.0.0.1:8765/");

if (!page) throw new Error("Testseite wurde nicht gefunden.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
let messageId = 0;

await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
        runtimeErrors.push(message.params.exceptionDetails.text);
    }
});

function command(method, params = {}) {
    const id = ++messageId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression, awaitPromise = false) {
    const response = await command("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
}

await command("Runtime.enable");
await evaluate(`new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
        if (document.body.classList.contains("app-ready") && document.querySelectorAll(".card").length === 20) resolve(true);
        else if (Date.now() - started > 15000) reject(new Error("Initial load timeout"));
        else setTimeout(check, 100);
    };
    check();
})`, true);

const results = {};
results.initial = await evaluate(`({
    cards: document.querySelectorAll(".card").length,
    dualCards: document.querySelectorAll(".card.type-dual").length,
    singleCards: document.querySelectorAll(".card.type-single").length,
    firstName: document.querySelector(".pokemon-name")?.textContent,
    loaderHidden: document.getElementById("initialLoader").hidden,
    searchEnabled: !document.getElementById("searchInput").disabled
})`);

results.search = await evaluate(`(() => {
    const input = document.getElementById("searchInput");
    input.value = "iv";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const names = [...document.querySelectorAll(".pokemon-name")].map((element) => element.textContent);
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { names, resetCount: document.querySelectorAll(".card").length };
})()`);

await evaluate("fetchPokes()", true);
results.loadMore = await evaluate(`({
    cards: document.querySelectorAll(".card").length,
    label: document.querySelector(".load-button-label").textContent,
    enabled: !document.getElementById("loadBtn").disabled
})`);

await evaluate("document.querySelector('.card').click()");
results.overlay = await evaluate(`({
    visible: document.getElementById("overlay").classList.contains("is-visible"),
    pokemonId: document.getElementById("fullCard").dataset.pokemonId,
    statRows: document.querySelectorAll(".stat-row").length,
    previousDisabled: document.getElementById("prevBtn").disabled,
    nextDisabled: document.getElementById("nextBtn").disabled
})`);

await evaluate("showNextPokemon()", true);
results.next = await evaluate(`({
    pokemonId: document.getElementById("fullCard").dataset.pokemonId,
    name: document.querySelector(".detail-name").textContent.trim()
})`);

await evaluate("document.getElementById('muteBtn').click()");
results.mute = await evaluate(`({
    pressed: document.getElementById("muteBtn").getAttribute("aria-pressed"),
    label: document.getElementById("muteBtn").getAttribute("aria-label")
})`);

await evaluate(`new Promise((resolve, reject) => {
    document.getElementById("evoButton").click();
    const started = Date.now();
    const check = () => {
        if (document.querySelectorAll(".evo-item").length) resolve(true);
        else if (document.querySelector(".panel-error")) reject(new Error("Evolution panel error"));
        else if (Date.now() - started > 15000) reject(new Error("Evolution timeout"));
        else setTimeout(check, 100);
    };
    check();
})`, true);
results.evolution = await evaluate(`({
    items: document.querySelectorAll(".evo-item").length,
    arrows: document.querySelectorAll(".evo-arrow").length,
    active: document.querySelector(".tab-button.is-active")?.id
})`);

await evaluate(`new Promise((resolve, reject) => {
    document.getElementById("infoButton").click();
    const started = Date.now();
    const check = () => {
        if (document.querySelector(".info-text")) resolve(true);
        else if (document.querySelector(".panel-error")) reject(new Error("Info panel error"));
        else if (Date.now() - started > 15000) reject(new Error("Info timeout"));
        else setTimeout(check, 100);
    };
    check();
})`, true);
results.info = await evaluate(`({
    hasText: document.querySelector(".info-text").textContent.trim().length > 20,
    active: document.querySelector(".tab-button.is-active")?.id
})`);

await evaluate("document.getElementById('closeBtn').click()");
results.close = await evaluate(`({
    visible: document.getElementById("overlay").classList.contains("is-visible"),
    bodyUnlocked: !document.body.classList.contains("overlay-open")
})`);
results.runtimeErrors = runtimeErrors;

console.log(JSON.stringify(results, null, 2));
socket.close();
