// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['😭', '😔', '💀', '👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '👌'];

// ─── State ───────────────────────────────────────────────────────────────────

let reactionPicker = null;
let reactionPickerMsgId = null;
let recentEmojis = JSON.parse(localStorage.getItem('originchats_recentEmojis') || '[]');
let pickerResizeObserver = null;
let pendingReactions = new Set();
let unifiedPickerTab = 'emoji';
let gifSearchTimer = null;
let favoriteGifs = JSON.parse(localStorage.getItem('originChats_favGifs')) || [];
let currentGifTab = 'favorites';
let currentSearchResults = null;

Object.defineProperty(window, 'reactionPickerMsgId', {
    get: () => reactionPickerMsgId,
    set: (value) => { reactionPickerMsgId = value; }
});

Object.defineProperty(window, 'recentEmojis', {
    get: () => recentEmojis,
    set: (value) => {
        recentEmojis = value;
        localStorage.setItem('originChats_recentEmojis', JSON.stringify(recentEmojis));
    }
});

// ─── Shared emoji button factory ─────────────────────────────────────────────

/**
 * Creates a single emoji button that calls window.selectEmoji on click.
 * Used by every emoji grid renderer to avoid repetition.
 */
function _createEmojiButton(emoji) {
    const btn = document.createElement('button');
    btn.className = 'reaction-picker-emoji';
    btn.textContent = emoji;
    btn.type = 'button';
    if (window.twemoji) {
        window.twemoji.parse(btn);
    }
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.selectEmoji(emoji);
    };
    return btn;
}

// ─── Shared emoji grid renderers ─────────────────────────────────────────────

/**
 * Renders either "Recent" or "Quick Reactions" emojis into any container.
 * Used by both the unified picker and the reaction picker.
 */
function _renderQuickEmojiSection(container) {
    const base = (window.recentEmojis?.length > 0) ? window.recentEmojis : QUICK_REACTIONS;
    const label = document.createElement('div');
    label.className = 'reaction-category';
    label.textContent = window.shortcodes ? 'Recent' : 'Quick Reactions';
    container.appendChild(label);
    const grid = document.createElement('div');
    grid.className = 'reaction-emoji-grid';
    for (const emoji of base.slice(0, 42)) grid.appendChild(_createEmojiButton(emoji));
    container.appendChild(grid);
}

/**
 * Renders the full categorised emoji picker into any container.
 * Used by both the unified picker and the reaction picker.
 */
function _renderFullEmojiSection(container) {
    const categories = {
        '🙂 Smileys & Emotion': [],
        '👋 People & Body': [],
        '🐶 Animals & Nature': [],
        '🍎 Food & Drink': [],
        '🏀 Activities': [],
        '🚗 Travel & Places': [],
        '💡 Objects': [],
        '🎨 Symbols': [],
        '🏳️ Flags': []
    };

    for (const e of window.shortcodes) {
        if (!e.emoji) continue;
        const cat = getEmojiCategory(e.emoji);
        (categories[cat] ?? categories['🙂 Smileys & Emotion']).push(e.emoji);
    }

    // Quick section first
    const quickHeader = document.createElement('div');
    quickHeader.className = 'reaction-category';
    quickHeader.textContent = 'Quick';
    container.appendChild(quickHeader);
    const quickGrid = document.createElement('div');
    quickGrid.className = 'reaction-emoji-grid';
    for (const emoji of QUICK_REACTIONS) quickGrid.appendChild(_createEmojiButton(emoji));
    container.appendChild(quickGrid);

    // Then each category
    for (const [categoryName, emojis] of Object.entries(categories)) {
        if (emojis.length === 0) continue;
        const header = document.createElement('div');
        header.className = 'reaction-category';
        header.textContent = categoryName;
        container.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'reaction-emoji-grid';
        for (const emoji of emojis) grid.appendChild(_createEmojiButton(emoji));
        container.appendChild(grid);
    }
}

/**
 * Renders emoji search results into any container.
 * Used by both the unified picker and the reaction picker.
 */
