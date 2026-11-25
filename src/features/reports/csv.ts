/**
 * CSV for the Reports download, pure. Fields with a comma, quote or line
 * break are quoted (quotes doubled); a byte-order mark lets spreadsheet
 * apps read accents; lines end with CRLF (RFC 4180).
 */
export const CSV_BOM = "﻿"

export function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value)
  // A leading = + - @ would run as a formula in spreadsheet apps.
  const safe = /^[=+\-@]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function toCsv(headers: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return CSV_BOM + [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n"
}

/** Starts a file download in the browser. */
export function downloadText(text: string, fileName: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
