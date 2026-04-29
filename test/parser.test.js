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
})
