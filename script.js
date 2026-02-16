const wsConnections = {};
const wsStatus = {};
const serverValidatorKeys = {};
const authRetries = {};
const authRetryTimeouts = {};

let state = {
    token: null,
    serverUrl: 'dms.mistium.com',
    validatorsByServer: {},
    server: {},
    channelsByServer: {},
    currentChannel: null,
    messagesByServer: {},
    usersByServer: {},
    currentUserByServer: {},
    replyTo: null,
    servers: [],
    pingsByServer: {},
    serverPingsByServer: {},
    memberListDrawn: false,
    unreadPings: {},
    unreadCountsByServer: {},
    unreadByChannel: {},
    _avatarCache: {},
    _avatarLoading: {},
    typingUsersByServer: {},
    typingTimeoutsByServer: {},
    _embedCache: {},
    lastChannelByServer: {},
    dmServers: [],
    loadingChannelsByServer: {},
    pendingChannelSelectsByServer: {},
    pendingMessageFetchesByChannel: {},
    switchingServer: false,
    renderInProgress: false,
    authenticatingByServer: {},
    pendingReplyFetches: {},
    friends: [],
    friendRequests: [],
    blockedUsers: []
};

const pendingReplyTimeouts = {};
let originFS = null;

Object.defineProperty(state, 'channels', {
    get() {
        return state.channelsByServer[state.serverUrl] || [];
    },
    set(value) {
        state.channelsByServer[state.serverUrl] = value;
    }
});

Object.defineProperty(state, 'messages', {
    get() {
        return state.messagesByServer[state.serverUrl] || {};
    },
    set(value) {
        state.messagesByServer[state.serverUrl] = value;
    }
});

Object.defineProperty(state, 'pings', {
    get() {
        if (!state.pingsByServer[state.serverUrl]) {
            state.pingsByServer[state.serverUrl] = {};
        }
        return state.pingsByServer[state.serverUrl];
    },
    set(value) {
        state.pingsByServer[state.serverUrl] = value;
    }
});

Object.defineProperty(state, 'users', {
    get() {
        return state.usersByServer[state.serverUrl] || {};
    },
    set(value) {
        state.usersByServer[state.serverUrl] = value;
    }
});

Object.defineProperty(state, 'currentUser', {
    get() {
        return state.currentUserByServer[state.serverUrl];
    },
    set(value) {
        state.currentUserByServer[state.serverUrl] = value;
    }
});

Object.defineProperty(state, 'typingUsers', {
    get() {
        if (!state.typingUsersByServer[state.serverUrl]) {
            state.typingUsersByServer[state.serverUrl] = {};
        }
        return state.typingUsersByServer[state.serverUrl];
    },
    set(value) {
        state.typingUsersByServer[state.serverUrl] = value;
    }
});

Object.defineProperty(state, 'typingTimeouts', {
    get() {
        if (!state.typingTimeoutsByServer[state.serverUrl]) {
            state.typingTimeoutsByServer[state.serverUrl] = {};
        }
        return state.typingTimeoutsByServer[state.serverUrl];
    },
    set(value) {
        state.typingTimeoutsByServer[state.serverUrl] = value;
    }
});

const DEFAULT_SERVERS = [
    {
        name: 'OriginChats',
        url: 'chats.mistium.com',
        icon: null
    }
];

async function loadServers() {
    const path = '/application data/chats@mistium/servers.json';
    try {
        await originFS.createFolders('/application data/chats@mistium');
        const content = await originFS.readFileContent(path);
        const servers = JSON.parse(content);
        return servers;
    } catch (error) {
        return [...DEFAULT_SERVERS];
    }
}

async function saveServers() {
    const path = '/application data/chats@mistium/servers.json';
    const content = JSON.stringify(state.servers);
    try {
        await originFS.createFolders('/application data/chats@mistium');
        if (await originFS.exists(path)) {
            await originFS.writeFile(path, content);
        } else {
            await originFS.createFile(path, content);
        }
        await originFS.commit();
    } catch (error) {
        console.error('Failed to save servers:', error);
    }
}

function getChannelDisplayName(channel) {
    return channel.display_name || channel.name;
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
function playPingSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

window.onload = async function () {
    requestNotificationPermission();


    const savedToken = localStorage.getItem('originchats_token');


    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');

    if (token) {
        state.token = token;
        localStorage.setItem('originchats_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (savedToken) {
        state.token = savedToken;
    } else {
        window.location.href = `https://rotur.dev/auth?return_to=${encodeURIComponent(window.location.href)}`;
        return;
    }

    originFS = new window.originFSKit.OriginFSClient(state.token);

    state.servers = await loadServers();


    const savedLastChannels = localStorage.getItem('originchats_last_channels');
    if (savedLastChannels) {
        state.lastChannelByServer = JSON.parse(savedLastChannels);
    }

    const savedDMServers = localStorage.getItem('originchats_dm_servers');
    if (savedDMServers) {
        state.dmServers = JSON.parse(savedDMServers);
    }


    state.servers.forEach(server => {
        if (!state.unreadCountsByServer[server.url]) {
            state.unreadCountsByServer[server.url] = 0;
        }
    });
    if (!state.unreadCountsByServer['dms.mistium.com']) {
        state.unreadCountsByServer['dms.mistium.com'] = 0;
    }
    if (!state.serverPingsByServer['dms.mistium.com']) {
        state.serverPingsByServer['dms.mistium.com'] = 0;
    }


    renderGuildSidebar();

    connectToAllServers();

    const input = document.getElementById('message-input');
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        handleMentionInput();
        handleChannelInput();
    });

    input.addEventListener('keydown', function (e) {
        if (handleMentionNavigation(e) || handleChannelNavigation(e)) {
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }

        if (e.key === 'ArrowUp' && !this.value.trim() && !window.editingMessage) {
            e.preventDefault();
            const channel = state.currentChannel?.name;
            if (!channel) return;
            const messages = state.messages[channel] || [];
            const myMessages = messages.filter(m => m.user === state.currentUser?.username);
            if (myMessages.length > 0) {
                const lastMessage = myMessages[myMessages.length - 1];
                if (window.startEditMessage) {
                    window.startEditMessage(lastMessage);
                }
            }
        }
    });


    let touchStartX = 0;

    if (window.lucide) window.lucide.createIcons();
    let touchEndX = 0;
    const messagesContainer = document.querySelector('.messages-container');

    messagesContainer.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    messagesContainer.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        if (touchStartX > 50) return;

        const swipeDistance = touchEndX - touchStartX;
        if (swipeDistance > 100) {
            toggleMenu();
        }
    }


    document.addEventListener('click', function (e) {
        if (!e.target.closest('.server-info')) {
            closeServerDropdown();
        }
    });


    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeSettings();
            closeServerConfigModal();
            closeAccountModal();
            closeMenu();
            closeServerDropdown();
            if (window.editingMessage) {
                window.cancelEdit();
            } else if (state.replyTo) {
                cancelReply();
            }
        }

        if (window.canSendMessages) {
            const input = document.getElementById('message-input');
            const active = document.activeElement;
            const isInputFocused = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
            if (input && active !== input && !isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                input.focus();
                const startPos = input.selectionStart;
                const endPos = input.selectionEnd;
                const value = input.value;
                input.value = value.slice(0, startPos) + e.key + value.slice(endPos);
                input.selectionStart = input.selectionEnd = startPos + 1;
                input.dispatchEvent(new Event('input'));
            }
        }
    });

    setupTypingListener();
    setupInfiniteScroll();

    window.shortcodes = null;
    window.shortcodeMap = {};

    fetch("shortcodes.json")
        .then(response => response.json())
        .then(data => {
            window.shortcodes = data;

            for (const e of data) {
                const code = e.label.toLowerCase().replace(/\s+/g, "_");

                shortcodeMap[`:${code}:`] = e.emoji;

                if (e.emoticon) {
                    if (Array.isArray(e.emoticon)) {
                        e.emoticon.forEach(x => shortcodeMap[x] = e.emoji);
                    } else {
                        shortcodeMap[e.emoticon] = e.emoji;
                    }
                }
            }


            const picker = document.querySelector('.reaction-picker');
            if (picker && picker.classList.contains('active')) {
                if (window.renderEmojis) {
                    window.renderEmojis();
                }
            }
        });
};

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showNotification(title, body, channel) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            tag: channel
        });

        notification.onclick = function () {
            window.focus();
            notification.close();
        };
    }
}

function toggleMenu() {
    const channels = document.getElementById('channels');
    const guildSidebar = document.querySelector('.guild-sidebar');
    const overlay = document.querySelector('.overlay');
    const chatScreen = document.getElementById('chat-screen');
    channels.classList.toggle('open');
    guildSidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    chatScreen.classList.toggle('overlay-active');
}

function toggleMembersList() {
    const membersList = document.getElementById('members-list');
    const overlay = document.querySelector('.overlay');
    const chatScreen = document.getElementById('chat-screen');
    membersList.classList.toggle('open');
    overlay.classList.toggle('active');
    chatScreen.classList.toggle('overlay-active');
}

function closeMenu() {
    document.querySelector('.channels').classList.remove('open');
    document.querySelector('.guild-sidebar').classList.remove('open');
    document.getElementById('members-list').classList.remove('open');
    document.querySelector('.overlay').classList.remove('active');
    document.getElementById('chat-screen').classList.remove('overlay-active');
}


let accountCache = {};

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
    closeServerConfigModal();
}

function closeServerConfigModal() {
    const modal = document.getElementById('server-config-modal');
    if (modal) modal.classList.remove('active');
    editingServerId = null;
}

function openSettings() {
    closeMenu();
    closeAccountModal();
    const modal = document.getElementById('settings-modal');
    if (!modal) {
        console.error('Settings modal not found in DOM');
        return;
    }
    modal.classList.add('active');
    console.log('Settings modal opened');
    renderMediaServersSettings();
    initVoiceSettings();
    initPrivacySettings();
    initChatSettings();
    initAppearanceSettings();
}

function openAccountModal(username) {
    const modal = document.getElementById('account-modal');
    const content = document.getElementById('account-content');

    modal.classList.add('active');


    content.innerHTML = `
        <div class="account-loading">
            <div class="account-loading-spinner"></div>
            <div class="account-loading-text">Loading profile...</div>
        </div>
    `;


    fetchAccountProfile(username);


    if (window.lucide) window.lucide.createIcons({ root: content });
}

function closeAccountModal() {
    document.getElementById('account-modal').classList.remove('active');
    closeServerConfigModal();
    closeSettings();
}

function openCurrentUserProfile() {
    if (state.currentUser && state.currentUser.username) {
        openAccountModal(state.currentUser.username);
    }
}


window.openCurrentUserProfile = openCurrentUserProfile;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.renderMediaServersSettings = renderMediaServersSettings;
window.toggleServerEnabled = toggleServerEnabled;
window.deleteServer = deleteServer;
window.openAddServerModal = openAddServerModal;
window.editServer = editServer;
window.closeServerConfigModal = closeServerConfigModal;
window.addHeaderRow = addHeaderRow;
window.addBodyParamRow = addBodyParamRow;
window.showError = showError;
window.hideErrorBanner = hideErrorBanner;

function updateGuildActiveState() {
    const guildItems = document.querySelectorAll('.guild-item');
    guildItems.forEach(item => {
        if (item.dataset.url === state.serverUrl) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function showHome() {

    if (state.serverUrl !== 'dms.mistium.com') {
        switchServer('dms.mistium.com');
    }
}

async function fetchAccountProfile(username) {

    if (accountCache[username] && Date.now() - accountCache[username]._timestamp < 60000) {
        renderAccountProfile(accountCache[username]);
        return;
    }

    try {
        const response = await fetch(`https://api.rotur.dev/profile?include_posts=0&name=${encodeURIComponent(username)}`);

        if (!response.ok) {
            throw new Error('Profile not found');
        }

        const data = await response.json();
        data._timestamp = Date.now();
        accountCache[username] = data;

        renderAccountProfile(data);
    } catch (error) {
        const content = document.getElementById('account-content');
        content.innerHTML = `
            <div class="account-error">
                <div style="font-size: 48px; margin-bottom: 16px;">😔</div>
                <div>Could not load profile</div>
                <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">${error.message}</div>
            </div>
        `;
    }
}
async function fetchMyAccountData() {
    try {
        const response = await fetch(`https://api.rotur.dev/me?auth=${encodeURIComponent(state.token)}`);

        if (response.ok) {
            const data = await response.json();
            state.friends = data['sys.friends'] || [];
            state.friendRequests = data['sys.requests'] || [];
            state.blockedUsers = data['sys.blocked'] || [];
            renderDMTabContent(currentDMTab);
        }
    } catch (error) {
        console.error('Failed to fetch account data:', error);
    }
}

let currentDMTab = 'friends';

function switchDMTab(tab) {
    currentDMTab = tab;
    const tabs = document.querySelectorAll('.dm-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    const dmFriendsContainer = document.getElementById('dm-friends-container');
    const messagesEl = document.getElementById('messages');
    if (dmFriendsContainer) dmFriendsContainer.style.display = 'block';
    if (messagesEl) messagesEl.style.display = 'none';

    renderDMTabContent(tab);
}

function renderDMTabContent(tab) {
    const dmFriendsContainer = document.getElementById('dm-friends-container');
    if (!dmFriendsContainer) return;

    dmFriendsContainer.innerHTML = '';

    const tabTitle = document.createElement('div');
    tabTitle.className = 'dm-section-title';
    tabTitle.style.cssText = 'font-weight: 600; color: var(--text-dim); font-size: 12px; padding: 16px 20px 8px 20px; text-transform: uppercase; letter-spacing: 0.5px;';

    if (tab === 'friends') {
        tabTitle.textContent = 'FRIENDS';
        dmFriendsContainer.appendChild(tabTitle);

        if (state.friends.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = 'padding: 16px 20px; color: var(--text-dim); font-size: 14px;';
            emptyState.textContent = 'No friends yet';
            dmFriendsContainer.appendChild(emptyState);
            return;
        }

        state.friends.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const dmButton = document.createElement('button');
            dmButton.className = 'dm-action-btn';
            dmButton.title = 'Open DM';
            dmButton.style.cssText = 'background: var(--surface-light); border: none; color: var(--text-dim); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            dmButton.innerHTML = '<i data-lucide="message-square" style="width: 18px; height: 18px;"></i>';
            dmButton.onclick = (e) => {
                e.stopPropagation();
                openDM(username);
            };

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(dmButton);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            dmFriendsContainer.appendChild(item);
        });
    } else if (tab === 'requests') {
        tabTitle.textContent = 'FRIEND REQUESTS';
        dmFriendsContainer.appendChild(tabTitle);

        if (state.friendRequests.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = 'padding: 16px 20px; color: var(--text-dim); font-size: 14px;';
            emptyState.textContent = 'No pending requests';
            dmFriendsContainer.appendChild(emptyState);
            return;
        }

        state.friendRequests.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const actionButtons = document.createElement('div');
            actionButtons.style.cssText = 'display: flex; gap: 8px;';

            const acceptButton = document.createElement('button');
            acceptButton.className = 'dm-action-btn accept-btn';
            acceptButton.title = 'Accept';
            acceptButton.style.cssText = 'background: var(--success); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            acceptButton.innerHTML = '<i data-lucide="check" style="width: 18px; height: 18px;"></i>';
            acceptButton.onclick = (e) => {
                e.stopPropagation();
                acceptFriendRequest(username);
            };

            const rejectButton = document.createElement('button');
            rejectButton.className = 'dm-action-btn reject-btn';
            rejectButton.title = 'Reject';
            rejectButton.style.cssText = 'background: var(--danger); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            rejectButton.innerHTML = '<i data-lucide="x" style="width: 18px; height: 18px;"></i>';
            rejectButton.onclick = (e) => {
                e.stopPropagation();
                rejectFriendRequest(username);
            };

            actionButtons.appendChild(acceptButton);
            actionButtons.appendChild(rejectButton);

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(actionButtons);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            dmFriendsContainer.appendChild(item);
        });
    } else if (tab === 'blocked') {
        tabTitle.textContent = 'BLOCKED USERS';
        dmFriendsContainer.appendChild(tabTitle);

        if (state.blockedUsers.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = 'padding: 16px 20px; color: var(--text-dim); font-size: 14px;';
            emptyState.textContent = 'No blocked users';
            dmFriendsContainer.appendChild(emptyState);
            return;
        }

        state.blockedUsers.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const unblockButton = document.createElement('button');
            unblockButton.className = 'dm-action-btn unblock-btn';
            unblockButton.title = 'Unblock';
            unblockButton.style.cssText = 'background: var(--surface-light); border: none; color: var(--text-dim); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            unblockButton.innerHTML = '<i data-lucide="unlock" style="width: 18px; height: 18px;"></i>';
            unblockButton.onclick = (e) => {
                e.stopPropagation();
                unblockUser(username);
            };

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(unblockButton);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            dmFriendsContainer.appendChild(item);
        });
    }

    if (window.lucide) window.lucide.createIcons({ root: dmFriendsContainer });
}

function openDM(username) {
    if (state.serverUrl !== 'dms.mistium.com') {
        switchServer('dms.mistium.com');
    }

    setTimeout(() => {
        const cmdsChannel = state.channels.find(c => c.name === 'cmds');
        if (cmdsChannel) {
            wsSend({ cmd: 'message_new', content: `dm add ${username}`, channel: 'cmds' }, 'dms.mistium.com');
        }
    }, 100);
}

async function acceptFriendRequest(username) {
    try {
        const response = await fetch(`https://api.rotur.dev/friends/accept/${encodeURIComponent(username)}?auth=${encodeURIComponent(state.token)}`);
        if (response.ok) {
            await fetchMyAccountData();
            renderDMTabContent('requests');
        }
    } catch (error) {
        console.error('Failed to accept friend request:', error);
    }
}

async function rejectFriendRequest(username) {
    try {
        const response = await fetch(`https://api.rotur.dev/friends/reject/${encodeURIComponent(username)}?auth=${encodeURIComponent(state.token)}`);
        if (response.ok) {
            await fetchMyAccountData();
            renderDMTabContent('requests');
        }
    } catch (error) {
        console.error('Failed to reject friend request:', error);
    }
}

async function unblockUser(username) {
    try {
        const response = await fetch(`https://api.rotur.dev/me/unblock/${encodeURIComponent(username)}?auth=${encodeURIComponent(state.token)}`);
        if (response.ok) {
            await fetchMyAccountData();
            renderDMTabContent('blocked');
        }
    } catch (error) {
        console.error('Failed to unblock user:', error);
    }
}

function renderAccountProfile(data) {
    const content = document.getElementById('account-content');

    const joinedDate = new Date(data.created).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let bannerHtml = '';
    if (data.banner) {
        bannerHtml = `<img src="${data.banner}" alt="Banner">`;
    }

    const statusFromClass = getUserStatusInServer(data.username);
    const avatarSrc = data.pfp;
    const isCurrentUser = state.currentUser && state.currentUser.username === data.username;
    const isDM = state.serverUrl === 'dms.mistium.com';

    let userRoles = [];
    if (!isDM) {
        const serverUser = getUserByUsernameCaseInsensitive(data.username, state.serverUrl);
        if (serverUser && serverUser.roles && serverUser.roles.length > 0) {
            userRoles = serverUser.roles;
        }
    }

    content.innerHTML = `
        <div class="account-banner">
            ${bannerHtml}
        </div>
        <div class="account-avatar-section">
            <div class="account-avatar">
                <img src="${avatarSrc}" alt="${data.username}">
                <div class="account-status-indicator ${statusFromClass}"></div>
            </div>
        </div>
        <div class="account-names-section">
            <div class="account-username-text">${data.username}</div>
            ${data.pronouns ? `<div class="account-global-name">${data.pronouns}</div>` : ''}
        </div>
    <div class="account-stats">
        <div class="account-stat">
            <div class="account-stat-value">${data.followers || 0}</div>
            <div class="account-stat-label">Followers</div>
        </div>
        <div class="account-stat">
            <div class="account-stat-value">${data.following || 0}</div>
            <div class="account-stat-label">Following</div>
        </div>
        <div class="account-stat">
            <div class="account-stat-value">${data.currency ? data.currency.toLocaleString() : 0}</div>
            <div class="account-stat-label">Credits</div>
        </div>
        <div class="account-stat">
            <div class="account-stat-value">${data.subscription || 'Free'}</div>
            <div class="account-stat-label">Tier</div>
        </div>
    </div>
    ${userRoles.length > 0 ? `
    <div class="account-section">
        <div class="account-section-title">Roles</div>
        <div class="account-roles">
            ${userRoles.map(role => `<span class="account-role">${escapeHtml(role)}</span>`).join('')}
        </div>
    </div>
    ` : ''}
    ${data.bio ? `
    <div class="account-section">
        <div class="account-section-title">About Me</div>
        <div class="account-bio">${escapeHtml(data.bio)}</div>
    </div>
    ` : ''}
    <div class="account-section">
        <div class="account-section-title">Member Since</div>
        <div class="account-meta">
            <div class="account-meta-item">
                <i data-lucide="calendar"></i>
                <span>${joinedDate}</span>
            </div>
        </div>
    </div>
    ${isCurrentUser ? `
    <div class="account-section account-actions-section">
        <button class="account-logout-button" onclick="logout()">
            <i data-lucide="log-out"></i>
            <span>Log Out</span>
        </button>
    </div>
    ` : ''}
`;

    if (window.lucide) window.lucide.createIcons({ root: content });
}

function getUserStatusInServer(username) {
    const user = getUserByUsernameCaseInsensitive(username, state.serverUrl);
    if (!user) {
        return 'offline';
    }
    switch (user.status) {
        case 'online':
            return 'online';
        case 'idle':
            return 'idle';
        default:
            return 'offline';
    }
}

function updateAccountProfileStatusIndicator() {
    const indicator = document.querySelector('.account-status-indicator');
    if (!indicator) return;

    const username = document.querySelector('.account-username-text');
    if (!username) return;

    const statusClass = getUserStatusInServer(username.textContent);
    indicator.className = `account-status-indicator ${statusClass}`;
}

