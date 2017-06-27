'use strict';

const parseCacheControl = require('./parseCacheControl');
const { getFromCache, storeInCache } = require('./cache');

const noop = () => {};

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