const channelElements = new Map();

function renderChannels() {
    const container = document.getElementById('channels-list');
    if (!container) return;

    console.log('renderChannels called, unreadByChannel:', state.unreadByChannel);

    const currentChannels = getChannelsToRender();
    const renderedKeys = new Set();
    let separatorIndex = 0;

    currentChannels.forEach((channel, index) => {
        const key = getChannelKey(channel, separatorIndex);
        renderedKeys.add(key);
        let element;

        if (channelElements.has(key)) {
            element = channelElements.get(key);
            updateChannelElement(element, channel, index);
        } else {
            element = createChannelElement(channel, index, separatorIndex);
            channelElements.set(key, element);
            container.appendChild(element);
        }

        element.style.order = index;

        if (channel.type === 'separator') {
            separatorIndex++;
        }
    });

    channelElements.forEach((element, key) => {
        if (!renderedKeys.has(key)) {
            element.remove();
            channelElements.delete(key);
        }
    });

    if (window.lucide) window.lucide.createIcons({ root: container });
}

function getChannelKey(channel, separatorIndex) {
    if (channel.type === 'separator') {
        return `separator:${separatorIndex}`;
    }
    return `channel:${channel.name}`;
}

const RECOGNIZED_CHANNEL_TYPES = ['text', 'voice', 'separator'];

function getChannelsToRender() {
    const channels = [];

    if (state.serverUrl === 'dms.mistium.com') {
        channels.push(
            { name: 'home', type: 'home' },
            { name: 'relationships', type: 'relationships' },
            { name: 'new_message', type: 'new_message' }
        );
    }

    state.channels.forEach(channel => {
        if (!checkPermission(channel.permissions?.view, state.currentUser.roles)) return;
        if (channel.name === 'cmds') return;
        // Hide channels with unrecognized types
        if (!RECOGNIZED_CHANNEL_TYPES.includes(channel.type)) return;
        channels.push(channel);
    });

    return channels;
}

function createChannelElement(channel, index, separatorIndex) {
    if (channel.type === 'home') {
        return createHomeChannelElement();
    }
    if (channel.type === 'relationships') {
        return createRelationshipsChannelElement();
    }
    if (channel.type === 'new_message') {
        return createNewMessageElement();
    }
    if (channel.type === 'separator') {
        return createSeparatorElement(channel, separatorIndex);
    }
    if (channel.type === 'voice') {
        return createVoiceChannelElement(channel, index);
    }
    return createTextChannelElement(channel, index);
}

function createHomeChannelElement() {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.dataset.channelName = 'home';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'home');
    icon.style.width = '18px';
    icon.style.height = '18px';
    icon.style.marginRight = '8px';
    icon.style.color = 'var(--text-dim)';
    div.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = 'Home';
    name.dataset.channelName = 'home';
    div.appendChild(name);

    div.onclick = () => {
        selectHomeChannel();
        closeMenu();
    };

    updateChannelActiveState(div, 'home');
    return div;
}

function createRelationshipsChannelElement() {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.dataset.channelName = 'relationships';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'users');
    icon.style.width = '18px';
    icon.style.height = '18px';
    icon.style.marginRight = '8px';
    icon.style.color = 'var(--text-dim)';
    div.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = 'Relationships';
    name.dataset.channelName = 'relationships';
    div.appendChild(name);

    div.onclick = () => {
        selectRelationshipsChannel();
        closeMenu();
    };

    updateChannelActiveState(div, 'relationships');
    return div;
}

function createNewMessageElement() {
    const div = document.createElement('div');
    div.className = 'channel-item channel-new-message';
    div.dataset.channelName = 'new_message';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'plus-circle');
    icon.style.width = '18px';
    icon.style.height = '18px';
    icon.style.marginRight = '8px';
    icon.style.color = 'var(--primary)';
    div.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = 'New Message';
    name.dataset.channelName = 'new_message';
    div.appendChild(name);

    div.onclick = () => {
        openDMCreateModal();
        closeMenu();
    };

    return div;
}

