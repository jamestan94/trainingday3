import mysql from "mysql2/promise";

const DB_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.MYSQL_PORT) || 3306;
const DB_USER = process.env.MYSQL_USER || "root";
const DB_PASSWORD = process.env.MYSQL_PASSWORD || "";
const DB_NAME = process.env.MYSQL_DATABASE || "expense_tracker";
const USE_SSL = process.env.MYSQL_SSL === "true";

const sslOption = USE_SSL
  ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }
  : {};

let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      ...sslOption,
    });
  }

  return pool;
}

let initPromise = null;
function ready() {
  if (!initPromise) initPromise = init();
  return initPromise;
}

async function init() {
  const bootstrap = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    ...sslOption,
  });

  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await bootstrap.end();

  const connection = getPool();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [[{ count }]] = await connection.query("SELECT COUNT(*) AS count FROM expenses");

  if (count === 0) {
    await connection.query(
      "INSERT INTO expenses (description, amount, category) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
      [
        "Groceries",
        42.5,
        "Food",
        "Train pass",
        28,
        "Transport",
        "Electric bill",
        96.2,
        "Utilities",
      ],
    );
  }
}

function rowToExpense(row) {
  return {
    id: Number(row.id),
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
  };
}

export async function getAllExpenses() {
  await ready();
  const [rows] = await getPool().query(
    "SELECT * FROM expenses ORDER BY created_at DESC, id DESC",
  );
  return rows.map(rowToExpense);
}

export async function createExpense({ description, amount, category }) {
  await ready();
  const trimmedDescription = String(description || "").trim();
  const numericAmount = Number(amount);
  const trimmedCategory = String(category || "Other").trim();

  if (!trimmedDescription) {
    throw new Error("Description is required");
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  const [result] = await getPool().query(
    "INSERT INTO expenses (description, amount, category) VALUES (?, ?, ?)",
    [trimmedDescription, Number(numericAmount.toFixed(2)), trimmedCategory || "Other"],
  );

  const [rows] = await getPool().query("SELECT * FROM expenses WHERE id = ?", [
    result.insertId,
  ]);

  return rowToExpense(rows[0]);
}

export async function deleteExpense(id) {
  await ready();
  const [result] = await getPool().query("DELETE FROM expenses WHERE id = ?", [Number(id)]);
  return result.affectedRows > 0;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
