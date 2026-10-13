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

    var items = grid.querySelectorAll('[data-cat]');
    var search = document.getElementById(searchId);
    var status = document.getElementById(statusId);
    var category = 'all';

    function applyFilters() {
      var query = search ? search.value.trim().toLowerCase() : '';
      var visibleCount = 0;

      items.forEach(function (item) {
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
        var visible = matchesCategory && matchesSearch;

        item.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      grid.classList.toggle('filtered', category !== 'all' || !!query);

      if (status) {
        status.textContent = visibleCount
          ? 'Showing ' + visibleCount + (visibleCount === 1 ? ' photo.' : ' photos.')
          : 'No photos match your search.';
      }
    }

    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');

      if (!btn) return;

      chips.querySelectorAll('.chip').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === btn));
      });

      category = btn.dataset.f;
      applyFilters();
    });

    if (search) search.addEventListener('input', applyFilters);
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
      window.location.href = 'mailto:fhgm_1@yahoo.com?subject=' +
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
})();
