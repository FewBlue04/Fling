import parse from "../src/parser.js"
import * as core from "../src/core.js"

const examples = [
  [
    "hello world",
    String.raw`-- hello.fling
ingredient greeting: label = "Hello from Fling!"
serve greeting`,
  ],
  [
    "simple addition",
    String.raw`-- simple_add.fling
ingredient x: count = 5
ingredient y: count = 3
ingredient result: count = x + y
serve result`,
  ],
  [
    "unit addition",
    String.raw`-- unit_add.fling
ingredient flour: grams = 200g
ingredient extra: grams = 100g
ingredient total = flour + extra
serve total`,
  ],
  [
    "full recipe",
    String.raw`-- bread.fling

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
step show: display(my_dough.flour)`,
  ],
  [
    "loop example",
    String.raw`-- countdown.fling
stirring ingredient count: count = 10

simmer count > 0:
  step show: display(count)
  step decrement: count = count - 1`,
  ],
  [
    "collection example",
    String.raw`-- ingredients_list.fling
ingredient items: [label] = ["flour", "water", "salt", "yeast"]

batch item in items:
  step show: display(item)`,
  ],
  [
    "intentional unit mismatch still parses",
    String.raw`-- error_unit.fling
ingredient flour: grams = 200g
ingredient milk: ml = 350ml
ingredient bad = flour + milk   -- TypeError: cannot add grams and ml`,
  ],
  [
    "intentional missing serve still parses",
    String.raw`-- error_no_serve.fling
recipe compute(x: count) yields count:
  ingredient y = x + 1
  -- FlowError: recipe 'compute' missing serve on all paths`,
  ],
  [
    "scaling recipe",
    String.raw`-- scaling.fling
recipe scale_recipe(flour: grams, factor: count) yields grams:
  ingredient scaled = flour * factor
  serve scaled

ingredient base: grams = 500g
ingredient double = scale_recipe(base, 2)
serve double`,
  ],
]

