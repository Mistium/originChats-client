// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true when the message's only embed link is a bare Tenor URL,
 * meaning the raw URL text should be hidden in favour of the GIF embed.
 */
function isTenorOnlyMessage(embedLinks, content) {
    return (
        embedLinks.length === 1 &&
        /tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i.test(embedLinks[0]) &&
        content.trim() === embedLinks[0]
    );
}
window.isTenorOnlyMessage = isTenorOnlyMessage;

/**
 * Builds a YouTube iframe and mounts it into targetContainer (clearing it first).
 * Used both on initial thumbnail click and when re-wiring cached embeds after cloneNode.
 */
function _mountYouTubeIframe(targetContainer, videoId) {
    targetContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'youtube-iframe';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    wrapper.appendChild(iframe);
    targetContainer.appendChild(wrapper);
}

// ─── Embed type detection ────────────────────────────────────────────────────

async function detectEmbedType(url) {
    const ytMatch = url.match(YOUTUBE_REGEX);
    if (ytMatch) return { type: 'youtube', videoId: ytMatch[1] };

    const commitMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{7,40})/i);
    if (commitMatch) {
        return { type: 'github_commit', owner: commitMatch[1], repo: commitMatch[2], sha: commitMatch[3], url };
    }

    if (/tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i.test(url)) {
        const id = url.match(/tenor\.com\/view\/[\w-]+-(\d+)/i)?.[1];
        return { type: 'tenor', id, url };
    }

    if (/github\.com\/([a-zA-Z0-9-]+(?:\/[a-zA-Z0-9._-]+)?)(?:\/)?$/i.test(url)) {
        const path = url.match(/github\.com\/([a-zA-Z0-9-]+(?:\/[a-zA-Z0-9._-]+)?)/i)?.[1];
        return { type: 'github', path, url };
    }

    if (hasExtension(url, VIDEO_EXTENSIONS) || url.startsWith('data:video/')) return { type: 'video', url };
    if (hasExtension(url, IMAGE_EXTENSIONS) || url.startsWith('data:image/')) return { type: 'image', url };

    // Unknown extension — do a HEAD request to sniff Content-Type
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            const ct = res.headers.get('Content-Type') || '';
            if (ct.startsWith('video/')) return { type: 'video', url };
            if (ct.startsWith('image/')) return { type: 'image', url };
        }
    } catch (_) { }

    return { type: 'unknown', url };
}

// ─── createEmbed ─────────────────────────────────────────────────────────────

async function createEmbed(url) {
    const embedInfo = await detectEmbedType(url);
    switch (embedInfo.type) {
        case 'youtube': return createYouTubeEmbed(embedInfo.videoId, url);
        case 'tenor': return await createTenorEmbed(embedInfo.id, url);
        case 'github': return await createGitHubEmbed(embedInfo.path, url);
        case 'github_commit': return await createGitHubCommitEmbed(embedInfo.owner, embedInfo.repo, embedInfo.sha, url);
        case 'video':
        case 'image': return null;
        default:
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                if (await isImageUrl(url) === true) return createImageEmbed(url);
            }
            return null;
    }
}

// ─── Embed renderers ─────────────────────────────────────────────────────────

function createYouTubeEmbed(videoId, originalUrl) {
    const container = document.createElement('div');
    container.className = 'embed-container youtube-embed';

    const thumbnail = document.createElement('div');
    thumbnail.className = 'youtube-thumbnail';
    thumbnail.style.backgroundImage = `url(${proxyImageUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)})`;

    const playButton = document.createElement('div');
    playButton.className = 'embed-play-button';
    playButton.innerHTML = `
        <svg viewBox="0 0 68 48" width="68" height="48">
            <path class="play-bg" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
            <path d="M 45,24 27,14 27,34" fill="#fff"/>
        </svg>
    `;
    thumbnail.appendChild(playButton);
    thumbnail.addEventListener('click', () => _mountYouTubeIframe(container, videoId));

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
        if (!data?.[0]?.media?.[0]) throw new Error('Invalid Tenor response');

        const media = data[0].media[0];
        const gifUrl = media.mediumgif?.url || media.gif?.url || media.tinygif?.url;
        if (!gifUrl) throw new Error('No GIF URL found');

        const container = document.createElement('div');
        container.className = 'embed-container tenor-embed';

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-image-wrapper';

        const link = document.createElement('a');
        link.href = originalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.onclick = (e) => { e.preventDefault(); if (window.openImageModal) window.openImageModal(gifUrl); };

        const img = document.createElement('img');
        img.src = proxyImageUrl(gifUrl);
        const altDiv = document.createElement('div');
        altDiv.textContent = data[0].content_description || 'Tenor GIF';
        img.alt = altDiv.innerHTML;
        img.className = 'tenor-gif';
        img.loading = 'lazy';
        img.onerror = () => {
            const fallback = document.createElement('a');
            fallback.href = originalUrl;
            fallback.target = '_blank';
            fallback.rel = 'noopener noreferrer';
            fallback.textContent = originalUrl;
            fallback.className = 'failed-image-link';
            container.replaceWith(fallback);
        };

        link.appendChild(img);
        wrapper.appendChild(link);

        const favBtn = createFavButton(gifUrl, gifUrl);
        wrapper.appendChild(favBtn);
        if (window.lucide) setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);

        container.appendChild(wrapper);
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
        container.innerHTML = '';
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Video failed to load - click to open';
        container.appendChild(link);
    };
    container.appendChild(video);
    return container;
}

