/**
 * Import Validation Utilities
 * Per-business-type validation rules and error handling
 */

import type { BusinessType } from "@/lib/types"
import {
  getRequiredFields,
  getBusinessSpecificFields,
  type BusinessType as BTType,
} from "./excel-import-fields"

export interface ValidationError {
  row: number
  field: string
  value: any
  message: string
  severity: "error" | "warning"
  suggestion?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  rowCount: number
  validRowCount: number
}

// Validation rules per business type
const validationRules: Record<string, Record<string, (value: any) => { valid: boolean; message?: string }>> = {
  "wholesale and retail": {
    product_name: (val) =>
      val && val.trim().length > 0
        ? { valid: true }
        : { valid: false, message: "Product name is required" },
    retail_price: (val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
        ? { valid: true }
        : { valid: false, message: "Retail price must be a number greater than 0" }
    },
    wholesale_price: (val) => {
      if (!val || val === "") return { valid: true } // Optional
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
        ? { valid: true }
        : { valid: false, message: "Wholesale price must be a number greater than 0" }
    },
    conversion_factor: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseFloat(val)
      return !isNaN(num) && num >= 1
        ? { valid: true }
        : { valid: false, message: "Conversion factor must be >= 1" }
    },
    quantity: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseInt(val)
      return !isNaN(num) && num >= 0
        ? { valid: true }
        : { valid: false, message: "Quantity must be a non-negative number" }
    },
    barcode: (val) => {
      if (!val || val === "") return { valid: true }
      // EAN/UPC barcodes are typically 8, 12, 13, or 14 digits
      const cleaned = val.toString().replace(/[^0-9]/g, "")
      return cleaned.length >= 8
        ? { valid: true }
        : { valid: false, message: "Barcode should be at least 8 digits" }
    },
  },
  bar: {
    product_name: (val) =>
      val && val.trim().length > 0
        ? { valid: true }
        : { valid: false, message: "Product name is required" },
    retail_price: (val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
        ? { valid: true }
        : { valid: false, message: "Price must be a number greater than 0" }
    },
    volume_ml: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
        ? { valid: true }
        : { valid: false, message: "Volume must be greater than 0" }
    },
    alcohol_percentage: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0 && num <= 100
        ? { valid: true }
        : { valid: false, message: "Alcohol percentage must be 0-100" }
    },
    quantity: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseInt(val)
      return !isNaN(num) && num >= 0
        ? { valid: true }
        : { valid: false, message: "Quantity must be a non-negative number" }
    },
  },
  restaurant: {
    product_name: (val) =>
      val && val.trim().length > 0
        ? { valid: true }
        : { valid: false, message: "Product name is required" },
    retail_price: (val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
        ? { valid: true }
        : { valid: false, message: "Price must be a number greater than 0" }
    },
    preparation_time: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseInt(val)
      return !isNaN(num) && num > 0
        ? { valid: true }
        : { valid: false, message: "Preparation time must be greater than 0" }
    },
    quantity: (val) => {
      if (!val || val === "") return { valid: true }
      const num = parseInt(val)
      return !isNaN(num) && num >= 0
        ? { valid: true }
        : { valid: false, message: "Quantity must be a non-negative number" }
    },
  },
}

/**
 * Validate a single row of import data
 */
export function validateRow(
  row: any,
  rowNumber: number,
  businessType: BTType
): ValidationError[] {
  const errors: ValidationError[] = []
  const requiredFields = getRequiredFields(businessType)
  const rules = businessType ? validationRules[businessType] || {} : {}

  // Check required fields
  requiredFields.forEach(field => {
    if (!field.name) return
    if (!row[field.name] || (typeof row[field.name] === "string" && row[field.name].trim() === "")) {
      errors.push({
        row: rowNumber,
        field: field.name,
        value: row[field.name],
        message: `${field.label || field.name} is required`,
        severity: "error",
        suggestion: `Please provide a value for ${field.label || field.name}`,
      })
    }
  })

  // Apply field-specific validation rules
  Object.entries(row).forEach(([field, value]) => {
    if (field in rules) {
      const rule = rules[field]
      const result = rule(value)
      if (!result.valid) {
        errors.push({
          row: rowNumber,
          field,
          value,
          message: result.message || "Invalid value",
          severity: "error",
          suggestion: `Fix the value in column '${field}' for row ${rowNumber}`,
        })
      }
    }
  })

  return errors
}

/**
 * Validate all rows in import data
 */
export function validateImportData(
  rows: any[],
  businessType: BTType
): ValidationResult {
  const errors: ValidationError[] = []
  let validRowCount = 0

  rows.forEach((row, idx) => {
    const rowErrors = validateRow(row, idx + 2, businessType) // +2 because row 1 is headers and idx starts at 0
    errors.push(...rowErrors)
    if (rowErrors.length === 0) {
      validRowCount++
    }
  })

  return {
    isValid: errors.length === 0,
    errors: errors.filter(e => e.severity === "error"),
    warnings: errors.filter(e => e.severity === "warning"),
    rowCount: rows.length,
    validRowCount,
  }
}

/**
 * Get user-friendly error message for a validation error
 */
export function getErrorMessage(error: ValidationError): string {
  return `Row ${error.row}, Column "${error.field}": ${error.message}`
}

/**
 * Group validation errors by field for easier display
 */
export function groupErrorsByField(errors: ValidationError[]): Record<string, ValidationError[]> {
  return errors.reduce((acc, error) => {
    const key = error.field || "unknown"
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(error)
    return acc
  }, {} as Record<string, ValidationError[]>)
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(result: ValidationResult): string {
  const { validRowCount, rowCount, errors } = result

  if (validRowCount === rowCount) {
    return `✓ All ${rowCount} rows are valid and ready to import`
  }

  const invalidCount = rowCount - validRowCount
  return `⚠️ ${validRowCount}/${rowCount} rows valid • ${errors.length} error(s) found`
}

/**
 * Generate validation error report
 */
export function generateErrorReport(errors: ValidationError[]): string {
  const grouped = groupErrorsByField(errors)
  const lines: string[] = []

  lines.push(`Import Validation Report`)
  lines.push(`Total Errors: ${errors.length}`)
  lines.push("")

  Object.entries(grouped).forEach(([field, fieldErrors]) => {
    lines.push(`❌ ${field}`)
    fieldErrors.slice(0, 5).forEach(error => {
      lines.push(`  Row ${error.row}: ${error.message}`)
      if (error.suggestion) {
        lines.push(`  💡 ${error.suggestion}`)
      }
    })
    if (fieldErrors.length > 5) {
      lines.push(`  ... and ${fieldErrors.length - 5} more`)
    }
    lines.push("")
  })

  return lines.join("\n")
}

/**
 * Filter out invalid rows and return only valid ones
 */
export function filterValidRows(
  rows: any[],
  businessType: BTType
): { valid: any[]; invalid: any[] } {
  const valid: any[] = []
  const invalid: any[] = []

  rows.forEach((row, idx) => {
    const errors = validateRow(row, idx + 2, businessType)
    if (errors.length === 0) {
      valid.push(row)
    } else {
      invalid.push({ row, errors, rowNumber: idx + 2 })
    }
  })

  return { valid, invalid }
}