function getUserByUsernameCaseInsensitive(username, serverUrl) {
    const targetServerUrl = serverUrl || state.serverUrl;
    const users = state.usersByServer[targetServerUrl] || {};
    const lowerUsername = username.toLowerCase();
    for (const [key, user] of Object.entries(users)) {
        if (key.toLowerCase() === lowerUsername) {
            return user;
        }
    }
    return null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isEmojiOnly(content) {
    if (!content || content.trim().length === 0) return false;

    const trimmed = content.trim();



    if (trimmed.length > 23) return false;


    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const emojis = trimmed.match(emojiRegex) || [];
    const nonEmojiChars = trimmed.replace(emojiRegex, '').replace(/\s/g, '');


    if (nonEmojiChars.length === 0 && emojis.length > 0) {
        return true;
    }

    return false;
}


window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.renderGuildSidebar = renderGuildSidebar;
window.updateGuildActiveState = updateGuildActiveState;
window.leaveServer = leaveServer;
window.showHome = showHome;
window.updateAccountProfileStatusIndicator = updateAccountProfileStatusIndicator;
window.openDiscoveryModal = openDiscoveryModal;
window.closeDiscoveryModal = closeDiscoveryModal;
window.loadDiscoveryServers = loadDiscoveryServers;
window.switchDMTab = switchDMTab;
window.openDM = openDM;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.unblockUser = unblockUser;

function toggleServerDropdown() {
    const dropdown = document.getElementById('server-dropdown');
    const arrow = document.getElementById('dropdown-arrow');
    dropdown.classList.toggle('active');
    arrow.classList.toggle('open');

    if (dropdown.classList.contains('active')) {
        renderServerDropdown();
    }
}

function closeServerDropdown() {
    const dropdown = document.getElementById('server-dropdown');
    const arrow = document.getElementById('dropdown-arrow');
    if (dropdown) dropdown.classList.remove('active');
    if (arrow) arrow.classList.remove('open');
}

async function reorderServers(draggedUrl, targetUrl) {
    const draggedIndex = state.servers.findIndex(s => s.url === draggedUrl);
    const targetIndex = state.servers.findIndex(s => s.url === targetUrl);

    if (draggedIndex === -1 || targetIndex === -1) return;


    const [draggedServer] = state.servers.splice(draggedIndex, 1);


    state.servers.splice(targetIndex, 0, draggedServer);


    await saveServers();


    renderGuildSidebar();
}

function renderGuildSidebar() {
    const guildList = document.getElementById('guild-list');


    const homeGuild = guildList.querySelector('.home-guild');
    guildList.innerHTML = '';

    const addGuildSeperator = () => {
        const addActionDivider = document.createElement('div');
        addActionDivider.className = 'guild-divider';
        guildList.appendChild(addActionDivider);
    }

    if (homeGuild) {

        homeGuild.classList.toggle('active', state.serverUrl === 'dms.mistium.com');


        const homeIcon = homeGuild.querySelector('.guild-icon');
        const dmConn = wsConnections['dms.mistium.com'];
        const existingWarning = homeGuild.querySelector('.guild-warning');

        if (dmConn && dmConn.status === 'error') {
            homeGuild.classList.add('server-error');
            if (!existingWarning) {
                const warningIcon = document.createElement('div');
                warningIcon.className = 'guild-warning';
                warningIcon.innerHTML = '<i data-lucide="alert-circle"></i>';
                warningIcon.style.position = 'absolute';
                warningIcon.style.top = '-2px';
                warningIcon.style.right = '-2px';
                warningIcon.style.background = '#ed4245';
                warningIcon.style.borderRadius = '50%';
                warningIcon.style.width = '16px';
                warningIcon.style.height = '16px';
                warningIcon.style.display = 'flex';
                warningIcon.style.alignItems = 'center';
                warningIcon.style.justifyContent = 'center';
                warningIcon.style.zIndex = '2';
                homeIcon.style.position = 'relative';
                homeGuild.appendChild(warningIcon);
            }
        } else {
            homeGuild.classList.remove('server-error');
            if (existingWarning) {
                existingWarning.remove();
            }
        }


        const homePill = homeGuild.querySelector('.guild-pill');
        if (homePill) {
            if (state.unreadCountsByServer['dms.mistium.com'] > 0) {
                homePill.classList.add('unread');
            } else {
                homePill.classList.remove('unread');
            }
        }


        const existingPing = homeGuild.querySelector('.guild-ping');
        if (state.serverPingsByServer['dms.mistium.com'] > 0) {
            if (!existingPing) {
                const pingIcon = document.createElement('div');
                pingIcon.className = 'guild-ping';
                pingIcon.innerHTML = '<i data-lucide="at-sign"></i>';
                homeIcon.style.position = 'relative';
                homeGuild.appendChild(pingIcon);
            }
        } else if (existingPing) {
            existingPing.remove();
        }

        guildList.appendChild(homeGuild);
    }

    if (state.dmServers && state.dmServers.length > 0) {
        state.dmServers.forEach(dmServer => {
            const item = document.createElement('div');
            item.className = 'guild-item dm-server';
            item.dataset.channel = dmServer.channel;
            item.title = dmServer.name;

            if (state.serverUrl === 'dms.mistium.com' && state.currentChannel?.name === dmServer.channel) {
                item.classList.add('active');
            }

            const icon = document.createElement('div');
            icon.className = 'guild-icon';

            const img = document.createElement('img');
            img.src = `https://avatars.rotur.dev/${dmServer.username}`;
            img.alt = dmServer.name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            icon.appendChild(img);

            const pill = document.createElement('div');
            pill.className = 'guild-pill';

            const channelKey = `dms.mistium.com:${dmServer.channel}`;
            if (state.unreadByChannel[channelKey] > 0) {
                pill.classList.add('unread');
            }

            item.appendChild(icon);
            item.appendChild(pill);

            item.onclick = () => {
                state.dmServers = state.dmServers.filter(dm => dm.channel !== dmServer.channel);
                localStorage.setItem('originchats_dm_servers', JSON.stringify(state.dmServers));
                renderGuildSidebar();

                if (state.serverUrl !== 'dms.mistium.com') {
                    switchServer('dms.mistium.com');
                }

                setTimeout(() => {
                    const channels = state.channelsByServer['dms.mistium.com'] || [];
                    const channel = channels.find(c => c.name === dmServer.channel);
                    if (channel) {
                        selectChannel(channel);
                    } else {
                        state.pendingMessageFetchesByChannel[`dms.mistium.com:${dmServer.channel}`] = true;
                        wsSend({ cmd: 'messages_get', channel: dmServer.channel }, 'dms.mistium.com');
                        const tempChannel = {
                            name: dmServer.channel,
                            display_name: dmServer.name,
                            type: 'text',
                            icon: `https://avatars.rotur.dev/${dmServer.username}`
                        };
                        if (!state.channelsByServer['dms.mistium.com']) {
                            state.channelsByServer['dms.mistium.com'] = [];
                        }
                        const exists = state.channelsByServer['dms.mistium.com'].find(c => c.name === dmServer.channel);
                        if (!exists) {
                            state.channelsByServer['dms.mistium.com'].push(tempChannel);
                        }
                        selectChannel(tempChannel);
                    }
                }, 100);
            };

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showDMContextMenu(e, dmServer);
            });

            guildList.appendChild(item);
        });

        const dmDivider = document.createElement('div');
        dmDivider.className = 'guild-divider';
        dmDivider.style.margin = '4px 0';
        dmDivider.style.height = '1px';
        guildList.appendChild(dmDivider);
    }

    addGuildSeperator();

    state.servers.forEach((server, index) => {
        const item = document.createElement('div');
        item.className = 'guild-item';
        if (server.url === state.serverUrl) {
            item.classList.add('active');
        }
        item.dataset.url = server.url;
        item.dataset.index = index;
        item.draggable = true;

        const icon = document.createElement('div');
        icon.className = 'guild-icon';

        if (server.icon) {
            const img = document.createElement('img');
            img.src = server.icon;
            img.alt = server.name;
            icon.appendChild(img);
        } else {

            const initials = document.createElement('span');
            initials.textContent = server.name.substring(0, 2).toUpperCase();
            initials.style.fontWeight = '600';
            initials.style.fontSize = '18px';
            initials.style.color = '#fff';
            icon.appendChild(initials);
        }

        const conn = wsConnections[server.url];
        if (conn && conn.status === 'error') {
            item.classList.add('server-error');
            item.title = `${server.name} (Not responding - click to reconnect)`;

            const warningIcon = document.createElement('div');
            warningIcon.className = 'guild-warning';
            warningIcon.innerHTML = '<i data-lucide="alert-circle"></i>';
            warningIcon.style.position = 'absolute';
            warningIcon.style.top = '-2px';
            warningIcon.style.right = '-2px';
            warningIcon.style.background = '#ed4245';
            warningIcon.style.borderRadius = '50%';
            warningIcon.style.width = '16px';
            warningIcon.style.height = '16px';
            warningIcon.style.display = 'flex';
            warningIcon.style.alignItems = 'center';
            warningIcon.style.justifyContent = 'center';
            warningIcon.style.zIndex = '2';
            warningIcon.querySelector('i').style.width = '12px';
            warningIcon.querySelector('i').style.height = '12px';
            warningIcon.querySelector('i').style.color = 'white';
            icon.style.position = 'relative';
            item.appendChild(warningIcon);
        } else {
            item.title = server.name;
        }

        const pill = document.createElement('div');
        pill.className = 'guild-pill';


        if (state.unreadCountsByServer[server.url] > 0) {
            pill.classList.add('unread');
        }

        item.appendChild(icon);
        item.appendChild(pill);


        if (state.serverPingsByServer[server.url] > 0) {
            const pingIcon = document.createElement('div');
            pingIcon.className = 'guild-ping';
            pingIcon.innerHTML = '<i data-lucide="at-sign"></i>';
            icon.style.position = 'relative';
            item.appendChild(pingIcon);
        }


        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', server.url);
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.guild-item.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedUrl = e.dataTransfer.getData('text/plain');
            const targetUrl = server.url;

            if (draggedUrl !== targetUrl) {
                reorderServers(draggedUrl, targetUrl);
            }

            item.classList.remove('drag-over');
        });

        item.onclick = (e) => {

            if (e.detail !== 0 && !e.type.includes('drag')) {
                switchServer(server.url);
            }
        };


        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showGuildContextMenu(e, server);
        });

        guildList.appendChild(item);
    });


    addGuildSeperator();


    const addGuildButton = document.createElement('div');
    addGuildButton.className = 'guild-item add-guild';
    addGuildButton.onclick = addNewServer;
    addGuildButton.title = 'Add a Server';
    const addGuildIcon = document.createElement('div');
    addGuildIcon.className = 'guild-icon';
    addGuildIcon.innerHTML = '<i data-lucide="plus"></i>';
    addGuildButton.appendChild(addGuildIcon);
    guildList.appendChild(addGuildButton);


    const discoverGuildButton = document.createElement('div');
    discoverGuildButton.className = 'guild-item discover-guild';
    discoverGuildButton.onclick = openDiscoveryModal;
    discoverGuildButton.title = 'Discover Servers';
    const discoverGuildIcon = document.createElement('div');
    discoverGuildIcon.className = 'guild-icon';
    discoverGuildIcon.innerHTML = '<i data-lucide="compass"></i>';
    discoverGuildButton.appendChild(discoverGuildIcon);
    guildList.appendChild(discoverGuildButton);

    if (window.lucide) window.lucide.createIcons({ root: guildList });
}

function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
}

function showGuildContextMenu(event, server) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = '';

    const copyUrlItem = document.createElement('div');
    copyUrlItem.className = 'context-menu-item';
    copyUrlItem.innerHTML = '<i data-lucide="copy"></i><span>Copy URL</span>';
    copyUrlItem.onclick = () => {
        navigator.clipboard.writeText(server.url);
        closeContextMenu();
    };

    const leaveItem = document.createElement('div');
    leaveItem.className = 'context-menu-item danger';
    leaveItem.innerHTML = '<i data-lucide="log-out"></i><span>Leave Server</span>';
    leaveItem.onclick = () => {
        leaveServer(server.url);
        closeContextMenu();
    };

    menu.appendChild(copyUrlItem);
    menu.appendChild(leaveItem);

    if (!isMobile()) {
        const menuWidth = 200;
        let x = event.clientX;
        let y = event.clientY;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 6;
        if (y + 100 > window.innerHeight) y = window.innerHeight - 100;

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }
    menu.style.display = 'block';

    if (window.lucide) {
        window.lucide.createIcons({ root: menu });
    }

    if (typeof contextMenuOpen !== 'undefined') {
        contextMenuOpen = true;
    }
}

async function leaveServer(url) {
    if (confirm('Leave this server?')) {
        wsSend({ cmd: 'leave' }, url);

        state.servers = state.servers.filter(s => s.url !== url);
        await saveServers();


        if (wsConnections[url]) {
            wsConnections[url].socket.onclose = null;
            wsConnections[url].socket.onerror = null;
            if (wsConnections[url].socket.readyState !== WebSocket.CLOSED) {
                wsConnections[url].socket.close();
            }
            delete wsConnections[url];
            delete wsStatus[url];
        }


        delete state.channelsByServer[url];
        delete state.messagesByServer[url];
        delete state.pingsByServer[url];
        delete state.usersByServer[url];
        delete state.currentUserByServer[url];

        if (state.serverUrl === url) {
            if (state.servers.length > 0) {
                switchServer(state.servers[0].url);
            } else {

                Object.keys(wsConnections).forEach(key => {
                    wsConnections[key].socket.onclose = null;
                    wsConnections[key].socket.onerror = null;
                    if (wsConnections[key].socket.readyState !== WebSocket.CLOSED) {
                        wsConnections[key].socket.close();
                    }
                });
                Object.keys(wsConnections).forEach(key => {
                    delete wsConnections[key];
                    delete wsStatus[key];
                });
            }
        }

        renderGuildSidebar();
    }
}

function renderServerDropdown() {

    renderGuildSidebar();
}

function addNewServer() {
    const url = prompt('Enter server URL (e.g., chats.mistium.com):');
    if (url && url.trim()) {
        switchServer(url.trim());
    }
}

function openDiscoveryModal() {
    const modal = document.getElementById('discovery-modal');
    modal.classList.add('active');
    loadDiscoveryServers();
}

function closeDiscoveryModal() {
    const modal = document.getElementById('discovery-modal');
    modal.classList.remove('active');
}

async function loadDiscoveryServers() {
    const loadingEl = document.getElementById('discovery-loading');
    const errorEl = document.getElementById('discovery-error');
    const listEl = document.getElementById('discovery-list');

    loadingEl.style.display = 'flex';
    errorEl.style.display = 'none';
    listEl.innerHTML = '';

    try {
        const response = await fetch('discovery.json');
        if (!response.ok) {
            throw new Error('Failed to load discovery.json');
        }

        const servers = await response.json();

        loadingEl.style.display = 'none';

        if (servers.length === 0) {
            listEl.innerHTML = '<p class="discovery-empty">No servers found</p>';
            return;
        }

        servers.forEach(server => {
            const isJoined = state.servers.some(s => s.url === server.url);
            const age = calculateServerAge(server.created_at);

            const card = document.createElement('div');
            card.className = 'discovery-card';

            const iconDiv = document.createElement('div');
            iconDiv.className = 'discovery-icon';

            if (server.icon) {
                const img = document.createElement('img');
                img.src = server.icon;
                img.alt = server.name;
                iconDiv.appendChild(img);
            } else {
                const initials = document.createElement('span');
                initials.textContent = server.name.substring(0, 2).toUpperCase();
                iconDiv.appendChild(initials);
            }

            const infoDiv = document.createElement('div');
            infoDiv.className = 'discovery-info';

            infoDiv.innerHTML = `
                <h3>${escapeHtml(server.name)}</h3>
                <div class="discovery-meta">
                    <span><i data-lucide="user"></i> ${escapeHtml(server.owner)}</span>
                    <span><i data-lucide="clock"></i> ${age}</span>
                </div>
            `;

            const actionDiv = document.createElement('div');
            actionDiv.className = 'discovery-actions';

            const joinBtn = document.createElement('button');
            joinBtn.className = isJoined ? 'btn btn-secondary' : 'btn btn-primary';
            joinBtn.disabled = isJoined;
            joinBtn.innerHTML = isJoined ? '<i data-lucide="check"></i> Joined' : '<i data-lucide="plus"></i> Join';

            if (!isJoined) {
                joinBtn.onclick = () => joinDiscoveryServer(server);
            }

            actionDiv.appendChild(joinBtn);

            card.appendChild(iconDiv);
            card.appendChild(infoDiv);
            card.appendChild(actionDiv);

            listEl.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons({ root: listEl });

    } catch (error) {
        console.error('Failed to load discovery servers:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'flex';
    }
}

function calculateServerAge(createdTimestamp) {
    if (!createdTimestamp) return 'Unknown';

    const now = Date.now();
    const diffMs = now - createdTimestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
        return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    } else if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        return 'Today';
    }
}

async function joinDiscoveryServer(server) {
    try {

        state.servers.push({
            name: server.name,
            url: server.url,
            icon: server.icon || null
        });


        state.unreadCountsByServer[server.url] = 0;


        await saveServers();


        if (!wsConnections[server.url]) {
            connectToServer(server.url);
        }


        renderGuildSidebar();


        switchServer(server.url);


        closeDiscoveryModal();

    } catch (error) {
        console.error('Failed to join server:', error);
        showError('Failed to join server. Please try again.');
    }
}

function switchServer(url) {
    if (state.switchingServer) {
        return;
    }
    state.switchingServer = true;
    const originalUrl = state.serverUrl;

    if (state.currentChannel) {
        state.lastChannelByServer[originalUrl] = state.currentChannel.name;
        localStorage.setItem('originchats_last_channels', JSON.stringify(state.lastChannelByServer));
    }

    Object.keys(state.pendingMessageFetchesByChannel).forEach(key => {
        if (key.startsWith(`${originalUrl}:`)) {
            delete state.pendingMessageFetchesByChannel[key];
        }
    });

    document.getElementById('messages').innerHTML = '<div class="loading-throbber"></div>';

    clearRateLimit();

    state.serverUrl = url;
    localStorage.setItem('serverUrl', url);


    state.unreadCountsByServer[url] = 0;


    if (state.serverPingsByServer[url]) {
        state.serverPingsByServer[url] = 0;
    }


    renderGuildSidebar();

    state.currentChannel = null;


    if (!wsConnections[url] || wsConnections[url].status !== 'connected') {
        connectToServer(url);
    }


    const server = state.servers.find(s => s.url === url);
    const serverName = server ? server.name : (url === 'dms.mistium.com' ? 'Direct Messages' : url);
    document.getElementById('server-name').innerHTML = `<span>${serverName}</span>`;

    let channelHeaderName = document.getElementById('channel-header-name');
    const serverChannelHeader = document.getElementById('server-channel-header');

    if (url === 'dms.mistium.com') {
        // Hide entire header on DMs server
        if (serverChannelHeader) serverChannelHeader.style.display = 'none';
        fetchMyAccountData();
        selectHomeChannel();
        const dmFriendsContainer = document.getElementById('dm-friends-container');
        const messagesEl = document.getElementById('messages');
        if (dmFriendsContainer) dmFriendsContainer.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'none';
    } else {
        if (serverChannelHeader) serverChannelHeader.style.display = 'flex';
        if (channelHeaderName) channelHeaderName.parentElement.style.display = 'flex';
        const addBtn = document.getElementById('channel-add-btn');
        if (addBtn) addBtn.style.display = 'none';
        const dmFriendsContainer = document.getElementById('dm-friends-container');
        const messagesEl = document.getElementById('messages');
        if (dmFriendsContainer) dmFriendsContainer.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'flex';

        if (channelHeaderName) channelHeaderName.textContent = serverName;
    }


    renderChannels();


    const channels = state.channels;
    if (channels.length > 0 && url !== 'dms.mistium.com') {
        if (state.loadingChannelsByServer[url]) {
            delete state.pendingChannelSelectsByServer[url];
        } else {
            const lastChannelName = state.lastChannelByServer[url];
            const lastChannel = lastChannelName ? channels.find(c => c.name === lastChannelName) : null;
            if (lastChannel || channels[0]) {
                selectChannel(lastChannel || channels[0]);
            }
        }
    } else if (url !== 'dms.mistium.com') {

        document.getElementById('channel-name').textContent = '';
        document.getElementById('messages').innerHTML = '';
    }


    renderMembers(state.currentChannel);

    state.switchingServer = false;
}

async function saveServer(server) {

    const isDM = server.url === 'dms.mistium.com';
    if (isDM) return;


    if (!state.unreadCountsByServer[server.url]) {
        state.unreadCountsByServer[server.url] = 0;
    }

    const existing = state.servers.find(s => s.url === server.url);
    if (!existing) {
        state.servers.push(server);
    } else {
        Object.assign(existing, server);
    }
    await saveServers();


    renderGuildSidebar();
}

function connectToServer(serverUrl) {
    const url = serverUrl || state.serverUrl;

    if (reconnectTimeouts[url]) {
        clearTimeout(reconnectTimeouts[url]);
        reconnectTimeouts[url] = null;
    }
    reconnectAttempts[url] = 0;

    const isFirstConnection = !Object.values(wsConnections).some(conn => conn && conn.status === 'connected');
    const authScreen = document.getElementById('auth-screen');
    const isAuthScreenVisible = authScreen && authScreen.classList.contains('active');

    if (isFirstConnection || isAuthScreenVisible) {
        if (authScreen) authScreen.classList.remove('active');
        const chatScreen = document.getElementById('chat-screen');
        if (chatScreen) chatScreen.classList.add('active');
    }

    if (wsConnections[url]) {
        console.warn(`Closing existing connection to ${url} before reconnecting`);
        wsConnections[url].socket.onclose = null;
        wsConnections[url].socket.onerror = null;
        if (wsConnections[url].socket.readyState !== WebSocket.CLOSED) {
            wsConnections[url].socket.close();
        }
        wsConnections[url] = null;
    }

    wsStatus[url] = 'connecting';

    const ws = new WebSocket(`wss://${url}`);

    wsConnections[url] = {
        socket: ws,
        status: 'connecting'
    };

    ws.onopen = function () {
        console.log(`WebSocket connected to ${url}`);
        wsConnections[url].status = 'connected';
        wsStatus[url] = 'connected';
        renderGuildSidebar();

        if (reconnectAttempts[url]) {
            reconnectAttempts[url] = 0;
        }
    };

    ws.onmessage = function (event) {
        const msg = JSON.parse(event.data);
        handleMessage(msg, url);
    };

    ws.onerror = function (error) {
        console.error(`WebSocket error for ${url}:`, error);
        wsConnections[url].status = 'error';
        wsStatus[url] = 'error';
        delete state.authenticatingByServer[url];
        authRetries[url] = 0;
        if (authRetryTimeouts[url]) {
            clearTimeout(authRetryTimeouts[url]);
            authRetryTimeouts[url] = null;
        }
        Object.keys(state.pendingReplyFetches).forEach(key => {
            if (key.startsWith(`${url}:`)) {
                delete state.pendingReplyFetches[key];
            }
        });
        Object.keys(pendingReplyTimeouts).forEach(key => {
            if (key.startsWith(`${url}:`)) {
                clearTimeout(pendingReplyTimeouts[key]);
                delete pendingReplyTimeouts[key];
            }
        });
        renderGuildSidebar();
        if (state.serverUrl === url) {
            showError('Connection error');
        }
    };

    ws.onclose = function () {
        console.log(`WebSocket closed for ${url}`);
        wsConnections[url].status = 'error';
        wsStatus[url] = 'error';
        delete state.authenticatingByServer[url];
        authRetries[url] = 0;
        if (authRetryTimeouts[url]) {
            clearTimeout(authRetryTimeouts[url]);
            authRetryTimeouts[url] = null;
        }
        Object.keys(state.pendingMessageFetchesByChannel).forEach(key => {
            if (key.startsWith(`${url}:`)) {
                delete state.pendingMessageFetchesByChannel[key];
            }
        });
        Object.keys(state.pendingReplyFetches).forEach(key => {
            if (key.startsWith(`${url}:`)) {
                delete state.pendingReplyFetches[key];
            }
        });
        Object.keys(pendingReplyTimeouts).forEach(key => {
            if (key.startsWith(`${url}:`)) {
                clearTimeout(pendingReplyTimeouts[key]);
                delete pendingReplyTimeouts[key];
            }
        });
        delete state.loadingChannelsByServer[url];
        renderGuildSidebar();

        if (url === state.serverUrl) {
            console.log(`Auto-reconnecting to ${url}...`);
            scheduleReconnect(url);
        }
    };
}

function connectToAllServers() {
    let firstConnection = !state.serverUrl || Object.keys(wsConnections).length === 0;


    state.servers.forEach(server => {
        connectToServer(server.url);
    });


    if (!wsConnections['dms.mistium.com']) {
        connectToServer('dms.mistium.com');
    }


    if (state.serverUrl && !wsConnections[state.serverUrl]) {
        connectToServer(state.serverUrl);
    }
}

const reconnectAttempts = {};
const reconnectTimeouts = {};
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

function scheduleReconnect(serverUrl) {
    if (reconnectTimeouts[serverUrl]) {
        clearTimeout(reconnectTimeouts[serverUrl]);
    }

    if (!reconnectAttempts[serverUrl]) {
        reconnectAttempts[serverUrl] = 0;
    }

    reconnectAttempts[serverUrl]++;

    if (reconnectAttempts[serverUrl] > MAX_RECONNECT_ATTEMPTS) {
        console.error(`Max reconnection attempts reached for ${serverUrl}`);
        showError(`Failed to reconnect to ${serverUrl}. Click the server to retry.`);
        reconnectAttempts[serverUrl] = 0;
        return;
    }

    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts[serverUrl] - 1), 30000);

    console.log(`Scheduling reconnect to ${serverUrl} in ${delay}ms (attempt ${reconnectAttempts[serverUrl]}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeouts[serverUrl] = setTimeout(() => {
        reconnectTimeouts[serverUrl] = null;

        if (serverUrl === state.serverUrl &&
            (!wsConnections[serverUrl] || wsConnections[serverUrl].status !== 'connected')) {
            connectToServer(serverUrl);
        } else {
            reconnectAttempts[serverUrl] = 0;
        }
    }, delay);
}

async function generateValidator(validatorKey) {
    try {
        const validatorUrl = `https://social.rotur.dev/generate_validator?key=${validatorKey}&auth=${state.token}`;
        const response = await fetch(validatorUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.validator) {
            throw new Error('No validator returned from API');
        }

        return data.validator;
    } catch (error) {
        console.error(`Failed to generate validator:`, error);
        throw error;
    }
}

