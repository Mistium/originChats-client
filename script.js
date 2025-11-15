let ws = null;
let state = {
    token: null,
    serverUrl: 'chats.mistium.com',
    validator: null,
    server: {},
    channels: [],
    currentChannel: null,
    messages: {},
    users: {},
    replyTo: null,
    servers: [],
    currentUser: null,
    pings: {},
    memberListDrawn: false,
    unreadPings: {},
    _avatarCache: {},
    _avatarLoading: {},
    typingUsers: {}
};

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

window.onload = function () {
    requestNotificationPermission();

    // Load saved token
    const savedToken = localStorage.getItem('originchats_token');
    const savedServers = JSON.parse(localStorage.getItem('originchats_servers') || '[]');
    state.servers = savedServers;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        state.token = token;
        localStorage.setItem('originchats_token', token);
        const savedUrl = localStorage.getItem('serverUrl') || 'chats.mistium.com';
        state.serverUrl = savedUrl;
        document.getElementById('server-url').value = savedUrl;
        window.history.replaceState({}, document.title, window.location.pathname);
        connectToServer();
    } else if (savedToken) {
        state.token = savedToken;
        const savedUrl = localStorage.getItem('serverUrl') || 'chats.mistium.com';
        state.serverUrl = savedUrl;
        document.getElementById('server-url').value = savedUrl;
        connectToServer();
    }

    document.getElementById('auth-button').addEventListener('click', function () {
        const serverUrl = document.getElementById('server-url').value.trim();
        if (serverUrl) {
            state.serverUrl = serverUrl;
            localStorage.setItem('serverUrl', serverUrl);
        }
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://rotur.dev/auth?return_to=${returnUrl}`;
    });

    const input = document.getElementById('message-input');
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Mobile swipe gesture for channel menu
    let touchStartX = 0;
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
        const swipeDistance = touchEndX - touchStartX;
        if (swipeDistance > 100) {
            toggleMenu();
        }
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.server-info')) {
            closeServerDropdown();
        }
        if (!e.target.closest('.user-section')) {
            const menu = document.getElementById('user-menu');
            if (menu) menu.classList.remove('active');
        }
    });

    setupTypingListener();
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
    const overlay = document.querySelector('.overlay');
    channels.classList.toggle('open');
    overlay.classList.toggle('active');
}

function closeMenu() {
    const channels = document.getElementById('channels');
    const overlay = document.querySelector('.overlay');
    channels.classList.remove('open');
    overlay.classList.remove('active');
}

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
    dropdown.classList.remove('active');
    arrow.classList.remove('open');
}

