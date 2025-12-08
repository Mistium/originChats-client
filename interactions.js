const QUICK_REACTIONS = ['😭', '😔', '💀', '👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '👌'];

let reactionPicker = null;
let reactionPickerMsgId = null;
let recentEmojis = JSON.parse(localStorage.getItem('originChats_recentEmojis') || '[]');

function createReactionPicker() {
    if (reactionPicker) return reactionPicker;

    reactionPicker = document.createElement('div');
    reactionPicker.className = 'reaction-picker';
    reactionPicker.id = 'reaction-picker';
    reactionPicker.innerHTML = `
        <div class="reaction-picker-search">
            <input type="text" id="emoji-search" placeholder="Search emoji..." autocomplete="off" />
        </div>
        <div id="emoji-quick" class="reaction-quick"></div>
        <div id="emoji-results" class="reaction-results"></div>
    `;

    document.body.appendChild(reactionPicker);

    const searchInput = reactionPicker.querySelector('#emoji-search');
    const quick = reactionPicker.querySelector('#emoji-quick');
    const results = reactionPicker.querySelector('#emoji-results');

    const renderQuick = () => {
        quick.innerHTML = '';
        const base = (recentEmojis && recentEmojis.length > 0) ? recentEmojis : QUICK_REACTIONS;
        for (const emoji of base.slice(0, 24)) {
            const btn = document.createElement('span');
            btn.className = 'reaction-picker-emoji';
            btn.textContent = emoji;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectEmoji(emoji);
            });
            quick.appendChild(btn);
        }
    };

    const renderResults = (query) => {
        results.innerHTML = '';
        const q = (query || '').trim().toLowerCase();
        if (!q) {
            results.innerHTML = '';
            return;
        }
        if (!window.shortcodes) {
            const loading = document.createElement('div');
            loading.className = 'reaction-loading';
            loading.textContent = 'Loading...';
            results.appendChild(loading);
            return;
        }
        const out = [];
        for (const e of window.shortcodes) {
            const label = (e.label || '').toLowerCase();
            const em = e.emoticon;
            let match = label.includes(q);
            if (!match && em) {
                if (Array.isArray(em)) match = em.some(x => (x || '').toLowerCase().includes(q));
                else match = (em || '').toLowerCase().includes(q);
            }
            if (match) out.push(e);
            if (out.length >= 120) break;
        }
        if (out.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'reaction-empty';
            empty.textContent = 'No matches';
            results.appendChild(empty);
            return;
        }
        for (const e of out) {
            const btn = document.createElement('span');
            btn.className = 'reaction-picker-emoji';
            btn.textContent = e.emoji;
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                selectEmoji(e.emoji);
            });
            results.appendChild(btn);
        }
    };

    searchInput.addEventListener('input', (e) => {
        renderResults(e.target.value);
    });

    document.addEventListener('click', (e) => {
        if (!reactionPicker.contains(e.target) && !e.target.closest('#emoji-btn') && !e.target.closest('[data-emoji-anchor]')) {
            closeReactionPicker();
        }
    });

    renderQuick();

    return reactionPicker;
}

function openReactionPicker(msgId, anchorEl) {
    const picker = createReactionPicker();
    reactionPickerMsgId = msgId;

    const rect = anchorEl.getBoundingClientRect();
    picker.classList.add('active');
    const pr = picker.getBoundingClientRect();
    const pad = 6;
    let left = rect.left;
    let top = rect.bottom + 5;
    if (left + pr.width > window.innerWidth - pad) left = window.innerWidth - pr.width - pad;
    if (left < pad) left = pad;
    if (top + pr.height > window.innerHeight - pad) top = rect.top - pr.height - 5;
    if (top < pad) top = pad;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;

    const input = picker.querySelector('#emoji-search');
    if (input) {
        input.value = '';
        input.focus();
        const results = picker.querySelector('#emoji-results');
        if (results) results.innerHTML = '';
    }
}

