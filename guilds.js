function renderGuildSidebar() {
  const guildList = document.getElementById('guild-list');
  const homeGuild = guildList.querySelector('.home-guild');
  guildList.innerHTML = '';

  const addGuildSeparator = () => {
    const div = document.createElement('div');
    div.className = 'guild-divider';
    guildList.appendChild(div);
  };

  if (homeGuild) {
    homeGuild.classList.toggle('active', state.serverUrl === 'dms.mistium.com');

    const homeIcon = homeGuild.querySelector('.guild-icon');
    const dmConn = wsConnections['dms.mistium.com'];

    homeGuild.classList.remove('server-error', 'server-disconnected', 'server-connecting');

    if (dmConn && dmConn.status === 'error') {
      homeGuild.classList.add('server-disconnected');
    } else if (dmConn && dmConn.status === 'connecting') {
      homeGuild.classList.add('server-connecting');
      homeIcon.style.position = 'relative';
    }

    const existingPing = homeGuild.querySelector('.guild-ping');
    const existingUnreadDot = homeGuild.querySelector('.guild-unread-dot');
    const hasUnread = state.unreadCountsByServer['dms.mistium.com'] > 0 || (typeof hasServerUnread === 'function' && hasServerUnread('dms.mistium.com'));

    if (hasUnread && !existingUnreadDot) {
      const unreadDot = document.createElement('div');
      unreadDot.className = 'guild-unread-dot';
      homeIcon.style.position = 'relative';
      homeGuild.appendChild(unreadDot);
    } else if (!hasUnread && existingUnreadDot) {
      existingUnreadDot.remove();
    }

    if (state.serverPingsByServer['dms.mistium.com'] > 0) {
      if (!existingPing) {
        const pingIcon = document.createElement('div');
        pingIcon.className = 'guild-ping';
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
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      icon.appendChild(img);

      const pill = document.createElement('div');
      pill.className = 'guild-pill';
      const channelKey = `dms.mistium.com:${dmServer.channel}`;
      const channels = state.channelsByServer['dms.mistium.com'] || [];
      const dmChannel = channels.find(c => c.name === dmServer.channel);
      const hasTimestampUnread = dmChannel && typeof isChannelUnread === 'function' && isChannelUnread(dmChannel, 'dms.mistium.com');
      const hasUnread = state.unreadByChannel[channelKey] > 0 || hasTimestampUnread;

      if (hasUnread) {
        const unreadDot = document.createElement('div');
        unreadDot.className = 'guild-unread-dot';
        icon.style.position = 'relative';
        item.appendChild(unreadDot);
      }

      item.appendChild(icon);
      item.appendChild(pill);

      item.onclick = () => {
        state.dmServers = state.dmServers.filter(dm => dm.channel !== dmServer.channel);
        localStorage.setItem('originchats_dm_servers', JSON.stringify(state.dmServers));
        renderGuildSidebar();
        if (state.serverUrl !== 'dms.mistium.com') switchServer('dms.mistium.com');
        setTimeout(() => {
          const channels = state.channelsByServer['dms.mistium.com'] || [];
          const channel = channels.find(c => c.name === dmServer.channel);
          if (channel) {
            selectChannel(channel);
          } else {
            state.pendingMessageFetchesByChannel[`dms.mistium.com:${dmServer.channel}`] = true;
            wsSend({ cmd: 'messages_get', channel: dmServer.channel }, 'dms.mistium.com');
            const tempChannel = { name: dmServer.channel, display_name: dmServer.name, type: 'text', icon: `https://avatars.rotur.dev/${dmServer.username}` };
            if (!state.channelsByServer['dms.mistium.com']) state.channelsByServer['dms.mistium.com'] = [];
            if (!state.channelsByServer['dms.mistium.com'].find(c => c.name === dmServer.channel)) {
              state.channelsByServer['dms.mistium.com'].push(tempChannel);
            }
            selectChannel(tempChannel);
          }
        }, 100);
      };

      item.addEventListener('contextmenu', (e) => { e.preventDefault(); if (typeof showDMContextMenu === 'function') showDMContextMenu(e, dmServer); });
      guildList.appendChild(item);
    });
  }

  addGuildSeparator();

  state.servers.forEach((server, index) => {
    const item = document.createElement('div');
    item.className = 'guild-item';
    if (server.url === state.serverUrl) item.classList.add('active');
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
      initials.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff;';
      icon.appendChild(initials);
    }

    const conn = wsConnections[server.url];
    if (conn && conn.status === 'error') {
      item.classList.add('server-disconnected');
      item.title = `${server.name} (Not responding - click to reconnect)`;
    } else if (conn && conn.status === 'connecting') {
      item.classList.add('server-connecting');
      item.title = `${server.name} (Connecting...)`;
      icon.style.position = 'relative';
    } else {
      item.title = server.name;
    }

    const pill = document.createElement('div');
    pill.className = 'guild-pill';
    const hasUnread = state.unreadCountsByServer[server.url] > 0 || (typeof hasServerUnread === 'function' && hasServerUnread(server.url));

    item.appendChild(icon);
    item.appendChild(pill);

    if (hasUnread) {
      const unreadDot = document.createElement('div');
      unreadDot.className = 'guild-unread-dot';
      icon.style.position = 'relative';
      item.appendChild(unreadDot);
    }

    if (state.serverPingsByServer[server.url] > 0) {
      const pingIcon = document.createElement('div');
      pingIcon.className = 'guild-ping';
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
      document.querySelectorAll('.guild-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedUrl = e.dataTransfer.getData('text/plain');
      if (draggedUrl !== server.url) reorderServers(draggedUrl, server.url);
      item.classList.remove('drag-over');
    });
    item.onclick = (e) => { if (e.detail !== 0 && !e.type.includes('drag')) handleServerClick(server.url); };
    item.addEventListener('contextmenu', (e) => { e.preventDefault(); showGuildContextMenu(e, server); });

    guildList.appendChild(item);
  });

  addGuildSeparator();

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

