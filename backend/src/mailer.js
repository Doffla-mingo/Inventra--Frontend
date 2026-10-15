const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.isConfigured = () => {
  const user = process.env.EMAIL_USER || '';
  const pass = process.env.EMAIL_PASS || '';
  return Boolean(
    user &&
    pass &&
    !/placeholder|your-|example/i.test(user) &&
    !/placeholder|your-/i.test(pass)
  );
};

module.exports = transporter;
