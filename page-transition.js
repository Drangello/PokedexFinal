document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", initializePageTransitions);
window.addEventListener("pageshow", handlePageShow);

function initializePageTransitions() {
    document.querySelectorAll("a[data-page-transition]").forEach((link) => {
        link.addEventListener("click", handlePageTransitionClick);
    });

    if (document.body.classList.contains("page-transition-loading")) {
        openMasterballForPageEntry();
    }
}

function handlePageShow(event) {
    if (!event.persisted) return;
    openMasterballAfterHistoryRestore();
}

function handlePageTransitionClick(event) {
    const link = event.currentTarget;

    if (!shouldAnimatePageTransition(event, link)) return;

    event.preventDefault();
    closeMasterballForPageExit(link.href);
}

function shouldAnimatePageTransition(event, link) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;

    const destination = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);

    if (destination.origin !== current.origin) return false;
    if (destination.href === current.href) return false;

    return true;
}

async function openMasterballForPageEntry() {
    const loader = document.getElementById("pageTransitionLoader");
    if (!loader) return;

    if (prefersReducedMotion()) {
        loader.hidden = true;
        document.body.classList.remove("page-transition-loading");
        return;
    }

    const topHalf = loader.querySelector(".loader-half--top");

    document.body.classList.add("page-transition-active", "page-transition-entering");

    await nextAnimationFrame();
    loader.classList.add("is-opening");
    await waitForPageTransition(topHalf);

    loader.hidden = true;
    document.body.classList.remove(
        "page-transition-loading",
        "page-transition-active",
        "page-transition-entering"
    );
}

async function closeMasterballForPageExit(destination) {
    if (document.body.classList.contains("page-transition-leaving")) return;

    if (prefersReducedMotion()) {
        window.location.assign(destination);
        return;
    }

    const loader = document.getElementById("initialLoader")
        || document.getElementById("pageTransitionLoader");

    if (!loader) {
        window.location.assign(destination);
        return;
    }

    const topHalf = loader.querySelector(".loader-half--top");
    const loadingText = loader.querySelector(".loader-copy");

    loader.classList.remove("is-fetching", "is-closing");
    loader.classList.add("is-opening", "is-page-transition");
    loader.hidden = false;

    if (loadingText) loadingText.textContent = "Seite wird gewechselt …";

    document.body.classList.add("page-transition-active", "page-transition-leaving");
    loader.getBoundingClientRect();

    loader.classList.add("is-closing");
    loader.classList.remove("is-opening");

    await waitForPageTransition(topHalf);
    window.location.assign(destination);
}

async function openMasterballAfterHistoryRestore() {
    const loader = document.getElementById("initialLoader")
        || document.getElementById("pageTransitionLoader");

    document.body.classList.remove("page-transition-leaving");

    if (!loader || prefersReducedMotion()) {
        if (loader) loader.hidden = true;
        document.body.classList.remove("page-transition-active", "page-transition-entering");
        return;
    }

    const topHalf = loader.querySelector(".loader-half--top");

    loader.classList.remove("is-fetching", "is-closing", "is-opening");
    loader.classList.add("is-page-transition");
    loader.hidden = false;
    document.body.classList.add("page-transition-active", "page-transition-entering");
    loader.getBoundingClientRect();

    await nextAnimationFrame();
    loader.classList.add("is-opening");
    await waitForPageTransition(topHalf);

    loader.hidden = true;
    loader.classList.remove("is-page-transition");
    document.body.classList.remove("page-transition-active", "page-transition-entering");
}

async function waitForPageTransition(element) {
    if (prefersReducedMotion()) {
        await nextAnimationFrame();
        return;
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const transformTransition = element.getAnimations().find((animation) => {
        return animation.transitionProperty === "transform";
    });

    if (!transformTransition) return;

    try {
        await transformTransition.finished;
    } catch {
        // Ein abgebrochener Übergang darf die Navigation nicht blockieren.
    }
}

function nextAnimationFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
