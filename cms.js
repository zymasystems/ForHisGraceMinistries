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
  var recentWindow = 14 * 24 * 60 * 60 * 1000;
  var blogGrid = document.getElementById('blogGrid');
  var legacyPosts = kind === 'blog' && blogGrid ? Array.from(blogGrid.children) : [];
  var transitionTimer;
  if (kind === 'blog') legacyPosts.forEach(function (item) { content.append(item); });
  var embeddedGalleryImages = [
    {url: 'images/Church%20leadership.jpeg', alt: 'For His Grace Ministries leadership'},
    {url: 'images/Senior%20Pastor%20Khumalo.jpeg', alt: 'Senior Pastor Khumalo'},
    {url: 'images/Pastor%20Mofokeng.jpeg', alt: 'Pastor Mofokeng'},
    {url: 'images/Overseer%20Nomsa%20Khumalo%20and%20Senior%20Pastor%20Khumalo.jpeg', alt: 'Church leaders together'},
    {url: 'images/Deacon%20Zuma.png', alt: 'Deacon Zuma'}
  ];
  var featuredImages = embeddedGalleryImages.slice();

  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function setSectionVisible(id, visible) {
    var section = document.getElementById(id);
    if (section) section.hidden = !visible;
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
  function safeImageUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return null;
    var parsed;
    try { parsed = new URL(url.trim(), window.location.href); } catch (_) { return null; }
    if (parsed.protocol !== 'https:' && parsed.origin !== window.location.origin) return null;
    return parsed.href;
  }
  function image(url, alt) {
    var safeUrl = safeImageUrl(url);
    if (!safeUrl) return null;
    var img = element('img', null, 'cms-photo');
    img.src = safeUrl;
    img.alt = alt || '';
    img.loading = 'lazy';
    return img;
  }
  function validImageUrl(url) {
    return !!safeImageUrl(url);
  }
  function imageKey(url) {
    var safeUrl = safeImageUrl(url);
    if (!safeUrl) return null;
    var parsed = new URL(safeUrl);
    return parsed.origin + parsed.pathname;
  }
  async function loadFeaturedImages(signal) {
    try {
      var albums = await fetchPage('gallery/albums', 1, signal);
      if (!Array.isArray(albums.items)) throw new Error('Invalid gallery response');
      var knownImages = new Set(featuredImages.map(function (item) { return imageKey(item.url); }));
      albums.items.forEach(function (albumItem) {
        var key = imageKey(albumItem.coverUrl);
        if (key && !knownImages.has(key)) {
          featuredImages.push({url: safeImageUrl(albumItem.coverUrl), alt: albumItem.title || 'Church gallery'});
          knownImages.add(key);
        }
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.warn('Could not load gallery cover images for content cards.', error);
    }
    return featuredImages;
  }
  function reserveFeaturedImages(items, usedImages) {
    items.forEach(function (item) {
      var key = imageKey(item.featuredImageUrl);
      if (key) usedImages.add(key);
    });
    return usedImages;
  }
  function randomFeaturedImage(usedImages) {
    var available = featuredImages.filter(function (item) {
      return !usedImages.has(imageKey(item.url));
    });
    var choices = available.length ? available : featuredImages;
    var fallback = choices[Math.floor(Math.random() * choices.length)];
    usedImages.add(imageKey(fallback.url));
    return fallback;
  }
  function addFeaturedImageFallbacks(items, usedImages) {
    usedImages = usedImages || new Set();
    reserveFeaturedImages(items, usedImages);
    items.forEach(function (item) {
      if (!validImageUrl(item.featuredImageUrl)) {
        var fallback = randomFeaturedImage(usedImages);
        item.featuredImageUrl = fallback.url;
        item.featuredImageAlt = fallback.alt;
      }
    });
    return usedImages;
  }
  function decorateLegacyPosts(usedImages) {
    usedImages = usedImages || new Set();
    legacyPosts.forEach(function (post) {
      var currentImage = post.querySelector('.post-img img');
      var currentKey = currentImage && imageKey(currentImage.src);
      if (currentKey) usedImages.add(currentKey);
    });
    legacyPosts.forEach(function (post) {
      var frame = post.querySelector('.post-img');
      if (!frame) return;
      var existing = frame.querySelector('img');
      if (!existing) {
        var fallback = randomFeaturedImage(usedImages);
        existing = element('img');
        existing.src = fallback.url;
        existing.alt = fallback.alt;
        existing.loading = 'lazy';
        var placeholder = frame.querySelector('.placeholder');
        if (placeholder) placeholder.remove();
        frame.append(existing);
      }
    });
    return usedImages;
  }
  function date(value) {
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium', timeZone: 'Africa/Johannesburg'
    }).format(d);
  }
  function publishedTime(item) {
    var value = item.publishedAt || item.createdAt || item.uploadedAt || item.published_at || item.created_at;
    var timestamp = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  function isRecent(item, allowMissingTimestamp) {
    var timestamp = publishedTime(item);
    return timestamp == null ? allowMissingTimestamp : Date.now() - timestamp < recentWindow;
  }
  function scheduleArchive(items, rerender) {
    window.clearTimeout(transitionTimer);
    var transitionAt = items.reduce(function (earliest, item) {
      var timestamp = publishedTime(item);
      var candidate = timestamp == null ? Infinity : timestamp + recentWindow;
      return candidate > Date.now() ? Math.min(earliest, candidate) : earliest;
    }, Infinity);
    if (Number.isFinite(transitionAt)) {
      transitionTimer = window.setTimeout(rerender, Math.min(transitionAt - Date.now() + 1, 2147483647));
    }
  }
  function newestFirst(items) {
    return items.slice().sort(function (a, b) {
      return (publishedTime(b) || 0) - (publishedTime(a) || 0);
    });
  }
  function uniqueItems(items) {
    var seen = new Set();
    return items.filter(function (item) {
      var key = item.id || item.slug || item.url ||
        [item.title || '', item.startsAt || item.publishedAt || ''].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function eventTime(value) {
    return new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg'
    }).format(new Date(value)) + ' SAST';
  }
  function card() { return element('article', null, 'cms-card'); }
  function blogCard(item) {
    var node = element('article', null, 'post-card');
    var frame = element('div', null, 'post-img');
    var body = element('div', null, 'post-body');
    var featured = image(item.featuredImageUrl, item.featuredImageAlt || item.title);
    if (featured) frame.append(featured);
    else frame.append(element('div', 'Church gallery', 'placeholder'));
    var tags = element('div', null, 'post-tags');
    if (item.category) tags.append(element('span', item.category, 'chip-tag'));
    var meta = element('div', null, 'post-meta');
    [date(item.publishedAt), item.author].filter(Boolean).forEach(function (value) {
      meta.append(element('span', value));
    });
    var footer = element('div', null, 'post-footer');
    footer.append(meta, link('Read article →', 'blog-post.html?slug=' + encodeURIComponent(item.slug), 'post-read'));
    body.append(tags, element('h2', item.title, 'post-title'),
      element('p', item.excerpt, 'post-excerpt'), footer);
    node.append(frame);
    node.append(body);
    return node;
  }
  function eventCard(item) {
    var node = element('article', null, 'event-card');
    var body = element('div', null, 'event-body');
    var imageFrame = element('div', null, 'event-img');
    var featured = image(item.featuredImageUrl, item.featuredImageAlt || item.title);
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
  function galleryPhoto(item, albumItem, index) {
    var alt = item.altText || item.caption || albumItem.title || 'Church photo';
    var img = image(item.url, alt);
    if (!img) return null;
    var node = element('button', null, 'img g g-' + ((index % 5) + 1) + ' gallery-photo');
    node.type = 'button';
    node.setAttribute('aria-label', 'View photo: ' + alt);
    node.dataset.cat = String(item.category || albumItem.category || 'all').toLowerCase();
    node.dataset.event = albumItem.title || '';
    node.dataset.search = [albumItem.title, item.caption, item.altText, item.category].filter(Boolean).join(' ').toLowerCase();
    node.append(img);
    return node;
  }
  function render(data) {
    content.replaceChildren();
    pagination.replaceChildren();
    if (kind === 'post') {
      addFeaturedImageFallbacks([data]);
      document.getElementById('cmsTitle').textContent = data.title;
      document.getElementById('cmsDescription').textContent = data.excerpt || '';
      document.title = (data.seoTitle || data.title) + ' | For His Grace Ministries';
      document.querySelector('meta[name="description"]').content = data.seoDescription || data.excerpt || '';
      document.querySelector('link[rel="canonical"]').href = window.location.origin + '/blog-post.html?slug=' + encodeURIComponent(slug);
      var articleBody = element('div', null, 'cms-copy');
      if (window.FhgmContent) FhgmContent.render(articleBody, data.content, data.contentFormat); else articleBody.textContent = data.content || '';
      var featured = image(data.featuredImageUrl, data.featuredImageAlt || data.title);
      if (featured) content.append(featured);
      content.append(element('p', [data.author, date(data.publishedAt)].filter(Boolean).join(' · '), 'cms-meta'),
        articleBody, link('← All articles', 'blog.html', 'link-gold'));
      status.textContent = '';
      return;
    }
    if (!Array.isArray(data.items)) throw new Error('Invalid content response');
    if (kind === 'blog') {
      if (!blogGrid) throw new Error('Blog list is unavailable');
      var articles = newestFirst(uniqueItems(data.items));
      var recentArticles = articles.filter(function (item) { return isRecent(item, false); });
      var olderArticles = articles.filter(function (item) { return !isRecent(item, false); });
      var usedImages = reserveFeaturedImages(articles, new Set());
      addFeaturedImageFallbacks(recentArticles, usedImages);
      decorateLegacyPosts(usedImages);
      addFeaturedImageFallbacks(olderArticles, usedImages);
      blogGrid.replaceChildren();
      recentArticles.forEach(function (item) { blogGrid.append(blogCard(item)); });
      olderArticles.forEach(function (item) { content.append(blogCard(item)); });
      legacyPosts.forEach(function (item) { content.append(item); });
      setSectionVisible('blogArchiveSection', !!content.querySelector('.post-card'));
      status.textContent = recentArticles.length ? '' : 'No newly published articles in the last two weeks.';
      scheduleArchive(articles, function () { render({ items: articles }); });
      return;
    }
    if (kind === 'events') {
      var eventItems = newestFirst(uniqueItems(data.items));
      var recentEvents = eventItems.filter(function (item) { return isRecent(item, true); });
      var olderEvents = eventItems.filter(function (item) { return !isRecent(item, true); });
      var usedEventImages = reserveFeaturedImages(eventItems, new Set());
      addFeaturedImageFallbacks(recentEvents, usedEventImages);
      addFeaturedImageFallbacks(olderEvents, usedEventImages);
      var upcoming = document.getElementById('eventsGrid');
      if (!upcoming) throw new Error('Upcoming events list is unavailable');
      upcoming.replaceChildren();
      recentEvents.forEach(function (item) { upcoming.append(eventCard(item)); });
      olderEvents.forEach(function (item) { content.append(eventCard(item)); });
      setSectionVisible('moreEventsSection', olderEvents.length > 0);
      var emptyState = document.getElementById('eventsEmpty');
      if (emptyState) emptyState.hidden = recentEvents.length > 0;
      status.textContent = recentEvents.length ? '' : olderEvents.length
        ? 'No recently published events. See More events below.'
        : '';
      scheduleArchive(eventItems, function () { render({ items: eventItems }); });
      return;
    }
    if (kind === 'gallery' && album) {
      document.getElementById('cmsTitle').textContent = data.title;
      document.getElementById('cmsDescription').textContent = data.description || '';
      pagination.append(link('← All albums', 'gallery.html', 'link-gold'));
    }
    var renderItem = album ? photoCard : albumCard;
    data.items.forEach(function (item) { content.append(renderItem(item)); });
    if (kind === 'gallery') {
      setSectionVisible('albumsSection', data.items.some(function (item) {
        return album ? !!item.url : !!item.slug;
      }));
    }
    status.textContent = data.items.length ? '' : (page > 1 ? 'No content on this page. Return to the first page.' : 'No published content yet. Please check back soon.');
    if (page > 1) pagination.append(link('← Previous', pageLink(page - 1), 'btn btn-outline'), link('First page', pageLink(1), 'link-gold'));
    var size = kind === 'gallery' ? (album ? 24 : 20) : 12;
    if (page * size < data.total) pagination.append(link('Next →', pageLink(page + 1), 'btn btn-outline'));
  }
  async function fetchPage(path, number, signal) {
    var response = await fetch(API + path + '?page=' + number, {
      credentials: 'omit', cache: 'no-store', signal: signal
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('missing');
      throw new Error('unavailable');
    }
    return response.json();
  }
  async function fetchAll(path, signal, pageSize) {
    var result = await fetchPage(path, 1, signal);
    if (!Array.isArray(result.items) || !Number.isFinite(Number(result.total))) {
      throw new Error('Invalid content response');
    }
    var items = result.items.slice();
    var total = Number(result.total);
    var pages = Math.ceil(total / pageSize);
    for (var number = 2; number <= pages && number <= 10000; number += 1) {
      var next = await fetchPage(path, number, signal);
      if (!Array.isArray(next.items) || !next.items.length) throw new Error('Invalid content response');
      items = items.concat(next.items);
    }
    if (items.length < total) throw new Error('Invalid content response');
    result.items = uniqueItems(items).slice(0, total);
    return result;
  }
  async function load() {
    status.textContent = 'Loading content…';
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 60000);
    try {
      if (kind === 'post' && !slug) throw new Error('missing');
      var path = kind === 'post' ? 'blog/' + encodeURIComponent(slug)
        : kind === 'gallery' ? 'gallery/albums' + (album ? '/' + encodeURIComponent(album) : '') : kind;
      if (kind === 'gallery' && !album) {
        var albums = await fetchAll(path, controller.signal, 20);
        var photos = [];
        for (var albumItem of albums.items) {
          if (!albumItem.slug) continue;
          var albumData = await fetchAll(path + '/' + encodeURIComponent(albumItem.slug), controller.signal, 24);
          albumData.items.forEach(function (item) { photos.push({ item: item, album: albumItem }); });
        }
        content.replaceChildren();
        pagination.replaceChildren();
        var publishedAlbums = albums.items.filter(function (item) { return !!item.slug; });
        publishedAlbums.forEach(function (item) {
          content.append(albumCard(item));
        });
        setSectionVisible('albumsSection', publishedAlbums.length > 0);
        var galleryGrid = document.getElementById('galGrid');
        if (!galleryGrid) throw new Error('Gallery photo list is unavailable');
        var dynamicPhotos = document.createDocumentFragment();
        var knownPhotoUrls = new Set(Array.from(galleryGrid.querySelectorAll('img')).map(function (img) {
          return imageKey(img.src);
        }).filter(Boolean));
        photos.forEach(function (photo, index) {
          var key = imageKey(photo.item.url);
          if (!key || knownPhotoUrls.has(key)) return;
          var node = galleryPhoto(photo.item, photo.album, index);
          if (node) {
            knownPhotoUrls.add(key);
            dynamicPhotos.append(node);
          }
        });
        galleryGrid.prepend(dynamicPhotos);
        var gallerySearch = document.getElementById('gallerySearch');
        if (gallerySearch) gallerySearch.dispatchEvent(new Event('input', { bubbles: true }));
        status.textContent = albums.items.length ? '' : 'No published albums yet. Please check back soon.';
        return;
      }
      if (kind === 'post' || kind === 'blog' || kind === 'events') await loadFeaturedImages(controller.signal);
      if (kind === 'blog' || kind === 'events') {
        render(await fetchAll(path, controller.signal, 12));
      } else {
        render(await fetchPage(path, page, controller.signal));
      }
    } catch (error) {
      content.replaceChildren();
      pagination.replaceChildren();
      if (kind === 'blog' && blogGrid) {
        blogGrid.replaceChildren();
        decorateLegacyPosts();
        legacyPosts.forEach(function (item) { content.append(item); });
        setSectionVisible('blogArchiveSection', legacyPosts.length > 0);
      }
      if (kind === 'gallery' && !album) setSectionVisible('albumsSection', true);
      status.textContent = error.message === 'missing' ? 'This content is no longer available.' : 'We could not load church content. Please try again.';
      var retry = element('button', 'Try again', 'btn btn-outline');
      retry.type = 'button';
      retry.addEventListener('click', load);
      pagination.append(retry);
      if (kind === 'post') pagination.append(link('← All articles', 'blog.html'));
      if (kind === 'gallery' && album) pagination.append(link('← All albums', 'gallery.html'));
    } finally { window.clearTimeout(timer); }
  }
  load();
  // Remove events that end while the visitor keeps the page open.
  if (kind === 'events') window.setInterval(function () {
    root.querySelectorAll('[data-ends-at]').forEach(function (node) {
      if (new Date(node.dataset.endsAt).getTime() <= Date.now()) node.remove();
    });
    setSectionVisible('moreEventsSection', !!document.querySelector('#cmsContent .event-card'));
    var emptyState = document.getElementById('eventsEmpty');
    if (emptyState) {
      emptyState.hidden = !!document.querySelector('#eventsGrid .event-card:not([hidden])');
    }
  }, 1000);
})();