function _renderEmojiSearchSection(container, query) {
    container.innerHTML = '';

    if (!window.shortcodes) {
        const loading = document.createElement('div');
        loading.className = 'reaction-loading';
        loading.textContent = 'Loading...';
        container.appendChild(loading);
        return;
    }

    const q = query.toLowerCase();
    const results = [];
    for (const e of window.shortcodes) {
        if (results.length >= 120) break;
        const label = (e.label || '').toLowerCase();
        const em = e.emoticon;
        const matchLabel = label.includes(q);
        const matchEmoticon = em && (Array.isArray(em)
            ? em.some(x => (x || '').toLowerCase().includes(q))
            : (em || '').toLowerCase().includes(q));
        if (matchLabel || matchEmoticon) results.push(e);
    }

    if (results.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'reaction-empty';
        empty.textContent = 'No matches';
        container.appendChild(empty);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'reaction-emoji-grid';
    for (const e of results) grid.appendChild(_createEmojiButton(e.emoji));
    container.appendChild(grid);
}

// ─── Emoji rendering entry points ─────────────────────────────────────────────

function renderEmojis() {
    const container = document.querySelector('#emoji-container');
    if (!container) return;
    container.innerHTML = '';
    if (window.shortcodes?.length > 0) {
        _renderFullEmojiSection(container);
    } else {
        _renderQuickEmojiSection(container);
    }
}

function renderReactionEmojis() {
    const container = document.querySelector('.reaction-emoji-container');
    if (!container) return;
    container.innerHTML = '';
    if (window.shortcodes?.length > 0) {
        _renderFullEmojiSection(container);
    } else {
        _renderQuickEmojiSection(container);
    }
}

function handleSearch(e) {
    const query = e.target.value.trim();
    const container = document.querySelector('#emoji-container');
    if (!query) { renderEmojis(); return; }
    _renderEmojiSearchSection(container, query);
}

function handleReactionSearch(e) {
    const query = e.target.value.trim();
    const container = document.querySelector('.reaction-emoji-container');
    if (!query) { renderReactionEmojis(); return; }
    _renderEmojiSearchSection(container, query);
}

// ─── Emoji category helper ────────────────────────────────────────────────────

function getEmojiCategory(emoji) {
    const code = emoji.codePointAt(0);
    if (code >= 0x1F600 && code <= 0x1F64F) return '🙂 Smileys & Emotion';
    if (code >= 0x1F910 && code <= 0x1F96B) return '🙂 Smileys & Emotion';
    if (code >= 0x1F970 && code <= 0x1F9FF) return '🙂 Smileys & Emotion';
    if (code >= 0x1F466 && code <= 0x1F478) return '👋 People & Body';
    if (code >= 0x1F47C && code <= 0x1F481) return '👋 People & Body';
    if (code >= 0x1F483 && code <= 0x1F487) return '👋 People & Body';
    if (code >= 0x1F48B && code <= 0x1F48B) return '👋 People & Body';
    if (code >= 0x1F574 && code <= 0x1F575) return '👋 People & Body';
    if (code >= 0x1F57A && code <= 0x1F57A) return '👋 People & Body';
    if (code >= 0x1F590 && code <= 0x1F590) return '👋 People & Body';
    if (code >= 0x1F595 && code <= 0x1F596) return '👋 People & Body';
    if (code >= 0x1F645 && code <= 0x1F64F) return '👋 People & Body';
    if (code >= 0x1F6B4 && code <= 0x1F6B6) return '👋 People & Body';
    if (code >= 0x1F6C0 && code <= 0x1F6C0) return '👋 People & Body';
    if (code >= 0x1F918 && code <= 0x1F91F) return '👋 People & Body';
    if (code >= 0x1F926 && code <= 0x1F939) return '👋 People & Body';
    if (code >= 0x1F93C && code <= 0x1F93E) return '👋 People & Body';
    if (code >= 0x1F400 && code <= 0x1F43F) return '🐶 Animals & Nature';
    if (code >= 0x1F980 && code <= 0x1F9AE) return '🐶 Animals & Nature';
    if (code >= 0x1F330 && code <= 0x1F335) return '🐶 Animals & Nature';
    if (code >= 0x1F337 && code <= 0x1F34A) return '🐶 Animals & Nature';
    if (code >= 0x1F32D && code <= 0x1F37F) return '🍎 Food & Drink';
    if (code >= 0x1F950 && code <= 0x1F96B) return '🍎 Food & Drink';
    if (code >= 0x1F9C0 && code <= 0x1F9CB) return '🍎 Food & Drink';
    if (code >= 0x1F3D0 && code <= 0x1F3DF) return '🚗 Travel & Places';
    if (code >= 0x1F3E0 && code <= 0x1F3F0) return '🚗 Travel & Places';
    if (code >= 0x1F680 && code <= 0x1F6C5) return '🚗 Travel & Places';
    if (code >= 0x1F6CB && code <= 0x1F6D2) return '🚗 Travel & Places';
    if (code >= 0x1F6E0 && code <= 0x1F6EA) return '🚗 Travel & Places';
    if (code >= 0x1F6F0 && code <= 0x1F6F9) return '🚗 Travel & Places';
    if (code >= 0x1F3A0 && code <= 0x1F3C4) return '🏀 Activities';
    if (code >= 0x1F3C6 && code <= 0x1F3CA) return '🏀 Activities';
    if (code >= 0x1F3CF && code <= 0x1F3CF) return '🏀 Activities';
    if (code >= 0x26BD && code <= 0x26BE) return '🏀 Activities';
    if (code >= 0x1F93A && code <= 0x1F93E) return '🏀 Activities';
    if (code >= 0x1F945 && code <= 0x1F945) return '🏀 Activities';
    if (code >= 0x1FA70 && code <= 0x1FA73) return '🏀 Activities';
    if (code >= 0x1F4A0 && code <= 0x1F4FC) return '💡 Objects';
    if (code >= 0x1F507 && code <= 0x1F579) return '💡 Objects';
    if (code >= 0x1F58A && code <= 0x1F5A3) return '💡 Objects';
    if (code >= 0x231A && code <= 0x231B) return '💡 Objects';
    if (code >= 0x1F300 && code <= 0x1F32C) return '🎨 Symbols';
    if (code >= 0x1F380 && code <= 0x1F39F) return '🎨 Symbols';
    if (code >= 0x2600 && code <= 0x26FF) return '🎨 Symbols';
    if (code >= 0x2700 && code <= 0x27BF) return '🎨 Symbols';
    if (code >= 0x00A9 && code <= 0x00AE) return '🎨 Symbols';
    if (code >= 0x1F1E6 && code <= 0x1F1FF) return '🏳️ Flags';
    return '🎨 Symbols';
}

// ─── Picker creation ──────────────────────────────────────────────────────────

function createReactionPicker() {
    if (reactionPicker) return reactionPicker;

    reactionPicker = document.createElement('div');
    reactionPicker.className = 'reaction-picker';
    reactionPicker.id = 'reaction-picker';
    reactionPicker.innerHTML = `
        <div class="reaction-picker-search">
            <input type="text" id="reaction-emoji-search" placeholder="Search emoji..." autocomplete="off" />
        </div>
        <div class="reaction-emoji-container"></div>
    `;
    document.body.appendChild(reactionPicker);

    reactionPicker.querySelector('#reaction-emoji-search')
        .addEventListener('input', handleReactionSearch);

    const overlay = document.createElement('div');
    overlay.className = 'reaction-picker-overlay reaction-picker-message-overlay';
    overlay.onclick = closeReactionPicker;
    document.body.appendChild(overlay);

    document.addEventListener('click', (e) => {
        if (!reactionPicker?.classList.contains('active')) return;
        if (!e.target.classList.contains('reaction-picker-message-overlay') &&
            !e.target.closest('.reaction-picker') &&
            !e.target.closest('#emoji-btn') &&
            !e.target.closest('[data-emoji-anchor]')) {
            closeReactionPicker();
        }
    });

    return reactionPicker;
}

function createUnifiedPicker() {
    let picker = document.getElementById('unified-picker');
    if (picker) return picker;

    picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.id = 'unified-picker';
    picker.innerHTML = `
        <div class="unified-picker-header">
            <div class="unified-picker-tabs">
                <button class="unified-tab ${unifiedPickerTab === 'emoji' ? 'active' : ''}" data-tab="emoji" onclick="switchUnifiedTab('emoji')">
                    <i data-lucide="smile"></i> Emojis
                </button>
                <button class="unified-tab ${unifiedPickerTab === 'gif' ? 'active' : ''}" data-tab="gif" onclick="switchUnifiedTab('gif')">
                    <i data-lucide="image"></i> GIFs
                </button>
            </div>
            <button class="unified-picker-close" onclick="closeUnifiedPicker()" title="Close">
                <i data-lucide="x"></i>
            </button>
        </div>
        <div class="reaction-picker-search" id="emoji-search-container">
            <input type="text" id="emoji-search" placeholder="Search emoji..." autocomplete="off" />
        </div>
        <div class="gif-search-bar" id="gif-search-bar" style="display:none">
            <input type="text" id="gif-search" placeholder="Search Tenor GIFs..." autocomplete="off">
        </div>
        <div id="emoji-container" style="display:${unifiedPickerTab === 'emoji' ? 'block' : 'none'}"></div>
        <div id="gif-results" class="gif-results" style="display:${unifiedPickerTab === 'gif' ? 'block' : 'none'}"></div>
    `;
    document.body.appendChild(picker);

    picker.querySelector('#emoji-search').addEventListener('input', handleSearch);
    picker.querySelector('#gif-search').addEventListener('input', (e) => {
        clearTimeout(gifSearchTimer);
        gifSearchTimer = setTimeout(() => searchGifs(e.target.value), 500);
    });

    let overlay = document.querySelector('.unified-picker-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'reaction-picker-overlay unified-picker-overlay';
        overlay.onclick = closeUnifiedPicker;
        document.body.appendChild(overlay);
    }

    document.addEventListener('click', (e) => {
        if (!picker?.classList.contains('active')) return;
        const r = picker.getBoundingClientRect();
        const inPicker = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inPicker && !e.target.closest('#emoji-btn') && !e.target.closest('[data-emoji-anchor]')) {
            closeUnifiedPicker();
        }
    });

    if (window.lucide) window.lucide.createIcons({ root: picker });
    return picker;
}

