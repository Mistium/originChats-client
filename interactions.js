const QUICK_REACTIONS = ['😭', '😔', '💀', '👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '👌'];

let reactionPicker = null;
let reactionPickerMsgId = null;
let recentEmojis = JSON.parse(localStorage.getItem('originchats_recentEmojis') || '[]');
let pickerResizeObserver = null;
let pendingReactions = new Set();

function createReactionPicker() {
    if (reactionPicker) return reactionPicker;

    reactionPicker = document.createElement('div');
    reactionPicker.className = 'reaction-picker';
    reactionPicker.id = 'reaction-picker';
    reactionPicker.innerHTML = `
        <div class="reaction-picker-search">
            <input type="text" id="emoji-search" placeholder="Search emoji..." autocomplete="off" />
        </div>
        <div id="emoji-container"></div>
    `;

    document.body.appendChild(reactionPicker);

    const searchInput = reactionPicker.querySelector('#emoji-search');
    searchInput.addEventListener('input', handleSearch);

    const overlay = document.createElement('div');
    overlay.className = 'reaction-picker-overlay';
    overlay.onclick = closeReactionPicker;
    document.body.appendChild(overlay);

    document.addEventListener('click', (e) => {
        if (reactionPicker && reactionPicker.classList.contains('active')) {
            const isOverlay = e.target.classList.contains('reaction-picker-overlay');
            const isPicker = e.target.closest('.reaction-picker');
            const isEmojiBtn = e.target.closest('#emoji-btn');
            const isReactionBtn = e.target.closest('[data-emoji-anchor]');
            
            if (!isPicker && !isEmojiBtn && !isReactionBtn) {
                closeReactionPicker();
            }
        }
    });

    return reactionPicker;
}

function handleSearch(e) {
    const query = e.target.value.trim();
    const container = document.querySelector('#emoji-container');
    
    if (!query) {
        renderEmojis();
        return;
    }
    
    renderSearchResults(query);
}

function renderEmojis() {
    const container = document.querySelector('#emoji-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (window.shortcodes && window.shortcodes.length > 0) {
        renderFullEmojiPicker(container);
    } else {
        renderQuickReactions(container);
    }
}

function renderQuickReactions(container) {
    const base = (recentEmojis && recentEmojis.length > 0) ? recentEmojis : QUICK_REACTIONS;
    
    const label = document.createElement('div');
    label.className = 'reaction-category';
    label.textContent = window.shortcodes ? 'Recent' : 'Quick Reactions';
    container.appendChild(label);
    
    const grid = document.createElement('div');
    grid.className = 'reaction-emoji-grid';
    
    for (const emoji of base.slice(0, 42)) {
        const btn = document.createElement('span');
        btn.className = 'reaction-picker-emoji';
        btn.textContent = emoji;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectEmoji(emoji);
        });
        grid.appendChild(btn);
    }
    
    container.appendChild(grid);
}

function renderFullEmojiPicker(container) {
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
        const emoji = e.emoji;
        if (!emoji) continue;
        
        const cat = getEmojiCategory(emoji);
        if (categories[cat]) {
            categories[cat].push(emoji);
        } else {
            categories['🙂 Smileys & Emotion'].push(emoji);
        }
    }
    
    for (const [categoryName, emojis] of Object.entries(categories)) {
        if (emojis.length === 0) continue;
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'reaction-category';
        categoryHeader.textContent = categoryName;
        container.appendChild(categoryHeader);
        
        const grid = document.createElement('div');
        grid.className = 'reaction-emoji-grid';
        
        for (const emoji of emojis) {
            const btn = document.createElement('span');
            btn.className = 'reaction-picker-emoji';
            btn.textContent = emoji;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectEmoji(emoji);
            });
            grid.appendChild(btn);
        }
        
        container.appendChild(grid);
    }
    
    const quickHeader = document.createElement('div');
    quickHeader.className = 'reaction-category';
    quickHeader.textContent = 'Quick';
    container.appendChild(quickHeader);
    
    const quickGrid = document.createElement('div');
    quickGrid.className = 'reaction-emoji-grid';
    
    for (const emoji of QUICK_REACTIONS) {
        const btn = document.createElement('span');
        btn.className = 'reaction-picker-emoji';
        btn.textContent = emoji;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectEmoji(emoji);
        });
        quickGrid.appendChild(btn);
    }
    
    container.appendChild(quickGrid);
}

function renderSearchResults(query) {
    const container = document.querySelector('#emoji-container');
    if (!container) return;
    
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
        const label = (e.label || '').toLowerCase();
        const em = e.emoticon;
        let match = label.includes(q);
        if (!match && em) {
            if (Array.isArray(em)) {
                match = em.some(x => (x || '').toLowerCase().includes(q));
            } else {
                match = (em || '').toLowerCase().includes(q);
            }
        }
        if (match && results.length < 120) {
            results.push(e);
        }
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
    
    for (const e of results) {
        const btn = document.createElement('span');
        btn.className = 'reaction-picker-emoji';
        btn.textContent = e.emoji;
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            selectEmoji(e.emoji);
        });
        grid.appendChild(btn);
    }
    
    container.appendChild(grid);
}

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

