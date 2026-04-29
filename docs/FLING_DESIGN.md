# Fling Language — Complete Design Document

> This document is the authoritative specification for **Fling**, a statically-typed recipe-themed programming language compiled to JavaScript. It is written to instruct an AI implementation agent. Every section should be treated as a binding requirement unless marked `[OPTIONAL]`.

---

## 1. Project Overview

**Language name:** Fling  
**Theme:** Cooking / recipe preparation  
**Target:** JavaScript (via code generation)  
**Grammar tool:** Ohm.js  
**Test framework:** Jest (matching the Carlos compiler course pattern)  
**Entry point:** `src/fling.js`  
**Grammar file:** `src/fling.ohm`

Fling is a statically-typed language where programs are structured as collections of **recipes** (functions) that declare **ingredients** (variables), perform **steps** (statements), and **serve** a result (return). The distinguishing feature of Fling is its **unit type system**: numeric values carry physical units (grams, ml, cups, count, etc.) that are checked at compile time. Mixing incompatible units is a type error.

---

## 2. Repository Structure

```
.
├── .gitignore
├── README.md
├── LICENSE
├── package.json
├── .prettierrc.json
├── docs/
│   └── index.html          -- companion website
├── examples/
│   ├── hello.fling
│   ├── bread.fling
│   ├── smoothie.fling
│   ├── scaling.fling
│   └── errors/             -- intentional error examples
├── src/
│   ├── fling.js            -- CLI entry point
│   ├── fling.ohm           -- Ohm grammar
│   ├── compiler.js         -- orchestrates all phases
│   ├── core.js             -- AST node definitions
│   ├── analyzer.js         -- semantic analysis / type checker
│   ├── optimizer.js        -- AST optimizations
│   └── generator.js        -- JavaScript code generation
└── test/
    ├── compiler.test.js
    ├── parser.test.js
    ├── analyzer.test.js
    ├── optimizer.test.js
    └── generator.test.js
```

---

## 3. Language Concepts (Thematic Mapping)

| Fling concept | Programming concept | Keyword(s) |
|---|---|---|
| recipe | function / procedure | `recipe` |
| ingredient | variable declaration | `ingredient` |
| step | statement / action | `step` |
| serve | return statement | `serve` |
| taste | conditional (if) | `taste` |
| otherwise | else | `otherwise` |
| simmer | while loop | `simmer` |
| batch | for-each loop | `batch` |
| toss | break | `toss` |
| skip | continue | `skip` |
| pantry | module / import | `pantry` |
| spoiled | error / exception | `spoiled` |
| yields | return type annotation | `yields` |
| prep | type alias / struct | `prep` |
| note | comment | `--` |

---

## 4. Type System

### 4.1 Primitive Types

| Type name | Description | Example literals |
|---|---|---|
| `count` | Unitless integer | `3`, `42`, `-7` |
| `amount` | Unitless float | `3.14`, `0.5` |
| `truth` | Boolean | `yes`, `no` |
| `label` | String | `"hello"` |
| `nothing` | Void (no return value) | — |

### 4.2 Unit Types

Unit types are subtypes of `amount`. A value with a unit type carries both a numeric magnitude and a unit tag. Unit types are written as the unit name directly.

**Weight units:**
- `grams` (base)
- `kg` (= 1000 grams)
- `oz` (= 28.35 grams)
- `lbs` (= 453.59 grams)

**Volume units:**
- `ml` (base)
- `liters` (= 1000 ml)
- `cups` (= 236.6 ml)
- `tbsp` (= 14.79 ml)
- `tsp` (= 4.93 ml)
- `floz` (= 29.57 ml)

**Temperature units:**
- `celsius` (base)
- `fahrenheit` (conversion: (F - 32) * 5/9)

**Time units:**
- `seconds` (base)
- `minutes` (= 60 seconds)
- `hours` (= 3600 seconds)

**Unitless (numeric):**
- `count` — integer, no unit
- `amount` — float, no unit

### 4.3 Unit Literals

Unit literals combine a numeric value with a unit suffix directly:

```
200g         -- 200 grams
1.5cups      -- 1.5 cups
350ml        -- 350 milliliters
180celsius   -- 180 degrees celsius
60minutes    -- 60 minutes
```

Unitless numbers have no suffix: `5`, `3.14`

### 4.4 Unit Compatibility Rules (CRITICAL — enforced at compile time)

