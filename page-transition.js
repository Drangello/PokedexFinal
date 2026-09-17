document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", initializePageTransitions);

function initializePageTransitions() {
    document.querySelectorAll("a[data-page-transition]").forEach((link) => {
        link.addEventListener("click", handlePageTransitionClick);
    });

    if (document.body.classList.contains("page-transition-loading")) {
        openMasterballForPageEntry();
    }
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
    const transitionFinished = waitForPageTransition(topHalf);

    document.body.classList.add("page-transition-active", "page-transition-entering");

    await nextAnimationFrame();
    loader.classList.add("is-opening");
    await transitionFinished;

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

    const transitionFinished = waitForPageTransition(topHalf);
    loader.classList.add("is-closing");
    loader.classList.remove("is-opening");

    await transitionFinished;
    window.location.assign(destination);
}

function waitForPageTransition(element) {
    if (prefersReducedMotion()) return nextAnimationFrame();

    return new Promise((resolve) => {
        const handleTransitionEnd = (event) => {
            if (event.target !== element || event.propertyName !== "transform") return;
            element.removeEventListener("transitionend", handleTransitionEnd);
            resolve();
        };

        element.addEventListener("transitionend", handleTransitionEnd);
    });
}

function nextAnimationFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
