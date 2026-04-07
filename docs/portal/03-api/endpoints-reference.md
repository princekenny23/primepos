# Module Endpoints and Examples

This page provides practical endpoint references by module.

## 1. POS and Sales

### Create Sale
- Method: `POST`
- URL: `/api/v1/sales/`

Request example:
```json
{
  "outlet": 15,
  "payment_method": "cash",
  "items_data": [
    { "product_id": 101, "quantity": 2, "price": "1500.00" }
  ]
}
```

Response example:
```json
{
  "id": 923,
  "receipt_number": "10293",
  "total": "3000.00",
  "status": "completed"
}
```

## 2. Inventory and Products

### List Products
- Method: `GET`
- URL: `/api/v1/products/?page_size=50&is_active=true`

### Create Product
- Method: `POST`
- URL: `/api/v1/products/`

Request example:
```json
{
  "name": "Sunflower Oil 1L",
  "sku": "OIL-001",
  "retail_price": "8500.00",
  "stock": 30,
  "unit": "pcs"
}
```

## 3. CRM Customers

### Create Customer
- Method: `POST`
- URL: `/api/v1/customers/`

Request example:
```json
{
  "name": "James Banda",
  "phone": "+265991234567",
  "email": "james@example.com"
}
```

## 4. Storefront E-commerce

### Resolve Storefront
- Method: `GET`
- URL: `/api/v1/storefronts/resolve/?host=shop.example.com`

### Public Products
- Method: `GET`
- URL: `/api/v1/storefronts/{slug}/products/`

### Create Checkout Order
- Method: `POST`
- URL: `/api/v1/storefronts/{slug}/checkout/create-order/`

Request example:
```json
{
  "customer_name": "Mary Phiri",
  "customer_phone": "+265999111222",
  "customer_address": "Area 47, Lilongwe",
  "notes": "Call when near",
  "items": [
    { "product_id": 1001, "quantity": 1 }
  ]
}
```

Response example:
```json
{
  "order": {
    "public_order_ref": "ORD-49CE568B9D",
    "status": "pending",
    "total": "8500.00"
  },
  "whatsapp_url": "https://wa.me/265..."
}
```

## 5. Fleet Management

### List Vehicles
- Method: `GET`
- URL: `/api/v1/fleet/vehicles/`

### Create Trip
- Method: `POST`
- URL: `/api/v1/fleet/trips/`

## JavaScript Integration Example
```javascript
const token = process.env.PRIMEPOS_TOKEN;

const res = await fetch('https://your-domain/api/v1/products/?page_size=20', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await res.json();
console.log(data);
```

## Python Integration Example
```python
import requests

base_url = "https://your-domain/api/v1"
token = "YOUR_ACCESS_TOKEN"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

response = requests.get(f"{base_url}/products/?page_size=20", headers=headers, timeout=30)
response.raise_for_status()
print(response.json())
```

## Suggested OpenAPI Mapping Template
```yaml
paths:
  /api/v1/storefronts/{slug}/checkout/create-order/:
    post:
      summary: Create storefront order
      parameters:
        - in: path
          name: slug
          required: true
          schema:
            type: string
      requestBody:
        required: true
      responses:
        "201":
          description: Order created
        "400":
          description: Validation error
```