// ─── Picker positioning ───────────────────────────────────────────────────────

function positionDesktopPicker(picker, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const pad = 6;
    let left = rect.left;

    picker.classList.add('active');
    const pr = picker.getBoundingClientRect();

    if (left + 350 > window.innerWidth - pad) left = window.innerWidth - 350 - pad;
    if (left < pad) left = pad;

    const topAbove = rect.top - pr.height - 5;
    const topBelow = rect.bottom + 5;
    let top = topAbove;

    if (topAbove < pad && topBelow + pr.height > window.innerHeight - pad) {
        top = window.innerHeight - pr.height - pad;
    } else if (topBelow + pr.height > window.innerHeight - pad) {
        top = topAbove;
    } else if (topAbove < pad) {
        top = topBelow;
    }

    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
}

/**
 * Shared picker show logic. Positions the picker and wires up the resize
 * observer. Used by both openReactionPicker and toggleEmojiPicker.
 */
function _showPicker(picker, anchorEl, overlaySelector) {
    const isMobile = window.innerWidth <= 768;
    const overlay = document.querySelector(overlaySelector);

    if (isMobile) {
        Object.assign(picker.style, { left: '0', right: '0', top: 'auto', bottom: '0', width: '100vw', maxWidth: '100vw', position: 'fixed' });
    } else {
        Object.assign(picker.style, { position: 'fixed', left: 'auto', right: 'auto', top: 'auto', bottom: 'auto', maxWidth: '350px' });
        positionDesktopPicker(picker, anchorEl);
        pickerResizeObserver = new ResizeObserver(() => {
            if (picker.classList.contains('active')) positionDesktopPicker(picker, anchorEl);
        });
        pickerResizeObserver.observe(picker);
    }

    if (overlay) { overlay.style.display = 'block'; overlay.classList.add('active'); }
    picker.classList.add('active');
}

