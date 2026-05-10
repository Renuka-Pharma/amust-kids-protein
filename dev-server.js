'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var waHandler = require('./api/whatsapp.js');
var emailHandler = require('./api/email-handoff.js');

var root = __dirname;
var PORT = Number(process.argv[2]) || 8081;
var BODY_MAX_BYTES = Number(process.env.HANDOFF_MAX_JSON_BYTES || 49152);

function loadEnvFile(rel) {
  try {
    var t = fs.readFileSync(path.join(root, rel), 'utf8');
    t.split('\n').forEach(function (line) {
      var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) return;
      var k = m[1];
      var v = m[2].trim();
      if (
        (v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') ||
        (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")
      )
        v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    });
  } catch (e) {}
}

loadEnvFile('.env.local');
loadEnvFile('.env');

var guessMime = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function bufferPost(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var sum = 0;
    req.on('data', function (c) {
      sum += c.length;
      if (sum > BODY_MAX_BYTES) {
        reject(new Error('body too large'));
        try {
          req.destroy && req.destroy();
        } catch (eD) {}
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function sendStatic(relPath, res) {
  if (relPath.indexOf('..') !== -1) {
    res.statusCode = 400;
    return res.end();
  }
  var full = path.join(root, relPath === '' ? 'index.html' : relPath);
  var ext = path.extname(full).toLowerCase();
  var type = guessMime[ext] || 'application/octet-stream';
  fs.stat(full, function (err, st) {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', type);
    fs.createReadStream(full).pipe(res);
  });
}

var server = http.createServer(async function (req, res) {
  var reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
  var pathname = decodeURIComponent(reqUrl.pathname);

  if (pathname === '/api/whatsapp') {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.end();
    }
    if (req.method === 'POST') {
      try {
        var buf = await bufferPost(req);
        try {
          req.body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
        } catch (ex) {
          req.body = null;
        }
        await waHandler(req, res);
      } catch (e2) {
        if (e2 && e2.message === 'body too large') {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Payload too large.' }));
        } else {
          res.statusCode = 500;
          res.end();
        }
      }
      return;
    }
    res.statusCode = 405;
    res.end();
    return;
  }

  if (pathname === '/api/email-handoff') {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.end();
    }
    if (req.method === 'POST') {
      try {
        var buf2 = await bufferPost(req);
        try {
          req.body = buf2.length ? JSON.parse(buf2.toString('utf8')) : {};
        } catch (ex2) {
          req.body = null;
        }
        await emailHandler(req, res);
      } catch (e3) {
        if (e3 && e3.message === 'body too large') {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Payload too large.' }));
        } else {
          res.statusCode = 500;
          res.end();
        }
      }
      return;
    }
    res.statusCode = 405;
    res.end();
    return;
  }

  if (pathname === '/' || pathname === '') return sendStatic('index.html', res);

  sendStatic(pathname.slice(1), res);
});

server.listen(PORT, '127.0.0.1', function () {
  console.error(
    'http://127.0.0.1:' +
      PORT +
      ' (POST /api/email-handoff live; SITE_CONTACT_EMAIL | keep /api/whatsapp for later)'
  );
});
