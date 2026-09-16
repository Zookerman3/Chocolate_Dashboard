import { describe, expect, it } from 'vitest'
import { csvField, toCSV } from './download.ts'

describe('csvField', () => {
  it('leaves a plain value alone', () => {
    expect(csvField('Amaretto')).toBe('Amaretto')
  })
  it('quotes a value containing a comma, a quote or a newline', () => {
    expect(csvField('Cookies, Cream')).toBe('"Cookies, Cream"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('a\nb')).toBe('"a\nb"')
  })
})

describe('toCSV', () => {
  it('writes a header and one line per row, ending with a newline', () => {
    expect(toCSV(['a', 'b'], [[1, 'x'], [2, 'y, z']])).toBe('a,b\n1,x\n2,"y, z"\n')
  })
})
