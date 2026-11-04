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
    var featured = image(item.featuredImageUrl, item.title); if (featured) node.append(featured);
    body.append(element('p', item.category, 'post-tags'), element('h2', item.title, 'post-title'),
      element('p', item.excerpt, 'post-excerpt'), element('p', [item.author, date(item.publishedAt)].filter(Boolean).join(' · '), 'post-meta'),
      link('Read more →', 'blog-post.html?slug=' + encodeURIComponent(item.slug), 'post-read'));
    node.append(body);
    return node;
  }
  function eventCard(item) {
    var node = element('article', null, 'event-card');
    var body = element('div', null, 'event-body');
    var imageFrame = element('div', null, 'event-img');
    var featured = image(item.featuredImageUrl, item.title);
    if (featured) imageFrame.append(featured);
    else imageFrame.append(element('div', 'Event photo', 'placeholder'));
    var eventDate = element('div', null, 'event-date');
    var parsedStart = new Date(item.startsAt);
    if (!Number.isNaN(parsedStart.getTime())) {
      eventDate.append(
        element('span', new Intl.DateTimeFormat('en-ZA', {
          day: '2-digit', timeZone: 'Africa/Johannesburg'
        }).format(parsedStart), 'day'),
        element('span', new Intl.DateTimeFormat('en-ZA', {
          month: 'short', timeZone: 'Africa/Johannesburg'
        }).format(parsedStart), 'mar')
      );
    }
    imageFrame.append(eventDate);
    node.append(imageFrame);
    node.dataset.endsAt = item.endsAt;
    node.dataset.cat = String(item.category || '').toLowerCase();
    var metadata = element('div', null, 'event-meta');
    metadata.append(
      element('span', eventTime(item.startsAt) + ' – ' + eventTime(item.endsAt)),
      element('span', item.location)
    );
    body.append(
      element('h2', item.title, 'event-title'),
      metadata,
      element('p', item.description, 'event-excerpt cms-copy')
    );
    var actions = element('div', null, 'event-actions');
    var details = element('button', 'View event', 'btn btn-primary');
    details.type = 'button';
    details.setAttribute('data-event-open', '');
    actions.append(details);
    var calendar = element('button', 'Add to calendar', 'btn btn-outline'); calendar.type = 'button';
    calendar.addEventListener('click', function () { downloadCalendar(item); });
    actions.append(calendar);
    body.append(actions);
    node.append(body);
    return node;
  }
  function downloadCalendar(item) {
    function escape(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
    function stamp(value) { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FHGM//Church Events//EN', 'BEGIN:VEVENT',
      'UID:' + escape(item.slug) + '@hisgraceministries.co.za', 'DTSTAMP:' + stamp(new Date()),
      'DTSTART:' + stamp(item.startsAt), 'DTEND:' + stamp(item.endsAt), 'SUMMARY:' + escape(item.title),
      'DESCRIPTION:' + escape(item.description), 'LOCATION:' + escape(item.location), 'END:VEVENT', 'END:VCALENDAR'];
    // Fold by UTF-8 octets, without splitting multibyte characters (RFC 5545).
    var encoder = new TextEncoder();
    var folded = lines.map(function (line) {
      var parts = [], part = '', size = 0;
      for (var char of line) {
        var length = encoder.encode(char).length;
        if (size + length > 73) { parts.push(part); part = ' '; size = 1; }
        part += char; size += length;
      }
      parts.push(part); return parts.join('\r\n');
    }).join('\r\n') + '\r\n';
    var url = URL.createObjectURL(new Blob([folded], {type:'text/calendar;charset=utf-8'}));
    var a = link('', url); a.download = 'church-event.ics'; document.body.append(a); a.click(); a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
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
      var articleBody = element('div', null, 'cms-copy');
      if (window.FhgmContent) FhgmContent.render(articleBody, data.content, data.contentFormat); else articleBody.textContent = data.content || '';
      var featured = image(data.featuredImageUrl, data.title); if (featured) content.append(featured);
      content.append(element('p', [data.author, date(data.publishedAt)].filter(Boolean).join(' · '), 'cms-meta'),
        articleBody, link('← All articles', 'blog.html', 'link-gold'));
      status.textContent = '';
      return;
    }
    if (!Array.isArray(data.items)) throw new Error('Invalid content response');
    if (kind === 'events') {
      var emptyState = document.getElementById('eventsEmpty');
      if (emptyState) emptyState.hidden = data.items.length > 0;
    }
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
    var emptyState = document.getElementById('eventsEmpty');
    if (emptyState) {
      emptyState.hidden = !!document.querySelector(
        '#eventsGrid .event-card:not([hidden]), #cmsContent .event-card'
      );
    }
  }, 1000);
})();
