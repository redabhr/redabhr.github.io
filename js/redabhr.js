(() => {
    'use strict';

    console.info(
        '%c+--------------------------------------------------+\n'
        + '| RÉDA BOUHADDAR                                   |\n'
        + '| ENTERPRISE ARCHITECT                             |\n'
        + '|                                                  |\n'
        + '| ARCHITECTING COHERENCE. ENABLING THE FUTURE.     |\n'
        + '| https://reda.bouhaddar.com                       |\n'
        + '+--------------------------------------------------+',
        'font-weight:600;color:##014e61'
    );

    const currentScript = document.currentScript;
    const tokenEndpoint = resolveTokenEndpoint();
    const hlsScriptUrl = new URL(
        'vendor/hls.light.min-1.7.0.js',
        currentScript?.src || document.baseURI
    ).toString();
    const muxScriptUrl = new URL(
        'vendor/mux-embed-5.18.0.js',
        currentScript?.src || document.baseURI
    ).toString();
    const muxDataEnvKey = currentScript?.dataset.muxDataEnvKey?.trim();
    const PLAYER_TIMEOUT_MS = 15000;
    const TOKEN_TIMEOUT_MS = 6000;
    const TOKEN_EXPIRY_MARGIN_SECONDS = 10;
    const STALL_FALLBACK_DELAY_MS = 2500;
    const DESKTOP_VIDEO_DELAY_MS = 2200;
    const CONSTRAINED_VIDEO_DELAY_MS = 3500;
    const MOBILE_VIDEO_DELAY_MS = 4500;
    const VIDEO_PLAYBACK_RATE = 0.85;
    const LOOP_START_SECONDS = 0.02;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const portraitVideo = window.matchMedia('(max-width: 720px) and (max-aspect-ratio: 3/4)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const videoToggle = document.getElementById('video-toggle');

    let activeTokenExpiresAt = 0;
    let hls;
    let hlsPromise;
    let muxPromise;
    let idleHandle;
    let videoDelayHandle;
    let playerTimeout;
    let stallFallbackTimeout;
    let scheduled = false;
    let starting = false;
    let pausedWhileHidden = false;
    let mediaRecoveryAttempts = 0;
    let networkRecoveryAttempts = 0;
    let userPaused = readPlaybackPreference();

    function readPlaybackPreference() {
        try {
            return window.localStorage.getItem('background-video') === 'paused';
        } catch {
            return false;
        }
    }

    function writePlaybackPreference(paused) {
        try {
            window.localStorage.setItem('background-video', paused ? 'paused' : 'playing');
        } catch {
            // Storage may be unavailable in privacy-restricted contexts.
        }
    }

    function updateVideoToggle() {
        if (!videoToggle) {
            return;
        }

        const container = document.getElementById('redabhrBgVideo-container');
        const unavailable = reducedMotion.matches || !tokenEndpoint;
        const hasReadyVideo = getVideoElement() && container?.classList.contains('is-ready');
        videoToggle.hidden = unavailable || (!hasReadyVideo && !userPaused);
        videoToggle.setAttribute('aria-pressed', String(userPaused));
        videoToggle.setAttribute(
            'aria-label',
            userPaused ? 'Play background animation' : 'Pause background animation'
        );
    }

    function resolveTokenEndpoint() {
        const configuredEndpoint = currentScript?.dataset.videoTokenEndpoint;
        if (configuredEndpoint) {
            return parseTokenEndpoint(configuredEndpoint);
        }

        if (window.location.protocol === 'http:' && window.location.hostname === 'localhost') {
            return new URL('http://localhost:8787/token');
        }

        return undefined;
    }

    function parseTokenEndpoint(value) {
        if (!value) {
            return undefined;
        }

        try {
            const url = new URL(value, document.baseURI);
            if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
                return undefined;
            }

            return url;
        } catch {
            return undefined;
        }
    }

    function canLoadVideo() {
        if (!tokenEndpoint || userPaused || reducedMotion.matches || document.visibilityState !== 'visible') {
            return false;
        }

        if (!connection) {
            return true;
        }

        return !connection.saveData && !['slow-2g', '2g'].includes(connection.effectiveType);
    }

    function getRequestedVariant() {
        return portraitVideo.matches ? 'portrait' : 'landscape';
    }

    function getDisplayWidth() {
        const pixelRatio = Math.min(Number(window.devicePixelRatio) || 1, 2);
        return window.innerWidth * pixelRatio;
    }

    function getMaximumResolution() {
        if (portraitVideo.matches || window.innerWidth <= 720) {
            return 720;
        }

        const isConstrainedConnection = connection?.effectiveType
            && connection.effectiveType !== '4g';
        if (isConstrainedConnection) {
            return 1080;
        }

        const displayWidth = getDisplayWidth();
        if (displayWidth >= 3840) {
            return 2160;
        }
        return displayWidth >= 2560 ? 1440 : 1080;
    }

    function getInitialBandwidthEstimate() {
        if (connection?.effectiveType && connection.effectiveType !== '4g') {
            const downlinkMbps = Number(connection.downlink);
            if (Number.isFinite(downlinkMbps) && downlinkMbps > 0) {
                return Math.min(5000000, Math.max(1000000, downlinkMbps * 700000));
            }
            return 1500000;
        }

        if (portraitVideo.matches || window.innerWidth <= 720) {
            return 2500000;
        }

        const displayWidth = getDisplayWidth();
        if (displayWidth >= 3840) {
            return 20000000;
        }
        if (displayWidth >= 2560) {
            return 8000000;
        }
        return 5000000;
    }

    async function fetchPlaybackUrl() {
        const endpoint = new URL(tokenEndpoint);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

        endpoint.searchParams.set('variant', getRequestedVariant());

        try {
            const response = await fetch(endpoint, {
                cache: 'no-store',
                credentials: 'omit',
                headers: { Accept: 'application/json' },
                mode: 'cors',
                referrerPolicy: 'strict-origin',
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Video token endpoint returned ${response.status}`);
            }

            return validatePlaybackResponse(await response.json());
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function validatePlaybackResponse(payload) {
        const expiresAt = Number(payload?.expiresAt);
        let playbackUrl;

        try {
            playbackUrl = new URL(payload?.url);
        } catch {
            throw new Error('Invalid signed playback URL');
        }

        const isMuxHlsUrl = playbackUrl.protocol === 'https:'
            && playbackUrl.hostname === 'stream.mux.com'
            && /^\/[A-Za-z0-9_-]{10,255}\.m3u8$/u.test(playbackUrl.pathname);
        const token = playbackUrl.searchParams.get('token');
        const isFresh = Number.isInteger(expiresAt)
            && expiresAt > Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_MARGIN_SECONDS;

        if (!isMuxHlsUrl || !token || token.split('.').length !== 3 || !isFresh) {
            throw new Error('Invalid signed playback response');
        }

        return {
            url: playbackUrl.toString(),
            expiresAt
        };
    }

    function loadHlsLibrary() {
        if (window.Hls) {
            return Promise.resolve(window.Hls);
        }

        if (hlsPromise) {
            return hlsPromise;
        }

        hlsPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src = hlsScriptUrl;
            script.async = true;
            script.onload = () => window.Hls
                ? resolve(window.Hls)
                : reject(new Error('hls.js did not initialize'));
            script.onerror = () => reject(new Error('Unable to load hls.js'));
            document.head.append(script);
        }).catch((error) => {
            hlsPromise = undefined;
            throw error;
        });

        return hlsPromise;
    }

    function loadMuxDataLibrary() {
        if (!muxDataEnvKey) {
            return Promise.resolve(undefined);
        }

        if (window.mux?.monitor) {
            return Promise.resolve(window.mux);
        }

        if (muxPromise) {
            return muxPromise;
        }

        muxPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = muxScriptUrl;
            script.async = true;
            script.onload = () => window.mux?.monitor
                ? resolve(window.mux)
                : reject(new Error('mux-embed did not initialize'));
            script.onerror = () => reject(new Error('Unable to load mux-embed'));
            document.head.append(script);
        }).catch((error) => {
            muxPromise = undefined;
            throw error;
        });

        return muxPromise;
    }

    function createVideoLayer() {
        const container = document.createElement('div');
        const video = document.createElement('video');

        container.id = 'redabhrBgVideo-container';
        container.setAttribute('aria-hidden', 'true');

        video.id = 'redabhrBgVideo-player';
        video.autoplay = true;
        video.controls = false;
        video.crossOrigin = 'anonymous';
        video.defaultMuted = true;
        video.disablePictureInPicture = true;
        video.disableRemotePlayback = true;
        video.loop = false;
        video.muted = true;
        video.playsInline = true;
        // A restrained pace keeps the ambient motion subordinate to the profile content.
        video.defaultPlaybackRate = VIDEO_PLAYBACK_RATE;
        video.playbackRate = VIDEO_PLAYBACK_RATE;
        video.preload = 'auto';
        video.tabIndex = -1;
        video.setAttribute('aria-hidden', 'true');
        video.setAttribute('controlslist', 'nodownload noremoteplayback nofullscreen');

        video.addEventListener('ended', restartVideoLoop);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('waiting', scheduleStallFallback);
        video.addEventListener('stalled', scheduleStallFallback);
        video.addEventListener('error', removePlayerLayer);

        container.append(video);
        document.body.prepend(container);

        return video;
    }

    async function attachPlayback(video, playback) {
        activeTokenExpiresAt = playback.expiresAt;
        mediaRecoveryAttempts = 0;
        networkRecoveryAttempts = 0;

        let Hls;
        try {
            Hls = await loadHlsLibrary();
        } catch {
            // Native HLS remains available as a fallback when the local library fails.
        }

        if (canLoadVideo() && Hls?.isSupported()) {
            attachHlsPlayback(Hls, video, playback);
            return;
        }

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = playback.url;
            monitorMuxData(undefined, video, undefined, playback);
            await requestPlayback(video);
            return;
        }

        throw new Error('HLS playback is unavailable');
    }

    function attachHlsPlayback(Hls, video, playback) {
        const instance = new Hls({
            abrEwmaDefaultEstimate: getInitialBandwidthEstimate(),
            autoStartLoad: false,
            backBufferLength: 30,
            capLevelOnFPSDrop: true,
            capLevelToPlayerSize: true,
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 12,
            maxMaxBufferLength: 20,
            testBandwidth: false
        });

        hls = instance;
        monitorMuxData(instance, video, Hls, playback);
        instance.on(Hls.Events.MEDIA_ATTACHED, () => {
            if (instance === hls) {
                instance.loadSource(playback.url);
            }
        });
        instance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            if (instance !== hls) {
                return;
            }

            capHlsResolution(instance, data.levels);
            instance.startLoad();
            requestPlayback(video).catch(removePlayerLayer);
        });
        instance.on(Hls.Events.ERROR, (_event, data) => handleHlsError(Hls, instance, data));
        instance.attachMedia(video);
    }

    function monitorMuxData(instance, video, Hls, playback) {
        if (!muxDataEnvKey) {
            return;
        }

        const initializeMonitoring = () => loadMuxDataLibrary()
            .then((mux) => {
                if ((instance && instance !== hls) || !mux?.monitor) {
                    return;
                }

                const options = {
                    debug: false,
                    disableCookies: true,
                    respectDoNotTrack: true,
                    data: {
                        env_key: muxDataEnvKey,
                        player_name: 'Enterprise architecture background',
                        player_version: '1.0',
                        player_init_time: mux.utils?.now?.() || Date.now(),
                        video_id: playback.variant || 'background'
                    }
                };

                if (instance && Hls) {
                    options.hlsjs = instance;
                    options.Hls = Hls;
                }

                mux.monitor(video, options);
            })
            .catch(() => {
                // Monitoring is optional and must never affect playback.
            });

        // Mux Data is not required for the first paint or for playback. Wait
        // until the background is actually playing, then load it off the path
        // used to establish the video stream.
        const scheduleMonitoring = () => {
            window.setTimeout(() => {
                if ('requestIdleCallback' in window) {
                    window.requestIdleCallback(initializeMonitoring, { timeout: 5000 });
                } else {
                    initializeMonitoring();
                }
            }, 4000);
        };

        video.addEventListener('playing', scheduleMonitoring, { once: true });
    }

    function capHlsResolution(instance, levels) {
        const maximumHeight = getMaximumResolution();
        let bestIndex = 0;
        let bestHeight = 0;

        levels.forEach((level, index) => {
            const height = Number(level.height) || 0;
            if (height <= maximumHeight && height >= bestHeight) {
                bestHeight = height;
                bestIndex = index;
            }
        });

        instance.autoLevelCapping = bestIndex;
    }

    function handleHlsError(Hls, instance, data) {
        if (instance !== hls || !data.fatal) {
            return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR
            && networkRecoveryAttempts < 1
            && tokenIsFresh()) {
            networkRecoveryAttempts += 1;
            window.setTimeout(() => {
                if (instance === hls) {
                    instance.startLoad();
                }
            }, 750);
            return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < 1) {
            mediaRecoveryAttempts += 1;
            instance.recoverMediaError();
            return;
        }

        removePlayerLayer();
    }

    function restartVideoLoop(event) {
        const video = event.currentTarget;
        video.currentTime = Math.min(LOOP_START_SECONDS, video.duration || LOOP_START_SECONDS);
        requestPlayback(video).catch(removePlayerLayer);
    }
    async function requestPlayback(video) {
        const playResult = video.play();
        if (playResult && typeof playResult.then === 'function') {
            await playResult;
        }
    }

    function handlePlaying() {
        if (!canLoadVideo()) {
            removePlayerLayer();
            return;
        }

        window.clearTimeout(playerTimeout);
        window.clearTimeout(stallFallbackTimeout);
        stallFallbackTimeout = undefined;
        document.getElementById('redabhrBgVideo-container')?.classList.add('is-ready');
        updateVideoToggle();
    }

    function scheduleStallFallback() {
        const container = document.getElementById('redabhrBgVideo-container');
        if (!container?.classList.contains('is-ready')) {
            return;
        }

        window.clearTimeout(stallFallbackTimeout);
        stallFallbackTimeout = window.setTimeout(hideVideoLayer, STALL_FALLBACK_DELAY_MS);
    }

    function hideVideoLayer() {
        window.clearTimeout(stallFallbackTimeout);
        stallFallbackTimeout = undefined;
        document.getElementById('redabhrBgVideo-container')?.classList.remove('is-ready');
    }

    function tokenIsFresh() {
        return activeTokenExpiresAt > Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_MARGIN_SECONDS;
    }

    function getVideoElement() {
        return document.getElementById('redabhrBgVideo-player');
    }

    function removePlayerLayer() {
        window.clearTimeout(playerTimeout);
        window.clearTimeout(stallFallbackTimeout);
        stallFallbackTimeout = undefined;

        const video = getVideoElement();
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }

        hls?.destroy();
        hls = undefined;
        activeTokenExpiresAt = 0;
        mediaRecoveryAttempts = 0;
        networkRecoveryAttempts = 0;
        document.getElementById('redabhrBgVideo-container')?.remove();
        starting = false;
        pausedWhileHidden = false;
        updateVideoToggle();
    }

    async function startVideo() {
        scheduled = false;
        if (starting || getVideoElement() || !canLoadVideo()) {
            return;
        }

        starting = true;

        try {
            const playback = await fetchPlaybackUrl();
            if (!canLoadVideo()) {
                starting = false;
                return;
            }

            const video = createVideoLayer();
            playerTimeout = window.setTimeout(removePlayerLayer, PLAYER_TIMEOUT_MS);
            await attachPlayback(video, playback);
            starting = false;
        } catch {
            removePlayerLayer();
        }
    }

    function scheduleVideo() {
        if (scheduled || starting || getVideoElement() || !canLoadVideo()) {
            return;
        }

        scheduled = true;
        const delay = getVideoStartDelay();
        videoDelayHandle = window.setTimeout(() => {
            if (!canLoadVideo()) {
                scheduled = false;
                return;
            }

            if ('requestIdleCallback' in window) {
                idleHandle = window.requestIdleCallback(startVideo, { timeout: 1000 });
            } else {
                startVideo();
            }
        }, delay);
    }

    function getVideoStartDelay() {
        // Keep mobile and constrained connections conservative while making desktop feel immediate.
        if (portraitVideo.matches || window.innerWidth <= 720) {
            return MOBILE_VIDEO_DELAY_MS;
        }

        if (connection?.effectiveType && connection.effectiveType !== '4g') {
            return CONSTRAINED_VIDEO_DELAY_MS;
        }

        return DESKTOP_VIDEO_DELAY_MS;
    }

    function cancelScheduledVideo() {
        if (!scheduled) {
            return;
        }

        window.clearTimeout(videoDelayHandle);
        if (idleHandle && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(idleHandle);
        } else if (idleHandle) {
            window.clearTimeout(idleHandle);
        }
        videoDelayHandle = undefined;
        idleHandle = undefined;
        scheduled = false;
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            cancelScheduledVideo();

            const video = getVideoElement();
            if (video && !video.paused) {
                video.pause();
                pausedWhileHidden = true;
            }
            return;
        }

        const video = getVideoElement();
        if (pausedWhileHidden && video && tokenIsFresh()) {
            pausedWhileHidden = false;
            requestPlayback(video).catch(removePlayerLayer);
        } else if (video && !tokenIsFresh()) {
            removePlayerLayer();
            scheduleVideo();
        } else {
            scheduleVideo();
        }
    }

    function handlePlaybackPreferenceChange() {
        updateVideoToggle();
        if (!canLoadVideo()) {
            cancelScheduledVideo();
            removePlayerLayer();
            return;
        }

        if (hls?.levels?.length) {
            capHlsResolution(hls, hls.levels);
        }
        scheduleVideo();
    }

    function handleVariantChange() {
        cancelScheduledVideo();
        removePlayerLayer();
        scheduleVideo();
    }

    function handleVideoToggle() {
        userPaused = !userPaused;
        writePlaybackPreference(userPaused);
        updateVideoToggle();

        if (userPaused) {
            cancelScheduledVideo();
            const video = getVideoElement();
            if (video) {
                video.pause();
            }
            return;
        }

        const video = getVideoElement();
        if (video && tokenIsFresh()) {
            requestPlayback(video).catch(removePlayerLayer);
        } else {
            scheduleVideo();
        }
    }

    function scheduleCloudflareAnalytics() {
        const token = currentScript?.dataset.cloudflareAnalyticsToken?.trim();
        if (!token) {
            return;
        }

        const injectBeacon = () => {
            if (document.querySelector('script[data-cf-beacon]')) {
                return;
            }

            const beacon = document.createElement('script');
            beacon.type = 'module';
            beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
            beacon.crossOrigin = 'anonymous';
            beacon.dataset.cfBeacon = JSON.stringify({ token });
            document.head.append(beacon);
        };

        const scheduleIdle = () => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(injectBeacon, { timeout: 3000 });
            } else {
                window.setTimeout(injectBeacon, 1200);
            }
        };

        if (document.readyState === 'complete') {
            scheduleIdle();
        } else {
            window.addEventListener('load', scheduleIdle, { once: true });
        }
    }

    videoToggle?.addEventListener('click', handleVideoToggle);
    updateVideoToggle();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotion.addEventListener?.('change', handlePlaybackPreferenceChange);
    portraitVideo.addEventListener?.('change', handleVariantChange);
    connection?.addEventListener?.('change', handlePlaybackPreferenceChange);
    scheduleCloudflareAnalytics();

    if (document.readyState === 'complete') {
        scheduleVideo();
    } else {
        window.addEventListener('load', scheduleVideo, { once: true });
    }
})();