**Same-dimension units are compatible** (auto-converted to base unit):
- `grams + kg` → OK, result in grams
- `cups + ml` → OK, result in ml
- `minutes + seconds` → OK, result in seconds

**Cross-dimension operations are TYPE ERRORS:**
- `grams + ml` → ERROR
- `cups * minutes` → ERROR (unless multiplying by a unitless scalar)
- `celsius + minutes` → ERROR

**Scalar multiplication is always OK:**
- `200g * 2` → `400g` (scaling by a `count` or `amount`)
- `3 * 60minutes` → `180minutes`

**Division rules:**
- `grams / grams` → `amount` (unitless, they cancel)
- `grams / count` → `grams`
- `grams / ml` → ERROR (no compound units in Fling)

**Comparison:**
- Only values of the same dimension can be compared
- `200g > 100g` → OK
- `200g > 100ml` → ERROR

### 4.5 Compound / Struct Types

Defined with `prep`. Fields are typed. Used to group related ingredients.

```
prep Dough:
  flour: grams
  water: ml
  salt: grams
  yeast: grams
```

Access via dot notation: `my_dough.flour`

### 4.6 Type Inference

Fling supports local type inference for `ingredient` declarations when the type can be unambiguously determined from the right-hand side:

```
ingredient result = 200g + 100g    -- inferred as grams
ingredient name = "sourdough"      -- inferred as label
ingredient done = yes              -- inferred as truth
```

Explicit type annotation is always allowed and required for `recipe` parameters and return types:

```
ingredient x: grams = 200g
```

---

## 5. Syntax Specification

### 5.1 Program Structure

A Fling program is a sequence of top-level declarations:
- `prep` type definitions
- `pantry` imports
- `recipe` definitions
- Top-level `ingredient` declarations (constants)
- An optional top-level `serve` (program entry / main output)

```
-- simple_add.fling
ingredient x: count = 5
ingredient y: count = 3
ingredient result: count = x + y
serve result
```

### 5.2 Recipes (Functions)

```
recipe <name>(<param>: <type>, ...) yields <type>:
  <body>
```

Example:
```
recipe make_dough(flour: grams, water: ml) yields Dough:
  ingredient d: Dough = Dough { flour: flour, water: water, salt: 9g, yeast: 7g }
  serve d
```

Recipes with no return value use `yields nothing`:
```
recipe print_label(name: label) yields nothing:
  step show: display(name)
```

### 5.3 Ingredient Declarations (Variables)

```
ingredient <name>: <type> = <expr>      -- explicit type
ingredient <name> = <expr>              -- inferred type
```

Ingredients are immutable by default. Mutable ingredients use `stirring`:

```
stirring ingredient total: grams = 0g
```

### 5.4 Steps (Statements)

Named statements that perform side effects:

```
step <name>: <expression_or_call>
```

The name is required and is used for documentation and error messages. Steps cannot produce a value that is used elsewhere (use `ingredient` for that).

```
step combine: mix(flour, water)
step wait: rest(60minutes)
step show: display("done")
```

### 5.5 Control Flow

**Conditional:**
```
taste <condition>:
  <body>
otherwise:
  <body>
```

**While loop:**
```
simmer <condition>:
  <body>
```

**For-each loop:**
```
batch <item> in <collection>:
  <body>
```

**Break and continue:**
```
toss        -- break out of simmer/batch
skip        -- continue to next iteration
```

`toss` and `skip` are only valid inside `simmer` or `batch` blocks. The analyzer must enforce this.

### 5.6 Serve (Return)

```
serve <expr>
```

Every recipe with a non-`nothing` return type must have a `serve` statement on every control-flow path. The analyzer must enforce this (return-path analysis).

A recipe with `yields nothing` may omit `serve` or use bare `serve` with no expression.

### 5.7 Comments

```
-- this is a single-line comment
```

No multi-line comments.

### 5.8 Operators

| Operator | Operation | Notes |
|---|---|---|
| `+` | addition | unit-checked |
| `-` | subtraction | unit-checked |
| `*` | multiplication | scalar rules apply |
| `/` | division | unit cancellation rules apply |
| `%` | modulo | count/amount only |
| `==` | equality | same type required |
| `!=` | inequality | same type required |
| `<` `>` `<=` `>=` | comparison | same dimension required |
| `and` | logical and | truth only |
| `or` | logical or | truth only |
| `not` | logical not | truth only |