async function authenticateServer(serverUrl) {
    if (state.authenticatingByServer[serverUrl]) {
        return;
    }
    state.authenticatingByServer[serverUrl] = true;

    const conn = wsConnections[serverUrl];
    if (!conn || conn.status !== 'connected') {
        console.warn(`Cannot authenticate ${serverUrl}: connection not ready`);
        delete state.authenticatingByServer[serverUrl];
        return;
    }

    const validatorKey = serverValidatorKeys[serverUrl];
    if (!validatorKey) {
        console.error(`No validator key for ${serverUrl}`);
        delete state.authenticatingByServer[serverUrl];
        return;
    }

    try {
        const validator = await generateValidator(validatorKey);
        state.validatorsByServer[serverUrl] = validator;

        if (conn.socket.readyState === WebSocket.OPEN) {
            wsSend({ cmd: 'auth', validator: validator }, serverUrl);
        } else {
            console.warn(`WebSocket not ready, retrying auth for ${serverUrl}...`);
            setTimeout(() => {
                const retry = wsConnections[serverUrl];
                if (retry && retry.status === 'connected') {
                    wsSend({ cmd: 'auth', validator: state.validatorsByServer[serverUrl] }, serverUrl);
                }
            }, 500);
        }
    } catch (error) {
        console.error(`Authentication failed for ${serverUrl}:`, error);
        delete state.authenticatingByServer[serverUrl];
    }
}

async function retryAuthentication(serverUrl) {
    const maxRetries = 3;

    if (authRetryTimeouts[serverUrl]) {
        clearTimeout(authRetryTimeouts[serverUrl]);
        authRetryTimeouts[serverUrl] = null;
    }

    if (!authRetries[serverUrl]) {
        authRetries[serverUrl] = 0;
    }

    authRetries[serverUrl]++;

    if (authRetries[serverUrl] >= maxRetries) {
        console.error(`Max authentication retries reached for ${serverUrl}`);
        delete state.authenticatingByServer[serverUrl];
        delete authRetryTimeouts[serverUrl];

        if (wsConnections[serverUrl]) {
            wsConnections[serverUrl].status = 'error';
            wsStatus[serverUrl] = 'error';
        }
        renderGuildSidebar();

        if (state.serverUrl === serverUrl) {
            showError('Authentication failed. Reconnecting...');
            if (wsConnections[serverUrl]) {
                const socket = wsConnections[serverUrl].socket;
                if (socket.readyState !== WebSocket.CLOSED) {
                    socket.close();
                }
            }
            scheduleReconnect(serverUrl);
        }
        return;
    }

    console.log(`Retrying authentication for ${serverUrl} (attempt ${authRetries[serverUrl]}/${maxRetries})`);


    await new Promise(resolve => {
        authRetryTimeouts[serverUrl] = setTimeout(resolve, 1000 * authRetries[serverUrl]);
    });

    delete authRetryTimeouts[serverUrl];
    delete state.authenticatingByServer[serverUrl];
    await authenticateServer(serverUrl);
}

const pingRegex = /@[^ ,.\W]+([ \n]|$)/g

async function handleMessage(msg, serverUrl) {
    switch (msg.cmd || msg.type) {
        case 'handshake':
            if (!state.channelsByServer[serverUrl]) {
                state.channelsByServer[serverUrl] = [];
            }
            if (!state.messagesByServer[serverUrl]) {
                state.messagesByServer[serverUrl] = {};
            }
            if (!state.pingsByServer[serverUrl]) {
                state.pingsByServer[serverUrl] = {};
            }
            if (!state.usersByServer[serverUrl]) {
                state.usersByServer[serverUrl] = {};
            }

            state.server = msg.val.server;
            state.server.url = serverUrl;


            const isDM = serverUrl === 'dms.mistium.com';
            if (isDM) {
                state.server.name = 'Direct Messages';
            }


            authRetries[serverUrl] = 0;
            if (authRetryTimeouts[serverUrl]) {
                clearTimeout(authRetryTimeouts[serverUrl]);
                authRetryTimeouts[serverUrl] = null;
            }


            serverValidatorKeys[serverUrl] = msg.val.validator_key;

            saveServer(state.server);

            const serverChannelHeader = document.getElementById('server-channel-header');
            let channelHeaderName = document.getElementById('channel-header-name');

            if (serverUrl === 'dms.mistium.com') {
                if (serverChannelHeader) serverChannelHeader.style.display = 'none';
                fetchMyAccountData();
            } else {
                const dmFriendsContainer = document.getElementById('dm-friends-container');
                const messagesEl = document.getElementById('messages');
                if (dmFriendsContainer) dmFriendsContainer.style.display = 'none';
                if (messagesEl) messagesEl.style.display = 'flex';
            }


            renderGuildSidebar();

            updateGuildActiveState();


            authenticateServer(serverUrl);
            break;
        case 'ready':
            if (!state.usersByServer[serverUrl]) {
                state.usersByServer[serverUrl] = {};
            }
            state.currentUserByServer[serverUrl] = msg.user;
            const existingUser = getUserByUsernameCaseInsensitive(msg.user.username, serverUrl);
            if (existingUser) {
                Object.assign(existingUser, msg.user);
            } else {
                state.usersByServer[serverUrl][msg.user.username] = msg.user;
            }
            updateUserSection();

            if (serverUrl === 'dms.mistium.com' && state.currentChannel?.name === 'relationships') {
                fetchMyAccountData().then(() => {
                    renderDMTabContent(currentDMTab);
                });
            }

            authRetries[serverUrl] = 0;
            if (authRetryTimeouts[serverUrl]) {
                clearTimeout(authRetryTimeouts[serverUrl]);
                authRetryTimeouts[serverUrl] = null;
            }
            break

        case 'auth_success':
            delete state.authenticatingByServer[serverUrl];
            authRetries[serverUrl] = 0;
            if (authRetryTimeouts[serverUrl]) {
                clearTimeout(authRetryTimeouts[serverUrl]);
                authRetryTimeouts[serverUrl] = null;
            }
            state.loadingChannelsByServer[serverUrl] = true;
            wsSend({ cmd: 'channels_get' }, serverUrl);
            wsSend({ cmd: 'users_list' }, serverUrl);
            wsSend({ cmd: 'users_online' }, serverUrl);
            break;

        case 'channels_get':
            state.channelsByServer[serverUrl] = msg.val;
            state.loadingChannelsByServer[serverUrl] = false;
            if (state.serverUrl === serverUrl) {
                renderChannels();
                if (!state.currentChannel && state.channels.length > 0 && serverUrl !== 'dms.mistium.com') {
                    const lastChannelName = state.lastChannelByServer[serverUrl];
                    const lastChannel = lastChannelName ? state.channels.find(c => c.name === lastChannelName) : null;
                    selectChannel(lastChannel || state.channels[0]);
                }
                if (serverUrl === 'dms.mistium.com' && !state.currentChannel) {
                    if (isMobile()) {
                        selectHomeChannel();
                    }
                }
                if (state.pendingChannelSelectsByServer[serverUrl] && serverUrl !== 'dms.mistium.com') {
                    const pendingChannel = state.pendingChannelSelectsByServer[serverUrl];
                    delete state.pendingChannelSelectsByServer[serverUrl];
                    const actualChannel = state.channels.find(c => c.name === pendingChannel.name);
                    if (actualChannel) {
                        selectChannel(actualChannel);
                    }
                }
            }
            break;

        case 'users_list':
            if (!state.usersByServer[serverUrl]) {
                state.usersByServer[serverUrl] = {};
            }
            for (let i = 0; i < msg.users.length; i++) {
                const user = msg.users[i];
                const existingUser = getUserByUsernameCaseInsensitive(user.username, serverUrl);
                if (existingUser) {
                    Object.assign(existingUser, user);
                } else {
                    state.usersByServer[serverUrl][user.username] = user;
                }
            }
            renderMembers(state.currentChannel);
            break;

        case 'users_online':
            if (!state.usersByServer[serverUrl]) {
                state.usersByServer[serverUrl] = {};
            }
            const onlineUsernames = new Set();
            for (let i = 0; i < msg.users.length; i++) {
                const user = msg.users[i];
                onlineUsernames.add(user.username.toLowerCase());
                const existingUser = getUserByUsernameCaseInsensitive(user.username, serverUrl);
                if (existingUser) {
                    existingUser.status = 'online';
                }
            }
            for (const username in state.usersByServer[serverUrl]) {
                if (!onlineUsernames.has(username.toLowerCase())) {
                    state.usersByServer[serverUrl][username].status = 'offline';
                }
            }
            renderMembers(state.currentChannel);
            updateAccountProfileStatusIndicator();
            break;

        case "user_connect": {
            wsSend({ cmd: 'users_online' }, serverUrl);
            break;
        }
        case "user_disconnect": {
            wsSend({ cmd: 'users_online' }, serverUrl);
            break;
        }
        case 'messages_get':
            {
                const ch = msg.channel;
                const channelKey = `${serverUrl}:${ch}`;
                if (!state.messagesByServer[serverUrl]) {
                    state.messagesByServer[serverUrl] = {};
                }
                const existing = state.messagesByServer[serverUrl][ch];
                const req = state._loadingOlder?.[ch];
                const isOlder = !!req && req.start > 0;
                if (isOlder && existing) {
                    const container = document.getElementById('messages');
                    if (container && state.serverUrl === serverUrl && ch === state.currentChannel?.name) {
                        const oldScrollHeight = container.scrollHeight;
                        const oldScrollTop = container.scrollTop;

                        let prevUser = null;
                        let prevTime = 0;
                        const firstNew = msg.messages[msg.messages.length - 1];
                        const lastNewDate = firstNew ? new Date(firstNew.timestamp * 1000).toDateString() : null;
                        const frag = document.createDocumentFragment();

                        for (const m of msg.messages) {
                            const sameUserRecent = prevUser === m.user && (m.timestamp - prevTime) < 300;
                            const el = makeMessageElement(m, sameUserRecent);
                            frag.appendChild(el);
                            prevUser = m.user;
                            prevTime = m.timestamp;
                        }

                        if (container.firstChild) {
                            const oldestExisting = existing[0];
                            const existingDate = new Date(oldestExisting.timestamp * 1000).toDateString();
                            if (lastNewDate && existingDate !== lastNewDate) {
                                const separator = getDaySeparator(existing[0].timestamp);
                                frag.appendChild(separator);
                            }
                        }

                        container.insertBefore(frag, container.firstChild);


                        const merged = [...msg.messages, ...existing];
                        const seen = new Set();
                        state.messagesByServer[serverUrl][ch] = merged.filter(m => {
                            if (seen.has(m.id)) return false;
                            seen.add(m.id);
                            return true;
                        });


                        const newScrollHeight = container.scrollHeight;
                        const delta = newScrollHeight - oldScrollHeight;
                        const prevBehavior = container.style.scrollBehavior;
                        container.style.scrollBehavior = 'auto';
                        container.scrollTop = oldScrollTop + delta;
                        container.style.scrollBehavior = prevBehavior || '';
                    } else {

                        const merged = [...msg.messages, ...existing];
                        const seen = new Set();
                        state.messagesByServer[serverUrl][ch] = merged.filter(m => {
                            if (seen.has(m.id)) return false;
                            seen.add(m.id);
                            return true;
                        });
                    }
                    state._olderStart[ch] = req.start;
                    state._loadingOlder[ch] = null;
                    state._olderLoading = false;
                } else {
                    state.messagesByServer[serverUrl][ch] = msg.messages;
                    if (state.pendingMessageFetchesByChannel[channelKey]) {
                        delete state.pendingMessageFetchesByChannel[channelKey];
                    }
                    if (state.serverUrl === serverUrl && state.currentChannel && ch === state.currentChannel?.name) {
                        renderMessages();
                    }
                }
            }
            break;

        case 'message_new':
            if (!state.messagesByServer[serverUrl] || !state.messagesByServer[serverUrl][msg.channel]) {
                return;
            }
            state.messagesByServer[serverUrl][msg.channel].push(msg.message);


            if (state.serverUrl !== serverUrl || msg.channel !== state.currentChannel?.name) {
                if (!state.unreadCountsByServer[serverUrl]) {
                    state.unreadCountsByServer[serverUrl] = 0;
                }
                state.unreadCountsByServer[serverUrl]++;

                const channelKey = `${serverUrl}:${msg.channel}`;
                if (!state.unreadByChannel[channelKey]) {
                    state.unreadByChannel[channelKey] = 0;
                }
                state.unreadByChannel[channelKey]++;

                console.log(`New unread message: ${channelKey}, count: ${state.unreadByChannel[channelKey]}`);

                if (serverUrl === 'dms.mistium.com' && msg.message.user !== state.currentUser?.username) {
                    addDMServer(msg.message.user, msg.channel);
                }

                // Always re-render channels if it's the current server
                if (state.serverUrl === serverUrl) {
                    requestAnimationFrame(() => renderChannels());
                }
                renderGuildSidebar();
            }

            const typingServer = state.typingUsersByServer[serverUrl];
            if (typingServer && typingServer[msg.channel]) {
                const typing = typingServer[msg.channel];
                if (typing.has(msg.message.user)) {
                    typing.delete(msg.message.user);
                    const timeoutsServer = state.typingTimeoutsByServer[serverUrl];
                    if (timeoutsServer && timeoutsServer[msg.channel]) {
                        const timeouts = timeoutsServer[msg.channel];
                        if (timeouts.has(msg.message.user)) {
                            clearTimeout(timeouts.get(msg.message.user));
                            timeouts.delete(msg.message.user);
                        }
                    }
                    updateChannelListTyping(msg.channel);
                    if (serverUrl === state.serverUrl && msg.channel === state.currentChannel?.name) {
                        updateTypingIndicator();
                    }
                }
            }

            if (state.currentUser && msg.message.user !== state.currentUser.username) {
                const content = msg.message.content.toLowerCase();
                const username = state.currentUser.username.toLowerCase();

                const matches = content.match(pingRegex);

                if (matches) {
                    const pings = matches.filter(m => m.trim().toLowerCase() === '@' + username)

                    if (pings.length > 0) {
                        if (state.serverUrl !== serverUrl || msg.channel !== state.currentChannel?.name) {
                            if (!state.unreadPings[msg.channel]) {
                                state.unreadPings[msg.channel] = 0;
                            }
                            state.unreadPings[msg.channel]++;
                            if (state.serverUrl === serverUrl) {
                                renderChannels();
                            }
                        }

                        playPingSound();

                        const notifTitle = `${msg.message.user} mentioned you in #${msg.channel}`;
                        const notifBody = msg.message.content.length > 100
                            ? msg.message.content.substring(0, 100) + '...'
                            : msg.message.content;
                        showNotification(notifTitle, notifBody, msg.channel);

                        if (!state.serverPingsByServer[serverUrl]) {
                            state.serverPingsByServer[serverUrl] = 0;
                        }
                        state.serverPingsByServer[serverUrl]++;
                        renderGuildSidebar();
                    }
                }
            }

            if (state.serverUrl === serverUrl && msg.channel === state.currentChannel?.name) {
                appendMessage(msg.message);
            }
            break;

        case 'message_get': {
            const replyKey = `${serverUrl}:${msg.message.id}`;

            if (pendingReplyTimeouts[replyKey]) {
                clearTimeout(pendingReplyTimeouts[replyKey]);
                delete pendingReplyTimeouts[replyKey];
            }

            if (state.pendingReplyFetches[replyKey]) {
                state.pendingReplyFetches[replyKey].forEach((pending) => {
                    const replyUser = getUserByUsernameCaseInsensitive(msg.message.user) || { username: msg.message.user };
                    const existingEl = document.querySelector(`[data-reply-to-id="${msg.message.id}"][data-msg-id="${pending.element.dataset.msgId}"]`);

                    if (existingEl) {
                        existingEl.className = 'message-reply';
                        existingEl.style.cursor = 'pointer';
                        existingEl.innerHTML = '';

                        const avatar = getAvatar(replyUser.username, 'small');
                        existingEl.appendChild(avatar);

                        const replyText = document.createElement('div');

                        const usernameSpan = document.createElement('span');
                        usernameSpan.className = 'reply-username';
                        usernameSpan.textContent = replyUser.username;
                        usernameSpan.style.cursor = 'pointer';
                        replyText.appendChild(usernameSpan);

                        const contentSpan = document.createElement('span');
                        contentSpan.className = 'reply-content';
                        contentSpan.textContent = msg.message.content.length > 50 ? msg.message.content.substring(0, 50) + '...' : msg.message.content;
                        replyText.appendChild(contentSpan);

                        existingEl.appendChild(replyText);

                        usernameSpan.addEventListener('click', (e) => {
                            e.stopPropagation();
                            openAccountModal(replyUser.username);
                        });

                        existingEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const originalMessageEl = document.querySelector(`[data-msg-id="${msg.message.id}"]`);
                            if (originalMessageEl) {
                                originalMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                originalMessageEl.classList.add('highlight-message');
                                setTimeout(() => {
                                    originalMessageEl.classList.remove('highlight-message');
                                }, 2000);
                            }
                        });
                    }
                });
                delete state.pendingReplyFetches[replyKey];
            }
            break;
        }

        case 'message_edit': {
            if (!state.messagesByServer[serverUrl] || !state.messagesByServer[serverUrl][msg.channel]) {
                break;
            }
            const id = msg.id;
            const message = state.messagesByServer[serverUrl][msg.channel].find(m => m.id === id);
            message.content = msg.content;
            message.edited = true;
            message.editedAt = Date.now();
            if (state.serverUrl === serverUrl && msg.channel === state.currentChannel?.name) {
                updateMessageContent(msg.id, msg.content);
            }
            break;
        }
        case 'message_delete': {
            if (!state.messagesByServer[serverUrl] || !state.messagesByServer[serverUrl][msg.channel]) {
                break;
            }
            const id = msg.id;
            state.messagesByServer[serverUrl][msg.channel] = state.messagesByServer[serverUrl][msg.channel].filter(m => m.id !== id);
            if (state.serverUrl === serverUrl && msg.channel === state.currentChannel?.name) {
                removeMessage(id);
            }
            break;
        }
        case 'typing':
            const channel = msg.channel;
            const user = msg.user;
            if (user === state.currentUser?.username) break;

            if (!state.typingUsersByServer[serverUrl]) {
                state.typingUsersByServer[serverUrl] = {};
            }
            if (!state.typingTimeoutsByServer[serverUrl]) {
                state.typingTimeoutsByServer[serverUrl] = {};
            }

            if (!state.typingUsersByServer[serverUrl][channel]) {
                state.typingUsersByServer[serverUrl][channel] = new Map();
            }

            if (!state.typingTimeoutsByServer[serverUrl][channel]) {
                state.typingTimeoutsByServer[serverUrl][channel] = new Map();
            }

            const typingMap = state.typingUsersByServer[serverUrl][channel];
            const timeoutMap = state.typingTimeoutsByServer[serverUrl][channel];
            const expireAt = Date.now() + 10000;
            typingMap.set(user, expireAt);

            updateChannelListTyping(channel);
            if (channel === state.currentChannel?.name) {
                updateTypingIndicator();
            }

            const timeoutKey = `${channel}:${user}`;
            if (timeoutMap.has(user)) {
                clearTimeout(timeoutMap.get(user));
            }

            const timeoutId = setTimeout(() => {
                const currentExpiry = typingMap.get(user);
                if (currentExpiry && currentExpiry <= Date.now()) {
                    typingMap.delete(user);
                    timeoutMap.delete(user);
                    updateChannelListTyping(channel);
                    if (channel === state.currentChannel?.name) {
                        updateTypingIndicator();
                    }
                }
            }, 10000);
            timeoutMap.set(user, timeoutId);

            break;

        case 'rate_limit':
            if (serverUrl === state.serverUrl) {
                showRateLimit(msg.length);
            }
            break;

        case 'error':
            if (msg.src === 'message_get') break; o
            showError(msg.val);
            break;
        case 'auth_error':
            console.error(`Authentication error for ${serverUrl}:`, msg.val);

            retryAuthentication(serverUrl);
            break;
        case 'message_react_add': {
            if (!state.messagesByServer[serverUrl] || !state.messagesByServer[serverUrl][msg.channel]) break;
            const message = state.messagesByServer[serverUrl][msg.channel].find(m => m.id === msg.id);
            if (!message) break;

            if (!message.reactions) message.reactions = {};
            if (!message.reactions[msg.emoji]) {
                message.reactions[msg.emoji] = [];
            }
            const user = msg.from || msg.user || 'unknown';
            if (!message.reactions[msg.emoji].includes(user)) {
                message.reactions[msg.emoji].push(user);
            }

            if (state.serverUrl === serverUrl && msg.channel === state.currentChannel?.name) {
                updateMessageReactions(msg.id);
            }
            break;
        }
        case 'message_react_remove': {
            if (!state.messagesByServer[serverUrl] || !state.messagesByServer[serverUrl][msg.channel]) break;
            const message = state.messagesByServer[serverUrl][msg.channel].find(m => m.id === msg.id);
            if (!message || !message.reactions || !message.reactions[msg.emoji]) break;

            const users = message.reactions[msg.emoji];
            const idx = users.indexOf(msg.from);
            if (idx > -1) users.splice(idx, 1);

            if (users.length === 0) {
                delete message.reactions[msg.emoji];
            }

            if (state.serverUrl === serverUrl && msg.channel === state.currentChannel?.name) {
                updateMessageReactions(msg.id);
            }
            break;
        }
        case 'voice_user_joined':
            if (voiceManager) {
                voiceManager.handleUserJoined(msg);
            }
            break;
        case 'voice_user_left':
            if (voiceManager) {
                voiceManager.handleUserLeft(msg);
            }
            break;
        case 'voice_user_updated':
            if (voiceManager) {
                voiceManager.handleUserUpdated(msg);
            }
            break;
    }
}

