/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Andrew Guk

  TypeScript definitions for usql
*/

// ---------------------------------------------------------------------------
// Primitive union types
// ---------------------------------------------------------------------------

/** Allowed SQL comparison operators. */
export type SqlOperator =
  | '='
  | '!='
  | '<>'
  | '<'
  | '>'
  | '<='
  | '>='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS'
  | 'IS NOT'

/** Allowed ORDER BY directions (case-insensitive — normalised to uppercase internally). */
export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Return-value shapes
// ---------------------------------------------------------------------------

/**
 * The object returned by {@link DB.toSQL}.
 *
 * Pass `sql` to your database driver together with `bindings` so the driver
 * handles value escaping safely rather than relying on inline string escaping.
 */
export interface SqlResult {
  /** SQL string with `?` placeholders substituted for every bound value. */
  sql: string
  /** Ordered array of values to bind to the `?` placeholders. */
  bindings: unknown[]
}

// ---------------------------------------------------------------------------
// RAW wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a raw SQL fragment that is inserted verbatim into a query with **no**
 * escaping whatsoever.
 *
 * ⚠️  **Security warning** — only pass string literals or values you have
 * already validated / escaped yourself. Never pass attacker-controlled input
 * to `DB.raw()`.
 */
export declare class RAW {
  constructor(data: string)
  toString(): string
}

// ---------------------------------------------------------------------------
// DB query builder
// ---------------------------------------------------------------------------

/** A column or table reference: a plain name string, a sub-query, or a raw fragment. */
export type ColumnRef = string | DB | RAW

/** An object mapping column names to values for object-style where clauses. */
export type WhereObject = Record<string, unknown>

export declare class DB {
  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  constructor(table: ColumnRef)

  /**
   * Create a raw SQL fragment. The content is inserted **verbatim** — see the
   * {@link RAW} security warning before use.
   */
  static raw(data: string): RAW

  // -------------------------------------------------------------------------
  // Instance cloning
  // -------------------------------------------------------------------------

  /**
   * Return a deep copy of this builder instance.
   *
   * Use `clone()` when you want to share a base query object across multiple
   * call sites without risk of cross-request state mutation.
   *
   * @example
   * const base = new DB('users').where('active', 1)
   * const admins = base.clone().where('role', 'admin')
   * const mods   = base.clone().where('role', 'moderator')
   */
  clone(): DB

  // -------------------------------------------------------------------------
  // Aliasing
  // -------------------------------------------------------------------------

  /**
   * Alias the current query for use as a sub-query.
   * Has no effect when the query is used at the top level.
   */
  as(alias: string): this

  // -------------------------------------------------------------------------
  // Column selection
  // -------------------------------------------------------------------------

  /** Add one or more columns (or sub-queries) to the SELECT list. */
  select(...columns: ColumnRef[]): this

  /**
   * Add a `COUNT(column)` aggregate to the SELECT list.
   *
   * @example
   * new DB('orders').count('id')
   * // → SELECT COUNT(`id`) FROM `orders`
   */
  count(column: ColumnRef): this

  // -------------------------------------------------------------------------
  // WHERE clauses
  // -------------------------------------------------------------------------

  /**
   * Add an AND WHERE condition.
   *
   * Three-argument form (explicit operator):
   * ```ts
   * .where('age', '>=', 18)
   * ```
   *
   * Two-argument form (defaults to `=`):
   * ```ts
   * .where('status', 'active')
   * ```
   *
   * Object form (multiple equality conditions joined with AND):
   * ```ts
   * .where({ first_name: 'Alice', last_name: 'Smith' })
   * ```
   *
   * @throws {TypeError}   if `column` is `null` or `undefined`.
   * @throws {RangeError}  if `operator` is not in the allowed set.
   */
  where(column: WhereObject): this
  where(column: string, value: unknown): this
  where(column: string, operator: SqlOperator, value: unknown): this

