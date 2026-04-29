import * as core from "./core.js"
import { PrimitiveType, UnitType } from "./core.js"

export class Context {
  constructor(parent = null) {
    this.parent = parent
    this.entities = new Map()
  }

  add(name, entity) {
    if (this.entities.has(name)) {
      throw new ReferenceError(`'${name}' already declared in this scope`)
    }
    this.entities.set(name, entity)
    return entity
  }

  lookup(name) {
    if (this.entities.has(name)) {
      return this.entities.get(name)
    }
    if (this.parent) {
      return this.parent.lookup(name)
    }
    throw new ReferenceError(`'${name}' not found`)
  }

  newChildContext() {
    return new Context(this)
  }
}

export const DIMENSION = {
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
  count: "scalar",
  amount: "scalar",
}

export const BASE_UNIT = {
  weight: "grams",
  volume: "ml",
  temperature: "celsius",
  time: "seconds",
  scalar: "amount",
}

export function unitsCompatible(a, b) {
  return DIMENSION[a] === DIMENSION[b]
}

function isUnit(type) {
  return type instanceof UnitType
}

function isScalar(type) {
  return type instanceof PrimitiveType && ["count", "amount"].includes(type.name)
}

function widerScalar(leftType, rightType) {
  return new PrimitiveType(
    leftType.name === "amount" || rightType.name === "amount" ? "amount" : "count"
  )
}

function typeName(type) {
  return type.name
}

export function resultUnit(op, leftType, rightType) {
  if (isUnit(leftType) && isUnit(rightType)) {
    if (!unitsCompatible(leftType.name, rightType.name)) {
      throw new TypeError(`cannot ${op} ${typeName(leftType)} and ${typeName(rightType)}`)
    }

    if (op === "+" || op === "-") {
      return new UnitType(BASE_UNIT[DIMENSION[leftType.name]])
    }
    if (op === "/") {
      return new PrimitiveType("amount")
    }
    throw new TypeError(`cannot ${op} ${typeName(leftType)} and ${typeName(rightType)}`)
  }

  if (isUnit(leftType) && isScalar(rightType)) {
    if (op === "*" || op === "/") {
      return new UnitType(leftType.name)
    }
    throw new TypeError(`cannot ${op} ${typeName(leftType)} and ${typeName(rightType)}`)
  }

  if (isScalar(leftType) && isUnit(rightType)) {
    if (op === "*") {
      return new UnitType(rightType.name)
    }
    throw new TypeError(`cannot ${op} ${typeName(leftType)} and ${typeName(rightType)}`)
  }

  if (isScalar(leftType) && isScalar(rightType)) {
    return widerScalar(leftType, rightType)
  }

  throw new TypeError(`cannot ${op} ${typeName(leftType)} and ${typeName(rightType)}`)
}

const NOTHING = new PrimitiveType("nothing")
const COUNT = new PrimitiveType("count")
const AMOUNT = new PrimitiveType("amount")
const TRUTH = new PrimitiveType("truth")
const LABEL = new PrimitiveType("label")

const UNIT_ALIASES = {
  g: "grams",
}

function normalizedUnit(unit) {
  return UNIT_ALIASES[unit] ?? unit
}

function isNothing(type) {
  return type instanceof PrimitiveType && type.name === "nothing"
}

function isTruth(type) {
  return type instanceof PrimitiveType && type.name === "truth"
}

function isNumeric(type) {
  return isScalar(type) || isUnit(type)
}

function describe(type) {
  if (type instanceof core.CollectionType) {
    return `[${type.elementType ? describe(type.elementType) : "unknown"}]`
  }
  return type?.name ?? "unknown"
}

export function typeEqual(a, b) {
  if (a instanceof PrimitiveType && b instanceof PrimitiveType) {
    return a.name === b.name
  }
  if (a instanceof UnitType && b instanceof UnitType) {
    return unitsCompatible(a.name, b.name)
  }
  if (a instanceof core.CollectionType && b instanceof core.CollectionType) {
    return a.elementType === null || b.elementType === null || typeEqual(a.elementType, b.elementType)
  }
  if (a instanceof core.UserDefinedType && b instanceof core.UserDefinedType) {
    return a.name === b.name
  }
  return false
}

