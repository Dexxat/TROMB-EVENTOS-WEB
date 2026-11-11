"use strict";
const streamerColors = ["#d7ff70", "#4fd6e8", "#9e8cff", "#ffffff", "#2e6fe0"];
const streamers = [];
const confettiCanvas = document.createElement("canvas");
const confettiContext = confettiCanvas.getContext("2d");
let canvasWidth = 0;
let canvasHeight = 0;
let pixelRatio = 1;
let animationFrame = 0;
let burstStartedAt = 0;
confettiCanvas.className = "confetti-canvas";
confettiCanvas.setAttribute("aria-hidden", "true");
confettiCanvas.hidden = true;
document.body.append(confettiCanvas);
function resizeCanvas() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    confettiCanvas.width = Math.round(canvasWidth * pixelRatio);
    confettiCanvas.height = Math.round(canvasHeight * pixelRatio);
    confettiCanvas.style.width = `${canvasWidth}px`;
    confettiCanvas.style.height = `${canvasHeight}px`;
    confettiContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}
function launchStreamers() {
    if (!confettiContext)
        return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
    const originX = canvasWidth / 2;
    const originY = canvasHeight / 2;
    const quantity = 88;
    for (let index = 0; index < quantity; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3.2 + Math.random() * 7.8;
        streamers.push({
            x: originX + (Math.random() - 0.5) * 22,
            y: originY + (Math.random() - 0.5) * 18,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed - 1.8,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.22,
            length: 14 + Math.random() * 24,
            width: 1.8 + Math.random() * 2.2,
            color: streamerColors[Math.floor(Math.random() * streamerColors.length)],
            age: 0,
            lifespan: 100 + Math.random() * 48,
            wave: 3 + Math.random() * 9,
            phase: Math.random() * Math.PI * 2,
        });
    }
    burstStartedAt = performance.now();
    confettiCanvas.hidden = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(drawStreamers);
}
function drawStreamer(context, streamer) {
    const progress = streamer.age / streamer.lifespan;
    const fadeIn = Math.min(progress * 12, 1);
    const fadeOut = progress > 0.62 ? 1 - (progress - 0.62) / 0.38 : 1;
    context.save();
    context.globalAlpha = Math.max(0, fadeIn * fadeOut);
    context.translate(streamer.x, streamer.y);
    context.rotate(streamer.rotation);
    context.strokeStyle = streamer.color;
    context.lineWidth = streamer.width;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, -streamer.length / 2);
    context.bezierCurveTo(streamer.wave, -streamer.length / 4, -streamer.wave, streamer.length / 4, 0, streamer.length / 2);
    context.stroke();
    context.restore();
}
function drawStreamers(now) {
    if (!confettiContext)
        return;
    confettiContext.clearRect(0, 0, canvasWidth, canvasHeight);
    const burstAge = now - burstStartedAt;
    if (burstAge < 220) {
        const progress = burstAge / 220;
        const radius = 12 + progress * 74;
        const glow = confettiContext.createRadialGradient(canvasWidth / 2, canvasHeight / 2, 0, canvasWidth / 2, canvasHeight / 2, radius);
        glow.addColorStop(0, `rgba(215, 255, 112, ${0.34 * (1 - progress)})`);
        glow.addColorStop(1, "rgba(79, 214, 232, 0)");
        confettiContext.fillStyle = glow;
        confettiContext.fillRect(canvasWidth / 2 - radius, canvasHeight / 2 - radius, radius * 2, radius * 2);
    }
    for (let index = streamers.length - 1; index >= 0; index -= 1) {
        const streamer = streamers[index];
        streamer.age += 1;
        streamer.velocityY += 0.105;
        streamer.velocityX *= 0.992;
        streamer.x += streamer.velocityX;
        streamer.y += streamer.velocityY;
        streamer.rotation += streamer.spin;
        streamer.phase += 0.16;
        streamer.x += Math.sin(streamer.phase) * 0.55;
        drawStreamer(confettiContext, streamer);
        if (streamer.age >= streamer.lifespan || streamer.y > canvasHeight + 50) {
            streamers.splice(index, 1);
        }
    }
    if (streamers.length > 0) {
        animationFrame = requestAnimationFrame(drawStreamers);
    }
    else {
        confettiContext.clearRect(0, 0, canvasWidth, canvasHeight);
        confettiCanvas.hidden = true;
    }
}
/* --------------------------------------------------------------------------
   Navegación interna
   Lleva cada enlace "#seccion" a su sección compensando el header fijo:
   - si la sección entra completa en pantalla, queda centrada verticalmente;
   - si es más alta que la pantalla, se alinea su título (kicker + h2) debajo
     del header con un margen de respiro, para que nunca quede cortado.
   -------------------------------------------------------------------------- */
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function getHeaderHeight() {
    const header = document.querySelector(".site-header");
    return header ? header.getBoundingClientRect().height : 0;
}
function getScrollTarget(section) {
    const headerHeight = getHeaderHeight();
    const visibleHeight = window.innerHeight - headerHeight;
    const sectionRect = section.getBoundingClientRect();
    const sectionTop = sectionRect.top + window.scrollY;
    let target;
    if (sectionRect.height <= visibleHeight) {
        target = sectionTop - headerHeight - (visibleHeight - sectionRect.height) / 2;
    }
    else {
        const heading = section.querySelector(".section-kicker") ?? section;
        const headingTop = heading.getBoundingClientRect().top + window.scrollY;
        const breathing = Math.min(56, Math.max(24, visibleHeight * 0.06));
        target = Math.max(sectionTop - headerHeight, headingTop - headerHeight - breathing);
    }
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round(Math.min(Math.max(target, 0), maxScroll));
}
function scrollToSection(section, smooth = true) {
    window.scrollTo({
        top: getScrollTarget(section),
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
    if (!section.hasAttribute("tabindex"))
        section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
}
function closeMobileMenu() {
    const menu = document.querySelector("#main-nav");
    const menuButton = document.querySelector("#menu-toggle");
    if (!menu || !menuButton)
        return;
    menu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "☰";
}
function initializeMenuToggle() {
    const menu = document.querySelector("#main-nav");
    const menuButton = document.querySelector("#menu-toggle");
    if (!menu || !menuButton)
        return;
    menuButton.addEventListener("click", () => {
        const open = menu.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.textContent = open ? "×" : "☰";
    });
}
function initializeAnchorNavigation() {
    document.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0)
            return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const link = event.target?.closest('a[href^="#"]');
        if (!link)
            return;
        const hash = link.getAttribute("href") ?? "";
        if (hash.length < 2)
            return;
        if (link.closest("#main-nav"))
            closeMobileMenu();
        if (hash === "#top") {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
            history.pushState(null, "", window.location.pathname + window.location.search);
            return;
        }
        const section = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (!section)
            return;
        event.preventDefault();
        scrollToSection(section);
        history.pushState(null, "", hash);
    });
    // Si se entra con un hash en la URL (o se navega con atrás/adelante), corregir la posición.
    const alignToHash = (smooth) => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        const section = id ? document.getElementById(id) : null;
        if (section)
            scrollToSection(section, smooth);
    };
    window.addEventListener("popstate", () => alignToHash(true));
    if (window.location.hash) {
        window.addEventListener("load", () => alignToHash(false), { once: true });
    }
}
function initializeActiveNav() {
    const links = Array.from(document.querySelectorAll('#main-nav > a[href^="#"]'));
    const entries = links
        .map((link) => ({
        link,
        section: document.getElementById((link.getAttribute("href") ?? "").slice(1)),
    }))
        .filter((entry) => !!entry.section);
    if (entries.length === 0)
        return;
    let ticking = false;
    const update = () => {
        ticking = false;
        const probe = getHeaderHeight() + (window.innerHeight - getHeaderHeight()) * 0.4;
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        let current = null;
        for (const { link, section } of entries) {
            if (section.getBoundingClientRect().top <= probe)
                current = link;
        }
        if (atBottom)
            current = entries[entries.length - 1].link;
        for (const { link } of entries) {
            const active = link === current;
            link.classList.toggle("is-active", active);
            if (active)
                link.setAttribute("aria-current", "true");
            else
                link.removeAttribute("aria-current");
        }
    };
    const requestUpdate = () => {
        if (ticking)
            return;
        ticking = true;
        requestAnimationFrame(update);
    };
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    update();
}
function initializeMotion() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        requestAnimationFrame(() => heroTitle.classList.add("is-animating"));
    }
    const brand = document.querySelector(".site-header .brand");
    brand?.addEventListener("click", launchStreamers);
    initializeMenuToggle();
    initializeAnchorNavigation();
    initializeActiveNav();
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeMotion, { once: true });
}
else {
    initializeMotion();
}
