require('dotenv').config();

const jwt = require('jsonwebtoken');
const fs = require('fs');
const http = require('http');

const token = jwt.sign(
  {
    id: 2,
    email: 'avishkarwaghmare23@gmail.com',
    role: 'manager'
  },
  process.env.JWT_SECRET,
  { expiresIn: '5m' }
);

const file = fs.readFileSync('test-products.csv');
const boundary = '----InventraCSVTest';

const prefix = Buffer.from(
  '--' + boundary + '\r\n' +
  'Content-Disposition: form-data; name="file"; filename="test-products.csv"\r\n' +
  'Content-Type: text/csv\r\n\r\n'
);

const suffix = Buffer.from(
  '\r\n--' + boundary + '--\r\n'
);

const data = Buffer.concat([prefix, file, suffix]);

const req = http.request(
  {
    hostname: 'localhost',
    port: 3001,
    path: '/api/products/import/csv',
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': data.length
    }
  },
  res => {
    let body = '';

    res.on('data', chunk => {
      body += chunk;
    });

    res.on('end', () => {
      console.log('HTTP ' + res.statusCode);
      console.log(body);
    });
  }
);

req.on('error', error => {
  console.error(error.message);
});

req.write(data);
req.end();
