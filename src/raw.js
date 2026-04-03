/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Andrew Guk
*/

/**
 * Wraps a raw SQL fragment that will be interpolated verbatim into the query.
 *
 * ⚠️  SECURITY WARNING: Content passed to RAW is inserted into SQL **without
 * any escaping or validation**. Never pass untrusted / user-supplied data to
 * this constructor. Only use it for hard-coded SQL fragments that you fully
 * control (e.g. function calls, expressions, or pre-validated identifiers).
 *
 * Safe example:
 *   DB.raw('COUNT(*) as total')
 *
 * UNSAFE — do NOT do this:
 *   DB.raw(req.query.column)   // attacker-controlled SQL injection
 */
export default class RAW {
  data

  constructor(data) {
    this.data = data
  }

  toString() {
    return this.data
  }
}