function createTextChannelElement(channel, index) {
    const div = document.createElement('div');
    div.className = 'channel-item channel-text';
    div.dataset.channelName = channel.name;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'hash');
    icon.style.width = '18px';
    icon.style.height = '18px';
    icon.style.marginRight = '8px';
    icon.style.color = 'var(--text-dim)';
    div.appendChild(icon);

    if (channel.icon) {
        const icon = document.createElement('img');
        icon.src = channel.icon;
        icon.style.width = '25px';
        icon.style.height = '25px';
        icon.style.marginRight = '4px';
        icon.style.borderRadius = '50%';
        icon.style.objectFit = 'contain';
        div.appendChild(icon);
    }

    const name = document.createElement('span');
    name.textContent = getChannelDisplayName(channel);
    name.dataset.channelName = channel.name;
    div.appendChild(name);

    addChannelIndicators(div, channel);

    div.onclick = () => {
        selectChannel(channel);
        closeMenu();
    };

    updateChannelActiveState(div, channel.name, index);
    return div;
}

function createVoiceChannelElement(channel, index) {
  const wrapper = document.createElement('div');
  wrapper.className = 'voice-channel-wrapper';
  wrapper.dataset.channelName = channel.name;

  // Main channel row
  const div = document.createElement('div');
  div.className = 'channel-item channel-voice';
  div.dataset.channelName = channel.name;

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', 'volume-2');
  icon.style.width = '18px';
  icon.style.height = '18px';
  icon.style.marginRight = '8px';
  icon.style.color = 'var(--success)';
  div.appendChild(icon);

  const name = document.createElement('span');
  name.textContent = getChannelDisplayName(channel);
  name.dataset.channelName = channel.name;
  div.appendChild(name);

  // Add user count badge
  const connectedUsers = getVoiceChannelUsers(channel.name);
  if (connectedUsers.length > 0) {
    const countBadge = document.createElement('span');
    countBadge.className = 'voice-user-count';
    countBadge.textContent = connectedUsers.length;
    div.appendChild(countBadge);
  }

  wrapper.appendChild(div);

  // Add connected users list below channel (Discord style)
  if (connectedUsers.length > 0) {
    const usersList = document.createElement('div');
    usersList.className = 'voice-channel-user-list';

    connectedUsers.forEach(user => {
      const userRow = document.createElement('div');
      userRow.className = 'voice-channel-user';

      const avatar = document.createElement('div');
      avatar.className = 'voice-channel-user-avatar';

      const img = document.createElement('img');
      img.src = typeof getAvatarSrc === 'function' ? getAvatarSrc(user.username) : `https://avatars.rotur.dev/${user.username}`;
      img.alt = user.username;
      img.onerror = () => {
        avatar.textContent = user.username.charAt(0).toUpperCase();
        img.style.display = 'none';
        avatar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
      };
      avatar.appendChild(img);

      const username = document.createElement('span');
      username.className = 'voice-channel-username';
      username.textContent = user.username;

      userRow.appendChild(avatar);
      userRow.appendChild(username);
      usersList.appendChild(userRow);
    });

    wrapper.appendChild(usersList);
  }

  div.onclick = () => {
    console.log('Voice channel clicked:', channel.name);
    if (voiceManager.isInChannel()) {
      const currentChannel = voiceManager.currentChannel;
      if (currentChannel === channel.name) {
        if (confirm('Leave voice channel?')) {
          voiceManager.leaveChannel();
        }
      } else {
        if (confirm(`Switch from ${currentChannel} to ${channel.name}?`)) {
          voiceManager.joinChannel(channel.name);
        }
      }
    } else {
      voiceManager.joinChannel(channel.name);
    }
    closeMenu();
  };

  updateChannelActiveState(div, channel.name, index);
  return wrapper;
}

