import { PrimitiveType, UnitType } from '../src/core.js'
import * as core from '../src/core.js'
import analyze, { resultUnit, typeEqual, unitsCompatible } from '../src/analyzer.js'
import parse from '../src/parser.js'

const check = (src) => analyze(parse(src))
const checkError = (src, pattern) => expect(() => check(src)).toThrow(pattern)

describe('unit system', () => {
  test('unit compatibility follows dimensions', () => {
    expect(unitsCompatible('grams', 'kg')).toBe(true)
    expect(unitsCompatible('grams', 'ml')).toBe(false)
    expect(unitsCompatible('count', 'amount')).toBe(true)
  })

  test('same dimension addition returns base unit', () => {
    expect(resultUnit('+', new UnitType('grams'), new UnitType('kg'))).toEqual(
      new UnitType('grams'),
    )
  })

  test('unit times scalar returns the unit', () => {
    expect(resultUnit('*', new UnitType('grams'), new PrimitiveType('count'))).toEqual(
      new UnitType('grams'),
    )
  })

  test('scalar times unit returns the unit', () => {
    expect(resultUnit('*', new PrimitiveType('count'), new UnitType('ml'))).toEqual(
      new UnitType('ml'),
    )
  })

  test('same dimension unit division returns amount', () => {
    expect(resultUnit('/', new UnitType('grams'), new UnitType('grams'))).toEqual(
      new PrimitiveType('amount'),
    )
  })

  test('different dimension unit division throws', () => {
    expect(() => resultUnit('/', new UnitType('grams'), new UnitType('ml'))).toThrow(TypeError)
  })

  test('different dimension unit addition throws', () => {
    expect(() => resultUnit('+', new UnitType('grams'), new UnitType('ml'))).toThrow(TypeError)
  })

  test('count plus count returns count', () => {
    expect(resultUnit('+', new PrimitiveType('count'), new PrimitiveType('count'))).toEqual(
      new PrimitiveType('count'),
    )
  })

  test('count plus amount returns amount', () => {
    expect(resultUnit('+', new PrimitiveType('count'), new PrimitiveType('amount'))).toEqual(
      new PrimitiveType('amount'),
    )
  })

  test('scalar divided by unit throws', () => {
    expect(() => resultUnit('/', new PrimitiveType('count'), new UnitType('grams'))).toThrow(
      /cannot \/ count and grams/,
    )
  })

  test('unrelated primitive and unit operation throws', () => {
    expect(() => resultUnit('+', new PrimitiveType('label'), new UnitType('grams'))).toThrow(
      /cannot \+ label and grams/,
    )
  })

  test('different type categories are not equal', () => {
    expect(typeEqual(new PrimitiveType('count'), new UnitType('grams'))).toBe(false)
  })
})