function updateTypingIndicator() {
    const typingEl = document.getElementById("typing");
    if (!typingEl) return;

    const channel = state.currentChannel?.name;
    if (!channel) return;

    const typingMap = state.typingUsers[channel];
    if (!typingMap) return;

    const now = Date.now();
    for (const [user, expiry] of typingMap) {
        if (expiry < now) typingMap.delete(user);
    }

    const users = [...typingMap.keys()];

    if (users.length === 0) {
        typingEl.textContent = "";
        typingEl.style.visibility = 'hidden';
        return;
    }

    let text = "";
    if (users.length === 1) {
        text = `${users[0]} is typing...`;
    } else if (users.length === 2) {
        text = `${users[0]} and ${users[1]} are typing...`;
    } else {
        text = `${users.length} people are typing...`;
    }

    typingEl.textContent = text;
    typingEl.style.visibility = 'visible';
}


function wsSend(data, serverUrl) {
    const url = serverUrl || state.serverUrl;
    const connection = wsConnections[url];
    if (connection && connection.socket && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(data));
    } else {
        console.warn(`WebSocket not open for ${url}, message not sent:`, data);
        return false;
    }
    return true;
}

function updateChannelListTyping(channelName) {
    const channelItems = document.querySelectorAll('.channel-item');
    for (const item of channelItems) {
        const nameEl = item.querySelector('span:nth-child(2)');
        if (nameEl && nameEl.textContent === channelName) {
            let indicator = item.querySelector('.channel-typing-indicator');
            const typingMap = state.typingUsers[channelName];

            if (typingMap && typingMap.size > 0) {
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'channel-typing-indicator';
                    indicator.innerHTML = `
                        <div class="channel-typing-dot"></div>
                        <div class="channel-typing-dot"></div>
                        <div class="channel-typing-dot"></div>
                    `;
                    item.appendChild(indicator);
                }
            } else {
                if (indicator) {
                    indicator.remove();
                }
            }
            break;
        }
    }
}


function selectChannel(channel) {
    if (!channel) return;

    const channelKey = `${state.serverUrl}:${channel.name}`;
    if (state.pendingMessageFetchesByChannel[channelKey]) {
        return;
    }

    console.log(`selectChannel: server=${state.serverUrl}, channel=${channel.name}`);

    if (!state.channelsByServer[state.serverUrl] || !state.channelsByServer[state.serverUrl].find(c => c.name === channel.name)) {
        console.warn(`Channel ${channel.name} not found in current server ${state.serverUrl}`);
        return;
    }

    if (state.serverUrl === 'dms.mistium.com' && channel.name === 'cmds') {
        console.log('Redirecting from cmds to Home channel');
        selectHomeChannel();
        return;
    }

    state.currentChannel = channel;
    state._olderStart[channel.name] = 0;
    state._olderCooldown[channel.name] = 0;
    state._olderStart[channel.name] = 0;
    state._olderCooldown[channel.name] = 0;

    clearRateLimit();

    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '<div class="loading-throbber"></div>';
    messagesContainer.style.display = 'flex';

    const dmFriendsContainer = document.getElementById('dm-friends-container');
    if (dmFriendsContainer) dmFriendsContainer.style.display = 'none';

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'flex';

    const serverChannelHeader = document.getElementById('server-channel-header');
    const membersList = document.getElementById('members-list');

    const isExcludedChannel = channel.name === 'home' || channel.name === 'relationships';

    // Hide server channel header on DMs server
    if (state.serverUrl === 'dms.mistium.com') {
        if (serverChannelHeader) serverChannelHeader.style.display = 'none';
    }

    // Only hide members list for home/relationships, show for regular DM channels
    if (membersList) {
        membersList.style.display = isExcludedChannel ? 'none' : '';
    }

    const channelNameEl = document.getElementById('channel-name');
    channelNameEl.innerHTML = '';
    const hash = document.createTextNode('#');
    channelNameEl.appendChild(hash);
    if (channel.icon) {
        const icon = document.createElement('img');
        icon.src = channel.icon;
        icon.style.width = '16px';
        icon.style.height = '16px';
        icon.style.margin = '0 4px';
        icon.style.objectFit = 'contain';
        icon.style.verticalAlign = 'middle';
        channelNameEl.appendChild(icon);
    }
    const name = document.createTextNode(getChannelDisplayName(channel));
    channelNameEl.appendChild(name);
    if (state.unreadPings[channel.name]) {
        delete state.unreadPings[channel.name];
    }

    Object.keys(state.pendingMessageFetchesByChannel).forEach(key => {
        if (key !== channelKey && key.startsWith(`${state.serverUrl}:`)) {
            delete state.pendingMessageFetchesByChannel[key];
        }
    });

    // Clear unread count for this channel
    if (state.unreadByChannel[channelKey]) {
        state.unreadCountsByServer[state.serverUrl] = Math.max(0,
            (state.unreadCountsByServer[state.serverUrl] || 0) - state.unreadByChannel[channelKey]
        );
        delete state.unreadByChannel[channelKey];
        renderGuildSidebar();
    }

    renderChannels();

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const channelItems = Array.from(document.querySelectorAll('.channel-item'));
    const targetItem = channelItems.find(el => el.querySelector('[data-channel-name]')?.textContent === channel.name);
    if (targetItem) {
        targetItem.classList.add('active');
    }

    if (!state.messagesByServer[state.serverUrl] || !state.messagesByServer[state.serverUrl][channel.name]) {
        state.pendingMessageFetchesByChannel[channelKey] = true;
        wsSend({ cmd: 'messages_get', channel: channel.name }, state.serverUrl);
    } else {
        renderMessages();
    }
    renderMembers(channel);
    updateTypingIndicator();

    window.canSendMessages = checkPermission(channel.permissions?.send || [], state.currentUser.roles);
    const textboxFlavor = window.canSendMessages
        ? `Type a message...`
        : `Cannot send messages here.`
    const textbox = document.getElementById("message-input");
    textbox.value = "";
    textbox.placeholder = textboxFlavor;
    textbox.disabled = !window.canSendMessages;
}

function selectHomeChannel() {
    state.currentChannel = { name: 'home', display_name: 'Home' };

    const channelNameEl = document.getElementById('channel-name');
    channelNameEl.innerHTML = '';
    const hash = document.createTextNode('#');
    channelNameEl.appendChild(hash);
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'home');
    icon.style.width = '16px';
    icon.style.height = '16px';
    icon.style.margin = '0 4px';
    icon.style.color = 'var(--text-dim)';
    channelNameEl.appendChild(icon);
    const name = document.createTextNode('Home');
    channelNameEl.appendChild(name);

    if (window.lucide) window.lucide.createIcons({ root: channelNameEl });

    const serverChannelHeader = document.getElementById('server-channel-header');

    // Hide entire header on DMs server
    if (serverChannelHeader) serverChannelHeader.style.display = 'none';

    const messagesEl = document.getElementById('messages');
    messagesEl.style.display = 'none';

    const typingEl = document.getElementById('typing');
    if (typingEl) typingEl.style.display = 'none';

    const membersList = document.getElementById('members-list');
    if (membersList) {
        membersList.innerHTML = '';
        membersList.classList.remove('open');
        membersList.style.display = 'none';
    }

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'none';

    const dmFriendsContainer = document.getElementById('dm-friends-container');
    if (dmFriendsContainer) dmFriendsContainer.style.display = 'none';

    renderHomeContent();

    renderChannels();

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const homeItem = Array.from(document.querySelectorAll('.channel-item')).find(el => {
        const nameEl = el.querySelector('[data-channel-name]');
        return nameEl && nameEl.dataset.channelName === 'home';
    });
    if (homeItem) homeItem.classList.add('active');
}

function renderHomeContent() {
    const messagesEl = document.getElementById('messages');
    messagesEl.style.display = 'block';
    messagesEl.innerHTML = '';

    const content = document.createElement('div');
    content.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 40px 20px;';

    const welcomeIcon = document.createElement('i');
    welcomeIcon.setAttribute('data-lucide', 'home');
    welcomeIcon.style.cssText = 'width: 64px; height: 64px; margin-bottom: 20px; opacity: 0.5;';
    content.appendChild(welcomeIcon);

    const welcomeText = document.createElement('h2');
    welcomeText.textContent = 'Welcome Home';
    welcomeText.style.cssText = 'font-size: 28px; font-weight: 600; margin-bottom: 8px; color: var(--text);';
    content.appendChild(welcomeText);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'What would you like to do?';
    subtitle.style.cssText = 'font-size: 14px; color: var(--text-dim); margin-bottom: 40px;';
    content.appendChild(subtitle);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; width: 100%; max-width: 600px;';

    const options = [
        {
            icon: 'users',
            title: 'Manage Relationships',
            description: 'View and manage your friends',
            action: () => selectRelationshipsChannel()
        },
        {
            icon: 'user-plus',
            title: 'Create DM',
            description: 'Start a new conversation',
            action: () => {
                openDMCreateModal();
                switchDMCreateTab('dm');
            }
        },
        {
            icon: 'users',
            title: 'Create Group',
            description: 'Start a group conversation',
            action: () => {
                openDMCreateModal();
                switchDMCreateTab('group');
            }
        },
        {
            icon: 'plus-circle',
            title: 'Join Server',
            description: 'Connect to a new server',
            action: () => {
                const serverUrl = prompt('Enter server URL to join:');
                if (serverUrl && serverUrl.trim()) {
                    addServer(serverUrl.trim());
                }
            }
        }
    ];

    options.forEach(option => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #2f3136; border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.2s; border: 1px solid #40444b; display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-height: 120px;';

        card.onmouseenter = () => {
            card.style.borderColor = 'var(--primary)';
            card.style.transform = 'translateY(-2px)';
        };
        card.onmouseleave = () => {
            card.style.borderColor = '#40444b';
            card.style.transform = 'translateY(0)';
        };
        card.onclick = option.action;

        const iconWrapper = document.createElement('div');
        iconWrapper.style.cssText = 'width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;';

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', option.icon);
        icon.style.cssText = 'width: 20px; height: 20px; color: var(--text);';
        iconWrapper.appendChild(icon);

        const title = document.createElement('h3');
        title.textContent = option.title;
        title.style.cssText = 'font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 4px;';

        const description = document.createElement('p');
        description.textContent = option.description;
        description.style.cssText = 'font-size: 13px; color: var(--text-dim); margin: 0;';

        card.appendChild(iconWrapper);
        card.appendChild(title);
        card.appendChild(description);
        grid.appendChild(card);
    });

    content.appendChild(grid);
    messagesEl.appendChild(content);

    if (window.lucide) window.lucide.createIcons({ root: content });
}

function selectRelationshipsChannel() {
    state.currentChannel = { name: 'relationships', display_name: 'Relationships' };

    const channelNameEl = document.getElementById('channel-name');
    channelNameEl.innerHTML = '';
    const hash = document.createTextNode('#');
    channelNameEl.appendChild(hash);
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'users');
    icon.style.width = '16px';
    icon.style.height = '16px';
    icon.style.margin = '0 4px';
    icon.style.color = 'var(--text-dim)';
    channelNameEl.appendChild(icon);
    const name = document.createTextNode('Relationships');
    channelNameEl.appendChild(name);

    if (window.lucide) window.lucide.createIcons({ root: channelNameEl });

    const serverChannelHeader = document.getElementById('server-channel-header');

    // Hide entire header on DMs server
    if (serverChannelHeader) serverChannelHeader.style.display = 'none';

    const messagesEl = document.getElementById('messages');
    messagesEl.style.display = 'none';

    const typingEl = document.getElementById('typing');
    if (typingEl) typingEl.style.display = 'none';

    const membersList = document.getElementById('members-list');
    if (membersList) {
        membersList.innerHTML = '';
        membersList.classList.remove('open');
        membersList.style.display = 'none';
    }

    const inputArea = document.querySelector('.input-area');
    if (inputArea) inputArea.style.display = 'none';

    renderDMRelationshipsContent();

    renderChannels();

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const relItem = Array.from(document.querySelectorAll('.channel-item')).find(el => {
        const nameEl = el.querySelector('[data-channel-name]');
        return nameEl && nameEl.dataset.channelName === 'relationships';
    });
    if (relItem) relItem.classList.add('active');
}

function renderDMRelationshipsContent() {
    const dmFriendsContainer = document.getElementById('dm-friends-container');
    if (!dmFriendsContainer) return;

    dmFriendsContainer.innerHTML = '';
    dmFriendsContainer.style.display = 'flex';
    dmFriendsContainer.style.flexDirection = 'column';

    const tabs = document.createElement('div');
    tabs.className = 'dm-relationships-tabs';
    tabs.style.cssText = 'display: flex; gap: 8px; padding: 16px 20px 8px 20px; border-bottom: 1px solid var(--border); margin-bottom: 8px;';

    const friendsTab = document.createElement('button');
    friendsTab.className = 'dm-tab ' + (currentDMTab === 'friends' ? 'active' : '');
    friendsTab.textContent = 'Friends';
    friendsTab.onclick = () => {
        currentDMTab = 'friends';
        updateTabsActive();
        renderDMTabContent('friends');
    };

    const requestsTab = document.createElement('button');
    requestsTab.className = 'dm-tab ' + (currentDMTab === 'requests' ? 'active' : '');
    requestsTab.textContent = 'Requests';
    requestsTab.onclick = () => {
        currentDMTab = 'requests';
        updateTabsActive();
        renderDMTabContent('requests');
    };

    const blockedTab = document.createElement('button');
    blockedTab.className = 'dm-tab ' + (currentDMTab === 'blocked' ? 'active' : '');
    blockedTab.textContent = 'Blocked';
    blockedTab.onclick = () => {
        currentDMTab = 'blocked';
        updateTabsActive();
        renderDMTabContent('blocked');
    };

    tabs.appendChild(friendsTab);
    tabs.appendChild(requestsTab);
    tabs.appendChild(blockedTab);

    const content = document.createElement('div');
    content.className = 'dm-relationships-content';
    content.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 0;';

    dmFriendsContainer.appendChild(tabs);
    dmFriendsContainer.appendChild(content);

    renderDMTabContent(currentDMTab);
}

function updateTabsActive() {
    const tabs = document.querySelectorAll('.dm-relationships-tabs .dm-tab');
    tabs.forEach(tab => {
        if (tab.textContent.toLowerCase().includes(currentDMTab)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function renderDMTabContent(tab) {
    const contentDiv = document.querySelector('.dm-relationships-content');
    const oldContainer = document.getElementById('dm-friends-container');

    if (contentDiv) {
        renderNewRelationshipsContent(contentDiv, tab);
    } else if (oldContainer) {
        renderOldContainerContent(oldContainer, tab);
    }
}

function renderNewRelationshipsContent(contentDiv, tab) {
    contentDiv.innerHTML = '';

    if (tab === 'friends') {
        if (state.friends.length === 0) {
            contentDiv.innerHTML = '<div style="padding: 20px; color: var(--text-dim); text-align: center;">No friends yet</div>';
            return;
        }

        state.friends.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const dmButton = document.createElement('button');
            dmButton.className = 'dm-action-btn';
            dmButton.title = 'Open DM';
            dmButton.style.cssText = 'background: var(--surface-light); border: none; color: var(--text-dim); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            dmButton.innerHTML = '<i data-lucide="message-square" style="width: 18px; height: 18px;"></i>';
            dmButton.onclick = (e) => {
                e.stopPropagation();
                openDM(username);
            };

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(dmButton);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            contentDiv.appendChild(item);
        });
    } else if (tab === 'requests') {
        if (state.friendRequests.length === 0) {
            contentDiv.innerHTML = '<div style="padding: 20px; color: var(--text-dim); text-align: center;">No pending requests</div>';
            return;
        }

        state.friendRequests.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const actionButtons = document.createElement('div');
            actionButtons.style.cssText = 'display: flex; gap: 8px;';

            const acceptButton = document.createElement('button');
            acceptButton.className = 'dm-action-btn accept-btn';
            acceptButton.title = 'Accept';
            acceptButton.style.cssText = 'background: var(--success); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            acceptButton.innerHTML = '<i data-lucide="check" style="width: 18px; height: 18px;"></i>';
            acceptButton.onclick = (e) => {
                e.stopPropagation();
                acceptFriendRequest(username);
            };

            const rejectButton = document.createElement('button');
            rejectButton.className = 'dm-action-btn reject-btn';
            rejectButton.title = 'Reject';
            rejectButton.style.cssText = 'background: var(--danger); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            rejectButton.innerHTML = '<i data-lucide="x" style="width: 18px; height: 18px;"></i>';
            rejectButton.onclick = (e) => {
                e.stopPropagation();
                rejectFriendRequest(username);
            };

            actionButtons.appendChild(acceptButton);
            actionButtons.appendChild(rejectButton);

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(actionButtons);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            contentDiv.appendChild(item);
        });
    } else if (tab === 'blocked') {
        if (state.blockedUsers.length === 0) {
            contentDiv.innerHTML = '<div style="padding: 20px; color: var(--text-dim); text-align: center;">No blocked users</div>';
            return;
        }

        state.blockedUsers.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const unblockButton = document.createElement('button');
            unblockButton.className = 'dm-action-btn unblock-btn';
            unblockButton.title = 'Unblock';
            unblockButton.style.cssText = 'background: var(--surface-light); border: none; color: var(--text-dim); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            unblockButton.innerHTML = '<i data-lucide="unlock" style="width: 18px; height: 18px;"></i>';
            unblockButton.onclick = (e) => {
                e.stopPropagation();
                unblockUser(username);
            };

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(unblockButton);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            contentDiv.appendChild(item);
        });
    }

    if (window.lucide) window.lucide.createIcons({ root: contentDiv });
}

function renderOldContainerContent(oldContainer, tab) {
    oldContainer.innerHTML = '';

    const tabTitle = document.createElement('div');
    tabTitle.className = 'dm-section-title';
    tabTitle.style.cssText = 'font-weight: 600; color: var(--text-dim); font-size: 12px; padding: 16px 20px 8px 20px; text-transform: uppercase; letter-spacing: 0.5px;';

    if (tab === 'friends') {
        tabTitle.textContent = 'FRIENDS';
        oldContainer.appendChild(tabTitle);

        state.friends.forEach(username => {
            const item = document.createElement('div');
            item.className = 'dm-friend-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.2s ease;';

            const avatar = document.createElement('img');
            avatar.src = `https://avatars.rotur.dev/${username}`;
            avatar.alt = username;
            avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            usernameSpan.style.cssText = 'flex: 1; color: var(--text); font-size: 15px; font-weight: 500;';

            const dmButton = document.createElement('button');
            dmButton.className = 'dm-action-btn';
            dmButton.title = 'Open DM';
            dmButton.style.cssText = 'background: var(--surface-light); border: none; color: var(--text-dim); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;';
            dmButton.innerHTML = '<i data-lucide="message-square" style="width: 18px; height: 18px;"></i>';
            dmButton.onclick = (e) => {
                e.stopPropagation();
                openDM(username);
            };

            item.appendChild(avatar);
            item.appendChild(usernameSpan);
            item.appendChild(dmButton);

            item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            oldContainer.appendChild(item);
        });
    }

    if (window.lucide) window.lucide.createIcons({ root: oldContainer });
}

function formatTimestamp(unix) {
    const now = new Date();
    const messageDate = new Date(unix * 1000);
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);


    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24 && diffDays < 1) {
        return `${diffHours}h ago`;
    }


    const isToday = messageDate.toDateString() === now.toDateString();
    if (isToday) {
        const time = messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `Today at ${time}`;
    }


    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
        const time = messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `Yesterday at ${time}`;
    }


    if (diffDays < 7) {
        const dayName = messageDate.toLocaleDateString('en-US', { weekday: 'long' });
        const time = messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `${dayName} at ${time}`;
    }


    const day = messageDate.getDate();
    const suffix =
        day % 10 === 1 && day !== 11 ? 'st' :
            day % 10 === 2 && day !== 12 ? 'nd' :
                day % 10 === 3 && day !== 13 ? 'rd' : 'th';

    const month = messageDate.toLocaleString('en-US', { month: 'short' });
    const year = messageDate.getFullYear();
    const time = messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return `${month} ${day}${suffix}, ${year} ${time}`;
}

function getFullTimestamp(unix) {
    const d = new Date(unix * 1000);
    const day = d.getDate();
    const suffix =
        day % 10 === 1 && day !== 11 ? 'st' :
            day % 10 === 2 && day !== 12 ? 'nd' :
                day % 10 === 3 && day !== 13 ? 'rd' : 'th';

    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `${day}${suffix} ${month} ${year} at ${time}`;
}

function getAvatar(username, size = null) {
    const img = new Image();
    img.className = "avatar" + (size ? ` avatar-${size}` : "");
    img.draggable = false;

    const defaultAvatar = 'https://avatars.rotur.dev/originChats';

    if (state._avatarCache[username]) {
        img.src = state._avatarCache[username];
        return img;
    }

    img.src = defaultAvatar;

    if (!state._avatarLoading[username]) {
        state._avatarLoading[username] = fetchAvatarBase64(username);
    }

    state._avatarLoading[username].then(dataUri => {
        state._avatarCache[username] = dataUri;
        img.src = dataUri;
    }).catch(() => {
        img.src = defaultAvatar;
    });

    return img;
}

