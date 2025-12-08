/**
 * Replace emoji shortcodes with actual emoji characters
 * @param {string} text
 * @returns {string}
 */
function replaceShortcodes(text) {
    return text.replace(/:[a-z0-9_]+:|[:;xX]['()D]|xD|XD/g, match => {
        return shortcodeMap[match] || match;
    });
}

/**
 * Parse markdown text into HTML
 * @param {string} text - Raw text with markdown
 * @param {string[]} embedLinks - Array to collect URLs for embedding
 * @returns {string} - HTML string
 */
function parseMarkdown(text, embedLinks) {
    const codeBlocks = [];

    // Fenced code blocks
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

    // Inline code
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        code = code.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return `<code>${code}</code>`;
    });

    // Headers
    text = text.replace(/^#{6} (.*)$/gm, "<h6>$1</h6>");
    text = text.replace(/^#{5} (.*)$/gm, "<h5>$1</h5>");
    text = text.replace(/^#{4} (.*)$/gm, "<h4>$1</h4>");
    text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");

    // Bold + Italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");

    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");

    // Italic
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/_(.+?)_/g, "<em>$1</em>");

    // Mentions
    text = text.replace(/@([a-zA-Z0-9_]+)/g, (match, user) => {
        return `<span class="mention" data-user="${user}">@${user}</span>`;
    });

    // URLs with embed detection
    text = text.replace(/(https?:\/\/[^\s\"']+\.[^\s\"']+)/g, (match, url) => {
        embedLinks.push(url);

        // YouTube links
        if (YOUTUBE_REGEX.test(url)) {
            return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
        }

        // Video links
        if (hasExtension(url, VIDEO_EXTENSIONS)) {
            return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
        }

        // Image links - render inline
        if (hasExtension(url, IMAGE_EXTENSIONS)) {
            return `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="image" class="message-image" data-image-url="${url}"></a>`;
        }

        // Unknown - mark as potential image for async checking
        return `<a href="${url}" class="potential-image" target="_blank" rel="noopener" data-image-url="${url}">${url}</a>`;
    });

    // Line breaks (not after block elements)
    text = text.replace(/\n(?!<\/?(h[1-6]|pre))/g, "<br>");

    // Restore code blocks
    for (const block of codeBlocks) {
        text = text.replace(block.placeholder, block.html);
    }

    return text;
}

/**
 * Parse a message object into sanitized HTML
 * @param {object} msg - Message object with content property
 * @param {string[]} embedLinks - Array to collect URLs for embedding
 * @returns {string} - Sanitized HTML string
 */
function parseMsg(msg, embedLinks) {
    let text = replaceShortcodes(msg.content);
    text = parseMarkdown(text, embedLinks);
    text = DOMPurify.sanitize(text);
    return text;
}

/**
 * Count total emojis in a message
 * @param {object} msg - Message object
 * @returns {number}
 */
function totalEmojis(msg) {
    let i = 0;
    twemoji.replace(msg.content, function (rawText) {
        i++;
        return rawText;
    });
    return i;
}