function _disconnectResizeObserver() {
    if (pickerResizeObserver) { pickerResizeObserver.disconnect(); pickerResizeObserver = null; }
}

// ─── Picker open/close ────────────────────────────────────────────────────────

function openReactionPicker(msgId, anchorEl) {
    const picker = createReactionPicker();
    reactionPickerMsgId = msgId;

    _showPicker(picker, anchorEl, '.reaction-picker-message-overlay');

    const search = picker.querySelector('#reaction-emoji-search');
    if (search) { search.value = ''; setTimeout(() => search.focus(), 50); }
    renderReactionEmojis();
}

function closeReactionPicker() {
    if (reactionPicker) {
        reactionPicker.classList.remove('active');
        reactionPickerMsgId = null;
    }
    _disconnectResizeObserver();
    const overlay = document.querySelector('.reaction-picker-message-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => { if (!reactionPicker?.classList.contains('active')) overlay.style.display = 'none'; }, 200);
    }
}

function toggleEmojiPicker(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const btn = document.getElementById('emoji-btn');
    if (!btn) return;

    const picker = createUnifiedPicker();
    if (picker.classList.contains('active')) { closeUnifiedPicker(); return; }

    reactionPickerMsgId = null;
    _showPicker(picker, btn, '.unified-picker-overlay');

    const search = picker.querySelector('#emoji-search');
    if (search) { search.value = ''; setTimeout(() => search.focus(), 50); }
    renderEmojis();
}

