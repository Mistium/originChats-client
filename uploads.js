const DEFAULT_ROTUR_PHOTOS_CONFIG = {
    id: 'roturphotos',
    name: 'roturPhotos',
    enabled: true,
    uploadUrl: 'https://photos.rotur.dev/api/image/upload',
    method: 'POST',
    fileParamName: null,
    headers: [],
    bodyParams: [],
    responseUrlPath: '$.path',
    urlTemplate: 'https://photos.rotur.dev/{id}',
    requiresAuth: true,
    authType: 'session'
};

let mediaServers = [];
let roturPhotosSessionId = null;

function loadMediaServers() {
    const saved = localStorage.getItem('originchats_media_servers');
    if (saved) {
        try {
            mediaServers = JSON.parse(saved);
        } catch (e) {
            mediaServers = [DEFAULT_ROTUR_PHOTOS_CONFIG];
        }
    } else {
        mediaServers = [DEFAULT_ROTUR_PHOTOS_CONFIG];
        saveMediaServers();
    }
}

function saveMediaServers() {
    localStorage.setItem('originchats_media_servers', JSON.stringify(mediaServers));
}

function getEnabledMediaServer() {
    return mediaServers.find(s => s.enabled) || mediaServers[0];
}

function getMediaServerById(id) {
    return mediaServers.find(s => s.id === id);
}

function addMediaServer(config) {
    const index = mediaServers.findIndex(s => s.id === config.id);
    if (config.enabled) {
        mediaServers.forEach(s => s.enabled = false);
    }
    if (index >= 0) {
        mediaServers[index] = { ...mediaServers[index], ...config };
    } else {
        mediaServers.push(config);
    }
    saveMediaServers();
}

function deleteMediaServer(id) {
    const index = mediaServers.findIndex(s => s.id === id);
    if (index >= 0) {
        mediaServers.splice(index, 1);
        if (mediaServers.length === 0) {
            mediaServers = [DEFAULT_ROTUR_PHOTOS_CONFIG];
        }
        saveMediaServers();
    }
}

function setMediaServerEnabled(id, enabled) {
    const server = getMediaServerById(id);
    if (server) {
        if (enabled) {
            mediaServers.forEach(s => s.enabled = false);
        }
        server.enabled = enabled;
        saveMediaServers();
    }
}

async function initRoturPhotosAuth() {
    const token = localStorage.getItem('originchats_token');
    if (!token) {
        console.error('No token found for roturPhotos auth');
        return false;
    }

    try {
        const stateOrWindow = window.state || state;
        if (!stateOrWindow || !stateOrWindow.token) {
            console.error('No state.token available for validator generation');
            return false;
        }

        const validatorKey = 'rotur-photos';
        const validatorUrl = `https://social.rotur.dev/generate_validator?key=${validatorKey}&auth=${stateOrWindow.token}`;
        const validatorResponse = await fetch(validatorUrl);

        if (!validatorResponse.ok) {
            console.error('Failed to generate validator:', validatorResponse.status);
            return false;
        }

        const validatorData = await validatorResponse.json();
        if (!validatorData.validator) {
            console.error('No validator returned from API');
            return false;
        }

        const response = await fetch(`https://photos.rotur.dev/api/auth?v=${validatorData.validator}`);
        if (!response.ok) {
            console.error('Auth request failed:', response.status);
            return false;
        }

        const data = await response.json();
        if (data.ok && data.sessionId) {
            roturPhotosSessionId = data.sessionId;
            return true;
        }

        console.error('Auth response missing sessionId:', data);
        return false;
    } catch (error) {
        console.error('Failed to authenticate with roturPhotos:', error);
        return false;
    }
}

function extractValueByPath(obj, path) {
    const parts = path.replace(/^\$\./, '').split('.');
    let current = obj;

    for (const part of parts) {
        if (current == null) return null;
        current = current[part];
    }

    return current;
}

function buildImageUrl(server, response, file) {
	if (server.responseUrlPath === "$")
		return response.path;
	
    if (!server.urlTemplate) return extractValueByPath(response, server.responseUrlPath);
    if (server.responseUrlPath) {
        const extracted = extractValueByPath(response, server.responseUrlPath);
        if (extracted) {
            return server.urlTemplate.replace(/{id}/g, extracted).replace(/{url}/g, extracted);
        }
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    console.log(state)

    let template = server.urlTemplate
        .replace(/{username}/g, state.currentUser.username)
        .replace(/{name}/g, safeName)
        .replace(/{timestamp}/g, timestamp)
        .replace(/{id}/g, extractValueByPath(response, server.responseUrlPath) || timestamp);

    return template;
}

function uploadImageWithXHR(file, url, headers, fileParamName, bodyParams) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        for (const [key, value] of Object.entries(headers)) {
            xhr.setRequestHeader(key, value);
        }

        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (e) {
					resolve(xhr.responseText);
                }
            } else {
                let errorMessage = 'Upload failed';
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {}
                reject(new Error(`${xhr.status}: ${errorMessage}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload'));
        };

        const reader = new FileReader();
        reader.onload = () => {
			if (fileParamName) {
				const formData = new FormData();
				bodyParams.forEach(param => formData.set(param.key, param.value))

				formData.set(fileParamName, file);
				xhr.send(formData);
			} else {
				xhr.send(reader.result);
			}

        };
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        reader.readAsArrayBuffer(file);
    });
}

async function uploadImage(file, server) {
    const headers = {};

    if (server.headers) {
        server.headers.forEach(h => {
            headers[h.key] = h.value;
        });
    }

    if (server.requiresAuth && server.authType === 'session') {
        const authOk = await initRoturPhotosAuth();
        if (!authOk) {
            throw new Error('Failed to authenticate with media server');
        }
        if (roturPhotosSessionId) {
            headers['sessionId'] = roturPhotosSessionId;
        }
        if (server.apiKey && server.authType === 'apiKey') {
            headers['Authorization'] = server.apiKey;
        }
    } else if (server.authType === 'token' && server.apiKey) {
        headers['Authorization'] = `Bearer ${server.apiKey}`;
    } else if (server.authType === 'apiKey' && server.apiKey) {
        headers['Authorization'] = server.apiKey;
    }

    let uploadUrl = server.uploadUrl;
    if (server.id === 'roturphotos') {
        uploadUrl += '?public=true';
    }
    let data = null;

    data = await uploadImageWithXHR(file, uploadUrl, headers, server.fileParamName, server.bodyParams);

	if (typeof data === "string" && server.responseUrlPath === "$") {
		data = { ok: true, path: data };
	}

    if (!data.ok) {
        throw new Error(data.error || 'Upload failed');
    }

    return buildImageUrl(server, data, file);
}

function generateServerId() {
    return 'server_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

loadMediaServers();

window.mediaServers = mediaServers;
window.getEnabledMediaServer = getEnabledMediaServer;
window.getMediaServerById = getMediaServerById;
window.addMediaServer = addMediaServer;
window.deleteMediaServer = deleteMediaServer;
window.setMediaServerEnabled = setMediaServerEnabled;
window.uploadImage = uploadImage;
window.generateServerId = generateServerId;
window.initRoturPhotosAuth = initRoturPhotosAuth;