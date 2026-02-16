class VoiceManager {
    constructor() {
        this.peer = null;
        this.currentChannel = null;
        this.connections = new Map(); // user_id -> connection
        this.calls = new Map(); // user_id -> call
        this.localStream = null;
        this.participants = new Map(); // user_id -> {username, peer_id, muted, pfp, speaking}
        this.isMuted = false;
        this.isSpeaking = false;
        this.localAudioElement = null;
        this.speakingDetectors = new Map(); // user_id -> analyzer
        this.localAnalyzer = null;
        this.micThreshold = parseInt(localStorage.getItem('originchats_mic_threshold') || '30', 10);

        this.initPeerJS();
    }

    initPeerJS() {
        try {
            this.peer = new Peer(null, {
                debug: 2
            });

            this.peer.on('open', (id) => {
                console.log('[Voice] My peer ID is:', id);
            });

            this.peer.on('error', (err) => {
                console.error('[Voice] PeerJS error:', err);
            });

            this.peer.on('call', (call) => {
                console.log('[Voice] Incoming call from:', call.peer);
                call.answer(this.localStream);
                this.setupCallHandlers(call, call.peer);
                this.calls.set(call.peer, call);
            });
        } catch (error) {
            console.error('[Voice] Failed to initialize PeerJS:', error);
        }
    }

    async requestMicrophone() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.setupLocalSpeakingDetection();
            return true;
        } catch (error) {
            console.error('[Voice] Failed to get microphone access:', error);
            return false;
        }
    }

    setupLocalSpeakingDetection() {
        try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(this.localStream);
            const analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256;
            source.connect(analyzer);

            this.localAnalyzer = analyzer;

            const dataArray = new Uint8Array(analyzer.frequencyBinCount);

            const checkSpeaking = () => {
                if (!this.localAnalyzer) return;

                analyzer.getByteFrequencyData(dataArray);
                const average = (dataArray.reduce((a, b) => a + b, 0) / dataArray.length) * (100 / 255);

                const isSpeakingNow = average > this.micThreshold;

                if (isSpeakingNow !== this.isSpeaking) {
                    this.isSpeaking = isSpeakingNow;
                    console.log('[Voice] Speaking state changed:', this.isSpeaking, '(average:', average.toFixed(2), ', threshold:', this.micThreshold + ')');

                    // Update channel list to show speaking state
                    if (typeof renderChannels === 'function') {
                        renderChannels();
                    }
                }

                requestAnimationFrame(checkSpeaking);
            };

            checkSpeaking();
        } catch (error) {
            console.error('[Voice] Failed to setup local speaking detection:', error);
        }
    }

    async joinChannel(channelName) {
        if (!this.peer || !this.peer.id) {
            console.error('[Voice] Peer not ready');
            return false;
        }

        if (this.isUserInChannel(channelName)) {
            console.warn('[Voice] Already in this channel (client or server)');
            return false;
        }

        // Leave current channel if in one
        if (this.currentChannel) {
            await this.leaveChannel();
        }

        if (!this.localStream) {
            const hasMic = await this.requestMicrophone();
            if (!hasMic) {
                alert('Microphone access is required for voice channels');
                return false;
            }
        }

        this.currentChannel = channelName;

        // Get participants from channel voice_state
        const channel = state.channels.find(c => c.name === channelName);
        const participants = [];
        if (channel && channel.voice_state) {
            channel.voice_state.forEach(voiceUser => {
                participants.push({
                    id: crypto.randomUUID(),
                    username: voiceUser.username,
                    peer_id: null,
                    muted: voiceUser.muted || false
                });
            });
        }

        wsSend({
            cmd: 'voice_join',
            channel: channelName,
            peer_id: this.peer.id
        }, state.serverUrl);

        console.log('[Voice] Joining channel:', channelName);

        // Show voice panel
        const voicePanel = document.getElementById('voice-panel');
        if (voicePanel) {
            voicePanel.classList.add('active');
        }

        // Update mute button state
        this.updateMuteButton();

        // Update channel list to show you joined
        if (typeof renderChannels === 'function') {
            renderChannels();
        }

        return true;
    }

    async leaveChannel() {
        if (!this.currentChannel) {
            return;
        }

        wsSend({
            cmd: 'voice_leave'
        }, state.serverUrl);

        // Close all calls
        this.calls.forEach((call) => {
            call.close();
        });
        this.calls.clear();

        // Clean up speaking detectors
        this.speakingDetectors.clear();
        this.localAnalyzer = null;
        this.isSpeaking = false;

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.connections.clear();
        this.participants.clear();
        this.currentChannel = null;

        // Remove local audio element
        if (this.localAudioElement) {
            this.localAudioElement.remove();
            this.localAudioElement = null;
        }

        console.log('[Voice] Left voice channel');

        // Hide voice panel
        const voicePanel = document.getElementById('voice-panel');
        if (voicePanel) {
            voicePanel.classList.remove('active');
        }

        // Update channel list to remove your avatar
        if (typeof renderChannels === 'function') {
            renderChannels();
        }
    }

    mute() {
        this.isMuted = true;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }

        this.updateMuteButton();

        wsSend({
            cmd: 'voice_mute'
        }, state.serverUrl);
    }

    unmute() {
        this.isMuted = false;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }

        this.updateMuteButton();

        wsSend({
            cmd: 'voice_unmute'
        }, state.serverUrl);
    }

    toggleMute() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
        return this.isMuted;
    }

    updateMuteButton() {
        const muteBtn = document.getElementById('voice-mute-btn');
        const muteIcon = document.getElementById('voice-mute-icon');
        if (!muteBtn || !muteIcon) return;

        if (this.isMuted) {
            muteBtn.classList.add('muted');
            muteIcon.setAttribute('data-lucide', 'mic-off');
        } else {
            muteBtn.classList.remove('muted');
            muteIcon.setAttribute('data-lucide', 'mic');
        }

        if (window.lucide) {
            window.lucide.createIcons({ root: muteBtn });
        }
    }

    setMicThreshold(threshold) {
        this.micThreshold = Math.max(0, Math.min(100, threshold));
        localStorage.setItem('originchats_mic_threshold', this.micThreshold.toString());
    }

    handleUserJoined(data) {
        const { user, channel } = data;
        console.log('[Voice] User joined:', user.username, 'in channel:', channel);

        this.participants.set(user.username, {
            username: user.username,
            peer_id: user.peer_id,
            muted: user.muted,
            pfp: user.pfp || null,
            speaking: false,
            channel: channel
        });

        const isNotSelf = state.currentUser && user.username !== state.currentUser.username;
        if (channel === this.currentChannel && isNotSelf && user.peer_id) {
            this.connectToPeer(user.peer_id, user.username);
        }

        this.updateVoiceUI();

        if (typeof renderChannels === 'function') {
            renderChannels();
        }
    }

    handleUserLeft(data) {
        const { username, channel } = data;
        console.log('[Voice] User left:', username, 'from channel:', channel);

        const usernameLower = username.toLowerCase();
        let participantKey = null;
        let participant = null;

        for (const [key, value] of this.participants) {
            if (value.username.toLowerCase() === usernameLower) {
                participantKey = key;
                participant = value;
                break;
            }
        }

        if (!participant) {
            console.log('[Voice] Participant not found, using username as fallback');
            participantKey = username;
            participant = { peer_id: username };
        }

        const peerId = participant.peer_id || username;

        this.participants.delete(participantKey);

        const analyzer = this.speakingDetectors.get(peerId);
        if (analyzer) {
            this.speakingDetectors.delete(peerId);
        }

        const call = this.calls.get(peerId);
        if (call) {
            call.close();
            this.calls.delete(peerId);
        }

        const conn = this.connections.get(peerId);
        if (conn) {
            conn.close();
            this.connections.delete(peerId);
        }

        this.updateVoiceUI();

        if (typeof renderChannels === 'function') {
            renderChannels();
        }
    }

    handleUserUpdated(data) {
        const { user, channel } = data;
        console.log('[Voice] User updated:', user.username, 'muted:', user.muted);

        const usernameLower = user.username.toLowerCase();
        let participantKey = null;
        let participant = null;

        for (const [key, value] of this.participants) {
            if (value.username.toLowerCase() === usernameLower) {
                participantKey = key;
                participant = value;
                break;
            }
        }

        if (participant) {
            participant.muted = user.muted;
            if (user.pfp !== undefined) {
                participant.pfp = user.pfp;
            }
            this.participants.set(participantKey, participant);
        }

        const channelData = state.channels.find(c => c.name === channel);
        if (channelData && channelData.voice_state) {
            const voiceUserIndex = channelData.voice_state.findIndex(v => 
                v.username.toLowerCase() === usernameLower
            );
            if (voiceUserIndex !== -1) {
                channelData.voice_state[voiceUserIndex].muted = user.muted;
            }
        }

        this.updateVoiceUI();

        if (typeof renderChannels === 'function') {
            renderChannels();
        }
    }

    async connectToPeer(peerId, username) {
        if (this.connections.has(peerId)) {
            return;
        }

        try {
            const conn = this.peer.connect(peerId);
            this.connections.set(peerId, conn);

            conn.on('open', () => {
                console.log('[Voice] Data connection established with:', username);
            });

            conn.on('error', (err) => {
                console.error('[Voice] Data connection error:', err);
            });

            // Initiate call
            const call = this.peer.call(peerId, this.localStream);
            this.setupCallHandlers(call, peerId, username);
            this.calls.set(peerId, call);

        } catch (error) {
            console.error('[Voice] Failed to connect to peer:', error);
        }
    }

    setupCallHandlers(call, peerId, username) {
        call.on('stream', (remoteStream) => {
            console.log('[Voice] Received stream from:', username || peerId);
            this.addRemoteStream(remoteStream, username || peerId, peerId);
        });

        call.on('close', () => {
            console.log('[Voice] Call closed with:', username || peerId);
            this.removeRemoteStream(peerId);
            this.calls.delete(peerId);
        });

        call.on('error', (err) => {
            console.error('[Voice] Call error:', err);
        });
    }

    addRemoteStream(stream, username, peerId) {
        let audioContainer = document.getElementById('voice-audio-container');
        if (!audioContainer) {
            audioContainer = document.createElement('div');
            audioContainer.id = 'voice-audio-container';
            audioContainer.style.display = 'none';
            document.body.appendChild(audioContainer);
        }

        const audio = document.createElement('audio');
        audio.id = `voice-audio-${peerId}`;
        audio.autoplay = true;
        audio.srcObject = stream;
        audio.style.display = 'none';
        audioContainer.appendChild(audio);

        this.setupSpeakingDetection(stream, username, peerId);

        console.log('[Voice] Audio element added for:', username);
    }

    setupSpeakingDetection(stream, username, peerId) {
        try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256;
            source.connect(analyzer);

            const dataArray = new Uint8Array(analyzer.frequencyBinCount);
            let speakingTimeout = null;

            this.speakingDetectors.set(username, analyzer);

            const checkSpeaking = () => {
                analyzer.getByteFrequencyData(dataArray);
                const average = (dataArray.reduce((a, b) => a + b, 0) / dataArray.length) * (100 / 255);

                const usernameLower = username.toLowerCase();
                let participantKey = null;
                let participant = null;

                for (const [key, value] of this.participants) {
                    if (value.username.toLowerCase() === usernameLower) {
                        participantKey = key;
                        participant = value;
                        break;
                    }
                }

                if (participant) {
                    const isSpeakingNow = average > this.micThreshold;

                    if (isSpeakingNow !== participant.speaking) {
                        participant.speaking = isSpeakingNow;
                        this.participants.set(participantKey, participant);
                        this.updateVoiceUI();

                        if (typeof renderChannels === 'function') {
                            renderChannels();
                        }
                    }
                }

                requestAnimationFrame(checkSpeaking);
            };

            checkSpeaking();
        } catch (error) {
            console.error('[Voice] Failed to setup speaking detection:', error);
        }
    }

    createParticipantElement(username, pfp, muted, isSelf, userId) {
        const div = document.createElement('div');
        div.className = 'voice-participant-card';
        if (isSelf) div.classList.add('voice-self');
        if (userId) {
            const usernameLower = userId.toLowerCase();
            let speaking = false;
            for (const [key, value] of this.participants) {
                if (value.username.toLowerCase() === usernameLower) {
                    speaking = value.speaking;
                    break;
                }
            }
            if (speaking) div.classList.add('speaking');
        }

        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'voice-avatar-container';

        const avatar = document.createElement('div');
        avatar.className = 'voice-avatar';

        const avatarSrc = typeof getAvatarSrc === 'function' ? getAvatarSrc(username) : `https://avatars.rotur.dev/${username}`;
        const img = document.createElement('img');
        img.src = avatarSrc;
        img.alt = username;
        img.className = 'voice-avatar-img';
        img.onerror = () => {
            avatar.textContent = username.charAt(0).toUpperCase();
            img.style.display = 'none';
            avatar.style.display = 'flex';
            avatar.style.alignItems = 'center';
            avatar.style.justifyContent = 'center';
        };
        avatar.appendChild(img);

        const speakingIndicator = document.createElement('div');
        speakingIndicator.className = 'voice-speaking-indicator';
        let speaking = muted;
        if (!muted && userId) {
            const usernameLower = userId.toLowerCase();
            for (const [key, value] of this.participants) {
                if (value.username.toLowerCase() === usernameLower) {
                    speaking = !value.speaking;
                    break;
                }
            }
        }
        if (speaking) {
            speakingIndicator.style.display = 'none';
        }

        avatarContainer.appendChild(avatar);
        avatarContainer.appendChild(speakingIndicator);

        const name = document.createElement('div');
        name.className = 'voice-participant-name';
        name.textContent = isSelf ? `${username} (You)` : username;

        const status = document.createElement('div');
        status.className = 'voice-participant-status';
        status.innerHTML = muted ? '<i data-lucide="mic-off"></i>' : '';

        div.appendChild(avatarContainer);
        div.appendChild(name);
        div.appendChild(status);

        return div;
    }

    removeRemoteStream(peerId) {
        const audio = document.getElementById(`voice-audio-${peerId}`);
        if (audio) {
            audio.remove();
        }
    }

    updateVoiceUI() {

    }

    renderVoiceParticipants() {

    }

    isInChannel() {
        return !!this.currentChannel;
    }

    isUserInChannel(channelName) {
        if (this.currentChannel === channelName) {
            return true;
        }
        const channel = state.channels.find(c => c.name === channelName);
        if (channel && channel.voice_state && state.currentUser) {
            return channel.voice_state.some(v => v.username.toLowerCase() === state.currentUser.username.toLowerCase());
        }
        return false;
    }
}

globalThis.voiceManager = new VoiceManager();