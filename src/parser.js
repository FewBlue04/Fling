import fs from "fs"
import * as ohm from "ohm-js"
import path from "path"
import * as core from "./core.js"

const grammar = ohm.grammar(
  fs.readFileSync(path.join(process.cwd(), "src", "fling.ohm"), "utf-8")
)

const semantics = grammar.createSemantics()
let currentSource = ""

function optional(node) {
  return node.children.length === 0 ? null : node.child(0).rep()
}

function columnOf(node) {
  const lineStart = currentSource.lastIndexOf("\n", node.source.startIdx - 1) + 1
  return node.source.startIdx - lineStart
}

semantics.addOperation("rep", {
  Program(_leadingNewlines, topLevels, _trailingNewlines) {
    return new core.Program(topLevels.children.map((topLevel) => topLevel.rep()))
  },

  TopLevel(declaration) {
    return declaration.rep()
  },
  IngredientTop(declaration, _terminator) {
    return declaration.rep()
  },
  ServeTop(statement, _terminator) {
    return statement.rep()
  },
  StepTop(statement, _terminator) {
    return statement.rep()
  },
  TossTop(statement, _terminator) {
    return statement.rep()
  },
  SkipTop(statement, _terminator) {
    return statement.rep()
  },
  SpoiledTop(statement, _terminator) {
    return statement.rep()
  },

  PrepDecl(_prep, _gap, name, _spaces1, _colon, _newlines, fields) {
    return new core.PrepDecl(
      name.rep(),
      fields.children.map((field) => field.rep())
    )
  },
  PrepField(_indent, name, _spaces1, _colon, _spaces2, type, _terminator) {
    return new core.PrepField(name.rep(), type.rep())
  },

  PantryDecl(_pantry, _gap, path, _terminator) {
    return path.rep()
  },

  RecipeDecl(
    _recipe,
    _gap1,
    name,
    _spaces1,
    _open,
    _spaces2,
    params,
    _spaces3,
    _close,
    _gap2,
    _yields,
    _gap3,
    returnType,
    _spaces4,
    _colon,
    body
  ) {
    return new core.RecipeDecl(
      name.rep(),
      params.rep(),
      returnType.rep(),
      body.rep()
    )
  },
  Params(params) {
    return params.rep()
  },
  Param(name, _spaces1, _colon, _spaces2, type) {
    return new core.Param(name.rep(), type.rep())
  },

  IngredientDecl(
    stirringKeyword,
    _stirringGap,
    _ingredient,
    _gap,
    name,
    type,
    _spaces1,
    _eq,
    _spaces2,
    initializer
  ) {
    return new core.IngredientDecl(
      name.rep(),
      optional(type),
      initializer.rep(),
      stirringKeyword.sourceString.length > 0
    )
  },
  TypeAnnotation(_spaces1, _colon, _spaces2, type) {
    return type.rep()
  },

  TopServe(_serve, _gap, expression) {
    return new core.ServeStmt(expression.rep())
  },

  Block(_newlines, statements) {
    if (statements.children.length === 0) {
      return []
    }
    const baseColumn = columnOf(statements.child(0))
    const bodyStatements = []
    for (const statement of statements.children) {
      if (columnOf(statement) < baseColumn) {
        break
      }
      bodyStatements.push(statement.rep())
    }
    return bodyStatements
  },
  Statement(statement) {
    return statement.rep()
  },
  IngredientStatement(_indent, statement, _terminator) {
    return statement.rep()
  },
  StepStatement(_indent, statement, _terminator) {
    return statement.rep()
  },
  ServeStatement(_indent, statement, _terminator) {
    return statement.rep()
  },
  TasteStatement(_indent, statement) {
    return statement.rep()
  },
  SimmerStatement(_indent, statement) {
    return statement.rep()
  },
  BatchStatement(_indent, statement) {
    return statement.rep()
  },
  TossStatement(_indent, statement, _terminator) {
    return statement.rep()
  },
  SkipStatement(_indent, statement, _terminator) {
    return statement.rep()
  },
  SpoiledStatement(_indent, statement, _terminator) {
    return statement.rep()
  },

  StepStmt(_step, _gap, name, _spaces1, _colon, _spaces2, expression) {
    return new core.StepStmt(name.rep(), expression.rep())
  },
  StepAction_assign(target, _spaces1, _eq, _spaces2, expression) {
    return new core.BinaryExp("=", new core.IdRef(target.rep()), expression.rep())
  },
  StepAction_exp(expression) {
    return expression.rep()
  },
  ServeStmt_withExp(_serve, _gap, expression) {
    return new core.ServeStmt(expression.rep())
  },
  ServeStmt_bare(_serve) {
    return new core.ServeStmt(null)
  },
  TossStmt(_toss) {
    return new core.TossStmt()
  },
  SkipStmt(_skip) {
    return new core.SkipStmt()
  },
  SpoiledStmt(_spoiled, _gap, message) {
    return new core.SpoiledStmt(message.rep())
  },

  TasteStmt(_taste, _gap, condition, _spaces, _colon, consequent, alternate) {
    return new core.TasteStmt(condition.rep(), consequent.rep(), optional(alternate))
  },
  OtherwiseClause(_indent, _otherwise, _spaces, _colon, body) {
    return body.rep()
  },
  SimmerStmt(_simmer, _gap, condition, _spaces, _colon, body) {
    return new core.SimmerStmt(condition.rep(), body.rep())
  },
  BatchStmt(_batch, _gap1, name, _gap2, _in, _gap3, collection, _spaces, _colon, body) {
    return new core.BatchStmt(name.rep(), collection.rep(), body.rep())
  },

  Exp_or(left, _gap1, op, _gap2, right) {
    return new core.BinaryExp(op.sourceString, left.rep(), right.rep())
  },
  Exp(expression) {
    return expression.rep()
  },
  Exp1_and(left, _gap1, op, _gap2, right) {
    return new core.BinaryExp(op.sourceString, left.rep(), right.rep())
  },
  Exp1(expression) {
    return expression.rep()
  },
  Exp2_not(op, _gap, operand) {
    return new core.UnaryExp(op.sourceString, operand.rep())
  },
  Exp2(expression) {
    return expression.rep()
  },
  Exp3_compare(left, _spaces1, op, _spaces2, right) {
    return new core.BinaryExp(op.rep(), left.rep(), right.rep())
  },
  Exp3(expression) {
    return expression.rep()
  },
  Exp4_add(left, _spaces1, op, _spaces2, right) {
    return new core.BinaryExp(op.rep(), left.rep(), right.rep())
  },
  Exp4(expression) {
    return expression.rep()
  },
  Exp5_mul(left, _spaces1, op, _spaces2, right) {
    return new core.BinaryExp(op.rep(), left.rep(), right.rep())
  },
  Exp5(expression) {
    return expression.rep()
  },
  Exp6_negate(op, _spaces, operand) {
    return new core.UnaryExp(op.sourceString, operand.rep())
  },
  Exp6(expression) {
    return expression.rep()
  },
  Exp7_fieldAccess(object, _spaces1, _dot, _spaces2, field) {
    return new core.FieldAccessExp(object.rep(), field.rep())
  },
  Exp7_indexAccess(collection, _spaces1, _open, _spaces2, index, _spaces3, _close) {
    return new core.IndexAccessExp(collection.rep(), index.rep())
  },
  Exp7_call(callee, _spaces1, _open, _spaces2, args, _spaces3, _close) {
    return new core.CallExp(callee.rep(), args.rep())
  },
  Exp7(expression) {
    return expression.rep()
  },

  Primary_parens(_open, _spaces1, expression, _spaces2, _close) {
    return expression.rep()
  },
  Primary_id(name) {
    return new core.IdRef(name.rep())
  },
  Primary(expression) {
    return expression.rep()
  },

  StructLit(typeName, _spaces1, _open, _spaces2, fields, _spaces3, _close) {
    return new core.StructLit(typeName.rep(), fields.rep())
  },
  FieldInits(fields) {
    return fields.rep()
  },
  FieldInit(name, _spaces1, _colon, _spaces2, value) {
    return { name: name.rep(), value: value.rep() }
  },
  CollectionLit(_open, _spaces1, elements, _spaces2, _close) {
    return new core.CollectionLit(elements.rep())
  },
  Args(args) {
    return args.rep()
  },

  Type(type) {
    return type.rep()
  },
  Type_userDefined(name) {
    return new core.UserDefinedType(name.rep())
  },
  PrimitiveType(_name) {
    return new core.PrimitiveType(this.sourceString)
  },
  UnitType(_name) {
    return new core.UnitType(this.sourceString)
  },
  CollectionType(_open, _spaces1, elementType, _spaces2, _close) {
    return new core.CollectionType(elementType.rep())
  },

  relop(_op) {
    return this.sourceString
  },
  addop(_op) {
    return this.sourceString
  },
  mulop(_op) {
    return this.sourceString
  },

  UnitLit(_unitlit) {
    const unit = [
      "fahrenheit",
      "celsius",
      "minutes",
      "seconds",
      "liters",
      "grams",
      "hours",
      "cups",
      "tbsp",
      "tsp",
      "floz",
      "lbs",
      "kg",
      "oz",
      "ml",
      "g",
    ].find((suffix) => this.sourceString.endsWith(suffix))
    return new core.UnitLit(Number(this.sourceString.slice(0, -unit.length)), unit)
  },
  unitlit(_number, _unit) {
    return this.sourceString
  },
  unitSuffix(_unit) {
    return this.sourceString
  },
  boollit(_value) {
    return new core.BoolLit(this.sourceString === "yes")
  },
  intlit(_digits) {
    return new core.IntLit(Number(this.sourceString))
  },
  floatlit(_digits, _dot, _fraction) {
    return new core.FloatLit(Number(this.sourceString))
  },
  stringlit(_open, _chars, _close) {
    return new core.StringLit(this.sourceString.slice(1, -1))
  },
  id(_first, _rest) {
    return this.sourceString
  },

  NonemptyListOf(first, _separators, rest) {
    return [first.rep(), ...rest.children.map((item) => item.rep())]
  },
  EmptyListOf() {
    return []
  },
  Terminator(_terminator) {
    return null
  },
  Newlines(_newlines) {
    return null
  },
  _terminal() {
    return this.sourceString
  },
})

export default function parse(source) {
  currentSource = source
  const match = grammar.match(source)
  if (match.failed()) {
    throw new Error(match.message)
  }
  return semantics(match).rep()
}