function createImageEmbed(url) {
    const container = document.createElement('div');
    container.className = 'embed-container image-embed';

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-image-wrapper';

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.onclick = (e) => { e.preventDefault(); if (window.openImageModal) window.openImageModal(url); };

    const img = document.createElement('img');
    img.src = proxyImageUrl(url);
    img.alt = 'Embedded image';
    img.className = 'message-image';
    img.loading = 'lazy';
    img.onerror = () => {
        const fallback = document.createElement('a');
        fallback.href = url;
        fallback.target = '_blank';
        fallback.rel = 'noopener noreferrer';
        fallback.textContent = url;
        fallback.className = 'failed-image-link';
        container.replaceWith(fallback);
    };

    link.appendChild(img);
    wrapper.appendChild(link);

    const favBtn = createFavButton(url, url);
    wrapper.appendChild(favBtn);
    if (window.lucide) setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);

    container.appendChild(wrapper);
    return container;
}

async function createGitHubCommitEmbed(owner, repo, sha, originalUrl) {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`
        );
        if (!res.ok) throw new Error("GitHub API failed");

        const data = await res.json();

        const container = document.createElement("div");
        container.className = "embed-container github-commit-embed";

        const wrapper = document.createElement("div");
        wrapper.className = "github-embed-wrapper";

        const avatar = document.createElement("img");
        avatar.src = proxyImageUrl(data.author?.avatar_url || data.committer?.avatar_url);
        avatar.className = "github-avatar";
        avatar.loading = "lazy";

        wrapper.appendChild(avatar);

        const content = document.createElement("div");
        content.className = "github-content";

        const header = _createGitHubHeader(
            originalUrl,
            `${owner}/${repo}@${sha.slice(0,7)}`,
            "Commit"
        );
        content.appendChild(header);

        const message = document.createElement("div");
        message.className = "github-bio";
        message.textContent = data.commit.message.split("\n")[0];
        content.appendChild(message);

        const stats = document.createElement("div");
        stats.className = "github-stats";
        stats.appendChild(_createGitHubStat("Files", data.files?.length || 0));
        stats.appendChild(_createGitHubStat("Additions", data.stats?.additions || 0));
        stats.appendChild(_createGitHubStat("Deletions", data.stats?.deletions || 0));
        content.appendChild(stats);

        const meta = document.createElement("div");
        meta.className = "github-meta";

        meta.appendChild(
            _createGitHubMetaItem(
                "git-commit",
                data.commit.author.name
            )
        );

        meta.appendChild(
            _createGitHubMetaItem(
                "clock",
                formatDate(new Date(data.commit.author.date))
            )
        );

        content.appendChild(meta);

        wrapper.appendChild(content);
        container.appendChild(wrapper);

        if (window.lucide)
            setTimeout(() => window.lucide.createIcons({ root: container }), 0);

        return container;

    } catch (err) {
        console.debug("GitHub commit embed failed:", err);
        return null;
    }
}

// ─── Favourites button ───────────────────────────────────────────────────────

function createFavButton(url, preview) {
    const btn = document.createElement('button');
    btn.className = 'chat-fav-btn';
    btn.dataset.url = url;
    try {
        const favs = JSON.parse(localStorage.getItem('originChats_favGifs')) || [];
        const isFav = favs.some(f => f.url === url);
        if (isFav) btn.classList.add('active');
        btn.innerHTML = isFav
            ? '<i data-lucide="star" fill="currentColor"></i>'
            : '<i data-lucide="star"></i>';
    } catch (_) {
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

// ─── isImageUrl ──────────────────────────────────────────────────────────────

async function isImageUrl(url, timeout = 5000) {
    try {
        if (YOUTUBE_REGEX.test(url)) {
            try {
                const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
                if (!res.ok) throw new Error('oEmbed failed');
                const data = await res.json();
                return { type: 'video', provider: 'youtube', title: data.title, author: data.author_name, thumbnail: data.thumbnail_url, width: data.width, height: data.height, html: data.html };
            } catch { return { type: 'unknown' }; }
        }

        if (url.startsWith('data:image/') || url.startsWith('blob:')) return true;
        if (hasExtension(url, IMAGE_EXTENSIONS)) return true;
        if (hasExtension(url, VIDEO_EXTENSIONS) || url.startsWith('data:video/')) return 'video';

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) return false;
        const ct = res.headers.get('content-type') || '';
        if (ct.startsWith('image/')) return true;
        if (ct.startsWith('video/')) return 'video';
    } catch (_) { }

    // Last resort: try loading as an image element
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeout);
        img.onload = () => { clearTimeout(timer); resolve(true); };
        img.onerror = () => { clearTimeout(timer); resolve(false); };
        img.referrerPolicy = 'no-referrer';
        img.src = proxyImageUrl(url);
    });
}

/**
 * Mutates a `.potential-image` link to render its target as an inline video.
 */
function _renderVideoEmbed(link, url) {
    const embed = createVideoEmbed(url);
    link.textContent = '';
    link.appendChild(embed);
    link.onclick = (e) => e.preventDefault();
    link.classList.remove('potential-image');
}

/**
 * Inspects a `.potential-image` anchor and replaces its contents with an
 * inline image or video depending on the URL's content type.
 */
function _processPotentialImageLink(link, groupContent) {
    const url = link.dataset.imageUrl;

    // Fast path: known video extension or data URI — no network request needed
    if (hasExtension(url, VIDEO_EXTENSIONS) || url.startsWith('data:video/')) {
        _renderVideoEmbed(link, url);
        return;
    }

    isImageUrl(url).then(isImage => {
        if (!isImage) return;
        if (isImage === 'video') { _renderVideoEmbed(link, url); return; }
        // Object return == YouTube — already handled via embedLinks / createEmbed
        if (typeof isImage === 'object') return;

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-image-wrapper';

        const img = document.createElement('img');
        img.src = proxyImageUrl(url);
        img.alt = 'image';
        img.className = 'message-image';

        if (window.createFavButton) {
            const favBtn = window.createFavButton(url, url);
            wrapper.appendChild(favBtn);
            if (window.lucide) setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
        }
        wrapper.appendChild(img);

        link.textContent = '';
        link.appendChild(wrapper);
        link.onclick = (e) => { e.preventDefault(); if (window.openImageModal) window.openImageModal(url); };
        link.classList.remove('potential-image');
    }).catch(err => {
        // Final fallback: manual HEAD check for video content-type
        fetch(url, { method: 'HEAD', mode: 'cors' })
            .then(res => { if ((res.headers.get('Content-Type') || '').startsWith('video/')) _renderVideoEmbed(link, url); })
            .catch(() => { });
        console.debug('Image check failed for URL:', url, err);
    });
}

/**
 * Appends or refreshes embed elements inside a message's groupContent element.
 * Handles both cache hits (re-wiring YouTube click handlers post-cloneNode)
 * and cache misses (calling createEmbed and storing the result).
 */
function _processEmbedLinks(embedLinks, groupContent) {
    groupContent.querySelectorAll('.embed-container').forEach(e => e.remove());

    for (const url of embedLinks) {
        if (hasExtension(url, VIDEO_EXTENSIONS) || url.startsWith('data:video/')) {
            continue;
        }

        if (url in state._embedCache) {
            const cachedEl = state._embedCache[url];
            if (!cachedEl) continue;

            const cloned = cachedEl.cloneNode(true);

            const thumbnail = cloned.querySelector('.youtube-thumbnail');
            if (thumbnail) {
                const videoId = url.match(YOUTUBE_REGEX)?.[1];
                const container = thumbnail.closest('.youtube-embed');
                if (container && videoId) {
                    thumbnail.addEventListener('click', () => _mountYouTubeIframe(container, videoId));
                }
            }

            groupContent.appendChild(cloned);
        } else {
            createEmbed(url).then(embedEl => {
                state._embedCache[url] = embedEl ? embedEl.cloneNode(true) : null;
                if (embedEl) groupContent.appendChild(embedEl);
            });
        }
    }
}

// ─── GitHub embeds ───────────────────────────────────────────────────────────

// Shared DOM micro-helpers to avoid repetition across user/org/repo embeds
function _createGitHubHeader(url, name, badgeText) {
    const header = document.createElement('div');
    header.className = 'github-header';
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.className = 'github-name'; link.textContent = name;
    const badge = document.createElement('span');
    badge.className = 'github-type'; badge.textContent = badgeText;
    header.appendChild(link); header.appendChild(badge);
    return header;
}
function _createGitHubStat(label, value) {
    const stat = document.createElement('div');
    stat.className = 'github-stat';
    const valueSpan = document.createElement('span');
    valueSpan.className = 'stat-value';
    valueSpan.textContent = formatNumber(value);
    stat.appendChild(valueSpan);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'stat-label';
    labelSpan.textContent = label;
    stat.appendChild(labelSpan);
    return stat;
}
function _createGitHubWebsiteLink(href) {
    const link = document.createElement('a');
    link.href = href.startsWith('http') ? href : `https://${href}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'github-website';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'link');
    link.appendChild(icon);
    const text = document.createTextNode(href.replace(/^https?:\/\//, ''));
    link.appendChild(text);
    return link;
}
function _createGitHubMetaItem(icon, html) {
    const el = document.createElement('div');
    el.className = 'github-meta-item';
    el.innerHTML = `<i data-lucide="${icon}"></i> ${html}`;
    return el;
}

async function createGitHubEmbed(usernameOrPath, originalUrl) {
    try {
        const pathMatch = usernameOrPath.match(/^([^/]+)\/([^/]+)$/);
        if (pathMatch) return await createGitHubRepoEmbed(pathMatch[1], pathMatch[2], originalUrl);

        const response = await fetch(`https://api.github.com/users/${usernameOrPath}`);
        if (!response.ok) throw new Error('GitHub API failed');
        const data = await response.json();
        if (!data || data.message) throw new Error('User/org not found');

        const isOrg = data.type === 'Organization';
        const container = document.createElement('div');
        container.className = `embed-container ${isOrg ? 'github-org-embed' : 'github-user-embed'}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'github-embed-wrapper';

        const avatar = document.createElement('img');
        avatar.src = proxyImageUrl(data.avatar_url); avatar.alt = `${usernameOrPath} avatar`;
        avatar.className = 'github-avatar'; avatar.loading = 'lazy';
        wrapper.appendChild(avatar);

        const content = document.createElement('div');
        content.className = 'github-content';
        content.appendChild(_createGitHubHeader(originalUrl, data.name || usernameOrPath, isOrg ? 'Organization' : 'User'));

        if (data.description || data.bio) {
            const bio = document.createElement('div');
            bio.className = 'github-bio';
            bio.textContent = isOrg ? data.description : data.bio;
            content.appendChild(bio);
        }

        const stats = document.createElement('div');
        stats.className = 'github-stats';
        stats.appendChild(_createGitHubStat('Followers', data.followers));
        if (!isOrg) stats.appendChild(_createGitHubStat('Following', data.following));
        stats.appendChild(_createGitHubStat('Repos', data.public_repos));
        content.appendChild(stats);

        if (data.blog) content.appendChild(_createGitHubWebsiteLink(data.blog));

        if (!isOrg && (data.location || data.company)) {
            const meta = document.createElement('div');
            meta.className = 'github-meta';
            if (data.location) meta.appendChild(_createGitHubMetaItem('map-pin', data.location));
            if (data.company) {
                const companyHtml = data.company.replace(/@(\w+)/g, '<a href="https://github.com/$1" target="_blank" rel="noopener noreferrer">@$1</a>');
                meta.appendChild(_createGitHubMetaItem('building', companyHtml));
            }
            content.appendChild(meta);
        }

        if (data.created_at) {
            const el = document.createElement('div');
            el.className = 'github-created';
            el.textContent = `${isOrg ? 'Created' : 'Joined'} ${formatDate(new Date(data.created_at))}`;
            content.appendChild(el);
        }

        try {
            const endpoint = isOrg
                ? `https://api.github.com/orgs/${usernameOrPath}/repos?per_page=1&sort=updated`
                : `https://api.github.com/users/${usernameOrPath}/repos?per_page=1&sort=updated`;
            const reposRes = await fetch(endpoint);
            if (reposRes.ok) {
                const repos = await reposRes.json();
                if (repos.length > 0) {
                    const el = document.createElement('div');
                    el.className = 'github-activity';
                    el.textContent = isOrg
                        ? `Last activity: ${formatDate(new Date(repos[0].updated_at))}`
                        : `Latest: ${repos[0].name}`;
                    content.appendChild(el);
                }
            }
        } catch (e) { console.debug('Failed to fetch repos:', e); }

        wrapper.appendChild(content);
        container.appendChild(wrapper);
        if (window.lucide) setTimeout(() => window.lucide.createIcons({ root: container }), 0);
        return container;
    } catch (error) {
        console.debug('GitHub embed failed:', error);
        return null;
    }
}

async function createGitHubRepoEmbed(owner, repo, originalUrl) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!response.ok) throw new Error('GitHub API failed');
        const data = await response.json();
        if (!data || data.message) throw new Error('Repository not found');

        const container = document.createElement('div');
        container.className = 'embed-container github-repo-embed';

        const wrapper = document.createElement('div');
        wrapper.className = 'github-embed-wrapper';

        const avatar = document.createElement('img');
        avatar.src = proxyImageUrl(data.owner.avatar_url); avatar.alt = `${owner} avatar`;
        avatar.className = 'github-avatar'; avatar.loading = 'lazy';
        wrapper.appendChild(avatar);

        const content = document.createElement('div');
        content.className = 'github-content';
        content.appendChild(_createGitHubHeader(originalUrl, data.full_name, 'Repository'));

        if (data.description) {
            const bio = document.createElement('div');
            bio.className = 'github-bio'; bio.textContent = data.description;
            content.appendChild(bio);
        }

        if (data.language) {
            const lang = document.createElement('div');
            lang.className = 'github-language';
            lang.innerHTML = `<span class="language-dot"></span>${data.language}`;
            content.appendChild(lang);
        }

        const stats = document.createElement('div');
        stats.className = 'github-stats';
        stats.appendChild(_createGitHubStat('Stars', data.stargazers_count));
        stats.appendChild(_createGitHubStat('Forks', data.forks_count));
        stats.appendChild(_createGitHubStat('Issues', data.open_issues_count));
        content.appendChild(stats);

        if (data.homepage) content.appendChild(_createGitHubWebsiteLink(data.homepage));

        if (data.topics?.length > 0) {
            const topicsEl = document.createElement('div');
            topicsEl.className = 'github-topics';
            data.topics.slice(0, 5).forEach(topic => {
                const tag = document.createElement('span');
                tag.className = 'github-topic-tag'; tag.textContent = topic;
                topicsEl.appendChild(tag);
            });
            content.appendChild(topicsEl);
        }

        const meta = document.createElement('div');
        meta.className = 'github-meta';
        if (data.license) meta.appendChild(_createGitHubMetaItem('scale', data.license.spdx_id || data.license.name));
        if (data.created_at) meta.appendChild(_createGitHubMetaItem('calendar', `Created ${formatDate(new Date(data.created_at))}`));
        if (meta.children.length > 0) content.appendChild(meta);

        if (data.updated_at) {
            const el = document.createElement('div');
            el.className = 'github-activity';
            el.textContent = `Updated ${formatDate(new Date(data.updated_at))}`;
            content.appendChild(el);
        }

        wrapper.appendChild(content);
        container.appendChild(wrapper);
        if (window.lucide) setTimeout(() => window.lucide.createIcons({ root: container }), 0);
        return container;
    } catch (error) {
        console.debug('GitHub repo embed failed:', error);
        return null;
    }
}

// ─── Formatting utilities ────────────────────────────────────────────────────

function formatNumber(num) {
    if (num == null) return '?';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toString();
}

function formatDate(date) {
    const diff = Date.now() - date;
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0) return `${years}y ago`;
    if (months > 0) return `${months}mo ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}