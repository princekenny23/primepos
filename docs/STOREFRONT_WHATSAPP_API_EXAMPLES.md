# Storefront WhatsApp API Examples

## 1. Resolve Storefront
Request:
```http
GET /api/v1/storefronts/resolve/?host=shop.example.com
```

Response:
```json
{
  "slug": "main-store",
  "name": "Main Store",
  "currency": "MWK",
  "has_whatsapp_checkout": true
}
```

## 2. List Products
Request:
```http
GET /api/v1/storefronts/main-store/products/?search=cola
```

Response:
```json
[
  {
    "id": 12,
    "name": "Coca Cola 500ml",
    "description": "Soft drink",
    "category": 4,
    "category_name": "Beverages",
    "retail_price": "1500.00",
    "display_price": "1500.00",
    "stock": 42,
    "unit": "pcs",
    "image_url": "https://example.com/media/products/coke.jpg"
  }
]
```

## 3. Validate Checkout
Request:
```http
POST /api/v1/storefronts/main-store/checkout/validate/
Content-Type: application/json

{
  "customer_name": "John Banda",
  "customer_phone": "+265991234567",
  "customer_address": "Area 18, Lilongwe",
  "notes": "Deliver after 5 PM",
  "items": [
    { "product_id": 12, "unit_id": 7, "quantity": 2 },
    { "product_id": 18, "quantity": 1 }
  ]
}
```

Response:
```json
{ "valid": true }
```

## 4. Create WhatsApp Cash Order
Request:
```http
POST /api/v1/storefronts/main-store/checkout/create-order/
Content-Type: application/json

{
  "customer_name": "John Banda",
  "customer_phone": "+265991234567",
  "customer_address": "Area 18, Lilongwe",
  "notes": "Deliver after 5 PM",
  "items": [
    { "product_id": 12, "unit_id": 7, "quantity": 2 },
    { "product_id": 18, "quantity": 1 }
  ]
}
```

Response:
```json
{
  "order": {
    "public_order_ref": "ORD-8A12C3D4E5",
    "channel": "whatsapp",
    "payment_method": "cash",
    "status": "pending",
    "customer_name": "John Banda",
    "customer_phone": "+265991234567",
    "sale_id": 3221,
    "receipt_number": "RCP-20260402-0012",
    "total": "4200.00",
    "created_at": "2026-04-02T10:23:41.210Z"
  },
  "whatsapp_url": "https://wa.me/265991112233?text=Order+Ref%3A+RCP-20260402-0012..."
}
```

## 5. Fetch Order by Public Ref
Request:
```http
GET /api/v1/storefronts/main-store/orders/ORD-8A12C3D4E5/
```

Response:
```json
{
  "public_order_ref": "ORD-8A12C3D4E5",
  "channel": "whatsapp",
  "payment_method": "cash",
  "status": "pending",
  "customer_name": "John Banda",
  "customer_phone": "+265991234567",
  "sale_id": 3221,
  "receipt_number": "RCP-20260402-0012",
  "total": "4200.00",
  "created_at": "2026-04-02T10:23:41.210Z"
}
```

## Integration Notes
- Public API resolves tenant through storefront slug/domain only.
- No tenant IDs are accepted from public clients.
- Orders are persisted as Sale + SaleItem rows for normal reporting compatibility.
- Channel metadata is stored in StorefrontOrder with `channel=whatsapp`.