function closeUnifiedPicker() {
    const picker = document.getElementById('unified-picker');
    if (!picker) return;
    picker.classList.remove('active');

    const overlay = document.querySelector('.unified-picker-overlay') || document.querySelector('.reaction-picker-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => { if (!picker.classList.contains('active')) overlay.style.display = 'none'; }, 200);
    }
    _disconnectResizeObserver();
}

function switchUnifiedTab(tab) {
    unifiedPickerTab = tab;
    const picker = document.getElementById('unified-picker');
    if (!picker) return;

    picker.querySelectorAll('.unified-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    const emojiContainer = picker.querySelector('#emoji-container');
    const gifResults = picker.querySelector('#gif-results');
    const emojiSearchBar = picker.querySelector('#emoji-search-container');
    const gifSearchBar = picker.querySelector('#gif-search-bar');

    const showEmoji = tab === 'emoji';
    emojiContainer.style.display = showEmoji ? 'block' : 'none';
    gifResults.style.display = showEmoji ? 'none' : 'block';
    emojiSearchBar.style.display = showEmoji ? 'block' : 'none';
    gifSearchBar.style.display = showEmoji ? 'none' : 'block';

    if (showEmoji) {
        renderEmojis();
    } else {
        const q = document.getElementById('gif-search').value.trim();
        if (q) { currentGifTab = 'search'; searchGifs(q); }
        else { currentGifTab = 'favorites'; renderGifs(favoriteGifs, true); }
    }
}

// ─── Reactions ────────────────────────────────────────────────────────────────

function addReaction(msgId, emoji) {
    const key = `${msgId}:${emoji}:add`;
    if (pendingReactions.has(key)) return;
    pendingReactions.add(key);
    const sent = wsSend({ cmd: 'message_react_add', id: msgId, emoji, channel: state.currentChannel.name }, state.serverUrl);
    if (!sent) { pendingReactions.delete(key); showError('Failed to add reaction - connection lost'); }
    else setTimeout(() => pendingReactions.delete(key), 1000);
}

function removeReaction(msgId, emoji) {
    const key = `${msgId}:${emoji}:remove`;
    if (pendingReactions.has(key)) return;
    pendingReactions.add(key);
    const sent = wsSend({ cmd: 'message_react_remove', id: msgId, emoji, channel: state.currentChannel.name }, state.serverUrl);
    if (!sent) { pendingReactions.delete(key); showError('Failed to remove reaction - connection lost'); }
    else setTimeout(() => pendingReactions.delete(key), 1000);
}

function toggleReaction(msgId, emoji) {
    const msg = state.messages[state.currentChannel.name]?.find(m => m.id === msgId);
    if (!msg?.reactions) { addReaction(msgId, emoji); return; }
    const users = msg.reactions[emoji] || [];
    if (users.includes(state.currentUser?.username)) removeReaction(msgId, emoji);
    else addReaction(msgId, emoji);
}

function renderReactions(msg, container) {
    container.querySelector('.message-reactions')?.remove();

    const reactions = msg.reactions;
    if (!reactions || Object.keys(reactions).length === 0) return;

    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'message-reactions';

    for (const [emoji, users] of Object.entries(reactions)) {
        if (users.length === 0) continue;
        const hasReacted = users.includes(state.currentUser?.username);
        const reactionEl = document.createElement('span');
        reactionEl.className = 'reaction' + (hasReacted ? ' reacted' : '');
        const emojiSpan = document.createElement('span');
        emojiSpan.className = 'reaction-emoji';
        emojiSpan.textContent = emoji;
        if (window.twemoji) {
            window.twemoji.parse(emojiSpan);
        }
        reactionEl.appendChild(emojiSpan);
        const countSpan = document.createElement('span');
        countSpan.className = 'reaction-count';
        countSpan.textContent = users.length;
        reactionEl.appendChild(countSpan);

        const tooltip = document.createElement('div');
        tooltip.className = 'reaction-tooltip';
        tooltip.innerHTML = users.map(u => u === state.currentUser?.username ? `${u} (you)` : u).join(', ');
        reactionEl.appendChild(tooltip);

        reactionEl.addEventListener('click', (e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); });
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
    if (groupContent) renderReactions(msg, groupContent);
}

// ─── Message options bar ──────────────────────────────────────────────────────

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

// ─── Swipe to reply/edit ──────────────────────────────────────────────────────

let swipeState = {
    active: false, startX: 0, startY: 0, currentX: 0,
    element: null, msgId: null, isOwnMessage: false, longPressTimer: null
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
            isOwnMessage,
            longPressTimer: setTimeout(() => {
                if (swipeState.active && Math.abs(swipeState.currentX) < 10) {
                    e.preventDefault();
                    resetSwipe();
                    const ev = new MouseEvent('contextmenu', {
                        bubbles: true, cancelable: true, view: window,
                        clientX: e.touches[0].clientX, clientY: e.touches[0].clientY
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
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) { cancelSwipe(); return; }
        swipeState.currentX = deltaX;
        if (deltaX < 0) {
            wrapper.style.transform = `translateX(${Math.min(deltaX, SWIPE_THRESHOLD + 20)}px)`;
            wrapper.classList.toggle('swipe-reveal-reply', deltaX > SWIPE_THRESHOLD);
            wrapper.classList.remove('swipe-reveal-edit');
        } else if (deltaX > 0 && isOwnMessage) {
            wrapper.style.transform = `translateX(${Math.max(deltaX, -(SWIPE_THRESHOLD + 20))}px)`;
            wrapper.classList.toggle('swipe-reveal-edit', deltaX < -SWIPE_THRESHOLD);
            wrapper.classList.remove('swipe-reveal-reply');
        }
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
        if (!swipeState.active) return;
        const deltaX = swipeState.currentX;
        if (deltaX < -SWIPE_THRESHOLD) {
            const m = state.messages[state.currentChannel.name]?.find(m => m.id === swipeState.msgId);
            if (m) replyToMessage(m);
        } else if (deltaX > SWIPE_THRESHOLD && swipeState.isOwnMessage) {
            const m = state.messages[state.currentChannel.name]?.find(m => m.id === swipeState.msgId);
            if (m) startEditMessage(m);
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

// ─── Edit message ─────────────────────────────────────────────────────────────

let editingMessage = null;
let originalInputValue = '';

Object.defineProperty(window, 'editingMessage', {
    get() { return editingMessage; },
    set(val) { editingMessage = val; }
});

/**
 * Sets the reply-bar UI to a given mode. Shared by startEditMessage and
 * cancelEdit to avoid duplicating DOM manipulation.
 */
function _setReplyBarMode({ icon, label, text, previewText, active, editingMode }) {
    const replyBar = document.getElementById('reply-bar');
    const iconEl = document.getElementById('reply-bar-icon');
    const labelEl = document.getElementById('reply-bar-label');
    const textEl = document.getElementById('reply-text');
    const previewEl = document.getElementById('reply-preview');

    if (iconEl) iconEl.setAttribute('data-lucide', icon);
    if (labelEl) labelEl.textContent = label;
    if (textEl) textEl.innerHTML = text;
    if (previewEl) {
        if (previewText !== null) { previewEl.textContent = previewText; previewEl.style.display = 'block'; }
        else { previewEl.style.display = 'none'; }
    }

    if (replyBar) {
        replyBar.classList.toggle('active', active);
        replyBar.classList.toggle('editing-mode', editingMode);
        if (window.lucide) window.lucide.createIcons({ root: replyBar });
    }
}

function startEditMessage(msg) {
    editingMessage = msg;
    const input = document.getElementById('message-input');
    originalInputValue = input.value;
    input.value = msg.content;
    input.focus();

    const user = getUserByUsernameCaseInsensitive(msg.user) || { username: msg.user };
    const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;

    _setReplyBarMode({
        icon: 'edit-3',
        label: 'Editing message',
        text: `<span class="username">@${escapeHtml(user.username)}</span>`,
        previewText: preview,
        active: true,
        editingMode: true
    });

    setTimeout(() => { input.selectionStart = input.selectionEnd = input.value.length; }, 0);
}

function cancelEdit() {
    editingMessage = null;
    originalInputValue = '';
    const input = document.getElementById('message-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));

    _setReplyBarMode({
        icon: 'corner-up-left',
        label: 'Replying to',
        text: '',
        previewText: null,
        active: false,
        editingMode: false
    });
}

window.startEditMessage = startEditMessage;
window.cancelEdit = cancelEdit;

// ─── GIF picker ───────────────────────────────────────────────────────────────

/**
 * Fetches the actual GIF media URL from a Tenor item URL.
 * Used by both star button clicks and sendGif to avoid duplicating the fetch.
 */
async function resolveTenorGifUrl(itemUrl) {
    const match = itemUrl.match(/tenor\.com\/view\/[\w-]+-(\d+)(?:\?.*)?$/i);
    if (!match) return itemUrl;
    try {
        const res = await fetch(`https://apps.mistium.com/tenor/get?id=${match[1]}`);
        const data = await res.json();
        const media = data?.[0]?.media?.[0];
        return media?.mediumgif?.url || media?.gif?.url || media?.tinygif?.url || itemUrl;
    } catch { return itemUrl; }
}

/**
 * Returns the HTML string for a star button in active or inactive state.
 * Used by renderGifs, updateStarIcons, and openImageModal.
 */
function _starHtml(isFav) {
    return isFav
        ? '<i data-lucide="star" fill="currentColor"></i>'
        : '<i data-lucide="star"></i>';
}

function toggleGifPicker(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (e && !e.closest('#emoji-btn')) {
        const picker = createUnifiedPicker();
        if (picker.classList.contains('active')) closeUnifiedPicker();
        else { switchUnifiedTab('gif'); picker.classList.add('active'); }
    }
}

async function searchGifs(query) {
    if (!query.trim()) { currentGifTab = 'favorites'; renderGifs(favoriteGifs, true); return; }
    currentGifTab = 'search';
    const container = document.getElementById('gif-results');
    container.innerHTML = '<div class="gif-loading">Loading...</div>';
    try {
        const res = await fetch(`https://apps.mistium.com/tenor/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        currentSearchResults = data.results || data;
        renderGifs(currentSearchResults, false);
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="gif-error">Failed to load GIFs</div>';
    }
}

function renderGifs(results, isFavorites = false) {
    const container = document.getElementById('gif-results');
    container.innerHTML = '';

    if (!results?.length) {
        container.innerHTML = isFavorites ? '<div class="gif-empty">No favorites yet</div>' : '<div class="gif-empty">No results found</div>';
        return;
    }

    results.forEach(gif => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gif-item-wrapper';

        const previewUrl = isFavorites ? gif.preview : gif.media[0].tinygif.url;
        const itemUrl = isFavorites ? gif.url : gif.itemurl;

        const img = document.createElement('img');
        img.src = previewUrl; img.className = 'gif-result'; img.loading = 'lazy';
        img.onclick = () => { sendGif(itemUrl); closeGifPicker(); };

        const isFav = favoriteGifs.some(f => f.url === itemUrl);
        const starBtn = document.createElement('button');
        starBtn.className = 'gif-star-btn' + (isFav ? ' active' : '');
        starBtn.dataset.url = itemUrl;
        starBtn.innerHTML = _starHtml(isFav);
        starBtn.onclick = async (e) => {
            e.stopPropagation();
            const gifUrl = await resolveTenorGifUrl(itemUrl);
            toggleFavorite({ url: gifUrl, preview: previewUrl });
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
    if (idx > -1) favoriteGifs.splice(idx, 1);
    else favoriteGifs.unshift(data);
    localStorage.setItem('originChats_favGifs', JSON.stringify(favoriteGifs));

    if (currentGifTab === 'favorites') renderGifs(favoriteGifs, true);
    else updateStarIcons();
}

function updateStarIcons() {
    const currentQuery = document.getElementById('gif-search')?.value;
    if (currentQuery && currentGifTab === 'search') {
        document.querySelectorAll('.gif-star-btn').forEach(btn => {
            const isFav = favoriteGifs.some(f => f.url === btn.dataset.url);
            btn.classList.toggle('active', isFav);
            btn.innerHTML = _starHtml(isFav);
            if (window.lucide) window.lucide.createIcons({ root: btn });
        });
    }
    document.querySelectorAll('.chat-fav-btn').forEach(btn => {
        const isFav = favoriteGifs.some(f => f.url === btn.dataset.url);
        btn.classList.toggle('active', isFav);
        btn.innerHTML = _starHtml(isFav);
        if (window.lucide) window.lucide.createIcons({ root: btn });
    });
    const modalFavBtn = document.getElementById('modal-fav-btn');
    if (modalFavBtn?.dataset.url) {
        const isFav = favoriteGifs.some(f => f.url === modalFavBtn.dataset.url);
        modalFavBtn.classList.toggle('active', isFav);
        modalFavBtn.innerHTML = _starHtml(isFav);
        if (window.lucide) window.lucide.createIcons({ root: modalFavBtn });
    }
}

function closeGifPicker() {
    document.getElementById('gif-picker')?.classList.remove('active');
}

async function sendGif(url) {
    const input = document.getElementById('message-input');
    input.value = await resolveTenorGifUrl(url);
    sendMessage();
}

// ─── Image modal ──────────────────────────────────────────────────────────────

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
        favBtn.innerHTML = _starHtml(isFav);
        if (window.lucide) window.lucide.createIcons({ root: favBtn });
    }
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { document.getElementById('modal-image').src = ''; }, 200);
    }
}

function toggleModalFavorite() {
    const favBtn = document.getElementById('modal-fav-btn');
    if (favBtn?.dataset.url) toggleFavorite(favBtn.dataset.url);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

window.toggleFavorite = toggleFavorite;
window.toggleGifPicker = toggleGifPicker;
window.renderEmojis = renderEmojis;
window.addReaction = addReaction;
window.removeReaction = removeReaction;
window.toggleReaction = toggleReaction;
window.toggleEmojiPicker = toggleEmojiPicker;
window.openReactionPicker = openReactionPicker;
window.closeReactionPicker = closeReactionPicker;
window.renderReactions = renderReactions;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.toggleModalFavorite = toggleModalFavorite;
window.getOrCreateMessageOptions = getOrCreateMessageOptions;
window.closeUnifiedPicker = closeUnifiedPicker;
window.switchUnifiedTab = switchUnifiedTab;