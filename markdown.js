function replaceShortcodes(text) {
    return text.replace(/:[a-z0-9_]+:|/g, match => {
        return shortcodeMap[match] || match;
    });
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

    text = text.replace(/^#{6} (.*)$/gm, "<h6>$1</h6>");
    text = text.replace(/^#{5} (.*)$/gm, "<h5>$1</h5>");
    text = text.replace(/^#{4} (.*)$/gm, "<h4>$1</h4>");
    text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");

    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");

    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");

    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/_(.+?)_/g, "<em>$1</em>");

    text = text.replace(/@([a-zA-Z0-9_]+)/g, (match, user) => {
        return `<span class="mention" data-user="${user}">@${user}</span>`;
    });

    text = text.replace(/#([a-zA-Z0-9_-]+)/g, (match, channelName) => {
        return `<span class="channel-mention" data-channel="${channelName}">#${channelName}</span>`;
    });

    text = text.replace(/(https?:\/\/[^\s\"']+\.[^\s\"']+)/g, (match, url) => {
        embedLinks.push(url);

        if (YOUTUBE_REGEX.test(url)) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        }

        // Check for Tenor GIFs - updated to handle various formats
        if (url.match(/tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i)) {
            return `<a href="${url}" class="tenor-embed" target="_blank" rel="noopener noreferrer">${url}</a>`;
        }

        if (hasExtension(url, VIDEO_EXTENSIONS)) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        }

        if (hasExtension(url, IMAGE_EXTENSIONS)) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="image" class="message-image" data-image-url="${url}"></a>`;
        }

        return `<a href="${url}" class="potential-image" target="_blank" rel="noopener noreferrer" data-image-url="${url}">${url}</a>`;
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
    text = DOMPurify.sanitize(text);
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
