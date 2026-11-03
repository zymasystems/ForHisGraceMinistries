// Run against a local static server: SITE_URL=http://127.0.0.1:8000 node tests/cms.spec.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
  const page = await browser.newPage();
  let payload, responseStatus = 200, requests = [];
  await page.route('https://admin.hisgraceministries.co.za/api/public/**', async route => {
    requests.push(route.request().url());
    assert.equal(route.request().headers().cookie, undefined);
    await route.fulfill({status: responseStatus, contentType:'application/json', body:JSON.stringify(payload)});
  });
  const base = process.env.SITE_URL || 'http://127.0.0.1:8000';
  async function visit(path, data) {
    payload = data;
    await page.goto(base + '/' + path);
    await page.waitForFunction(() => document.querySelector('#cmsStatus').textContent !== 'Loading content…');
    assert.equal(await page.locator('main').count(), 1);
    assert.equal(await page.locator('footer').count(), 1);
    assert.equal(await page.locator('script[src="script.js"]').count(), 1);
    if (path.startsWith('blog.html')) {
      assert.equal(await page.locator('#blogGrid .post-card').count(), 3);
      assert.match(await page.locator('#blogGrid').textContent(), /Walking in His Purpose Together/);
    }
    if (path.startsWith('events.html')) {
      assert.equal(await page.locator('#eventsGrid .event-card').count(), 4);
      assert.equal(await page.locator('#eventFilters').count(), 1);
    }
    if (path.startsWith('gallery.html')) {
      assert.equal(await page.locator('#galGrid .gallery-photo').count(), 5);
      assert.equal(await page.locator('#gallerySearch').count(), 1);
      assert.equal(await page.locator('#galleryViewer').count(), 1);
    }
  }
  await visit('blog.html', {total:13, items:[{title:'<img src=x onerror=alert(1)>', slug:'faith & hope', excerpt:'Welcome', author:'Staff', publishedAt:'2026-11-01T12:00:00Z'}]});
  assert.equal(await page.locator('#cmsContent img').count(), 0);
  assert.match(await page.locator('#cmsContent a').getAttribute('href'), /faith%20%26%20hope/);
  assert.equal(await page.locator('#cmsPagination a').textContent(), 'Next →');
  await visit('blog-post.html?slug=faith', {title:'Faith',content:'First paragraph\n\nSecond paragraph',author:'Staff'});
  assert.match(await page.locator('.cms-copy').textContent(), /Second paragraph/);
  assert.match(requests.at(-1), /blog\/faith/);
  await visit('events.html', {total:1,items:[{title:'Gathering', startsAt:'2099-11-03T08:00:00Z',endsAt:'2099-11-03T10:00:00Z',location:'Church',description:'Join us'}]});
  assert.match(await page.locator('#cmsContent').textContent(), /10:00.*12:00/);
  await visit('gallery.html', {total:21,items:[{title:'Sunday',slug:'sunday',description:'Service',coverUrl:'https://example.org/photo.jpg',imageCount:2}]});
  assert.equal(await page.locator('#cmsContent a').getAttribute('href'), 'gallery.html?album=sunday');
  await visit('gallery.html?album=sunday&page=2', {title:'Sunday',description:'Service',total:25,items:[{url:'https://example.org/photo.jpg',altText:'Church family',caption:'Together'}]});
  assert.equal(await page.locator('#cmsContent img').getAttribute('alt'), 'Church family');
  assert.match(requests.at(-1), /albums\/sunday\?page=2/);
  assert.match(await page.locator('#cmsPagination').textContent(), /Previous/);
  await visit('blog.html', {total:0,items:[]});
  assert.match(await page.locator('#cmsStatus').textContent(), /No published content/);
  await page.locator('[data-existing-post]').first().click();
  assert.equal(await page.locator('#existingPostPreview').evaluate(node => node.open), true);
  assert.match(await page.locator('#existingPostExcerpt').textContent(), /grow in grace/);
  await page.locator('#existingPostClose').click();
  responseStatus = 503;
  await visit('blog.html', {});
  assert.match(await page.locator('#cmsStatus').textContent(), /could not load/);
  responseStatus = 200;
  payload = {total:0,items:[]};
  await page.getByRole('button',{name:'Try again'}).click();
  await page.waitForFunction(() => document.querySelector('#cmsStatus').textContent.includes('No published'));
  responseStatus = 404;
  await visit('blog-post.html?slug=removed', {});
  assert.match(await page.locator('#cmsStatus').textContent(), /no longer available/);
  await page.setViewportSize({width:390,height:844});
  responseStatus = 200;
  await visit('gallery.html', {total:0,items:[]});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#gallerySearch').fill('Deacon');
  assert.equal(await page.locator('#galGrid .gallery-photo:not([hidden])').count(), 1);
  await page.locator('#galGrid .gallery-photo:not([hidden])').click();
  assert.equal(await page.locator('#galleryViewer').evaluate(node => node.open), true);
  await page.locator('#galleryViewerClose').click();
  await visit('blog-post.html?slug=formatted', {title:'Formatted',content:'## A heading\n**Bold** and *gentle*\n<script>alert(1)</script>\n[Bad](javascript:alert(1))',contentFormat:'Markdown',featuredImageUrl:'https://example.org/cover.jpg'});
  assert.equal(await page.locator('#cmsContent h3').textContent(), 'A heading');
  assert.equal(await page.locator('#cmsContent strong').textContent(), 'Bold');
  assert.equal(await page.locator('#cmsContent script').count(), 0);
  assert.equal(await page.locator('#cmsContent a[href^="javascript:"]').count(), 0);
  assert.equal(await page.locator('#cmsContent img').getAttribute('src'), 'https://example.org/cover.jpg');
  await visit('events.html', {total:1,items:[{title:'Weekly service',slug:'weekly',startsAt:'2099-11-03T08:00:00Z',endsAt:'2099-11-03T10:00:00Z',location:'Church',description:'Join us'}]});
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#cmsContent').getByRole('button',{name:'Add to calendar'}).click();
  const download = await downloadPromise;
  const contents = require('node:fs').readFileSync(await download.path(),'utf8');
  assert.match(contents, /DTSTART:20991103T080000Z/); assert.match(contents, /BEGIN:VCALENDAR/);
  await browser.close();
  console.log('PASS: published feeds, article detail, pagination, SAST dates, safe text rendering, gallery links, errors/retry, missing content, mobile width and page structure');
})().catch(error => { console.error(error); process.exit(1); });