async function fetchAvatarBase64(username) {
    const response = await fetch(`https://avatars.rotur.dev/${username}`);
    const blob = await response.blob();
    return await blobToDataURL(blob);
}

let lastRenderedChannel = null;
let lastUser = null;
let lastTime = 0;
let lastGroup = null;
state._loadingOlder = {};
state._olderLoading = false;
state._olderStart = {};
state._olderCooldown = {};

function updateAllTimestamps() {
    document.querySelectorAll('[data-timestamp]').forEach(el => {
        const timestamp = parseInt(el.dataset.timestamp);
        if (timestamp) {
            el.textContent = formatTimestamp(timestamp);
            el.title = getFullTimestamp(timestamp);
        }
    });
}

setInterval(updateAllTimestamps, 60000);

function getDaySeparator(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    let text;
    if (isToday) {
        text = 'Today';
    } else if (isYesterday) {
        text = 'Yesterday';
    } else {
        text = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    const separator = document.createElement('div');
    separator.className = 'day-separator';
    separator.style.position = 'relative';
    separator.style.zIndex = '1';
    separator.style.margin = '8px 0';
    separator.innerHTML = `<span class="day-separator-text">${text}</span>`;
    return separator;
}

async function renderMessages(scrollToBottom = true) {
    if (state.renderInProgress) {
        return;
    }

    state.renderInProgress = true;

    const container = document.getElementById("messages");

    if (!state.currentChannel || !state.currentChannel.name) {
        container.innerHTML = '';
        state.renderInProgress = false;
        return;
    }

    const channel = state.currentChannel.name;

    if (!state.messagesByServer[state.serverUrl] || !state.messagesByServer[state.serverUrl][channel]) {
        console.log(`renderMessages: No messages for server=${state.serverUrl}, channel=${channel}`);
        container.innerHTML = "";
        state.renderInProgress = false;
        return;
    }

    console.log(`renderMessages: Rendering ${state.messagesByServer[state.serverUrl][channel].length} messages for server=${state.serverUrl}, channel=${channel}`);

    const messages = state.messagesByServer[state.serverUrl][channel].slice().sort((a, b) => a.timestamp - b.timestamp);


    if (messages.length == 0) {
        state.renderInProgress = false;
        const channelName = state.currentChannel.display_name || state.currentChannel.name;
        container.innerHTML = `
            <div class="empty-channel-message" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text-dim);">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">💬</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--text);">Welcome to #${channelName}</div>
                <div style="font-size: 14px;">This is the start of the <strong>#${channelName}</strong> channel.</div>
                <div style="font-size: 14px; margin-top: 4px;">Be the first to send a message!</div>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    lastUser = null;
    lastTime = 0;
    lastGroup = null;
    let consecutiveCount = 0;
    let lastDate = null;

    const loadPromises = [];

    for (const msg of messages) {
        const msgDate = new Date(msg.timestamp * 1000).toDateString();
        if (lastDate !== null && msgDate !== lastDate) {
            fragment.appendChild(getDaySeparator(msg.timestamp));
            consecutiveCount = 0;
        }
        lastDate = msgDate;

        const isSameUserRecent =
            msg.user === lastUser &&
            msg.timestamp - lastTime < 300 &&
            consecutiveCount < 20;

        if (msg.user === lastUser && msg.timestamp - lastTime < 300) {
            consecutiveCount++;
        } else {
            consecutiveCount = 0;
        }

        const element = makeMessageElement(msg, isSameUserRecent, loadPromises);
        fragment.appendChild(element);

        lastUser = msg.user;
        lastTime = msg.timestamp;
    }

    if (loadPromises.length > 0) {
        try {
            const timeout = new Promise(resolve => setTimeout(resolve, 3000));
            await Promise.race([Promise.all(loadPromises), timeout]);
        } catch (e) {
            console.warn("Error waiting for images", e);
        }
    }

    container.innerHTML = "";
    container.appendChild(fragment);

    const scrollBottom = () => { container.scrollTop = container.scrollHeight; };
    const nearBottom = () => (container.scrollHeight - (container.scrollTop + container.clientHeight)) < 80;
    if (scrollToBottom) scrollBottom();

    if (scrollToBottom) {
        let observer;
        try {
            observer = new MutationObserver(() => {
                if (!state._olderLoading && nearBottom()) scrollBottom();
            });
            observer.observe(container, { childList: true, subtree: true });
        } catch { }
        const imgs = container.querySelectorAll('img');
        imgs.forEach(img => {
            if (!img.complete) {
                const handler = () => { if (!state._olderLoading && nearBottom()) scrollBottom(); };
                img.addEventListener('load', handler, { once: true });
                img.addEventListener('error', handler, { once: true });
            }
        });
        setTimeout(() => { if (observer) observer.disconnect(); }, 2000);
    }
    updateTypingIndicator();
    state.renderInProgress = false;
}



function appendMessage(msg) {
    if (!state.currentChannel || state.renderInProgress) return;
    const container = document.getElementById("messages");
    
    // Remove empty channel message if present
    const emptyMessage = container.querySelector('.empty-channel-message');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    const messages = (state.messagesByServer[state.serverUrl]?.[state.currentChannel.name] || []);

    const prevMsg = messages.length > 1 ? messages[messages.length - 2] : null;
    const isSameUserRecent = prevMsg &&
        msg.user === prevMsg.user &&
        msg.timestamp - prevMsg.timestamp < 300;

    if (prevMsg) {
        const prevDate = new Date(prevMsg.timestamp * 1000).toDateString();
        const msgDate = new Date(msg.timestamp * 1000).toDateString();
        if (prevDate !== msgDate) {
            lastUser = null;
            lastTime = 0;
            container.appendChild(getDaySeparator(msg.timestamp));
        }
    }

    const element = makeMessageElement(msg, isSameUserRecent);
    const nearBottom = (beforeAppend = true) => {
        const height = beforeAppend ? container.scrollHeight : container.scrollHeight;
        return (height - (container.scrollTop + container.clientHeight)) < 80;
    };
    const wasNearBottom = nearBottom(true);
    container.appendChild(element);

    lastUser = msg.user;
    lastTime = msg.timestamp;

    if (wasNearBottom) {
        requestAnimationFrame(() => {
            const prevBehavior = container.style.scrollBehavior;
            container.style.scrollBehavior = 'auto';
            container.scrollTop = container.scrollHeight;
            container.style.scrollBehavior = prevBehavior || '';
        });
    }
}

function updateMessageContent(msgId, newContent) {
    const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!wrapper) return;

    const msgText = wrapper.querySelector('.message-text');
    if (!msgText) return;

    const msg = state.messagesByServer[state.serverUrl]?.[state.currentChannel.name]?.find(m => m.id === msgId);
    if (!msg) return;

    const embedLinks = [];
    msgText.innerHTML = parseMsg(msg, embedLinks);

    msgText.querySelectorAll('.message-image').forEach(img => {
        img.onerror = () => {
            const url = img.src || img.dataset.imageUrl;
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = url;
            link.className = 'failed-image-link';
            const wrapper = img.closest('.chat-image-wrapper');
            if (wrapper) {
                wrapper.replaceWith(link);
            } else if (img.parentNode.tagName === 'A') {
                img.parentNode.replaceChild(link, img);
            } else {
                img.parentNode.replaceChild(link, img);
            }
        };
    });

    if (embedLinks.length === 1 &&
        embedLinks[0].match(/tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i) &&
        msg.content.trim() === embedLinks[0]) {
        msgText.style.display = 'none';
    } else {
        msgText.style.display = '';


        if (isEmojiOnly(msg.content)) {
            msgText.classList.add('emoji-only');
        } else {
            msgText.classList.remove('emoji-only');
        }
    }

    msgText.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
    });
    msgText.querySelectorAll("a.potential-image").forEach(link => {
        const url = link.dataset.imageUrl;
        isImageUrl(url).then(isImage => {
            if (isImage) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'image';
                img.className = 'message-image';
                img.onerror = () => {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = url;
                    link.className = 'failed-image-link';
                    wrapper.replaceWith(link);
                };

                const wrapper = document.createElement('div');
                wrapper.className = 'chat-image-wrapper';

                if (window.createFavButton) {
                    const favBtn = window.createFavButton(url, url);
                    wrapper.appendChild(favBtn);
                    if (window.lucide) {
                        setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
                    }
                }

                wrapper.appendChild(img);

                link.textContent = '';
                link.appendChild(wrapper);
                link.onclick = (e) => {
                    e.preventDefault();
                    if (window.openImageModal) window.openImageModal(url);
                };
                link.classList.remove('potential-image');
            }
        }).catch(err => {
            console.debug('Image check failed for URL:', url, err);
        });
    });

    msgText.classList.remove('mentioned');
    if (state.currentUser) {
        const username = state.currentUser.username;
        const matches = msg.content.match(pingRegex);
        if (matches && matches.filter(m => m.trim().toLowerCase() === '@' + username).length > 0) {
            msgText.classList.add('mentioned');
        }
    }

    const groupContent = wrapper.querySelector('.message-group-content');
    if (groupContent) {
        const embeds = groupContent.querySelectorAll('.embed-container');
        embeds.forEach(embed => embed.remove());
        for (const url of embedLinks) {
            if (state._embedCache[url]) {
                const cachedEl = state._embedCache[url];
                if (cachedEl) {
                    const clonedEmbed = cachedEl.cloneNode(true);
                    const img = clonedEmbed.querySelector('img');
                    if (img && !img.onerror) {
                        img.onerror = () => {
                            const fallbackLink = document.createElement('a');
                            fallbackLink.href = url;
                            fallbackLink.target = '_blank';
                            fallbackLink.rel = 'noopener noreferrer';
                            fallbackLink.textContent = url;
                            fallbackLink.className = 'failed-image-link';
                            const embedContainer = img.closest('.embed-container');
                            if (embedContainer) {
                                embedContainer.replaceWith(fallbackLink);
                            } else {
                                const wrapper = img.closest('.chat-image-wrapper');
                                if (wrapper) wrapper.replaceWith(fallbackLink);
                            }
                        };
                    }
                    groupContent.appendChild(clonedEmbed);
                }
            } else {
                createEmbed(url).then(embedEl => {
                    if (embedEl) {
                        state._embedCache[url] = embedEl.cloneNode(true);
                        groupContent.appendChild(embedEl);
                    } else {
                        state._embedCache[url] = null;
                    }
                });
            }
        }
    }

    const header = wrapper.querySelector('.message-header');
    if (header) {
        let editedIndicator = header.querySelector('.edited-indicator');
        if (msg.edited || msg.editedAt) {
            if (!editedIndicator) {
                editedIndicator = document.createElement('span');
                editedIndicator.className = 'edited-indicator';
                editedIndicator.textContent = '(edited)';
                header.appendChild(editedIndicator);
            }
        } else if (editedIndicator) {
            editedIndicator.remove();
        }
    }

    // Re-attach context menu listener
    msgText.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Check if right-clicked on a link
        const link = e.target.closest('a[href]');
        if (link && link.href && !link.href.startsWith('javascript:')) {
            openLinkContextMenu(e, link.href);
        } else {
            openMessageContextMenu(e, msg);
        }
    });
}

function removeMessage(msgId) {
    const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!wrapper) return;

    const wasGroupHead = wrapper.classList.contains('message-group');
    const nextSibling = wrapper.nextElementSibling;

    wrapper.remove();

    if (wasGroupHead && nextSibling && nextSibling.classList.contains('message-single')) {
        const nextMsgId = nextSibling.dataset.msgId;
        const nextMsg = state.messagesByServer[state.serverUrl]?.[state.currentChannel.name]?.find(m => m.id === nextMsgId);

        if (nextMsg) {
            const newElement = makeMessageElement(nextMsg, false);
            nextSibling.replaceWith(newElement);
        }
    }
}

function makeMessageElement(msg, isSameUserRecent, loadPromises = []) {
    const user = getUserByUsernameCaseInsensitive(msg.user) || { username: msg.user };
    const timestamp = formatTimestamp(msg.timestamp);
    const isReply = "reply_to" in msg
    const isHead = !isSameUserRecent || isReply;

    const isBlocked = Array.isArray(state.currentUser?.sys?.blocked) && state.currentUser.sys.blocked.includes(msg.user);

    const wrapper = document.createElement('div');
    wrapper.className = isHead ? 'message-group' + (isReply ? ' has-reply' : '') : 'message-single';
    wrapper.dataset.msgId = msg.id;

    if (isHead) {
        if (isReply) {
            const bodyContainer = document.createElement('div');
            bodyContainer.className = 'message-group-body';
            bodyContainer.appendChild(getAvatar(msg.user));
            wrapper.appendChild(bodyContainer);
        } else {
            wrapper.appendChild(getAvatar(msg.user));
        }
    }

    const groupContent = document.createElement('div');
    groupContent.className = 'message-group-content';
    if (isHead && isReply) {
        const bodyContainer = wrapper.querySelector('.message-group-body');
        if (bodyContainer) {
            bodyContainer.appendChild(groupContent);
        } else {
            wrapper.appendChild(groupContent);
        }
    } else {
        wrapper.appendChild(groupContent);
    }

    let actionsBar = wrapper.querySelector('.message-actions-bar');
    if (!actionsBar) {
        actionsBar = document.createElement('div');
        actionsBar.className = 'message-actions-bar';
        wrapper.appendChild(actionsBar);
    }

    const reactBtn = document.createElement('button');
    reactBtn.className = 'action-btn';
    reactBtn.setAttribute('data-emoji-anchor', 'true');
    reactBtn.innerHTML = '<i data-lucide="smile"></i>';
    reactBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReactionPicker(msg.id, reactBtn);
    });

    const replyBtn = document.createElement('button');
    replyBtn.className = 'action-btn';
    replyBtn.innerHTML = '<i data-lucide="reply"></i>';
    replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        replyToMessage(msg);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn';
    deleteBtn.innerHTML = '<i data-lucide="trash"></i>';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMessage(msg);
    });

    actionsBar.appendChild(reactBtn);
    actionsBar.appendChild(replyBtn);
    actionsBar.appendChild(deleteBtn);
    if (window.lucide) window.lucide.createIcons({ root: actionsBar });

    if (isReply) {
        const replyTo = state.messagesByServer[state.serverUrl]?.[state.currentChannel.name]?.find(
            m => m.id === msg.reply_to.id
        );

        const replyDiv = document.createElement('div');
        replyDiv.className = 'message-reply';

        if (replyTo) {
            const replyUser = getUserByUsernameCaseInsensitive(replyTo.user) || { username: replyTo.user };

            replyDiv.style.cursor = 'pointer';
            replyDiv.dataset.msgId = msg.id;
            replyDiv.dataset.replyToId = msg.reply_to.id;
            replyDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                const originalMessageEl = document.querySelector(`[data-msg-id="${replyTo.id}"]`);
                if (originalMessageEl) {
                    originalMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    originalMessageEl.classList.add('highlight-message');
                    setTimeout(() => {
                        originalMessageEl.classList.remove('highlight-message');
                    }, 2000);
                }
            });

            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'reply-username';
            usernameSpan.textContent = replyUser.username;
            usernameSpan.style.cursor = 'pointer';
            usernameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                openAccountModal(replyUser.username);
            });

            const contentSpan = document.createElement('span');
            contentSpan.className = 'reply-content';
            contentSpan.textContent = replyTo.content.length > 50 ? replyTo.content.substring(0, 50) + '...' : replyTo.content;

            replyDiv.appendChild(getAvatar(replyUser.username, 'small'));

            const replyText = document.createElement('div');
            replyText.appendChild(usernameSpan);
            replyText.appendChild(contentSpan);

            replyDiv.appendChild(replyText);
            wrapper.insertBefore(replyDiv, wrapper.firstChild);
        } else {
            const replyKey = `${state.serverUrl}:${msg.reply_to.id}`;
            if (!state.pendingReplyFetches[replyKey]) {
                state.pendingReplyFetches[replyKey] = [];
            }

            const notFoundDiv = document.createElement('div');
            notFoundDiv.className = 'message-reply reply-not-found';

            const notFoundIcon = document.createElement('div');
            notFoundIcon.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i>';

            const notFoundText = document.createElement('div');
            notFoundText.className = 'reply-username';
            notFoundText.textContent = 'Loading...';

            notFoundDiv.appendChild(notFoundIcon);
            notFoundDiv.appendChild(notFoundText);
            notFoundDiv.dataset.msgId = msg.id;
            notFoundDiv.dataset.replyToId = msg.reply_to.id;

            const timeoutKey = replyKey;

            const timeout = setTimeout(() => {
                if (pendingReplyTimeouts[timeoutKey]) {
                    clearTimeout(pendingReplyTimeouts[timeoutKey]);
                    delete pendingReplyTimeouts[timeoutKey];
                }

                if (state.pendingReplyFetches[replyKey]) {
                    state.pendingReplyFetches[replyKey].forEach((pending) => {
                        const existingEl = document.querySelector(`[data-reply-to-id="${msg.reply_to.id}"][data-msg-id="${pending.element.dataset.msgId}"]`);
                        if (existingEl) {
                            existingEl.className = 'message-reply reply-not-found';
                            existingEl.innerHTML = '';

                            const xIcon = document.createElement('div');
                            xIcon.innerHTML = '<i data-lucide="x-circle"></i>';

                            const textDiv = document.createElement('div');
                            textDiv.className = 'reply-username';
                            textDiv.textContent = 'Message not found';

                            existingEl.appendChild(xIcon);
                            existingEl.appendChild(textDiv);

                            if (window.lucide) {
                                window.lucide.createIcons({ root: xIcon });
                            }
                        }
                    });
                    delete state.pendingReplyFetches[replyKey];
                }
            }, 5000);

            pendingReplyTimeouts[timeoutKey] = timeout;

            state.pendingReplyFetches[replyKey].push({
                element: notFoundDiv,
                channel: state.currentChannel.name
            });

            wsSend({
                cmd: 'message_get',
                channel: state.currentChannel.name,
                id: msg.reply_to.id
            }, state.serverUrl);

            wrapper.insertBefore(notFoundDiv, wrapper.firstChild);

            if (window.lucide) {
                window.lucide.createIcons({ root: notFoundIcon });
            }
        }
    }

    if (isHead) {
        const header = document.createElement('div');
        header.className = 'message-header';
        const usernameEl = document.createElement('span');
        usernameEl.className = 'username';
        usernameEl.textContent = msg.user;
        usernameEl.style.color = user.color || '#fff';
        usernameEl.style.cursor = 'pointer';
        usernameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            openAccountModal(msg.user);
        });

        const ts = document.createElement('span');
        ts.className = 'timestamp';
        ts.textContent = timestamp;
        ts.dataset.timestamp = msg.timestamp;
        ts.title = getFullTimestamp(msg.timestamp);
        header.appendChild(usernameEl);
        header.appendChild(ts);

        if (msg.edited || msg.editedAt) {
            const editedSpan = document.createElement('span');
            editedSpan.className = 'edited-indicator';
            editedSpan.textContent = '(edited)';
            header.appendChild(editedSpan);
        }

        groupContent.appendChild(header);
    }

    if (isBlocked) {
        const blockedMode = getBlockedMessagesMode();

        if (shouldHideBlockedMessage(blockedMode)) {
            wrapper.style.display = 'none';
            return wrapper;
        }

        if (shouldDimBlockedMessage(blockedMode)) {
            wrapper.classList.add('blocked-dimmed');
            return wrapper;
        }

        if (shouldCollapseBlockedMessage(blockedMode)) {
            const notice = document.createElement('div');
            notice.className = 'blocked-notice';
            const btn = document.createElement('button');
            btn.className = 'blocked-show-btn';
            btn.textContent = 'Show';
            notice.textContent = 'Message from blocked user – ';
            notice.appendChild(btn);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                revealBlockedMessage(wrapper, msg);
            });
            groupContent.appendChild(notice);
            setupMessageSwipe(wrapper, msg);
            return wrapper;
        }

        return wrapper;
    }

    const msgText = document.createElement('div');
    msgText.className = 'message-text';
    const embedLinks = [];
    msgText.innerHTML = parseMsg(msg, embedLinks);

    if (embedLinks.length === 1 &&
        embedLinks[0].match(/tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i) &&
        msg.content.trim() === embedLinks[0]) {
        msgText.style.display = 'none';
    } else {
        msgText.style.display = '';


        if (isEmojiOnly(msg.content)) {
            msgText.classList.add('emoji-only');
        }
    }


    if (!isHead) {
        const hoverTs = document.createElement('div');
        hoverTs.className = 'hover-timestamp';
        hoverTs.dataset.timestamp = msg.timestamp;
        hoverTs.textContent = formatTimestamp(msg.timestamp);
        groupContent.appendChild(hoverTs);

        if (msg.edited || msg.editedAt) {
            const editedSpan = document.createElement('span');
            editedSpan.className = 'edited-indicator';
            editedSpan.textContent = '(edited)';
            hoverTs.appendChild(editedSpan);
        }
    }

    msgText.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
    });

    msgText.querySelectorAll("a.potential-image").forEach(link => {
        const url = link.dataset.imageUrl;
        if (loadPromises) {
            loadPromises.push(new Promise((resolve) => {
                isImageUrl(url).then(isImage => {
                    if (isImage) {
                        const img = document.createElement('img');
                        img.onload = resolve;
                        img.onerror = () => {
                            const link = document.createElement('a');
                            link.href = url;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            link.textContent = url;
                            link.className = 'failed-image-link';
                            wrapper.replaceWith(link);
                            resolve();
                        };
                        img.src = url;
                        img.alt = 'image';
                        img.className = 'message-image';

                        const wrapper = document.createElement('div');
                        wrapper.className = 'chat-image-wrapper';

                        if (window.createFavButton) {
                            const favBtn = window.createFavButton(url, url);
                            wrapper.appendChild(favBtn);
                            if (window.lucide) {
                                setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
                            }
                        }

                        wrapper.appendChild(img);

                        link.textContent = '';
                        link.appendChild(wrapper);
                        link.onclick = (e) => {
                            e.preventDefault();
                            if (window.openImageModal) window.openImageModal(url);
                        };
                        link.classList.remove('potential-image');
                    } else {
                        resolve();
                    }
                }).catch(() => resolve());
            }));
        } else {
            isImageUrl(url).then(isImage => {
                if (isImage) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = 'image';
                    img.className = 'message-image';

                    const wrapper = document.createElement('div');
                    wrapper.className = 'chat-image-wrapper';

                    if (window.createFavButton) {
                        const favBtn = window.createFavButton(url, url);
                        wrapper.appendChild(favBtn);
                        if (window.lucide) {
                            setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
                        }
                    }

                    wrapper.appendChild(img);

                    link.textContent = '';
                    link.appendChild(wrapper);
                    link.onclick = (e) => {
                        e.preventDefault();
                        if (window.openImageModal) window.openImageModal(url);
                    };
                    link.classList.remove('potential-image');
                }
            }).catch(err => {
                console.debug('Image check failed for URL:', url, err);
            });
        }
    });

    if (state.currentUser) {
        const username = state.currentUser.username;
        const matches = msg.content.match(pingRegex);
        if (matches && matches.filter(m => m.trim().toLowerCase() === '@' + username).length > 0) {
            msgText.classList.add('mentioned');
        }
    }

    msgText.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Check if right-clicked on a link
        const link = e.target.closest('a[href]');
        if (link && link.href && !link.href.startsWith('javascript:')) {
            openLinkContextMenu(e, link.href);
        } else {
            openMessageContextMenu(e, msg);
        }
    });

    groupContent.appendChild(msgText);

    for (const url of embedLinks) {
        if (state._embedCache[url]) {
            const cachedEl = state._embedCache[url];
            if (cachedEl) {
                groupContent.appendChild(cachedEl.cloneNode(true));
                const thumbnail = groupContent.querySelector('.youtube-thumbnail:last-child');
                if (thumbnail) {
                    const container = thumbnail.closest('.youtube-embed');
                    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/)?.[1];
                    if (container && videoId) {
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
                    }
                }
            }
        } else {
            createEmbed(url).then(embedEl => {
                if (embedEl) {
                    state._embedCache[url] = embedEl.cloneNode(true);
                    groupContent.appendChild(embedEl);

                    const img = embedEl.querySelector('img');
                    if (img && loadPromises) {
                        loadPromises.push(new Promise(resolve => {
                            if (img.complete) resolve();
                            else {
                                img.onload = resolve;
                                img.onerror = resolve;
                            }
                        }));
                    }
                } else {
                    state._embedCache[url] = null;
                }
            });
        }
    }

    renderReactions(msg, groupContent);

    setupMessageSwipe(wrapper, msg);

    return wrapper;
}

function revealBlockedMessage(wrapper, msg) {
    const groupContent = wrapper.querySelector('.message-group-content');
    if (!groupContent) return;
    groupContent.innerHTML = '';

    const user = getUserByUsernameCaseInsensitive(msg.user) || { username: msg.user };
    const timestamp = formatTimestamp(msg.timestamp);
    const isReply = "reply_to" in msg;

    if (isReply) {
        const replyTo = state.messagesByServer[state.serverUrl]?.[state.currentChannel.name]?.find(m => m.id === msg.reply_to.id);

        const replyDiv = document.createElement('div');
        replyDiv.className = 'message-reply';

        if (replyTo) {
            const replyUser = getUserByUsernameCaseInsensitive(replyTo.user) || { username: replyTo.user };
            const replyText = document.createElement('div');
            replyText.className = 'reply-text';

            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'reply-username';
            usernameSpan.textContent = replyUser.username + ': ';

            const contentSpan = document.createElement('span');
            contentSpan.className = 'reply-content';
            contentSpan.textContent = replyTo.content;

            replyText.appendChild(usernameSpan);
            replyText.appendChild(contentSpan);

            replyDiv.appendChild(getAvatar(replyUser.username, 'small'));
            replyDiv.appendChild(replyText);
        } else {
            const notFoundIcon = document.createElement('div');
            notFoundIcon.innerHTML = '<i data-lucide="x-circle"></i>';

            const notFoundText = document.createElement('div');
            notFoundText.className = 'reply-text';
            notFoundText.innerHTML = '<span class="reply-username">Message not found</span>';

            replyDiv.appendChild(notFoundIcon);
            replyDiv.appendChild(notFoundText);

            if (window.lucide) {
                window.lucide.createIcons({ root: notFoundIcon });
            }
        }

        wrapper.insertBefore(replyDiv, wrapper.firstChild);
    }

    const header = document.createElement('div');
    header.className = 'message-header';
    const usernameEl = document.createElement('span');
    usernameEl.className = 'username';
    usernameEl.textContent = msg.user;
    usernameEl.style.color = user.color || '#fff';
    usernameEl.style.cursor = 'pointer';
    usernameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openAccountModal(msg.user);
    });
    const ts = document.createElement('span');
    ts.className = 'timestamp';
    ts.textContent = timestamp;
    ts.dataset.timestamp = msg.timestamp;
    ts.title = getFullTimestamp(msg.timestamp);
    header.appendChild(usernameEl);
    header.appendChild(ts);
    groupContent.appendChild(header);

    const msgText = document.createElement('div');
    msgText.className = 'message-text';
    const embedLinks = [];
    msgText.innerHTML = parseMsg(msg, embedLinks);
    groupContent.appendChild(msgText);

    msgText.querySelectorAll('.message-image').forEach(img => {
        img.onerror = () => {
            const url = img.src || img.dataset.imageUrl;
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = url;
            link.className = 'failed-image-link';
            const wrapper = img.closest('.chat-image-wrapper');
            if (wrapper) {
                wrapper.replaceWith(link);
            } else if (img.parentNode.tagName === 'A') {
                img.parentNode.replaceChild(link, img);
            } else {
                img.parentNode.replaceChild(link, img);
            }
        };
    });

    msgText.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
    });

    msgText.querySelectorAll("a.potential-image").forEach(link => {
        const url = link.dataset.imageUrl;
        isImageUrl(url).then(isImage => {
            if (isImage) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'image';
                img.className = 'message-image';
                img.onerror = () => {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = url;
                    link.className = 'failed-image-link';
                    wrap.replaceWith(link);
                };
                const wrap = document.createElement('div');
                wrap.className = 'chat-image-wrapper';
                if (window.createFavButton) {
                    const favBtn = window.createFavButton(url, url);
                    wrap.appendChild(favBtn);
                    if (window.lucide) {
                        setTimeout(() => window.lucide.createIcons({ root: favBtn }), 0);
                    }
                }
                wrap.appendChild(img);
                link.textContent = '';
                link.appendChild(wrap);
                link.onclick = (e) => { e.preventDefault(); if (window.openImageModal) window.openImageModal(url); };
                link.classList.remove('potential-image');
            }
        }).catch(() => { });
    });

    renderReactions(msg, groupContent);

    // Add context menu listener for blocked message content
    msgText.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Check if right-clicked on a link
        const link = e.target.closest('a[href]');
        if (link && link.href && !link.href.startsWith('javascript:')) {
            openLinkContextMenu(e, link.href);
        }
        // No message context menu for blocked messages
    });
}


let contextMenu = document.getElementById("context-menu");
let contextMenuOpen = false;

function openMessageContextMenu(event, msg) {
    closeContextMenu();

    contextMenu.innerHTML = "";

    const addItem = (label, callback, icon = 'more-horizontal') => {
        const el = document.createElement("div");
        el.className = "context-menu-item";
        el.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
        el.onclick = (e) => {
            e.stopPropagation();
            closeContextMenu();
            callback(msg);
        };
        contextMenu.appendChild(el);
    };

    if (msg.user === state.currentUser?.username) {
        addItem("Edit message", startEditMessage, 'edit-3');
    }
    addItem("Reply to message", replyToMessage, 'message-circle');
    addItem("Add reaction", (msg) => {
        const dummyAnchor = document.createElement('div');
        dummyAnchor.style.position = 'absolute';
        dummyAnchor.style.left = `${event.clientX}px`;
        dummyAnchor.style.top = `${event.clientY}px`;
        document.body.appendChild(dummyAnchor);
        openReactionPicker(msg.id, dummyAnchor);
        setTimeout(() => dummyAnchor.remove(), 100);
    }, 'smile');
    addItem("Delete message", (msg) => {
        wsSend({
            cmd: 'message_delete',
            id: msg.id,
            channel: state.currentChannel.name
        }, state.serverUrl);
    }, 'trash-2');

    if (!isMobile()) {
        const menuWidth = 200;
        const menuHeight = 120;

        let x = event.clientX;
        let y = event.clientY;

        if (x + menuWidth > window.innerWidth)
            x = window.innerWidth - menuWidth - 6;
        if (y + menuHeight > window.innerHeight)
            y = window.innerHeight - menuHeight - 6;

        contextMenu.style.left = x + "px";
        contextMenu.style.top = y + "px";
    }
    contextMenu.style.display = "block";

    if (window.lucide) {
        window.lucide.createIcons({ root: contextMenu });
    }

    contextMenuOpen = true;
}

function openLinkContextMenu(event, url) {
    closeContextMenu();

    contextMenu.innerHTML = "";

    const addItem = (label, callback, icon = 'more-horizontal') => {
        const el = document.createElement("div");
        el.className = "context-menu-item";
        el.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
        el.onclick = (e) => {
            e.stopPropagation();
            closeContextMenu();
            callback();
        };
        contextMenu.appendChild(el);
    };

    addItem("Copy URL", () => {
        navigator.clipboard.writeText(url).then(() => {
            console.log('URL copied to clipboard:', url);
        }).catch(err => {
            console.error('Failed to copy URL:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback copy failed:', err);
            }
            document.body.removeChild(textArea);
        });
    }, 'copy');

    addItem("Open in new tab", () => {
        window.open(url, '_blank', 'noopener,noreferrer');
    }, 'external-link');

    if (!isMobile()) {
        const menuWidth = 200;
        const menuHeight = 80;

        let x = event.clientX;
        let y = event.clientY;

        if (x + menuWidth > window.innerWidth)
            x = window.innerWidth - menuWidth - 6;
        if (y + menuHeight > window.innerHeight)
            y = window.innerHeight - menuHeight - 6;

        contextMenu.style.left = x + "px";
        contextMenu.style.top = y + "px";
    }
    contextMenu.style.display = "block";

    if (window.lucide) {
        window.lucide.createIcons({ root: contextMenu });
    }

    contextMenuOpen = true;
}

document.addEventListener("click", (e) => {
    if (contextMenuOpen && !e.target.closest('.context-menu') && !e.target.closest('.guild-item')) {
        closeContextMenu();
    }
});

function closeContextMenu() {
    contextMenu.style.display = "none";
    contextMenuOpen = false;
}

function checkPermission(roles, permissions) {
    if (!roles?.length) return true;
    return roles.some(r => permissions.includes(r));
}

function renderMembers(channel) {
    const viewPermissions = channel?.permissions?.view || [];
    const container = document.getElementById('members-list');

    const users = Object.values(state.users).filter(u => checkPermission(u.roles, viewPermissions));

    const isExcludedChannel = state.currentChannel?.name === 'relationships' || state.currentChannel?.name === 'home';
    const isDM = state.serverUrl === 'dms.mistium.com';
    const serverChannelHeader = document.getElementById('server-channel-header');

    if (isDM && isExcludedChannel) {
        container.style.display = 'none';
        if (serverChannelHeader) serverChannelHeader.style.display = 'none';
        return;
    }

    container.style.display = '';
    if (serverChannelHeader && !isDM) serverChannelHeader.style.display = '';

    let headerSec = container.querySelector('.members-header');
    if (!headerSec) {
        headerSec = document.createElement('div');
        headerSec.className = 'members-header';
        headerSec.innerHTML = `
            <h3>Members</h3>
            <span class="close-members" onclick="toggleMembersList()">
                <i data-lucide="x"></i>
            </span>
        `;
        container.insertBefore(headerSec, container.firstChild);
    }

    let ownerSec = container.querySelector('.section-owner');
    let onlineSec = container.querySelector('.section-online');
    let offlineSec = container.querySelector('.section-offline');

    const owners = users.filter(u => u.roles && u.roles.includes('owner')).sort((a, b) =>
        a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
    );
    const nonOwners = users.filter(u => !u.roles || !u.roles.includes('owner'));
    const online = nonOwners.filter(u => u.status === 'online').sort((a, b) =>
        a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
    );
    const offline = nonOwners.filter(u => u.status !== 'online').sort((a, b) =>
        a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
    );

    if (isDM && ownerSec) {
        ownerSec.remove();
        ownerSec = null;
    }

    if (!isDM && owners.length > 0 && !ownerSec) {
        ownerSec = document.createElement('div');
        ownerSec.className = 'section section-owner';
        const header = document.createElement('h2');
        header.textContent = 'Owner';
        ownerSec.appendChild(header);
        container.insertBefore(ownerSec, container.firstChild);
    }

    if (!onlineSec) {
        onlineSec = document.createElement('div');
        onlineSec.className = 'section section-online';
        const header = document.createElement('h2');
        header.textContent = 'Online';
        onlineSec.appendChild(header);
        container.appendChild(onlineSec);
    }

    if (!offlineSec) {
        offlineSec = document.createElement('div');
        offlineSec.className = 'section section-offline';
        const header = document.createElement('h2');
        header.textContent = 'Offline';
        offlineSec.appendChild(header);
        container.appendChild(offlineSec);
    }

    if (!isDM && ownerSec) updateSection(ownerSec, owners);
    updateSection(onlineSec, online);
    updateSection(offlineSec, offline);

    if (headerSec) container.appendChild(headerSec);
    if (!isDM && ownerSec) container.appendChild(ownerSec);
    container.appendChild(onlineSec);
    container.appendChild(offlineSec);

    if (window.lucide) window.lucide.createIcons();

    function updateSection(section, users) {
        const membersMap = new Map([...section.querySelectorAll('.member')].map(el => [el.dataset.username, el]));

        for (const u of users) {
            let el = membersMap.get(u.username);
            if (!el) {
                el = document.createElement('div');
                el.className = 'member';
                el.dataset.username = u.username;
                el.style.cursor = 'pointer';
                el.addEventListener('click', () => {
                    openAccountModal(u.username);
                });

                el.appendChild(getAvatar(u.username));

                const name = document.createElement('span');
                name.className = 'name';
                el.appendChild(name);

                section.appendChild(el);
            }

            const name = el.querySelector('.name');
            name.textContent = u.username;
            name.style.color = u.color || '#fff';
            el.classList.toggle('offline', u.status !== 'online');
            membersMap.delete(u.username);
        }

        membersMap.forEach(el => el.remove());
    }
}

function replaceShortcodesWithEmojis(text) {
    if (!window.shortcodeMap) return text;
    return text.replace(/:\w+:/g, (match) => {
        return window.shortcodeMap[match] || match;
    });
}

function sendMessage() {
    closeMentionPopup();

    const input = document.getElementById('message-input');
    let content = input.value.trim();
    content = replaceShortcodesWithEmojis(content);

    if (!content || !state.currentChannel) return;

    if (window.editingMessage) {
        const msgId = window.editingMessage.id;
        wsSend({
            cmd: 'message_edit',
            id: msgId,
            channel: state.currentChannel.name,
            content
        }, state.serverUrl);

        const msg = state.messagesByServer[state.serverUrl]?.[state.currentChannel.name]?.find(m => m.id === msgId);
        if (msg) {
            msg.edited = true;
            msg.editedAt = Date.now();
            msg.content = content;

            const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
            if (wrapper) {
                const header = wrapper.querySelector('.message-header');
                if (header) {
                    let editedIndicator = header.querySelector('.edited-indicator');
                    if (!editedIndicator) {
                        editedIndicator = document.createElement('span');
                        editedIndicator.className = 'edited-indicator';
                        editedIndicator.textContent = '(edited)';
                        header.appendChild(editedIndicator);
                    }
                }
            }
        }

        window.editingMessage = null;
        originalInputValue = '';
        document.getElementById('reply-bar').classList.remove('active', 'editing-mode');
        input.value = '';
        input.style.height = 'auto';
        return;
    }

    const msg = {
        cmd: 'message_new',
        channel: state.currentChannel.name,
        content
    };

    if (state.replyTo) {
        msg.reply_to = state.replyTo.id;
        cancelReply();
    }

    wsSend(msg, state.serverUrl);
    input.value = '';
    input.style.height = 'auto';
}

let typing = false;
let lastTyped = 0;

function setupTypingListener() {
    const input = document.getElementById("message-input");

    input.addEventListener("input", () => {
        lastTyped = Date.now();

        if (!typing) {
            typing = true;
            sendTyping();
            watchForStopTyping();
        }
    });
}

function watchForStopTyping() {
    const interval = setInterval(() => {
        if (Date.now() - lastTyped > 1200) {
            typing = false;
            clearInterval(interval);
        }
    }, 300);
}

function setupInfiniteScroll() {
    const container = document.getElementById('messages');
    if (!container) return;
    container.addEventListener('scroll', () => {
        if (state._olderLoading) return;
        if (!state.currentChannel) return;
        const channelKey = `${state.serverUrl}:${state.currentChannel.name}`;
        if (state.pendingMessageFetchesByChannel[channelKey]) return;
        if (container.scrollTop <= 10) {
            const ch = state.currentChannel.name;
            const limit = 100;
            const start = (state.messages[ch] || []).length || 0;
            const lastSent = state._olderCooldown[ch] || 0;
            if (Date.now() - lastSent < 750) return;
            state._olderLoading = true;
            state._loadingOlder[ch] = { start, limit };
            state._olderCooldown[ch] = Date.now();
            wsSend({ cmd: 'messages_get', channel: ch, start, limit }, state.serverUrl);
        }
    });
}

function sendTyping() {
    wsSend({ cmd: 'typing', channel: state.currentChannel.name }, state.serverUrl);
}

function replyToMessage(msg) {
  state.replyTo = msg;

  const replyBar = document.getElementById('reply-bar');
  const icon = document.getElementById('reply-bar-icon');
  const label = document.getElementById('reply-bar-label');
  const text = document.getElementById('reply-text');
  const preview = document.getElementById('reply-preview');

  // Set reply mode styling
  icon.setAttribute('data-lucide', 'corner-up-left');
  label.textContent = 'Replying to';
  text.innerHTML = `<span class="username">${escapeHtml(msg.user)}</span>`;

  // Show message preview if content exists
  if (msg.content && msg.content.trim()) {
    const cleanContent = msg.content.replace(/```[\s\S]*?```/g, '[code]').replace(/`[^`]*`/g, '[code]');
    preview.textContent = cleanContent.length > 100 ? cleanContent.substring(0, 100) + '...' : cleanContent;
    preview.style.display = 'block';
  } else if (msg.attachments && msg.attachments.length > 0) {
    preview.textContent = msg.attachments.length === 1 ? '[Attachment]' : `[${msg.attachments.length} Attachments]`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  replyBar.classList.add('active');
  replyBar.classList.remove('editing-mode');
  if (window.lucide) window.lucide.createIcons({ root: replyBar });

  // Focus input after setting reply
  const input = document.getElementById('message-input');
  if (input) input.focus();
}

function cancelReply() {
  state.replyTo = null;
  const replyBar = document.getElementById('reply-bar');
  const preview = document.getElementById('reply-preview');

  preview.style.display = 'none';
  replyBar.classList.remove('active', 'editing-mode');
}

function updateUserSection() {
    if (state.currentUser) {
        const sidebarAvatar = document.getElementById('user-avatar-sidebar');
        if (sidebarAvatar) {
            const profileIcon = sidebarAvatar.querySelector('.user-profile-icon');
            if (profileIcon) {
                profileIcon.innerHTML = `<img src="https://avatars.rotur.dev/${state.currentUser.username}?radius=128" alt="${state.currentUser.username}">`;
            }
        }
    }
}


let mentionState = {
    active: false,
    query: '',
    startIndex: 0,
    selectedIndex: 0,
    filteredUsers: []
};

let emojiState = {
    active: false,
    query: '',
    startIndex: 0,
    selectedIndex: 0,
    filteredEmojis: []
};

function handleMentionInput() {
    const input = document.getElementById('message-input');
    const cursorPos = input.selectionStart;
    const text = input.value;

    const textBeforeCursor = text.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1] || '';

    if (lastWord.startsWith('@')) {
        closeChannelPopup();
        closeEmojiPopup();
        mentionState.active = true;
        mentionState.query = lastWord.substring(1).toLowerCase();
        mentionState.startIndex = cursorPos - lastWord.length;
        mentionState.selectedIndex = 0;

        filterUsers(mentionState.query);
    } else if (lastWord.startsWith('#')) {
        closeMentionPopup();
        closeEmojiPopup();
    } else if (lastWord.startsWith(':') && window.shortcodeMap) {
        closeMentionPopup();
        closeChannelPopup();
        emojiState.active = true;
        emojiState.query = lastWord.substring(1).toLowerCase();
        emojiState.startIndex = cursorPos - lastWord.length;
        emojiState.selectedIndex = 0;

        filterEmojis(emojiState.query);
    } else {
        closeMentionPopup();
        closeEmojiPopup();
    }
}

function filterEmojis(query) {
    if (!window.shortcodes || !window.shortcodeMap) {
        closeEmojiPopup();
        return;
    }

    const emojiEntries = Object.entries(window.shortcodeMap);
    
    if (query === '') {
        emojiState.filteredEmojis = emojiEntries
            .map(([shortcode, emoji]) => ({ shortcode, emoji }))
            .slice(0, 20);
    } else {
        emojiState.filteredEmojis = emojiEntries
            .filter(([shortcode]) => {
                const cleanShortcode = shortcode.replace(/^:/, '').replace(/:$/, '');
                return cleanShortcode.toLowerCase().includes(query);
            })
            .map(([shortcode, emoji]) => ({ shortcode, emoji }))
            .sort((a, b) => {
                const aStarts = a.shortcode.replace(/^:/, '').replace(/:$/, '').toLowerCase().startsWith(query) ? 0 : 1;
                const bStarts = b.shortcode.replace(/^:/, '').replace(/:$/, '').toLowerCase().startsWith(query) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;
                return a.shortcode.localeCompare(b.shortcode);
            })
            .slice(0, 20);
    }

    renderEmojiPopup();
}

function filterUsers(query) {
    const users = Object.values(state.users);

    if (query === '') {
        mentionState.filteredUsers = users.sort((a, b) => {
            const aOnline = a.status === 'online' ? 0 : 1;
            const bOnline = b.status === 'online' ? 0 : 1;
            if (aOnline !== bOnline) return aOnline - bOnline;
            return a.username.localeCompare(b.username);
        });
    } else {
        mentionState.filteredUsers = users
            .filter(user => user.username.toLowerCase().includes(query))
            .sort((a, b) => {
                const aExact = a.username.toLowerCase() === query ? 0 : 1;
                const bExact = b.username.toLowerCase() === query ? 0 : 1;
                if (aExact !== bExact) return aExact - bExact;

                const aOnline = a.status === 'online' ? 0 : 1;
                const bOnline = b.status === 'online' ? 0 : 1;
                if (aOnline !== bOnline) return aOnline - bOnline;

                return a.username.localeCompare(b.username);
            });
    }

    renderMentionPopup();
}

function renderMentionPopup() {
    const popup = document.getElementById('mention-popup');
    const list = document.getElementById('mention-list');

    if (mentionState.filteredUsers.length === 0) {
        closeMentionPopup();
        return;
    }

    list.innerHTML = '';

    const users = mentionState.filteredUsers.slice(0, 8);

    users.forEach((user, index) => {
        const li = document.createElement('li');
        li.className = 'mention-item' + (index === mentionState.selectedIndex ? ' selected' : '');
        li.dataset.username = user.username;
        li.dataset.index = index;

        li.innerHTML = `
            <img src="${getAvatarSrc(user.username)}" alt="${user.username}">
            <div class="mention-info">
                <div class="mention-name">${escapeHtml(user.username)}</div>
                <div class="mention-status">${user.status === 'online' ? 'Online' : 'Offline'}</div>
            </div>
        `;

        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectMention(index);
        });

        li.addEventListener('mouseenter', () => {
            mentionState.selectedIndex = index;
            updateMentionSelection();
        });

        if (user.status === 'online') {
            li.classList.add('online');
        }

        list.appendChild(li);
    });

    popup.classList.add('active');
}

