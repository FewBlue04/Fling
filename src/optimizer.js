import * as core from "./core.js"

const DIMENSION = {
  grams: "weight",
  kg: "weight",
  oz: "weight",
  lbs: "weight",
  ml: "volume",
  liters: "volume",
  cups: "volume",
  tbsp: "volume",
  tsp: "volume",
  floz: "volume",
  celsius: "temperature",
  fahrenheit: "temperature",
  seconds: "time",
  minutes: "time",
  hours: "time",
}

const BASE_UNIT = {
  weight: "grams",
  volume: "ml",
  temperature: "celsius",
  time: "seconds",
}

const TO_BASE = {
  grams: 1,
  kg: 1000,
  oz: 28.35,
  lbs: 453.59,
  ml: 1,
  liters: 1000,
  cups: 236.6,
  tbsp: 14.79,
  tsp: 4.93,
  floz: 29.57,
  celsius: 1,
  fahrenheit: null,
  seconds: 1,
  minutes: 60,
  hours: 3600,
}

const UNIT_ALIASES = {
  g: "grams",
}

export default function optimize(program) {
  function copyType(node, original) {
    if (original?.type) {
      node.type = original.type
    }
    return node
  }

  function normalizedUnit(unit) {
    return UNIT_ALIASES[unit] ?? unit
  }

  function isLiteral(node) {
    return (
      node instanceof core.IntLit ||
      node instanceof core.FloatLit ||
      node instanceof core.UnitLit ||
      node instanceof core.BoolLit ||
      node instanceof core.StringLit
    )
  }

  function isNumericLiteral(node) {
    return node instanceof core.IntLit || node instanceof core.FloatLit
  }

  function isZero(node) {
    return (
      (node instanceof core.IntLit && node.value === 0) ||
      (node instanceof core.UnitLit && node.value === 0)
    )
  }

  function isOne(node) {
    return node instanceof core.IntLit && node.value === 1
  }

  function numberValue(node) {
    return node.value
  }

  function numericLiteral(value, left, right) {
    return left instanceof core.IntLit && right instanceof core.IntLit
      ? new core.IntLit(value)
      : new core.FloatLit(value)
  }

  function compatibleUnits(left, right) {
    return DIMENSION[normalizedUnit(left.unit)] === DIMENSION[normalizedUnit(right.unit)]
  }

  function unitCanNormalize(unit) {
    return TO_BASE[normalizedUnit(unit)] !== null
  }

  function baseValue(unitLiteral) {
    return unitLiteral.value * TO_BASE[normalizedUnit(unitLiteral.unit)]
  }

  function baseUnit(unitLiteral) {
    return BASE_UNIT[DIMENSION[normalizedUnit(unitLiteral.unit)]]
  }

  function foldBinary(node) {
    const { op, left, right } = node

    if (left instanceof core.BoolLit && right instanceof core.BoolLit) {
      if (op === "and") {
        return copyType(new core.BoolLit(left.value && right.value), node)
      }
      if (op === "or") {
        return copyType(new core.BoolLit(left.value || right.value), node)
      }
    }

    if (isNumericLiteral(left) && isNumericLiteral(right)) {
      if (op === "+") {
        return copyType(numericLiteral(numberValue(left) + numberValue(right), left, right), node)
      }
      if (op === "-") {
        return copyType(numericLiteral(numberValue(left) - numberValue(right), left, right), node)
      }
      if (op === "*") {
        return copyType(numericLiteral(numberValue(left) * numberValue(right), left, right), node)
      }
      if (op === "/") {
        return copyType(numericLiteral(numberValue(left) / numberValue(right), left, right), node)
      }
      if (op === "%") {
        return copyType(numericLiteral(numberValue(left) % numberValue(right), left, right), node)
      }
    }

    if (
      left instanceof core.UnitLit &&
      right instanceof core.UnitLit &&
      compatibleUnits(left, right) &&
      ["+", "-"].includes(op) &&
      unitCanNormalize(left.unit) &&
      unitCanNormalize(right.unit)
    ) {
      const value = op === "+" ? baseValue(left) + baseValue(right) : baseValue(left) - baseValue(right)
      return copyType(new core.UnitLit(value, baseUnit(left)), node)
    }

    if (left instanceof core.UnitLit && isNumericLiteral(right) && op === "*") {
      return copyType(new core.UnitLit(left.value * right.value, left.unit), node)
    }

    if (isNumericLiteral(left) && right instanceof core.UnitLit && op === "*") {
      return copyType(new core.UnitLit(left.value * right.value, right.unit), node)
    }

    return node
  }

  function foldUnary(node) {
    if (node.op === "not" && node.operand instanceof core.BoolLit) {
      return copyType(new core.BoolLit(!node.operand.value), node)
    }
    if (node.op === "-" && node.operand instanceof core.IntLit) {
      return copyType(new core.IntLit(-node.operand.value), node)
    }
    if (node.op === "-" && node.operand instanceof core.FloatLit) {
      return copyType(new core.FloatLit(-node.operand.value), node)
    }
    if (node.op === "-" && node.operand instanceof core.UnitLit) {
      return copyType(new core.UnitLit(-node.operand.value, node.operand.unit), node)
    }
    return node
  }

  function reduceStrength(node) {
    if (node.op === "*" && isOne(node.right)) {
      return node.left
    }
    if (node.op === "*" && isOne(node.left)) {
      return node.right
    }
    if (node.op === "+" && isZero(node.right)) {
      return node.left
    }
    if (node.op === "+" && isZero(node.left)) {
      return node.right
    }
    if (node.op === "*" && node.right instanceof core.IntLit && node.right.value === 0) {
      return copyType(new core.IntLit(0), node)
    }
    if (node.op === "*" && node.left instanceof core.IntLit && node.left.value === 0) {
      return copyType(new core.IntLit(0), node)
    }
    return node
  }

  function optimizeBlock(statements) {
    const optimized = []
    let unreachable = false

    for (const statement of statements) {
      if (unreachable) {
        console.error("Warning: unreachable statement removed after serve")
        continue
      }

      const replacement = optimizeStatement(statement)
      const replacements = Array.isArray(replacement) ? replacement : [replacement]
      for (const item of replacements) {
        if (item === null || item === "") {
          continue
        }
        optimized.push(item)
        if (item instanceof core.ServeStmt) {
          unreachable = true
        }
      }
    }

    return optimized
  }

  function optimizeStatement(statement) {
    if (typeof statement === "string") {
      return statement
    }
    if (statement instanceof core.PrepDecl) {
      return new core.PrepDecl(statement.name, statement.fields)
    }
    if (statement instanceof core.PantryDecl) {
      return new core.PantryDecl(statement.path)
    }
    if (statement instanceof core.RecipeDecl) {
      return new core.RecipeDecl(
        statement.name,
        statement.params,
        statement.returnType,
        optimizeBlock(statement.body)
      )
    }
    if (statement instanceof core.IngredientDecl) {
      return new core.IngredientDecl(
        statement.name,
        statement.type,
        optimizeExpression(statement.initializer),
        statement.mutable
      )
    }
    if (statement instanceof core.StepStmt) {
      return copyType(new core.StepStmt(statement.name, optimizeExpression(statement.expression)), statement)
    }
    if (statement instanceof core.ServeStmt) {
      const expression = statement.expression === null ? null : optimizeExpression(statement.expression)
      return copyType(new core.ServeStmt(expression), statement)
    }
    if (statement instanceof core.TasteStmt) {
      const condition = optimizeExpression(statement.condition)
      const consequent = optimizeBlock(statement.consequent)
      const alternate = statement.alternate === null ? null : optimizeBlock(statement.alternate)
      if (condition instanceof core.BoolLit) {
        return condition.value ? consequent : alternate ?? []
      }
      return new core.TasteStmt(condition, consequent, alternate)
    }
    if (statement instanceof core.SimmerStmt) {
      return new core.SimmerStmt(optimizeExpression(statement.condition), optimizeBlock(statement.body))
    }
    if (statement instanceof core.BatchStmt) {
      return new core.BatchStmt(
        statement.varName,
        optimizeExpression(statement.collection),
        optimizeBlock(statement.body)
      )
    }
    if (statement instanceof core.TossStmt) {
      return new core.TossStmt()
    }
    if (statement instanceof core.SkipStmt) {
      return new core.SkipStmt()
    }
    if (statement instanceof core.SpoiledStmt) {
      return copyType(new core.SpoiledStmt(optimizeExpression(statement.message)), statement)
    }
    throw new TypeError(`unknown statement ${statement.constructor.name}`)
  }

  function optimizeExpression(expression) {
    if (expression instanceof core.BinaryExp) {
      const optimized = copyType(
        new core.BinaryExp(
          expression.op,
          optimizeExpression(expression.left),
          optimizeExpression(expression.right)
        ),
        expression
      )
      const reduced = reduceStrength(optimized)
      if (reduced !== optimized) {
        return reduced
      }
      return isLiteral(optimized.left) && isLiteral(optimized.right) ? foldBinary(optimized) : optimized
    }
    if (expression instanceof core.UnaryExp) {
      const optimized = copyType(
        new core.UnaryExp(expression.op, optimizeExpression(expression.operand)),
        expression
      )
      return isLiteral(optimized.operand) ? foldUnary(optimized) : optimized
    }
    if (expression instanceof core.CallExp) {
      return copyType(
        new core.CallExp(
          optimizeExpression(expression.callee),
          expression.args.map((arg) => optimizeExpression(arg))
        ),
        expression
      )
    }
    if (expression instanceof core.FieldAccessExp) {
      return copyType(
        new core.FieldAccessExp(optimizeExpression(expression.object), expression.field),
        expression
      )
    }
    if (expression instanceof core.IndexAccessExp) {
      return copyType(
        new core.IndexAccessExp(
          optimizeExpression(expression.collection),
          optimizeExpression(expression.index)
        ),
        expression
      )
    }
    if (expression instanceof core.StructLit) {
      const fields = expression.fields.map((field) => ({
        name: field.name,
        value: optimizeExpression(field.value),
      }))
      return copyType(new core.StructLit(expression.typeName, fields), expression)
    }
    if (expression instanceof core.CollectionLit) {
      return copyType(
        new core.CollectionLit(expression.elements.map((element) => optimizeExpression(element))),
        expression
      )
    }
    if (expression instanceof core.UnitLit) {
      return copyType(new core.UnitLit(expression.value, normalizedUnit(expression.unit)), expression)
    }
    if (expression instanceof core.IntLit) {
      return copyType(new core.IntLit(expression.value), expression)
    }
    if (expression instanceof core.FloatLit) {
      return copyType(new core.FloatLit(expression.value), expression)
    }
    if (expression instanceof core.StringLit) {
      return copyType(new core.StringLit(expression.value), expression)
    }
    if (expression instanceof core.BoolLit) {
      return copyType(new core.BoolLit(expression.value), expression)
    }
    if (expression instanceof core.IdRef) {
      return copyType(new core.IdRef(expression.name), expression)
    }
    throw new TypeError(`unknown expression ${expression.constructor.name}`)
  }

  return new core.Program(optimizeBlock(program.statements))
}
