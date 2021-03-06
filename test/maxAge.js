'use strict';

const assert = require('assert');
const httpTransport = require('http-transport');
const Catbox = require('catbox');
const Memory = require('catbox-memory');
const nock = require('nock');
const bluebird = require('bluebird');

const cache = require('../');

const api = nock('http://www.example.com');

const defaultHeaders = {
  'cache-control': 'max-age=60'
};
const defaultResponse = 'I am a string!';
const bodySegment = { segment: 'http-transport:1.0.0:body', id: 'http://www.example.com/' };

nock.disableNetConnect();

function createCache() {
  const cache = new Catbox.Client(new Memory());
  bluebird.promisifyAll(cache);

  return cache;
}

function requestWithCache(catbox) {
  return httpTransport
    .createClient()
    .use(cache.maxAge(catbox))
    .get('http://www.example.com/')
    .asBody()
}

describe('Max-Age', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('sets the cache up ready for use', () => {
    const catbox = createCache();

    cache.maxAge(catbox);

    assert(catbox.isReady());
  });

  it('stores cached values for the max-age value', () => {
    const cache = createCache();

    api.get('/').reply(200, defaultResponse, defaultHeaders);

    const expiry = Date.now() + 60000;

    return requestWithCache(cache)
      .then(() => cache.getAsync(bodySegment))
      .then((cached) => {const actualExpiry = cached.ttl + cached.stored;
        const differenceInExpires = actualExpiry - expiry;

        assert.deepEqual(cached.item, defaultResponse);
        assert(differenceInExpires < 1000);
      });
  });

  it('does not store if no cache-control', () => {
    const cache = createCache();

    api.get('/').reply(200, defaultResponse);

    return requestWithCache(cache)
      .then(() => cache.getAsync(bodySegment))
      .then((cached) => assert(!cached));
  });

  it('does not store if max-age=0', () => {
    const cache = createCache();

    api.get('/').reply(200, defaultResponse, { headers: { 'cache-control': 'max-age=0' }});

    return requestWithCache(cache)
      .then(() => cache.getAsync(bodySegment))
      .then((cached) => assert(!cached));
  });

  it('returns cached response if available', () => {
    const cachedResponse = 'http-transport';
    const cache = createCache();

    api.get('/').reply(200, defaultResponse, { headers: { 'cache-control': 'max-age=0' }});

    return cache.startAsync()
      .then(() => cache.setAsync(bodySegment, cachedResponse, 600))
      .then(() => requestWithCache(cache))
      .then((body) => {
        assert.equal(body, cachedResponse);

        return cache.drop(bodySegment);
      });
  });
});