function renderServerDropdown() {
    const dropdown = document.getElementById('server-dropdown');
    dropdown.innerHTML = '';

    state.servers.forEach(server => {
        const item = document.createElement('div');
        item.className = 'server-dropdown-item';
        if (server.url === state.serverUrl) {
            item.classList.add('active');
        }

        const icon = document.createElement('img');
        icon.src = server.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%239b87f5" width="100" height="100"/></svg>';
        icon.alt = server.name;

        const name = document.createElement('span');
        name.textContent = server.name;

        item.appendChild(icon);
        item.appendChild(name);

        item.onclick = (e) => {
            e.stopPropagation();
            if (server.url !== state.serverUrl) {
                switchServer(server.url);
            }
            closeServerDropdown();
        };

        dropdown.appendChild(item);
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'server-dropdown-item add-server-btn';
    addBtn.innerHTML = '<span>+ Add Server</span>';
    addBtn.onclick = (e) => {
        e.stopPropagation();
        addNewServer();
        closeServerDropdown();
    };
    dropdown.appendChild(addBtn);
}

function addNewServer() {
    const url = prompt('Enter server URL (e.g., chats.mistium.com):');
    if (url && url.trim()) {
        switchServer(url.trim());
    }
}

function switchServer(url) {
    state.serverUrl = url;
    localStorage.setItem('serverUrl', url);
    if (ws) {
        ws.close();
    }
    state.channels = [];
    state.messages = {};
    state.currentChannel = null;
    state.pings = {};
    connectToServer();
}

function saveServer(server) {
    const existing = state.servers.find(s => s.url === server.url);
    if (!existing) {
        state.servers.push(server);
    } else {
        Object.assign(existing, server);
    }
    localStorage.setItem('originchats_servers', JSON.stringify(state.servers));
}

function connectToServer() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');

    ws = new WebSocket(`wss://${state.serverUrl}`);

    ws.onopen = function () {
        console.log('WebSocket connected');
    };

    ws.onmessage = function (event) {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onerror = function (error) {
        console.error('WebSocket error:', error);
        showError('Connection error');
    };

    ws.onclose = function () {
        console.log('WebSocket closed');
        setTimeout(connectToServer, 3000);
    };
}

async function handleMessage(msg) {
    switch (msg.cmd) {
        case 'handshake':
            state.server = msg.val.server;
            state.server.url = state.serverUrl;
            saveServer(state.server);

            document.getElementById('server-name').innerHTML = `
                        <span>${state.server.name}</span>
                        <span class="dropdown-arrow" id="dropdown-arrow">▼</span>
                    `;
            if (state.server.icon) {
                document.getElementById('server-icon').src = state.server.icon;
            }

            const validatorUrl = `https://social.rotur.dev/generate_validator?key=${msg.val.validator_key}&auth=${state.token}`;
            const response = await fetch(validatorUrl);
            const data = await response.json();
            state.validator = data.validator;

            wsSend({ cmd: 'auth', validator: state.validator });
            break;
        case 'ready':
            state.currentUser = msg.user;
            state.users[msg.user.username] = msg.user;
            updateUserSection();
            break

        case 'auth_success':
            wsSend({ cmd: 'channels_get' });
            wsSend({ cmd: 'users_list' });
            wsSend({ cmd: 'users_online' });
            break;

        case 'channels_get':
            state.channels = msg.val;
            renderChannels();
            if (state.channels.length > 0) {
                selectChannel(state.channels[0]);
            }
            break;

        case 'users_list':
            for (let i = 0; i < msg.users.length; i++) {
                const user = msg.users[i];
                const existingUser = state.users[user.username];
                if (existingUser) {
                    Object.assign(existingUser, user);
                } else {
                    state.users[user.username] = user;
                }
            }
            renderMembers(state.currentChannel);
            break;

        case 'users_online':
            for (let i = 0; i < msg.users.length; i++) {
                const user = msg.users[i];
                const existingUser = state.users[user.username];
                if (existingUser) {
                    existingUser.status = 'online';
                }
            }
            renderMembers(state.currentChannel);
            break;

        case "user_connect": {
            wsSend({ cmd: 'users_online' });
            break;
        }
        case "user_disconnect": {
            wsSend({ cmd: 'users_online' });
            break;
        }
        case 'messages_get':
            state.messages[msg.channel] = msg.messages;
            if (msg.channel === state.currentChannel?.name) {
                renderMessages();
            }
            break;

        case 'message_new':
            if (!state.messages[msg.channel]) {
                return;
            }
            state.messages[msg.channel].push(msg.message);

            if (state.currentUser && msg.message.user !== state.currentUser.username) {
                const content = msg.message.content.toLowerCase();
                const username = state.currentUser.username.toLowerCase();

                if (content.includes('@' + username) || (content.includes('@everyone') && msg.message.user === state.server.owner)) {
                    if (msg.channel !== state.currentChannel?.name) {
                        if (!state.unreadPings[msg.channel]) {
                            state.unreadPings[msg.channel] = 0;
                        }
                        state.unreadPings[msg.channel]++;
                        renderChannels();
                    }

                    playPingSound();

                    const notifTitle = `${msg.message.user} mentioned you in #${msg.channel}`;
                    const notifBody = msg.message.content.length > 100
                        ? msg.message.content.substring(0, 100) + '...'
                        : msg.message.content;
                    showNotification(notifTitle, notifBody, msg.channel);
                }
            }

            if (msg.channel === state.currentChannel?.name) {
                renderMessages();
            }
            break;
        
        case 'message_edit': {
            if (!state.messages[msg.channel]) {
                break;
            }
            const id = msg.id;
            const message = state.messages[msg.channel].find(m => m.id === id);
            message.content = msg.content;
            if (msg.channel === state.currentChannel?.name) {
                renderMessages();
            }
            break;
        }
        case 'message_delete': {
            if (!state.messages[msg.channel]) {
                break;
            }
            const id = msg.id;
            const message = state.messages[msg.channel].find(m => m.id === id);
            state.messages[msg.channel] = state.messages[msg.channel].filter(m => m.id !== id);
            if (msg.channel === state.currentChannel?.name) {
                renderMessages();
            }
            break;
        }
        case 'typing':
            const channel = msg.channel;
            const user = msg.user;
            if (user === state.currentUser?.username) break;

            if (!state.typingUsers[channel]) {
                state.typingUsers[channel] = new Map();
            }

            if (channel === state.currentChannel?.name) {
                const typingMap = state.typingUsers[channel];

                const expireAt = Date.now() + 5000;
                typingMap.set(user, expireAt);

                updateTypingIndicator();

                setTimeout(() => {
                    if (typingMap.get(user) <= Date.now()) {
                        typingMap.delete(user);
                        updateTypingIndicator();
                    }
                }, 5000);
            }

            break;
        case 'error':
        case 'auth_error':
            showError(msg.val);
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
        typingEl.style.display = "none";
        return;
    }

    typingEl.style.display = "block";

    let text = "";
    if (users.length === 1) {
        text = `${users[0]} is typing...`;
    } else if (users.length === 2) {
        text = `${users[0]} and ${users[1]} are typing...`;
    } else {
        text = `${users.length} people are typing...`;
    }

    typingEl.textContent = text;
}


function wsSend(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function renderChannels() {
    const container = document.getElementById('channels-list');
    container.innerHTML = '';

    for (let i = 0; i < state.channels.length; i++) {
        const channel = state.channels[i];
        if (!checkPermission(channel.permissions?.view, state.currentUser.roles)) continue;
        if (channel.type === 'text') {
            const div = document.createElement('div');
            div.className = 'channel-item';
            const hash = document.createElement('span');
            hash.textContent = '# ';
            hash.style.color = 'var(--text-dim)';
            div.appendChild(hash);
            const name = document.createElement('span');
            name.textContent = channel.name;
            div.appendChild(name);
            if (state.unreadPings[channel.name] > 0) {
                const badge = document.createElement('span');
                badge.className = 'ping-badge';
                badge.textContent = state.unreadPings[channel.name];
                div.appendChild(badge);
            }
            div.onclick = () => {
                selectChannel(channel);
                closeMenu();
            };
            if (i === 0) div.classList.add('active');
            container.appendChild(div);
        } else if (channel.type === 'separator') {
            const div = document.createElement('div');
            div.className = 'channel-separator';
            div.style.height = (channel.size || 20) + 'px';
            container.appendChild(div);
        }
    };
}

function selectChannel(channel) {
    if (!channel) return;

    state.currentChannel = channel;
    document.getElementById('channel-name').textContent = `#${channel.name}`;
    if (state.unreadPings[channel.name]) {
        delete state.unreadPings[channel.name];
        renderChannels();
    }

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const channelItems = Array.from(document.querySelectorAll('.channel-item'));
    const targetItem = channelItems.find(el => el.textContent.includes(channel.name));
    if (targetItem) {
        targetItem.classList.add('active');
    }

    if (!state.messages[channel.name]) {
        wsSend({ cmd: 'messages_get', channel: channel.name });
    } else {
        renderMessages();
    }
    renderMembers(channel);
}

function formatTimestamp(unix) {
    const d = new Date(unix * 1000);
    const day = d.getDate();
    const suffix =
        day % 10 === 1 && day !== 11 ? 'st' :
            day % 10 === 2 && day !== 12 ? 'nd' :
                day % 10 === 3 && day !== 13 ? 'rd' : 'th';

    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `${day}${suffix} ${month} ${year}, ${time}`;
}

function getAvatar(username) {
    const img = new Image();
    img.className = "avatar";
    img.draggable = false;

    if (state._avatarCache[username]) {
        img.src = state._avatarCache[username];
        return img;
    }

    img.src = `https://avatars.rotur.dev/originChats?radius=128`;

    if (!state._avatarLoading[username]) {
        state._avatarLoading[username] = fetchAvatarBase64(username);
    }

    state._avatarLoading[username].then(dataUri => {
        state._avatarCache[username] = dataUri;
        img.src = dataUri;
    });

    return img;
}

async function fetchAvatarBase64(username) {
    const response = await fetch(`https://avatars.rotur.dev/${username}?radius=128`);
    const blob = await response.blob();
    return await blobToDataURL(blob);
}

function blobToDataURL(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

let lastRenderedChannel = null;
let lastUser = null;
let lastTime = 0;
let lastGroup = null;

function renderMessages() {
    const container = document.getElementById("messages");
    const channel = state.currentChannel.name;
    const messages = state.messages[channel] || [];

    container.innerHTML = "";
    lastUser = null;
    lastTime = 0;
    lastGroup = null;

    for (const msg of messages) {
        const isSameUserRecent =
            msg.user === lastUser &&
            msg.timestamp - lastTime < 300000;

        const element = makeMessageElement(msg, isSameUserRecent);
        container.appendChild(element);

        lastUser = msg.user;
        lastTime = msg.timestamp;
    }

    container.scrollTop = container.scrollHeight;
}


function makeMessageElement(msg, isSameUserRecent) {
    const user = state.users[msg.user] || { username: msg.user };
    const timestamp = formatTimestamp(msg.timestamp);
    const isReply = "reply_to" in msg
    const isHead = !isSameUserRecent || isReply;

    const wrapper = document.createElement('div');
    wrapper.className = isHead ? 'message-group' : 'message-single';
    wrapper.dataset.msgId = msg.id;

    if (isHead) {
        wrapper.appendChild(getAvatar(msg.user));
    }

    const groupContent = document.createElement('div');
    groupContent.className = 'message-group-content';
    wrapper.appendChild(groupContent);

    if (isHead) {
        const header = document.createElement('div');
        header.className = 'message-header';
        const usernameEl = document.createElement('span');
        usernameEl.className = 'username';
        usernameEl.textContent = msg.user;
        usernameEl.style.color = user.color || '#fff';

        const ts = document.createElement('span');
        ts.className = 'timestamp';
        ts.textContent = timestamp;
        header.appendChild(usernameEl);
        header.appendChild(ts);

        groupContent.appendChild(header);
    }

    if (isReply) {
        const replyTo = state.messages[state.currentChannel.name].find(
            m => m.id === msg.reply_to.id
        );

        if (replyTo) {
            const replyUser = state.users[replyTo.user] || { username: replyTo.user };

            const replyDiv = document.createElement('div');
            replyDiv.className = 'message-reply';

            const replyText = document.createElement('div');
            replyText.className = 'username';
            replyText.textContent = replyUser.username + ": " + replyTo.content;

            replyDiv.appendChild(getAvatar(replyUser.username));
            replyDiv.appendChild(replyText);
            groupContent.appendChild(replyDiv);
        }
    }

    const msgText = document.createElement('div');
    msgText.className = 'message-text';
    msgText.textContent = msg.content;

    if (state.currentUser) {
        const username = state.currentUser.username;
        if (msg.content.includes('@' + username) || msg.content.includes('@everyone')) {
            msgText.classList.add('mentioned');
        }
    }

    msgText.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openMessageContextMenu(e, msg);
    });

    groupContent.appendChild(msgText);

    return wrapper;
}

function editMessage(msg) {
    console.log("EDIT:", msg);
}

function deleteMessage(msg) {
    console.log("DELETE:", msg);
}


let contextMenu = document.getElementById("context-menu");
let contextMenuOpen = false;

function openMessageContextMenu(event, msg) {
    closeContextMenu();

    contextMenu.innerHTML = "";

    const addItem = (label, callback) => {
        const el = document.createElement("div");
        el.className = "context-menu-item";
        el.textContent = label;
        el.onclick = () => {
            closeContextMenu();
            callback(msg);
        };
        contextMenu.appendChild(el);
    };

    addItem("Edit message", editMessage);
    addItem("Reply to message", replyToMessage);
    addItem("Delete message", deleteMessage);

    // Position the menu
    const menuWidth = 180;
    const menuHeight = 120;

    let x = event.clientX;
    let y = event.clientY;

    // Prevent clipping out of window bounds
    if (x + menuWidth > window.innerWidth)
        x = window.innerWidth - menuWidth - 6;
    if (y + menuHeight > window.innerHeight)
        y = window.innerHeight - menuHeight - 6;

    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
    contextMenu.style.display = "block";

    contextMenuOpen = true;
}

// Close menu when clicking anywhere else
document.addEventListener("click", () => {
    if (contextMenuOpen) closeContextMenu();
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
    const online = users.filter(u => u.status === 'online');
    const offline = users.filter(u => u.status !== 'online');

    // Reuse DOM sections instead of clearing everything
    let onlineSec = container.querySelector('.section-online');
    let offlineSec = container.querySelector('.section-offline');

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

    updateSection(onlineSec, online);
    updateSection(offlineSec, offline);

    function updateSection(section, users) {
        const membersMap = new Map([...section.querySelectorAll('.member')].map(el => [el.dataset.username, el]));

        for (const u of users) {
            let el = membersMap.get(u.username);
            if (!el) {
                el = document.createElement('div');
                el.className = 'member';
                el.dataset.username = u.username;

                el.appendChild(getAvatar(u.username));

                const name = document.createElement('span');
                name.className = 'name';
                el.appendChild(name);

                section.appendChild(el);
            }

            // update existing info
            const name = el.querySelector('.name');
            name.textContent = u.username;
            name.style.color = u.color || '#fff';
            el.classList.toggle('offline', u.status !== 'online');
            membersMap.delete(u.username);
        }

        // remove users no longer in list
        membersMap.forEach(el => el.remove());
    }
}


function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content || !state.currentChannel) return;

    const msg = {
        cmd: 'message_new',
        channel: state.currentChannel.name,
        content
    };

    if (state.replyTo) {
        msg.reply_to = state.replyTo.id;
        cancelReply();
    }

    wsSend(msg);
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

function sendTyping() {
    wsSend({ cmd: 'typing', channel: state.currentChannel.name });
}

function replyToMessage(msg) {
    state.replyTo = msg;
    document.getElementById('reply-text').textContent = `Replying to ${msg.user}`;
    document.getElementById('reply-bar').classList.add('active');
}

function cancelReply() {
    state.replyTo = null;
    document.getElementById('reply-bar').classList.remove('active');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateUserSection() {
    if (state.currentUser) {
        document.getElementById('user-username').textContent = state.currentUser.username;
        document.getElementById('user-avatar').src = `https://avatars.rotur.dev/${state.currentUser.username}?radius=128`;
    }
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.classList.toggle('active');
}

function logout() {
    localStorage.removeItem('originchats_token');
    if (ws) {
        ws.close();
    }
    state.token = null;
    state.currentUser = null;
    document.getElementById('chat-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
}

function showError(message) {
    const container = document.getElementById('messages');
    container.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}