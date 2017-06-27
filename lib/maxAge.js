'use strict';

/*
Problem:

Request A with X-Woof: 1 ->
<- Response B with no-cache

Request B with X-Woof: 4 ->
<- Response B with max-age=60
*/


const wreck = require('wreck');

const noop = () => {};

function createCacheKey(segment, id) {
  const versionedSegment = `blackadder:1.0.0:${segment}`;

  return {
    segment: versionedSegment,
    id
  };
}

function parseCacheControl(cacheControlHeader) {
  if (!cacheControlHeader) {
    return {};
  }

  return wreck.parseCacheControl(cacheControlHeader);
}

function getFromCache(cache, segment, id) {
  return new Promise((resolve) => {
    cache.get(
      createCacheKey(segment, id),
      (err, cached) => resolve(cached)
    );
  });
}

function storeInCache(cache, segment, id, body, ttl) {
  return new Promise((resolve) => {
    cache.set(
      createCacheKey(segment, id),
      body,
      ttl,
      () => resolve()
    );
  });
}

module.exports = function maxAge(cache) {
  cache.start(noop);

  return function (ctx, next) {
    return getFromCache(cache, 'body', ctx.req.getUrl())
      .then((cached) => {
        if (cached) {
          ctx.res = { body: cached.item };
          return;
        }

        return next().then(() => {
          const cacheControl = parseCacheControl(ctx.res.headers['cache-control']);

          if (cacheControl['max-age']) {
            return storeInCache(cache, 'body', ctx.req.getUrl(), ctx.res.body, cacheControl['max-age'] * 1000);
          }
        });
      });
  };
};