function getAvatarSrc(username) {
    if (state._avatarCache[username]) {
        return state._avatarCache[username];
    }
    return `https://avatars.rotur.dev/${username}`;
}

function handleMentionNavigation(e) {
    if (emojiState.active) {
        if (e.key === 'Escape') {
            closeEmojiPopup();
            return true;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            emojiState.selectedIndex = Math.min(emojiState.selectedIndex + 1, emojiState.filteredEmojis.length - 1);
            updateEmojiSelection();
            return true;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            emojiState.selectedIndex = Math.max(emojiState.selectedIndex - 1, 0);
            updateEmojiSelection();
            return true;
        }

        if (e.key === 'Tab' || e.key === 'Enter') {
            if (emojiState.filteredEmojis.length > 0) {
                e.preventDefault();
                selectEmoji(emojiState.selectedIndex);
                return true;
            }
        }
    } else if (mentionState.active) {
        if (e.key === 'Escape') {
            closeMentionPopup();
            return true;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            mentionState.selectedIndex = Math.min(mentionState.selectedIndex + 1, mentionState.filteredUsers.length - 1);
            updateMentionSelection();
            return true;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            mentionState.selectedIndex = Math.max(mentionState.selectedIndex - 1, 0);
            updateMentionSelection();
            return true;
        }

        if (e.key === 'Tab' || e.key === 'Enter') {
            if (mentionState.filteredUsers.length > 0) {
                e.preventDefault();
                selectMention(mentionState.selectedIndex);
                return true;
            }
        }
    }

    return false;
}