function closeReactionPicker() {
    if (reactionPicker) {
        reactionPicker.classList.remove('active');
        reactionPickerMsgId = null;
    }
}

function selectEmoji(emoji) {
    recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 50);
    localStorage.setItem('originChats_recentEmojis', JSON.stringify(recentEmojis));
    if (reactionPickerMsgId) {
        addReaction(reactionPickerMsgId, emoji);
        closeReactionPicker();
    } else {
        const input = document.getElementById('message-input');
        if (!input) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
        const pos = start + emoji.length;
        input.selectionStart = pos;
        input.selectionEnd = pos;
        input.focus();
    }
}

function toggleEmojiPicker(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const btn = document.getElementById('emoji-btn');
    if (!btn) return;
    const picker = createReactionPicker();
    const rect = btn.getBoundingClientRect();
    picker.classList.toggle('active');
    const pr = picker.getBoundingClientRect();
    const pad = 6;
    let left = rect.left;
    let top = rect.bottom + 5;
    if (left + pr.width > window.innerWidth - pad) left = window.innerWidth - pr.width - pad;
    if (left < pad) left = pad;
    if (top + pr.height > window.innerHeight - pad) top = rect.top - pr.height - 5;
    if (top < pad) top = pad;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
    reactionPickerMsgId = null;
    const input = picker.querySelector('#emoji-search');
    if (input && picker.classList.contains('active')) {
        input.value = '';
        input.focus();
        const results = picker.querySelector('#emoji-results');
        if (results) results.innerHTML = '';
    }
}

window.toggleEmojiPicker = toggleEmojiPicker;

function addReaction(msgId, emoji) {
    wsSend({
        cmd: 'message_react_add',
        id: msgId,
        emoji: emoji,
        channel: state.currentChannel.name
    });
}

function removeReaction(msgId, emoji) {
    wsSend({
        cmd: 'message_react_remove',
        id: msgId,
        emoji: emoji,
        channel: state.currentChannel.name
    });
}

function toggleReaction(msgId, emoji) {
    const msg = state.messages[state.currentChannel.name]?.find(m => m.id === msgId);
    if (!msg || !msg.reactions) {
        addReaction(msgId, emoji);
        return;
    }

    const users = msg.reactions[emoji] || [];
    if (users.includes(state.currentUser?.username)) {
        removeReaction(msgId, emoji);
    } else {
        addReaction(msgId, emoji);
    }
}

function renderReactions(msg, container) {
    const existing = container.querySelector('.message-reactions');
    if (existing) existing.remove();

    const reactions = msg.reactions;
    if (!reactions || Object.keys(reactions).length === 0) {
        return;
    }

    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'message-reactions';

    for (const [emoji, users] of Object.entries(reactions)) {
        const count = users.length;
        if (count === 0) continue;

        const hasReacted = users.includes(state.currentUser?.username);

        const reactionEl = document.createElement('span');
        reactionEl.className = 'reaction' + (hasReacted ? ' reacted' : '');
        reactionEl.innerHTML = `
            <span class="reaction-emoji">${emoji}</span>
            <span class="reaction-count">${count}</span>
        `;
        reactionEl.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReaction(msg.id, emoji);
        });
        reactionsDiv.appendChild(reactionEl);
    }

    container.appendChild(reactionsDiv);
}

function updateMessageReactions(msgId) {
    const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!wrapper) return;

    const msg = state.messages[state.currentChannel.name]?.find(m => m.id === msgId);
    if (!msg) return;

    const groupContent = wrapper.querySelector('.message-group-content');
    if (groupContent) {
        renderReactions(msg, groupContent);
    }
}

let swipeState = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    element: null,
    msgId: null,
    isOwnMessage: false,
    longPressTimer: null
};

const SWIPE_THRESHOLD = 60;
const LONG_PRESS_DURATION = 500;

