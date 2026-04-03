# µSQL

An easy-to-use super tiny flexible and 0-dependency SQL query builder with Knex compatible API!
Works both in the browser and as a Node.js package.

## Installation

### yarn

```sh
yarn add usql
```

### npm

```sh
npm install usql
```

## Quick Start

```js
import USql from "usql";

const sql = new USql("table").where({ column: "5", column2: "4" });
```

Then `sql.toString()` will produce:

```sql
SELECT * FROM `table` WHERE `column` = "5" AND `column2` = "4"
```

---

## Security

### Parameterised queries (recommended)

The safest way to execute a query is via `.toSQL()`, which returns a `{ sql, bindings }`
object. Pass `sql` and `bindings` directly to your database driver so it handles
value escaping:

```js
const { sql, bindings } = new USql("users").where("id", userId).toSQL();
// sql      → 'SELECT * FROM `users` WHERE `id` = ?'
// bindings → [userId]

await db.execute(sql, bindings); // driver binds values safely
```

`.toString()` is still available for logging and debugging, but it relies on inline
string escaping. Prefer `.toSQL()` for any code that talks to a real database.

### `DB.raw()` — use with care

`DB.raw()` inserts its argument **verbatim** into the generated SQL with **no escaping
or validation**. Only pass hard-coded string literals or values you have already
fully validated yourself:

```js
// ✅ Safe — hard-coded fragment
DB.raw("COUNT(*) as total");

// ❌ UNSAFE — never pass user input
DB.raw(req.query.column);
```

### Input validation

The following methods throw on invalid input rather than silently producing injectable SQL:

| Method                | Throws       | When                                     |
| --------------------- | ------------ | ---------------------------------------- |
| `where(col, op, val)` | `RangeError` | `op` is not in the allowed operator set  |
| `join(…, op, …)`      | `RangeError` | `op` is not in the allowed operator set  |
| `orderBy(col, dir)`   | `RangeError` | `dir` is not `'ASC'` or `'DESC'`         |
| `limit(n)`            | `TypeError`  | `n` cannot be parsed as a finite integer |
| `offset(n)`           | `TypeError`  | `n` cannot be parsed as a finite integer |
| `where(null, …)`      | `TypeError`  | column argument is `null` or `undefined` |

Allowed comparison operators: `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `IS`, `IS NOT`.

---

## API

### Column selection

#### select — `.select([...columns])`

```js
new USql("books").select("title", "author", "year");
```

Result:

```sql
SELECT `title`, `author`, `year` FROM `books`
```

`select` is optional — when omitted, `*` is used:

```js
new USql("books");
```

Result:

```sql
SELECT * FROM `books`
```

---

### Where Methods

#### where — `.where(~mixed~)`

Object syntax:

```js
new USql("users")
  .where({
    first_name: "Test",
    last_name: "User",
  })
  .select("id");
```

Result:

```sql
SELECT `id` FROM `users` WHERE `first_name` = "Test" AND `last_name` = "User"
```

Key/value (defaults to `=`):

```js
new USql("users").where("id", 1).where("info", null);
```

Result:

```sql
SELECT * FROM `users` WHERE `id` = "1" AND `info` IS NULL
```

Three-argument form (explicit operator):

```js
new USql("users").where("age", ">=", 18);
```

Result:

```sql
SELECT * FROM `users` WHERE `age` >= "18"
```

Can be chained:

```js
new USql("table")
  .where("id", 1)
  .whereNot("role", "admin")
  .orWhere({ created_at: Date.now() })
  .where({ is_deleted: 0 });
```

Result:

```sql
SELECT * FROM `table` WHERE `id` = "1" AND `role` != "admin" OR `created_at` = "1576417577608" AND `is_deleted` = "0"
```

---

#### whereNot — `.whereNot(~mixed~)`

Object syntax:

```js
new USql("users")
  .whereNot({
    first_name: "Test",
    last_name: "User",
  })
  .select("id");
```

Result:

```sql
SELECT `id` FROM `users` WHERE `first_name` != "Test" AND `last_name` != "User"
```

Key/value:

```js
new USql("users").whereNot("id", 1).whereNot("name", null);
```

Result:

```sql
SELECT * FROM `users` WHERE `id` != "1" AND `name` IS NOT NULL
```

---

#### orWhere — `.orWhere(~mixed~)`

Object syntax:

```js
new USql("users")
  .orWhere({
    first_name: "Test",
    last_name: "User",
  })
  .select("id");
