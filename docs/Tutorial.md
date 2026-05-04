# The Complete Fling Language Guide

> Everything you need to know to read, write, and understand Fling programs — and what the compiler does with them.

---

## Table of Contents

1. [What is Fling?](#1-what-is-fling)
2. [The Big Picture — How the Compiler Works](#2-the-big-picture--how-the-compiler-works)
3. [Basic Types](#3-basic-types)
4. [Unit Types](#4-unit-types)
5. [Ingredients (Variables)](#5-ingredients-variables)
6. [Expressions and Operators](#6-expressions-and-operators)
7. [Serve (Output / Return)](#7-serve-output--return)
8. [Recipes (Functions)](#8-recipes-functions)
9. [Prep Types (Structs)](#9-prep-types-structs)
10. [Control Flow](#10-control-flow)
11. [Collections (Lists)](#11-collections-lists)
12. [Steps (Side Effects)](#12-steps-side-effects)
13. [Built-in Functions](#13-built-in-functions)
14. [Comments](#14-comments)
15. [Static Checks — All 36](#15-static-checks--all-36)
16. [What the Compiler Does to Your Code](#16-what-the-compiler-does-to-your-code)
17. [Complete Example Programs](#17-complete-example-programs)
18. [Common Errors and What They Mean](#18-common-errors-and-what-they-mean)
19. [Keyword Reference](#19-keyword-reference)

---

## 1. What is Fling?

Fling is a statically-typed, recipe-themed programming language that compiles to JavaScript. Programs are structured like cooking recipes — variables are **ingredients**, functions are **recipes**, and results are **served**.

The defining feature of Fling is its **unit type system**. Numbers can carry physical units like `grams`, `ml`, `cups`, or `minutes`. The compiler checks that you never mix incompatible units — adding `grams` to `ml` is a compile-time type error, just like adding a string to an integer in Java.

**Why recipe theme?** Programming and cooking share the same structure: gather inputs, follow a process, produce an output. Fling makes that metaphor explicit in its syntax.

---

## 2. The Big Picture — How the Compiler Works

When you run `node src/fling.js myprogram.fling`, five things happen in sequence:

```
Source code (.fling file)
        ↓
    PARSER
    Reads the text and builds an Abstract Syntax Tree (AST)
    — a tree of objects representing the program's structure
        ↓
    ANALYZER
    Walks the AST and checks every static rule
    — types, scopes, unit compatibility, control flow
    — annotates every node with its resolved type
        ↓
    OPTIMIZER
    Transforms the AST to a simpler, equivalent AST
    — folds constants, eliminates dead code, reduces strength
        ↓
    GENERATOR
    Walks the optimized AST and emits JavaScript strings
        ↓
    JavaScript output (printed to stdout)
```

Each phase only runs if the previous one succeeded. A type error in the analyzer stops the pipeline — no JavaScript is ever emitted for an invalid program.

### What each file does

| File | Role | Input | Output |
|---|---|---|---|
| `fling.ohm` | Grammar — defines what syntax is legal | — | — |
| `parser.js` | Builds AST from source text | Source string | Program AST node |
| `core.js` | Defines all AST node shapes | — | — |
| `analyzer.js` | Type checks and annotates AST | Program AST | Annotated AST |
| `optimizer.js` | Simplifies AST | Annotated AST | Optimized AST |
| `generator.js` | Emits JavaScript | Optimized AST | JS string |
| `compiler.js` | Wires all phases together | Source string | JS string |
| `fling.js` | CLI entry point | File path | JS to stdout |

---

## 3. Basic Types

Fling has five primitive types:

| Type | Description | Example values |
|---|---|---|
| `count` | Integer (whole number) | `5`, `42`, `-3`, `0` |
| `amount` | Decimal (floating point) | `3.14`, `0.5`, `-1.0` |
| `truth` | Boolean | `yes`, `no` |
| `label` | String | `"hello"`, `"Matt"` |
| `nothing` | Void — used for recipes that don't return a value | — |

**`yes` and `no`** are Fling's boolean literals. They generate `true` and `false` in JavaScript.

**`nothing`** is only used as a return type on recipes. You cannot declare an ingredient of type `nothing`.

---

## 4. Unit Types

Unit types are the heart of Fling. They are subtypes of `amount` — every unit value is a number with a physical dimension attached.

### Supported Units

| Dimension | Units | Base unit |
|---|---|---|
| Weight | `grams`, `kg`, `oz`, `lbs` | `grams` |
| Volume | `ml`, `liters`, `cups`, `tbsp`, `tsp`, `floz` | `ml` |
| Temperature | `celsius`, `fahrenheit` | `celsius` |
| Time | `seconds`, `minutes`, `hours` | `seconds` |

### Unit Literals

Write a number immediately followed by the unit name — no space:

```fling
200g          -- 200 grams (g is shorthand for grams)
350ml         -- 350 milliliters
1kg           -- 1 kilogram
2cups         -- 2 cups
35minutes     -- 35 minutes
220celsius    -- 220 degrees celsius
1.5liters     -- 1.5 liters
```

### Arithmetic Rules

The unit type system enforces these rules at compile time:

| Operation | Valid? | Result type |
|---|---|---|
| `grams + grams` | ✅ | `grams` |
| `kg + grams` | ✅ | `grams` (normalized to base) |
| `cups + ml` | ✅ | `ml` (normalized to base) |
| `grams * count` | ✅ | `grams` |
| `count * grams` | ✅ | `grams` |
| `grams / count` | ✅ | `grams` |
| `grams / grams` | ✅ | `amount` (units cancel) |
| `grams + ml` | ❌ | TypeError — different dimensions |
| `grams * ml` | ❌ | TypeError — unit × unit |
| `grams / ml` | ❌ | TypeError — different dimensions |
| `grams + celsius` | ❌ | TypeError — different dimensions |

**Key insight:** When you add same-dimension units of different types (like `kg + grams`), the result is always in the **base unit** of that dimension. `1kg + 500g` = `1500` of type `grams`.

### What happens at runtime

Unit types are compile-time only. The generator strips them and emits plain numbers:

```fling
ingredient flour: grams = 200g
```
Generates:
```javascript
const flour = 200;
```

The unit checking all happens before JavaScript is emitted. At runtime there are no units — just numbers.

---

## 5. Ingredients (Variables)

An ingredient is a variable. Every ingredient has a name, a type, and an initial value.

### Declaration syntax

```fling
ingredient <name>: <type> = <expression>
```

### With explicit type

```fling
ingredient flour: grams = 200g
ingredient count: count = 5
ingredient name: label = "Matt"
ingredient done: truth = no
```

### With inferred type (no annotation needed)

```fling
ingredient flour = 200g        -- inferred as grams
ingredient total = 5 + 3       -- inferred as count
ingredient greeting = "hello"  -- inferred as label
```

Type inference figures out the type from the right-hand side. If you provide an explicit type AND a value, the compiler checks they match — mismatch is an error.

### Immutability

Ingredients are **immutable by default**. Once declared, you cannot reassign them:

```fling
ingredient x: count = 5
x = 10   -- TypeError: cannot assign to immutable ingredient 'x'
```

To make an ingredient mutable, use the `stirring` keyword:

```fling
stirring ingredient x: count = 5
x = 10   -- fine, x is stirring (mutable)
```

**Why immutable by default?** It encourages thinking about your program as a recipe — you don't change your ingredients mid-preparation, you produce new values from them.

### Scope rules

- Ingredients declared at the top level are global
- Ingredients declared inside a recipe body are local to that recipe
- Ingredients declared inside `taste`, `simmer`, or `batch` blocks are local to that block
- You cannot use an ingredient before you declare it — use before declare is a compile error
- You cannot declare two ingredients with the same name in the same scope

---

## 6. Expressions and Operators

### Arithmetic

```fling
5 + 3         -- 8 (count)
10 - 4        -- 6 (count)
3 * 4         -- 12 (count)
10 / 2        -- 5 (amount)
10 % 3        -- 1 (count) — modulo, integers only
200g + 100g   -- 300 (grams)
500g * 2      -- 1000 (grams)
```

### Comparison

```fling
5 > 3         -- yes (truth)
5 < 3         -- no (truth)
5 >= 5        -- yes (truth)
5 <= 4        -- no (truth)
5 == 5        -- yes (truth)
5 != 3        -- yes (truth)
200g > 100g   -- yes (truth) — same dimension only
```

Comparisons always produce `truth`. You cannot compare values of different dimensions.

### Boolean

```fling
yes and no    -- no (truth)
yes or no     -- yes (truth)
not yes       -- no (truth)
not no        -- yes (truth)
```

`and`, `or`, `not` only work on `truth` values — using them on numbers or labels is a type error.

### Operator precedence (highest to lowest)

```
- (negate)           unary minus
* / %                multiplication, division, modulo
+ -                  addition, subtraction
< > <= >=            comparison
== !=                equality
not                  logical not
and                  logical and
or                   logical or
```

### Parentheses

```fling
ingredient result = (5 + 3) * 2    -- 16
```

---

## 7. Serve (Output / Return)

`serve` does two different things depending on where it appears.

### At the top level

`serve` at the top level generates `console.log()`:

```fling
ingredient x = 5
serve x
```
Generates:
```javascript
const x = 5;
console.log(x);
```

### Inside a recipe

`serve` inside a recipe generates `return`:

```fling
recipe double(x: count) yields count:
  serve x * 2
```
Generates:
```javascript
function double(x) {
  return (x * 2);
}
```

### Rules

- Every recipe with a non-`nothing` return type **must** have a `serve` on every control flow path
- The type of the `serve` expression must match the recipe's `yields` type
- A `yields nothing` recipe must use bare `serve` (no expression) or omit it
- A `yields count` recipe cannot use bare `serve`

---

## 8. Recipes (Functions)

### Syntax

```fling
recipe <name>(<param>: <type>, ...) yields <type>:
  <body>
```

### Example

```fling
recipe add(a: count, b: count) yields count:
  ingredient result = a + b
  serve result
```

### Calling a recipe

```fling
ingredient answer = add(3, 5)
```

### Parameter rules

- Every parameter has a name and a type — both required
- Parameters are immutable inside the recipe body
- The argument types at the call site must match the parameter types
- The argument count must match exactly

### Yields nothing

```fling
recipe greet(name: label) yields nothing:
  step show: display(name)
```

A `yields nothing` recipe cannot `serve` a value — bare `serve` or no serve at all.

### Return path completeness

The analyzer checks that every possible execution path through a recipe ends in a `serve`. This is the same check Java does with "missing return statement":

```fling
recipe classify(x: count) yields label:
  taste x > 0:
    serve "positive"
  -- FlowError: missing serve on some paths
  -- (what if x is 0 or negative?)
```

Fix:
```fling
recipe classify(x: count) yields label:
  taste x > 0:
    serve "positive"
  otherwise:
    serve "not positive"
```

---

## 9. Prep Types (Structs)

A `prep` is a named collection of typed fields — equivalent to a struct or record.

### Declaration

```fling
prep Dough:
  flour: grams
  water: ml
  salt: grams
  yeast: grams
```

### Creating a prep value (struct literal)

```fling
ingredient my_dough = Dough { flour: 500g, water: 350ml, salt: 9g, yeast: 7g }
```

Rules for struct literals:
- The type name must be a declared `prep`
- All fields must be present — missing fields are an error
- No extra fields — unknown fields are an error
- Each field value must match the declared field type

### Accessing fields

```fling
ingredient flour_amount = my_dough.flour
step show: display(my_dough.water)
```

### Prep types in recipes

```fling
recipe make_dough(f: grams, w: ml) yields Dough:
  serve Dough { flour: f, water: w, salt: 9g, yeast: 7g }

ingredient loaf = make_dough(500g, 350ml)
serve loaf.flour
```

### Rules

- `prep` fields cannot have type `nothing`
- No duplicate field names in the same `prep`
- You cannot access a field that doesn't exist on a prep type
- You cannot access fields on non-prep values

---

## 10. Control Flow

### Taste (if/else)

```fling
taste <condition>:
  <body>
otherwise:
  <body>
```

- The condition must be `truth` type — using a `count` or `label` as a condition is a type error
- The `otherwise` clause is optional
- Both branches open a new scope

```fling
ingredient temp: celsius = 180celsius

taste temp > 200celsius:
  step warn: display("too hot!")
otherwise:
  step ok: display("temperature is fine")
```

### Simmer (while loop)

```fling
simmer <condition>:
  <body>
```

Runs the body repeatedly while the condition is `truth`. The condition is checked before each iteration.

```fling
stirring ingredient count: count = 10

simmer count > 0:
  step show: display(count)
  step decrement: count = count - 1
```

### Batch (for-each loop)

```fling
batch <item> in <collection>:
  <body>
```

Iterates over every element in a collection. The loop variable is typed automatically as the element type of the collection.

```fling
ingredient items: [label] = ["flour", "water", "salt"]

batch item in items:
  step show: display(item)
```

The collection must be a collection type — using `batch` on a non-collection is a type error.

### Toss (break)

```fling
toss
```

Exits the current `simmer` or `batch` loop immediately. Using `toss` outside a loop is a compile error.

```fling
stirring ingredient x: count = 0

simmer yes:
  step increment: x = x + 1
  taste x == 5:
    toss
```

### Skip (continue)

```fling
skip
```

Skips the rest of the current loop iteration and continues to the next one. Using `skip` outside a loop is a compile error.

### Spoiled (throw)

```fling
spoiled "something went wrong"
```

Throws a runtime error with the given message. Generates `throw new Error(message)` in JavaScript. Valid anywhere.

---

## 11. Collections (Lists)

A collection is an ordered list of values, all of the same type.

### Declaration

```fling
ingredient items: [label] = ["flour", "water", "salt"]
ingredient nums: [count] = [1, 2, 3, 4, 5]
ingredient weights: [grams] = [100g, 200g, 300g]
```

The type annotation `[label]` means "a collection of labels".

### Index access

```fling
ingredient first = items[0]
```

- The index must be `count` type — using a `grams` or `label` as an index is an error
- The collection must actually be a collection type — indexing a non-collection is an error
- Bounds checking is a **runtime** concern — the compiler does not check if the index is in range

### Size

```fling
ingredient n = size(items)    -- n is count
```

### Rules

- All elements must be the same type — mixed types in a collection literal are an error
- An empty collection literal `[]` is valid — its element type is inferred later
- Iterating a collection with `batch` gives you elements of the element type

---

## 12. Steps (Side Effects)

A `step` is a named statement that performs a side effect. It must have a name.

```fling
step <name>: <expression>
```

The name is required. It serves as documentation and appears in error messages.

```fling
step show_result: display(total)
step log_temp: display(oven_temp)
step update: count = count - 1
```

Steps cannot produce a value that is used elsewhere — if you need the result of an expression, use `ingredient`.

---

## 13. Built-in Functions

These are available everywhere without importing:

| Function | Signature | Description | Generates |
|---|---|---|---|
| `display(x)` | `any → nothing` | Print to stdout | `console.log(x)` |
| `size(col)` | `[any] → count` | Length of collection | `col.length` |
| `mix(a, b)` | `any, any → nothing` | Combine two things (no-op) | `{}` |
| `convert(x, unit)` | `any, label → any` | Runtime unit conversion | inline math |

`display` accepts any type and prints it. It does not return a value.

`size` requires a collection — passing a non-collection is a type error.

---

## 14. Comments

Single-line comments only. Use `--`:

```fling
-- this is a comment
ingredient x: count = 5   -- this is also a comment
```

There are no multi-line comments in Fling.

---

## 15. Static Checks — All 36

These are all the things the analyzer checks before generating any code.

### Scope (6 checks)

1. **Use before declaration** — you cannot reference an ingredient before the line where it's declared
2. **Duplicate variable in same scope** — two ingredients with the same name in the same block
3. **Duplicate recipe name** — two recipes with the same name
4. **Duplicate prep name** — two prep types with the same name
5. **Duplicate field in prep** — two fields with the same name in one prep
6. **Undeclared identifier** — referencing a name that doesn't exist anywhere in scope

### Types (18 checks)

7. **Unit dimension mismatch** — adding or subtracting values of different physical dimensions
8. **Unit multiplication** — multiplying two unit-typed values together (unit × unit is invalid)
9. **Incompatible unit division** — dividing unit values of different dimensions
10. **Modulo on unit types** — `%` only works on `count` and `amount`
11. **Comparing incompatible dimensions** — `200g > 100ml` is invalid
12. **Equality between different types** — `5 == "five"` is invalid
13. **and/or on non-truth** — both sides of `and`/`or` must be `truth`
14. **not on non-truth** — operand of `not` must be `truth`
15. **Negation of non-numeric** — `-"hello"` is invalid
16. **Condition must be truth** — `taste` and `simmer` conditions must be `truth` type
17. **Mixed type collection** — `[1, "hello", 2]` is invalid, all elements must match
18. **Index access on non-collection** — `x[0]` where `x` is not a collection
19. **Non-count index** — `items[0.5]` or `items[200g]` is invalid
20. **Field access on non-struct** — `x.flour` where `x` is not a prep type
21. **Nonexistent field** — accessing a field that isn't declared in the prep
22. **Unknown prep type in struct literal** — `Blah { ... }` where `Blah` is not declared
23. **Missing field in struct literal** — not providing all required fields
24. **Extra field in struct literal** — providing fields not in the prep declaration
25. **Wrong field type** — providing a value of the wrong type for a field
26. **Explicit type annotation mismatch** — declaring `ingredient x: count = "hello"`

### Control Flow (5 checks)

27. **toss outside loop** — `toss` only valid inside `simmer` or `batch`
28. **skip outside loop** — `skip` only valid inside `simmer` or `batch`
29. **Missing serve on all paths** — every branch of a non-nothing recipe must serve
30. **Serve type mismatch** — serving a `label` from a recipe that `yields count`
31. **Serve with expression in yields nothing** — `serve 5` inside a `yields nothing` recipe

### Access (1 check)

32. **Assignment to immutable ingredient** — reassigning a non-`stirring` ingredient

### Recipe Calls (2 checks)

33. **Wrong argument count** — calling a recipe with too many or too few arguments
34. **Wrong argument type** — passing `grams` where `count` is expected

### Prep fields (2 checks)

35. **Prep field with type nothing** — a prep field cannot be typed `nothing`
36. **Type inference consistency** — when type is inferred, it must be consistent with use

---

## 16. What the Compiler Does to Your Code

### Parsing

The Ohm.js grammar reads your source text character by character and builds a tree. Each node in the tree is an instance of a class from `core.js`. For example:

```fling
ingredient x: count = 5 + 3
```

Becomes an `IngredientDecl` node containing:
- `name`: `"x"`
- `type`: `PrimitiveType("count")`
- `initializer`: `BinaryExp("+", IntLit(5), IntLit(3))`
- `mutable`: `false`

### Analysis

The analyzer walks the tree and:
1. Builds a symbol table (scope chain) tracking every declared name
2. Resolves every identifier reference to its declaration
3. Computes the type of every expression
4. Checks all 36 static rules
5. Annotates every expression node with its resolved `.type`

### Optimization

The optimizer walks the annotated tree bottom-up and applies transformations:

**Constant folding:**
```fling
ingredient result = 5 + 3
```
The `BinaryExp("+", IntLit(5), IntLit(3))` node gets replaced with `IntLit(8)` at compile time.

**Unit normalization:**
```fling
ingredient total = 1kg + 500g
```
`1kg` → `1000g`, then `1000g + 500g` → `IntLit(1500)` of type `grams`.

**Dead code elimination:**
```fling
recipe f() yields count:
  serve 1
  step show: display(2)   -- removed, unreachable after serve
```

**Strength reduction:**
```fling
ingredient result = x * 1   -- becomes just x
ingredient result = x + 0   -- becomes just x
```

### Generation

The generator walks the optimized tree and emits JavaScript strings. Every AST node type has a corresponding JavaScript translation. Unit types become plain numbers. `yes`/`no` become `true`/`false`. Recipes become functions. `serve` inside a recipe becomes `return`. `serve` at the top level becomes `console.log`.

---

## 17. Complete Example Programs

### Program 1 — Hello World

```fling
ingredient greeting: label = "Hello from Fling!"
serve greeting
```

Generated JavaScript:
```javascript
const greeting = "Hello from Fling!";
console.log(greeting);
```

---

### Program 2 — Unit Arithmetic

```fling
ingredient flour_bag: kg = 1kg
ingredient flour_scoop: grams = 250g
ingredient total: grams = flour_bag + flour_scoop

ingredient batter: cups = 2cups
ingredient milk: ml = 120ml
ingredient liquid: ml = batter + milk

step show_flour: display(total)
step show_liquid: display(liquid)
serve total
```

Note: `1kg + 250g` → `1250g` (normalized). `2cups + 120ml` → `592.2ml` (normalized).

---

### Program 3 — Recipe with Prep Type

```fling
prep Dough:
  flour: grams
  water: ml
  salt: grams
  yeast: grams

recipe make_dough(f: grams, w: ml) yields Dough:
  serve Dough { flour: f, water: w, salt: 9g, yeast: 7g }

recipe bake(temp: celsius, duration: minutes) yields label:
  taste temp > 220celsius:
    serve "too hot"
  otherwise:
    serve "baking nicely"

ingredient loaf = make_dough(500g, 350ml)
ingredient result = bake(200celsius, 35minutes)

step show: display(result)
serve loaf.flour
```

---

### Program 4 — Loops

```fling
-- Batch loop over a collection
ingredient ingredients: [label] = ["flour", "water", "salt", "yeast"]

batch item in ingredients:
  step show: display(item)

-- Simmer loop with toss
stirring ingredient count: count = 10

simmer count > 0:
  step show_count: display(count)
  step decrement: count = count - 1
  taste count == 5:
    toss

serve "done"
```

---

### Program 5 — Scaling Recipe

```fling
recipe scale(amount: grams, factor: count) yields grams:
  ingredient scaled = amount * factor
  serve scaled

recipe scale_time(duration: minutes, factor: count) yields minutes:
  serve duration * factor

ingredient base_flour: grams = 500g
ingredient doubled_flour = scale(base_flour, 2)
ingredient doubled_time = scale_time(35minutes, 2)

step show_flour: display(doubled_flour)
step show_time: display(doubled_time)
serve doubled_flour
```

---

## 18. Common Errors and What They Mean

### TypeError: cannot add grams and ml
You tried to add values of different physical dimensions. Check that both sides of `+` are the same dimension.

### ReferenceError: 'x' not found
You used an ingredient name that was never declared, or declared it after you used it.

### ReferenceError: 'x' already declared in this scope
You declared two ingredients with the same name in the same block.

### TypeError: cannot assign to immutable ingredient 'x'
You tried to reassign an ingredient that wasn't declared with `stirring`.

### FlowError: recipe 'f' missing serve on some paths
Your recipe has a branch where execution can reach the end without hitting a `serve`. Add `otherwise` clauses to cover all cases.

### TypeError: serve expected count but got label
The expression you're serving doesn't match the recipe's `yields` type.

### FlowError: 'toss' used outside of simmer/batch
You used `toss` somewhere that isn't inside a loop. Move it inside a `simmer` or `batch`.

### TypeError: taste condition must be truth
The condition in your `taste` statement is not a boolean. It must evaluate to `yes` or `no`.

### TypeError: recipe 'f' expects 2 arguments but got 3
You called a recipe with the wrong number of arguments.

### TypeError: cannot assign label to count
Your explicit type annotation doesn't match the value you gave the ingredient.

---

## 19. Keyword Reference

| Keyword | Meaning | Equivalent in other languages |
|---|---|---|
| `ingredient` | variable declaration | `let`, `const`, `var` |
| `stirring` | mutable modifier | `let` (vs `const`) |
| `recipe` | function definition | `function`, `def` |
| `yields` | return type annotation | `: ReturnType` in TypeScript |
| `serve` | return / output | `return`, `print` |
| `prep` | struct type definition | `struct`, `class`, `record` |
| `taste` | conditional | `if` |
| `otherwise` | else branch | `else` |
| `simmer` | while loop | `while` |
| `batch` | for-each loop | `for...of`, `foreach` |
| `toss` | break out of loop | `break` |
| `skip` | continue to next iteration | `continue` |
| `spoiled` | throw an error | `throw new Error()` |
| `pantry` | import (parsed, not implemented) | `import` |
| `yes` | boolean true | `true` |
| `no` | boolean false | `false` |
| `--` | comment | `//` |

---

## Quick Reference Card

```
-- Variables
ingredient x: count = 5           -- immutable
stirring ingredient x: count = 5  -- mutable

-- Types
count   amount   truth   label   nothing
grams   kg   oz   lbs
ml   liters   cups   tbsp   tsp   floz
celsius   fahrenheit
seconds   minutes   hours
[count]   [label]   [grams]      -- collection types

-- Unit literals
200g   1kg   350ml   2cups   35minutes   220celsius

-- Recipes
recipe f(x: count, y: count) yields count:
  serve x + y

-- Prep types
prep Point:
  x: count
  y: count

ingredient p = Point { x: 3, y: 4 }
ingredient px = p.x

-- Control flow
taste condition:
  ...
otherwise:
  ...

simmer condition:
  ...

batch item in collection:
  ...

toss    -- break
skip    -- continue

-- Output
serve expression    -- console.log at top level
                    -- return inside recipe

-- Comments
-- this is a comment
```