### 5.9 Built-in Functions

These are globally available and do not need to be declared:

| Function | Signature | Description |
|---|---|---|
| `display(x)` | `any → nothing` | print to stdout |
| `mix(a, b)` | `any, any → nothing` | side-effecting combine (no-op in JS gen) |
| `convert(x, unit)` | `unit_val, label → unit_val` | runtime unit conversion |
| `size(col)` | `collection → count` | length of a collection |

### 5.10 Collections (Lists)

```
ingredient items: [label] = ["salt", "flour", "water"]
ingredient nums: [count] = [1, 2, 3]
```

Collections are typed. All elements must be the same type. Index access:
```
ingredient first = items[0]
```

Bounds checking is a runtime concern (not static).

---

## 6. Grammar (Ohm.js)

The grammar lives in `src/fling.ohm`. Below is the complete specification. Implement this exactly.

```ohm
Fling {
  Program     = TopLevel*

  TopLevel    = PrepDecl
              | PantryDecl
              | RecipeDecl
              | IngredientDecl
              | TopServe

  -- Type definitions
  PrepDecl    = "prep" id ":" "\n" PrepField+
  PrepField   = "  " id ":" Type "\n"

  -- Imports
  PantryDecl  = "pantry" stringlit "\n"

  -- Recipe (function) definition
  RecipeDecl  = "recipe" id "(" Params ")" "yields" Type ":" Block

  Params      = ListOf<Param, ",">
  Param       = id ":" Type

  -- Variable declarations
  IngredientDecl = ("stirring")? "ingredient" id (":" Type)? "=" Exp

  -- Top-level serve (main output)
  TopServe    = "serve" Exp

  -- Block of statements
  Block       = Statement+

  Statement   = IngredientDecl
              | StepStmt
              | ServeStmt
              | TasteStmt
              | SimmerStmt
              | BatchStmt
              | TossStmt
              | SkipStmt
              | SpoiledStmt

  StepStmt    = "step" id ":" Exp
  ServeStmt   = "serve" Exp
              | "serve"
  TossStmt    = "toss"
  SkipStmt    = "skip"
  SpoiledStmt = "spoiled" Exp

  TasteStmt   = "taste" Exp ":" Block OtherwiseClause?
  OtherwiseClause = "otherwise" ":" Block

  SimmerStmt  = "simmer" Exp ":" Block

  BatchStmt   = "batch" id "in" Exp ":" Block

  -- Expressions
  Exp         = Exp "or" Exp1   -- or
              | Exp1

  Exp1        = Exp1 "and" Exp2  -- and
              | Exp2

  Exp2        = "not" Exp2       -- not
              | Exp3

  Exp3        = Exp3 relop Exp4  -- compare
              | Exp4

  Exp4        = Exp4 addop Exp5  -- add
              | Exp5

  Exp5        = Exp5 mulop Exp6  -- mul
              | Exp6

  Exp6        = "-" Exp6         -- negate
              | Exp7

  Exp7        = Exp7 "." id      -- field access
              | Exp7 "[" Exp "]" -- index access
              | Exp7 "(" Args ")"  -- call
              | Primary

  Primary     = "(" Exp ")"      -- parens
              | UnitLit
              | floatlit
              | intlit
              | stringlit
              | boollit
              | StructLit
              | CollectionLit
              | id

  StructLit   = id "{" FieldInits "}"
  FieldInits  = ListOf<FieldInit, ",">
  FieldInit   = id ":" Exp

  CollectionLit = "[" ListOf<Exp, ","> "]"

  Args        = ListOf<Exp, ",">

  -- Types
  Type        = PrimitiveType
              | UnitType
              | CollectionType
              | id              -- user-defined (prep) type

  PrimitiveType = "count" | "amount" | "truth" | "label" | "nothing"

  UnitType    = "grams" | "kg" | "oz" | "lbs"
              | "ml" | "liters" | "cups" | "tbsp" | "tsp" | "floz"
              | "celsius" | "fahrenheit"
              | "seconds" | "minutes" | "hours"

  CollectionType = "[" Type "]"

  -- Operators
  relop       = "<=" | ">=" | "==" | "!=" | "<" | ">"
  addop       = "+" | "-"
  mulop       = "*" | "/" | "%"

  -- Unit literals (number followed immediately by unit suffix, no space)
  UnitLit     = floatlit unitSuffix
              | intlit unitSuffix

  unitSuffix  = "grams" | "kg" | "oz" | "lbs"
              | "liters" | "ml" | "cups" | "tbsp" | "tsp" | "floz"
              | "celsius" | "fahrenheit"
              | "minutes" | "seconds" | "hours"

  -- Lexical rules
  boollit     = "yes" | "no"
  intlit      = digit+
  floatlit    = digit+ "." digit+
  stringlit   = "\"" (~"\"" any)* "\""
  id          = ~keyword letter (letter | digit | "_")*
  keyword     = ("recipe" | "ingredient" | "stirring" | "step" | "serve"
              | "taste" | "otherwise" | "simmer" | "batch" | "toss" | "skip"
              | "prep" | "pantry" | "spoiled" | "yields" | "yes" | "no"
              | "and" | "or" | "not" | "in") ~(letter | digit | "_")

  space      += "--" (~"\n" any)*   -- line comment
}
```

