const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'ogg', 'avi', 'mkv'];

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/;

/**
 * Check if a URL has one of the specified file extensions
 * @param {string} url - URL to check
 * @param {string[]} extensions - Array of extensions (without dots)
 * @returns {boolean}
 */
function hasExtension(url, extensions) {
    const urlLower = url.toLowerCase();
    return extensions.some(ext =>
        urlLower.endsWith(`.${ext}`) ||
        urlLower.includes(`.${ext}?`) ||
        urlLower.includes(`.${ext}#`)
    );
}

/**
 * Escape HTML special characters
 * @param {string} text - Raw text
 * @returns {string} - Escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Convert a Blob to a data URL
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataURL(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}
