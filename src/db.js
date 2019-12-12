/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Andrew Guk

  DB SQL generator
*/

import RAW from '../src/raw'

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

  as(alias) {
    this.alias = alias

    return this
  }

  escape(data) {
    if (data === null) {
      return null
    }

    if (data instanceof DB || data instanceof RAW) {
      return data.toString()
    }

    if (typeof data === 'string') {
      return JSON.stringify(data).slice(1, -1)
    }

    return JSON.stringify(data)
  }

  renderColumn(name) {
    if (name instanceof DB || name instanceof RAW) {
      return name.toString()
    }

    if (String(name).toLowerCase() === 'null') {
      return 'null'
    }

    const renderWord = (word) => {
      let words = [...word.matchAll(/`?(\w+|\*)`?/g)]
      words = words.map((w) => {
        if (w[0] === '*' || w[1] === '*') { // wildcard 'table.*'
          return '*'
        }

        return `\`${w[1] ? escape(w[1]) : escape(w[0])}\``
      })

      return words.join('.') // `table`.`column`
    }

    if (name.includes(' as ')) {
      return name.split(' as ').map((n) => renderWord(n)).join(' as ')
    }

    return renderWord(name)
  }

  renderStr(value) {
    if (value instanceof RAW) {
      return value.toString()
    }

    if (String(value).toLowerCase() === 'null') {
      return 'NULL'
    }

    if (Number(value) === value) {
      return `"${value}"`
    }

    return `"${escape(value)}"`
  }

  _where(joiner = 'AND', { column, operator = '=', value }) {
    if (typeof column === 'object') {
      Object.keys(column).forEach((key) => {
        this.wheres.push({ joiner, column: key, operator, value: column[key] })
      })
    }

    if (typeof column === 'string') {
      if (typeof operator !== 'undefined' && typeof value === 'undefined') {
        value = operator
        operator = '='
      }

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

  join(table, tableColumn, operator, joinedColumn) {
    if (typeof operator !== 'undefined' && typeof joinedColumn === 'undefined') {
      joinedColumn = operator
      operator = '='
    }

    this.joins.push([table, tableColumn, operator, joinedColumn])

    return this
  }

  select(...args) {
    // args = args.map((arg) => arg)
    this.selects.push(...args)

    return this
  }

  count(column) {
    this.selects.push(DB.raw(`COUNT(${this.renderColumn(column)})`))

    return this
  }

  orderBy(column, direction) {
    this.orders.push([column, direction])

    return this
  }

  offset(data) {
    this.dataOffset = data

    return this
  }

  limit(data) {
    this.dataLimit = data

    return this
  }

  toString() {
    const query = []
    const wheres = []

    query.push('SELECT')
    query.push(this.selects.length > 0 ? this.selects.map((s) => this.renderColumn(s)).join(', ') : '*')

    query.push(`FROM ${this.renderColumn(this.table)}`)

    if (this.joins.length > 0) {
      query.push(this.joins.map(([table, tableColumn, operator, joinedColumn]) =>
        `JOIN ${this.renderColumn(table)} ON ${this.renderColumn(tableColumn)} ${operator} ${this.renderColumn(joinedColumn)}`).join(' '))
    }

    if (this.wheres.length > 0) {
      const wheres = this.wheres.map(({ joiner, column, operator, value }, index) => {
        if (String(value).toLowerCase() === 'null') {
          const replacements = { '!=': 'IS NOT', '=': 'IS' }
          operator = replacements[operator] ? replacements[operator] : operator
        }

        joiner = index > 0 ? `${joiner} ` : ''
        return `${joiner}${this.renderColumn(column)} ${operator} ${this.renderStr(value, 'value')}`
      })

      query.push('WHERE')
      query.push(wheres.join(' '))
    }

    if (this.orders.length > 0) {
      query.push('ORDER BY')
      query.push(this.orders.map(([column, direction]) => `${this.renderColumn(column)} ${direction}`).join(', '))
    }

    if (this.dataLimit && this.dataOffset) {
      query.push(`LIMIT ${this.dataOffset}, ${this.dataLimit}`)
    } else if (this.dataLimit && !this.dataOffset) {
      query.push(`LIMIT ${this.dataLimit}`)
    }

    let res = query.join(' ')

    if (this.alias !== null) {
      res = `(${res}) as ${this.renderColumn(this.alias)}`
    }

    return res
  }
}

export default DB
