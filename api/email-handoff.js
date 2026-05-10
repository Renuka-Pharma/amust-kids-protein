function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function buildEmailBody(payload) {
  var isOrder = payload.purpose === 'order';
  var lines = [];
  lines.push('*AMUST Kids message from website (email draft)*', '');
  if (isOrder) {
    lines.push('*Type:* Order');
    lines.push('*Product:* AMUST Kids Chocolate');
    lines.push('*Approx qty:* ' + payload.qty);
    if (payload.pack && payload.pack.length) lines.push('*Pack preference:* ' + payload.pack);
    if (payload.whenNeed && payload.whenNeed.length) lines.push('*Timeline:* ' + payload.whenNeed);
    if (payload.deliveryPin && payload.deliveryPin.length)
      lines.push('*Delivery city or PIN:* ' + payload.deliveryPin);
  } else lines.push('*Type:* Product question');
  lines.push('*Reply / reach me:* ' + payload.mobile);
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
  return s.trim().slice(0, maxLen || 1200);
}

function resolveBody(req) {
  try {
    var b = req.body;
    if (b === undefined || b === null || b === '') return Promise.resolve({});
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b))
      return Promise.resolve(JSON.parse(b.toString('utf8') || '{}'));
    if (typeof b === 'string') return Promise.resolve(b.trim() ? JSON.parse(b) : {});
    if (typeof b === 'object') return Promise.resolve(b);
  } catch (e) {
    return Promise.resolve(null);
  }
  return Promise.resolve(null);
}

function validateEmailAddr(s) {
  if (!s || typeof s !== 'string') return false;
  var x = s.trim();
  return /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/.test(x);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST');
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

    var allowStr = process.env.API_ALLOWED_ORIGINS || process.env.WHATSAPP_ALLOWED_ORIGINS || '';
    var allowList = allowStr.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (allowList.length) {
      var origin = (req.headers.origin || '').trim();
      var originOk =
        !!origin &&
        allowList.some(function (a) {
          return origin === a || origin.indexOf(a) === 0;
        });
      if (!originOk) return sendJson(res, 403, { error: 'Not allowed.' });
    }

    var body = await resolveBody(req);
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
        error: 'Enter a reachable phone number so the team can follow up.',
      });

    if (purpose === 'order') {
      if (!qty.length)
        return sendJson(res, 400, { error: 'Add an approximate quantity (jars cartons or bundles).' });
    } else {
      if (detail.replace(/\s/g, '').length < 12)
        return sendJson(res, 400, { error: 'Write your question in a sentence or two.' });
    }

    var contact = String(process.env.SITE_CONTACT_EMAIL || '').trim();
    if (!validateEmailAddr(contact)) return sendJson(res, 503, { error: 'Contact is unavailable right now.' });

    var built = buildEmailBody({
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

    var subject =
      purpose === 'order'
        ? 'AMUST Kids — website order / dispatch request'
        : 'AMUST Kids — website question';

    function makeMailto(bodyText) {
      return (
        'mailto:' +
        encodeURIComponent(contact) +
        '?subject=' +
        encodeURIComponent(subject) +
        '&body=' +
        encodeURIComponent(bodyText)
      );
    }

    var mailto = makeMailto(built);
    var maxHref = 2000;
    if (mailto.length > maxHref) {
      var cutNote = '\n\n[Trimmed automatically—please shorten notes in the form if needed.]';
      var cut = built;
      while (makeMailto(cut + cutNote).length > maxHref && cut.length > 480)
        cut = cut.slice(0, Math.floor(cut.length * 0.92));
      built = cut.trimEnd() + cutNote;
      mailto = makeMailto(built);
    }

    return sendJson(res, 200, { mailtoUrl: mailto });
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid request.' });
  }
};
