const cron = require('node-cron');
const db = require('./db');

async function runScheduledNotificationCheck() {
  try {
    const [users] = await db.query(
      `SELECT id, email, name, notifications
       FROM users
       WHERE email_verified = TRUE`
    );

    let totalAlerts = 0;

    for (const user of users) {
      const [triggers] = await db.query(`SELECT id, product_name, trigger_type, threshold FROM triggers WHERE enabled = TRUE AND user_id = ?`, [user.id]);

      for (const trigger of triggers) {
        let query;
        let params;

        if (trigger.trigger_type === 'quantity') {
          query = `
            SELECT id, qr_code, name, quantity, expiry_date
            FROM products
            WHERE user_id = ?
              AND name = ?
              AND quantity <= ?
          `;
          params = [user.id, trigger.product_name, trigger.threshold];
        } else {
          query = `
            SELECT id, qr_code, name, quantity, expiry_date,
                   DATEDIFF(expiry_date, CURDATE()) AS days_until_expiry
            FROM products
            WHERE user_id = ?
              AND name = ?
              AND expiry_date >= CURDATE()
              AND DATEDIFF(expiry_date, CURDATE()) <= ?
          `;
          params = [user.id, trigger.product_name, trigger.threshold];
        }

        const [products] = await db.query(query, params);

        totalAlerts += products.length;
      }
    }

    console.log(
      `Inventra scheduled notification check completed: ${totalAlerts} alert(s)`
    );
  } catch (error) {
    console.error('Scheduled notification check error:', error);
  }
}

function startNotificationScheduler() {
  cron.schedule('0 */6 * * *', runScheduledNotificationCheck);

  console.log('Inventra notification scheduler started (every 6 hours)');
}

module.exports = startNotificationScheduler;
module.exports.runScheduledNotificationCheck = runScheduledNotificationCheck;





