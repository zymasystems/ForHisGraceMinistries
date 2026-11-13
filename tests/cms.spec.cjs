// Run against a local static server: SITE_URL=http://127.0.0.1:8000 node tests/cms.spec.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
  const page = await browser.newPage();
  let payload, responseForRequest = null, responseStatus = 200, requests = [];
  await page.route('https://admin.hisgraceministries.co.za/api/public/**', async route => {
    requests.push(route.request().url());
    assert.equal(route.request().headers().cookie, undefined);
    const body = responseForRequest ? responseForRequest(route.request().url(), payload) : payload;
    await route.fulfill({status: responseStatus, contentType:'application/json', body:JSON.stringify(body)});
  });
  await page.clock.install({time:new Date('2026-11-06T12:00:00Z')});
  const base = process.env.SITE_URL || 'http://127.0.0.1:8000';
  async function visit(path, data) {
    payload = data;
    await page.goto(base + '/' + path);
    await page.waitForFunction(() => document.querySelector('#cmsStatus').textContent !== 'Loading content…');
    assert.equal(await page.locator('main').count(), 1);
    assert.equal(await page.locator('footer').count(), 1);
    assert.equal(await page.locator('script[src="script.js"]').count(), 1);
    if (path.startsWith('blog.html')) {
      assert.equal(await page.locator('#blogHeading').textContent(), 'Latest published articles');
    }
    if (path.startsWith('events.html')) {
      assert.equal(await page.locator('#eventFilters').count(), 1);
    }
    if (path.startsWith('gallery.html')) {
      assert.ok(await page.locator('#galGrid .gallery-photo').count() >= 5);
      assert.equal(await page.locator('#gallerySearch').count(), 1);
      assert.equal(await page.locator('#galleryViewer').count(), 1);
    }
  }
  responseForRequest = url => url.endsWith('/blog?page=2')
    ? {total:13,items:Array.from({length:12},(_,i)=>({title:'Archive '+i,slug:'archive-'+i,publishedAt:'2026-10-01T12:00:00Z'}))}
    : payload;
  await visit('blog.html', {total:13, items:[{title:'<img src=x onerror=alert(1)>', slug:'faith & hope', excerpt:'Welcome', author:'Staff', publishedAt:'2026-11-01T12:00:00Z'}]});
  assert.equal(await page.locator('#blogGrid img').count(), 1);
  assert.match(await page.locator('#blogGrid').textContent(), /<img src=x onerror=alert\(1\)>/);
  const featuredPaths = await page.locator('#blogGrid .post-img img, #cmsContent .post-card[data-post-id] .post-img img')
    .evaluateAll(images => images.map(image => new URL(image.src).pathname));
  assert.equal(new Set(featuredPaths).size, 4);
  assert.ok(requests.some(url => /blog\?page=2/.test(url)));
  assert.match(await page.locator('#blogGrid .post-read').getAttribute('href'), /faith%20%26%20hope/);
  responseForRequest = null;
  await visit('blog-post.html?slug=faith', {title:'Faith',content:'First paragraph\n\nSecond paragraph',author:'Staff'});
  assert.match(await page.locator('.cms-copy').textContent(), /Second paragraph/);
  assert.ok(await page.locator('#cmsContent > img').count());
  assert.ok(requests.some(url => /blog\/faith/.test(url)));
  await visit('events.html', {total:1,items:[{title:'Gathering', startsAt:'2099-11-03T08:00:00Z',endsAt:'2099-11-03T10:00:00Z',location:'Church',description:'Join us',publishedAt:'2026-11-05T12:00:00Z'}]});
  assert.equal(await page.locator('#eventsGrid .event-card').count(), 1);
  assert.match(await page.locator('#eventsGrid').textContent(), /10:00.*12:00/);
  assert.equal(await page.locator('#eventsEmpty').isHidden(), true);
  assert.ok(await page.locator('#eventsGrid .event-img img').count());
  await page.locator('#eventsGrid').getByRole('button',{name:'View event'}).click();
  assert.equal(await page.locator('#eventDialog').evaluate(node => node.open), true);
  assert.equal(await page.locator('#eventDialogTitle').textContent(), 'Gathering');
  await page.locator('#eventDialog [data-dialog-close]').click();
  responseForRequest = url => url.includes('/albums/sunday?')
    ? {title:'Sunday',description:'Service',total:1,items:[{url:'https://example.org/photo.jpg',altText:'Church service',caption:'Together'}]}
    : {total:1,items:[{title:'Sunday',slug:'sunday',description:'Service',coverUrl:'https://example.org/photo.jpg',imageCount:1}]};
  await visit('gallery.html', {total:1,items:[{title:'Sunday',slug:'sunday',description:'Service',coverUrl:'https://example.org/photo.jpg',imageCount:1}]});
  assert.equal(await page.locator('#galGrid .gallery-photo').count(), 6);
  assert.equal(await page.locator('#galleryLoadMore').isHidden(), true);
  assert.equal(await page.locator('#albumsSection').isHidden(), false);
  assert.equal(await page.locator('#cmsContent a').getAttribute('href'), 'gallery.html?album=sunday');
  responseForRequest = url => url.includes('/albums/first?') || url.includes('/albums/second?')
    ? {title:'Album',description:'Service',total:1,items:[{url:'https://example.org/shared-photo.jpg?size=large',altText:'Shared photo'}]}
    : {total:2,items:[
      {title:'First',slug:'first',description:'First album',coverUrl:'https://example.org/first-cover.jpg',imageCount:1},
      {title:'Second',slug:'second',description:'Second album',coverUrl:'https://example.org/second-cover.jpg',imageCount:1}
    ]};
  await visit('gallery.html', {total:2,items:[]});
  assert.equal(await page.locator('#galGrid .gallery-photo').count(), 6);
  responseForRequest = url => url.includes('/albums/sunday?')
    ? {title:'Sunday',description:'Service',total:12,items:Array.from({length:12},(_,i)=>({url:'https://example.org/photo-'+i+'.jpg',altText:'Photo '+i}))}
    : {total:1,items:[{title:'Sunday',slug:'sunday',description:'Service',coverUrl:'https://example.org/photo.jpg',imageCount:12}]};
  await visit('gallery.html', {total:1,items:[{title:'Sunday',slug:'sunday',description:'Service',coverUrl:'https://example.org/photo.jpg',imageCount:12}]});
  assert.equal(await page.locator('#galGrid .gallery-photo:not([hidden])').count(), 10);
  await page.locator('#galleryLoadMore').click();
  assert.equal(await page.locator('#galGrid .gallery-photo:not([hidden])').count(), 17);
  responseForRequest = null;
  await visit('gallery.html?album=sunday&page=2', {title:'Sunday',description:'Service',total:25,items:[{url:'https://example.org/photo.jpg',altText:'Church family',caption:'Together'}]});
  assert.equal(await page.locator('#cmsContent img').getAttribute('alt'), 'Church family');
  assert.match(requests.at(-1), /albums\/sunday\?page=2/);
  assert.match(await page.locator('#cmsPagination').textContent(), /Previous/);
  await visit('blog.html', {total:0,items:[]});
  assert.match(await page.locator('#cmsStatus').textContent(), /No newly published articles/);
  assert.equal(await page.locator('#blogArchiveSection').isHidden(), false);
  await page.locator('[data-post-open]').first().click();
  assert.equal(await page.locator('#postDialog').evaluate(node => node.open), true);
  assert.match(await page.locator('#postDialogArticle').textContent(), /grow as we worship/);
  await page.locator('#postDialog [data-dialog-close]').click();
  await visit('blog.html', {total:2,items:[
    {title:'Recent article',slug:'recent',publishedAt:'2026-11-05T12:00:00Z'},
    {title:'Archived article',slug:'archived',publishedAt:'2026-10-23T12:00:00Z'}
  ]});
  assert.match(await page.locator('#blogGrid').textContent(), /Recent article/);
  assert.doesNotMatch(await page.locator('#blogGrid').textContent(), /Archived article/);
  assert.match(await page.locator('#cmsContent').textContent(), /Archived article/);
  await visit('events.html', {total:2,items:[
    {title:'Recent event',slug:'recent-event',startsAt:'2026-11-10T08:00:00Z',endsAt:'2026-11-10T10:00:00Z',publishedAt:'2026-11-05T12:00:00Z'},
    {title:'Archived event',slug:'archived-event',startsAt:'2026-11-10T08:00:00Z',endsAt:'2026-11-10T10:00:00Z',createdAt:'2026-10-23T12:00:00Z'}
  ]});
  assert.match(await page.locator('#eventsGrid').textContent(), /Recent event/);
  assert.doesNotMatch(await page.locator('#eventsGrid').textContent(), /Archived event/);
  assert.match(await page.locator('#cmsContent').textContent(), /Archived event/);
  assert.equal(await page.locator('#moreEventsSection').isHidden(), false);
  responseStatus = 503;
  await visit('blog.html', {});
  assert.match(await page.locator('#cmsStatus').textContent(), /could not load/);
  responseStatus = 200;
  payload = {total:0,items:[]};
  await page.getByRole('button',{name:'Try again'}).click();
  await page.waitForFunction(() => document.querySelector('#cmsStatus').textContent.includes('No newly published'));
  responseStatus = 404;
  await visit('blog-post.html?slug=removed', {});
  assert.match(await page.locator('#cmsStatus').textContent(), /no longer available/);
  await page.setViewportSize({width:390,height:844});
  responseStatus = 200;
  await visit('gallery.html', {total:0,items:[]});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const galleryRows = await page.evaluate(() => {
    const rows = new Map();
    document.querySelectorAll('#galGrid .gallery-photo:not([hidden])').forEach(card => {
      const top = Math.round(card.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) || 0) + 1);
    });
    return Array.from(rows.values());
  });
  assert.deepEqual(galleryRows, [1,2,2]);
  assert.equal(await page.locator('#menuBtn').isVisible(), true);
  assert.equal(await page.locator('#menuBtn span').count(), 1);
  await page.setViewportSize({width:320,height:740});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#gallerySearch').fill('Deacon');
  assert.equal(await page.locator('#galGrid .gallery-photo:not([hidden])').count(), 1);
  await page.locator('#galGrid .gallery-photo:not([hidden])').click();
  assert.equal(await page.locator('#galleryViewer').evaluate(node => node.open), true);
  await page.locator('#galleryViewerClose').click();
  responseForRequest = url => url.endsWith('/gallery/albums?page=1')
    ? {total:0,items:[]}
    : payload;
  await visit('blog.html', {total:1,items:[{title:'Cover fallback',slug:'cover-fallback',publishedAt:'2026-11-05T12:00:00Z'}]});
  assert.match(await page.locator('#blogGrid .post-img img').getAttribute('src'), /images\/(Church|Senior|Pastor|Overseer|Deacon)/);
  responseForRequest = null;
  await visit('events.html', {total:0,items:[]});
  assert.equal(await page.locator('#moreEventsSection').isHidden(), true);
  assert.equal(await page.locator('#eventsEmpty').isHidden(), false);
  await visit('gallery.html', {total:0,items:[]});
  assert.equal(await page.locator('#albumsSection').isHidden(), true);
  await visit('blog-post.html?slug=formatted', {title:'Formatted',content:'## A heading\n**Bold** and *gentle*\n<script>alert(1)</script>\n[Bad](javascript:alert(1))',contentFormat:'Markdown',featuredImageUrl:'https://example.org/cover.jpg'});
  assert.equal(await page.locator('#cmsContent h3').textContent(), 'A heading');
  assert.equal(await page.locator('#cmsContent strong').textContent(), 'Bold');
  assert.equal(await page.locator('#cmsContent script').count(), 0);
  assert.equal(await page.locator('#cmsContent a[href^="javascript:"]').count(), 0);
  assert.equal(await page.locator('#cmsContent img').getAttribute('src'), 'https://example.org/cover.jpg');
  await visit('events.html', {total:1,items:[{title:'Weekly service',slug:'weekly',startsAt:'2099-11-03T08:00:00Z',endsAt:'2099-11-03T10:00:00Z',location:'Church',description:'Join us'}]});
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#eventsGrid').getByRole('button',{name:'Add to calendar'}).click();
  const download = await downloadPromise;
  const contents = require('node:fs').readFileSync(await download.path(),'utf8');
  assert.match(contents, /DTSTART:20991103T080000Z/); assert.match(contents, /BEGIN:VCALENDAR/);
  await visit('blog.html', {total:1,items:[{title:'Two week article',slug:'two-week',publishedAt:'2026-11-05T12:00:00Z'}]});
  assert.equal(await page.locator('#blogGrid .post-card').count(), 1);
  await page.clock.fastForward(14 * 24 * 60 * 60 * 1000);
  assert.equal(await page.locator('#blogGrid .post-card').count(), 0);
  assert.match(await page.locator('#cmsContent').textContent(), /Two week article/);
  await browser.close();
  console.log('PASS: recent/archive feeds and timed transitions, all-page loading, article detail, SAST dates, album photos, safe rendering, errors/retry, missing content, mobile width and page structure');
})().catch(error => { console.error(error); process.exit(1); });
