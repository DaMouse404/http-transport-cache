'use strict';

const parseCacheControl = require('./parseCacheControl');
const { getFromCache, storeInCache } = require('./cache');

const noop = () => {};

module.exports = function maxAge(cache) {
  cache.start(noop);

  return function (ctx, next) {
    return next().then(() => {
      const cacheControl = parseCacheControl(ctx.res.headers['cache-control']);

      if (cacheControl['stale-if-error']) {
        return storeInCache(cache, 'stale', ctx.req.getUrl(), ctx.res.body, cacheControl['stale-if-error'] * 1000);
      }
    }).catch((err) => {
      return getFromCache(cache, 'stale', ctx.req.getUrl()).then((cached) => {
        if (cached) {
          ctx.res = { body: cached.item };
          return;
        }
        return Promise.reject(err);
      });
    });
  };
};