async function reorderServers(draggedUrl, targetUrl) {
  const draggedIndex = state.servers.findIndex(s => s.url === draggedUrl);
  const targetIndex = state.servers.findIndex(s => s.url === targetUrl);
  if (draggedIndex === -1 || targetIndex === -1) return;
  const [draggedServer] = state.servers.splice(draggedIndex, 1);
  state.servers.splice(targetIndex, 0, draggedServer);
  await saveServers();
  renderGuildSidebar();
}

function showGuildContextMenu(event, server) {
  contextMenu(event)
    .item('Mark as Read', () => markServerAsRead(server.url), 'check-circle')
    .sep()
    .item('Copy URL', () => navigator.clipboard.writeText(server.url), 'copy')
    .danger('Leave Server', () => leaveServer(server.url), 'log-out')
    .show();
}

async function leaveServer(url) {
  if (!confirm('Leave this server?')) return;
  wsSend({ cmd: 'leave' }, url);
  state.servers = state.servers.filter(s => s.url !== url);
  await saveServers();

  closeWebSocket(url);

  delete state.channelsByServer[url];
  delete state.messagesByServer[url];
  delete state.pingsByServer[url];
  delete state.usersByServer[url];
  delete state.currentUserByServer[url];

  if (state.serverUrl === url) {
    if (state.servers.length > 0) {
      switchServer(state.servers[0].url);
    } else {
      Object.keys(wsConnections).forEach(key => closeWebSocket(key));
    }
  }
  renderGuildSidebar();
}

