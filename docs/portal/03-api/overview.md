# API Overview

## Purpose
PrimePOS APIs allow secure integration for POS, Inventory, CRM, E-commerce storefront, and Fleet workflows.

## Base URL
- Production: `https://your-domain/api/v1`
- Local: `http://localhost:8000/api/v1`

## Core Principles
- JSON request/response format
- Token-based authentication for private APIs
- Tenant-aware data isolation
- Consistent error payloads

## Standard Response Patterns
### Success
```json
{
  "id": 123,
  "status": "ok"
}
```

### Error
```json
{
  "detail": "Validation failed",
  "errors": {
    "field_name": ["This field is required."]
  }
}
```

## HTTP Status Guide
- `200 OK`: Read/update successful
- `201 Created`: Resource created
- `400 Bad Request`: Validation/business rule issue
- `401 Unauthorized`: Missing/invalid token
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource missing
- `429 Too Many Requests`: Throttled
- `500 Internal Server Error`: Unexpected server failure

## Module Groups
- POS and Sales
- Inventory and Products
- CRM Customers
- Storefront E-commerce
- Fleet and Logistics

## OpenAPI/Swagger Readiness Notes
Structure endpoint docs using this model:
- `path`
- `method`
- `summary`
- `requestSchema`
- `responseSchema`
- `exampleRequest`
- `exampleResponse`

This structure can be converted later into Swagger/OpenAPI YAML with minimal rework.