describe('the analyzer', () => {
  describe('valid programs', () => {
    test('accepts pantry declarations', () => {
      expect(() => check('pantry "utils.fling"')).not.toThrow()
    })

    test('accepts valid ingredient declaration with explicit type', () => {
      const program = check('ingredient servings: count = 4')

      expect(program.statements[0].type).toEqual(new core.PrimitiveType('count'))
    })

    test('accepts valid ingredient declaration with inferred type', () => {
      const program = check('ingredient flour = 200g')

      expect(program.statements[0].type).toEqual(new core.UnitType('grams'))
    })

    test('accepts valid recipe with correct serve type', () => {
      const program = check(String.raw`recipe double(x: count) yields count:
  serve x * 2`)

      expect(program.statements[0].body[0].type).toEqual(new core.PrimitiveType('count'))
    })

    test('accepts valid recipe with yields nothing and bare serve', () => {
      const program = check(String.raw`recipe done() yields nothing:
  serve`)

      expect(program.statements[0].body[0].type).toEqual(new core.PrimitiveType('nothing'))
    })

    test('accepts valid taste statement', () => {
      const program = check(String.raw`recipe show(ready: truth) yields nothing:
  taste ready:
    step show: display("yes")
  otherwise:
    step show: display("no")`)

      expect(program.statements[0].body[0]).toBeInstanceOf(core.TasteStmt)
      expect(program.statements[0].body[0].condition.type).toEqual(new core.PrimitiveType('truth'))
    })

    test('accepts valid simmer loop', () => {
      const program = check(String.raw`stirring ingredient n: count = 2
simmer n > 0:
  step dec: n = n - 1`)

      expect(program.statements[1]).toBeInstanceOf(core.SimmerStmt)
      expect(program.statements[1].condition.type).toEqual(new core.PrimitiveType('truth'))
    })

    test('accepts valid batch loop with toss and skip inside', () => {
      const program = check(String.raw`ingredient xs: [count] = [1, 2]
batch x in xs:
  skip
  toss`)

      expect(program.statements[1].body).toEqual([
        expect.any(core.SkipStmt),
        expect.any(core.TossStmt),
      ])
    })

    test('accepts valid struct literal with all fields', () => {
      const program = check(String.raw`prep Dough:
  flour: grams
  water: ml
ingredient d: Dough = Dough { flour: 200g, water: 100ml }`)

      expect(program.statements[1].initializer.type).toEqual(new core.UserDefinedType('Dough'))
    })

    test('accepts valid collection literal', () => {
      const program = check('ingredient xs: [count] = [1, 2, 3]')

      expect(program.statements[0].initializer.type).toEqual(
        new core.CollectionType(new core.PrimitiveType('count')),
      )
    })

    test('accepts valid field access on prep type', () => {
      const program = check(String.raw`prep Dough:
  flour: grams
ingredient d: Dough = Dough { flour: 200g }
ingredient f: grams = d.flour`)

      expect(program.statements[2].initializer.type).toEqual(new core.UnitType('grams'))
    })

    test('accepts valid index access on collection', () => {
      const program = check(String.raw`ingredient xs: [count] = [1, 2]
ingredient first: count = xs[0]`)

      expect(program.statements[1].initializer.type).toEqual(new core.PrimitiveType('count'))
    })

    test('accepts valid recipe call with correct args', () => {
      const program = check(String.raw`recipe add(x: count, y: count) yields count:
  serve x + y
ingredient total: count = add(2, 3)`)

      expect(program.statements[1].initializer.type).toEqual(new core.PrimitiveType('count'))
    })

    test('accepts valid stirring ingredient reassignment', () => {
      const program = check(String.raw`stirring ingredient n: count = 1
step bump: n = n + 1`)

      expect(program.statements[1].expression.type).toEqual(new core.PrimitiveType('count'))
    })

    test('accepts valid spoiled statement', () => {
      const program = check('spoiled "burned"')

      expect(program.statements[0].type).toEqual(new core.PrimitiveType('label'))
    })

    test('accepts valid display() call', () => {
      const program = check('step show: display("hi")')

      expect(program.statements[0].type).toEqual(new core.PrimitiveType('nothing'))
    })

    test('accepts valid size() call on collection', () => {
      const program = check(String.raw`ingredient xs: [count] = [1, 2]
ingredient n: count = size(xs)`)

      expect(program.statements[1].initializer.type).toEqual(new core.PrimitiveType('count'))
    })

    test('accepts valid convert() call', () => {
      const program = check('ingredient flour: grams = convert(1kg, "grams")')

      expect(program.statements[0].initializer.type).toEqual(new core.UnitType('grams'))
    })

    test('accepts valid mix() call', () => {
      const program = check('step stir: mix(1, 2)')

      expect(program.statements[0].type).toEqual(new core.PrimitiveType('nothing'))
    })

    test('accepts top-level bare serve as nothing', () => {
      const program = analyze(new core.Program([new core.ServeStmt(null)]))

      expect(program.statements[0].type).toEqual(new core.PrimitiveType('nothing'))
    })

    test('accepts empty collection literals as unknown collections', () => {
      const program = check('ingredient xs: [count] = []')

      expect(program.statements[0].initializer.type).toEqual(new core.CollectionType(null))
    })

    test('reports unknown element types from empty collection indexing', () => {
      checkError(
        String.raw`ingredient xs = []
ingredient field = xs[0].flour`,
        /cannot access field 'flour' on unknown/,
      )
    })

    test('ignores string pseudo-statements in analyzed programs', () => {
      const program = analyze(
        new core.Program([
          'comment marker',
          new core.IngredientDecl('x', new core.PrimitiveType('count'), new core.IntLit(1), false),
        ]),
      )

      expect(program.statements[1].type).toEqual(new core.PrimitiveType('count'))
    })
  })

  describe('invalid programs', () => {
    test.each([
      ['variable used before declaration', 'ingredient y: count = x', /'x' not found/],
      [
        'duplicate variable in same scope',
        'ingredient x: count = 1\ningredient x: count = 2',
        /already declared/,
      ],
      [
        'duplicate recipe name',
        String.raw`recipe f() yields nothing:
  serve
recipe f() yields nothing:
  serve`,
        /already declared/,
      ],
      [
        'duplicate prep name',
        String.raw`prep Dough:
  flour: grams
prep Dough:
  water: ml`,
        /already declared/,
      ],
      [
        'duplicate field in prep',
        String.raw`prep Dough:
  flour: grams
  flour: ml`,
        /duplicate field 'flour'/,
      ],
      [
        'prep field with type nothing',
        String.raw`prep Bad:
  missing: nothing`,
        /cannot have type nothing/,
      ],
      ['undeclared identifier', 'step show: display(missing)', /'missing' not found/],
      [
        'adding grams and ml',
        String.raw`ingredient flour: grams = 1g
ingredient milk: ml = 1ml
ingredient bad = flour + milk`,
        /cannot \+ grams and ml/,
      ],
      [
        'multiplying two unit types together',
        'ingredient bad = 1g * 2g',
        /cannot \* grams and grams/,
      ],
      ['dividing incompatible units', 'ingredient bad = 1g / 2ml', /cannot \/ grams and ml/],
      ['modulo on unit types', 'ingredient bad = 5g % 2g', /% requires count or amount operands/],
      ['comparing grams and ml', 'ingredient bad: truth = 1g < 2ml', /cannot compare grams and ml/],
      [
        'equality check between different types',
        'ingredient bad: truth = 1 == yes',
        /cannot compare count and truth/,
      ],
      [
        'and operator on non-truth types',
        'ingredient bad: truth = 1 and 2',
        /and requires truth operands/,
      ],
      [
        'or operator on non-truth types',
        'ingredient bad: truth = yes or 2',
        /or requires truth operands/,
      ],
      [
        'not operator on non-truth type',
        'ingredient bad: truth = not 1',
        /not requires truth operand/,
      ],
      [
        'negation of non-numeric type',
        'ingredient bad = -"no"',
        /negation requires numeric operand/,
      ],
      [
        'taste condition not truth',
        String.raw`taste 1:
  step show: display(1)`,
        /taste condition must be truth/,
      ],
      [
        'simmer condition not truth',
        String.raw`simmer 1:
  step show: display(1)`,
        /simmer condition must be truth/,
      ],
      [
        'collection with mixed types',
        'ingredient xs = [1, "two"]',
        /collection elements must have same type/,
      ],
      [
        'index access on non-collection',
        'ingredient x = 1[0]',
        /index access requires a collection/,
      ],
      [
        'index with non-count type',
        String.raw`ingredient xs: [count] = [1]
ingredient x = xs[1.5]`,
        /collection index must be count/,
      ],
      [
        'field access on non-struct type',
        'ingredient x = 1.flour',
        /cannot access field 'flour' on count/,
      ],
      [
        'field access on nonexistent field',
        String.raw`prep Dough:
  flour: grams
ingredient d: Dough = Dough { flour: 1g }
ingredient x = d.water`,
        /has no field 'water'/,
      ],
      [
        'struct literal with wrong type name',
        'ingredient d = Missing { x: 1 }',
        /'Missing' not found/,
      ],
      [
        'struct literal with missing field',
        String.raw`prep Dough:
  flour: grams
  water: ml
ingredient d = Dough { flour: 1g }`,
        /missing field 'water'/,
      ],
      [
        'struct literal with extra field',
        String.raw`prep Dough:
  flour: grams
ingredient d = Dough { flour: 1g, water: 1ml }`,
        /has no field 'water'/,
      ],
      [
        'struct literal with wrong field type',
        String.raw`prep Dough:
  flour: grams
ingredient d = Dough { flour: 1ml }`,
        /field 'flour' expected grams but got ml/,
      ],
      [
        'assignment to immutable ingredient',
        String.raw`ingredient x: count = 1
step change: x = 2`,
        /cannot assign to immutable ingredient 'x'/,
      ],
      [
        'recipe call with wrong arg count',
        String.raw`recipe f(x: count) yields count:
  serve x
ingredient y = f()`,
        /expects 1 arguments but got 0/,
      ],
      [
        'recipe call with wrong arg type',
        String.raw`recipe f(x: count) yields count:
  serve x
ingredient y = f(1g)`,
        /argument 1 expected count but got grams/,
      ],
      [
        'serve type mismatch',
        String.raw`recipe f() yields count:
  serve "no"`,
        /serve expected count but got label/,
      ],
      [
        'serve with expression in yields nothing recipe',
        String.raw`recipe f() yields nothing:
  serve 1`,
        /serve with expression not valid/,
      ],
      [
        'missing serve in recipe',
        String.raw`recipe f() yields count:
  ingredient x: count = 1`,
        /missing serve/,
      ],
      ['toss outside loop', 'toss', /'toss' used outside/],
      ['skip outside loop', 'skip', /'skip' used outside/],
      [
        'explicit type annotation mismatch',
        'ingredient x: count = "one"',
        /cannot assign label to count/,
      ],
      [
        'parameter with type nothing',
        String.raw`recipe f(x: nothing) yields nothing:
  serve`,
        /parameter 'x' cannot have type nothing/,
      ],
      [
        'comparison between scalar and unit',
        'ingredient bad: truth = 1 < 2g',
        /cannot compare count and grams/,
      ],
      ['mix with wrong arg count', 'step stir: mix(1)', /mix expects 2 arguments/],
      ['size on non-collection', 'ingredient n: count = size(1)', /size expects a collection/],
      [
        'convert on non-unit value',
        'ingredient x = convert(1, "grams")',
        /convert value must be a unit/,
      ],
      [
        'convert with non-label target',
        'ingredient x = convert(1g, 1)',
        /convert target must be a label/,
      ],
      [
        'convert with nonliteral target',
        String.raw`ingredient target: label = "grams"
ingredient x = convert(1g, target)`,
        /convert target must be a unit label literal/,
      ],
      [
        'convert to unknown unit',
        'ingredient x = convert(1g, "pinches")',
        /unknown unit 'pinches'/,
      ],
      [
        'convert across dimensions',
        'ingredient x = convert(1g, "ml")',
        /cannot convert grams to ml/,
      ],
    ])('rejects %s', (_name, source, pattern) => {
      checkError(source, pattern)
    })

    test('rejects a direct unknown expression node', () => {
      class UnknownExpression {}

      expect(() =>
        analyze(
          new core.Program([
            new core.IngredientDecl(
              'x',
              new core.PrimitiveType('count'),
              new UnknownExpression(),
              false,
            ),
          ]),
        ),
      ).toThrow(/unknown expression UnknownExpression/)
    })

    test('rejects a direct unknown statement node', () => {
      class UnknownStatement {}

      expect(() => analyze(new core.Program([new UnknownStatement()]))).toThrow(
        /unknown statement type UnknownStatement/,
      )
    })

    test('rejects a direct unknown binary operator node', () => {
      expect(() =>
        analyze(
          new core.Program([
            new core.IngredientDecl(
              'x',
              null,
              new core.BinaryExp('**', new core.IntLit(2), new core.IntLit(3)),
              false,
            ),
          ]),
        ),
      ).toThrow(/unknown binary operator \*\*/)
    })

    test('rejects a direct unknown unary operator node', () => {
      expect(() =>
        analyze(
          new core.Program([
            new core.IngredientDecl(
              'x',
              null,
              new core.UnaryExp('sqrt', new core.IntLit(4)),
              false,
            ),
          ]),
        ),
      ).toThrow(/unknown unary operator sqrt/)
    })
  })
})
