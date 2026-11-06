const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Database file path and Port configuration
const dbPath = path.join(__dirname, "bookStore.db");
const PORT = process.env.PORT || 3000;

let db = null;

/**
 * Initialize SQLite Database connection, create tables, seed sample data,
 * and start the Express HTTP server.
 */
const initializeDBAndServer = async () => {
  try {
    // Open the SQLite database connection
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Create 'book' table if it does not already exist
    await db.run(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price REAL NOT NULL,
        pages INTEGER NOT NULL
      )
    `);

    // Check if the table is empty and seed initial data if needed
    const countResult = await db.get(`SELECT COUNT(*) AS count FROM book`);
    if (countResult.count === 0) {
      await db.run(`
        INSERT INTO book (title, author, price, pages)
        VALUES 
          ('JavaScript: The Good Parts', 'Douglas Crockford', 450.00, 176),
          ('Eloquent JavaScript', 'Marijn Haverbeke', 650.00, 472),
          ('Node.js Design Patterns', 'Mario Casciaro', 750.00, 520),
          ('You Don''t Know JS', 'Kyle Simpson', 350.00, 278),
          ('Learning SQL', 'Alan Beaulieu', 500.00, 380),
          ('Clean Code', 'Robert C. Martin', 890.00, 464)
      `);
      console.log("Database initialized with sample book records.");
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error(`Database / Server Initialization Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// ==========================================
// REST API ENDPOINTS
// ==========================================

/**
 * API 1: GET /books
 * Description: Retrieve books with support for:
 *   - search_q: partial title match (SQL LIKE)
 *   - order_by: sort column (id, title, author, price, pages; default: id)
 *   - order: sort direction (ASC, DESC; default: ASC)
 *   - limit: maximum number of records (default: 10)
 *   - offset: number of records to skip (default: 0)
 *   - min_price: filter books with price >= min_price
 *   - max_price: filter books with price <= max_price
 */
app.get("/books", async (req, res) => {
  try {
    const {
      search_q = "",
      order_by = "id",
      order = "ASC",
      limit = 10,
      offset = 0,
      min_price,
      max_price,
    } = req.query;

    // 1. Whitelist validation for order_by column
    const allowedOrderByColumns = ["id", "title", "author", "price", "pages"];
    const normalizedOrderBy = String(order_by).toLowerCase();
    if (!allowedOrderByColumns.includes(normalizedOrderBy)) {
      return res.status(400).json({
        message: "Invalid order_by column. Allowed values: id, title, author, price, pages",
      });
    }

    // 2. Whitelist validation for order direction
    const normalizedOrder = String(order).toUpperCase();
    const allowedOrderDirections = ["ASC", "DESC"];
    if (!allowedOrderDirections.includes(normalizedOrder)) {
      return res.status(400).json({
        message: "Invalid order direction. Allowed values: ASC, DESC",
      });
    }

    // 3. Validation for limit
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0 || String(limit).trim() !== String(parsedLimit)) {
      return res.status(400).json({
        message: "Invalid limit. Must be a positive integer",
      });
    }

    // 4. Validation for offset
    const parsedOffset = parseInt(offset, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0 || String(offset).trim() !== String(parsedOffset)) {
      return res.status(400).json({
        message: "Invalid offset. Must be a non-negative integer",
      });
    }

    // 5. Validation for min_price (optional)
    let parsedMinPrice = null;
    if (min_price !== undefined) {
      parsedMinPrice = Number(min_price);
      if (isNaN(parsedMinPrice) || parsedMinPrice < 0 || String(min_price).trim() === "") {
        return res.status(400).json({
          message: "Invalid min_price. Must be a non-negative number",
        });
      }
    }

    // 6. Validation for max_price (optional)
    let parsedMaxPrice = null;
    if (max_price !== undefined) {
      parsedMaxPrice = Number(max_price);
      if (isNaN(parsedMaxPrice) || parsedMaxPrice < 0 || String(max_price).trim() === "") {
        return res.status(400).json({
          message: "Invalid max_price. Must be a non-negative number",
        });
      }
    }

    // Check min_price <= max_price if both are provided
    if (parsedMinPrice !== null && parsedMaxPrice !== null && parsedMinPrice > parsedMaxPrice) {
      return res.status(400).json({
        message: "min_price cannot be greater than max_price",
      });
    }

    // Build parameterized SQL query
    const whereClauses = [];
    const queryParams = [];

    // Title search filter
    if (typeof search_q === "string" && search_q.trim() !== "") {
      whereClauses.push("title LIKE ?");
      queryParams.push(`%${search_q.trim()}%`);
    }

    // Price filters
    if (parsedMinPrice !== null) {
      whereClauses.push("price >= ?");
      queryParams.push(parsedMinPrice);
    }

    if (parsedMaxPrice !== null) {
      whereClauses.push("price <= ?");
      queryParams.push(parsedMaxPrice);
    }

    let selectBooksQuery = `SELECT * FROM book`;
    if (whereClauses.length > 0) {
      selectBooksQuery += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    // ORDER BY and ORDER are verified via strict whitelist; LIMIT and OFFSET are parameterized
    selectBooksQuery += ` ORDER BY ${normalizedOrderBy} ${normalizedOrder} LIMIT ? OFFSET ?`;
    queryParams.push(parsedLimit, parsedOffset);

    const books = await db.all(selectBooksQuery, queryParams);
    return res.status(200).json(books);
  } catch (error) {
    console.error(`Error in GET /books: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * API 2: GET /books/:bookId
 * Description: Get a single book record by ID.
 */
app.get("/books/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const parsedId = parseInt(bookId, 10);

    // Validate ID: must be a positive integer
    if (isNaN(parsedId) || parsedId <= 0 || String(bookId).trim() !== String(parsedId)) {
      return res.status(400).json({
        message: "Invalid book ID. Must be a positive integer",
      });
    }

    const getBookQuery = `SELECT * FROM book WHERE id = ?`;
    const book = await db.get(getBookQuery, [parsedId]);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    return res.status(200).json(book);
  } catch (error) {
    console.error(`Error in GET /books/:bookId: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Helper function to validate request body for POST and PUT
 */
const validateBookPayload = (body) => {
  const { title, author, price, pages } = body;

  // Title validation
  if (title === undefined || title === null) {
    return { isValid: false, message: "Title is required" };
  }
  if (typeof title !== "string" || title.trim() === "") {
    return { isValid: false, message: "Title must be a non-empty string" };
  }

  // Author validation
  if (author === undefined || author === null) {
    return { isValid: false, message: "Author is required" };
  }
  if (typeof author !== "string" || author.trim() === "") {
    return { isValid: false, message: "Author must be a non-empty string" };
  }

  // Price validation
  if (price === undefined || price === null) {
    return { isValid: false, message: "Price is required" };
  }
  if (typeof price !== "number" || isNaN(price) || price < 0) {
    return { isValid: false, message: "Price must be a valid non-negative number" };
  }

  // Pages validation
  if (pages === undefined || pages === null) {
    return { isValid: false, message: "Pages is required" };
  }
  if (typeof pages !== "number" || !Number.isInteger(pages) || pages <= 0) {
    return { isValid: false, message: "Pages must be a positive integer" };
  }

  return {
    isValid: true,
    data: {
      title: title.trim(),
      author: author.trim(),
      price: Number(price),
      pages: Number(pages),
    },
  };
};

/**
 * API 3: POST /books
 * Description: Add a new book to the database.
 */
app.post("/books", async (req, res) => {
  try {
    const validation = validateBookPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const { title, author, price, pages } = validation.data;

    const insertBookQuery = `
      INSERT INTO book (title, author, price, pages)
      VALUES (?, ?, ?, ?)
    `;

    const result = await db.run(insertBookQuery, [title, author, price, pages]);

    return res.status(201).json({
      message: "Book created successfully",
      bookId: result.lastID,
    });
  } catch (error) {
    console.error(`Error in POST /books: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * API 4: PUT /books/:bookId
 * Description: Update an existing book's details.
 */
app.put("/books/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const parsedId = parseInt(bookId, 10);

    // Validate ID
    if (isNaN(parsedId) || parsedId <= 0 || String(bookId).trim() !== String(parsedId)) {
      return res.status(400).json({
        message: "Invalid book ID. Must be a positive integer",
      });
    }

    // Check if the book exists
    const existingBook = await db.get(`SELECT * FROM book WHERE id = ?`, [parsedId]);
    if (!existingBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Validate payload
    const validation = validateBookPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const { title, author, price, pages } = validation.data;

    const updateBookQuery = `
      UPDATE book
      SET title = ?, author = ?, price = ?, pages = ?
      WHERE id = ?
    `;

    await db.run(updateBookQuery, [title, author, price, pages, parsedId]);

    return res.status(200).json({
      message: "Book updated successfully",
    });
  } catch (error) {
    console.error(`Error in PUT /books/:bookId: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * API 5: DELETE /books/:bookId
 * Description: Delete a book by its ID.
 */
app.delete("/books/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const parsedId = parseInt(bookId, 10);

    // Validate ID
    if (isNaN(parsedId) || parsedId <= 0 || String(bookId).trim() !== String(parsedId)) {
      return res.status(400).json({
        message: "Invalid book ID. Must be a positive integer",
      });
    }

    // Check if the book exists
    const existingBook = await db.get(`SELECT * FROM book WHERE id = ?`, [parsedId]);
    if (!existingBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    const deleteBookQuery = `DELETE FROM book WHERE id = ?`;
    await db.run(deleteBookQuery, [parsedId]);

    return res.status(200).json({
      message: "Book deleted successfully",
    });
  } catch (error) {
    console.error(`Error in DELETE /books/:bookId: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Export app instance (helpful for integration testing and modularity)
module.exports = app;
