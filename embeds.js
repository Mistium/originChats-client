function detectEmbedType(url) {
    const ytMatch = url.match(YOUTUBE_REGEX);
    if (ytMatch) {
        return { type: 'youtube', videoId: ytMatch[1] };
    }

    const tenorMatch = url.match(/tenor\.com\/view\/[\w-]+-(\d+)(?:\?.*)?$/i);
    if (tenorMatch) {
        return { type: 'tenor', id: tenorMatch[1], url };
    }
    
    const githubMatch = url.match(/github\.com\/([a-zA-Z0-9-]+(?:\/[a-zA-Z0-9._-]+)?)(?:\/)?$/i);
    if (githubMatch) {
        return { type: 'github', path: githubMatch[1], url };
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
        case 'github':
            return await createGitHubEmbed(embedInfo.path, url);
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
        console.log(`Fetching Tenor GIF with ID: ${tenorId}`);
        const response = await fetch(`https://apps.mistium.com/tenor/get?id=${tenorId}`);
        if (!response.ok) {
            console.error(`Tenor API failed with status: ${response.status}`);
            throw new Error('Tenor API failed');
        }

        const data = await response.json();
        console.log('Tenor API response:', data);
        
        if (!data || !data[0] || !data[0].media || !data[0].media[0]) {
            console.error('Invalid Tenor response structure:', data);
            throw new Error('Invalid Tenor response');
        }

        const media = data[0].media[0];
        const gifUrl = media.mediumgif?.url || media.gif?.url || media.tinygif?.url;

        if (!gifUrl) {
            console.error('No GIF URL found in media:', media);
            throw new Error('No GIF URL found');
        }
        
        console.log(`Found GIF URL: ${gifUrl}`);

        const container = document.createElement('div');
        container.className = 'embed-container tenor-embed';

        const link = document.createElement('a');
        link.href = originalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const img = document.createElement('img');
        img.src = gifUrl;
        img.alt = data[0].content_description || 'Tenor GIF';
        img.className = 'tenor-gif';
        img.loading = 'lazy';
        img.onerror = () => {
            const fallbackLink = document.createElement('a');
            fallbackLink.href = originalUrl;
            fallbackLink.target = '_blank';
            fallbackLink.rel = 'noopener noreferrer';
            fallbackLink.textContent = originalUrl;
            fallbackLink.className = 'failed-image-link';
            container.replaceWith(fallbackLink);
        };

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
        container.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">Video failed to load - click to open</a>`;
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
    link.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Embedded image';
    img.className = 'message-image';
    img.loading = 'lazy';
    img.onerror = () => {
        const fallbackLink = document.createElement('a');
        fallbackLink.href = url;
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener noreferrer';
        fallbackLink.textContent = url;
        fallbackLink.className = 'failed-image-link';
        container.replaceWith(fallbackLink);
    };

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

        if (!res.ok) return false;

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

async function createGitHubEmbed(usernameOrPath, originalUrl) {
    try {
        const pathMatch = usernameOrPath.match(/^([^/]+)\/([^/]+)$/);
        
        if (pathMatch) {
            return await createGitHubRepoEmbed(pathMatch[1], pathMatch[2], originalUrl);
        }
        
        const response = await fetch(`https://api.github.com/users/${usernameOrPath}`);
        
        if (!response.ok) {
            throw new Error('GitHub API failed');
        }

        const data = await response.json();
        
        if (!data || data.message) {
            throw new Error('User/org not found');
        }

        const isOrg = data.type === 'Organization';
        
        const container = document.createElement('div');
        container.className = `embed-container ${isOrg ? 'github-org-embed' : 'github-user-embed'}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'github-embed-wrapper';

        const avatar = document.createElement('img');
        avatar.src = data.avatar_url;
        avatar.alt = `${usernameOrPath} avatar`;
        avatar.className = 'github-avatar';
        avatar.loading = 'lazy';
        wrapper.appendChild(avatar);

        const content = document.createElement('div');
        content.className = 'github-content';

        const header = document.createElement('div');
        header.className = 'github-header';
        
        const link = document.createElement('a');
        link.href = originalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'github-name';
        link.textContent = data.name || usernameOrPath;
        header.appendChild(link);

        const typeBadge = document.createElement('span');
        typeBadge.className = 'github-type';
        typeBadge.textContent = isOrg ? 'Organization' : 'User';
        header.appendChild(typeBadge);

        content.appendChild(header);

        if (data.description || data.bio) {
            const bio = document.createElement('div');
            bio.className = 'github-bio';
            bio.textContent = isOrg ? data.description : data.bio;
            content.appendChild(bio);
        }

        const createStat = (label, value) => {
            const stat = document.createElement('div');
            stat.className = 'github-stat';
            stat.innerHTML = `<span class="stat-value">${formatNumber(value)}</span><span class="stat-label">${label}</span>`;
            return stat;
        };

        const stats = document.createElement('div');
        stats.className = 'github-stats';

        if (isOrg) {
            stats.appendChild(createStat('Followers', data.followers));
            stats.appendChild(createStat('Repos', data.public_repos));
        } else {
            stats.appendChild(createStat('Followers', data.followers));
            stats.appendChild(createStat('Following', data.following));
            stats.appendChild(createStat('Repos', data.public_repos));
        }

        content.appendChild(stats);

        if (data.blog) {
            const websiteLink = document.createElement('a');
            websiteLink.href = data.blog.startsWith('http') ? data.blog : `https://${data.blog}`;
            websiteLink.target = '_blank';
            websiteLink.rel = 'noopener noreferrer';
            websiteLink.className = 'github-website';
            websiteLink.innerHTML = `<i data-lucide="link"></i> ${data.blog.replace(/^https?:\/\//, '')}`;
            content.appendChild(websiteLink);
        }

        if (!isOrg && (data.location || data.company)) {
            const meta = document.createElement('div');
            meta.className = 'github-meta';
            
            if (data.location) {
                const locationEl = document.createElement('div');
                locationEl.className = 'github-meta-item';
                locationEl.innerHTML = `<i data-lucide="map-pin"></i> ${data.location}`;
                meta.appendChild(locationEl);
            }
            
            if (data.company) {
                let companyText = data.company;
                companyText = companyText.replace(/@(\w+)/g, '<a href="https://github.com/$1" target="_blank" rel="noopener noreferrer">@$1</a>');
                const companyEl = document.createElement('div');
                companyEl.className = 'github-meta-item';
                companyEl.innerHTML = `<i data-lucide="building"></i> ${companyText}`;
                meta.appendChild(companyEl);
            }
            
            content.appendChild(meta);
        }

        if (data.created_at) {
            const createdAt = document.createElement('div');
            createdAt.className = 'github-created';
            const joinDate = new Date(data.created_at);
            createdAt.textContent = `${isOrg ? 'Created' : 'Joined'} ${formatDate(joinDate)}`;
            content.appendChild(createdAt);
        }

        try {
            const endpoint = isOrg ? 
                `https://api.github.com/orgs/${usernameOrPath}/repos?per_page=1&sort=updated` :
                `https://api.github.com/users/${usernameOrPath}/repos?per_page=1&sort=updated`;
            
            const reposResponse = await fetch(endpoint);
            if (reposResponse.ok) {
                const repos = await reposResponse.json();
                if (repos.length > 0) {
                    const latestActivity = document.createElement('div');
                    latestActivity.className = 'github-activity';
                    
                    if (isOrg) {
                        const lastUpdated = new Date(repos[0].updated_at);
                        latestActivity.textContent = `Last activity: ${formatDate(lastUpdated)}`;
                    } else {
                        latestActivity.textContent = `Latest: ${repos[0].name}`;
                    }
                    
                    content.appendChild(latestActivity);
                }
            }
        } catch (e) {
            console.debug('Failed to fetch repos:', e);
        }

        wrapper.appendChild(content);
        container.appendChild(wrapper);

        if (window.lucide) {
            setTimeout(() => window.lucide.createIcons({ root: container }), 0);
        }

        return container;
    } catch (error) {
        console.debug('GitHub embed failed:', error);
        return null;
    }
}

async function createGitHubRepoEmbed(owner, repo, originalUrl) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        
        if (!response.ok) {
            throw new Error('GitHub API failed');
        }

        const data = await response.json();
        
        if (!data || data.message) {
            throw new Error('Repository not found');
        }

        const container = document.createElement('div');
        container.className = 'embed-container github-repo-embed';

        const wrapper = document.createElement('div');
        wrapper.className = 'github-embed-wrapper';

        const avatar = document.createElement('img');
        avatar.src = data.owner.avatar_url;
        avatar.alt = `${owner} avatar`;
        avatar.className = 'github-avatar';
        avatar.loading = 'lazy';
        wrapper.appendChild(avatar);

        const content = document.createElement('div');
        content.className = 'github-content';

        const header = document.createElement('div');
        header.className = 'github-header';
        
        const link = document.createElement('a');
        link.href = originalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'github-name';
        link.textContent = data.full_name;
        header.appendChild(link);

        const typeBadge = document.createElement('span');
        typeBadge.className = 'github-type';
        typeBadge.textContent = 'Repository';
        header.appendChild(typeBadge);

        content.appendChild(header);

        if (data.description) {
            const bio = document.createElement('div');
            bio.className = 'github-bio';
            bio.textContent = data.description;
            content.appendChild(bio);
        }

        if (data.language) {
            const langBadge = document.createElement('div');
            langBadge.className = 'github-language';
            langBadge.innerHTML = `<span class="language-dot"></span>${data.language}`;
            content.appendChild(langBadge);
        }

        const createStat = (label, value) => {
            const stat = document.createElement('div');
            stat.className = 'github-stat';
            stat.innerHTML = `<span class="stat-value">${formatNumber(value)}</span><span class="stat-label">${label}</span>`;
            return stat;
        };

        const stats = document.createElement('div');
        stats.className = 'github-stats';

        stats.appendChild(createStat('Stars', data.stargazers_count));
        stats.appendChild(createStat('Forks', data.forks_count));
        stats.appendChild(createStat('Issues', data.open_issues_count));

        content.appendChild(stats);

        if (data.homepage) {
            const websiteLink = document.createElement('a');
            websiteLink.href = data.homepage.startsWith('http') ? data.homepage : `https://${data.homepage}`;
            websiteLink.target = '_blank';
            websiteLink.rel = 'noopener noreferrer';
            websiteLink.className = 'github-website';
            websiteLink.innerHTML = `<i data-lucide="link"></i> ${data.homepage.replace(/^https?:\/\//, '')}`;
            content.appendChild(websiteLink);
        }

        if (data.topics && data.topics.length > 0) {
            const topicsContainer = document.createElement('div');
            topicsContainer.className = 'github-topics';
            
            data.topics.slice(0, 5).forEach(topic => {
                const topicTag = document.createElement('span');
                topicTag.className = 'github-topic-tag';
                topicTag.textContent = topic;
                topicsContainer.appendChild(topicTag);
            });
            
            content.appendChild(topicsContainer);
        }

        const meta = document.createElement('div');
        meta.className = 'github-meta';
        
        if (data.license) {
            const licenseEl = document.createElement('div');
            licenseEl.className = 'github-meta-item';
            licenseEl.innerHTML = `<i data-lucide="scale"></i> ${data.license.spdx_id || data.license.name}`;
            meta.appendChild(licenseEl);
        }
        
        if (data.created_at) {
            const createdEl = document.createElement('div');
            createdEl.className = 'github-meta-item';
            const createdDate = new Date(data.created_at);
            createdEl.innerHTML = `<i data-lucide="calendar"></i> Created ${formatDate(createdDate)}`;
            meta.appendChild(createdEl);
        }
        
        if (meta.children.length > 0) {
            content.appendChild(meta);
        }

        if (data.updated_at) {
            const updatedAt = document.createElement('div');
            updatedAt.className = 'github-activity';
            const lastUpdated = new Date(data.updated_at);
            updatedAt.textContent = `Updated ${formatDate(lastUpdated)}`;
            content.appendChild(updatedAt);
        }

        wrapper.appendChild(content);
        container.appendChild(wrapper);

        if (window.lucide) {
            setTimeout(() => window.lucide.createIcons({ root: container }), 0);
        }

        return container;
    } catch (error) {
        console.debug('GitHub repo embed failed:', error);
        return null;
    }
}

function formatNumber(num) {
    if (num === undefined || num === null) return '?';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y ago`;
    if (months > 0) return `${months}mo ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}