function openReactionPicker(msgId, anchorEl) {
    const picker = createReactionPicker();
    reactionPickerMsgId = msgId;
    
    const isMobile = window.innerWidth <= 768;
    const overlay = document.querySelector('.reaction-picker-overlay');
    
    if (isMobile) {
        picker.style.left = '0';
        picker.style.right = '0';
        picker.style.top = 'auto';
        picker.style.bottom = '0';
        picker.style.maxWidth = '100vw';
        picker.style.position = 'fixed';
        overlay.classList.add('active');
    } else {
        picker.style.position = 'fixed';
        picker.style.left = 'auto';
        picker.style.right = 'auto';
        picker.style.top = 'auto';
        picker.style.bottom = 'auto';
        picker.style.maxWidth = '350px';
        positionDesktopPicker(picker, anchorEl);
        
        pickerResizeObserver = new ResizeObserver(() => {
            if (picker.classList.contains('active')) {
                positionDesktopPicker(picker, anchorEl);
            }
        });
        pickerResizeObserver.observe(picker);
    }
    
    const search = picker.querySelector('#emoji-search');
    if (search) {
        search.value = '';
        search.focus();
    }
    
    renderEmojis();
    
    picker.classList.add('active');
}

function toggleEmojiPicker(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const btn = document.getElementById('emoji-btn');
    if (!btn) return;
    
    const picker = createReactionPicker();
    
    if (picker.classList.contains('active')) {
        closeReactionPicker();
        return;
    }
    
    reactionPickerMsgId = null;
    
    const isMobile = window.innerWidth <= 768;
    const overlay = document.querySelector('.reaction-picker-overlay');
    
    if (isMobile) {
        picker.style.left = '0';
        picker.style.right = '0';
        picker.style.top = 'auto';
        picker.style.bottom = '0';
        picker.style.maxWidth = '100vw';
        picker.style.position = 'fixed';
        overlay.classList.add('active');
    } else {
        picker.style.position = 'fixed';
        picker.style.left = 'auto';
        picker.style.right = 'auto';
        picker.style.top = 'auto';
        picker.style.bottom = 'auto';
        picker.style.maxWidth = '350px';
        positionDesktopPicker(picker, btn);
        
        pickerResizeObserver = new ResizeObserver(() => {
            if (picker.classList.contains('active')) {
                positionDesktopPicker(picker, btn);
            }
        });
        pickerResizeObserver.observe(picker);
    }
    
    const search = picker.querySelector('#emoji-search');
    if (search) {
        search.value = '';
        search.focus();
    }
    
    renderEmojis();
    
    picker.classList.add('active');
}

function positionDesktopPicker(picker, btn) {
    const rect = btn.getBoundingClientRect();
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

function closeReactionPicker() {
    if (reactionPicker) {
        reactionPicker.classList.remove('active');
        reactionPickerMsgId = null;
    }
    
    if (pickerResizeObserver) {
        pickerResizeObserver.disconnect();
        pickerResizeObserver = null;
    }
    
    const overlay = document.querySelector('.reaction-picker-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function selectEmoji(emoji) {
    recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 50);
    localStorage.setItem('originChats_recentEmojis', JSON.stringify(recentEmojis));
    
    const msgId = reactionPickerMsgId;
    closeReactionPicker();
    
    if (msgId) {
        addReaction(msgId, emoji);
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

function addReaction(msgId, emoji) {
    const key = `${msgId}:${emoji}:add`;
    if (pendingReactions.has(key)) return;
    
    pendingReactions.add(key);
    
    const sent = wsSend({
        cmd: 'message_react_add',
        id: msgId,
        emoji: emoji,
        channel: state.currentChannel.name
    }, state.serverUrl);
    
    if (!sent) {
        pendingReactions.delete(key);
        showError('Failed to add reaction - connection lost');
    } else {
        setTimeout(() => pendingReactions.delete(key), 1000);
    }
}

function removeReaction(msgId, emoji) {
    const key = `${msgId}:${emoji}:remove`;
    if (pendingReactions.has(key)) return;
    
    pendingReactions.add(key);
    
    const sent = wsSend({
        cmd: 'message_react_remove',
        id: msgId,
        emoji: emoji,
        channel: state.currentChannel.name
    }, state.serverUrl);
    
    if (!sent) {
        pendingReactions.delete(key);
        showError('Failed to remove reaction - connection lost');
    } else {
        setTimeout(() => pendingReactions.delete(key), 1000);
    }
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
let originalInputValue = '';

Object.defineProperty(window, 'editingMessage', {
    get() {
        return editingMessage;
    },
    set(val) {
        editingMessage = val;
    }
});

function startEditMessage(msg) {
    editingMessage = msg;
    const input = document.getElementById('message-input');
    originalInputValue = input.value;
    input.value = msg.content;
    input.focus();

    const user = getUserByUsernameCaseInsensitive(msg.user) || { username: msg.user };
    document.getElementById('reply-text').textContent = `Editing @${user.username}`;
    document.getElementById('reply-bar').classList.add('active', 'editing-mode');
}

function cancelEdit() {
    editingMessage = null;
    originalInputValue = '';
    const input = document.getElementById('message-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    document.getElementById('reply-bar').classList.remove('active', 'editing-mode');
}

window.startEditMessage = startEditMessage;
window.cancelEdit = cancelEdit;

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
            <button class="gif-picker-close" onclick="closeGifPicker()" title="Close">
                <i data-lucide="x"></i>
            </button>
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
window.renderEmojis = renderEmojis;
window.addReaction = addReaction;
window.removeReaction = removeReaction;
window.toggleReaction = toggleReaction;
window.toggleEmojiPicker = toggleEmojiPicker;
window.openReactionPicker = openReactionPicker;
window.closeReactionPicker = closeReactionPicker;

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
