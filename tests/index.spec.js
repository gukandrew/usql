import DB from '../src/index.js'

/* eslint-disable no-multi-str */
describe('index.js', () => {
  describe('select', () => {
    it('*', async () => {
      const sql = new DB('table')

      expect(sql.toString()).toEqual('SELECT * FROM `table`')
    })

    it('columns', async () => {
      const sql = new DB('table').select('column1').select('column2')

      expect(sql.toString()).toEqual('SELECT `column1`, `column2` FROM `table`')
    })

    it('raw', async () => {
      const sql = new DB('table').select(DB.raw('count(*) as item_number'))

      expect(sql.toString()).toEqual('SELECT count(*) as item_number FROM `table`')
    })

    it('count', async () => {
      const sql = new DB('table').count('column')

      expect(sql.toString()).toEqual('SELECT COUNT(`column`) FROM `table`')
    })

    it('sub-query', async () => {
      const counter = new DB('table').select(DB.raw('count(*) as item_number')).where('table.item_id', DB.raw('`table`.`item_id`')).as('item_number')
      const sql = new DB('table')
      sql.join(DB.raw('table2 as t2'), 'table.column', 't2.item_id')
      sql.select('table.*', counter)

      expect(sql.toString()).toEqual('SELECT `table`.*, \
(SELECT count(*) as item_number FROM `table` WHERE `table`.`item_id` = `table`.`item_id`) as `item_number` \
FROM `table` JOIN table2 as t2 ON `table`.`column` = `t2`.`item_id`'
      )
    })
  })

  describe('where', () => {
    it('plain syntax', async () => {
      const sql = new DB('table').where('table.column', '5')

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5"')
    })

    it('text', async () => {
      const sql = new DB('table').where({ 'table.column': '5' }).where({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" AND `column`.`column2` = "4"')
    })

    it('number', async () => {
      const sql = new DB('table').where({ 'table.column': 5 }).where({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" AND `column`.`column2` = "4"')
    })

    it('null', async () => {
      const sql = new DB('table').where({ 'table.column': null }).where({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` IS NULL AND `column`.`column2` = "4"')
    })
  })

  describe('orWhere', () => {
    it('plain syntax', async () => {
      const sql = new DB('table').where('table.column', '5').orWhere('table.column2', '5')

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" OR `table`.`column2` = "5"')
    })

    it('text', async () => {
      const sql = new DB('table').orWhere({ 'table.column': '5' }).orWhere({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" OR `column`.`column2` = "4"')
    })

    it('number', async () => {
      const sql = new DB('table').orWhere({ 'table.column': 5 })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5"')
    })

    it('null', async () => {
      const sql = new DB('table').orWhere({ 'table.column': null })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` IS NULL')
    })
  })

  describe('both where orWhere', () => {
    it('and or', async () => {
      const sql = new DB('table').where({ 'table.column': '5' }).orWhere({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" OR `column`.`column2` = "4"')
    })

    it('and and or or', async () => {
      const sql = new DB('table')

      sql.where({ 'table.column1': '1' }).where({ 'table.column2': '2' })
      sql.orWhere({ 'table.column3': '3' }).orWhere({ 'table.column4': '4' })

      expect(sql.toString())
        .toEqual('SELECT * FROM `table` WHERE `table`.`column1` = "1" AND `table`.`column2` = "2" OR `table`.`column3` = "3" OR `table`.`column4` = "4"')
    })


    it('and or and or and', async () => {
      const sql = new DB('table')

      sql.where({ 'table.column1': '1', 'table.column3': '3' }).orWhere({ 'table.column2': '2' })
      sql.where({ 'table.column3': '3' }).orWhere({ 'table.column4': '4' })
      sql.where({ 'table.column3': '5' })

      expect(sql.toString()).toEqual('\
SELECT * FROM `table` \
WHERE `table`.`column1` = "1" AND `table`.`column3` = "3" OR `table`.`column2` = "2" \
AND `table`.`column3` = "3" OR `table`.`column4` = "4" \
AND `table`.`column3` = "5"')
    })

    it('mixed', async () => {
      const date = Date.now()
      const sql = new DB('table').where('id', 1).whereNot('role', 'admin').orWhere({ 'created_at': date }).where({ 'is_deleted': 0 })

      expect(sql.toString()).toEqual(`SELECT * FROM \`table\` WHERE \`id\` = "1" AND \`role\` != "admin" OR \`created_at\` = "${date}" AND \`is_deleted\` = "0"`)
    })
  })

  describe('whereNot', () => {
    it('plain syntax', async () => {
      const sql = new DB('table').where('table.column', '5').whereNot('table.column2', '5')

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" AND `table`.`column2` != "5"')
    })

    it('text', async () => {
      const sql = new DB('table').whereNot({ 'table.column': '5', 'table.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` != "5" AND `table`.`column2` != "4"')
    })

    it('number', async () => {
      const sql = new DB('table').whereNot({ 'table.column': 5 })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` != "5"')
    })

    it('null', async () => {
      const sql = new DB('table').whereNot({ 'table.column': null })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` IS NOT NULL')
    })
  })

  describe('join', () => {
    it('base', async () => {
      const sql = new DB('table')

      sql.join('table', 'table.column1', 'table.column2')

      expect(sql.toString()).toEqual('SELECT * FROM `table` JOIN `table` ON `table`.`column1` = `table`.`column2`')
    })

    it('raw alias', async () => {
      const sql = new DB('table')

      sql.join(DB.raw('table2 as t2'), 'table.column1', 't2.column2')

      expect(sql.toString()).toEqual('SELECT * FROM `table` JOIN table2 as t2 ON `table`.`column1` = `t2`.`column2`')
    })

    it('with operator', async () => {
      const sql = new DB('table')

      sql.join('table', 'table.column1', '>', 'table.column2')

      expect(sql.toString()).toEqual('SELECT * FROM `table` JOIN `table` ON `table`.`column1` > `table`.`column2`')
    })
  })

  describe('as', () => {
    it('raw', async () => {
      const sql = new DB('table').select('column').as('subquery')

      expect(sql.toString()).toEqual('(SELECT `column` FROM `table`) as `subquery`')
    })
  })

  // Direction is now normalised to uppercase
  it('orderBy', async () => {
    const sql = new DB('table1').orderBy('table1.column1_value', 'desc')

    expect(sql.toString()).toEqual('SELECT * FROM `table1` ORDER BY `table1`.`column1_value` DESC')
  })

  describe('limit & offset', () => {
    it('limit', async () => {
      const sql = new DB('table1').limit(1)

      expect(sql.toString()).toEqual('SELECT * FROM `table1` LIMIT 1')
    })

    it('ignores offset without limit', async () => {
      const sql = new DB('table1').offset(1)

      expect(sql.toString()).toEqual('SELECT * FROM `table1`')
    })

    it('both', async () => {
      const sql = new DB('table1').limit(2).offset(5)

      expect(sql.toString()).toEqual('SELECT * FROM `table1` LIMIT 5, 2')
    })
  })

  // ---------------------------------------------------------------------------
  // toSQL — parameterised query output
  // ---------------------------------------------------------------------------
  describe('toSQL', () => {
    it('returns sql and empty bindings for no-where query', () => {
      const result = new DB('table').toSQL()

      expect(result).toEqual({ sql: 'SELECT * FROM `table`', bindings: [] })
    })

    it('produces ? placeholders for where values', () => {
      const result = new DB('table').where('id', 42).toSQL()

      expect(result.sql).toEqual('SELECT * FROM `table` WHERE `id` = ?')
      expect(result.bindings).toEqual([42])
    })

    it('collects multiple bindings in order', () => {
      const result = new DB('table').where('a', 1).where('b', 'hello').toSQL()

      expect(result.sql).toEqual('SELECT * FROM `table` WHERE `a` = ? AND `b` = ?')
      expect(result.bindings).toEqual([1, 'hello'])
    })

    it('renders NULL inline (not as a placeholder) for null values', () => {
      const result = new DB('table').where({ col: null }).toSQL()

      expect(result.sql).toEqual('SELECT * FROM `table` WHERE `col` IS NULL')
      expect(result.bindings).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // clone — instance isolation
  // ---------------------------------------------------------------------------
  describe('clone', () => {
    it('produces identical SQL', () => {
      const base = new DB('table').where('id', 1)
      const copy = base.clone()

      expect(copy.toString()).toEqual(base.toString())
    })

    it('mutations on clone do not affect original', () => {
      const base = new DB('table').where('id', 1)
      const copy = base.clone()
      copy.where('role', 'admin')

      expect(base.toString()).toEqual('SELECT * FROM `table` WHERE `id` = "1"')
      expect(copy.toString()).toEqual('SELECT * FROM `table` WHERE `id` = "1" AND `role` = "admin"')
    })

    it('mutations on original do not affect clone', () => {
      const base = new DB('table').where('id', 1)
      const copy = base.clone()
      base.limit(10)

      expect(copy.toString()).toEqual('SELECT * FROM `table` WHERE `id` = "1"')
    })
  })

  // ---------------------------------------------------------------------------
  // whereGroup / orWhereGroup — parenthesised conditions
  // ---------------------------------------------------------------------------
  describe('whereGroup', () => {
    it('wraps group conditions in parentheses (AND joiner)', () => {
      const sql = new DB('table')
        .where('active', 1)
        .whereGroup((q) => q.where('role', 'admin').orWhere('role', 'moderator'))

      expect(sql.toString()).toEqual(
        'SELECT * FROM `table` WHERE `active` = "1" AND (`role` = "admin" OR `role` = "moderator")'
      )
    })
  })

  describe('orWhereGroup', () => {
    it('wraps group conditions in parentheses (OR joiner)', () => {
      const sql = new DB('table')
        .where('is_deleted', 0)
        .orWhereGroup((q) => q.where('role', 'superadmin').where('active', 1))

      expect(sql.toString()).toEqual(
        'SELECT * FROM `table` WHERE `is_deleted` = "0" OR (`role` = "superadmin" AND `active` = "1")'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Security tests — every injection vector from the audit
  // ---------------------------------------------------------------------------
  describe('security', () => {
    // -------------------------------------------------------------------------
    // String escaping (was using global escape() URI-encoder)
    // -------------------------------------------------------------------------
    describe('string escaping', () => {
      it('preserves non-ASCII characters without percent-encoding', () => {
        const sql = new DB('table').where('name', 'café').toString()
        // old escape() would produce caf%E9; correct escaping preserves the char
        expect(sql).toContain('"café"')
        expect(sql).not.toContain('%E9')
      })

      it('escapes double quotes inside string values', () => {
        const sql = new DB('table').where('bio', 'say "hello"').toString()
        expect(sql).toContain('\\"hello\\"')
      })

      it('escapes backslashes inside string values', () => {
        const sql = new DB('table').where('path', 'C:\\Users\\admin').toString()
        expect(sql).toContain('C:\\\\Users\\\\admin')
      })

      it('escapes newlines inside string values', () => {
        const sql = new DB('table').where('note', 'line1\nline2').toString()
        expect(sql).toContain('\\n')
      })
    })

    // -------------------------------------------------------------------------
    // orderBy direction injection
    // -------------------------------------------------------------------------
    describe('orderBy direction injection', () => {
      it('throws RangeError on an injected direction payload', () => {
        expect(() =>
          new DB('table').orderBy('col', 'ASC LIMIT 0 UNION SELECT password FROM admin --')
        ).toThrow(RangeError)
      })

      it('throws RangeError on an empty direction string', () => {
        expect(() => new DB('table').orderBy('col', '')).toThrow(RangeError)
      })

      it('accepts asc (case-insensitive) and normalises to ASC', () => {
        const sql = new DB('table').orderBy('col', 'asc').toString()
        expect(sql).toContain('ORDER BY `col` ASC')
      })
    })

    // -------------------------------------------------------------------------
    // limit / offset injection
    // -------------------------------------------------------------------------
    describe('limit injection', () => {
      it('throws TypeError when limit is a SQL-injection string', () => {
        expect(() =>
          new DB('table').limit('10 UNION SELECT password FROM admin')
        ).toThrow(TypeError)
      })

      it('throws TypeError when limit is a non-numeric string', () => {
        expect(() => new DB('table').limit('abc')).toThrow(TypeError)
      })
    })

    describe('offset injection', () => {
      it('throws TypeError when offset is a SQL-injection string', () => {
        expect(() =>
          new DB('table').offset('5; DROP TABLE users --')
        ).toThrow(TypeError)
      })
    })

    // -------------------------------------------------------------------------
    // WHERE operator injection
    // -------------------------------------------------------------------------
    describe('where operator injection', () => {
      it('throws RangeError when operator contains a UNION payload', () => {
        expect(() =>
          new DB('table').where('id', '= 1 UNION SELECT password FROM admin --', 1)
        ).toThrow(RangeError)
      })

      it('throws RangeError for a bare semicolon operator', () => {
        expect(() => new DB('table').where('id', ';', 1)).toThrow(RangeError)
      })

      it('allows all standard comparison operators', () => {
        const ops = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE']
        ops.forEach((op) => {
          expect(() => new DB('table').where('col', op, 'val')).not.toThrow()
        })
      })
    })

    // -------------------------------------------------------------------------
    // join operator injection
    // -------------------------------------------------------------------------
    describe('join operator injection', () => {
      it('throws RangeError when join operator is an injection payload', () => {
        expect(() =>
          new DB('table').join('other', 'table.id', '= other.id UNION SELECT 1,2,3 --', 'other.id')
        ).toThrow(RangeError)
      })
    })

    // -------------------------------------------------------------------------
    // null / undefined column guard
    // -------------------------------------------------------------------------
    describe('null/undefined column guard', () => {
      it('throws TypeError when column is null', () => {
        expect(() => new DB('table').where(null, 'val')).toThrow(TypeError)
      })

      it('throws TypeError when column is undefined', () => {
        expect(() => new DB('table').where(undefined, 'val')).toThrow(TypeError)
      })
    })

    // -------------------------------------------------------------------------
    // String "null" type confusion
    // -------------------------------------------------------------------------
    describe('"null" string type confusion', () => {
      it('does NOT rewrite operator to IS when value is the string "null"', () => {
        const sql = new DB('table').where('col', 'null').toString()
        // Must produce = "null", not IS NULL
        expect(sql).toContain('= "null"')
        expect(sql).not.toContain('IS NULL')
      })

      it('DOES rewrite operator to IS when value is actual null', () => {
        const sql = new DB('table').where({ col: null }).toString()
        expect(sql).toContain('IS NULL')
      })
    })
  })
})

/* eslint-enable no-multi-str */
