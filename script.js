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
    unreadPings: {}
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
                wsSend({ cmd: 'messages_get', channel: msg.channel });
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

        case 'error':
        case 'auth_error':
            showError(msg.val);
            break;
    }
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


function renderMessages() {
    const container = document.getElementById('messages');
    const messages = (state.messages[state.currentChannel.name] || []).slice().reverse();
    container.innerHTML = '';

    const frag = document.createDocumentFragment();
    let lastUser = null;
    let lastTime = 0;
    let groupDiv = null;
    let groupMessages = [];

    const flushGroup = () => {
        if (!groupDiv || groupMessages.length === 0) return;
        const groupContent = groupDiv.querySelector('.message-group-content');
        // Reverse the messages so newest is at bottom within group
        for (let j = groupMessages.length - 1; j >= 0; j--) {
            groupContent.appendChild(groupMessages[j]);
        }
        groupMessages = [];
    };

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const user = state.users[msg.user] || { username: msg.user };
        const avatarUrl = `https://avatars.rotur.dev/${msg.user}?radius=128`;
        const timestamp = formatTimestamp(msg.timestamp);

        const sameUser = msg.user === lastUser && (msg.timestamp - lastTime) < 300;
        lastUser = msg.user;
        lastTime = msg.timestamp;

        if (!sameUser) {
            // Finish previous group before starting new one
            flushGroup();

            // New group
            groupDiv = document.createElement('div');
            groupDiv.className = 'message-group';

            const avatar = document.createElement('img');
            avatar.src = avatarUrl;
            avatar.className = 'avatar';
            avatar.alt = msg.user;
            groupDiv.appendChild(avatar);

            const groupContent = document.createElement('div');
            groupContent.className = 'message-group-content';

            const header = document.createElement('div');
            header.className = 'message-header';

            const username = document.createElement('span');
            username.className = 'username';
            username.textContent = msg.user;
            username.style.color = user.color || '#fff';

            const time = document.createElement('span');
            time.className = 'timestamp';
            time.textContent = timestamp;

            header.appendChild(username);
            header.appendChild(time);
            groupContent.appendChild(header);

            groupDiv.appendChild(groupContent);
            frag.appendChild(groupDiv);
        }

        // Create message element
        const messageText = document.createElement('div');
        messageText.className = 'message-text';

        if (state.currentUser) {
            const content = msg.content;
            const username = state.currentUser.username;

            if (content.includes('@' + username) || content.includes('@everyone')) {
                messageText.classList.add('mentioned');
            }
        }

        messageText.textContent = msg.content;

        messageText.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            replyToMessage(msg);
        });

        // Temporarily store in this group's buffer
        groupMessages.push(messageText);
    }

    // Flush last group
    flushGroup();

    container.appendChild(frag);
    container.scrollTop = container.scrollHeight; // scroll to bottom
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

        users.forEach(u => {
            let el = membersMap.get(u.username);
            if (!el) {
                el = document.createElement('div');
                el.className = 'member';
                el.dataset.username = u.username;

                const avatar = document.createElement('img');
                avatar.src = `https://avatars.rotur.dev/${u.username}?radius=128`;
                el.appendChild(avatar);

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
        });

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