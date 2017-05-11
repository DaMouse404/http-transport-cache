'use strict';

const assert = require('assert');
const blackadder = require('flashheart');
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

nock.disableNetConnect();

function createCache() {
  const cache = new Catbox.Client(new Memory());
  bluebird.promisifyAll(cache);

  return cache;
}

function createClient(catbox) {
  return blackadder
    .createClient()
    .use(cache(catbox));
}

describe('Blackadder cache', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('sets the cache up ready for use', () => {
    const cache = createCache();
    const client = createClient(cache);

    assert(cache.isReady());
  });

  it('stores cached values for the max-age value', () => {
    const cache = createCache();
    const client = createClient(cache);

    api.get('/').reply(200, defaultResponse, defaultHeaders);

    const expiry = Date.now() + 60000;

    return client
      .get('http://www.example.com/')
      .asBody()
      .then(() => cache.getAsync({ segment: 'blackadder:1.0.0:body', id: 'http://www.example.com/' }))
      .then((cached) => {const actualExpiry = cached.ttl + cached.stored;
        const differenceInExpires = actualExpiry - expiry;

        assert.deepEqual(cached.item, defaultResponse);
        assert(differenceInExpires < 1000);
      });
  });

  it('does not store if no cache-control', () => {
    const cache = createCache();
    const client = createClient(cache);

    api.get('/').reply(200, defaultResponse);

    return client
      .get('http://www.example.com/')
      .asBody()
      .then(() => cache.getAsync({ segment: 'blackadder:1.0.0:body', id: 'http://www.example.com/' }))
      .then((cached) => assert(!cached));
  });

  it('does not store if max-age=0', () => {
    const cache = createCache();
    const client = createClient(cache);

    api.get('/').reply(200, defaultResponse, { headers: { 'cache-control': 'max-age=0' }});

    return client
      .get('http://www.example.com/')
      .asBody()
      .then(() => cache.getAsync({ segment: 'blackadder:1.0.0:body', id: 'http://www.example.com/' }))
      .then((cached) => assert(!cached));
  });

  it('returns cached response if available', () => {
    const cachedResponse = 'blackadder';
    const cache = createCache();
    const client = createClient(cache);

    api.get('/').reply(200, defaultResponse, { headers: { 'cache-control': 'max-age=0' }});

    return cache.setAsync({ segment: 'blackadder:1.0.0:body', id: 'http://www.example.com/' }, cachedResponse, 600)
      .then(() => client.get('http://www.example.com/').asBody())
      .then((body) => {
        assert.equal(body, cachedResponse);

        return cache.drop({ segment: 'blackadder:1.0.0:body', id: 'http://www.example.com/' });
      });
  });
});