---

## 7. AST Node Definitions (`src/core.js`)

Define all AST node types. Use plain JavaScript classes or factory functions matching the Carlos pattern.

```javascript
// src/core.js

export class Program {
  constructor(statements) {
    this.statements = statements  // TopLevel[]
  }
}

export class PrepDecl {
  constructor(name, fields) {
    this.name = name      // string
    this.fields = fields  // PrepField[]
  }
}

export class PrepField {
  constructor(name, type) {
    this.name = name  // string
    this.type = type  // Type node
  }
}

export class RecipeDecl {
  constructor(name, params, returnType, body) {
    this.name = name            // string
    this.params = params        // Param[]
    this.returnType = returnType // Type node
    this.body = body            // Statement[]
  }
}

export class Param {
  constructor(name, type) {
    this.name = name  // string
    this.type = type  // Type node
  }
}

export class IngredientDecl {
  constructor(name, type, initializer, mutable) {
    this.name = name              // string
    this.type = type              // Type node or null (inferred)
    this.initializer = initializer // Exp node
    this.mutable = mutable        // boolean (stirring)
  }
}

export class StepStmt {
  constructor(name, expression) {
    this.name = name            // string
    this.expression = expression // Exp node
  }
}

export class ServeStmt {
  constructor(expression) {
    this.expression = expression  // Exp node or null
  }
}

export class TasteStmt {
  constructor(condition, consequent, alternate) {
    this.condition = consequent   // Exp node
    this.consequent = consequent  // Statement[]
    this.alternate = alternate    // Statement[] or null
  }
}

export class SimmerStmt {
  constructor(condition, body) {
    this.condition = condition  // Exp node
    this.body = body            // Statement[]
  }
}

export class BatchStmt {
  constructor(varName, collection, body) {
    this.varName = varName      // string
    this.collection = collection // Exp node
    this.body = body            // Statement[]
  }
}

export class TossStmt {}  // break
export class SkipStmt {}  // continue

export class SpoiledStmt {
  constructor(message) {
    this.message = message  // Exp node
  }
}

export class BinaryExp {
  constructor(op, left, right) {
    this.op = op      // string operator
    this.left = left  // Exp node
    this.right = right // Exp node
  }
}

export class UnaryExp {
  constructor(op, operand) {
    this.op = op          // string
    this.operand = operand // Exp node
  }
}

export class CallExp {
  constructor(callee, args) {
    this.callee = callee  // Exp node (usually id ref)
    this.args = args      // Exp[]
  }
}

export class FieldAccessExp {
  constructor(object, field) {
    this.object = object  // Exp node
    this.field = field    // string
  }
}

export class IndexAccessExp {
  constructor(collection, index) {
    this.collection = collection  // Exp node
    this.index = index            // Exp node
  }
}

export class StructLit {
  constructor(typeName, fields) {
    this.typeName = typeName  // string
    this.fields = fields      // { name: string, value: Exp }[]
  }
}

export class CollectionLit {
  constructor(elements) {
    this.elements = elements  // Exp[]
  }
}

export class UnitLit {
  constructor(value, unit) {
    this.value = value  // number
    this.unit = unit    // string (e.g. "grams", "ml")
  }
}

export class IntLit {
  constructor(value) { this.value = value }
}

export class FloatLit {
  constructor(value) { this.value = value }
}

export class StringLit {
  constructor(value) { this.value = value }
}

export class BoolLit {
  constructor(value) { this.value = value }  // boolean
}

export class IdRef {
  constructor(name) { this.name = name }
}

// Type nodes
export class PrimitiveType {
  constructor(name) { this.name = name }
}

export class UnitType {
  constructor(name) { this.name = name }
}

export class CollectionType {
  constructor(elementType) { this.elementType = elementType }
}

export class UserDefinedType {
  constructor(name) { this.name = name }
}
```

