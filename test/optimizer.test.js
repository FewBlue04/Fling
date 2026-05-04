import analyze from '../src/analyzer.js'
import * as core from '../src/core.js'
import optimize from '../src/optimizer.js'
import parse from '../src/parser.js'

function optimized(source) {
  return optimize(analyze(parse(source)))
}

function firstInitializer(source) {
  return optimized(source).statements[0].initializer
}

function recipeBody(source) {
  return optimized(source).statements[0].body
}

describe('the optimizer', () => {
  describe('constant folding', () => {
    test('folds 5 + 3 to IntLit(8)', () => {
      const initializer = firstInitializer('ingredient result: count = 5 + 3')

      expect(initializer).toBeInstanceOf(core.IntLit)
      expect(initializer.value).toBe(8)
    })

    test("folds 200g + 100g to UnitLit(300, 'grams')", () => {
      const initializer = firstInitializer('ingredient total: grams = 200g + 100g')

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBe(300)
      expect(initializer.unit).toBe('grams')
    })

    test('folds yes and no to BoolLit(false)', () => {
      const initializer = firstInitializer('ingredient result: truth = yes and no')

      expect(initializer).toBeInstanceOf(core.BoolLit)
      expect(initializer.value).toBe(false)
    })

    test('folds not yes to BoolLit(false)', () => {
      const initializer = firstInitializer('ingredient result: truth = not yes')

      expect(initializer).toBeInstanceOf(core.BoolLit)
      expect(initializer.value).toBe(false)
    })

    test("folds 3 * 60minutes to UnitLit(180, 'minutes')", () => {
      const initializer = firstInitializer('ingredient result: minutes = 3 * 60minutes')

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBe(180)
      expect(initializer.unit).toBe('minutes')
    })

    test('does not fold x + 3 because x is an IdRef', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x + 3`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.BinaryExp)
      expect(initializer.left).toBeInstanceOf(core.IdRef)
      expect(initializer.right).toBeInstanceOf(core.IntLit)
    })
  })

  describe('unit normalization', () => {
    test("normalizes and folds 1cups + 236.6ml to UnitLit(473.2, 'ml')", () => {
      const initializer = firstInitializer('ingredient total: ml = 1cups + 236.6ml')

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBeCloseTo(473.2)
      expect(initializer.unit).toBe('ml')
    })

    test("normalizes and folds 1kg - 500g to UnitLit(500, 'grams')", () => {
      const initializer = firstInitializer('ingredient total: grams = 1kg - 500g')

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBeCloseTo(500)
      expect(initializer.unit).toBe('grams')
    })
  })

  describe('dead code elimination', () => {
    test('removes statements after serve and emits a warning', () => {
      const warn = jest.spyOn(console, 'error').mockImplementation(() => {})
      const body = recipeBody(String.raw`recipe answer() yields count:
  serve 1
  step show: display(2)`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.ServeStmt)
      expect(warn).toHaveBeenCalledWith('Warning: unreachable statement removed after serve')
      warn.mockRestore()
    })

    test('replaces taste yes with just the consequent body', () => {
      const body = recipeBody(String.raw`recipe show() yields nothing:
  taste yes:
    step show: display("yes")
  otherwise:
    step show: display("no")`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.StepStmt)
      expect(body[0].expression.args[0].value).toBe('yes')
    })

    test('replaces taste no with otherwise body', () => {
      const body = recipeBody(String.raw`recipe show() yields nothing:
  taste no:
    step show: display("yes")
  otherwise:
    step show: display("no")`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.StepStmt)
      expect(body[0].expression.args[0].value).toBe('no')
    })

    test('removes taste no with no otherwise entirely', () => {
      const body = recipeBody(String.raw`recipe show() yields nothing:
  taste no:
    step show: display("no")`)

      expect(body).toHaveLength(0)
    })
  })

  describe('strength reduction', () => {
    test('replaces x * 1 with x', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x * 1`)

      expect(program.statements[1].initializer).toBeInstanceOf(core.IdRef)
      expect(program.statements[1].initializer.name).toBe('x')
    })

    test('replaces x + 0 with x', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x + 0`)

      expect(program.statements[1].initializer).toBeInstanceOf(core.IdRef)
      expect(program.statements[1].initializer.name).toBe('x')
    })

    test('replaces 0 * x with IntLit(0)', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = 0 * x`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.IntLit)
      expect(initializer.value).toBe(0)
    })

    test('replaces x * 0 with IntLit(0)', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x * 0`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.IntLit)
      expect(initializer.value).toBe(0)
    })
  })

  describe('additional optimizer coverage', () => {
    test('folds FloatLit operations to FloatLit results', () => {
      const initializer = firstInitializer('ingredient result: amount = 5.5 % 2.0')

      expect(initializer).toBeInstanceOf(core.FloatLit)
      expect(initializer.value).toBeCloseTo(1.5)
    })

    test('folds FloatLit subtraction and division', () => {
      const program = optimized(String.raw`ingredient difference: amount = 5.5 - 2.0
ingredient quotient: amount = 5.5 / 2.0`)

      expect(program.statements[0].initializer.value).toBeCloseTo(3.5)
      expect(program.statements[1].initializer.value).toBeCloseTo(2.75)
    })

    test('folds boolean or literals', () => {
      const initializer = firstInitializer('ingredient result: truth = no or yes')

      expect(initializer).toBeInstanceOf(core.BoolLit)
      expect(initializer.value).toBe(true)
    })

    test('leaves boolean literal equality unchanged', () => {
      const initializer = firstInitializer('ingredient same: truth = yes == no')

      expect(initializer).toBeInstanceOf(core.BinaryExp)
      expect(initializer.op).toBe('==')
      expect(initializer.left).toBeInstanceOf(core.BoolLit)
      expect(initializer.left.value).toBe(true)
      expect(initializer.right).toBeInstanceOf(core.BoolLit)
      expect(initializer.right.value).toBe(false)
    })

    test('negates FloatLit values', () => {
      const initializer = firstInitializer('ingredient result: amount = -1.5')

      expect(initializer).toBeInstanceOf(core.FloatLit)
      expect(initializer.value).toBe(-1.5)
    })

    test('negates UnitLit values', () => {
      const initializer = firstInitializer('ingredient debt: grams = -5g')

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBe(-5)
      expect(initializer.unit).toBe('grams')
    })

    test('negates IntLit values', () => {
      const initializer = firstInitializer('ingredient debt: count = -5')

      expect(initializer).toBeInstanceOf(core.IntLit)
      expect(initializer.value).toBe(-5)
    })

    test('replaces 1 * x with x', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = 1 * x`)

      expect(program.statements[1].initializer).toBeInstanceOf(core.IdRef)
      expect(program.statements[1].initializer.name).toBe('x')
    })

    test('replaces 0 + x with x', () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = 0 + x`)

      expect(program.statements[1].initializer).toBeInstanceOf(core.IdRef)
      expect(program.statements[1].initializer.name).toBe('x')
    })

    test('rejects UnitLit plus scalar before it can be folded', () => {
      expect(() => optimized('ingredient bad = 1g + 2')).toThrow(/cannot \+ grams and count/)
    })

    test('folds UnitLit times scalar on the right', () => {
      const initializer = firstInitializer('ingredient total: grams = 2g * 3')

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBe(6)
      expect(initializer.unit).toBe('grams')
    })

    test('leaves literal expressions with unsupported fold operators unchanged', () => {
      const initializer = firstInitializer('ingredient same: truth = 1 == 1')

      expect(initializer).toBeInstanceOf(core.BinaryExp)
      expect(initializer.op).toBe('==')
    })

    test('leaves unary expressions with nonliteral operands unchanged', () => {
      const program = optimized(String.raw`ingredient flag: truth = yes
ingredient result: truth = not flag`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.UnaryExp)
      expect(initializer.op).toBe('not')
      expect(initializer.operand).toBeInstanceOf(core.IdRef)
    })

    test('leaves literal unary expressions with unknown operators unchanged', () => {
      const program = optimize(
        new core.Program([
          new core.IngredientDecl(
            'x',
            new core.PrimitiveType('count'),
            new core.UnaryExp('sqrt', new core.IntLit(4)),
            false,
          ),
        ]),
      )
      const initializer = program.statements[0].initializer

      expect(initializer).toBeInstanceOf(core.UnaryExp)
      expect(initializer.op).toBe('sqrt')
      expect(initializer.operand).toEqual(new core.IntLit(4))
    })

    test('drops empty string pseudo-statements', () => {
      const program = optimize(new core.Program(['']))

      expect(program.statements).toHaveLength(0)
    })

    test('preserves nonempty string pseudo-statements', () => {
      const program = optimize(new core.Program(['raw']))

      expect(program.statements).toEqual(['raw'])
    })

    test('keeps nonconstant taste statements and optimizes their bodies', () => {
      const body = recipeBody(String.raw`recipe show(flag: truth) yields nothing:
  taste flag:
    step show: display(5 + 3)`)
      const taste = body[0]

      expect(taste).toBeInstanceOf(core.TasteStmt)
      expect(taste.consequent[0].expression.args[0]).toBeInstanceOf(core.IntLit)
      expect(taste.consequent[0].expression.args[0].value).toBe(8)
      expect(taste.alternate).toBeNull()
    })

    test('optimizes simmer body expressions', () => {
      const program = optimized(String.raw`stirring ingredient n: count = 1
simmer n > 0:
  step dec: n = n - 1`)
      const loop = program.statements[1]

      expect(loop).toBeInstanceOf(core.SimmerStmt)
      expect(loop.body[0].expression).toBeInstanceOf(core.Assignment)
      expect(loop.body[0].expression.target.name).toBe('n')
    })

    test('optimizes batch collection and preserves toss and skip', () => {
      const program = optimized(String.raw`ingredient xs: [count] = [1 + 1]
batch x in xs:
  skip
  toss`)
      const loop = program.statements[1]

      expect(loop).toBeInstanceOf(core.BatchStmt)
      expect(loop.collection).toBeInstanceOf(core.IdRef)
      expect(loop.body).toEqual([expect.any(core.SkipStmt), expect.any(core.TossStmt)])
    })

    test('optimizes SpoiledStmt message expression', () => {
      const body = recipeBody(String.raw`recipe fail() yields nothing:
  spoiled "bad"`)

      expect(body[0]).toBeInstanceOf(core.SpoiledStmt)
      expect(body[0].message).toBeInstanceOf(core.StringLit)
      expect(body[0].message.value).toBe('bad')
    })

    test('preserves bare serve while optimizing recipe bodies', () => {
      const body = recipeBody(String.raw`recipe stop() yields nothing:
  serve`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.ServeStmt)
      expect(body[0].expression).toBeNull()
    })

    test('passes PantryDecl through optimizer', () => {
      const program = optimized('pantry "std.fling"')

      expect(program.statements[0]).toBeInstanceOf(core.PantryDecl)
      expect(program.statements[0].path).toEqual(new core.StringLit('std.fling'))
    })

    test('passes PrepDecl through optimizer', () => {
      const program = optimized(String.raw`prep Dough:
  flour: grams`)

      expect(program.statements[0]).toEqual(
        new core.PrepDecl('Dough', [new core.PrepField('flour', new core.UnitType('grams'))]),
      )
    })

    test('copies StringLit through optimizer', () => {
      const initializer = firstInitializer('ingredient label: label = "hello"')

      expect(initializer).toBeInstanceOf(core.StringLit)
      expect(initializer.value).toBe('hello')
    })

    test('optimizes FieldAccessExp object', () => {
      const program = optimized(String.raw`prep Dough:
  flour: grams
ingredient result: grams = Dough { flour: 1g + 1g }.flour`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.FieldAccessExp)
      expect(initializer.object.fields[0].value).toBeInstanceOf(core.UnitLit)
      expect(initializer.object.fields[0].value.value).toBe(2)
      expect(initializer.object.fields[0].value.unit).toBe('grams')
    })

    test('optimizes IndexAccessExp collection and index', () => {
      const initializer = firstInitializer('ingredient first: count = [1 + 1, 3][0 + 0]')

      expect(initializer).toBeInstanceOf(core.IndexAccessExp)
      expect(initializer.collection.elements[0]).toBeInstanceOf(core.IntLit)
      expect(initializer.collection.elements[0].value).toBe(2)
      expect(initializer.index).toBeInstanceOf(core.IntLit)
      expect(initializer.index.value).toBe(0)
    })

    test('optimizes StructLit field values', () => {
      const program = optimized(String.raw`prep Dough:
  flour: grams
ingredient d: Dough = Dough { flour: 1g + 1g }`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.StructLit)
      expect(initializer.fields[0].value).toBeInstanceOf(core.UnitLit)
      expect(initializer.fields[0].value.value).toBe(2)
      expect(initializer.fields[0].value.unit).toBe('grams')
    })

    test('optimizes CollectionLit elements', () => {
      const initializer = firstInitializer('ingredient xs: [count] = [1 + 1, 3 * 2]')

      expect(initializer).toBeInstanceOf(core.CollectionLit)
      expect(initializer.elements.map((element) => element.value)).toEqual([2, 6])
    })

    test('throws on unknown statements', () => {
      class UnknownStatement {}

      expect(() => optimize(new core.Program([new UnknownStatement()]))).toThrow(
        /unknown statement UnknownStatement/,
      )
    })

    test('throws on unknown expressions', () => {
      class UnknownExpression {}

      expect(() =>
        optimize(
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
  })
})
