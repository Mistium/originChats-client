function detectEmbedType(url) {
    const ytMatch = url.match(YOUTUBE_REGEX);
    if (ytMatch) {
        return { type: 'youtube', videoId: ytMatch[1] };
    }

    const tenorMatch = url.match(/tenor\.com\/view\/[\w-]+-(\d+)$/);
    if (tenorMatch) {
        return { type: 'tenor', id: tenorMatch[1], url };
    }

    if (hasExtension(url, VIDEO_EXTENSIONS)) {
        return { type: 'video', url };
    }

    if (hasExtension(url, IMAGE_EXTENSIONS) || url.startsWith('data:image/')) {
        return { type: 'image', url };
    }

    if (url.startsWith('data:video/')) {
        return { type: 'video', url };
    }

    return { type: 'unknown', url };
}

async function createEmbed(url) {
    const embedInfo = detectEmbedType(url);

    switch (embedInfo.type) {
        case 'youtube':
            return createYouTubeEmbed(embedInfo.videoId, url);
        case 'tenor':
            return await createTenorEmbed(embedInfo.id, url);
        case 'video':
            return createVideoEmbed(embedInfo.url);
        case 'image':
            return null;
        default:
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                const isImage = await isImageUrl(url);
                if (isImage === true) {
                    return createImageEmbed(url);
                }
            }
            return null;
    }
}

function createYouTubeEmbed(videoId, originalUrl) {
    const container = document.createElement('div');
    container.className = 'embed-container youtube-embed';

    const thumbnail = document.createElement('div');
    thumbnail.className = 'youtube-thumbnail';
    thumbnail.style.backgroundImage = `url(https://img.youtube.com/vi/${videoId}/maxresdefault.jpg)`;

    const playButton = document.createElement('div');
    playButton.className = 'embed-play-button';
    playButton.innerHTML = `
        <svg viewBox="0 0 68 48" width="68" height="48">
            <path class="play-bg" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
            <path d="M 45,24 27,14 27,34" fill="#fff"/>
        </svg>
    `;

    thumbnail.appendChild(playButton);

    thumbnail.addEventListener('click', () => {
        container.innerHTML = '';
        const iframeWrapper = document.createElement('div');
        iframeWrapper.className = 'youtube-iframe';
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframeWrapper.appendChild(iframe);
        container.appendChild(iframeWrapper);
    });

    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(originalUrl)}`)
        .then(res => res.json())
        .then(data => {
            if (data.title) {
                const titleEl = document.createElement('div');
                titleEl.className = 'youtube-title';
                titleEl.textContent = data.title;
                container.appendChild(titleEl);
            }
        })
        .catch(() => { });

    container.appendChild(thumbnail);
    return container;
}

async function createTenorEmbed(tenorId, originalUrl) {
    try {
        const response = await fetch(`https://apps.mistium.com/tenor/get?id=${tenorId}`);
        if (!response.ok) throw new Error('Tenor API failed');

        const data = await response.json();
        if (!data || !data[0] || !data[0].media || !data[0].media[0]) {
            throw new Error('Invalid Tenor response');
        }

        const media = data[0].media[0];
        const gifUrl = media.mediumgif?.url || media.gif?.url;

        if (!gifUrl) throw new Error('No GIF URL found');

        const container = document.createElement('div');
        container.className = 'embed-container tenor-embed';

        const link = document.createElement('a');
        link.href = originalUrl;
        link.target = '_blank';
        link.rel = 'noopener';

        const img = document.createElement('img');
        img.src = gifUrl;
        img.alt = data[0].content_description || 'Tenor GIF';
        img.className = 'tenor-gif';
        img.loading = 'lazy';

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-image-wrapper';

        link.onclick = (e) => {
            e.preventDefault();
            if (window.openImageModal) window.openImageModal(gifUrl);
        };

        link.appendChild(img);
        wrapper.appendChild(link);

        const favBtn = createFavButton(gifUrl, gifUrl);
        wrapper.appendChild(favBtn);

        container.appendChild(wrapper);

        if (window.lucide) {
            setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
        }

        return container;
    } catch (error) {
        console.debug('Tenor embed failed:', error);
        return null;
    }
}

function createVideoEmbed(url) {
    const container = document.createElement('div');
    container.className = 'embed-container video-embed';

    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.preload = 'metadata';
    video.className = 'video-player';

    video.onerror = () => {
        container.innerHTML = `<a href="${url}" target="_blank" rel="noopener">Video failed to load - click to open</a>`;
    };

    container.appendChild(video);
    return container;
}

function createImageEmbed(url) {
    const container = document.createElement('div');
    container.className = 'embed-container image-embed';

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Embedded image';
    img.className = 'message-image';
    img.loading = 'lazy';

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-image-wrapper';

    link.onclick = (e) => {
        e.preventDefault();
        if (window.openImageModal) window.openImageModal(url);
    };

    link.appendChild(img);
    wrapper.appendChild(link);

    const favBtn = createFavButton(url, url);
    wrapper.appendChild(favBtn);

    container.appendChild(wrapper);

    if (window.lucide) {
        setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
    }

    return container;
}

function createFavButton(url, preview) {
    const btn = document.createElement('button');
    btn.className = 'chat-fav-btn';
    btn.dataset.url = url;

    try {
        const favs = JSON.parse(localStorage.getItem('originChats_favGifs')) || [];
        const isFav = favs.some(f => f.url === url);
        if (isFav) btn.classList.add('active');
        btn.innerHTML = isFav ?
            '<i data-lucide="star" fill="currentColor"></i>' :
            '<i data-lucide="star"></i>';
    } catch (e) {
        btn.innerHTML = '<i data-lucide="star"></i>';
    }

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.toggleFavorite) window.toggleFavorite({ url, preview });
    };
    return btn;
}

window.createFavButton = createFavButton;

async function isImageUrl(url, timeout = 5000) {
    try {
        if (YOUTUBE_REGEX.test(url)) {
            const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
            try {
                const res = await fetch(oembedUrl);
                if (!res.ok) throw new Error("oEmbed failed");
                const data = await res.json();
                return {
                    type: "video",
                    provider: "youtube",
                    title: data.title,
                    author: data.author_name,
                    thumbnail: data.thumbnail_url,
                    width: data.width,
                    height: data.height,
                    html: data.html
                };
            } catch {
                return { type: "unknown" };
            }
        }

        if (url.startsWith("data:image/") || url.startsWith("blob:")) {
            return true;
        }

        if (hasExtension(url, IMAGE_EXTENSIONS)) {
            return true;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const res = await fetch(url, {
            method: "HEAD",
            mode: "cors",
            signal: controller.signal
        });

        clearTimeout(timer);

        const type = res.headers.get("content-type");
        if (type && type.startsWith("image/")) return true;

    } catch (_) {
    }

    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
            img.src = "";
            resolve(false);
        }, timeout);

        img.onload = () => {
            clearTimeout(timer);
            resolve(true);
        };

        img.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };

        img.referrerPolicy = "no-referrer";
        img.src = url;
    });
}