function must(condition, errorClass, message) {
  if (!condition) {
    throw new errorClass(message)
  }
}

export function alwaysServes(statements) {
  return statements.some(
    (statement) =>
      statement instanceof core.ServeStmt ||
      (statement instanceof core.TasteStmt &&
        statement.alternate !== null &&
        alwaysServes(statement.consequent) &&
        alwaysServes(statement.alternate))
  )
}

export default function analyze(program) {
  const root = new Context()
  let currentReturnType = null
  let inLoop = false

  function resolveType(type) {
    if (type instanceof core.UserDefinedType) {
      const entity = root.lookup(type.name)
      must(
        entity.kind === "prep",
        TypeError,
        `'${type.name}' is not a prep type`
      )
    } else if (type instanceof core.CollectionType && type.elementType !== null) {
      resolveType(type.elementType)
    }
    return type
  }

  function prepFields(statement) {
    const fields = new Map()
    for (const field of statement.fields) {
      if (fields.has(field.name)) {
        throw new TypeError(`duplicate field '${field.name}' in prep '${statement.name}'`)
      }
      resolveType(field.type)
      if (isNothing(field.type)) {
        throw new TypeError(`prep field '${field.name}' cannot have type nothing`)
      }
      fields.set(field.name, field.type)
    }
    return fields
  }

  for (const statement of program.statements) {
    if (statement instanceof core.PrepDecl) {
      root.add(statement.name, { fields: new Map(), kind: "prep" })
    } else if (statement instanceof core.RecipeDecl) {
      root.add(statement.name, {
        params: statement.params,
        returnType: statement.returnType,
        kind: "recipe",
      })
    }
  }

  for (const statement of program.statements) {
    if (statement instanceof core.PrepDecl) {
      root.lookup(statement.name).fields = prepFields(statement)
    } else if (statement instanceof core.RecipeDecl) {
      resolveType(statement.returnType)
      for (const param of statement.params) {
        resolveType(param.type)
        if (isNothing(param.type)) {
          throw new TypeError(`parameter '${param.name}' cannot have type nothing`)
        }
      }
    }
  }

  function analyzeBlock(statements, context) {
    for (const statement of statements) {
      analyzeStatement(statement, context)
    }
  }

  function analyzeStatement(statement, context) {
    if (typeof statement === "string") {
      return
    }
    if (statement instanceof core.PrepDecl) {
      return
    }
    if (statement instanceof core.RecipeDecl) {
      return analyzeRecipe(statement, context)
    }
    if (statement instanceof core.IngredientDecl) {
      return analyzeIngredient(statement, context)
    }
    if (statement instanceof core.ServeStmt) {
      return analyzeServe(statement, context)
    }
    if (statement instanceof core.TasteStmt) {
      return analyzeTaste(statement, context)
    }
    if (statement instanceof core.SimmerStmt) {
      return analyzeSimmer(statement, context)
    }
    if (statement instanceof core.BatchStmt) {
      return analyzeBatch(statement, context)
    }
    if (statement instanceof core.TossStmt) {
      must(inLoop, Error, "FlowError: 'toss' used outside of simmer/batch")
      return
    }
    if (statement instanceof core.SkipStmt) {
      must(inLoop, Error, "FlowError: 'skip' used outside of simmer/batch")
      return
    }
    if (statement instanceof core.StepStmt) {
      statement.type = analyzeExpression(statement.expression, context)
      return
    }
    if (statement instanceof core.SpoiledStmt) {
      statement.type = analyzeExpression(statement.message, context)
    }
  }

  function analyzeRecipe(statement, context) {
    const oldReturnType = currentReturnType
    currentReturnType = statement.returnType
    const recipeContext = context.newChildContext()

    for (const param of statement.params) {
      recipeContext.add(param.name, {
        type: param.type,
        mutable: false,
        kind: "variable",
      })
    }

    analyzeBlock(statement.body, recipeContext)

    if (!isNothing(statement.returnType)) {
      must(
        alwaysServes(statement.body),
        Error,
        `FlowError: recipe '${statement.name}' missing serve on some paths`
      )
    }
    currentReturnType = oldReturnType
  }

  function analyzeIngredient(statement, context) {
    const initializerType = analyzeExpression(statement.initializer, context)
    if (statement.type) {
      resolveType(statement.type)
      must(
        typeEqual(statement.type, initializerType),
        TypeError,
        `cannot assign ${describe(initializerType)} to ${describe(statement.type)}`
      )
    } else {
      statement.type = initializerType
    }

    context.add(statement.name, {
      type: statement.type,
      mutable: statement.mutable,
      kind: "variable",
    })
  }

  function analyzeServe(statement, context) {
    if (currentReturnType === null) {
      if (statement.expression !== null) {
        statement.type = analyzeExpression(statement.expression, context)
      } else {
        statement.type = NOTHING
      }
      return
    }

    if (isNothing(currentReturnType)) {
      must(
        statement.expression === null,
        TypeError,
        "serve with expression not valid in yields nothing recipe"
      )
      statement.type = NOTHING
      return
    }

    must(statement.expression !== null, TypeError, "serve expression required")
    const expressionType = analyzeExpression(statement.expression, context)
    must(
      typeEqual(currentReturnType, expressionType),
      TypeError,
      `serve expected ${describe(currentReturnType)} but got ${describe(expressionType)}`
    )
    statement.type = expressionType
  }

  function analyzeTaste(statement, context) {
    const conditionType = analyzeExpression(statement.condition, context)
    must(isTruth(conditionType), TypeError, "taste condition must be truth")
    analyzeBlock(statement.consequent, context.newChildContext())
    if (statement.alternate) {
      analyzeBlock(statement.alternate, context.newChildContext())
    }
  }

  function analyzeSimmer(statement, context) {
    const conditionType = analyzeExpression(statement.condition, context)
    must(isTruth(conditionType), TypeError, "simmer condition must be truth")
    const oldInLoop = inLoop
    inLoop = true
    analyzeBlock(statement.body, context.newChildContext())
    inLoop = oldInLoop
  }

  function analyzeBatch(statement, context) {
    const collectionType = analyzeExpression(statement.collection, context)
    must(
      collectionType instanceof core.CollectionType,
      TypeError,
      "batch source must be a collection"
    )
    const bodyContext = context.newChildContext()
    bodyContext.add(statement.varName, {
      type: collectionType.elementType,
      mutable: false,
      kind: "variable",
    })
    const oldInLoop = inLoop
    inLoop = true
    analyzeBlock(statement.body, bodyContext)
    inLoop = oldInLoop
  }

  function analyzeExpression(expression, context) {
    if (expression instanceof core.BinaryExp) {
      return analyzeBinary(expression, context)
    }
    if (expression instanceof core.UnaryExp) {
      return analyzeUnary(expression, context)
    }
    if (expression instanceof core.CallExp) {
      return analyzeCall(expression, context)
    }
    if (expression instanceof core.FieldAccessExp) {
      return analyzeFieldAccess(expression, context)
    }
    if (expression instanceof core.IndexAccessExp) {
      return analyzeIndexAccess(expression, context)
    }
    if (expression instanceof core.StructLit) {
      return analyzeStructLit(expression, context)
    }
    if (expression instanceof core.CollectionLit) {
      return analyzeCollectionLit(expression, context)
    }
    if (expression instanceof core.IdRef) {
      const entity = context.lookup(expression.name)
      must(entity.kind === "variable", TypeError, `'${expression.name}' is not a value`)
      expression.type = entity.type
      return expression.type
    }
    if (expression instanceof core.UnitLit) {
      expression.type = new UnitType(normalizedUnit(expression.unit))
      return expression.type
    }
    if (expression instanceof core.IntLit) {
      expression.type = COUNT
      return expression.type
    }
    if (expression instanceof core.FloatLit) {
      expression.type = AMOUNT
      return expression.type
    }
    if (expression instanceof core.StringLit) {
      expression.type = LABEL
      return expression.type
    }
    if (expression instanceof core.BoolLit) {
      expression.type = TRUTH
      return expression.type
    }
    throw new TypeError(`unknown expression ${expression.constructor.name}`)
  }

  function analyzeBinary(expression, context) {
    if (expression.op === "=") {
      return analyzeAssignment(expression, context)
    }

    const leftType = analyzeExpression(expression.left, context)
    const rightType = analyzeExpression(expression.right, context)

    if (["+", "-", "*", "/"].includes(expression.op)) {
      expression.type = resultUnit(expression.op, leftType, rightType)
      return expression.type
    }
    if (expression.op === "%") {
      must(
        isScalar(leftType) && isScalar(rightType),
        TypeError,
        `% requires count or amount operands`
      )
      expression.type = widerScalar(leftType, rightType)
      return expression.type
    }
    if (["<", ">", "<=", ">="].includes(expression.op)) {
      must(
        comparable(leftType, rightType),
        TypeError,
        `cannot compare ${describe(leftType)} and ${describe(rightType)}`
      )
      expression.type = TRUTH
      return expression.type
    }
    if (["==", "!="].includes(expression.op)) {
      must(
        typeEqual(leftType, rightType),
        TypeError,
        `cannot compare ${describe(leftType)} and ${describe(rightType)}`
      )
      expression.type = TRUTH
      return expression.type
    }
    if (["and", "or"].includes(expression.op)) {
      must(
        isTruth(leftType) && isTruth(rightType),
        TypeError,
        `${expression.op} requires truth operands`
      )
      expression.type = TRUTH
      return expression.type
    }
    throw new TypeError(`unknown binary operator ${expression.op}`)
  }

  function analyzeAssignment(expression, context) {
    must(expression.left instanceof core.IdRef, TypeError, "assignment target must be an identifier")
    const entity = context.lookup(expression.left.name)
    must(entity.kind === "variable", TypeError, `'${expression.left.name}' is not a variable`)
    must(entity.mutable, TypeError, `cannot assign to immutable ingredient '${expression.left.name}'`)
    const rightType = analyzeExpression(expression.right, context)
    must(
      typeEqual(entity.type, rightType),
      TypeError,
      `cannot assign ${describe(rightType)} to ${describe(entity.type)}`
    )
    expression.left.type = entity.type
    expression.type = rightType
    return expression.type
  }

  function analyzeUnary(expression, context) {
    const operandType = analyzeExpression(expression.operand, context)
    if (expression.op === "not") {
      must(isTruth(operandType), TypeError, "not requires truth operand")
      expression.type = TRUTH
      return expression.type
    }
    if (expression.op === "-") {
      must(isNumeric(operandType), TypeError, "negation requires numeric operand")
      expression.type = operandType
      return expression.type
    }
    throw new TypeError(`unknown unary operator ${expression.op}`)
  }

  function analyzeCall(expression, context) {
    if (expression.callee instanceof core.IdRef && isBuiltin(expression.callee.name)) {
      expression.type = analyzeBuiltinCall(expression.callee.name, expression.args, context)
      return expression.type
    }

    must(expression.callee instanceof core.IdRef, TypeError, "callee must be a recipe name")
    const entity = context.lookup(expression.callee.name)
    must(entity.kind === "recipe", TypeError, `'${expression.callee.name}' is not a recipe`)
    must(
      expression.args.length === entity.params.length,
      TypeError,
      `recipe '${expression.callee.name}' expects ${entity.params.length} arguments but got ${expression.args.length}`
    )

    expression.args.forEach((arg, index) => {
      const argType = analyzeExpression(arg, context)
      const paramType = entity.params[index].type
      must(
        typeEqual(paramType, argType),
        TypeError,
        `recipe '${expression.callee.name}' argument ${index + 1} expected ${describe(paramType)} but got ${describe(argType)}`
      )
    })
    expression.type = entity.returnType
    return expression.type
  }

  function isBuiltin(name) {
    return ["display", "mix", "size", "convert"].includes(name)
  }

  function analyzeBuiltinCall(name, args, context) {
    if (name === "display") {
      must(args.length === 1, TypeError, "display expects 1 argument")
      analyzeExpression(args[0], context)
      return NOTHING
    }
    if (name === "mix") {
      must(args.length === 2, TypeError, "mix expects 2 arguments")
      args.forEach((arg) => analyzeExpression(arg, context))
      return NOTHING
    }
    if (name === "size") {
      must(args.length === 1, TypeError, "size expects 1 argument")
      const argType = analyzeExpression(args[0], context)
      must(argType instanceof core.CollectionType, TypeError, "size expects a collection")
      return COUNT
    }
    must(args.length === 2, TypeError, "convert expects 2 arguments")
    const valueType = analyzeExpression(args[0], context)
    analyzeExpression(args[1], context)
    return valueType
  }

  function analyzeFieldAccess(expression, context) {
    const objectType = analyzeExpression(expression.object, context)
    must(
      objectType instanceof core.UserDefinedType,
      TypeError,
      `cannot access field '${expression.field}' on ${describe(objectType)}`
    )
    const entity = root.lookup(objectType.name)
    must(entity.kind === "prep", TypeError, `'${objectType.name}' is not a prep type`)
    must(
      entity.fields.has(expression.field),
      TypeError,
      `prep '${objectType.name}' has no field '${expression.field}'`
    )
    expression.type = entity.fields.get(expression.field)
    return expression.type
  }

  function analyzeIndexAccess(expression, context) {
    const collectionType = analyzeExpression(expression.collection, context)
    const indexType = analyzeExpression(expression.index, context)
    must(collectionType instanceof core.CollectionType, TypeError, "index access requires a collection")
    must(typeEqual(indexType, COUNT), TypeError, "collection index must be count")
    expression.type = collectionType.elementType
    return expression.type
  }

  function analyzeStructLit(expression, context) {
    const entity = root.lookup(expression.typeName)
    must(entity.kind === "prep", TypeError, `'${expression.typeName}' is not a prep type`)
    const seen = new Set()

    for (const field of expression.fields) {
      must(
        entity.fields.has(field.name),
        TypeError,
        `prep '${expression.typeName}' has no field '${field.name}'`
      )
      must(!seen.has(field.name), TypeError, `duplicate field '${field.name}'`)
      seen.add(field.name)
      const valueType = analyzeExpression(field.value, context)
      const expectedType = entity.fields.get(field.name)
      must(
        typeEqual(expectedType, valueType),
        TypeError,
        `field '${field.name}' expected ${describe(expectedType)} but got ${describe(valueType)}`
      )
    }

    for (const fieldName of entity.fields.keys()) {
      must(seen.has(fieldName), TypeError, `missing field '${fieldName}'`)
    }

    expression.type = new core.UserDefinedType(expression.typeName)
    return expression.type
  }

  function analyzeCollectionLit(expression, context) {
    const elementTypes = expression.elements.map((element) => analyzeExpression(element, context))
    if (elementTypes.length === 0) {
      expression.type = new core.CollectionType(null)
      return expression.type
    }
    const firstType = elementTypes[0]
    for (const elementType of elementTypes.slice(1)) {
      must(
        typeEqual(firstType, elementType),
        TypeError,
        `collection elements must have same type`
      )
    }
    expression.type = new core.CollectionType(firstType)
    return expression.type
  }

  function comparable(leftType, rightType) {
    if (isScalar(leftType) && isScalar(rightType)) {
      return true
    }
    if (isUnit(leftType) && isUnit(rightType)) {
      return unitsCompatible(leftType.name, rightType.name)
    }
    return false
  }

  analyzeBlock(program.statements, root)
  return program
}