---

## 8. Semantic Analysis (`src/analyzer.js`)

The analyzer walks the AST and performs all static checks. It annotates AST nodes with type information. Errors are thrown using a standard error function (matching the Carlos pattern).

### 8.1 Symbol Table / Context

Use a scoped context object that:
- Has a `Map` from name → { type, mutable, kind } for the current scope
- Has a reference to a parent scope
- Supports `lookup(name)` which walks up the chain
- Supports `add(name, entity)` which adds to the current scope
- Detects duplicate declarations in the same scope (error)

Maintain separate namespaces for:
- Variables/ingredients (values)
- Recipes (functions)
- Prep types (struct types)

### 8.2 Unit Dimension System

Define a dimension for each unit:

```javascript
const DIMENSION = {
  grams: 'weight', kg: 'weight', oz: 'weight', lbs: 'weight',
  ml: 'volume', liters: 'volume', cups: 'volume',
  tbsp: 'volume', tsp: 'volume', floz: 'volume',
  celsius: 'temperature', fahrenheit: 'temperature',
  seconds: 'time', minutes: 'time', hours: 'time',
  count: 'scalar', amount: 'scalar',
}

const BASE_UNIT = {
  weight: 'grams', volume: 'ml', temperature: 'celsius', time: 'seconds', scalar: 'amount'
}
```

Unit compatibility check:
```javascript
function unitsCompatible(unitA, unitB) {
  return DIMENSION[unitA] === DIMENSION[unitB]
}
```

Result type of arithmetic on unit values:
- `unitA + unitB` where same dimension → result is base unit of that dimension
- `unitVal * count` or `count * unitVal` → result is same unit as unitVal
- `unitVal / unitVal` where same dimension → result is `amount`
- `unitVal / count` → result is same unit as unitVal

### 8.3 Checks Required (Complete List)

The analyzer must enforce ALL of the following:

**Scope checks:**
1. No variable used before it is declared (declaration must precede use in the same scope)
2. No duplicate variable name in the same scope
3. No duplicate recipe name
4. No duplicate prep type name
5. No duplicate field names within a `prep`
6. Undeclared identifiers are an error

**Type checks:**
7. Both sides of `+`, `-` must be compatible unit types OR both primitive numeric
8. `*` between two unit types is an error (only unit * scalar or scalar * unit is allowed)
9. `/` between unit types of same dimension → amount; different dimension → error
10. `%` only on `count` or `amount`
11. Comparison operators (`<`, `>`, `<=`, `>=`) require both sides same dimension
12. Equality operators (`==`, `!=`) require both sides same type
13. `and`, `or` require both sides `truth`
14. `not` requires operand `truth`
15. Negation (`-`) requires numeric or unit type
16. Condition in `taste` must be `truth`
17. Condition in `simmer` must be `truth`
18. Collection literal: all elements must be same type
19. Index access: collection must be a collection type, index must be `count`
20. Field access: object must be a `prep` type, field must exist in that prep
21. Struct literal: type name must be a declared `prep`, all fields present and correctly typed, no extra fields
22. Assignment to immutable ingredient is an error (only `stirring` ingredients can be reassigned)
23. Recipe call: argument count must match parameter count
24. Recipe call: each argument type must match parameter type (with unit dimension matching)
25. `serve` expression type must match recipe's declared `yields` type
26. `serve` with no expression only valid in `yields nothing` recipes
27. `serve` with expression not valid in `yields nothing` recipes

**Control flow checks:**
28. `toss` (`break`) only valid inside `simmer` or `batch`
29. `skip` (`continue`) only valid inside `simmer` or `batch`
30. Every recipe with non-`nothing` return type must have a `serve` on ALL paths (return-path completeness)
31. `spoiled` is valid anywhere inside a recipe

**Ingredient checks:**
32. Explicit type annotation, if present, must match the initializer's inferred type
33. Unused ingredient declarations emit a **warning** (not an error) — still compiles

