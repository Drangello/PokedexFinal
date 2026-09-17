(() => {
    const galaxyConfig = {
        maxDpr: 2,
        desktopStars: 155,
        tabletStars: 110,
        mobileStars: 72,
        tabletBreakpoint: 900,
        mobileBreakpoint: 560,
        burstDuration: 460,
        maxShootingStarsDesktop: 2,
        maxShootingStarsMobile: 1
    };

    const starColors = [
        "#ffffff",
        "#f2eaff",
        "#efd7ff",
        "#ffddec",
        "#dceaff"
    ];

    const state = {
        canvas: null,
        context: null,
        width: 0,
        height: 0,
        dpr: 1,
        stars: [],
        shootingStars: [],
        frameId: 0,
        resizeFrameId: 0,
        lastTime: 0,
        nextShootingStarAt: 0,
        scrollY: 0,
        reducedMotion: false,
        motionQuery: null,
        tense: false,
        intensity: 1,
        targetIntensity: 1,
        burstStartedAt: -Infinity,
        burstStrength: 1
    };

    document.addEventListener("DOMContentLoaded", initGalaxy);

    function initGalaxy() {
        state.canvas = document.getElementById("galaxyCanvas");
        if (!state.canvas) return;

        state.context = state.canvas.getContext("2d", { alpha: true });
        if (!state.context) return;

        state.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        state.reducedMotion = state.motionQuery.matches;
        state.scrollY = window.scrollY;

        state.motionQuery.addEventListener("change", handleMotionPreferenceChange);
        window.addEventListener("resize", queueGalaxyResize, { passive: true });
        window.addEventListener("scroll", handleGalaxyScroll, { passive: true });
        document.addEventListener("visibilitychange", handleGalaxyVisibility);

        const startsTense = document.body.classList.contains("initial-loading")
            || document.body.classList.contains("page-transition-loading");

        setGalaxyTension(startsTense);
        resizeGalaxy();
        scheduleNextShootingStar(performance.now());
        startGalaxyAnimation();
    }

    function resizeGalaxy() {
        if (!state.canvas || !state.context) return;

        state.resizeFrameId = 0;
        state.width = Math.max(window.innerWidth, 1);
        state.height = Math.max(window.innerHeight, 1);
        state.dpr = Math.min(window.devicePixelRatio || 1, galaxyConfig.maxDpr);

        state.canvas.width = Math.round(state.width * state.dpr);
        state.canvas.height = Math.round(state.height * state.dpr);
        state.canvas.style.width = `${state.width}px`;
        state.canvas.style.height = `${state.height}px`;
        state.context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

        createStars();
        updateGalaxyDiagnostics();
        drawGalaxy(performance.now(), 0);
    }

    function queueGalaxyResize() {
        if (state.resizeFrameId) cancelAnimationFrame(state.resizeFrameId);
        state.resizeFrameId = requestAnimationFrame(resizeGalaxy);
    }

    function createStars() {
        const starCount = getStarCount();
        state.stars.length = 0;

        for (let index = 0; index < starCount; index++) {
            const depthRoll = Math.random();
            const depth = depthRoll < 0.54 ? 0 : depthRoll < 0.88 ? 1 : 2;
            const radiusRanges = [
                [0.28, 0.68],
                [0.52, 1.05],
                [0.9, 1.65]
            ];
            const [minimumRadius, maximumRadius] = radiusRanges[depth];
            const direction = Math.random() * Math.PI * 2;
            const driftSpeed = [0.22, 0.48, 0.82][depth] * randomBetween(0.65, 1.2);

            state.stars.push({
                x: Math.random(),
                y: Math.random(),
                radius: randomBetween(minimumRadius, maximumRadius),
                alpha: randomBetween(0.34, depth === 2 ? 0.9 : 0.74),
                twinkleSpeed: randomBetween(0.38, 1.05),
                twinklePhase: Math.random() * Math.PI * 2,
                depth,
                driftX: Math.cos(direction) * driftSpeed,
                driftY: Math.sin(direction) * driftSpeed,
                burstWeight: randomBetween(0.72, 1.12),
                color: chooseStarColor()
            });
        }
    }

    function getStarCount() {
        if (state.width <= galaxyConfig.mobileBreakpoint) return galaxyConfig.mobileStars;
        if (state.width <= galaxyConfig.tabletBreakpoint) return galaxyConfig.tabletStars;
        return galaxyConfig.desktopStars;
    }

    function chooseStarColor() {
        const roll = Math.random();
        if (roll < 0.58) return starColors[0];
        if (roll < 0.74) return starColors[1];
        if (roll < 0.85) return starColors[2];
        if (roll < 0.93) return starColors[3];
        return starColors[4];
    }

    function animateGalaxy(time) {
        state.frameId = 0;
        if (document.hidden || state.reducedMotion) return;

        const delta = Math.min((time - state.lastTime) / 1000, 0.05) || 0;
        state.lastTime = time;
        drawGalaxy(time, delta);
        maybeSpawnShootingStar(time);
        state.frameId = requestAnimationFrame(animateGalaxy);
    }

    function drawGalaxy(time, delta) {
        const context = state.context;
        if (!context) return;

        context.clearRect(0, 0, state.width, state.height);
        updateGalaxyIntensity(delta);

        const burstProgress = getBurstProgress(time);
        if (burstProgress >= 1 && state.canvas.dataset.burstActive === "true") {
            state.canvas.dataset.burstActive = "false";
        }
        const burstPulse = burstProgress < 1 ? Math.sin(burstProgress * Math.PI) : 0;
        const centerX = state.width / 2;
        const centerY = state.height / 2;
        const influenceRadius = Math.min(state.width, state.height) * 0.5;
        const parallaxBase = state.reducedMotion ? 0 : state.scrollY;

        for (const star of state.stars) {
            if (!state.reducedMotion && delta > 0) updateStarPosition(star, delta);

            let x = star.x * state.width;
            let y = star.y * state.height;
            y -= parallaxBase * (0.0008 + star.depth * 0.00065);
            y = wrapCoordinate(y, state.height);

            const distanceX = x - centerX;
            const distanceY = y - centerY;
            const distance = Math.hypot(distanceX, distanceY);
            const centerInfluence = Math.max(0, 1 - distance / influenceRadius);

            if (burstPulse > 0 && distance > 0.5) {
                const burstDistance = burstPulse
                    * centerInfluence
                    * star.burstWeight
                    * state.burstStrength
                    * (7 + star.depth * 4);
                x += (distanceX / distance) * burstDistance;
                y += (distanceY / distance) * burstDistance;
            }

            const twinkle = state.reducedMotion
                ? 0.88
                : 0.76 + Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase) * 0.24;
            const burstBrightness = 1 + centerInfluence * burstPulse * 0.95 * state.burstStrength;
            const alpha = Math.min(1, star.alpha * twinkle * state.intensity * burstBrightness);

            drawStar(star, x, y, alpha);
        }

        updateAndDrawShootingStars(delta);
        drawGalaxyShockwave(burstProgress);
        context.globalAlpha = 1;
        context.shadowBlur = 0;
    }

    function updateStarPosition(star, delta) {
        star.x = wrapUnit(star.x + (star.driftX * delta) / state.width);
        star.y = wrapUnit(star.y + (star.driftY * delta) / state.height);
    }

    function drawStar(star, x, y, alpha) {
        const context = state.context;
        context.globalAlpha = alpha;
        context.fillStyle = star.color;

        if (star.depth === 2 && star.radius > 1.2) {
            context.shadowColor = star.color;
            context.shadowBlur = 5;
        } else {
            context.shadowBlur = 0;
        }

        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();

        if (star.depth === 2 && star.radius > 1.35) {
            context.globalAlpha = alpha * 0.38;
            context.lineWidth = 0.55;
            context.strokeStyle = star.color;
            context.beginPath();
            context.moveTo(x - star.radius * 2.6, y);
            context.lineTo(x + star.radius * 2.6, y);
            context.moveTo(x, y - star.radius * 2.6);
            context.lineTo(x, y + star.radius * 2.6);
            context.stroke();
        }
    }

    function maybeSpawnShootingStar(time) {
        if (state.reducedMotion || state.tense || time < state.nextShootingStarAt) return;

        const maximum = state.width <= galaxyConfig.mobileBreakpoint
            ? galaxyConfig.maxShootingStarsMobile
            : galaxyConfig.maxShootingStarsDesktop;

        if (state.shootingStars.length < maximum) spawnShootingStar();
        scheduleNextShootingStar(time);
    }

    function spawnShootingStar() {
        const speed = randomBetween(520, 760);
        const angle = randomBetween(0.48, 0.68);
        const startsNearTop = Math.random() > 0.28;

        state.shootingStars.push({
            x: startsNearTop ? randomBetween(-40, state.width * 0.72) : -40,
            y: startsNearTop ? randomBetween(-30, state.height * 0.2) : randomBetween(0, state.height * 0.42),
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            speed,
            length: randomBetween(74, state.width <= galaxyConfig.mobileBreakpoint ? 105 : 145),
            age: 0,
            duration: randomBetween(620, 880),
            color: Math.random() > 0.72 ? "255, 220, 236" : "255, 247, 218"
        });
    }

    function updateAndDrawShootingStars(delta) {
        const context = state.context;

        for (let index = state.shootingStars.length - 1; index >= 0; index--) {
            const shootingStar = state.shootingStars[index];
            shootingStar.age += delta * 1000;
            shootingStar.x += shootingStar.velocityX * delta;
            shootingStar.y += shootingStar.velocityY * delta;

            const progress = shootingStar.age / shootingStar.duration;
            if (progress >= 1 || shootingStar.x > state.width + shootingStar.length || shootingStar.y > state.height + shootingStar.length) {
                state.shootingStars.splice(index, 1);
                continue;
            }

            const directionX = shootingStar.velocityX / shootingStar.speed;
            const directionY = shootingStar.velocityY / shootingStar.speed;
            const tailX = shootingStar.x - directionX * shootingStar.length;
            const tailY = shootingStar.y - directionY * shootingStar.length;
            const opacity = Math.sin(progress * Math.PI) * 0.78;
            const gradient = context.createLinearGradient(tailX, tailY, shootingStar.x, shootingStar.y);
            gradient.addColorStop(0, `rgba(${shootingStar.color}, 0)`);
            gradient.addColorStop(0.72, `rgba(${shootingStar.color}, ${opacity * 0.3})`);
            gradient.addColorStop(1, `rgba(${shootingStar.color}, ${opacity})`);

            context.globalAlpha = 1;
            context.strokeStyle = gradient;
            context.lineWidth = 1.15;
            context.shadowColor = `rgba(${shootingStar.color}, ${opacity})`;
            context.shadowBlur = 7;
            context.beginPath();
            context.moveTo(tailX, tailY);
            context.lineTo(shootingStar.x, shootingStar.y);
            context.stroke();

            context.fillStyle = `rgba(${shootingStar.color}, ${opacity})`;
            context.beginPath();
            context.arc(shootingStar.x, shootingStar.y, 1.35, 0, Math.PI * 2);
            context.fill();
        }
    }

    function drawGalaxyShockwave(progress) {
        if (progress >= 1 || state.reducedMotion) return;

        const context = state.context;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const radius = easedProgress * Math.min(state.width, state.height) * 0.19;
        const opacity = Math.sin(progress * Math.PI) * 0.13 * state.burstStrength;

        context.globalAlpha = opacity;
        context.strokeStyle = "#f1c8ff";
        context.lineWidth = 1.1;
        context.shadowColor = "rgba(238, 157, 255, 0.45)";
        context.shadowBlur = 8;
        context.beginPath();
        context.arc(state.width / 2, state.height / 2, radius, 0, Math.PI * 2);
        context.stroke();
    }

    function triggerGalaxyBurst() {
        if (state.reducedMotion || !state.canvas) return;

        state.burstStartedAt = performance.now();
        state.burstStrength = state.width <= galaxyConfig.mobileBreakpoint ? 0.58 : 1;
        state.canvas.dataset.burstActive = "true";
        state.canvas.dataset.burstCount = String(Number(state.canvas.dataset.burstCount || 0) + 1);
        startGalaxyAnimation();
    }

    function getBurstProgress(time) {
        return Math.min(1, Math.max(0, (time - state.burstStartedAt) / galaxyConfig.burstDuration));
    }

    function setGalaxyTension(active) {
        state.tense = Boolean(active);
        state.targetIntensity = state.tense ? 0.64 : 1;
        document.body?.classList.toggle("galaxy-tense", state.tense);
        if (state.canvas) state.canvas.dataset.tense = String(state.tense);

        if (state.tense) state.shootingStars.length = 0;
        if (state.reducedMotion) drawGalaxy(performance.now(), 0);
    }

    function updateGalaxyIntensity(delta) {
        if (delta <= 0) {
            state.intensity = state.targetIntensity;
            return;
        }

        const blend = Math.min(1, delta * 2.8);
        state.intensity += (state.targetIntensity - state.intensity) * blend;
    }

    function handleGalaxyScroll() {
        state.scrollY = window.scrollY;
        if (state.reducedMotion) drawGalaxy(performance.now(), 0);
    }

    function handleGalaxyVisibility() {
        const isPaused = document.hidden;
        state.canvas.dataset.paused = String(isPaused);

        if (isPaused) {
            if (state.frameId) cancelAnimationFrame(state.frameId);
            state.frameId = 0;
            return;
        }

        state.lastTime = performance.now();
        startGalaxyAnimation();
    }

    function handleMotionPreferenceChange(event) {
        state.reducedMotion = event.matches;
        state.shootingStars.length = 0;
        updateGalaxyDiagnostics();

        if (state.frameId) cancelAnimationFrame(state.frameId);
        state.frameId = 0;
        state.lastTime = performance.now();

        if (state.reducedMotion) drawGalaxy(state.lastTime, 0);
        else startGalaxyAnimation();
    }

    function startGalaxyAnimation() {
        if (state.frameId || document.hidden || state.reducedMotion || !state.context) return;
        state.lastTime = performance.now();
        state.frameId = requestAnimationFrame(animateGalaxy);
    }

    function scheduleNextShootingStar(time) {
        const isMobile = state.width <= galaxyConfig.mobileBreakpoint;
        const minimumDelay = isMobile ? 12000 : 6800;
        const maximumDelay = isMobile ? 22000 : 13500;
        state.nextShootingStarAt = time + randomBetween(minimumDelay, maximumDelay);
    }

    function updateGalaxyDiagnostics() {
        if (!state.canvas) return;
        state.canvas.dataset.starCount = String(state.stars.length);
        state.canvas.dataset.dpr = String(state.dpr);
        state.canvas.dataset.reducedMotion = String(state.reducedMotion);
        state.canvas.dataset.paused = String(document.hidden);
        state.canvas.dataset.tense = String(state.tense);
        if (!state.canvas.dataset.burstActive) state.canvas.dataset.burstActive = "false";
        if (!state.canvas.dataset.burstCount) state.canvas.dataset.burstCount = "0";
    }

    function randomBetween(minimum, maximum) {
        return minimum + Math.random() * (maximum - minimum);
    }

    function wrapUnit(value) {
        if (value < 0) return value + 1;
        if (value >= 1) return value - 1;
        return value;
    }

    function wrapCoordinate(value, maximum) {
        if (value < 0) return value + maximum;
        if (value >= maximum) return value - maximum;
        return value;
    }

    window.triggerGalaxyBurst = triggerGalaxyBurst;
    window.setGalaxyTension = setGalaxyTension;
})();