function updateMentionSelection() {
    const items = document.querySelectorAll('.mention-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === mentionState.selectedIndex);
    });

    const selected = items[mentionState.selectedIndex];
    if (selected) {
        const popup = document.getElementById('mention-popup');
        const popupRect = popup.getBoundingClientRect();
        const itemRect = selected.getBoundingClientRect();

        if (itemRect.bottom > popupRect.bottom) {
            popup.scrollTop += itemRect.bottom - popupRect.bottom + 10;
        } else if (itemRect.top < popupRect.top) {
            popup.scrollTop += itemRect.top - popupRect.top - 10;
        }
    }
}

function selectMention(index) {
    const username = mentionState.filteredUsers[index].username;
    const input = document.getElementById('message-input');

    const before = input.value.substring(0, mentionState.startIndex);
    const after = input.value.substring(input.selectionStart);

    const mention = `@${username} `;

    input.value = before + mention + after;

    const newCursorPos = mentionState.startIndex + mention.length;
    input.setSelectionRange(newCursorPos, newCursorPos);

    closeMentionPopup();
    input.focus();
}

function closeMentionPopup() {
    mentionState.active = false;
    mentionState.query = '';
    mentionState.startIndex = 0;
    mentionState.selectedIndex = 0;
    mentionState.filteredUsers = [];

    const popup = document.getElementById('mention-popup');
    const list = document.getElementById('mention-list');
    if (list && list.querySelector('.mention-item')) {
        popup.classList.remove('active');
        list.innerHTML = '';
    }
}

function closeEmojiPopup() {
    emojiState.active = false;
    emojiState.query = '';
    emojiState.startIndex = 0;
    emojiState.selectedIndex = 0;
    emojiState.filteredEmojis = [];

    const popup = document.getElementById('emoji-popup');
    const list = document.getElementById('emoji-list');
    if (popup && list) {
        popup.classList.remove('active');
        list.innerHTML = '';
    }
}

function renderEmojiPopup() {
    const popup = document.getElementById('emoji-popup');
    const list = document.getElementById('emoji-list');
    
    if (!popup || !list) {
        console.error('Emoji popup or list not found in DOM');
        return;
    }

    if (emojiState.filteredEmojis.length === 0) {
        closeEmojiPopup();
        return;
    }

    list.innerHTML = '';

    const emojis = emojiState.filteredEmojis.slice(0, 8);

    emojis.forEach(({ shortcode, emoji }, index) => {
        const li = document.createElement('li');
        li.className = 'emoji-item' + (index === emojiState.selectedIndex ? ' selected' : '');
        li.dataset.shortcode = shortcode;
        li.dataset.index = index;

        li.innerHTML = `
            <span class="emoji-preview">${emoji}</span>
            <div class="emoji-info">
                <div class="emoji-shortcode">${escapeHtml(shortcode)}</div>
            </div>
        `;

        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectEmoji(index);
        });

        li.addEventListener('mouseenter', () => {
            emojiState.selectedIndex = index;
            updateEmojiSelection();
        });

        list.appendChild(li);
    });

    popup.classList.add('active');
}

function selectEmoji(emojiOrIndex) {
    if (typeof emojiOrIndex === 'number') {
        const input = document.getElementById('message-input');
        const { shortcode, emoji } = emojiState.filteredEmojis[emojiOrIndex];

        const before = input.value.substring(0, emojiState.startIndex);
        const after = input.value.substring(emojiState.startIndex + 1 + emojiState.query.length);

        input.value = before + emoji + ' ' + after;

        const newCursorPos = emojiState.startIndex + emoji.length + 1;
        input.setSelectionRange(newCursorPos, newCursorPos);

        closeEmojiPopup();
        input.focus();
        return;
    }

    const emoji = emojiOrIndex;

    window.recentEmojis = [emoji, ...window.recentEmojis.filter(e => e !== emoji)].slice(0, 50);

    const msgId = window.reactionPickerMsgId;
    const unifiedPicker = document.getElementById('unified-picker');

    if (msgId) {
        const reactionPicker = document.getElementById('reaction-picker');
        if (reactionPicker) reactionPicker.classList.remove('active');
        if (unifiedPicker) unifiedPicker.classList.remove('active');
        const overlay = document.querySelector('.unified-picker-overlay') || document.querySelector('.reaction-picker-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!unifiedPicker || !unifiedPicker.classList.contains('active')) {
                    overlay.style.display = 'none';
                }
            }, 200);
        }
        window.addReaction(msgId, emoji);
    } else {
        const input = document.getElementById('message-input');
        if (!input) {
            console.error('Message input not found');
            return;
        }

        try {
            input.focus();
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            const newValue = input.value.slice(0, start) + emoji + input.value.slice(end);
            input.value = newValue;

            const pos = start + emoji.length;
            input.selectionStart = pos;
            input.selectionEnd = pos;

            setTimeout(() => {
                input.focus();
                const reactionPicker = document.getElementById('reaction-picker');
                if (reactionPicker) reactionPicker.classList.remove('active');
                if (unifiedPicker) unifiedPicker.classList.remove('active');
                const overlay = document.querySelector('.unified-picker-overlay') || document.querySelector('.reaction-picker-overlay');
                if (overlay) {
                    overlay.classList.remove('active');
                    setTimeout(() => {
                        if (!unifiedPicker || !unifiedPicker.classList.contains('active')) {
                            overlay.style.display = 'none';
                        }
                    }, 200);
                }
            }, 10);
        } catch (e) {
            console.error('Error inserting emoji:', e);
        }
    }
}

function updateEmojiSelection() {
    const items = document.querySelectorAll('.emoji-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === emojiState.selectedIndex);
    });

    const selected = items[emojiState.selectedIndex];
    if (selected) {
        const popup = document.getElementById('emoji-popup');
        const popupRect = popup.getBoundingClientRect();
        const itemRect = selected.getBoundingClientRect();

        if (itemRect.bottom > popupRect.bottom) {
            popup.scrollTop += itemRect.bottom - popupRect.bottom + 10;
        } else if (itemRect.top < popupRect.top) {
            popup.scrollTop += itemRect.top - popupRect.top - 10;
        }
    }
}

let channelState = {
    active: false,
    query: '',
    startIndex: 0,
    selectedIndex: 0,
    filteredChannels: []
};

function handleChannelInput() {
    const input = document.getElementById('message-input');
    const cursorPos = input.selectionStart;
    const text = input.value;

    const textBeforeCursor = text.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1] || '';

    if (lastWord.startsWith('#')) {
        closeMentionPopup();
        channelState.active = true;
        channelState.query = lastWord.substring(1).toLowerCase();
        channelState.startIndex = cursorPos - lastWord.length;
        channelState.selectedIndex = 0;

        filterChannels(channelState.query);
    } else {
        closeChannelPopup();
    }
}

function filterChannels(query) {
    const channels = state.channels.filter(c => c.type === 'text');

    if (query === '') {
        channelState.filteredChannels = channels.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        channelState.filteredChannels = channels
            .filter(channel => getChannelDisplayName(channel).toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    renderChannelPopup();
}

function renderChannelPopup() {
    const popup = document.getElementById('mention-popup');
    const list = document.getElementById('mention-list');

    if (channelState.filteredChannels.length === 0) {
        closeChannelPopup();
        return;
    }

    list.innerHTML = '';

    const channels = channelState.filteredChannels.slice(0, 8);

    channels.forEach((channel, index) => {
        const li = document.createElement('li');
        li.className = 'channel-mention-item' + (index === channelState.selectedIndex ? ' selected' : '');
        li.dataset.channelName = channel.name;
        li.dataset.index = index;

        const displayName = getChannelDisplayName(channel);

        li.innerHTML = `
            <span class="channel-mention-hash">#</span>
            <div class="channel-mention-info">
                <div class="channel-mention-name">${escapeHtml(displayName)}</div>
            </div>
        `;

        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectChannelMention(index);
        });

        li.addEventListener('mouseenter', () => {
            channelState.selectedIndex = index;
            updateChannelSelection();
        });

        list.appendChild(li);
    });

    popup.classList.add('active');
}

function handleChannelNavigation(e) {
    if (!channelState.active) return false;

    if (e.key === 'Escape') {
        closeChannelPopup();
        return true;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        channelState.selectedIndex = Math.min(channelState.selectedIndex + 1, channelState.filteredChannels.length - 1);
        updateChannelSelection();
        return true;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        channelState.selectedIndex = Math.max(channelState.selectedIndex - 1, 0);
        updateChannelSelection();
        return true;
    }

    if (e.key === 'Tab' || e.key === 'Enter') {
        if (channelState.filteredChannels.length > 0) {
            e.preventDefault();
            selectChannelMention(channelState.selectedIndex);
            return true;
        }
    }

    return false;
}

function updateChannelSelection() {
    const items = document.querySelectorAll('.channel-mention-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === channelState.selectedIndex);
    });

    const selected = items[channelState.selectedIndex];
    if (selected) {
        const popup = document.getElementById('mention-popup');
        const popupRect = popup.getBoundingClientRect();
        const itemRect = selected.getBoundingClientRect();

        if (itemRect.bottom > popupRect.bottom) {
            popup.scrollTop += itemRect.bottom - popupRect.bottom + 10;
        } else if (itemRect.top < popupRect.top) {
            popup.scrollTop += itemRect.top - popupRect.top - 10;
        }
    }
}

function selectChannelMention(index) {
    const channel = channelState.filteredChannels[index];
    const displayName = getChannelDisplayName(channel);
    const input = document.getElementById('message-input');

    const before = input.value.substring(0, channelState.startIndex);
    const after = input.value.substring(input.selectionStart);

    const mention = `#${displayName}`;

    input.value = before + mention + after;

    const newCursorPos = channelState.startIndex + mention.length;
    input.setSelectionRange(newCursorPos, newCursorPos);

    closeChannelPopup();
    input.focus();
}

function closeChannelPopup() {
    channelState.active = false;
    channelState.query = '';
    channelState.startIndex = 0;
    channelState.selectedIndex = 0;
    channelState.filteredChannels = [];

    const popup = document.getElementById('mention-popup');
    const list = document.getElementById('mention-list');
    if (list && list.querySelector('.channel-mention-item')) {
        popup.classList.remove('active');
        list.innerHTML = '';
    }
}

document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && !link.dataset.imageUrl) {
        const url = link.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return;
    }

    if (!e.target.closest('.input-wrapper')) {
        closeMentionPopup();
        closeChannelPopup();
    }

    const channelMention = e.target.closest('.channel-mention');
    if (channelMention) {
        const channelName = channelMention.dataset.channel;
        const channel = state.channels.find(c => c.name === channelName);
        if (channel) {
            selectChannel(channel);
            e.preventDefault();
            e.stopPropagation();
        }
    }

    const mention = e.target.closest('.mention');
    if (mention) {
        const username = mention.dataset.user;
        if (username) {
            openAccountModal(username);
            e.preventDefault();
            e.stopPropagation();
        }
    }
});

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.classList.toggle('active');
}

async function attemptLogout() {
    const message = `Are you sure you want to log out?`;
    const condition = confirm(message);
    if (condition) logout();
}

function logout() {
    localStorage.removeItem('originchats_token');
    Object.keys(wsConnections).forEach(key => {
        wsConnections[key].socket.onclose = null;
        wsConnections[key].socket.onerror = null;
        if (wsConnections[key].socket.readyState !== WebSocket.CLOSED) {
            wsConnections[key].socket.close();
        }
        delete wsConnections[key];
        delete wsStatus[key];
    });
    state.token = null;
    state.currentUser = null;
    window.location.reload();
}

let errorBannerTimer = null;

function showError(message) {
    const banner = document.getElementById('error-banner');
    const text = document.getElementById('error-text');
    if (banner && text) {
        text.textContent = message;
        banner.classList.add('active');
        if (window.lucide) window.lucide.createIcons();

        if (errorBannerTimer) {
            clearTimeout(errorBannerTimer);
        }
        errorBannerTimer = setTimeout(() => {
            hideErrorBanner();
            errorBannerTimer = null;
        }, 5000);
    }
}

function hideErrorBanner() {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.classList.remove('active');
    }
    if (errorBannerTimer) {
        clearTimeout(errorBannerTimer);
        errorBannerTimer = null;
    }
}

let rateLimitTimer = null;

function showRateLimit(duration) {
    const inputWrapper = document.querySelector('.input-wrapper');
    const indicator = document.getElementById('rate-limit-indicator');
    const rateLimitText = document.getElementById('rate-limit-text');
    const input = document.getElementById('message-input');

    let messageEl = inputWrapper.querySelector('.rate-limit-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.className = 'rate-limit-message';
        messageEl.innerHTML = '<i data-lucide="alert-triangle"></i><span id="rate-limit-message-text"></span>';
        inputWrapper.appendChild(messageEl);
        if (window.lucide) {
            window.lucide.createIcons({ root: messageEl });
        }
    }

    inputWrapper.classList.add('rate-limited');
    indicator.classList.add('active');

    const seconds = Math.ceil(duration / 1000);
    rateLimitText.textContent = `Rate limited for ${seconds}s`;
    const messageText = document.getElementById('rate-limit-message-text');
    if (messageText) {
        messageText.textContent = `Rate limited for ${seconds}s`;
    }

    let remaining = duration;

    if (rateLimitTimer) {
        clearInterval(rateLimitTimer);
    }

    rateLimitTimer = setInterval(() => {
        remaining -= 1000;
        const secs = Math.ceil(remaining / 1000);
        if (secs <= 0) {
            clearInterval(rateLimitTimer);
            rateLimitTimer = null;
            inputWrapper.classList.remove('rate-limited');
            indicator.classList.remove('active');
            const messageEl = inputWrapper.querySelector('.rate-limit-message');
            if (messageEl) {
                messageEl.remove();
            }
            input.focus();
        } else {
            rateLimitText.textContent = `Rate limited for ${secs}s`;
            const messageText = document.getElementById('rate-limit-message-text');
            if (messageText) {
                messageText.textContent = `Rate limited for ${secs}s`;
            }
        }
    }, 1000);
}

function clearRateLimit() {
    if (rateLimitTimer) {
        clearInterval(rateLimitTimer);
        rateLimitTimer = null;
    }

    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper) {
        inputWrapper.classList.remove('rate-limited');
        const messageEl = inputWrapper.querySelector('.rate-limit-message');
        if (messageEl) {
            messageEl.remove();
        }
    }

    const indicator = document.getElementById('rate-limit-indicator');
    if (indicator) {
        indicator.classList.remove('active');
    }
}

function addDMServer(username, channel) {
    // Check if this DM server already exists
    const existingIndex = state.dmServers.findIndex(dm => dm.channel === channel);
    if (existingIndex >= 0) {
        // Move to top if it already exists
        const dm = state.dmServers.splice(existingIndex, 1)[0];
        state.dmServers.unshift(dm);
        return;
    }

    // Add new DM server at the beginning
    state.dmServers.unshift({
        username: username,
        channel: channel,
        name: username
    });

    // Limit to 10 DM servers in sidebar
    if (state.dmServers.length > 10) {
        state.dmServers = state.dmServers.slice(0, 10);
    }

    // Save to localStorage
    localStorage.setItem('originchats_dm_servers', JSON.stringify(state.dmServers));

    renderGuildSidebar();
}

// Media servers settings rendering
function renderMediaServersSettings() {
    const serversList = document.getElementById('media-servers-list');
    serversList.innerHTML = '';

    const servers = window.mediaServers || [];

    if (servers.length === 0) {
        serversList.innerHTML = `
            <div class="server-list-none">
                <i data-lucide="server"></i>
                <div>No media servers configured</div>
            </div>
        `;
    } else {
        servers.forEach(server => {
            const item = document.createElement('div');
            item.className = 'server-list-item';
            item.innerHTML = `
                <div class="server-list-info">
                    <div class="server-list-name">
                        ${server.name}
                        ${server.id === 'roturphotos' ? '<span style="font-size: 11px; background: rgba(88, 101, 242, 0.2); color: #5865f2; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Default</span>' : ''}
                    </div>
                    <div class="server-list-url">${server.uploadUrl}</div>
                </div>
                <div class="server-list-actions">
                    <div class="server-list-toggle">
                        <div class="toggle-switch ${server.enabled ? 'active' : ''}" onclick="toggleServerEnabled('${server.id}')"></div>
                    </div>
                    <button class="btn btn-secondary btn-small" onclick="editServer('${server.id}')">
                        <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                    </button>
                    ${server.id !== 'roturphotos' ? `
                    <button class="btn btn-danger btn-small" onclick="deleteServer('${server.id}')">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                    ` : ''}
                </div>
            `;
            serversList.appendChild(item);
        });
    }

    if (window.lucide) window.lucide.createIcons({ root: serversList });
}

function toggleServerEnabled(id) {
    const server = window.getMediaServerById(id);
    if (server) {
        window.setMediaServerEnabled(id, !server.enabled);
        renderMediaServersSettings();
    }
}

function deleteServer(id) {
    if (confirm('Are you sure you want to delete this media server?')) {
        window.deleteMediaServer(id);
        renderMediaServersSettings();
    }
}

let editingServerId = null;

function openAddServerModal() {
    editingServerId = null;
    document.getElementById('server-modal-title').textContent = 'Add Media Server';
    document.getElementById('server-config-form').reset();
    document.getElementById('headers-list').innerHTML = '';
    document.getElementById('body-params-list').innerHTML = '';

    const serverTypeSelect = document.querySelector('[name="serverType"]');
    if (serverTypeSelect) {
        serverTypeSelect.value = 'rotur';
    }
    updateServerTypeOptions();
    updateAuthOptions();

    const modal = document.getElementById('server-config-modal');
    modal.style.display = 'flex';
    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
}

function editServer(id) {
    const server = window.getMediaServerById(id);
    if (!server) return;

    editingServerId = id;
    document.getElementById('server-modal-title').textContent = 'Edit Media Server';

    const form = document.getElementById('server-config-form');

    const isRoturServer = server.id === 'roturphotos' ||
        (server.uploadUrl && server.uploadUrl.includes('/api/image/upload') &&
            server.responseUrlPath === '$.path' &&
            server.authType === 'session');

    const serverTypeSelect = form.querySelector('[name="serverType"]');
    if (serverTypeSelect) {
        serverTypeSelect.value = isRoturServer ? 'rotur' : 'custom';
    }

    if (isRoturServer) {
        const baseUrl = server.urlTemplate ? server.urlTemplate.replace('/{id}', '') : 'https://photos.rotur.dev';
        form.roturUrl.value = baseUrl;
        form.roturName.value = server.name || 'roturPhotos';
    } else {
        form.name.value = server.name || '';
        form.uploadUrl.value = server.uploadUrl || '';
        form.method.value = server.method || 'POST';
        form.enabled.value = server.enabled ? 'true' : 'false';
        form.fileParamName.value = server.fileParamName || '';
        form.responseUrlPath.value = server.responseUrlPath || '';
        form.urlTemplate.value = server.urlTemplate || '';
        form.requiresAuth.value = server.requiresAuth ? 'true' : 'false';
        form.authType.value = server.authType || 'session';
        form.authParam.value = server.apiKey || '';

        document.getElementById('headers-list').innerHTML = '';
        if (server.headers) {
            server.headers.forEach(h => addHeaderRow(h.key, h.value));
        }

        document.getElementById('body-params-list').innerHTML = '';
        if (server.bodyParams) {
            server.bodyParams.forEach(p => addBodyParamRow(p.key, p.value));
        }
    }

    updateServerTypeOptions();
    updateAuthOptions();

    const modal = document.getElementById('server-config-modal');
    modal.style.display = 'flex';
    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
}

function closeServerConfigModal() {
    document.getElementById('server-config-modal').classList.remove('active');
    document.getElementById('server-config-modal').style.display = 'none';
    editingServerId = null;
}

function updateAuthOptions() {
    const requiresAuth = document.querySelector('[name="requiresAuth"]')?.value === 'true';
    const authType = document.querySelector('[name="authType"]')?.value;
    const authOptions = document.getElementById('auth-options');
    const authParamGroup = document.getElementById('auth-param-group');
    const authParamLabel = document.getElementById('auth-param-label');

    if (!authOptions) return;

    authOptions.style.display = requiresAuth ? 'block' : 'none';

    if (requiresAuth && authType !== 'session') {
        authParamGroup.style.display = 'flex';
        authParamLabel.textContent = authType === 'token' ? 'Bearer Token' : 'API Key';
    } else {
        authParamGroup.style.display = 'none';
    }
}

function updateServerTypeOptions() {
    const serverType = document.querySelector('[name="serverType"]')?.value;
    const roturFields = document.getElementById('rotur-server-fields');
    const customFields = document.getElementById('custom-server-fields');

    if (serverType === 'rotur') {
        roturFields.style.display = 'block';
        customFields.style.display = 'none';
    } else {
        roturFields.style.display = 'none';
        customFields.style.display = 'block';
    }
}