function setupMessageSwipe(wrapper, msg) {
    const isOwnMessage = msg.user === state.currentUser?.username;

    wrapper.addEventListener('touchstart', (e) => {
        swipeState = {
            active: true,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            currentX: 0,
            element: wrapper,
            msgId: msg.id,
            isOwnMessage: isOwnMessage,
            longPressTimer: setTimeout(() => {
                if (swipeState.active && Math.abs(swipeState.currentX) < 10) {
                    e.preventDefault();
                    resetSwipe();

                    const ev = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: e.touches[0].clientX,
                        clientY: e.touches[0].clientY
                    });
                    wrapper.querySelector('.message-text')?.dispatchEvent(ev);
                }
            }, LONG_PRESS_DURATION)
        };
        wrapper.classList.add('swiping');
    }, { passive: false });

    wrapper.addEventListener('touchmove', (e) => {
        if (!swipeState.active) return;

        const deltaX = e.touches[0].clientX - swipeState.startX;
        const deltaY = e.touches[0].clientY - swipeState.startY;

        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            cancelSwipe();
            return;
        }

        swipeState.currentX = deltaX;

        if (deltaX < 0) {
            const clampedX = Math.min(deltaX, SWIPE_THRESHOLD + 20);
            wrapper.style.transform = `translateX(${clampedX}px)`;
            wrapper.classList.toggle('swipe-reveal-reply', deltaX > SWIPE_THRESHOLD);
            wrapper.classList.remove('swipe-reveal-edit');
        } else if (deltaX > 0 && isOwnMessage) {
            const clampedX = Math.max(deltaX, -(SWIPE_THRESHOLD + 20));
            wrapper.style.transform = `translateX(${clampedX}px)`;
            wrapper.classList.toggle('swipe-reveal-edit', deltaX < -SWIPE_THRESHOLD);
            wrapper.classList.remove('swipe-reveal-reply');
        }
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
        if (!swipeState.active) return;

        const deltaX = swipeState.currentX;

        if (deltaX < -SWIPE_THRESHOLD) {
            const msg = state.messages[state.currentChannel.name]?.find(m => m.id === swipeState.msgId);
            if (msg) replyToMessage(msg);
        } else if (deltaX > SWIPE_THRESHOLD && swipeState.isOwnMessage) {
            const msg = state.messages[state.currentChannel.name]?.find(m => m.id === swipeState.msgId);
            if (msg) startEditMessage(msg);
        }

        resetSwipe();
    }, { passive: true });

    wrapper.addEventListener('touchcancel', resetSwipe, { passive: true });
}

function cancelSwipe() {
    if (swipeState.element) {
        swipeState.element.classList.remove('swiping', 'swipe-reveal-reply', 'swipe-reveal-edit');
        swipeState.element.style.transform = '';
    }
    clearTimeout(swipeState.longPressTimer);
    swipeState.active = false;
}

function resetSwipe() {
    if (swipeState.element) {
        swipeState.element.classList.remove('swiping', 'swipe-reveal-reply', 'swipe-reveal-edit');
        swipeState.element.style.transform = '';
    }
    clearTimeout(swipeState.longPressTimer);
    swipeState = { active: false, startX: 0, startY: 0, currentX: 0, element: null, msgId: null, isOwnMessage: false, longPressTimer: null };
}

let editingMessage = null;

function startEditMessage(msg) {
    editingMessage = msg;
    const input = document.getElementById('message-input');
    input.value = msg.content;
    input.focus();

    document.getElementById('reply-text').textContent = `Editing message`;
    document.getElementById('reply-bar').classList.add('active');
}

function cancelEdit() {
    editingMessage = null;
    document.getElementById('message-input').value = '';
    document.getElementById('reply-bar').classList.remove('active');
}

let gifPickerOpen = false;
let gifSearchTimer = null;
let favoriteGifs = JSON.parse(localStorage.getItem('originChats_favGifs')) || [];
let currentGifTab = 'search';

