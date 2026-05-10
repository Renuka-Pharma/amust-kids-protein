'use strict';

var originAllow = require('../lib/originAllow.js');
var limitedBody = require('../lib/limitedJsonBody.js');

var JSON_CAP = Number(process.env.HANDOFF_MAX_JSON_BYTES || 49152);

function prodStrictOrigins() {
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.end(JSON.stringify(payload));
}

function buildMessage(payload) {
  var isOrder = payload.purpose === 'order';
  var lines = [];
  lines.push('*AMUST Kids WhatsApp from website*', '');
  if (isOrder) {
    lines.push('*Type:* Order');
    lines.push('*Product:* AMUST Kids Chocolate');
    lines.push('*Approx qty:* ' + payload.qty);
    if (payload.pack && payload.pack.length) lines.push('*Pack preference:* ' + payload.pack);
    if (payload.whenNeed && payload.whenNeed.length) lines.push('*Timeline:* ' + payload.whenNeed);
    if (payload.deliveryPin && payload.deliveryPin.length)
      lines.push('*Delivery city or PIN:* ' + payload.deliveryPin);
  } else lines.push('*Type:* Product question');
  lines.push('*Contact WhatsApp:* ' + payload.mobile);
  if (payload.name && payload.name.length) lines.push('*Name:* ' + payload.name);
  if (payload.city && payload.city.length) lines.push('*City or area:* ' + payload.city);
  var detail = (payload.detail || '').trim();
  if (detail.length) {
    lines.push(isOrder ? '*Notes:*' : '*Question:*');
    lines.push(detail, '');
  } else if (isOrder) lines.push('');
  lines.push('— Sent from AMUST Kids site —');
  return lines.join('\n');
}

function sanitize(s, maxLen) {
  if (typeof s !== 'string') return '';
  var v = '';
  try {
    v = Buffer.from(String(s).trim(), 'utf8').toString('utf8');
  } catch (eSan) {
    v = '';
  }
  var max = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 1200;
  if (typeof TextEncoder !== 'undefined') {
    var enc = new TextEncoder();
    var dec = new TextDecoder('utf8');
    var bytes = enc.encode(v);
    if (bytes.length > max) bytes = bytes.slice(0, max);
    return dec.decode(bytes).replace(/\u0000/g, '');
  }
  return v.slice(0, max).replace(/\u0000/g, '');
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

    var allowStr = process.env.WHATSAPP_ALLOWED_ORIGINS || '';
    var originOpts = { requireHttps: prodStrictOrigins() };
    if (!originAllow.originAllowlisted(req.headers.origin, allowStr, originOpts))
      return sendJson(res, 403, { error: 'Not allowed.' });

    var body = await limitedBody.resolveLimitedBody(req, JSON_CAP);
    if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Invalid request.' });

    var purpose = body.purpose === 'enquiry' ? 'enquiry' : 'order';
    var name = sanitize(body.name, 120);
    var mobile = sanitize(body.mobile, 40);
    var city = sanitize(body.city, 120);
    var detail = sanitize(body.detail, 2000);
    var qty = sanitize(body.qty, 80);
    var pack = sanitize(body.pack || body.packKind, 120);
    var whenNeed = sanitize(body.whenNeed, 120);
    var deliveryPin = sanitize(body.deliveryPin, 120);

    var mobDigits = mobile.replace(/\D+/g, '');
    if (mobDigits.length < 8)
      return sendJson(res, 400, {
        error: 'Enter a reachable mobile number so the team can follow up.',
      });

    if (purpose === 'order') {
      if (!qty.length)
        return sendJson(res, 400, { error: 'Add an approximate quantity (jars cartons or bundles).' });
    } else {
      if (detail.replace(/\s/g, '').length < 12)
        return sendJson(res, 400, { error: 'Write your question in a sentence or two.' });
    }

    var waDigits = String(process.env.WHATSAPP_E164 || '').replace(/\D+/g, '');
    if (!waDigits.length) return sendJson(res, 503, { error: 'Chat is unavailable right now.' });

    var text = buildMessage({
      purpose: purpose,
      qty: qty,
      pack: pack,
      whenNeed: whenNeed,
      deliveryPin: deliveryPin,
      mobile: mobile,
      name: name,
      city: city,
      detail: detail,
    });

    if (encodeURIComponent(text).length > 8000)
      return sendJson(res, 413, { error: 'Please shorten your message.' });

    var url = 'https://wa.me/' + waDigits + '?text=' + encodeURIComponent(text);
    return sendJson(res, 200, { url: url });
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid request.' });
  }
};
