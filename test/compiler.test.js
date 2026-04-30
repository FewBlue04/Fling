import compile from "../src/compiler.js"

describe("the compiler", () => {
  test("compile returns a string", () => {
    expect(typeof compile("ingredient x: count = 1")).toBe("string")
  })

  test("output contains the preamble", () => {
    expect(compile("ingredient x: count = 1")).toContain("function display(x)")
  })

  test("compiles hello world", () => {
    expect(compile('ingredient greeting: label = "Hello"\nserve greeting')).toContain(
      'console.log(greeting);'
    )
  })

  test("compiles simple addition", () => {
    expect(compile("ingredient result: count = 5 + 3")).toContain("const result = 8;")
  })

  test("compiles unit addition", () => {
    expect(compile("ingredient total: grams = 200g + 100g")).toContain(
      "const total = 300;"
    )
  })

  test("compiles a recipe", () => {
    expect(
      compile(String.raw`recipe add(x: count, y: count) yields count:
  serve x + y`)
    ).toContain("function add(x, y)")
  })

  test("compiles a loop", () => {
    expect(
      compile(String.raw`stirring ingredient n: count = 2
simmer n > 0:
  step dec: n = n - 1`)
    ).toContain("while ((n > 0))")
  })

  test("compiles a collection", () => {
    expect(compile("ingredient xs: [count] = [1, 2]")).toContain(
      "const xs = [1, 2];"
    )
  })

  test("constant folding produces 8 not 5+3", () => {
    const output = compile("ingredient result: count = 5 + 3")

    expect(output).toContain("const result = 8;")
    expect(output).not.toContain("(5 + 3)")
  })

  test("compiled unit arithmetic through variables uses base units", () => {
    const output = compile(String.raw`ingredient a: kg = 1kg
ingredient b: grams = 500g
ingredient total: grams = a + b
serve total`)
    const logs = []
    const originalLog = console.log
    console.log = (value) => logs.push(value)
    try {
      new Function(output)()
    } finally {
      console.log = originalLog
    }

    expect(logs).toEqual([1500])
  })

  test("compiled convert returns the requested display unit", () => {
    const output = compile(String.raw`ingredient flour: kg = convert(1000g, "kg")
serve flour`)
    const logs = []
    const originalLog = console.log
    console.log = (value) => logs.push(value)
    try {
      new Function(output)()
    } finally {
      console.log = originalLog
    }

    expect(logs).toEqual([1])
  })

  test("compiled temperature literals and conversion use celsius internally", () => {
    const output = compile(String.raw`ingredient temp: celsius = 212fahrenheit
ingredient shown: fahrenheit = convert(temp, "fahrenheit")
serve shown`)
    const logs = []
    const originalLog = console.log
    console.log = (value) => logs.push(value)
    try {
      new Function(output)()
    } finally {
      console.log = originalLog
    }

    expect(logs[0]).toBeCloseTo(212)
  })

  test("dead code after serve is removed", () => {
    const warn = jest.spyOn(console, "error").mockImplementation(() => {})
    const output = compile(String.raw`recipe answer() yields count:
  serve 1
  step show: display(2)`)

    expect(output).toContain("return 1;")
    expect(output).not.toContain("display(2)")
    warn.mockRestore()
  })

  test("throws on type error", () => {
    expect(() => compile('ingredient x: count = "one"')).toThrow(/cannot assign label to count/)
  })

  test("throws on undeclared variable", () => {
    expect(() => compile("ingredient x: count = y")).toThrow(/'y' not found/)
  })

  test("throws on missing serve", () => {
    expect(() =>
      compile(String.raw`recipe f() yields count:
  ingredient x: count = 1`)
    ).toThrow(/missing serve/)
  })

  test("throws on unit mismatch", () => {
    expect(() => compile("ingredient bad = 1g + 1ml")).toThrow(/cannot \+ grams and ml/)
  })
})
