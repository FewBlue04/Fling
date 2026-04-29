/** Represents a complete Fling program made of top-level declarations and statements. */
export class Program {
  constructor(statements) {
    this.statements = statements
  }
}

/** Represents a prep struct/type declaration. */
export class PrepDecl {
  constructor(name, fields) {
    this.name = name
    this.fields = fields
  }
}

/** Represents a field inside a prep declaration. */
export class PrepField {
  constructor(name, type) {
    this.name = name
    this.type = type
  }
}

/** Represents a pantry/import declaration. */
export class PantryDecl {
  constructor(path) {
    this.path = path
  }
}

/** Represents a recipe/function declaration. */
export class RecipeDecl {
  constructor(name, params, returnType, body) {
    this.name = name
    this.params = params
    this.returnType = returnType
    this.body = body
  }
}

/** Represents a typed recipe parameter. */
export class Param {
  constructor(name, type) {
    this.name = name
    this.type = type
  }
}

/** Represents an ingredient variable declaration, optionally mutable with stirring. */
export class IngredientDecl {
  constructor(name, type, initializer, mutable) {
    this.name = name
    this.type = type
    this.initializer = initializer
    this.mutable = mutable
  }
}

/** Represents a named side-effecting step statement. */
export class StepStmt {
  constructor(name, expression) {
    this.name = name
    this.expression = expression
  }
}

/** Represents a serve/return statement. */
export class ServeStmt {
  constructor(expression) {
    this.expression = expression
  }
}

/** Represents a taste/conditional statement. */
export class TasteStmt {
  constructor(condition, consequent, alternate) {
    this.condition = condition
    this.consequent = consequent
    this.alternate = alternate
  }
}

/** Represents a simmer/while loop statement. */
export class SimmerStmt {
  constructor(condition, body) {
    this.condition = condition
    this.body = body
  }
}

/** Represents a batch/for-each loop statement. */
export class BatchStmt {
  constructor(varName, collection, body) {
    this.varName = varName
    this.collection = collection
    this.body = body
  }
}

/** Represents a toss/break statement. */
export class TossStmt {}

/** Represents a skip/continue statement. */
export class SkipStmt {}

/** Represents a spoiled/error throwing statement. */
export class SpoiledStmt {
  constructor(message) {
    this.message = message
  }
}

/** Represents a binary expression with an operator and two operands. */
export class BinaryExp {
  constructor(op, left, right) {
    this.op = op
    this.left = left
    this.right = right
  }
}

/** Represents a unary expression with an operator and one operand. */
export class UnaryExp {
  constructor(op, operand) {
    this.op = op
    this.operand = operand
  }
}

/** Represents a function or callable expression invocation. */
export class CallExp {
  constructor(callee, args) {
    this.callee = callee
    this.args = args
  }
}

/** Represents field access on a struct-like expression. */
export class FieldAccessExp {
  constructor(object, field) {
    this.object = object
    this.field = field
  }
}

/** Represents index access on a collection expression. */
export class IndexAccessExp {
  constructor(collection, index) {
    this.collection = collection
    this.index = index
  }
}

/** Represents a prep struct literal. */
export class StructLit {
  constructor(typeName, fields) {
    this.typeName = typeName
    this.fields = fields
  }
}

/** Represents a collection/list literal. */
export class CollectionLit {
  constructor(elements) {
    this.elements = elements
  }
}

/** Represents a numeric literal with a physical unit suffix. */
export class UnitLit {
  constructor(value, unit) {
    this.value = value
    this.unit = unit
  }
}

/** Represents an integer literal. */
export class IntLit {
  constructor(value) {
    this.value = value
  }
}

/** Represents a floating-point literal. */
export class FloatLit {
  constructor(value) {
    this.value = value
  }
}

/** Represents a string literal. */
export class StringLit {
  constructor(value) {
    this.value = value
  }
}

/** Represents a boolean literal. */
export class BoolLit {
  constructor(value) {
    this.value = value
  }
}

/** Represents a reference to an identifier. */
export class IdRef {
  constructor(name) {
    this.name = name
  }
}

/** Represents a primitive built-in type. */
export class PrimitiveType {
  constructor(name) {
    this.name = name
  }
}

/** Represents a physical unit type. */
export class UnitType {
  constructor(name) {
    this.name = name
  }
}

/** Represents a collection/list type. */
export class CollectionType {
  constructor(elementType) {
    this.elementType = elementType
  }
}

/** Represents a user-defined prep type. */
export class UserDefinedType {
  constructor(name) {
    this.name = name
  }
}
