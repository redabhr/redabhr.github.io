(() => {
    'use strict';

    const VIDEO_ID = 'hXOOhN-wAxw';
    const VIDEO_RATIO = 16 / 9;
    const PLAYER_TIMEOUT_MS = 15000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    let apiPromise;
    let idleHandle;
    let player;
    let playerTimeout;
    let resizeFrame;
    let scheduled = false;
    let starting = false;
    let pausedWhileHidden = false;

    function canLoadVideo() {
        if (reducedMotion.matches || document.visibilityState !== 'visible') {
            return false;
        }

        if (!connection) {
            return true;
        }

        return !connection.saveData && !['slow-2g', '2g'].includes(connection.effectiveType);
    }

    function getPlayerElement() {
        return document.getElementById('redabhrBgVideo-player');
    }

    function resizePlayer() {
        const playerElement = getPlayerElement();
        if (!playerElement) {
            return;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let width;
        let height;
        let left;
        let top;

        if (viewportWidth / VIDEO_RATIO < viewportHeight) {
            width = Math.ceil(viewportHeight * VIDEO_RATIO);
            height = viewportHeight;
            left = Math.round((viewportWidth - width) / 2);
            top = 0;
        } else {
            width = viewportWidth;
            height = Math.ceil(viewportWidth / VIDEO_RATIO);
            left = 0;
            top = Math.round((viewportHeight - height) / 2);
        }

        Object.assign(playerElement.style, {
            width: `${width}px`,
            height: `${height}px`,
            left: `${left}px`,
            top: `${top}px`
        });
    }

    function queueResize() {
        if (resizeFrame) {
            return;
        }

        resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = undefined;
            resizePlayer();
        });
    }

    function createPlayerLayer() {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`);

        const parameters = {
            autoplay: '1',
            controls: '0',
            disablekb: '1',
            enablejsapi: '1',
            fs: '0',
            iv_load_policy: '3',
            loop: '1',
            playlist: VIDEO_ID,
            playsinline: '1',
            rel: '0'
        };

        if (location.protocol === 'http:' || location.protocol === 'https:') {
            parameters.origin = location.origin;
        }

        for (const [name, value] of Object.entries(parameters)) {
            embedUrl.searchParams.set(name, value);
        }

        container.id = 'redabhrBgVideo-container';
        container.setAttribute('aria-hidden', 'true');

        iframe.id = 'redabhrBgVideo-player';
        iframe.src = embedUrl.toString();
        iframe.title = 'Decorative background video';
        iframe.tabIndex = -1;
        iframe.allow = 'autoplay; encrypted-media';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.setAttribute('frameborder', '0');

        container.append(iframe);
        document.body.prepend(container);
        resizePlayer();
    }

    function removePlayerLayer() {
        window.clearTimeout(playerTimeout);
        const currentPlayer = player;
        player = undefined;

        if (currentPlayer && typeof currentPlayer.destroy === 'function') {
            try {
                currentPlayer.destroy();
            } catch {
                // The iframe may already have been removed by the browser or the API.
            }
        }

        document.getElementById('redabhrBgVideo-container')?.remove();
        starting = false;
        pausedWhileHidden = false;
    }

    function loadYouTubeApi() {
        if (window.YT?.Player) {
            return Promise.resolve(window.YT);
        }

        if (apiPromise) {
            return apiPromise;
        }

        apiPromise = new Promise((resolve, reject) => {
            const apiTimeout = window.setTimeout(() => reject(new Error('YouTube API timeout')), PLAYER_TIMEOUT_MS);
            const previousCallback = window.onYouTubeIframeAPIReady;
            const script = document.createElement('script');

            window.onYouTubeIframeAPIReady = () => {
                window.clearTimeout(apiTimeout);
                if (typeof previousCallback === 'function') {
                    previousCallback();
                }
                resolve(window.YT);
            };

            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.onerror = () => {
                window.clearTimeout(apiTimeout);
                reject(new Error('Unable to load the YouTube API'));
            };
            document.head.append(script);
        }).catch((error) => {
            apiPromise = undefined;
            throw error;
        });

        return apiPromise;
    }

    function handlePlayerReady(event) {
        resizePlayer();
        event.target.mute();

        if (document.visibilityState !== 'visible') {
            event.target.pauseVideo();
            pausedWhileHidden = true;
            return;
        }

        event.target.seekTo(0, true);
        event.target.playVideo();
    }

    function handlePlayerStateChange(event) {
        const container = document.getElementById('redabhrBgVideo-container');
        const isPlaying = event.data === window.YT.PlayerState.PLAYING;

        container?.classList.toggle('is-ready', isPlaying);

        if (isPlaying) {
            window.clearTimeout(playerTimeout);
        }

        if (event.data === window.YT.PlayerState.ENDED) {
            event.target.seekTo(0, true);
            event.target.playVideo();
        }
    }

    async function startVideo() {
        scheduled = false;
        if (starting || player || !canLoadVideo()) {
            return;
        }

        starting = true;

        try {
            await loadYouTubeApi();
            if (!canLoadVideo()) {
                starting = false;
                return;
            }

            createPlayerLayer();
            player = new window.YT.Player('redabhrBgVideo-player', {
                events: {
                    onReady: handlePlayerReady,
                    onStateChange: handlePlayerStateChange,
                    onError: removePlayerLayer
                }
            });
            starting = false;

            playerTimeout = window.setTimeout(removePlayerLayer, PLAYER_TIMEOUT_MS);
        } catch {
            removePlayerLayer();
        }
    }

    function scheduleVideo() {
        if (scheduled || starting || player || !canLoadVideo()) {
            return;
        }

        scheduled = true;
        if ('requestIdleCallback' in window) {
            idleHandle = window.requestIdleCallback(startVideo, { timeout: 2500 });
        } else {
            idleHandle = window.setTimeout(startVideo, 1000);
        }
    }

    function cancelScheduledVideo() {
        if (!scheduled) {
            return;
        }

        if ('cancelIdleCallback' in window) {
            window.cancelIdleCallback(idleHandle);
        } else {
            window.clearTimeout(idleHandle);
        }
        scheduled = false;
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            cancelScheduledVideo();
            document.getElementById('redabhrBgVideo-container')?.classList.remove('is-ready');
            if (player && typeof player.pauseVideo === 'function') {
                try {
                    player.pauseVideo();
                    pausedWhileHidden = true;
                } catch {
                    removePlayerLayer();
                }
            }
            return;
        }

        if (pausedWhileHidden && player && typeof player.playVideo === 'function') {
            pausedWhileHidden = false;
            try {
                player.playVideo();
            } catch {
                removePlayerLayer();
            }
        } else {
            scheduleVideo();
        }
    }

    function handlePlaybackPreferenceChange() {
        if (!canLoadVideo()) {
            cancelScheduledVideo();
            removePlayerLayer();
        } else {
            scheduleVideo();
        }
    }

    window.addEventListener('resize', queueResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotion.addEventListener?.('change', handlePlaybackPreferenceChange);
    connection?.addEventListener?.('change', handlePlaybackPreferenceChange);

    if (document.readyState === 'complete') {
        scheduleVideo();
    } else {
        window.addEventListener('load', scheduleVideo, { once: true });
    }
})();