function toggleGifPicker(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const picker = createGifPicker();
    picker.classList.toggle('active');
    gifPickerOpen = picker.classList.contains('active');
    if (gifPickerOpen) {
        if (currentGifTab === 'search') {
            setTimeout(() => document.getElementById('gif-search').focus(), 50);
        } else {
            switchGifTab('favorites');
        }
    }
}

function createGifPicker() {
    let picker = document.getElementById('gif-picker');
    if (picker) return picker;

    picker = document.createElement('div');
    picker.id = 'gif-picker';
    picker.className = 'gif-picker';
    picker.innerHTML = `
        <div class="gif-picker-header">
            <div class="gif-tabs">
                <button class="gif-tab active" data-tab="search" onclick="switchGifTab('search')">Search</button>
                <button class="gif-tab" data-tab="favorites" onclick="switchGifTab('favorites')">Favorites</button>
            </div>
        </div>
        <div class="gif-search-bar" id="gif-search-bar">
            <input type="text" id="gif-search" placeholder="Search Tenor GIFs..." autocomplete="off">
        </div>
        <div id="gif-results" class="gif-results">
        </div>
    `;

    document.querySelector('.input-area').appendChild(picker);

    const input = picker.querySelector('#gif-search');
    input.addEventListener('input', (e) => debouncedSearch(e.target.value));

    if (window.lucide) window.lucide.createIcons();

    return picker;
}

