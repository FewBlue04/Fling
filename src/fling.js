#!/usr/bin/env node
import fs from 'fs'
import process from 'process'
import compile from './compiler.js'

const filename = process.argv[2]

if (!filename) {
  console.error('Usage: fling <filename>')
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
  const output = compile(source)
  process.stdout.write(output)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
