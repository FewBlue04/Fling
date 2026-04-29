import { PrimitiveType, UnitType } from "../src/core.js"
import { resultUnit, unitsCompatible } from "../src/analyzer.js"

describe("unit system", () => {
  test("unit compatibility follows dimensions", () => {
    expect(unitsCompatible("grams", "kg")).toBe(true)
    expect(unitsCompatible("grams", "ml")).toBe(false)
    expect(unitsCompatible("count", "amount")).toBe(true)
  })

  test("same dimension addition returns base unit", () => {
    expect(resultUnit("+", new UnitType("grams"), new UnitType("kg"))).toEqual(
      new UnitType("grams")
    )
  })

  test("unit times scalar returns the unit", () => {
    expect(resultUnit("*", new UnitType("grams"), new PrimitiveType("count"))).toEqual(
      new UnitType("grams")
    )
  })

  test("scalar times unit returns the unit", () => {
    expect(resultUnit("*", new PrimitiveType("count"), new UnitType("ml"))).toEqual(
      new UnitType("ml")
    )
  })

  test("same dimension unit division returns amount", () => {
    expect(resultUnit("/", new UnitType("grams"), new UnitType("grams"))).toEqual(
      new PrimitiveType("amount")
    )
  })

  test("different dimension unit division throws", () => {
    expect(() => resultUnit("/", new UnitType("grams"), new UnitType("ml"))).toThrow(
      TypeError
    )
  })

  test("different dimension unit addition throws", () => {
    expect(() => resultUnit("+", new UnitType("grams"), new UnitType("ml"))).toThrow(
      TypeError
    )
  })

  test("count plus count returns count", () => {
    expect(resultUnit("+", new PrimitiveType("count"), new PrimitiveType("count"))).toEqual(
      new PrimitiveType("count")
    )
  })

  test("count plus amount returns amount", () => {
    expect(
      resultUnit("+", new PrimitiveType("count"), new PrimitiveType("amount"))
    ).toEqual(new PrimitiveType("amount"))
  })
})