**Prep/struct checks:**
34. Referencing a `prep` type that hasn't been declared is an error
35. A `prep` field cannot have type `nothing`

### 8.4 Type Annotation

After analysis, every Exp node must have a `.type` property set to its resolved type (a Type node from core.js). The generator relies on these annotations for unit conversion and output.

### 8.5 Error Format

All errors follow this format:
```
TypeError: cannot add grams and ml [line 7]
ReferenceError: 'flour' used before declaration [line 3]
FlowError: 'toss' used outside of simmer/batch [line 12]
FlowError: recipe 'make_bread' missing serve on some paths [line 2]
```

Use a `throw` with a custom error class. The compiler catches this and prints it, then exits with code 1.

---

## 9. Optimizer (`src/optimizer.js`)

The optimizer performs AST-to-AST transformations before code generation. Implement the following non-trivial optimizations:

### 9.1 Constant Folding

Evaluate constant expressions at compile time:
- `5 + 3` → `IntLit(8)`
- `200g + 100g` → `UnitLit(300, 'grams')`
- `yes and no` → `BoolLit(false)`
- `not yes` → `BoolLit(false)`
- `3 * 60minutes` → `UnitLit(180, 'minutes')`

Only fold when both operands are literals. Do not fold across variable references.

### 9.2 Unit Normalization

Convert unit literals to their base unit at compile time where units are mixed in an expression:
- `1cups + 236.6ml` → normalize both to ml, fold to `UnitLit(473.2, 'ml')`

This requires the conversion table:

```javascript
const TO_BASE = {
  grams: 1, kg: 1000, oz: 28.35, lbs: 453.59,
  ml: 1, liters: 1000, cups: 236.6, tbsp: 14.79, tsp: 4.93, floz: 29.57,
  celsius: 1, fahrenheit: null,  // fahrenheit uses a formula, skip for now
  seconds: 1, minutes: 60, hours: 3600,
}
```

### 9.3 Dead Code Elimination

Remove statements after an unconditional `serve` in a block:
- Any statement following `serve` in a linear block is unreachable → remove it and emit a warning

Remove `taste` branches whose condition is a known boolean literal:
- `taste yes: <body>` → always executes, replace with just `<body>`
- `taste no: <body> otherwise: <alt>` → replace with just `<alt>`

### 9.4 Strength Reduction

- `x * 1` → `x`
- `x + 0` → `x` (for unit types too: `x + 0g` → `x`)
- `x * 0` → `0` (or `0g` etc.)

---

## 10. Code Generator (`src/generator.js`)

Generate JavaScript from the optimized AST.

### 10.1 General Approach

Use a recursive `gen(node)` function that dispatches on node type. Output JavaScript as a string. The generated JS can use `console.log` for `display()`, plain arithmetic for numeric operations, and objects for `prep` struct instances.

### 10.2 Unit Representation at Runtime

Unit values are represented as plain JavaScript numbers at runtime. Unit checking is entirely static — the generator does not emit any runtime unit checks. This keeps the generated code clean.

Unit conversion (when needed in generated code) is done with inline arithmetic:
- `1cups` generates `236.6` (the ml-base value) if the context requires ml

However, since Fling normalizes in the optimizer, in most cases the generated value is already in base units.

### 10.3 Node Translations

| Fling | Generated JavaScript |
|---|---|
| `ingredient x: count = 5` | `let x = 5;` |
| `stirring ingredient x = 0` | `let x = 0;` |
| `recipe f(a: grams) yields grams:` | `function f(a) {` |
| `serve result` | `return result;` |
| `taste cond: ... otherwise: ...` | `if (cond) { ... } else { ... }` |
| `simmer cond: ...` | `while (cond) { ... }` |
| `batch item in list: ...` | `for (const item of list) { ... }` |
| `toss` | `break;` |
| `skip` | `continue;` |
| `spoiled msg` | `throw new Error(msg);` |
| `display(x)` | `console.log(x);` |
| `200g` | `200` |
| `1cups` | `236.6` (if normalized to ml) or `1` with comment |
| `[1, 2, 3]` | `[1, 2, 3]` |
| `items[0]` | `items[0]` |
| `dough.flour` | `dough.flour` |
| `Dough { flour: 200g }` | `({ flour: 200 })` |
| `yes` | `true` |
| `no` | `false` |
| `"hello"` | `"hello"` |
| `and` | `&&` |
| `or` | `\|\|` |
| `not` | `!` |
| `==` | `===` |
| `!=` | `!==` |

