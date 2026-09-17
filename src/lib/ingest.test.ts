import { describe, expect, it } from 'vitest'
import { IngestError, parseCSV, parseCSVRows, parseExport, parseJSON } from './ingest.ts'

const CSV_HEADER =
  'box_id,box_size,method,demo,started_at,completed_at,duration_ms,undo_count,flavor_id,flavor_name,piece_count'

const CSV = [
  CSV_HEADER,
  'bx-1,6,tap,false,2026-09-16T17:00:00.000Z,2026-09-16T17:00:30.000Z,30000,1,amaretto,Amaretto,4',
  'bx-1,6,tap,false,2026-09-16T17:00:00.000Z,2026-09-16T17:00:30.000Z,30000,1,lemon,Lemon,2',
  'bx-2,10,camera-assisted,false,2026-09-16T18:00:00.000Z,2026-09-16T18:00:45.000Z,45000,0,turtle,Turtle,10',
].join('\n')

describe('parseCSV', () => {
  it('folds the long format back into one record per box', () => {
    const { records, skipped } = parseCSV(CSV)
    expect(skipped).toEqual([])
    expect(records).toHaveLength(2)
    const first = records.find((r) => r.id === 'bx-1')!
    expect(first.pieces).toEqual([
      { flavorId: 'amaretto', count: 4 },
      { flavorId: 'lemon', count: 2 },
    ])
    expect(first.size).toBe(6)
    expect(first.undoCount).toBe(1)
    expect(records.find((r) => r.id === 'bx-2')!.method).toBe('camera-assisted')
  })

  it('names the column it needs rather than failing vaguely', () => {
    const noFlavor = CSV.replace('flavor_id', 'flavour_id')
    expect(() => parseCSV(noFlavor)).toThrow(IngestError)
    expect(() => parseCSV(noFlavor)).toThrow(/flavor_id/)
  })

  it('reports an incomplete row instead of dropping it silently', () => {
    const { records, skipped } = parseCSV(`${CSV}\nbx-3,16,tap,false,,,,,,,`)
    expect(records).toHaveLength(2)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toMatch(/row 5/)
  })

  it('refuses a header with no rows under it', () => {
    expect(() => parseCSV(CSV_HEADER)).toThrow(/no rows/)
  })
})

describe('parseCSVRows', () => {
  it('handles quoted fields, embedded commas and doubled quotes', () => {
    const rows = parseCSVRows('a,"b,c","say ""hi"""\n1,2,3')
    expect(rows[0]).toEqual(['a', 'b,c', 'say "hi"'])
    expect(rows[1]).toEqual(['1', '2', '3'])
  })

  it('reads CRLF line endings', () => {
    expect(parseCSVRows('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseJSON', () => {
  const record = {
    id: 'bx-9', size: 16, pieces: [{ flavorId: 'lemon', count: 16 }],
    startedAt: '2026-09-16T10:00:00.000Z', completedAt: '2026-09-16T10:01:00.000Z',
    durationMs: 60000, undoCount: 0, method: 'tap', demo: false,
  }

  it('reads a bare array', () => {
    expect(parseJSON(JSON.stringify([record])).records).toHaveLength(1)
  })

  it('reads a { records: [...] } wrapper too', () => {
    expect(parseJSON(JSON.stringify({ records: [record] })).records).toHaveLength(1)
  })

  it('explains bad JSON in plain words', () => {
    expect(() => parseJSON('{oh no')).toThrow(/not valid JSON/)
  })

  it('rejects a JSON document that is not a record list', () => {
    expect(() => parseJSON('{"hello":"world"}')).toThrow(/not a list/)
  })

  it('skips an invalid entry and says which one and why', () => {
    const { records, skipped } = parseJSON(JSON.stringify([record, { id: 'bx-10', size: 7, pieces: [] }]))
    expect(records).toHaveLength(1)
    expect(skipped[0]).toMatch(/entry 2: unknown box size 7/)
  })

  it('keeps an optional locationId and defaults an unknown method to tap', () => {
    const { records } = parseJSON(JSON.stringify([{ ...record, locationId: 'bradley', method: 'telepathy' }]))
    expect(records[0].locationId).toBe('bradley')
    expect(records[0].method).toBe('tap')
  })

  it('keeps the receivedAt the API stamped, and adds none when there was none', () => {
    const fromApi = { ...record, receivedAt: '2026-09-17T17:40:44.367Z' }
    const { records } = parseJSON(JSON.stringify([fromApi, record]))
    expect(records[0].receivedAt).toBe('2026-09-17T17:40:44.367Z')
    expect(records[1]).not.toHaveProperty('receivedAt')
  })
})

describe('parseExport', () => {
  it('picks the format from the filename, then from the content', () => {
    expect(parseExport(CSV, 'boxes.csv').format).toBe('csv')
    expect(parseExport('[]', 'boxes.json').format).toBe('json')
    expect(parseExport(CSV).format).toBe('csv')
  })
})
