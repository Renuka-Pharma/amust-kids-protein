function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST');
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

    var allowStr = process.env.WHATSAPP_ALLOWED_ORIGINS || '';
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