### 10.4 Built-in Functions

```javascript
// Preamble emitted at the top of every generated file
const PREAMBLE = `
function display(x) { console.log(x); }
function size(col) { return col.length; }
function convert(val, unit) { return val; } // no-op, static checking handles this
`;
```

### 10.5 Output

The generator returns a string of JavaScript. The CLI writes it to stdout or a file. Generated files should have a header comment:

```javascript
// Generated by the Fling compiler
// Do not edit by hand
```

---

## 11. CLI Entry Point (`src/fling.js`)

Follows the Carlos compiler pattern exactly:

```javascript
#!/usr/bin/env node
import fs from 'fs'
import process from 'process'
import compile from './compiler.js'

const filename = process.argv[2]
if (!filename) {
  console.error('Usage: fling <filename>')
  process.exit(1)
}

const source = fs.readFileSync(filename, 'utf-8')

try {
  const output = compile(source)
  process.stdout.write(output)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
```

### `src/compiler.js`

```javascript
import parse from './parser.js'
import analyze from './analyzer.js'
import optimize from './optimizer.js'
import generate from './generator.js'

export default function compile(source) {
  return generate(optimize(analyze(parse(source))))
}
```

### `src/parser.js`

```javascript
import ohm from 'ohm-js'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import * as core from './core.js'

const grammar = ohm.grammar(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fling.ohm'),
    'utf-8'
  )
)

const semantics = grammar.createSemantics()
semantics.addOperation('rep', {
  // ... map each grammar rule to its core.js AST node
  // see Section 6 grammar rules and Section 7 AST nodes for the mapping
})

export default function parse(source) {
  const match = grammar.match(source)
  if (match.failed()) throw new Error(match.message)
  return semantics(match).rep()
}
```

---

## 12. Example Programs

### 12.1 Hello World (simplest possible program)

```fling
-- hello.fling
ingredient greeting: label = "Hello from Fling!"
serve greeting
```

Generated JS:
```javascript
// Generated by the Fling compiler
function display(x) { console.log(x); }
const greeting = "Hello from Fling!";
console.log(greeting);
```

### 12.2 Simple Addition (5 + 3)

```fling
-- simple_add.fling
ingredient x: count = 5
ingredient y: count = 3
ingredient result: count = x + y
serve result
```

### 12.3 Unit Addition

```fling
-- unit_add.fling
ingredient flour: grams = 200g
ingredient extra: grams = 100g
ingredient total = flour + extra
serve total
```

### 12.4 Full Recipe

```fling
-- bread.fling

prep Dough:
  flour: grams
  water: ml
  salt: grams
  yeast: grams

recipe make_dough(flour: grams, water: ml) yields Dough:
  ingredient d = Dough { flour: flour, water: water, salt: 9g, yeast: 7g }
  serve d

recipe bake(temp: celsius, duration: minutes) yields label:
  taste temp > 250celsius:
    serve "too hot!"
  otherwise:
    serve "baking..."

ingredient my_dough = make_dough(500g, 350ml)
step show: display(my_dough.flour)
```

### 12.5 Loop Example

```fling
-- countdown.fling
stirring ingredient count: count = 10

simmer count > 0:
  step show: display(count)
  step decrement: count = count - 1
```

### 12.6 Collection Example

```fling
-- ingredients_list.fling
ingredient items: [label] = ["flour", "water", "salt", "yeast"]

batch item in items:
  step show: display(item)
```

### 12.7 Intentional Error (unit mismatch)

```fling
-- error_unit.fling
ingredient flour: grams = 200g
ingredient milk: ml = 350ml
ingredient bad = flour + milk   -- TypeError: cannot add grams and ml
```

### 12.8 Intentional Error (missing serve)

```fling
-- error_no_serve.fling
recipe compute(x: count) yields count:
  ingredient y = x + 1
  -- FlowError: recipe 'compute' missing serve on all paths
```

### 12.9 Scaling Recipe (demonstrates scalar multiplication)

```fling
-- scaling.fling
recipe scale_recipe(flour: grams, factor: count) yields grams:
  ingredient scaled = flour * factor
  serve scaled

ingredient base: grams = 500g
ingredient double = scale_recipe(base, 2)
serve double
```