describe("the parser", () => {
  test.each(examples)("parses the Section 12 %s example", (_name, source) => {
    expect(parse(source)).toBeInstanceOf(core.Program)
  })

  test("builds a Program node for hello world", () => {
    const ast = parse(examples[0][1])

    expect(ast).toBeInstanceOf(core.Program)
    expect(ast.statements).toHaveLength(2)
    expect(ast.statements[0]).toBeInstanceOf(core.IngredientDecl)
    expect(ast.statements[0].name).toBe("greeting")
    expect(ast.statements[0].type).toEqual(new core.PrimitiveType("label"))
    expect(ast.statements[0].initializer).toEqual(
      new core.StringLit("Hello from Fling!")
    )
    expect(ast.statements[1]).toEqual(
      new core.ServeStmt(new core.IdRef("greeting"))
    )
  })

  test("builds the expected AST shape for simple addition", () => {
    const ast = parse(examples[1][1])

    expect(ast.statements).toHaveLength(4)
    expect(ast.statements[2]).toBeInstanceOf(core.IngredientDecl)
    expect(ast.statements[2].name).toBe("result")
    expect(ast.statements[2].initializer).toEqual(
      new core.BinaryExp("+", new core.IdRef("x"), new core.IdRef("y"))
    )
  })

  test("builds UnitLit nodes with numeric values and unit suffixes", () => {
    const ast = parse(examples[2][1])
    const flour = ast.statements[0]

    expect(flour.initializer).toBeInstanceOf(core.UnitLit)
    expect(flour.initializer.value).toBe(200)
    expect(flour.initializer.unit).toBe("g")
  })

  test("builds RecipeDecl nodes with parameters, return types, and bodies", () => {
    const ast = parse(examples[3][1])
    const recipe = ast.statements.find(
      (statement) => statement instanceof core.RecipeDecl
    )

    expect(recipe.name).toBe("make_dough")
    expect(recipe.params).toHaveLength(2)
    expect(recipe.params[0]).toEqual(
      new core.Param("flour", new core.UnitType("grams"))
    )
    expect(recipe.returnType).toEqual(new core.UserDefinedType("Dough"))
    expect(recipe.body).toHaveLength(2)
  })

  test("builds control-flow, call, field access, and collection nodes", () => {
    const fullRecipe = parse(examples[3][1])
    const bake = fullRecipe.statements.find(
      (statement) => statement instanceof core.RecipeDecl && statement.name === "bake"
    )
    expect(bake.body[0]).toBeInstanceOf(core.TasteStmt)
    expect(bake.body[0].condition).toBeInstanceOf(core.BinaryExp)
    expect(bake.body[0].alternate).toHaveLength(1)

    const show = fullRecipe.statements.at(-1)
    expect(show).toBeInstanceOf(core.StepStmt)
    expect(show.expression).toBeInstanceOf(core.CallExp)
    expect(show.expression.args[0]).toBeInstanceOf(core.FieldAccessExp)

    const collection = parse(examples[5][1])
    expect(collection.statements[0].initializer).toBeInstanceOf(
      core.CollectionLit
    )
    expect(collection.statements[1]).toBeInstanceOf(core.BatchStmt)
  })

  test.each([
    ["missing colon in typed ingredient", "ingredient x count = 1"],
    ["unclosed string", 'ingredient label: label = "oops'],
    ["keyword used as identifier", "ingredient recipe: count = 1"],
    ["missing recipe colon", "recipe f() yields count\n  serve 1"],
    ["missing parameter colon", "recipe f(x count) yields count:\n  serve x"],
    ["missing prep colon", "prep Dough\n  flour: grams"],
    ["missing step colon", "step show display(1)"],
    ["missing batch in keyword", "batch item items:\n  serve item"],
    ["malformed collection literal", "ingredient xs: [count] = [1, 2,"],
    ["malformed unit literal spacing", "ingredient flour: grams = 200 g"],
    ["unclosed struct literal", "ingredient d = Dough { flour: 1g"],
    ["keyword used as parameter", "recipe f(serve: count) yields count:\n  serve 1"],
  ])("rejects %s", (_name, source) => {
    expect(() => parse(source)).toThrow()
  })

  test("parses stirring ingredient declarations as mutable", () => {
    const ast = parse("stirring ingredient count: count = 10")

    expect(ast.statements[0]).toBeInstanceOf(core.IngredientDecl)
    expect(ast.statements[0].mutable).toBe(true)
  })

  test("parses pantry declarations", () => {
    const ast = parse('pantry "std.fling"')

    expect(ast.statements[0]).toBeInstanceOf(core.PantryDecl)
    expect(ast.statements[0].path).toEqual(new core.StringLit("std.fling"))
  })

  test("parses prep declarations with multiple fields", () => {
    const ast = parse(String.raw`prep Dough:
  flour: grams
  water: ml`)

    expect(ast.statements[0].fields).toEqual([
      new core.PrepField("flour", new core.UnitType("grams")),
      new core.PrepField("water", new core.UnitType("ml")),
    ])
  })

  test("parses float literals in expressions", () => {
    const ast = parse("ingredient hydration: amount = 1.5")

    expect(ast.statements[0].initializer).toEqual(new core.FloatLit(1.5))
  })

  test("parses collection type annotations", () => {
    const ast = parse("ingredient xs: [count] = [1, 2]")

    expect(ast.statements[0].type).toEqual(
      new core.CollectionType(new core.PrimitiveType("count"))
    )
  })

  test("parses batch loops", () => {
    const ast = parse(String.raw`ingredient xs: [count] = [1]
batch x in xs:
  step show: display(x)`)
    const batch = ast.statements[1]

    expect(batch).toBeInstanceOf(core.BatchStmt)
    expect(batch.varName).toBe("x")
    expect(batch.collection).toEqual(new core.IdRef("xs"))
  })

  test("parses toss inside simmer", () => {
    const ast = parse(String.raw`simmer yes:
  toss`)

    expect(ast.statements[0].body[0]).toBeInstanceOf(core.TossStmt)
  })

  test("parses skip inside batch", () => {
    const ast = parse(String.raw`ingredient xs: [count] = [1]
batch x in xs:
  skip`)

    expect(ast.statements[1].body[0]).toBeInstanceOf(core.SkipStmt)
  })

  test("parses spoiled statements", () => {
    const ast = parse('spoiled "burned"')

    expect(ast.statements[0]).toEqual(new core.SpoiledStmt(new core.StringLit("burned")))
  })

  test("parses struct literals with multiple fields", () => {
    const ast = parse("ingredient d = Dough { flour: 200g, water: 100ml }")
    const initializer = ast.statements[0].initializer

    expect(initializer).toBeInstanceOf(core.StructLit)
    expect(initializer.fields.map((field) => field.name)).toEqual(["flour", "water"])
  })

  test("parses otherwise clauses", () => {
    const ast = parse(String.raw`recipe choose() yields count:
  taste yes:
    serve 1
  otherwise:
    serve 2`)

    expect(ast.statements[0].body[0]).toBeInstanceOf(core.TasteStmt)
    expect(ast.statements[0].body[0].alternate).toEqual([
      new core.ServeStmt(new core.IntLit(2)),
    ])
  })

  test("parses nested recipe calls", () => {
    const ast = parse("ingredient result = outer(inner(1), 2)")
    const initializer = ast.statements[0].initializer

    expect(initializer).toBeInstanceOf(core.CallExp)
    expect(initializer.args[0]).toBeInstanceOf(core.CallExp)
    expect(initializer.args[0].callee).toEqual(new core.IdRef("inner"))
  })

  test("parses field access chains", () => {
    const ast = parse("ingredient amount = kitchen.dough.flour")
    const initializer = ast.statements[0].initializer

    expect(initializer).toBeInstanceOf(core.FieldAccessExp)
    expect(initializer.field).toBe("flour")
    expect(initializer.object).toEqual(
      new core.FieldAccessExp(new core.IdRef("kitchen"), "dough")
    )
  })

  test("keeps same-or-deeper indented statements in a nested block", () => {
    const ast = parse(String.raw`recipe f(flag: truth) yields nothing:
  taste flag:
    step show: display(1)
  step done: display(2)`)
    const recipe = ast.statements[0]

    expect(recipe.body).toHaveLength(1)
    expect(recipe.body[0]).toBeInstanceOf(core.TasteStmt)
    expect(recipe.body[0].consequent).toHaveLength(2)
    expect(recipe.body[0].consequent[1]).toBeInstanceOf(core.StepStmt)
  })

  test("parses simmer and batch statements inside recipe bodies", () => {
    const simmerAst = parse(String.raw`recipe f(flag: truth) yields nothing:
  simmer flag:
    skip`)
    const batchAst = parse(String.raw`recipe g(xs: [count]) yields nothing:
  batch x in xs:
    toss`)

    expect(simmerAst.statements[0].body[0]).toBeInstanceOf(core.SimmerStmt)
    expect(batchAst.statements[0].body[0]).toBeInstanceOf(core.BatchStmt)
  })

  test("parses a recipe body containing only a bare serve", () => {
    const ast = parse(String.raw`recipe doNothing() yields nothing:
  serve`)
    const recipe = ast.statements[0]

    expect(recipe).toBeInstanceOf(core.RecipeDecl)
    expect(recipe.body).toHaveLength(1)
    expect(recipe.body[0]).toEqual(new core.ServeStmt(null))
  })

  test("does not let one recipe body bleed into the next top-level recipe", () => {
    const ast = parse(String.raw`recipe first() yields count:
  serve 1

recipe second() yields count:
  serve 2`)
    const [first, second] = ast.statements

    expect(first).toBeInstanceOf(core.RecipeDecl)
    expect(second).toBeInstanceOf(core.RecipeDecl)
    expect(first.name).toBe("first")
    expect(first.body).toEqual([new core.ServeStmt(new core.IntLit(1))])
    expect(second.name).toBe("second")
    expect(second.body).toEqual([new core.ServeStmt(new core.IntLit(2))])
  })

  test("parses taste consequent and otherwise blocks with one statement each", () => {
    const ast = parse(String.raw`recipe check(x: truth) yields count:
  taste x:
    serve 1
  otherwise:
    serve 2`)
    const taste = ast.statements[0].body[0]

    expect(taste).toBeInstanceOf(core.TasteStmt)
    expect(taste.consequent).toHaveLength(1)
    expect(taste.consequent[0]).toEqual(new core.ServeStmt(new core.IntLit(1)))
    expect(taste.alternate).toHaveLength(1)
    expect(taste.alternate[0]).toEqual(new core.ServeStmt(new core.IntLit(2)))
  })
})
