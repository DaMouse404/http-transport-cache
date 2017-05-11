'use strict';

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
    cache.get(createCacheKey(segment, id), (err, cached) => {
      resolve(cached);
    });
  });
}

module.exports = function blackadderCacheConstructor(cache) {
  cache.start(noop);

  return function (ctx, next) {
    return getFromCache(cache, 'body', ctx.req.url)
      .then((cached) => {
        if (cached) {
          ctx.res = {
            body: cached.item
          };
          return;
        }

        return next().then(() => {
          return new Promise((resolve) => {
            const cacheControl = parseCacheControl(ctx.res.headers['cache-control']);

            if (cacheControl['max-age']) {
              cache.set(
                createCacheKey('body', ctx.req.url),
                ctx.res.body,
                cacheControl['max-age'] * 1000,
                () => resolve()
              );
            } else {
              resolve();
            }
          });
        });
      });
  };
}