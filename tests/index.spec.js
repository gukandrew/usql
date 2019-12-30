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

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" AND `column`.`column2` = \"4\"')
    })

    it('number', async () => {
      const sql = new DB('table').where({ 'table.column': 5 }).where({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` = "5" AND `column`.`column2` = \"4\"')
    })

    it('null', async () => {
      const sql = new DB('table').where({ 'table.column': null }).where({ 'column.column2': '4' })

      expect(sql.toString()).toEqual('SELECT * FROM `table` WHERE `table`.`column` IS NULL AND `column`.`column2` = \"4\"')
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
WHERE `table`.`column1` = "1" AND `table`.`column3` = \"3\" OR `table`.`column2` = "2" \
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

  it('orderBy', async () => {
    const sql = new DB('table1').orderBy('table1.column1_value', 'desc')

    expect(sql.toString()).toEqual('SELECT * FROM `table1` ORDER BY `table1`.`column1_value` desc')
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
})

/* eslint-enable no-multi-str */
