'use strict';

var SAFE_JSON_MAX_KEYS = 28;

function isPlain(o) {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (Object.getPrototypeOf(o) !== Object.prototype) return false;
  return Object.keys(o).length <= SAFE_JSON_MAX_KEYS;
}

function safeJsonParse(raw) {
  var o = JSON.parse(raw || '{}', function (k, v) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return undefined;
    return v;
  });
  if (o === null || typeof o !== 'object' || Array.isArray(o) || !isPlain(o)) return null;
  return o;
}

function resolveLimitedBody(req, maxBytes) {
  try {
    if (req.headers && req.headers['content-length']) {
      var cl = Number(req.headers['content-length']);
      if (cl !== cl || cl < 0 || cl > maxBytes) return Promise.resolve(null);
    }
    var b = req.body;
    if (b !== undefined && b !== null && b !== '') {
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
        if (b.length > maxBytes) return Promise.resolve(null);
        var sx = (b.toString('utf8') || '').trim();
        if (!sx.length) return Promise.resolve({});
        try {
          return Promise.resolve(safeJsonParse(sx));
        } catch (eBuf) {
          return Promise.resolve(null);
        }
      }
      if (typeof b === 'string') {
        var sTrim = (b || '').trim();
        if (!sTrim.length) return Promise.resolve({});
        if (Buffer.byteLength(sTrim, 'utf8') > maxBytes) return Promise.resolve(null);
        try {
          return Promise.resolve(safeJsonParse(sTrim));
        } catch (eStr) {
          return Promise.resolve(null);
        }
      }
      if (typeof b === 'object') {
        if (!isPlain(b)) return Promise.resolve(null);
        var rep = JSON.stringify(b);
        if (!rep.length || Buffer.byteLength(rep, 'utf8') > maxBytes) return Promise.resolve(null);
        try {
          return Promise.resolve(safeJsonParse(rep));
        } catch (eObj) {
          return Promise.resolve(null);
        }
      }
      return Promise.resolve(null);
    }
    return readStreamLimited(req, maxBytes);
  } catch (e) {
    return Promise.resolve(null);
  }
}

function readStreamLimited(req, maxBytes) {
  return new Promise(function (resolve) {
    var chunks = [];
    var sum = 0;
    function finishOk() {
      var buf = Buffer.concat(chunks);
      var s = buf.toString('utf8').trim();
      if (!s.length) return resolve({});
      try {
        resolve(safeJsonParse(s));
      } catch (e) {
        resolve(null);
      }
    }
    req.on('data', function (c) {
      sum += c.length;
      if (sum > maxBytes) {
        try {
          req.destroy && req.destroy();
        } catch (dErr) {}
        resolve(null);
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      finishOk();
    });
    req.on('error', function () {
      resolve(null);
    });
    req.on('aborted', function () {
      resolve(null);
    });
  });
}

module.exports.resolveLimitedBody = resolveLimitedBody;
module.exports.safeJsonParse = safeJsonParse;
module.exports.SAFE_JSON_MAX_KEYS = SAFE_JSON_MAX_KEYS;