// Helper function to get users in a voice channel
function getVoiceChannelUsers(channelName) {
    const users = [];

    // Check if current user is in this channel
    if (voiceManager && voiceManager.currentChannel === channelName && state.currentUser && state.currentUser.username) {
        users.push({
            username: state.currentUser.username,
            pfp: typeof getAvatarSrc === 'function' ? getAvatarSrc(state.currentUser.username) : `https://avatars.rotur.dev/${state.currentUser.username}`
        });
    }

    // Add other participants in this channel
    if (voiceManager && voiceManager.participants) {
        voiceManager.participants.forEach((participant) => {
            if (participant.channel === channelName) {
                users.push({
                    username: participant.username,
                    pfp: typeof getAvatarSrc === 'function' ? getAvatarSrc(participant.username) : `https://avatars.rotur.dev/${participant.username}`
                });
            }
        });
    }

    return users;
}

function createSeparatorElement(channel, separatorIndex) {
    const div = document.createElement('div');
    div.className = 'channel-separator';
    div.dataset.separatorIndex = separatorIndex;
    div.style.height = (channel.size || 20) + 'px';
    return div;
}

function updateChannelElement(element, channel, index) {
  if (channel.type === 'separator') {
    element.style.height = (channel.size || 20) + 'px';
    return;
  }

  // Handle voice channel wrapper
  if (channel.type === 'voice') {
    updateVoiceChannelElement(element, channel, index);
    return;
  }

  const nameSpan = element.querySelector('span[data-channel-name]');
  if (nameSpan && channel.type !== 'home' && channel.type !== 'relationships') {
    const channelKey = `${state.serverUrl}:${channel.name}`;
    const hasUnread = state.unreadByChannel[channelKey] > 0;
    const hasPings = state.unreadPings[channel.name] > 0;

    nameSpan.textContent = getChannelDisplayName(channel);

    if (hasUnread || hasPings) {
      nameSpan.style.fontWeight = '600';
      nameSpan.style.color = 'var(--text)';
    } else {
      nameSpan.style.fontWeight = '';
      nameSpan.style.color = '';
    }
  }

  updateChannelActiveState(element, channel.name, index);
  updateChannelIndicators(element, channel);
}

function updateVoiceChannelElement(wrapper, channel, index) {
  const div = wrapper.querySelector('.channel-item');
  if (!div) return;

  const nameSpan = div.querySelector('span[data-channel-name]');
  if (nameSpan) {
    nameSpan.textContent = getChannelDisplayName(channel);
  }

  // Update user count badge
  const connectedUsers = getVoiceChannelUsers(channel.name);
  const existingCount = div.querySelector('.voice-user-count');
  if (existingCount) {
    existingCount.remove();
  }
  if (connectedUsers.length > 0) {
    const countBadge = document.createElement('span');
    countBadge.className = 'voice-user-count';
    countBadge.textContent = connectedUsers.length;
    div.appendChild(countBadge);
  }

  // Update users list
  const existingList = wrapper.querySelector('.voice-channel-user-list');
  if (existingList) {
    existingList.remove();
  }

  if (connectedUsers.length > 0) {
    const usersList = document.createElement('div');
    usersList.className = 'voice-channel-user-list';

    connectedUsers.forEach(user => {
      const userRow = document.createElement('div');
      userRow.className = 'voice-channel-user';

      const avatar = document.createElement('div');
      avatar.className = 'voice-channel-user-avatar';

      const img = document.createElement('img');
      img.src = typeof getAvatarSrc === 'function' ? getAvatarSrc(user.username) : `https://avatars.rotur.dev/${user.username}`;
      img.alt = user.username;
      img.onerror = () => {
        avatar.textContent = user.username.charAt(0).toUpperCase();
        img.style.display = 'none';
        avatar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
      };
      avatar.appendChild(img);

      const username = document.createElement('span');
      username.className = 'voice-channel-username';
      username.textContent = user.username;

      userRow.appendChild(avatar);
      userRow.appendChild(username);
      usersList.appendChild(userRow);
    });

    wrapper.appendChild(usersList);
  }

  updateChannelActiveState(div, channel.name, index);
  updateChannelIndicators(div, channel);
}

