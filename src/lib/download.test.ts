import { describe, expect, it } from 'vitest'
import { buildSampleRecords } from '../data/sampleRecords.ts'
import { csvField, recordsToCSV, toCSV } from './download.ts'
import { parseCSV } from './ingest.ts'

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

describe('recordsToCSV', () => {
  const RECORDS = buildSampleRecords({ now: new Date('2026-09-16T18:00:00Z'), days: 10 })

  it('round-trips through parseCSV with nothing lost, location included', () => {
    const { records, skipped } = parseCSV(recordsToCSV(RECORDS))
    expect(skipped).toEqual([])
    expect(records).toHaveLength(RECORDS.length)
    const byId = new Map(records.map((r) => [r.id, r]))
    for (const original of RECORDS) {
      const round = byId.get(original.id)
      expect(round, `box ${original.id} missing after round-trip`).toBeDefined()
      expect(round!.pieces).toEqual(original.pieces)
      expect(round!.locationId).toBe(original.locationId)
      expect(round!.method).toBe(original.method)
      expect(round!.durationMs).toBe(original.durationMs)
      expect(round!.demo).toBe(original.demo)
    }
  })

  it('writes an empty location field for a box that has none', () => {
    const [first] = RECORDS
    const { locationId: _dropped, ...noLocation } = first
    void _dropped
    const line = recordsToCSV([noLocation]).split('\n')[1]
    expect(line.split(',')[4]).toBe('')
  })
})
