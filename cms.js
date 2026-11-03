(function () {
  'use strict';
  var root = document.querySelector('[data-cms]');
  if (!root) return;
  var API = 'https://admin.hisgraceministries.co.za/api/public/';
  var content = document.getElementById('cmsContent');
  var status = document.getElementById('cmsStatus');
  var pagination = document.getElementById('cmsPagination');
  var params = new URLSearchParams(window.location.search);
  var page = Math.min(10000, Math.max(1, Number(params.get('page')) || 1));
  page = Math.floor(page);
  var kind = root.dataset.cms;
  var album = params.get('album');
  var slug = params.get('slug');

  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function link(text, href, className) {
    var node = element('a', text, className);
    node.href = href;
    return node;
  }
  function pageLink(number) {
    var query = new URLSearchParams(window.location.search);
    query.set('page', number);
    return '?' + query.toString();
  }
  function image(url, alt) {
    var parsed;
    try { parsed = new URL(url); } catch (_) { return null; }
    if (parsed.protocol !== 'https:') return null;
    var img = element('img', null, 'cms-photo');
    img.src = parsed.href;
    img.alt = alt || '';
    img.loading = 'lazy';
    return img;
  }
  function date(value) {
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium', timeZone: 'Africa/Johannesburg'
    }).format(d);
  }
  function eventTime(value) {
    return new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg'
    }).format(new Date(value)) + ' SAST';
  }
  function card() { return element('article', null, 'cms-card'); }
  function blogCard(item) {
    var node = element('article', null, 'post-card');
    var body = element('div', null, 'post-body');
    body.append(element('p', item.category, 'post-tags'), element('h2', item.title, 'post-title'),
      element('p', item.excerpt, 'post-excerpt'), element('p', [item.author, date(item.publishedAt)].filter(Boolean).join(' · '), 'post-meta'),
      link('Read more →', 'blog-post.html?slug=' + encodeURIComponent(item.slug), 'post-read'));
    node.append(body);
    return node;
  }
  function eventCard(item) {
    var node = element('article', null, 'event-card');
    var body = element('div', null, 'event-body');
    node.dataset.endsAt = item.endsAt;
    body.append(element('h2', item.title, 'event-title'), element('p', eventTime(item.startsAt) + ' – ' + eventTime(item.endsAt), 'event-meta'),
      element('p', item.location, 'event-meta'), element('p', item.description, 'event-excerpt cms-copy'));
    node.append(body);
    return node;
  }
  function albumCard(item) {
    var node = link('', 'gallery.html?album=' + encodeURIComponent(item.slug), 'cms-card cms-album');
    var cover = image(item.coverUrl, item.title);
    if (cover) node.append(cover);
    node.append(element('h2', item.title), element('p', item.description), element('p', item.imageCount + ' photos', 'cms-meta'));
    return node;
  }
  function photoCard(item) {
    var node = element('figure', null, 'cms-card');
    var img = image(item.url, item.altText);
    if (img) {
      var full = link('', img.src);
      full.target = '_blank';
      full.rel = 'noopener noreferrer';
      full.setAttribute('aria-label', 'Open full photo: ' + (item.altText || item.caption || 'Church photo'));
      full.append(img);
      node.append(full);
    }
    if (item.caption) node.append(element('figcaption', item.caption));
    return node;
  }
  function render(data) {
    content.replaceChildren();
    pagination.replaceChildren();
    if (kind === 'post') {
      document.getElementById('cmsTitle').textContent = data.title;
      document.getElementById('cmsDescription').textContent = data.excerpt || '';
      document.title = (data.seoTitle || data.title) + ' | For His Grace Ministries';
      document.querySelector('meta[name="description"]').content = data.seoDescription || data.excerpt || '';
      document.querySelector('link[rel="canonical"]').href = window.location.origin + '/blog-post.html?slug=' + encodeURIComponent(slug);
      content.append(element('p', [data.author, date(data.publishedAt)].filter(Boolean).join(' · '), 'cms-meta'),
        element('div', data.content, 'cms-copy'), link('← All articles', 'blog.html', 'link-gold'));
      status.textContent = '';
      return;
    }
    if (!Array.isArray(data.items)) throw new Error('Invalid content response');
    if (kind === 'gallery' && album) {
      document.getElementById('cmsTitle').textContent = data.title;
      document.getElementById('cmsDescription').textContent = data.description || '';
      pagination.append(link('← All albums', 'gallery.html', 'link-gold'));
    }
    var renderItem = kind === 'blog' ? blogCard : kind === 'events' ? eventCard : album ? photoCard : albumCard;
    data.items.forEach(function (item) { content.append(renderItem(item)); });
    status.textContent = data.items.length ? '' : (page > 1 ? 'No content on this page. Return to the first page.' : 'No published content yet. Please check back soon.');
    if (page > 1) pagination.append(link('← Previous', pageLink(page - 1), 'btn btn-outline'), link('First page', pageLink(1), 'link-gold'));
    var size = kind === 'gallery' ? (album ? 24 : 20) : 12;
    if (page * size < data.total) pagination.append(link('Next →', pageLink(page + 1), 'btn btn-outline'));
  }
  async function load() {
    status.textContent = 'Loading content…';
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 15000);
    try {
      if (kind === 'post' && !slug) throw new Error('missing');
      var path = kind === 'post' ? 'blog/' + encodeURIComponent(slug)
        : kind === 'gallery' ? 'gallery/albums' + (album ? '/' + encodeURIComponent(album) : '') : kind;
      var response = await fetch(API + path + '?page=' + page, {
        credentials: 'omit', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error('missing');
        throw new Error('unavailable');
      }
      render(await response.json());
    } catch (error) {
      content.replaceChildren();
      pagination.replaceChildren();
      status.textContent = error.message === 'missing' ? 'This content is no longer available.' : 'We could not load church content. Please try again.';
      var retry = element('button', 'Try again', 'btn btn-outline');
      retry.type = 'button';
      retry.addEventListener('click', load);
      pagination.append(retry);
      if (kind === 'post') pagination.append(link('← All articles', 'blog.html'));
      if (kind === 'gallery' && album) pagination.append(link('← All albums', 'gallery.html'));
    } finally { window.clearTimeout(timer); }
  }
  var preview = document.getElementById('existingPostPreview');
  if (preview) {
    document.querySelectorAll('[data-existing-post]').forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        var post = trigger.closest('.post-card');
        document.getElementById('existingPostTitle').textContent = post.querySelector('.post-title').textContent;
        document.getElementById('existingPostExcerpt').textContent = post.querySelector('.post-excerpt').textContent;
        preview.showModal();
      });
    });
    document.getElementById('existingPostClose').addEventListener('click', function () { preview.close(); });
  }
  load();
  // Remove events that end while the visitor keeps the page open.
  if (kind === 'events') window.setInterval(function () {
    content.querySelectorAll('[data-ends-at]').forEach(function (node) {
      if (new Date(node.dataset.endsAt).getTime() <= Date.now()) node.remove();
    });
  }, 1000);
})();
