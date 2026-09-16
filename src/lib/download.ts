// Anything on screen can leave as a file. The office user lives in a spreadsheet.

export function csvField(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(headers: readonly string[], rows: readonly (string | number | boolean)[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(csvField).join(','))].join('\n') + '\n'
}

export function download(filename: string, contents: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so Safari has finished with it.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