```

Result:

```sql
SELECT `id` FROM `users` WHERE `first_name` = "Test" OR `last_name` = "User"
```

Key/value:

```js
new USql("users").orWhere("id", 1).orWhere("name", null);
```

Result:

```sql
SELECT * FROM `users` WHERE `id` = "1" OR `name` IS NULL
```

---

#### whereGroup — `.whereGroup(callback)`

#### orWhereGroup — `.orWhereGroup(callback)`

Group conditions in parentheses to control AND/OR precedence. The callback receives
a fresh builder; call `.where()` / `.orWhere()` on it to populate the group.

```js
new USql("users")
  .where("active", 1)
  .whereGroup((q) => q.where("role", "admin").orWhere("role", "moderator"));
```

Result:

```sql
SELECT * FROM `users` WHERE `active` = "1" AND (`role` = "admin" OR `role` = "moderator")
```

```js
new USql("users")
  .where("is_deleted", 0)
  .orWhereGroup((q) => q.where("role", "superadmin").where("active", 1));
```

Result:

```sql
SELECT * FROM `users` WHERE `is_deleted` = "0" OR (`role` = "superadmin" AND `active` = "1")
```

> **Why does this matter?** Without grouping, SQL evaluates `AND` before `OR`, so
> `.where('a', 1).orWhere('b', 2).where('c', 3)` produces
> `a = 1 OR b = 2 AND c = 3`, which is `a = 1 OR (b = 2 AND c = 3)` — almost never
> what you want in an authorization check. Use `whereGroup` / `orWhereGroup` to make
> precedence explicit.

---

### Join method

#### join — `.join(table, first, [operator], second)`

```js
new USql("table")
  .join("contacts", "users.id", "=", "contacts.user_id")
  .select("id");
```

Result:

```sql
SELECT `id` FROM `table` JOIN `contacts` ON `users`.`id` = `contacts`.`user_id`
```

You can omit the operator (defaults to `=`):

```js
new USql("table").join("contacts", "users.id", "contacts.user_id").select("id");
```

Result:

```sql
SELECT `id` FROM `table` JOIN `contacts` ON `users`.`id` = `contacts`.`user_id`
```

---

### Ordering

#### orderBy — `.orderBy(column, [direction])`

Direction defaults to `ASC` and is normalised to uppercase.

```js
new USql("table").orderBy("table1.column1_value", "DESC");
```

Result:

```sql
SELECT * FROM `table1` ORDER BY `table1`.`column1_value` DESC
```

Multiple columns:

```js
new USql("table")
  .orderBy("table1.column1_value", "DESC")
  .orderBy("table1.column2_value", "ASC");
```

Result:

```sql
SELECT * FROM `table1` ORDER BY `table1`.`column1_value` DESC, `table1`.`column2_value` ASC
```

---

### Pagination

#### limit — `.limit(value)`

```js
new USql("table").limit(2);
```

Result:

```sql
SELECT * FROM `table` LIMIT 2
```

#### offset — `.offset(value)`

Requires `limit()` to be set; ignored otherwise.

```js
new USql("table").limit(2).offset(5);
```

Result:

```sql
SELECT * FROM `table` LIMIT 5, 2
```

---

### Aliasing

#### as — `.as(name)`

Alias a sub-query. Ignored when the query is used at the top level.

```js
new USql("table").select("column").as("subquery");
```

Result:

```sql
(SELECT `column` FROM `table`) as `subquery`
```

Full sub-query example:

```js
const subquery = new USql("groups")
  .select("groups.name")
  .where("users.group_id", USql.raw("`groups`.`id`"))
  .as("group_name");

const sql = new USql("users").select("users.*", subquery);
```

Result:

```sql
SELECT `users`.*, (SELECT `groups`.`name` FROM `groups` WHERE `users`.`group_id` = `groups`.`id`) as `group_name` FROM `users`
```

---

### Cloning

#### clone — `.clone()`

Returns a deep copy of the builder. Use this when you want to reuse a base query
across multiple code paths without risk of shared-state mutation:

```js
const base = new USql("users").where("active", 1);

const admins = base.clone().where("role", "admin").limit(10);
const mods = base.clone().where("role", "moderator");

// base is unchanged
```

---

### Parameterised output

#### toSQL — `.toSQL()`

Returns `{ sql, bindings }` with `?` placeholders instead of inline values.
Pass both to your database driver for safe parameterised execution.

```js
const { sql, bindings } = new USql("users")
  .where("email", userEmail)
  .where("active", 1)
  .toSQL();

// sql      → 'SELECT * FROM `users` WHERE `email` = ? AND `active` = ?'
// bindings → [userEmail, 1]

await connection.execute(sql, bindings);
```

---

### Raw queries

#### raw — `USql.raw(statement)`

Inserts a raw SQL fragment verbatim. See the [Security](#security) section for
important warnings before use.

```js
new USql("users").select(USql.raw("count(*) as item_number"));
```

Result:

```sql
SELECT count(*) as item_number FROM `users`
```

`raw` is supported in `select`, `where`, `join`, and `orderBy`.

```

Now let me run the test suite to verify everything passes:
```
