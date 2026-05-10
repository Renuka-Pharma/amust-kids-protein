'use strict';

function canonicalOrigin(input, opts) {
  if (!input || typeof input !== 'string') return '';
  var raw = input.trim();
  if (!raw.length) return '';
  if (raw.toLowerCase() === 'null') return '';
  try {
    var u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.pathname.length > 1 || u.username || u.password || u.search || u.hash) return '';
    var host = u.hostname.replace(/\[|\]/g, '').toLowerCase();
    if (!host.length) return '';
    var isLocal =
      host === 'localhost' || host.endsWith('.localhost') || /^127(?:\.\d+){3}$/.test(host);
    var requireHttps = opts && opts.requireHttps;
    if (requireHttps && u.protocol !== 'https:' && !isLocal) return '';
    return u.origin;
  } catch (e) {
    return '';
  }
}

function parseCsv(s) {
  return String(s || '')
    .split(',')
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
}

function originAllowlisted(originHeader, csv, opts) {
  var entries = parseCsv(csv);
  if (!entries.length) return true;
  var o = canonicalOrigin(originHeader, opts);
  if (!o.length) return false;
  return entries.some(function (e) {
    return canonicalOrigin(e, opts) === o;
  });
}

module.exports.originAllowlisted = originAllowlisted;
module.exports.canonicalOrigin = canonicalOrigin;
