/* Deliberately small Markdown subset. Never interprets raw HTML or image markup. */
(function () {
  'use strict';
  function withoutDuplicateTitle(text, title) {
    if (typeof text !== 'string' || typeof title !== 'string' || !title.trim()) return text;
    const lines = text.split(/\r?\n/);
    const firstLine = lines.findIndex(line => line.trim());
    if (firstLine === -1) return text;
    const heading = /^#{1,6}\s+(.+)$/.exec(lines[firstLine].trim());
    const candidate = (heading ? heading[1] : lines[firstLine])
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
      .replace(/\*(.+?)\*|_(.+?)_/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
      .trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (candidate !== title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()) return text;
    lines.splice(firstLine, 1);
    while (lines.length && !lines[0].trim()) lines.shift();
    return lines.join('\n');
  }
  function inline(parent, text) {
    const pattern = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\))/g;
    let match, start = 0;
    while ((match = pattern.exec(text))) {
      parent.append(document.createTextNode(text.slice(start, match.index)));
      let node;
      if (match[2]) { node = document.createElement('strong'); node.textContent = match[2]; }
      else if (match[3]) { node = document.createElement('em'); node.textContent = match[3]; }
      else { node = document.createElement('a'); node.textContent = match[4]; node.href = match[5]; node.rel = 'noopener noreferrer'; }
      parent.append(node); start = pattern.lastIndex;
    }
    parent.append(document.createTextNode(text.slice(start)));
  }
  function render(root, text, format, title) {
    root.replaceChildren();
    text = withoutDuplicateTitle(text || '', title);
    const formatName = typeof format === 'string' ? format.trim().toLowerCase() : '';
    if (formatName !== 'markdown' && formatName !== 'formatted text (markdown)') {
      root.textContent = text || '';
      return;
    }
    let list = null;
    for (const line of (text || '').split(/\r?\n/)) {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line), bullet = /^[-*]\s+(.+)$/.exec(line);
      if (bullet) {
        if (!list) { list = document.createElement('ul'); root.append(list); }
        const item = document.createElement('li'); inline(item, bullet[1]); list.append(item); continue;
      }
      list = null;
      if (!line.trim()) continue;
      const node = document.createElement(heading ? 'h' + (heading[1].length + 1) : 'p');
      inline(node, heading ? heading[2] : line); root.append(node);
    }
  }
  window.FhgmContent = { render };
})();