function switchGifTab(tab) {
    currentGifTab = tab;
    document.querySelectorAll('.gif-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const searchBar = document.getElementById('gif-search-bar');
    const results = document.getElementById('gif-results');

    if (tab === 'favorites') {
        searchBar.style.display = 'none';
        renderGifs(favoriteGifs, true);
    } else {
        searchBar.style.display = 'block';
        const query = document.getElementById('gif-search').value;
        if (query) {
            searchGifs(query);
        } else {
            results.innerHTML = '';
        }
    }
}

function closeGifPicker() {
    const picker = document.getElementById('gif-picker');
    if (picker) {
        picker.classList.remove('active');
    }
    gifPickerOpen = false;
}

function debouncedSearch(query) {
    clearTimeout(gifSearchTimer);
    gifSearchTimer = setTimeout(() => searchGifs(query), 500);
}

async function searchGifs(query) {
    if (!query.trim()) return;

    const resultsContainer = document.getElementById('gif-results');
    resultsContainer.innerHTML = '<div class="gif-loading">Loading...</div>';

    try {
        const res = await fetch(`https://apps.mistium.com/tenor/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderGifs(data.results || data);
    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML = '<div class="gif-error">Failed to load GIFs</div>';
    }
}

function renderGifs(results, isFavorites = false) {
    const container = document.getElementById('gif-results');
    container.innerHTML = '';

    if (!results || results.length === 0) {
        container.innerHTML = isFavorites ?
            '<div class="gif-empty">No favorites yet</div>' :
            '<div class="gif-empty">No results found</div>';
        return;
    }

    results.forEach(gif => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gif-item-wrapper';

        const img = document.createElement('img');
        const previewUrl = isFavorites ? gif.preview : gif.media[0].tinygif.url;
        const itemUrl = isFavorites ? gif.url : gif.itemurl;

        img.src = previewUrl;
        img.className = 'gif-result';
        img.loading = 'lazy';
        img.onclick = () => {
            sendGif(itemUrl);
            closeGifPicker();
        };

        const starBtn = document.createElement('button');
        starBtn.className = 'gif-star-btn';
        const isFav = favoriteGifs.some(f => f.url === itemUrl);
        starBtn.innerHTML = isFav ?
            '<i data-lucide="star" fill="currentColor"></i>' :
            '<i data-lucide="star"></i>';

        starBtn.classList.toggle('active', isFav);
        starBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite({ url: itemUrl, preview: previewUrl });
        };

        wrapper.appendChild(img);
        wrapper.appendChild(starBtn);
        container.appendChild(wrapper);
    });

    if (window.lucide) window.lucide.createIcons();
}

function toggleFavorite(gifData) {
    const data = typeof gifData === 'string' ? { url: gifData, preview: gifData } : gifData;
    const idx = favoriteGifs.findIndex(f => f.url === data.url);
    if (idx > -1) {
        favoriteGifs.splice(idx, 1);
    } else {
        favoriteGifs.unshift(data);
    }
    localStorage.setItem('originChats_favGifs', JSON.stringify(favoriteGifs));

    if (currentGifTab === 'favorites') {
        renderGifs(favoriteGifs, true);
    } else {
        updateStarIcons();
    }
}

function updateStarIcons() {
    const searchInput = document.getElementById('gif-search');
    const currentQuery = searchInput ? searchInput.value : '';

    if (currentQuery && currentGifTab === 'search') {
        document.querySelectorAll('.gif-star-btn').forEach(btn => {
            const url = btn.dataset.url;
            const isFav = favoriteGifs.some(f => f.url === url);
            btn.classList.toggle('active', isFav);
            btn.innerHTML = isFav ?
                '<i data-lucide="star" fill="currentColor"></i>' :
                '<i data-lucide="star"></i>';
            if (window.lucide) window.lucide.createIcons({ root: btn });
        });
    }

    document.querySelectorAll('.chat-fav-btn').forEach(btn => {
        const url = btn.dataset.url;
        const isFav = favoriteGifs.some(f => f.url === url);
        btn.classList.toggle('active', isFav);
        btn.innerHTML = isFav ?
            '<i data-lucide="star" fill="currentColor"></i>' :
            '<i data-lucide="star"></i>';
        if (window.lucide) window.lucide.createIcons({ root: btn });
    });

    const modalFavBtn = document.getElementById('modal-fav-btn');
    if (modalFavBtn && modalFavBtn.dataset.url) {
        const url = modalFavBtn.dataset.url;
        const isFav = favoriteGifs.some(f => f.url === url);
        modalFavBtn.classList.toggle('active', isFav);
        modalFavBtn.innerHTML = isFav ?
            '<i data-lucide="star" fill="currentColor"></i>' :
            '<i data-lucide="star"></i>';
        if (window.lucide) window.lucide.createIcons({ root: modalFavBtn });
    }
}
window.toggleFavorite = toggleFavorite;


function openImageModal(url) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    const favBtn = document.getElementById('modal-fav-btn');

    if (!modal || !img) return;

    img.src = url;
    modal.classList.add('active');

    if (favBtn) {
        favBtn.dataset.url = url;
        const isFav = favoriteGifs.some(f => f.url === url);
        favBtn.classList.toggle('active', isFav);
        favBtn.innerHTML = isFav ?
            '<i data-lucide="star" fill="currentColor"></i>' :
            '<i data-lucide="star"></i>';
        if (window.lucide) window.lucide.createIcons({ root: favBtn });
    }
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            document.getElementById('modal-image').src = '';
        }, 200);
    }
}

function toggleModalFavorite() {
    const favBtn = document.getElementById('modal-fav-btn');
    if (favBtn && favBtn.dataset.url) {
        toggleFavorite(favBtn.dataset.url);
    }
}

window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.toggleModalFavorite = toggleModalFavorite;

function sendGif(url) {
    const input = document.getElementById('message-input');
    input.value = url;
    sendMessage();
}

document.addEventListener('click', (e) => {
    const picker = document.getElementById('gif-picker');
    const toggleBtn = document.getElementById('gif-btn');

    if (gifPickerOpen && picker && !picker.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        closeGifPicker();
    }
});

window.toggleGifPicker = toggleGifPicker;
function getOrCreateMessageOptions(container) {
    let options = container.querySelector('.message-options');
    if (!options) {
        options = document.createElement('div');
        options.className = 'message-options';
        const actionsBar = document.createElement('div');
        actionsBar.className = 'message-actions-bar';
        options.appendChild(actionsBar);
        container.appendChild(options);
    }
    return options;
}

window.getOrCreateMessageOptions = getOrCreateMessageOptions;