function markServerAsRead(serverUrl) {
  const channels = state.channelsByServer[serverUrl];
  if (!channels) return;

  if (!state.readTimesByServer[serverUrl]) {
    state.readTimesByServer[serverUrl] = {};
  }

  channels.forEach(channel => {
    if (channel.last_message) {
      state.readTimesByServer[serverUrl][channel.name] = channel.last_message;
    }
  });

  state.unreadCountsByServer[serverUrl] = 0;

  Object.keys(state.unreadReplies).forEach(key => {
    if (key.startsWith(`${serverUrl}:`)) delete state.unreadReplies[key];
  });
  Object.keys(state.unreadPings).forEach(key => {
    if (key.startsWith(`${serverUrl}:`)) delete state.unreadPings[key];
  });
  Object.keys(state.unreadByChannel).forEach(key => {
    if (key.startsWith(`${serverUrl}:`)) delete state.unreadByChannel[key];
  });

  saveReadTimes();
  renderGuildSidebar();
  if (state.serverUrl === serverUrl) {
    renderChannels();
  }
}

async function handleServerClick(url) {
  const conn = wsConnections[url];
  const previousUrl = state.serverUrl;

  if (!conn || conn.status === 'error') {
    const connectingItem = document.querySelector(`.guild-item[data-url="${url}"]`);
    if (connectingItem) {
      connectingItem.classList.remove('server-disconnected');
      connectingItem.classList.add('server-connecting');
    }

    connectToServer(url);

    const startTime = Date.now();
    const timeout = 5000;
    let connected = false;

    while (Date.now() - startTime < timeout) {
      const c = wsConnections[url];
      if (c && c.status === 'connected') {
        connected = true;
        break;
      }
      if (c && c.status === 'error') {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (connected) {
      switchServer(url);
    } else {
      state.serverUrl = previousUrl;
      renderGuildSidebar();
      showError('Failed to connect to server');
    }
  } else {
    switchServer(url);
  }
}

async function showHome() {
  if (state.serverUrl === 'dms.mistium.com') return;

  const conn = wsConnections['dms.mistium.com'];
  if (!conn || conn.status === 'error') {
    const homeGuild = document.querySelector('.home-guild');
    if (homeGuild) {
      homeGuild.classList.remove('server-disconnected');
      homeGuild.classList.add('server-connecting');
    }

    connectToServer('dms.mistium.com');

    const startTime = Date.now();
    const timeout = 5000;
    let connected = false;

    while (Date.now() - startTime < timeout) {
      const c = wsConnections['dms.mistium.com'];
      if (c && c.status === 'connected') {
        connected = true;
        break;
      }
      if (c && c.status === 'error') {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (connected) {
      switchServer('dms.mistium.com');
    } else {
      renderGuildSidebar();
      showError('Failed to connect to Direct Messages');
    }
  } else {
    switchServer('dms.mistium.com');
  }
}

function createGuildItem(options) {
  const { 
    className = 'guild-item',
    active = false,
    url,
    channel,
    icon,
    name,
    onClick,
    onContextMenu,
    draggable = false,
    data = {}
  } = options;

  const item = document.createElement('div');
  item.className = className;
  if (active) item.classList.add('active');
  
  if (url) item.dataset.url = url;
  if (channel) item.dataset.channel = channel;
  Object.entries(data).forEach(([key, value]) => item.dataset[key] = value);
  
  item.draggable = draggable;
  item.title = name || '';

  const iconEl = document.createElement('div');
  iconEl.className = 'guild-icon';

  if (icon) {
    if (typeof icon === 'string' && icon.startsWith('http')) {
      const img = document.createElement('img');
      img.src = icon;
      img.alt = name || '';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      iconEl.appendChild(img);
    } else if (typeof icon === 'string') {
      iconEl.innerHTML = icon;
    } else {
      iconEl.appendChild(icon);
    }
  } else if (name) {
    const initials = document.createElement('span');
    initials.textContent = name.substring(0, 2).toUpperCase();
    initials.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff;';
    iconEl.appendChild(initials);
  }

  const pill = document.createElement('div');
  pill.className = 'guild-pill';

  item.appendChild(iconEl);
  item.appendChild(pill);

  if (onClick) item.onclick = onClick;
  if (onContextMenu) item.addEventListener('contextmenu', (e) => { e.preventDefault(); onContextMenu(e); });

  return item;
}

function addUnreadDot(item) {
  const icon = item.querySelector('.guild-icon');
  if (icon) icon.style.position = 'relative';
  
  if (!item.querySelector('.guild-unread-dot')) {
    const dot = document.createElement('div');
    dot.className = 'guild-unread-dot';
    item.appendChild(dot);
  }
}

function addPingIndicator(item) {
  const icon = item.querySelector('.guild-icon');
  if (icon) icon.style.position = 'relative';
  
  if (!item.querySelector('.guild-ping')) {
    const ping = document.createElement('div');
    ping.className = 'guild-ping';
    item.appendChild(ping);
  }
}

function setConnectionStatus(item, status) {
  item.classList.remove('server-error', 'server-disconnected', 'server-connecting');
  
  if (status === 'error' || status === 'disconnected') {
    item.classList.add('server-disconnected');
  } else if (status === 'connecting') {
    item.classList.add('server-connecting');
  }
}

function renderServerList(container, servers, options = {}) {
  const {
    showHome = true,
    showAddButton = true,
    showDiscoverButton = true,
    showSeparators = true,
    onServerClick,
    onServerContextMenu,
    onAddClick,
    onDiscoverClick
  } = options;

  container.innerHTML = '';

  if (showHome) {
    const homeGuild = container.querySelector('.home-guild');
    if (homeGuild) {
      homeGuild.classList.toggle('active', state.serverUrl === 'dms.mistium.com');
      container.appendChild(homeGuild);
    }
  }

  if (showSeparators) {
    const separator = document.createElement('div');
    separator.className = 'guild-divider';
    container.appendChild(separator);
  }

  servers.forEach((server, index) => {
    const item = createGuildItem({
      url: server.url,
      name: server.name,
      icon: server.icon,
      active: server.url === state.serverUrl,
      draggable: true,
      data: { index },
      onClick: (e) => {
        if (e.detail !== 0 && !e.type.includes('drag')) {
          if (onServerClick) onServerClick(server.url);
          else handleServerClick(server.url);
        }
      },
      onContextMenu: (e) => {
        if (onServerContextMenu) onServerContextMenu(e, server);
        else showGuildContextMenu(e, server);
      }
    });

    const conn = wsConnections[server.url];
    if (conn) {
      setConnectionStatus(item, conn.status);
    }

    const hasUnread = state.unreadCountsByServer[server.url] > 0 || 
      (typeof hasServerUnread === 'function' && hasServerUnread(server.url));
    if (hasUnread) addUnreadDot(item);
    if (state.serverPingsByServer[server.url] > 0) addPingIndicator(item);

    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', server.url);
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.guild-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedUrl = e.dataTransfer.getData('text/plain');
      if (draggedUrl !== server.url) reorderServers(draggedUrl, server.url);
      item.classList.remove('drag-over');
    });

    container.appendChild(item);
  });

  if (showSeparators) {
    const separator = document.createElement('div');
    separator.className = 'guild-divider';
    container.appendChild(separator);
  }

  if (showAddButton) {
    const addBtn = createGuildItem({
      className: 'guild-item add-guild',
      name: 'Add a Server',
      icon: '<i data-lucide="plus"></i>',
      onClick: onAddClick || addNewServer
    });
    container.appendChild(addBtn);
  }

  if (showDiscoverButton) {
    const discoverBtn = createGuildItem({
      className: 'guild-item discover-guild',
      name: 'Discover Servers',
      icon: '<i data-lucide="compass"></i>',
      onClick: onDiscoverClick || openDiscoveryModal
    });
    container.appendChild(discoverBtn);
  }

  if (window.lucide) window.lucide.createIcons({ root: container });
}

window.renderGuildSidebar = renderGuildSidebar;
window.reorderServers = reorderServers;
window.showGuildContextMenu = showGuildContextMenu;
window.leaveServer = leaveServer;
window.markServerAsRead = markServerAsRead;
window.handleServerClick = handleServerClick;
window.showHome = showHome;
window.createGuildItem = createGuildItem;
window.addUnreadDot = addUnreadDot;
window.addPingIndicator = addPingIndicator;
window.setConnectionStatus = setConnectionStatus;
window.renderServerList = renderServerList;
