import * as XLSX from "xlsx"

export interface ExportColumn {
  key: string
  label: string
  format?: "currency" | "date" | "number" | "text" | "percentage"
  width?: number
}

export interface ExportConfig {
  data: any[]
  fileName: string
  sheetName?: string
  columns?: ExportColumn[]
  includeHeaders?: boolean
  autoFilter?: boolean
  freezeHeader?: boolean
}

/**
 * Format cell value based on column type
 */
function formatCellValue(value: any, format?: string): string | number | Date {
  if (value === null || value === undefined) return ""

  switch (format) {
    case "currency":
      return typeof value === "number" ? value : parseFloat(String(value)) || 0
    case "date":
      if (value instanceof Date) return value
      if (typeof value === "string") {
        const date = new Date(value)
        return isNaN(date.getTime()) ? value : date
      }
      return value
    case "number":
      return typeof value === "number" ? value : parseFloat(String(value)) || 0
    case "percentage":
      return typeof value === "number" ? value / 100 : parseFloat(String(value)) / 100 || 0
    default:
      return String(value)
  }
}

/**
 * Transform dataset for export based on columns configuration
 */
function transformData(data: any[], columns?: ExportColumn[]): any[] {
  if (!columns || columns.length === 0) {
    return data
  }

  return data.map((row) => {
    const transformedRow: Record<string, any> = {}
    columns.forEach((col) => {
      const value = getNestedValue(row, col.key)
      transformedRow[col.label] = formatCellValue(value, col.format)
    })
    return transformedRow
  })
}

/**
 * Get nested value from object using dot notation (e.g., "outlet.name")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, prop) => current?.[prop], obj)
}

/**
 * Apply formatting and styling to worksheet
 */
function styleWorksheet(
  worksheet: XLSX.WorkSheet,
  columns?: ExportColumn[],
  includeHeaders?: boolean
) {
  if (!worksheet["!cols"]) {
    worksheet["!cols"] = []
  }

  // Set column widths
  if (columns) {
    worksheet["!cols"] = columns.map((col) => ({
      wch: col.width || 20,
    }))
  }

  // Freeze header row
  if (includeHeaders) {
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 }
  }

  return worksheet
}

/**
 * Main export function - generates and downloads XLSX file
 */
export async function exportToXLSX(config: ExportConfig): Promise<void> {
  const {
    data,
    fileName,
    sheetName = "Data",
    columns,
    includeHeaders = true,
    freezeHeader = true,
  } = config

  if (!data || data.length === 0) {
    throw new Error("No data to export")
  }

  try {
    // Transform data based on columns
    const transformedData = transformData(data, columns)

    // Build header row if needed
    let worksheetData: any[] = []
    if (includeHeaders && columns && columns.length > 0) {
      worksheetData.push(columns.map((col) => col.label))
      worksheetData = worksheetData.concat(
        transformedData.map((row) => columns.map((col) => row[col.label]))
      )
    } else if (includeHeaders && !columns) {
      // Auto-detect headers from first row
      const headers = Object.keys(transformedData[0] || {})
      worksheetData.push(headers)
      worksheetData = worksheetData.concat(
        transformedData.map((row) => headers.map((h) => row[h]))
      )
    } else {
      worksheetData = transformedData
    }

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // Apply styling
    styleWorksheet(worksheet, columns, includeHeaders)

    // Create workbook and append sheet
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0]
    const fullFileName = `${fileName}-${timestamp}.xlsx`

    // Write file
    XLSX.writeFile(workbook, fullFileName)

    console.log(`[Export] ✅ Successfully exported ${data.length} rows to ${fullFileName}`)
  } catch (error) {
    console.error("[Export] ❌ Failed to export:", error)
    throw new Error(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Export to CSV format (fallback)
 */
export async function exportToCSV(config: ExportConfig): Promise<void> {
  const {
    data,
    fileName,
    columns,
  } = config

  if (!data || data.length === 0) {
    throw new Error("No data to export")
  }

  try {
    const transformedData = transformData(data, columns)

    // Build CSV headers
    let csv = ""
    if (columns && columns.length > 0) {
      csv += columns.map((col) => `"${col.label}"`).join(",") + "\n"
      csv += transformedData
        .map((row) =>
          columns.map((col) => {
            const value = row[col.label]
            return `"${String(value).replace(/"/g, '""')}"`
          }).join(",")
        )
        .join("\n")
    } else {
      // Auto-detect columns
      const firstRow = transformedData[0] || {}
      const headers = Object.keys(firstRow)
      csv += headers.map((h) => `"${h}"`).join(",") + "\n"
      csv += transformedData
        .map((row) =>
          headers.map((h) => {
            const value = row[h]
            return `"${String(value).replace(/"/g, '""')}"`
          }).join(",")
        )
        .join("\n")
    }

    // Create blob and download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    const timestamp = new Date().toISOString().split("T")[0]
    link.setAttribute("href", url)
    link.setAttribute("download", `${fileName}-${timestamp}.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    console.log(`[Export] ✅ Successfully exported ${data.length} rows to CSV`)
  } catch (error) {
    console.error("[Export] ❌ Failed to export CSV:", error)
    throw new Error(`CSV export failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Export with auto-detected columns from data
 * Useful for quick exports without column configuration
 */
export async function quickExportXLSX(
  data: any[],
  fileName: string,
  sheetName = "Data"
): Promise<void> {
  return exportToXLSX({
    data,
    fileName,
    sheetName,
    includeHeaders: true,
    freezeHeader: true,
  })
}
