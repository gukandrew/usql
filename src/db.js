/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Andrew Guk

  DB SQL generator
*/

import RAW from '../src/raw'

/**
 * Allowed SQL comparison operators.
 * Validated in _where() and join() to prevent operator-injection attacks.
 */
const ALLOWED_OPERATORS = new Set([
  '=', '!=', '<>', '<', '>', '<=', '>=',
  'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT',
])

/**
 * Allowed ORDER BY directions (upper-cased for comparison).
 */
const ALLOWED_DIRECTIONS = new Set(['ASC', 'DESC'])

/**
 * Produce a SQL-safe double-quoted string literal.
 * Escapes the minimal set required by MySQL / SQLite / PostgreSQL:
 *   backslash    ->  \\
 *   NUL byte     ->  \0
 *   newline      ->  \n
 *   carriage ret ->  \r
 *   Ctrl-Z       ->  \Z  (MySQL EOF marker)
 *   double-quote ->  \"
 *
 * NOTE: Parameterised queries (.toSQL()) are strongly preferred over inline
 * escaping. Use this path only when you must produce a plain SQL string.
 *
 * @param {string} str
 * @returns {string}  e.g.  "hello \"world\""
 */
function _sqlEscapeString(str) {
  return (
    '"' +
    str
      .replace(/\\/g, '\\\\')
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z')
      .replace(/"/g, '\\"') +
    '"'
  )
}

/**
 * Assert that `op` is a member of ALLOWED_OPERATORS.
 * Throws RangeError on failure so callers get a loud, descriptive error
 * instead of silently producing injectable SQL.
 *
 * @param {string} op
 */
function _validateOperator(op) {
  if (!ALLOWED_OPERATORS.has(String(op).toUpperCase()) && !ALLOWED_OPERATORS.has(String(op))) {
    throw new RangeError(
      `usql: disallowed SQL operator "${op}". Allowed: ${[...ALLOWED_OPERATORS].join(', ')}`
    )
  }
}

class DB {
  table = null
  alias = null
  selects = []
  joins = []
  wheres = []
  orders = []
  dataOffset = null
  dataLimit = null

  constructor(table) {
    this.table = table
  }

  static raw(data) {
    return new RAW(data)
  }

  /**
   * Alias the current query for use as a sub-query.
   * Has no effect when the query is used at the top level.
   *
   * @param {string} alias
   * @returns {DB}
   */
  as(alias) {
    this.alias = alias

    return this
  }

  /**
   * Return a deep clone of this query builder instance.
   * Use this when sharing a base query across multiple call sites to avoid
   * accidental cross-request state bleeding.
   *
   * @returns {DB}
   */
  clone() {
    const copy = new DB(this.table)
    copy.alias = this.alias
    copy.selects = [...this.selects]
    copy.joins = this.joins.map((j) => [...j])
    copy.wheres = this.wheres.map((w) => ({ ...w }))
    copy.orders = this.orders.map((o) => [...o])
    copy.dataOffset = this.dataOffset
    copy.dataLimit = this.dataLimit
    return copy
  }

  /**
   * Escape a value for inline embedding (legacy helper — prefer .toSQL()).
   *
   * @param {*} data
   * @returns {string|null}
   */
  escape(data) {
    if (data === null) {
      return null
    }

    if (data instanceof DB || data instanceof RAW) {
      return data.toString()
    }

    return _sqlEscapeString(String(data)).slice(1, -1)
  }

  /**
   * Render a column / table / alias identifier as a backtick-quoted SQL name.
   *
   * @param {string|DB|RAW} name
   * @returns {string}
   */
  renderColumn(name) {
    if (name instanceof DB || name instanceof RAW) {
      return name.toString()
    }

    if (name === null || name === undefined) {
      return 'null'
    }

    if (String(name).toLowerCase() === 'null') {
      return 'null'
    }

    const renderWord = (word) => {
      let words = [...word.matchAll(/`?(\w+|\*)`?/g)]
      words = words.map((w) => {
        if (w[0] === '*' || w[1] === '*') {
          return '*'
        }
        return `\`${w[1] ? w[1] : w[0]}\``
      })
      return words.join('.')
    }

    const nameStr = String(name)
    if (nameStr.includes(' as ')) {
      return nameStr.split(' as ').map((n) => renderWord(n)).join(' as ')
    }

    return renderWord(nameStr)
  }

  /**
   * Render a WHERE-clause value for inline SQL (non-parameterised mode).
   *
   * @param {*} value
   * @returns {string}
   */
  renderStr(value) {
    if (value instanceof RAW) {
      return value.toString()
    }

    if (value === null) {
      return 'NULL'
    }

    return _sqlEscapeString(String(value))
  }

  /**
   * Internal WHERE clause accumulator.
   *
   * @param {'AND'|'OR'} joiner
   * @param {{ column, operator, value, group }} opts
   */
  _where(joiner = 'AND', { column, operator = '=', value, group = false }) {
    if (group) {
      this.wheres.push({ joiner, group: true, conditions: column })
      return
    }

    if (column === null || column === undefined) {
      throw new TypeError(
        'usql: where() column argument must not be null or undefined'
      )
    }

    if (typeof column === 'object') {
      _validateOperator(operator)
      Object.keys(column).forEach((key) => {
        this.wheres.push({ joiner, column: key, operator, value: column[key] })
      })
      return
    }

    if (typeof column === 'string') {
      if (typeof operator !== 'undefined' && typeof value === 'undefined') {
        value = operator
        operator = '='
      }

      _validateOperator(operator)
      this.wheres.push({ joiner, column, operator, value })
    }
  }

  where(column, operator = '=', value) {
    this._where('AND', { column, operator, value })
    return this
  }

  whereNot(column, value) {
    this._where('AND', { column, operator: '!=', value })
    return this
  }

  orWhere(column, operator, value) {
    this._where('OR', { column, operator, value })
    return this
  }

  /**
   * Add a grouped AND WHERE clause: WHERE ... AND (cond1 AND/OR cond2 ...).
   *
   * @param {function} callback  Receives a fresh DB instance; call .where() /
   *                             .orWhere() on it to build the group.
   * @returns {DB}
   */
  whereGroup(callback) {
    const sub = new DB(this.table)
    callback(sub)
    this._where('AND', { column: sub.wheres, group: true })
    return this
  }

  /**
   * Add a grouped OR WHERE clause: WHERE ... OR (cond1 AND/OR cond2 ...).
   *
   * @param {function} callback
   * @returns {DB}
   */
  orWhereGroup(callback) {
    const sub = new DB(this.table)
    callback(sub)
    this._where('OR', { column: sub.wheres, group: true })
    return this
  }

  join(table, tableColumn, operator, joinedColumn) {
    if (typeof operator !== 'undefined' && typeof joinedColumn === 'undefined') {
      joinedColumn = operator
      operator = '='
    }

    _validateOperator(operator)
    this.joins.push([table, tableColumn, operator, joinedColumn])
    return this
  }

  select(...args) {
    this.selects.push(...args)
    return this
  }

  count(column) {
    this.selects.push(DB.raw(`COUNT(${this.renderColumn(column)})`))
    return this
  }

  /**
   * Add an ORDER BY clause.
   * Direction is normalised to uppercase and validated against ASC / DESC.
   *
   * @param {string|DB|RAW} column
   * @param {'ASC'|'DESC'|'asc'|'desc'} [direction='ASC']
   * @returns {DB}
   */
  orderBy(column, direction = 'ASC') {
    const normalised = String(direction).toUpperCase()
    if (!ALLOWED_DIRECTIONS.has(normalised)) {
      throw new RangeError(
        `usql: invalid ORDER BY direction "${direction}". Must be 'ASC' or 'DESC'.`
      )
    }
    this.orders.push([column, normalised])
    return this
  }

  /**
   * Set the OFFSET value. Accepts integers only.
   * Rejects partial-parse inputs like '5; DROP TABLE ...' that parseInt
   * would silently truncate to a number.
   *
   * @param {number} data
   * @returns {DB}
   */
  offset(data) {
    const parsed = parseInt(data, 10)
    if (!Number.isFinite(parsed) || String(parsed) !== String(data).trim()) {
      throw new TypeError(
        `usql: offset() requires an integer, got: ${JSON.stringify(data)}`
      )
    }
    this.dataOffset = parsed
    return this
  }

  /**
   * Set the LIMIT value. Accepts integers only.
   * Rejects partial-parse inputs like '10 UNION SELECT ...' that parseInt
   * would silently truncate to a number.
   *
   * @param {number} data
   * @returns {DB}
   */
  limit(data) {
    const parsed = parseInt(data, 10)
    if (!Number.isFinite(parsed) || String(parsed) !== String(data).trim()) {
      throw new TypeError(
        `usql: limit() requires an integer, got: ${JSON.stringify(data)}`
      )
    }
    this.dataLimit = parsed
    return this
  }

  /**
   * Build the SQL string.
   *
   * When `bindings` is an Array the method collects parameter values into it
   * and emits `?` placeholders (parameterised mode).
   * When `bindings` is null values are escaped inline.
   *
   * @param {Array|null} bindings
   * @returns {string}
   */
  _buildSQL(bindings = null) {
    const parameterised = Array.isArray(bindings)

    const renderValue = (value) => {
      // NULL is never parameterised — drivers expect the literal keyword
      if (value === null) {
        return 'NULL'
      }
      if (parameterised) {
        if (value instanceof RAW) return value.toString()
        if (value instanceof DB) return value.toString()
        bindings.push(value)
        return '?'
      }
      return this.renderStr(value)
    }

    const renderConditions = (conditions) =>
      conditions
        .map(({ joiner, column, operator, value, group, conditions: subConds }, index) => {
          const prefix = index > 0 ? `${joiner} ` : ''

          if (group) {
            return `${prefix}(${renderConditions(subConds)})`
          }

          let op = operator
          if (value === null) {
            const replacements = { '!=': 'IS NOT', '<>': 'IS NOT', '=': 'IS' }
            op = replacements[op] !== undefined ? replacements[op] : op
          }

          return `${prefix}${this.renderColumn(column)} ${op} ${renderValue(value)}`
        })
        .join(' ')

    const query = []

    query.push('SELECT')
    query.push(
      this.selects.length > 0
        ? this.selects.map((s) => this.renderColumn(s)).join(', ')
        : '*'
    )

    query.push(`FROM ${this.renderColumn(this.table)}`)

    if (this.joins.length > 0) {
      query.push(
        this.joins
          .map(
            ([table, tableColumn, operator, joinedColumn]) =>
              `JOIN ${this.renderColumn(table)} ON ${this.renderColumn(tableColumn)} ${operator} ${this.renderColumn(joinedColumn)}`
          )
          .join(' ')
      )
    }

    if (this.wheres.length > 0) {
      query.push('WHERE')
      query.push(renderConditions(this.wheres))
    }

    if (this.orders.length > 0) {
      query.push('ORDER BY')
      query.push(
        this.orders
          .map(([column, direction]) => `${this.renderColumn(column)} ${direction}`)
          .join(', ')
      )
    }

    if (this.dataLimit !== null && this.dataOffset !== null) {
      query.push(`LIMIT ${this.dataOffset}, ${this.dataLimit}`)
    } else if (this.dataLimit !== null && this.dataOffset === null) {
      query.push(`LIMIT ${this.dataLimit}`)
    }

    let res = query.join(' ')

    if (this.alias !== null) {
      res = `(${res}) as ${this.renderColumn(this.alias)}`
    }

    return res
  }

  /**
   * Return the query as a plain SQL string with values escaped inline.
   *
   * Prefer .toSQL() + parameterised execution with your database driver.
   *
   * @returns {string}
   */
  toString() {
    return this._buildSQL(null)
  }

  /**
   * Return the query in parameterised form.
   *
   * Pass `sql` to your database driver and supply `bindings` as the
   * parameter array so the driver handles value escaping safely.
   *
   * @returns {{ sql: string, bindings: Array }}
   */
  toSQL() {
    const bindings = []
    const sql = this._buildSQL(bindings)
    return { sql, bindings }
  }
}

export default DB