function updateChannelActiveState(element, channelName, index) {
    if (state.currentChannel?.name === channelName) {
        element.classList.add('active');
    } else if (index === 0 && state.channels.length > 0 && state.currentChannel?.name !== 'home' && state.currentChannel?.name !== 'relationships') {
        element.classList.add('active');
    } else {
        element.classList.remove('active');
    }
}

function addChannelIndicators(element, channel) {
    const channelKey = `${state.serverUrl}:${channel.name}`;
    const hasUnread = state.unreadByChannel[channelKey] > 0;
    const hasPings = state.unreadPings[channel.name] > 0;

    let badge = element.querySelector('.ping-badge');
    let unreadIndicator = element.querySelector('.unread-indicator');
    let typingIndicator = element.querySelector('.channel-typing-indicator');

    if (badge && (!hasPings)) {
        badge.remove();
    }
    if (unreadIndicator && (!hasUnread || hasPings)) {
        unreadIndicator.remove();
    }
    if (typingIndicator && shouldRemoveTypingIndicator(channel.name)) {
        typingIndicator.remove();
    }

    if (hasPings && !badge) {
        badge = document.createElement('span');
        badge.className = 'ping-badge';
        badge.textContent = state.unreadPings[channel.name];
        element.appendChild(badge);
    } else if (badge) {
        badge.textContent = state.unreadPings[channel.name];
    }

    if (hasUnread && !hasPings && !unreadIndicator) {
        unreadIndicator = document.createElement('span');
        unreadIndicator.className = 'unread-indicator';
        element.appendChild(unreadIndicator);
    }

    if (!typingIndicator && shouldShowTypingIndicator(channel.name)) {
        const typingInd = document.createElement('div');
        typingInd.className = 'channel-typing-indicator';
        typingInd.innerHTML = `
            <div class="channel-typing-dot"></div>
            <div class="channel-typing-dot"></div>
            <div class="channel-typing-dot"></div>
        `;
        element.appendChild(typingInd);
    }
}

function updateChannelIndicators(element, channel) {
    const channelKey = `${state.serverUrl}:${channel.name}`;
    const hasUnread = state.unreadByChannel[channelKey] > 0;
    const hasPings = state.unreadPings[channel.name] > 0;

    let badge = element.querySelector('.ping-badge');
    let unreadIndicator = element.querySelector('.unread-indicator');
    let typingIndicator = element.querySelector('.channel-typing-indicator');

    if (hasPings) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ping-badge';
            element.appendChild(badge);
        }
        badge.textContent = state.unreadPings[channel.name];
        if (unreadIndicator) unreadIndicator.remove();
    } else if (badge) {
        badge.remove();
        if (hasUnread) {
            if (!unreadIndicator) {
                unreadIndicator = document.createElement('span');
                unreadIndicator.className = 'unread-indicator';
                element.appendChild(unreadIndicator);
            }
        } else if (unreadIndicator) {
            unreadIndicator.remove();
        }
    } else if (hasUnread && !unreadIndicator) {
        unreadIndicator = document.createElement('span');
        unreadIndicator.className = 'unread-indicator';
        element.appendChild(unreadIndicator);
    } else if (!hasUnread && unreadIndicator) {
        unreadIndicator.remove();
    }

    const shouldShow = shouldShowTypingIndicator(channel.name);
    const shouldRemove = shouldRemoveTypingIndicator(channel.name);

    if (shouldShow && !typingIndicator) {
        const typingInd = document.createElement('div');
        typingInd.className = 'channel-typing-indicator';
        typingInd.innerHTML = `
            <div class="channel-typing-dot"></div>
            <div class="channel-typing-dot"></div>
            <div class="channel-typing-dot"></div>
        `;
        element.appendChild(typingInd);
    } else if (shouldRemove && typingIndicator) {
        typingIndicator.remove();
    }
}

function shouldShowTypingIndicator(channelName) {
    const typingMap = state.typingUsers[channelName];
    return typingMap && typingMap.size > 0;
}

function shouldRemoveTypingIndicator(channelName) {
    return !shouldShowTypingIndicator(channelName);
}