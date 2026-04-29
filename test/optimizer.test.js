import analyze from "../src/analyzer.js"
import * as core from "../src/core.js"
import optimize from "../src/optimizer.js"
import parse from "../src/parser.js"

function optimized(source) {
  return optimize(analyze(parse(source)))
}

function firstInitializer(source) {
  return optimized(source).statements[0].initializer
}

function recipeBody(source) {
  return optimized(source).statements[0].body
}

describe("the optimizer", () => {
  describe("constant folding", () => {
    test("folds 5 + 3 to IntLit(8)", () => {
      const initializer = firstInitializer("ingredient result: count = 5 + 3")

      expect(initializer).toBeInstanceOf(core.IntLit)
      expect(initializer.value).toBe(8)
    })

    test("folds 200g + 100g to UnitLit(300, 'grams')", () => {
      const initializer = firstInitializer("ingredient total: grams = 200g + 100g")

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBe(300)
      expect(initializer.unit).toBe("grams")
    })

    test("folds yes and no to BoolLit(false)", () => {
      const initializer = firstInitializer("ingredient result: truth = yes and no")

      expect(initializer).toBeInstanceOf(core.BoolLit)
      expect(initializer.value).toBe(false)
    })

    test("folds not yes to BoolLit(false)", () => {
      const initializer = firstInitializer("ingredient result: truth = not yes")

      expect(initializer).toBeInstanceOf(core.BoolLit)
      expect(initializer.value).toBe(false)
    })

    test("folds 3 * 60minutes to UnitLit(180, 'minutes')", () => {
      const initializer = firstInitializer("ingredient result: minutes = 3 * 60minutes")

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBe(180)
      expect(initializer.unit).toBe("minutes")
    })

    test("does not fold x + 3 because x is an IdRef", () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x + 3`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.BinaryExp)
      expect(initializer.left).toBeInstanceOf(core.IdRef)
      expect(initializer.right).toBeInstanceOf(core.IntLit)
    })
  })

  describe("unit normalization", () => {
    test("normalizes and folds 1cups + 236.6ml to UnitLit(473.2, 'ml')", () => {
      const initializer = firstInitializer("ingredient total: ml = 1cups + 236.6ml")

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBeCloseTo(473.2)
      expect(initializer.unit).toBe("ml")
    })

    test("normalizes and folds 1kg - 500g to UnitLit(500, 'grams')", () => {
      const initializer = firstInitializer("ingredient total: grams = 1kg - 500g")

      expect(initializer).toBeInstanceOf(core.UnitLit)
      expect(initializer.value).toBeCloseTo(500)
      expect(initializer.unit).toBe("grams")
    })
  })

  describe("dead code elimination", () => {
    test("removes statements after serve and emits a warning", () => {
      const warn = jest.spyOn(console, "error").mockImplementation(() => {})
      const body = recipeBody(String.raw`recipe answer() yields count:
  serve 1
  step show: display(2)`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.ServeStmt)
      expect(warn).toHaveBeenCalledWith("Warning: unreachable statement removed after serve")
      warn.mockRestore()
    })

    test("replaces taste yes with just the consequent body", () => {
      const body = recipeBody(String.raw`recipe show() yields nothing:
  taste yes:
    step show: display("yes")
  otherwise:
    step show: display("no")`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.StepStmt)
      expect(body[0].expression.args[0].value).toBe("yes")
    })

    test("replaces taste no with otherwise body", () => {
      const body = recipeBody(String.raw`recipe show() yields nothing:
  taste no:
    step show: display("yes")
  otherwise:
    step show: display("no")`)

      expect(body).toHaveLength(1)
      expect(body[0]).toBeInstanceOf(core.StepStmt)
      expect(body[0].expression.args[0].value).toBe("no")
    })

    test("removes taste no with no otherwise entirely", () => {
      const body = recipeBody(String.raw`recipe show() yields nothing:
  taste no:
    step show: display("no")`)

      expect(body).toHaveLength(0)
    })
  })

  describe("strength reduction", () => {
    test("replaces x * 1 with x", () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x * 1`)

      expect(program.statements[1].initializer).toBeInstanceOf(core.IdRef)
      expect(program.statements[1].initializer.name).toBe("x")
    })

    test("replaces x + 0 with x", () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = x + 0`)

      expect(program.statements[1].initializer).toBeInstanceOf(core.IdRef)
      expect(program.statements[1].initializer.name).toBe("x")
    })

    test("replaces 0 * x with IntLit(0)", () => {
      const program = optimized(String.raw`ingredient x: count = 2
ingredient y: count = 0 * x`)
      const initializer = program.statements[1].initializer

      expect(initializer).toBeInstanceOf(core.IntLit)
      expect(initializer.value).toBe(0)
    })
  })
})
