#!/usr/bin/env node
import fs from 'fs'
import process from 'process'
import compile from './compiler.js'
import parse from './parser.js'
import analyze from './analyzer.js'
import optimize from './optimizer.js'

const modes = new Set(['--syntax', '--parse', '--analyze', '--optimize'])
const [firstArg, secondArg] = process.argv.slice(2)
const mode = modes.has(firstArg) ? firstArg : null
const filename = mode ? secondArg : firstArg

if (!filename) {
  console.error('Usage: fling [--syntax|--parse|--analyze|--optimize] <filename>')
  process.exit(1)
}

let source
try {
  source = fs.readFileSync(filename, 'utf-8')
} catch (e) {
  console.error(`Error: could not read file '${filename}'`)
  process.exit(1)
}

try {
  if (mode === '--syntax') {
    parse(source)
    console.log('Syntax OK')
  } else if (mode === '--parse') {
    console.log(JSON.stringify(parse(source), null, 2))
  } else if (mode === '--analyze') {
    analyze(parse(source))
    console.log('Analysis OK')
  } else if (mode === '--optimize') {
    console.log(JSON.stringify(optimize(analyze(parse(source))), null, 2))
  } else {
    const output = compile(source)
    process.stdout.write(output)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
