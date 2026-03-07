function replaceShortcodes(text) {
    if (!window.shortcodeMap) return text;
    return text.replace(/:[\w-]+:/g, match => {
        const emoji = window.shortcodeMap[match];
        return emoji || match;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttribute(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#x27;");
}

function parseMarkdown(text, embedLinks) {
    const codeBlocks = [];

    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        lang = lang || "plaintext";
        code = code.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const placeholder = `§CODEBLOCK_${codeBlocks.length}§${Math.random().toString(36).substr(2, 9)}§`;
        codeBlocks.push({
            placeholder,
            html: `<pre><code class="language-${lang}">${code}</code></pre>`
        });
        return placeholder;
    });

    text = text.replace(/`([^`]+)`/g, (match, code) => {
        code = code.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return `<code>${code}</code>`;
    });

    text = text.replace(/^#{6} (.*)$/gm, (match, content) => `<h6>${escapeHtml(content)}</h6>`);
    text = text.replace(/^#{5} (.*)$/gm, (match, content) => `<h5>${escapeHtml(content)}</h5>`);
    text = text.replace(/^#{4} (.*)$/gm, (match, content) => `<h4>${escapeHtml(content)}</h4>`);
    text = text.replace(/^### (.*)$/gm, (match, content) => `<h3>${escapeHtml(content)}</h3>`);
    text = text.replace(/^## (.*)$/gm, (match, content) => `<h2>${escapeHtml(content)}</h2>`);
    text = text.replace(/^# (.*)$/gm, (match, content) => `<h1>${escapeHtml(content)}</h1>`);

    text = text.replace(/\*\*\*(.+?)\*\*\*/g, (match, content) => `<strong><em>${escapeHtml(content)}</em></strong>`);
    text = text.replace(/___(.+?)___/g, (match, content) => `<strong><em>${escapeHtml(content)}</em></strong>`);

    text = text.replace(/\*\*(.+?)\*\*/g, (match, content) => `<strong>${escapeHtml(content)}</strong>`);
    text = text.replace(/__(.+?)__/g, (match, content) => `<strong>${escapeHtml(content)}</strong>`);

    text = text.replace(/\*(.+?)\*/g, (match, content) => `<em>${escapeHtml(content)}</em>`);
    text = text.replace(/_(.+?)_/g, (match, content) => `<em>${escapeHtml(content)}</em>`);

    text = text.replace(/@([a-zA-Z0-9_]+)/g, (match, user) => {
        return `<span class="mention" data-user="${escapeAttribute(user)}">@${escapeHtml(user)}</span>`;
    });

    text = text.replace(/#([a-zA-Z0-9_-]+)/g, (match, channelName) => {
        return `<span class="channel-mention" data-channel="${escapeAttribute(channelName)}">#${escapeHtml(channelName)}</span>`;
    });

    text = text.replace(/(https?:\/\/[^\s\"']+\.[^\s\"']+)/g, (match, url) => {
        embedLinks.push(url);
        const safeUrl = escapeAttribute(url);
        const safeDisplayText = escapeHtml(url);

        if (YOUTUBE_REGEX.test(url)) {
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeDisplayText}</a>`;
        }

        if (url.match(/tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i)) {
            return `<a href="${safeUrl}" class="tenor-embed" target="_blank" rel="noopener noreferrer">${safeDisplayText}</a>`;
        }

        if (hasExtension(url, VIDEO_EXTENSIONS)) {
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeDisplayText}</a>`;
        }

        if (hasExtension(url, IMAGE_EXTENSIONS)) {
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer"><img src="${proxyImageUrl(safeUrl)}" alt="image" class="message-image" data-image-url="${safeDisplayText}"></a>`;
        }

        return `<a href="${safeUrl}" class="potential-image" target="_blank" rel="noopener noreferrer" data-image-url="${safeDisplayText}">${safeDisplayText}</a>`;
    });

    text = text.replace(/\n(?!<\/?(h[1-6]|pre))/g, "<br>");

    for (const block of codeBlocks) {
        text = text.replace(block.placeholder, block.html);
    }

    return text;
}

function parseMsg(msg, embedLinks) {
    let text = replaceShortcodes(msg.content);
    text = parseMarkdown(text, embedLinks);
    
    if (typeof DOMPurify === 'undefined' || !DOMPurify.sanitize) {
        console.error('DOMPurify not available - messages may not be sanitized properly');
        return escapeHtml(text);
    }
    
    text = DOMPurify.sanitize(text, {
        ALLOWED_TAGS: ['a', 'span', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'br', 'img'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-user', 'data-channel', 'data-image-url', 'src', 'alt', 'language', 'data-msg-id'],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'title'],
        FORBID_ATTR: ['on*', 'style', 'javascript:', 'data-', 'formaction'],
        SAFE_FOR_JAVASCRIPT: true,
        SANITIZE_DOM: true
    });
    
    return text;
}

function totalEmojis(msg) {
    let i = 0;
    twemoji.replace(msg.content, function (rawText) {
        i++;
        return rawText;
    });
    return i;
}
