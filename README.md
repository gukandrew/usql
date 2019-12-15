# µSQL

An easy-to-use super tiny flexible and 0-dependency SQL query builder with Knex compatible API!
Work both in browser and as node package.

## Installation
### yarn
```sh
yarn add usql
```
### npm
```sh
npm install usql
```

## Usage

```js
import USql from 'usql'

const sql = new USql('table').where({ 'column': '5', 'column2': '4' })
```
Then `sql.toString()` will produce:
```sql
SELECT * FROM `table` WHERE `column` = "5" AND `column2` = "4"
```

## API
### Column selection
#### select — .select([*columns])
```js
new USql('books').select('title', 'author', 'year')
```
Result:
```sql
SELECT `title`, `author`, `year` FROM `books`
```
Actually select is totally optional. When it isn't set then `*` will be used:
```js
new USql('books')
```
Result:
```sql
SELECT * FROM `books`
```

### Where Methods
#### where — .where(~mixed~)

Object Syntax:
```js
new USql('table').where({
  first_name: 'Test',
  last_name:  'User'
}).select('id')
```
Result:
```sql
SELECT `id` FROM `users` WHERE `first_name` = 'Test' AND `last_name` = 'User'
```

Key, Value:
```js
new USql('table').where('id', 1).where('info', null)
```
Result:
```sql
SELECT * FROM `users` WHERE `id` = "1" AND `info` IS NULL
```

Could be chained with other methods and with itself:
```js
new USql('table').where('id', 1).whereNot('role', 'admin').orWhere({ 'created_at': Date.now() }).where({ 'is_deleted': 0 })
```
Result:
```sql
SELECT * FROM `table` WHERE `id` = "1" AND `role` != "admin" OR `created_at` = "1576417577608" AND `is_deleted` = "0"
```

****

#### whereNot — .whereNot(~mixed~)

Object Syntax:
```js
new USql('table').whereNot({
  first_name: 'Test',
  last_name:  'User'
}).select('id')
```
Result:
```sql
SELECT `id` FROM `users` WHERE `first_name` != 'Test' AND `last_name` != 'User'
```

Key, Value:
```js
new USql('table').whereNot('id', 1).whereNot('name', null)
```
Result:
```sql
SELECT * FROM `users` WHERE `id` != "1" AND `name` IS NOT NULL
```

Could be chained with other methods and with itself.

****

#### orWhere — .orWhere(~mixed~)

Object Syntax:
```js
new USql('table').orWhere({
  first_name: 'Test',
  last_name:  'User'
}).select('id')
```
Result:
```sql
SELECT `id` FROM `users` WHERE `first_name` != 'Test' OR `last_name` != 'User'
```

Key, Value:
```js
new USql('table').orWhere('id', 1).orWhere('name', null)
```
Result:
```sql
SELECT * FROM `users` WHERE `id` != "1" OR `name` IS NOT NULL
```

Could be chained with other methods and with itself.

****

### Join method
#### join — .join(table, first, [operator], second)

Syntax:
```js
new USql('table')
  .join('contacts', 'users.id', '=', 'contacts.user_id')
  .select('id')
```
Result:
```sql
SELECT `id` FROM `table` JOIN `contacts` ON `users`.`id` = `contacts`.`user_id`
```

You can omit the operator value:
```js
new USql('table')
  .join('contacts', 'users.id', 'contacts.user_id')
  .select('id')
```
Result:
```sql
SELECT `id` FROM `table` JOIN `contacts` ON `users`.`id` = `contacts`.`user_id`
```

Could be chained with other methods and with itself.

****

### ClearClauses
#### orderBy — .orderBy(column|columns, [direction])

Adds an order by clause to the query. column can be string, or list mixed with string and object.

```js
new USql('table')
  .orderBy('table1.column1_value', 'desc')
```
Result:
```sql
SELECT * FROM `table1` ORDER BY `table1`.`column1_value` desc
```

Multiple orderBy syntax:
```js
new USql('table')
  .orderBy('table1.column1_value', 'desc')
  .orderBy('table1.column2_value', 'asc')
```
Result:
```sql
SELECT * FROM `table1` ORDER BY `table1`.`column1_value` desc, `table1`.`column2_value` asc
```

***

#### limit — .limit(value)

Adds a limit clause to the query.

```js
new USql('table').limit(2)
```
Result:
```sql
SELECT * FROM `table1` LIMIT 2
```

***

#### offset — .offset(value)

Adds an offset clause to the query. Doesn't work without explicit set of limit value
```js
new USql('table').limit(2).offset(5)
```
Result:
```sql
SELECT * FROM `table1` LIMIT 5, 2
```

#### as — .as(name)

Allows for aliasing a subquery, taking the string you wish to name the current query. If the query is not a sub-query, it will be ignored.
```js
new USql('table').select('column').as('subquery')
```
Result:
```sql
(SELECT `column` FROM `table`) as `subquery`
```

Usage:

```js
const subquery = new USql('groups').select('groups.name').where('users.group_id', USql.raw('`groups`.`id`')).as('group_name')

const sql = new USql('users').select('users.*', subquery)

```
Result:
```sql
SELECT `users`.*, (SELECT `groups`.`name` FROM `groups` WHERE `users`.`group_id` = `groups`.`id`) as `group_name` FROM `users`
```

***

### Raw queries

### raw — raw(statement)

Run an arbitrary sql query in the schema builder chain.

Syntax:

```js
new USql('users').select(DB.raw('count(*) as item_number'))
```
Result:
```sql
SELECT count(*) as item_number FROM `table`
```

Raw supported mostly everywhere including: select, where statments, join (for example for table aliasing) and order by column name.
