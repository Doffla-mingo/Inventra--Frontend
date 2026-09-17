const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status } = req.query;

    let sql = `
      SELECT id, qr_code, name, category, quantity,
             expiry_date, price, supplier, shelf,
             created_at, updated_at
      FROM products
      WHERE user_id = ?
    `;

    const params = [req.user.id];

    if (search) {
      sql += `
        AND (
          name LIKE ?
          OR qr_code LIKE ?
          OR category LIKE ?
          OR supplier LIKE ?
        )
      `;

      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status === 'expired') {
      sql += ` AND expiry_date < CURDATE()`;
    } else if (status === 'expiring') {
      sql += ` AND expiry_date >= CURDATE()
               AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)`;
    } else if (status === 'low') {
      sql += ` AND quantity <= 5`;
    }

    sql += ` ORDER BY expiry_date ASC, name ASC`;

    const [products] = await db.execute(sql, params);

    res.json(products);
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      qr_code,
      name,
      category,
      quantity,
      expiry_date,
      price,
      supplier,
      shelf
    } = req.body;

    if (!qr_code || !name || !expiry_date) {
      return res.status(400).json({
        error: 'qr_code, name and expiry_date are required'
      });
    }

    const parsedQuantity = Number.parseInt(quantity, 10);
    const parsedPrice = Number.parseFloat(price);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        error: 'quantity_must_be_a_non_negative_integer'
      });
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        error: 'price_must_be_a_non_negative_number'
      });
    }

    const [existing] = await db.execute(
      `SELECT id
       FROM products
       WHERE qr_code = ? AND user_id = ?`,
      [qr_code.trim(), req.user.id]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'product_already_exists'
      });
    }

    const [result] = await db.execute(
      `INSERT INTO products
       (user_id, qr_code, name, category, quantity,
        expiry_date, price, supplier, shelf)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        qr_code.trim(),
        name.trim(),
        category?.trim() || 'Other',
        parsedQuantity,
        expiry_date,
        parsedPrice,
        supplier?.trim() || null,
        shelf?.trim() || null
      ]
    );

    const [products] = await db.execute(
      `SELECT id, qr_code, name, category, quantity,
              expiry_date, price, supplier, shelf,
              created_at, updated_at
       FROM products
       WHERE id = ? AND user_id = ?`,
      [result.insertId, req.user.id]
    );

    res.status(201).json({
      message: 'product_created',
      product: products[0]
    });
  } catch (error) {
    console.error('Create product error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'qr_code_already_exists'
      });
    }

    res.status(500).json({ error: 'server_error' });
  }
});






router.post('/import/csv', authenticateToken, upload.single('file'), async (req, res) => {
  const connection = await db.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'csv_file_required'
      });
    }

    const records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    const requiredColumns = [
      'qr_code',
      'name',
      'quantity',
      'expiry_date',
      'price'
    ];

    if (records.length > 0) {
      const missingColumns = requiredColumns.filter(
        column => !Object.prototype.hasOwnProperty.call(records[0], column)
      );

      if (missingColumns.length > 0) {
        return res.status(400).json({
          error: 'missing_csv_columns',
          columns: missingColumns
        });
      }
    }

    let inserted = 0;
    let updated = 0;

    await connection.beginTransaction();

    for (const row of records) {
      const qrCode = String(row.qr_code || '').trim();
      const name = String(row.name || '').trim();
      const category = String(row.category || 'Other').trim() || 'Other';
      const supplier = String(row.supplier || '').trim() || null;
      const shelf = String(row.shelf || '').trim() || null;
      const quantity = Number.parseInt(row.quantity, 10);
      const price = Number.parseFloat(row.price);
      const expiryDate = String(row.expiry_date || '').trim();

      if (!qrCode || !name || !expiryDate) {
        throw new Error('Each row requires qr_code, name and expiry_date');
      }

      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new Error('Quantity must be a non-negative integer');
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Price must be a non-negative number');
      }

      const [existing] = await connection.execute(
        `SELECT id
         FROM products
         WHERE qr_code = ? AND user_id = ?`,
        [qrCode, req.user.id]
      );

      if (existing.length > 0) {
        await connection.execute(
          `UPDATE products
           SET name = ?,
               category = ?,
               quantity = ?,
               expiry_date = ?,
               price = ?,
               supplier = ?,
               shelf = ?
           WHERE id = ? AND user_id = ?`,
          [
            name,
            category,
            quantity,
            expiryDate,
            price,
            supplier,
            shelf,
            existing[0].id,
            req.user.id
          ]
        );

        updated++;
      } else {
        await connection.execute(
          `INSERT INTO products
           (user_id, qr_code, name, category, quantity,
            expiry_date, price, supplier, shelf)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            qrCode,
            name,
            category,
            quantity,
            expiryDate,
            price,
            supplier,
            shelf
          ]
        );

        inserted++;
      }
    }

    await connection.commit();

    res.json({
      inserted,
      updated
    });
  } catch (error) {
    await connection.rollback();

    console.error('CSV import error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'qr_code_already_exists'
      });
    }

    if (error.message && error.message.includes('CSV')) {
      return res.status(400).json({
        error: 'invalid_csv',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'server_error'
    });
  } finally {
    connection.release();
  }
});