---

## 13. Testing Requirements

All tests live in `test/`. 100% coverage is required. Use Jest.

### 13.1 `test/parser.test.js`

Test that valid programs parse without error, and invalid programs throw. Cover:
- All statement types
- All expression types
- All type annotations
- Unit literals
- Struct literals
- Collection literals
- Comments being ignored
- Keywords not usable as identifiers

### 13.2 `test/analyzer.test.js`

Test every error listed in Section 8.3 (all 35 checks). For each check:
- Write one test that should PASS (valid program)
- Write one test that should FAIL with the correct error message

### 13.3 `test/optimizer.test.js`

Test each optimization:
- Constant folding with literals
- Unit normalization
- Dead code elimination
- Strength reduction
- Confirm that optimized AST produces same runtime behavior

### 13.4 `test/generator.test.js`

Test code generation output:
- That each node type generates syntactically valid JS
- That the preamble is included
- That unit values are numbers in generated code
- That struct literals become JS objects

### 13.5 `test/compiler.test.js`

End-to-end tests: run `compile(source)` and check the JS output string or execution result. Cover all example programs in `examples/`.

---

## 14. `package.json`

```json
{
  "name": "fling",
  "version": "1.0.0",
  "description": "A recipe-themed statically typed programming language",
  "type": "module",
  "main": "src/fling.js",
  "bin": {
    "fling": "src/fling.js"
  },
  "scripts": {
    "test": "jest --coverage",
    "format": "prettier --write src test"
  },
  "dependencies": {
    "ohm-js": "^17.1.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "prettier": "^3.0.0"
  }
}
```

---

## 15. Static Analysis Summary (For Professor)

Fling performs the following at compile time:

| Check | Category |
|---|---|
| Scope resolution (use-before-declare) | Scope |
| Duplicate variable/recipe/type declarations | Scope |
| Undeclared identifier references | Scope |
| Type checking on all binary/unary operators | Types |
| Unit dimension compatibility (core feature) | Types |
| Scalar vs unit multiplication rules | Types |
| Unit cancellation in division | Types |
| Type inference for unannotated ingredients | Types |
| Explicit annotation consistency | Types |
| Recipe argument count and type matching | Types |
| `serve` type matches `yields` annotation | Types |
| Field access on non-struct types | Types |
| Field existence in struct access | Types |
| Struct literal completeness and field types | Types |
| Collection homogeneity (all elements same type) | Types |
| Index access on non-collection types | Types |
| Boolean context enforcement (taste, simmer) | Types |
| `toss`/`skip` outside loop | Control flow |
| Return-path completeness (every path has serve) | Control flow |
| Immutability enforcement (non-stirring ingredients) | Access |
| Unused ingredient warnings | Warnings |

**Total: 21 distinct static checks.** This satisfies the course requirement for significant static analysis.

---

## 16. Implementation Order (Recommended)

Build in this order, running tests at each stage:

1. **Grammar** — get `fling.ohm` parsing all example programs
2. **Parser** — implement the Ohm semantics to produce AST nodes
3. **Core** — all AST node definitions (no logic, just shapes)
4. **Analyzer** — scope and type checks, error reporting
5. **Generator** — basic JS output, no optimizations
6. **End-to-end** — run examples through the full pipeline
7. **Optimizer** — add constant folding, dead code elimination
8. **Tests** — fill in to 100% coverage
9. **Polish** — error messages, Prettier, README, companion site

---

## 17. Design Decisions and Rationale

**Why immutability by default?** It enforces good recipe thinking — a recipe doesn't change its ingredients mid-preparation; it produces new values. The `stirring` keyword makes mutation explicit and intentional (you're actively stirring something, changing it).

**Why named steps?** The `step name: expr` syntax forces the programmer to document what each action is doing. It also gives the compiler useful anchor points for error messages ("in step 'combine', line 7").

**Why no compound units?** Compound units (like `grams/ml` for density) would significantly complicate the type checker with diminishing educational returns. Fling's unit system is expressive enough to be interesting without going that far.

**Why `yields` instead of `returns`?** Theme consistency. A recipe yields a dish. The keyword also has no ambiguity — it's not an overloaded term in the culinary world.

**Why `serve` instead of `return`?** Same reason. You serve the finished dish. It also maps intuitively: you can only `serve` one thing, and once you serve, the recipe is done.