function cleanRoturUrl(url) {
    if (!url) return 'https://photos.rotur.dev';

    // Remove trailing slashes
    url = url.replace(/\/$/, '');

    // Remove protocol for validation, then add it back
    url = url.replace(/^https?:\/\//, '');

    // Remove any paths that might be there (keep just the domain)
    url = url.split('/')[0];

    return `https://${url}`;
}

function createRoturConfig(url, name) {
    const baseUrl = cleanRoturUrl(url);
    const serverId = 'rotur_' + Date.now();

    return {
        id: serverId,
        name: name || 'roturPhotos',
        uploadUrl: `${baseUrl}/api/image/upload`,
        method: 'POST',
        fileParamName: null,
        headers: [],
        bodyParams: [],
        responseUrlPath: '$.path',
        urlTemplate: `${baseUrl}/{id}`,
        requiresAuth: true,
        authType: 'session',
        enabled: true
    };
}

function addHeaderRow(key = '', value = '') {
    const container = document.getElementById('headers-list');
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = `
        <input type="text" class="setting-input header-key" placeholder="Header name" value="${key}">
        <input type="text" class="setting-input header-value" placeholder="Header value" value="${value}">
        <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
    `;
    container.appendChild(row);
    if (window.lucide) window.lucide.createIcons({ root: row });
}

function addBodyParamRow(key = '', value = '') {
    const container = document.getElementById('body-params-list');
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = `
        <input type="text" class="setting-input param-key" placeholder="Parameter name" value="${key}">
        <input type="text" class="setting-input param-value" placeholder="Parameter value" value="${value}">
        <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
    `;
    container.appendChild(row);
    if (window.lucide) window.lucide.createIcons({ root: row });
}

// Handle server config form submission
document.addEventListener('DOMContentLoaded', function () {
    const serverForm = document.getElementById('server-config-form');
    if (serverForm) {
        serverForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const formData = new FormData(serverForm);
            const serverType = formData.get('serverType');

            let config;

            if (serverType === 'rotur') {
                // Handle roturPhotos server creation
                const url = formData.get('roturUrl');
                const name = formData.get('roturName');
                config = createRoturConfig(url, name);
            } else {
                // Handle custom server creation
                const headers = [];
                document.querySelectorAll('#headers-list .param-row').forEach(row => {
                    const key = row.querySelector('.header-key').value.trim();
                    const value = row.querySelector('.header-value').value.trim();
                    if (key && value) {
                        headers.push({ key, value });
                    }
                });

                const bodyParams = [];
                document.querySelectorAll('#body-params-list .param-row').forEach(row => {
                    const key = row.querySelector('.param-key').value.trim();
                    const value = row.querySelector('.param-value').value.trim();
                    if (key && value) {
                        bodyParams.push({ key, value });
                    }
                });

                config = {
                    id: editingServerId || window.generateServerId(),
                    name: formData.get('name'),
                    uploadUrl: formData.get('uploadUrl'),
                    method: formData.get('method'),
                    enabled: formData.get('enabled') === 'true',
                    fileParamName: formData.get('fileParamName') || null,
                    responseUrlPath: formData.get('responseUrlPath') || null,
                    urlTemplate: formData.get('urlTemplate') || null,
                    requiresAuth: formData.get('requiresAuth') === 'true',
                    authType: formData.get('authType'),
                    headers,
                    bodyParams
                };

                if (formData.get('authParam')) {
                    config.apiKey = formData.get('authParam');
                }
            }

            window.addMediaServer(config);
            closeServerConfigModal();
            renderMediaServersSettings();
        });
    }

    // Auth type change handler
    const authTypeSelect = document.querySelector('[name="authType"]');
    const requiresAuthSelect = document.querySelector('[name="requiresAuth"]');
    if (authTypeSelect) {
        authTypeSelect.addEventListener('change', updateAuthOptions);
    }
    if (requiresAuthSelect) {
        requiresAuthSelect.addEventListener('change', updateAuthOptions);
    }

    // Upload file input handler
    const uploadInput = document.getElementById('image-upload-input');
    if (uploadInput) {
        uploadInput.addEventListener('change', function (e) {
            const files = e.target.files;
            if (files.length > 0) {
                handleFileUpload(files);
            }
            this.value = '';
        });
    }

    // Drag and drop handlers
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
        messagesContainer.addEventListener('dragover', handleDragOver);
        messagesContainer.addEventListener('drop', handleDrop);
    }
    const inputArea = document.querySelector('.input-area');
    if (inputArea) {
        inputArea.addEventListener('dragover', handleDragOver);
        inputArea.addEventListener('drop', handleDrop);
    }
});

// Upload functions
async function triggerImageUpload() {
    document.getElementById('image-upload-input').click();
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
        handleFileUpload(imageFiles);
    }
}

async function handleFileUpload(files) {
    const server = window.getEnabledMediaServer();
    if (!server) {
        showError('No media server configured. Please add a media server in settings.');
        openSettings();
        return;
    }

    const input = document.getElementById('message-input');

    for (const file of files) {
        try {
            showUploadProgress(file.name);
            const imageUrl = await window.uploadImage(file, server);
            hideUploadProgress();

            // Insert the image URL into the input box
            if (input) {
                const cursorPosition = input.selectionStart || input.value.length;
                const beforeCursor = input.value.substring(0, cursorPosition);
                const afterCursor = input.value.substring(cursorPosition);
                // Add space before URL if needed
                const spaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') ? ' ' : '';
                // Add space after URL
                const spaceAfter = afterCursor.length > 0 && !afterCursor.startsWith(' ') ? ' ' : '';
                input.value = beforeCursor + spaceBefore + imageUrl + spaceAfter + afterCursor;
                // Move cursor after the inserted URL
                const newPosition = cursorPosition + spaceBefore.length + imageUrl.length + spaceAfter.length;
                input.setSelectionRange(newPosition, newPosition);
                input.focus();
            }
        } catch (error) {
            hideUploadProgress();
            showError(`Failed to upload ${file.name}: ${error.message}`);
            console.error('Upload error:', error);
        }
    }
}

let uploadProgressElement = null;

function showUploadProgress(fileName) {
    hideUploadProgress();
    const input = document.getElementById('message-input');
    input.value = `[Uploading ${fileName}...]`;
    input.disabled = true;
}

function hideUploadProgress() {
    const input = document.getElementById('message-input');
    input.value = '';
    input.disabled = false;
    input.focus();
}

const input = document.getElementById('message-input');
if (input) {
    input.addEventListener('paste', function (e) {
        const items = e.clipboardData.items;
        const imageFiles = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            handleFileUpload(imageFiles);
        }
    });
}

function showDMContextMenu(event, dmServer) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = '';

    const removeItem = document.createElement('div');
    removeItem.className = 'context-menu-item';
    removeItem.innerHTML = '<i data-lucide="x-circle"></i><span>Remove from sidebar</span>';
    removeItem.onclick = () => {
        // Remove this DM server from the list
        state.dmServers = state.dmServers.filter(dm => dm.channel !== dmServer.channel);
        // Save to localStorage
        localStorage.setItem('originchats_dm_servers', JSON.stringify(state.dmServers));
        renderGuildSidebar();
        closeContextMenu();
    };

    menu.appendChild(removeItem);

    const menuWidth = 200;
    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 6;
    if (y + 100 > window.innerHeight) y = window.innerHeight - 100;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';

    if (window.lucide) {
        window.lucide.createIcons({ root: menu });
    }

    if (typeof contextMenuOpen !== 'undefined') {
        contextMenuOpen = true;
    }
}

// DM Create Modal Functions
function openDMCreateModal() {
    const modal = document.getElementById('dm-create-modal');
    if (modal) {
        modal.classList.add('active');
        if (window.lucide) {
            window.lucide.createIcons({ root: modal });
        }
    }
}

function closeDMCreateModal() {
    const modal = document.getElementById('dm-create-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.getElementById('dm-username').value = '';
    document.getElementById('group-name').value = '';
    document.getElementById('group-members').value = '';
}

function switchDMCreateTab(tab) {
    const tabs = document.querySelectorAll('.dm-create-tab');
    const panels = document.querySelectorAll('.dm-create-panel');
    
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    
    const selectedTab = document.querySelector(`.dm-create-tab[data-tab="${tab}"]`);
    const selectedPanel = document.getElementById(`dm-create-${tab}-panel`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedPanel) selectedPanel.classList.add('active');
}

function createDirectMessage() {
    const usernameInput = document.getElementById('dm-username');
    const username = usernameInput.value.trim();
    
    if (!username) {
        showErrorBanner('Please enter a username');
        return;
    }
    
    const cmdsChannel = state.channels.find(c => c.name === 'cmds');
    if (cmdsChannel) {
        wsSend({ cmd: 'message_new', content: `dm add ${username}`, channel: 'cmds' }, 'dms.mistium.com');
        closeDMCreateModal();
        showErrorBanner(`Creating DM with ${username}...`);
    } else {
        showErrorBanner('Unable to create DM at this time');
    }
}

function createGroup() {
    const nameInput = document.getElementById('group-name');
    const membersInput = document.getElementById('group-members');
    
    const groupName = nameInput.value.trim().replace(/\s+/g, '-');
    const membersStr = membersInput.value.trim();
    
    if (!groupName) {
        showErrorBanner('Please enter a group name');
        return;
    }
    
    if (!membersStr) {
        showErrorBanner('Please enter at least one member');
        return;
    }
    
    const members = membersStr.split(',').map(m => m.trim()).filter(m => m);
    
    if (members.length === 0) {
        showErrorBanner('Please enter at least one member');
        return;
    }
    
    const cmdsChannel = state.channels.find(c => c.name === 'cmds');
    if (cmdsChannel) {
        wsSend({ cmd: 'message_new', content: `group create ${groupName} ${members.join(' ')}`, channel: 'cmds' }, 'dms.mistium.com');
        closeDMCreateModal();
        showErrorBanner(`Creating group "${groupName}"...`);
    } else {
        showErrorBanner('Unable to create group at this time');
    }
}

window.addEventListener('focus', function () {
    const allServerUrls = [...state.servers.map(s => s.url), 'dms.mistium.com'];

    allServerUrls.forEach(url => {
        const conn = wsConnections[url];
        if (!conn || conn.status !== 'connected') {
            connectToServer(url);
        }
    });

    setTimeout(() => {
        allServerUrls.forEach(url => {
            const conn = wsConnections[url];
            if (conn && conn.status === 'connected') {
                const channels = state.channelsByServer[url] || [];
                channels.forEach(channel => {
                    const channelKey = `${url}:${channel.name}`;
                    if (state.messagesByServer[url] && state.messagesByServer[url][channel.name] && !state.pendingMessageFetchesByChannel[channelKey]) {
                        state.pendingMessageFetchesByChannel[channelKey] = true;
                        wsSend({ cmd: 'messages_get', channel: channel.name }, url);
                    }
                });
            }
        });
    }, 500);
});

window.selectEmoji = selectEmoji;

// Voice Settings
function initVoiceSettings() {
    const thresholdSlider = document.getElementById('mic-threshold-slider');
    const thresholdValue = document.getElementById('mic-threshold-value');
    if (!thresholdSlider || !thresholdValue) return;

    const currentThreshold = voiceManager ? voiceManager.micThreshold : parseInt(localStorage.getItem('originchats_mic_threshold') || '30', 10);
    thresholdSlider.value = currentThreshold;
    thresholdValue.textContent = currentThreshold;

    thresholdSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        thresholdValue.textContent = value;
        if (voiceManager) {
            voiceManager.setMicThreshold(parseInt(value, 10));
        }
    });

    thresholdSlider.addEventListener('change', (e) => {
        if (voiceManager) {
            voiceManager.setMicThreshold(parseInt(e.target.value, 10));
        }
    });
}

// Settings navigation
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.settings-nav .nav-item');
    const sections = document.querySelectorAll('.settings-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            if (!sectionId) return;

            navItems.forEach(ni => ni.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            item.classList.add('active');
            const targetSection = document.getElementById(`section-${sectionId}`);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            if (sectionId === 'voice') {
                initVoiceSettings();
            }

            if (sectionId === 'privacy') {
                initPrivacySettings();
            }

            if (sectionId === 'chat') {
                initChatSettings();
            }

            if (sectionId === 'appearance') {
                initAppearanceSettings();
            }
        });
    });
});

window.initVoiceSettings = initVoiceSettings;

// Privacy Settings
function initPrivacySettings() {
    const modeSelect = document.getElementById('blocked-messages-mode');
    const previewContent = document.getElementById('preview-content');
    if (!modeSelect || !previewContent) return;

    const currentMode = localStorage.getItem('originchats_blocked_mode') || 'collapse';
    modeSelect.value = currentMode;
    updateBlockedPreview(currentMode, previewContent);

    modeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        localStorage.setItem('originchats_blocked_mode', mode);
        updateBlockedPreview(mode, previewContent);

        // Re-render messages to apply new blocking mode
        renderMessages();
    });
}

function updateBlockedPreview(mode, container) {
    const username = 'BlockedUser';
    const content = 'This is a message from a blocked user';

    switch (mode) {
        case 'hide':
            container.innerHTML = `<div style="color: var(--text-dim); font-style: italic;">Messages from blocked users will be completely hidden from view.</div>`;
            break;
        case 'dim':
            container.innerHTML = `
                <div style="opacity: 0.3; transition: opacity 0.2s ease;">
                    <div style="font-weight: 600; font-size: 14px;">${username}</div>
                    <div style="margin-top: 4px;">${content}</div>
                </div>
            `;
            break;
        case 'collapse':
            container.innerHTML = `
                <div class="blocked-notice" style="display: inline-flex; align-items: center; gap: 4px; padding: 8px 12px; background: rgba(237, 66, 69, 0.1); border-radius: 8px; color: var(--danger);">
                    <span>Message from blocked user – </span>
                    <button class="blocked-show-btn" style="background: none; border: none; color: var(--danger); font-weight: 600; cursor: pointer; padding: 0;">Show</button>
                </div>
            `;
            break;
    }
}

function getBlockedMessagesMode() {
    return localStorage.getItem('originchats_blocked_mode') || 'collapse';
}

function shouldHideBlockedMessage(mode) {
    return mode === 'hide';
}

function shouldDimBlockedMessage(mode) {
    return mode === 'dim';
}

function shouldCollapseBlockedMessage(mode) {
    return mode === 'collapse';
}

window.initPrivacySettings = initPrivacySettings;
window.updateBlockedPreview = updateBlockedPreview;
window.getBlockedMessagesMode = getBlockedMessagesMode;

// Chat Settings
function initChatSettings() {
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const showEmbeds = document.getElementById('show-embeds');
    const showTimestamps = document.getElementById('show-timestamps');

    if (fontSizeSlider && fontSizeValue) {
        const currentFontSize = localStorage.getItem('originchats_font_size') || '15';
        fontSizeSlider.value = currentFontSize;
        fontSizeValue.textContent = currentFontSize + 'px';
        applyFontSize(currentFontSize);

        fontSizeSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            fontSizeValue.textContent = size + 'px';
            applyFontSize(size);
        });

        fontSizeSlider.addEventListener('change', (e) => {
            localStorage.setItem('originchats_font_size', e.target.value);
        });
    }

    if (showEmbeds) {
        const currentShowEmbeds = localStorage.getItem('originchats_show_embeds') !== 'false';
        showEmbeds.checked = currentShowEmbeds;
        window.shouldShowEmbeds = currentShowEmbeds;

        showEmbeds.addEventListener('change', (e) => {
            const show = e.target.checked;
            localStorage.setItem('originchats_show_embeds', show);
            window.shouldShowEmbeds = show;
            renderMessages();
        });
    }

    if (showTimestamps) {
        const currentShowTimestamps = localStorage.getItem('originchats_show_timestamps') !== 'false';
        showTimestamps.checked = currentShowTimestamps;
        window.showTimestamps = currentShowTimestamps;

        showTimestamps.addEventListener('change', (e) => {
            const show = e.target.checked;
            localStorage.setItem('originchats_show_timestamps', show);
            window.showTimestamps = show;
            renderMessages();
        });
    }
}

function applyFontSize(size) {
    document.documentElement.style.setProperty('--message-font-size', size + 'px');
}

// Appearance Settings
function initAppearanceSettings() {
    const themeSelect = document.getElementById('color-theme-select');
    const wallpaperUpload = document.getElementById('wallpaper-upload');
    const wallpaperPreview = document.getElementById('wallpaper-preview');
    const clearWallpaperBtn = document.getElementById('clear-wallpaper-btn');
    const wallpaperOpacity = document.getElementById('wallpaper-opacity');
    const themePreviews = document.querySelectorAll('.theme-preview-option');

    // Theme handling
    if (themeSelect) {
        const currentTheme = localStorage.getItem('originchats_theme') || 'dark';
        themeSelect.value = currentTheme;
        applyTheme(currentTheme);

        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            localStorage.setItem('originchats_theme', theme);
            applyTheme(theme);
            updateThemePreview(theme);
        });
    }

    // Theme preview clicks
    themePreviews.forEach(preview => {
        preview.addEventListener('click', () => {
            const theme = preview.dataset.theme;
            if (themeSelect) {
                themeSelect.value = theme;
                localStorage.setItem('originchats_theme', theme);
                applyTheme(theme);
                updateThemePreview(theme);
            }
        });
    });

    updateThemePreview(localStorage.getItem('originchats_theme') || 'dark');

    // Wallpaper handling
    if (wallpaperUpload) {
        const currentWallpaper = localStorage.getItem('originchats_wallpaper');
        if (currentWallpaper) {
            applyWallpaper(currentWallpaper);
            updateWallpaperPreview(currentWallpaper);
        }

        wallpaperUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    localStorage.setItem('originchats_wallpaper', dataUrl);
                    applyWallpaper(dataUrl);
                    updateWallpaperPreview(dataUrl);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (clearWallpaperBtn) {
        clearWallpaperBtn.addEventListener('click', () => {
            localStorage.removeItem('originchats_wallpaper');
            applyWallpaper('');
            updateWallpaperPreview('');
            wallpaperUpload.value = '';
        });
    }

    if (wallpaperOpacity) {
        const currentDimmed = localStorage.getItem('originchats_wallpaper_dimmed') === 'true';
        wallpaperOpacity.checked = currentDimmed;
        applyWallpaperDimming(currentDimmed);

        wallpaperOpacity.addEventListener('change', (e) => {
            const dimmed = e.target.checked;
            localStorage.setItem('originchats_wallpaper_dimmed', dimmed);
            applyWallpaperDimming(dimmed);
        });
    }
}

function updateThemePreview(theme) {
    const themePreviews = document.querySelectorAll('.theme-preview-option');
    themePreviews.forEach(preview => {
        if (preview.dataset.theme === theme) {
            preview.style.borderColor = 'var(--primary)';
        } else {
            preview.style.borderColor = 'transparent';
        }
    });
}

function updateWallpaperPreview(dataUrl) {
    const wallpaperPreview = document.getElementById('wallpaper-preview');
    if (!wallpaperPreview) return;

    if (dataUrl) {
        wallpaperPreview.style.display = 'block';
        wallpaperPreview.style.backgroundImage = `url(${dataUrl})`;
    } else {
        wallpaperPreview.style.display = 'none';
        wallpaperPreview.style.backgroundImage = 'none';
    }
}

const themes = {
    dark: {
        '--bg': '#050505',
        '--surface': '#0a0a0c',
        '--surface-light': '#141419',
        '--surface-hover': '#1f1f26',
        '--border': '#2a2a33',
        '--primary': '#4e5058'
    },
    midnight: {
        '--bg': '#0d1117',
        '--surface': '#161b22',
        '--surface-light': '#21262d',
        '--surface-hover': '#30363d',
        '--border': '#30363d',
        '--primary': '#58a6ff'
    },
    ocean: {
        '--bg': '#0a1628',
        '--surface': '#0f1f3a',
        '--surface-light': '#1a3a5c',
        '--surface-hover': '#2a5070',
        '--border': '#1a4a6c',
        '--primary': '#4a9eff'
    },
    forest: {
        '--bg': '#0a1a10',
        '--surface': '#0f2a18',
        '--surface-light': '#1a4028',
        '--surface-hover': '#2a5538',
        '--border': '#1a4528',
        '--primary': '#4ade80'
    },
    sunset: {
        '--bg': '#1a0a14',
        '--surface': '#2a1020',
        '--surface-light': '#401830',
        '--surface-hover': '#5a2840',
        '--border': '#402030',
        '--primary': '#fb7185'
    },
    purple: {
        '--bg': '#1a0a28',
        '--surface': '#281040',
        '--surface-light': '#401860',
        '--surface-hover': '#5a2878',
        '--border': '#402055',
        '--primary': '#c084fc'
    }
};

function applyTheme(themeName) {
    const theme = themes[themeName] || themes.dark;
    const root = document.documentElement;

    for (const [property, value] of Object.entries(theme)) {
        root.style.setProperty(property, value);
    }
}

function applyWallpaper(dataUrl) {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    if (dataUrl) {
        messagesContainer.style.backgroundImage = `url(${dataUrl})`;
        messagesContainer.style.backgroundSize = 'cover';
        messagesContainer.style.backgroundPosition = 'center';
        messagesContainer.style.backgroundRepeat = 'no-repeat';
        messagesContainer.style.backgroundAttachment = 'scroll';
        messagesContainer.classList.add('has-wallpaper');
    } else {
        messagesContainer.style.backgroundImage = 'none';
        messagesContainer.classList.remove('has-wallpaper');
        messagesContainer.style.boxShadow = 'none';
    }
}

function applyWallpaperDimming(dimmed) {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    if (dimmed) {
        messagesContainer.style.boxShadow = 'inset 0 0 100px rgba(0, 0, 0, 0.8)';
    } else {
        messagesContainer.style.boxShadow = 'none';
    }
}

window.initChatSettings = initChatSettings;
window.initAppearanceSettings = initAppearanceSettings;

// Initialize App Settings on Load
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved font size
    const savedFontSize = localStorage.getItem('originchats_font_size');
    if (savedFontSize) {
        applyFontSize(savedFontSize);
    }

    // Apply saved theme
    const savedTheme = localStorage.getItem('originchats_theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }

    // Apply saved wallpaper
    const savedWallpaper = localStorage.getItem('originchats_wallpaper');
    if (savedWallpaper) {
        applyWallpaper(savedWallpaper);
    }

    // Apply saved wallpaper dimming
    const savedDimmed = localStorage.getItem('originchats_wallpaper_dimmed') === 'true';
    if (savedWallpaper || savedDimmed) {
        applyWallpaperDimming(savedDimmed);
    }

    // Initialize settings variables
    window.shouldShowEmbeds = localStorage.getItem('originchats_show_embeds') !== 'false';
    window.showTimestamps = localStorage.getItem('originchats_show_timestamps') !== 'false';
});