router.get('/qr/:code', authenticateToken, async (req, res) => {
  try {
    const [products] = await db.execute(
      `SELECT id, qr_code, name, category, quantity,
              expiry_date, price, supplier, shelf,
              created_at, updated_at
       FROM products
       WHERE qr_code = ? AND user_id = ?`,
      [req.params.code.trim(), req.user.id]
    );

    if (products.length === 0) {
      return res.json({
        found: false
      });
    }

    res.json({
      found: true,
      product: products[0]
    });
  } catch (error) {
    console.error('QR lookup error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

router.get('/discounts', authenticateToken, async (req, res) => {
  try {
    const [products] = await db.execute(
      `SELECT id, name, category, supplier,
              price, expiry_date, quantity
       FROM products
       WHERE user_id = ?
         AND expiry_date >= CURDATE()
         AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
         AND quantity > 0
       ORDER BY expiry_date ASC`,
      [req.user.id]
    );

    const discounts = products.map(product => {
      const expiry = new Date(product.expiry_date);
      const today = new Date();

      expiry.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const daysLeft = Math.ceil(
        (expiry - today) / (1000 * 60 * 60 * 24)
      );

      let discount_pct = 0;
      let discount_tier = 'low';

      if (daysLeft <= 2) {
        discount_pct = 50;
        discount_tier = 'hot';
      } else if (daysLeft <= 5) {
        discount_pct = 30;
        discount_tier = 'medium';
      } else {
        discount_pct = 15;
        discount_tier = 'low';
      }

      const price = Number(product.price);
      const sale_price = Number(
        (price * (1 - discount_pct / 100)).toFixed(2)
      );
      const savings = Number(
        (price - sale_price).toFixed(2)
      );

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        supplier: product.supplier,
        discount_tier,
        discount_pct,
        discount_label: discount_tier === 'hot'
          ? 'Urgent'
          : 'Recommended',
        sale_price,
        price,
        savings,
        expiry_date: product.expiry_date,
        quantity: product.quantity
      };
    });

    res.json(discounts);
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(quantity <= 5), 0) AS low_stock,
         COALESCE(SUM(
           expiry_date >= CURDATE()
           AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
         ), 0) AS expiring_soon,
         COALESCE(SUM(expiry_date < CURDATE()), 0) AS expired
       FROM products
       WHERE user_id = ?`,
      [req.user.id]
    );

    const stats = rows[0];

    res.json({
      total: Number(stats.total),
      low_stock: Number(stats.low_stock),
      expiring_soon: Number(stats.expiring_soon),
      expired: Number(stats.expired)
    });
  } catch (error) {
    console.error('Product stats error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [products] = await db.execute(
      `SELECT id, qr_code, name, category, quantity,
              expiry_date, price, supplier, shelf,
              created_at, updated_at
       FROM products
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        error: 'product_not_found'
      });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});


router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      qr_code,
      name,
      category,
      quantity,
      expiry_date,
      price,
      supplier,
      shelf
    } = req.body;

    if (!qr_code || !name || !expiry_date) {
      return res.status(400).json({
        error: 'qr_code, name and expiry_date are required'
      });
    }

    const parsedQuantity = Number.parseInt(quantity, 10);
    const parsedPrice = Number.parseFloat(price);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        error: 'quantity_must_be_a_non_negative_integer'
      });
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        error: 'price_must_be_a_non_negative_number'
      });
    }

    const [existing] = await db.execute(
      `SELECT id
       FROM products
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'product_not_found'
      });
    }

    await db.execute(
      `UPDATE products
       SET qr_code = ?,
           name = ?,
           category = ?,
           quantity = ?,
           expiry_date = ?,
           price = ?,
           supplier = ?,
           shelf = ?
       WHERE id = ? AND user_id = ?`,
      [
        qr_code.trim(),
        name.trim(),
        category?.trim() || 'Other',
        parsedQuantity,
        expiry_date,
        parsedPrice,
        supplier?.trim() || null,
        shelf?.trim() || null,
        req.params.id,
        req.user.id
      ]
    );

    const [products] = await db.execute(
      `SELECT id, qr_code, name, category, quantity,
              expiry_date, price, supplier, shelf,
              created_at, updated_at
       FROM products
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    res.json({
      message: 'product_updated',
      product: products[0]
    });
  } catch (error) {
    console.error('Update product error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'qr_code_already_exists'
      });
    }

    res.status(500).json({
      error: 'server_error'
    });
  }
});


router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [existing] = await db.execute(
      `SELECT id
       FROM products
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'product_not_found'
      });
    }

    await db.execute(
      `DELETE FROM products
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    res.json({
      message: 'product_deleted',
      id: Number(req.params.id)
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});


router.get('/barcode/:code', authenticateToken, async (req, res) => {
  try {
    const barcode = req.params.code.trim();

    const demoProducts = {
      '3017620422003': {
        name: 'Nutella',
        category: 'Other',
        supplier: 'Ferrero',
        price: 0
      },
      '5449000000996': {
        name: 'Coca-Cola',
        category: 'Beverages',
        supplier: 'Coca-Cola',
        price: 0
      },
      '4005900061492': {
        name: 'Nivea Cream',
        category: 'Personal Care',
        supplier: 'Nivea',
        price: 0
      },
      '8901058857298': {
        name: 'Britannia Good Day',
        category: 'Snacks',
        supplier: 'Britannia',
        price: 0
      },
      '8906072671018': {
        name: 'Amul Butter',
        category: 'Dairy',
        supplier: 'Amul',
        price: 0
      },
      '0012000001086': {
        name: 'Pepsi',
        category: 'Beverages',
        supplier: 'PepsiCo',
        price: 0
      },
      '8901030895968': {
        name: 'Maggi Noodles',
        category: 'Snacks',
        supplier: 'Nestle',
        price: 0
      },
      '8901719110498': {
        name: 'Haldiram Bhujia',
        category: 'Snacks',
        supplier: 'Haldiram',
        price: 0
      }
    };

    const product = demoProducts[barcode];

    if (!product) {
      return res.json({
        found: false
      });
    }

    res.json({
      found: true,
      ...product
    });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;
