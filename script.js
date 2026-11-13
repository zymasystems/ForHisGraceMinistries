(function () {
  'use strict';

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');

    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (link.target && link.target !== '_self') ||
      link.hasAttribute('download')
    ) {
      return;
    }

    var destination = new URL(link.href, window.location.href);

    if (
      destination.origin !== window.location.origin ||
      (destination.pathname === window.location.pathname &&
        destination.search === window.location.search)
    ) {
      return;
    }

    event.preventDefault();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.location.assign(destination.href);
      return;
    }

    document.body.classList.add('is-leaving');

    var navigating = false;
    var fallbackTimer;
    function navigate() {
      if (navigating) return;

      navigating = true;
      window.clearTimeout(fallbackTimer);
      window.location.assign(destination.href);
    }

    document.body.addEventListener('animationend', function (animationEvent) {
      if (
        animationEvent.target === document.body &&
        animationEvent.animationName === 'page-exit'
      ) {
        navigate();
      }
    });
    fallbackTimer = window.setTimeout(navigate, 450);
  });

  var nav = document.getElementById('nav');
  var menuBtn = document.getElementById('menuBtn');

  if (nav && menuBtn) {
    function setMenu(open) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    menuBtn.addEventListener('click', function () {
      setMenu(!nav.classList.contains('open'));
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        setMenu(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setMenu(false);
      }
    });

    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    var pageName = currentPage === 'index.html'
      ? 'home'
      : currentPage.replace('.html', '');

    nav.querySelectorAll('a[data-page]').forEach(function (link) {
      var active = link.dataset.page === pageName;
      link.classList.toggle('active', active);

      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function markMissing(img) {
    var box = img.closest('.img');

    if (box) {
      box.classList.add('missing');
    }
  }

  document.querySelectorAll('.img img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) {
      markMissing(img);
    }

    img.addEventListener('error', function () {
      markMissing(img);
    });
  });

  function wireFilter(chipsId, gridId, searchId, statusId) {
    var chips = document.getElementById(chipsId);
    var grid = document.getElementById(gridId);

    if (!chips || !grid) return;

    var search = document.getElementById(searchId);
    var status = document.getElementById(statusId);
    var loadMore = document.getElementById('galleryLoadMore');
    var category = 'all';
    var visibleLimit = 10;

    function applyFilters() {
      var query = search ? search.value.trim().toLowerCase() : '';
      var matching = [];

      grid.querySelectorAll('[data-cat]').forEach(function (item) {
        var image = item.querySelector('img');
        var searchableText = [
          item.dataset.event,
          item.dataset.search,
          item.dataset.cat,
          image ? image.alt : '',
          item.querySelector('figcaption') ? item.querySelector('figcaption').textContent : ''
        ].join(' ').toLowerCase();
        var matchesCategory = category === 'all' || item.dataset.cat === category;
        var matchesSearch = !query || searchableText.indexOf(query) !== -1;
        if (matchesCategory && matchesSearch) matching.push(item);
      });

      matching.forEach(function (item, index) {
        item.hidden = index >= visibleLimit;
      });
      grid.classList.toggle('filtered', category !== 'all' || !!query);

      if (status) {
        status.textContent = matching.length
          ? 'Showing ' + Math.min(matching.length, visibleLimit) + ' of ' + matching.length + ' ' +
            (matching.length === 1 ? 'photo.' : 'photos.')
          : 'No photos match your search.';
      }
      if (loadMore) {
        loadMore.hidden = matching.length <= visibleLimit;
        loadMore.textContent = 'Load 10 more photos';
      }
    }

    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');

      if (!btn) return;

      chips.querySelectorAll('.chip').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === btn));
      });

      category = btn.dataset.f;
      visibleLimit = 10;
      applyFilters();
    });

    if (search) search.addEventListener('input', function () {
      visibleLimit = 10;
      applyFilters();
    });
    if (loadMore) loadMore.addEventListener('click', function () {
      visibleLimit += 10;
      applyFilters();
    });
    applyFilters();
  }

  wireFilter('galChips', 'galGrid', 'gallerySearch', 'galleryStatus');

  var galleryViewer = document.getElementById('galleryViewer');
  var galleryViewerImage = document.getElementById('galleryViewerImage');
  var galleryViewerCaption = document.getElementById('galleryViewerCaption');
  var galleryViewerClose = document.getElementById('galleryViewerClose');
  var lastGalleryTrigger = null;

  if (galleryViewer && galleryViewerImage && galleryViewerCaption && galleryViewerClose) {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('.gallery-photo');
      var thumbnail = trigger && trigger.querySelector('img');

      if (!trigger || !thumbnail) return;

      lastGalleryTrigger = trigger;
      galleryViewerImage.src = thumbnail.src;
      galleryViewerImage.alt = thumbnail.alt;
      galleryViewerCaption.textContent = thumbnail.alt;
      galleryViewer.showModal();
    });

    galleryViewerClose.addEventListener('click', function () {
      galleryViewer.close();
    });

    galleryViewer.addEventListener('click', function (event) {
      if (event.target === galleryViewer) {
        galleryViewer.close();
      }
    });

    galleryViewer.addEventListener('close', function () {
      galleryViewerImage.removeAttribute('src');

      if (lastGalleryTrigger) {
        lastGalleryTrigger.focus();
        lastGalleryTrigger = null;
      }
    });
  }

  var form = document.getElementById('msgForm');
  var statusEl = document.getElementById('status');

  function say(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }

  if (form && statusEl) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var message = form.elements.message.value.trim();

      if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) {
        say('Please add your name, a valid email address and a message.', true);
        return;
      }

      var subject = 'Website message: ' + form.elements.topic.value;
      var body = [
        'Hello For His Grace Ministries,',
        '',
        'Name: ' + name,
        'Email: ' + email,
        'Phone: ' + (form.elements.phone.value.trim() || 'Not provided'),
        'Interested in: ' + form.elements.topic.value,
        'Confidential prayer request: ' + (form.elements.confidential.checked ? 'Yes' : 'No'),
        '',
        'Message:',
        message
      ].join('\n');

      say('Your email app is opening with your message ready. Please review it and press Send.', false);
      window.location.href = 'mailto:info@hisgraceministries.co.za?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }

  if (
    'IntersectionObserver' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    var revealItems = document.querySelectorAll(
      '.section .sec-head, .section .split > *, .section .grid2 > *, ' +
      '.section .grid3 > *, .section .grid4 > *, .section .row2 > *'
    );
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -32px 0px'
    });

    revealItems.forEach(function (item) {
      item.classList.add('scroll-reveal');
      revealObserver.observe(item);
    });
  }

  /* ===== Popup announcements ============================================ */
  var announcePopup = document.getElementById('announcePopup');
  var popupClose = document.getElementById('popupClose');
  var announcementMemory = new Set();
  var announcementFocus = null;
  var announcementExpiryTimer = null;
  var announcementKey = function (item) { return 'fhgm-popup-' + item.id + '-' + item.version; };

  function announcementSeen(item) {
    var key = announcementKey(item);
    if (announcementMemory.has(key)) return true;
    try { return window.sessionStorage.getItem(key) === 'shown'; }
    catch (error) {
      console.warn('Could not read the popup session state.', error);
      return false;
    }
  }

  function markAnnouncementSeen(item) {
    var key = announcementKey(item);
    announcementMemory.add(key);
    try { window.sessionStorage.setItem(key, 'shown'); }
    catch (error) { console.warn('Could not save the popup session state.', error); }
  }

  function safeAnnouncementUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      var url = new URL(value.trim(), window.location.href);
      if (url.protocol === 'https:') return url.href;
      if ((url.protocol === 'http:' || url.protocol === 'file:') &&
          url.protocol === window.location.protocol && url.origin === window.location.origin) return url.href;
      return null;
    } catch (error) {
      return null;
    }
  }

  function closeAnnouncement() {
    if (announcePopup && announcePopup.open) announcePopup.close();
  }

  async function loadHomeAnnouncement() {
    var popupTitle = document.getElementById('popupTitle');
    var popupMeta = document.getElementById('popupMeta');
    var popupBody = document.getElementById('popupBody');
    var popupLink = document.getElementById('popupLink');
    if (!document.querySelector('[data-home-page]') ||
        !announcePopup || !popupClose || !popupTitle || !popupMeta || !popupBody || !popupLink) return;

    popupClose.addEventListener('click', closeAnnouncement);
    announcePopup.addEventListener('click', function (event) {
      if (event.target === announcePopup) closeAnnouncement();
    });
    announcePopup.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeAnnouncement();
    });
    announcePopup.addEventListener('close', function () {
      window.clearTimeout(announcementExpiryTimer);
      announcementExpiryTimer = null;
      if (announcementFocus && announcementFocus.isConnected) announcementFocus.focus();
      announcementFocus = null;
    });

    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(
        'https://admin.hisgraceministries.co.za/api/public/popups/active',
        {credentials:'omit', cache:'no-store', signal:controller.signal}
      );
      if (!response.ok) throw new Error('Public announcement request failed (' + response.status + ')');
      var data = await response.json();
      if (!data || !Array.isArray(data.items)) throw new Error('Invalid public announcement response');
      var serverTime = Date.parse(data.serverTime);
      if (!Number.isFinite(serverTime)) throw new Error('Invalid public announcement time');
      var now = Date.now() + (serverTime - Date.now());
      var item = data.items.find(function (candidate) {
        if (!candidate || typeof candidate.id !== 'string' ||
            !Number.isFinite(Number(candidate.version)) ||
            typeof candidate.title !== 'string' || !candidate.title.trim() ||
            typeof candidate.message !== 'string' || !candidate.message.trim()) {
          console.warn('Skipping a malformed public announcement.');
          return false;
        }
        var startsAt = Date.parse(candidate.startsAt);
        var endsAt = Date.parse(candidate.endsAt);
        return Number.isFinite(startsAt) && Number.isFinite(endsAt) &&
          startsAt <= now && endsAt > now && !announcementSeen(candidate);
      });
      if (!item) return;

      popupTitle.textContent = item.title;
      popupMeta.textContent = 'For His Grace Ministries';
      popupBody.textContent = item.message;
      var buttonUrl = safeAnnouncementUrl(item.buttonUrl);
      popupLink.hidden = !buttonUrl;
      popupLink.removeAttribute('href');
      if (item.buttonUrl && !buttonUrl) console.warn('Ignoring an unsafe announcement button URL.');
      if (buttonUrl) {
        popupLink.href = buttonUrl;
        popupLink.textContent = typeof item.buttonText === 'string' && item.buttonText.trim()
          ? item.buttonText.trim() : 'Learn more';
      }

      announcementFocus = document.activeElement;
      announcePopup.showModal();
      markAnnouncementSeen(item);
      announcementExpiryTimer = window.setTimeout(
        closeAnnouncement,
        Math.min(Date.parse(item.endsAt) - now, 2147483647)
      );
    } catch (error) {
      console.warn('Could not load public announcements.', error);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  loadHomeAnnouncement();

  /* ===== Admin-ready data hooks ========================================= */
  document.querySelectorAll('[data-admin-ready]').forEach(function (el) {
    el.addEventListener('click', function () {
      var type = el.dataset.adminLabel || 'item';
      var id = el.dataset.eventId || el.dataset.postId || el.dataset.galleryId;
      console.log('[Admin] ' + type + ' #' + id + ' clicked — ready for admin panel integration.');
    });
  });

  /* ===== Event filtering (events page) ================================== */
  var eventFilters = document.getElementById('eventFilters');
  var eventsGrid = document.getElementById('eventsGrid');

  if (eventFilters && eventsGrid) {
    var chips = eventFilters.querySelectorAll('[data-filter]');
    var eventsEmpty = document.getElementById('eventsEmpty');

    function updateEventsEmptyState() {
      if (!eventsEmpty) return;

      var cards = document.querySelectorAll('#eventsGrid .event-card');
      var hasVisibleEvent = Array.from(cards).some(function (card) {
        return !card.hidden && card.style.display !== 'none';
      });

      eventsEmpty.hidden = hasVisibleEvent;
    }

    updateEventsEmptyState();

    chips.forEach(function (chip) {
      var selected = chip.dataset.filter === 'all';
      chip.classList.toggle('active', selected);
      chip.setAttribute('aria-pressed', String(selected));
      chip.addEventListener('click', function () {
        var filter = chip.dataset.filter;

        chips.forEach(function (c) {
          c.classList.toggle('active', c.dataset.filter === filter);
          c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
        });

        document.querySelectorAll(
          '#eventsGrid .event-card, #cmsContent .event-card'
        ).forEach(function (card) {
          var cat = card.dataset.cat || '';
          var show = filter === 'all' || cat.toLowerCase().indexOf(filter) !== -1;
          card.style.display = show ? '' : 'none';
        });

        updateEventsEmptyState();
      });
    });
  }

  function bindContentDialog(dialog) {
    if (!dialog) return;

    var closeButton = dialog.querySelector('[data-dialog-close]');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        dialog.close();
      });
    }

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  var eventDialog = document.getElementById('eventDialog');
  var eventDialogTitle = document.getElementById('eventDialogTitle');
  var eventDialogMeta = document.getElementById('eventDialogMeta');
  var eventDialogDescription = document.getElementById('eventDialogDescription');
  var eventDialogImage = document.getElementById('eventDialogImage');
  var lastEventTrigger = null;

  if (
    eventsGrid &&
    eventDialog &&
    eventDialogTitle &&
    eventDialogMeta &&
    eventDialogDescription &&
    eventDialogImage
  ) {
    bindContentDialog(eventDialog);

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-event-open]');
      var card = trigger && trigger.closest('.event-card');

      if (!card) return;

      var title = card.querySelector('.event-title');
      var date = card.querySelector('.event-date');
      var details = Array.from(card.querySelectorAll('.event-meta span'));
      var description = card.querySelector('.event-description') ||
        card.querySelector('.event-excerpt');
      var image = card.querySelector('.event-img img');

      eventDialogTitle.textContent = title ? title.textContent.trim() : 'Event details';
      eventDialogMeta.replaceChildren();

      if (date) {
        var dateText = document.createElement('span');
        dateText.textContent = date.textContent.trim().replace(/\s+/g, ' ');
        eventDialogMeta.appendChild(dateText);
      }

      details.forEach(function (detail) {
        var item = document.createElement('span');
        item.textContent = detail.textContent.trim();
        eventDialogMeta.appendChild(item);
      });

      eventDialogDescription.textContent = description
        ? description.textContent.trim()
        : '';
      eventDialogImage.replaceChildren();
      eventDialogImage.hidden = !image;

      if (image) {
        var eventImage = image.cloneNode();
        eventImage.removeAttribute('loading');
        eventDialogImage.appendChild(eventImage);
      }

      lastEventTrigger = trigger;
      eventDialog.showModal();
    });

    eventDialog.addEventListener('close', function () {
      if (lastEventTrigger) {
        lastEventTrigger.focus();
        lastEventTrigger = null;
      }
    });
  }

  var blogGrid = document.getElementById('blogGrid');
  var postDialog = document.getElementById('postDialog');
  var postDialogTitle = document.getElementById('postDialogTitle');
  var postDialogExcerpt = document.getElementById('postDialogExcerpt');
  var postDialogLabels = document.getElementById('postDialogLabels');
  var postDialogMeta = document.getElementById('postDialogMeta');
  var postDialogArticle = document.getElementById('postDialogArticle');
  var postDialogImage = document.getElementById('postDialogImage');
  var lastPostTrigger = null;
  var postDetails = new WeakMap();

  function postLabels(item) {
    var labels = Array.isArray(item.tags) ? item.tags.slice()
      : typeof item.tags === 'string' ? item.tags.split(',') : [];
    if (item.category) labels.unshift(item.category);
    var seen = new Set();
    return labels.filter(function (label) {
      if (typeof label !== 'string' || !label.trim()) return false;
      var key = label.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(function (label) { return label.trim(); });
  }

  function postDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium', timeZone: 'Africa/Johannesburg'
    }).format(date);
  }

  if (
    blogGrid &&
    postDialog &&
    postDialogTitle &&
    postDialogExcerpt &&
    postDialogLabels &&
    postDialogMeta &&
    postDialogArticle &&
    postDialogImage
  ) {
    bindContentDialog(postDialog);

    function showPostDialog(trigger, card) {
      var title = card.querySelector('.post-title');
      var metadata = card.querySelectorAll('.post-meta span');
      var tags = card.querySelectorAll('.post-tags .chip-tag');
      var image = card.querySelector('.post-img img');
      var article = card.querySelector('.post-full-content');
      var excerpt = card.querySelector('.post-excerpt');
      var detail = article && postDetails.get(article);

      postDialogTitle.textContent = title ? title.textContent.trim() : 'Blog article';
      postDialogExcerpt.textContent = excerpt ? excerpt.textContent.trim() : '';
      postDialogExcerpt.hidden = !postDialogExcerpt.textContent;
      postDialogLabels.replaceChildren();
      postDialogMeta.replaceChildren();

      var labels = detail ? postLabels(detail) : Array.from(tags).map(function (tag) {
        return tag.textContent.trim();
      });
      labels.forEach(function (value) {
        var item = document.createElement('span');
        item.className = 'content-dialog-label';
        item.textContent = value;
        postDialogLabels.appendChild(item);
      });

      var metadataItems = Array.from(metadata).map(function (value) {
        var icon = value.querySelector('use');
        var href = icon ? icon.getAttribute('href') || '' : '';
        return {
          icon: href.indexOf('i-user') !== -1 ? 'i-user' : 'i-calendar',
          text: value.textContent.trim()
        };
      });
      if (detail) {
        var dateValue = detail.publishedAt || detail.published_at ||
          detail.createdAt || detail.created_at || detail.uploadedAt;
        var formattedDate = dateValue ? postDate(dateValue) : '';
        var publishedDate = metadataItems.find(function (item) { return item.icon === 'i-calendar'; });
        if (formattedDate && publishedDate) publishedDate.text = formattedDate;
        else if (formattedDate) metadataItems.unshift({icon:'i-calendar', text:formattedDate});
      }
      if (detail && detail.author) {
        var author = metadataItems.find(function (item) { return item.icon === 'i-user'; });
        if (author) author.text = detail.author;
        else metadataItems.push({icon:'i-user', text:detail.author});
      }
      metadataItems.forEach(function (value) {
        var item = document.createElement('span');
        item.className = 'content-dialog-meta-item';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', 'icons.svg#' + value.icon);
        svg.appendChild(use);
        item.append(svg, document.createTextNode(value.icon === 'i-user' ? 'By ' + value.text : value.text));
        postDialogMeta.appendChild(item);
      });

      postDialogArticle.replaceChildren();
      if (article) {
        postDialogArticle.appendChild(article.content.cloneNode(true));
      } else if (excerpt) {
        var paragraph = document.createElement('p');
        paragraph.textContent = excerpt.textContent.trim();
        postDialogArticle.appendChild(paragraph);
      }

      postDialogImage.replaceChildren();
      postDialogImage.hidden = !image;

      if (image) {
        var postImage = image.cloneNode();
        postImage.removeAttribute('loading');
        postDialogImage.appendChild(postImage);
      }

      lastPostTrigger = trigger;
      postDialog.showModal();
    }

    async function loadPostDetails(trigger, card, article) {
      var postStatus = document.getElementById('cmsStatus');
      var previousStatus = postStatus ? postStatus.textContent : '';
      if (previousStatus === 'The full article could not be loaded. Please try again.') previousStatus = '';
      if (postStatus) postStatus.textContent = 'Loading article…';
      trigger.disabled = true;
      trigger.setAttribute('aria-busy', 'true');
      var controller = new AbortController();
      var timer = window.setTimeout(function () { controller.abort(); }, 60000);
      try {
        var url = new URL(article.dataset.contentUrl, window.location.href);
        if (url.origin !== 'https://admin.hisgraceministries.co.za' ||
            url.pathname.indexOf('/api/public/blog/') !== 0) {
          throw new Error('Invalid article URL');
        }
        var response = await fetch(url.href, {
          credentials: 'omit', cache: 'no-store', signal: controller.signal
        });
        if (!response.ok) throw new Error('Article request failed (' + response.status + ')');
        var detail = await response.json();
        if (!detail || typeof detail.content !== 'string') throw new Error('Invalid article response');
        var body = document.createElement('div');
        body.className = 'cms-copy';
        var cardTitle = card.querySelector('.post-title');
        if (window.FhgmContent) FhgmContent.render(body, detail.content, detail.contentFormat, detail.title || (cardTitle && cardTitle.textContent));
        else body.textContent = detail.content;
        article.content.replaceChildren(body);
        article.dataset.contentLoaded = 'true';
        postDetails.set(article, detail);
        if (postStatus) postStatus.textContent = previousStatus;
        showPostDialog(trigger, card);
      } catch (error) {
        console.error('Could not load the uploaded blog article.', error);
        if (postStatus) postStatus.textContent = 'The full article could not be loaded. Please try again.';
      } finally {
        window.clearTimeout(timer);
        trigger.disabled = false;
        trigger.removeAttribute('aria-busy');
      }
    }

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-post-open]');
      var card = trigger && trigger.closest('.post-card');
      if (!card) return;
      var article = card.querySelector('.post-full-content');
      if (article && article.dataset.contentUrl && article.dataset.contentLoaded !== 'true') {
        event.preventDefault();
        loadPostDetails(trigger, card, article);
        return;
      }
      showPostDialog(trigger, card);
    });

    postDialog.addEventListener('close', function () {
      if (lastPostTrigger) {
        lastPostTrigger.focus();
        lastPostTrigger = null;
      }
    });
  }
})();