  /**
   * Add an AND WHERE `column != value` condition.
   *
   * @throws {TypeError}  if `column` is `null` or `undefined`.
   */
  whereNot(column: WhereObject): this
  whereNot(column: string, value: unknown): this

  /**
   * Add an OR WHERE condition (same argument forms as {@link where}).
   *
   * @throws {TypeError}   if `column` is `null` or `undefined`.
   * @throws {RangeError}  if `operator` is not in the allowed set.
   */
  orWhere(column: WhereObject): this
  orWhere(column: string, value: unknown): this
  orWhere(column: string, operator: SqlOperator, value: unknown): this

  /**
   * Add a grouped AND WHERE clause.
   *
   * The callback receives a fresh `DB` instance; call `.where()` / `.orWhere()`
   * on it to populate the group.  The resulting conditions are wrapped in
   * parentheses and joined to the outer query with AND.
   *
   * @example
   * new DB('users')
   *   .where('active', 1)
   *   .whereGroup(q => q.where('role', 'admin').orWhere('role', 'moderator'))
   * // → SELECT * FROM `users` WHERE `active` = "1" AND (`role` = "admin" OR `role` = "moderator")
   */
  whereGroup(callback: (sub: DB) => void): this

  /**
   * Add a grouped OR WHERE clause (same semantics as {@link whereGroup} but
   * joined with OR).
   *
   * @example
   * new DB('users')
   *   .where('is_deleted', 0)
   *   .orWhereGroup(q => q.where('role', 'superadmin').where('active', 1))
   * // → … WHERE `is_deleted` = "0" OR (`role` = "superadmin" AND `active` = "1")
   */
  orWhereGroup(callback: (sub: DB) => void): this

  // -------------------------------------------------------------------------
  // JOIN
  // -------------------------------------------------------------------------

  /**
   * Add a JOIN clause.
   *
   * Two-column form (operator defaults to `=`):
   * ```ts
   * .join('contacts', 'users.id', 'contacts.user_id')
   * ```
   *
   * Explicit operator form:
   * ```ts
   * .join('logs', 'logs.user_id', '=', 'users.id')
   * ```
   *
   * @throws {RangeError}  if `operator` is not in the allowed set.
   */
  join(table: ColumnRef, tableColumn: string, joinedColumn: string): this
  join(table: ColumnRef, tableColumn: string, operator: SqlOperator, joinedColumn: string): this

  // -------------------------------------------------------------------------
  // Ordering
  // -------------------------------------------------------------------------

  /**
   * Add an ORDER BY clause.
   *
   * Direction is case-insensitive and normalised to uppercase internally.
   *
   * @param column    Column to order by.
   * @param direction `'ASC'` (default) or `'DESC'`.
   *
   * @throws {RangeError}  if `direction` is not `'ASC'` or `'DESC'` (case-insensitive).
   */
  orderBy(column: ColumnRef, direction?: OrderDirection): this

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  /**
   * Set the LIMIT value.
   *
   * @throws {TypeError}  if `data` cannot be parsed as a finite integer.
   */
  limit(data: number): this

  /**
   * Set the OFFSET value.  Has no effect unless `limit()` is also called.
   *
   * @throws {TypeError}  if `data` cannot be parsed as a finite integer.
   */
  offset(data: number): this

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------

  /**
   * Render the query as a plain SQL string with values **escaped inline**.
   *
   * ⚠️  Prefer {@link toSQL} + parameterised execution with your database
   * driver.  Inline escaping is provided for logging and debugging purposes.
   */
  toString(): string

  /**
   * Render the query in **parameterised form**.
   *
   * Values are replaced with `?` placeholders and collected into the returned
   * `bindings` array.  Pass both to your database driver:
   *
   * @example
   * const { sql, bindings } = new DB('users').where('id', userId).toSQL()
   * await db.execute(sql, bindings)
   */
  toSQL(): SqlResult
}

export default DB
