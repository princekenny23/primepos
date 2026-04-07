# Authentication and Security

## Authentication Model
Private APIs require bearer token authentication.

Header format:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Typical Auth Flow
1. User logs in with username/email and password.
2. API returns access token (and optional refresh token).
3. Client stores token securely.
4. Client sends token with each protected request.

## Login Example
```http
POST /api/v1/auth/login/
Content-Type: application/json

{
  "email": "admin@business.com",
  "password": "StrongPassword123"
}
```

Example response:
```json
{
  "access": "eyJhbGciOi...",
  "refresh": "eyJhbGciOi...",
  "user": {
    "id": 7,
    "name": "Branch Admin"
  }
}
```

## Token Refresh (if enabled)
```http
POST /api/v1/auth/refresh/
Content-Type: application/json

{
  "refresh": "eyJhbGciOi..."
}
```

## Security Best Practices
- Use HTTPS in all environments except local development.
- Never expose tokens in logs or screenshots.
- Rotate credentials for compromised users immediately.
- Enforce role-based access at endpoint level.

## Tenant Isolation
All private API access must be tenant-scoped. Do not accept tenant IDs from public storefront clients.
