# Phase 1 No-Duplicate Implementation Gate

Date: 2026-07-13
Owner: Full Stack Team
Status: Approved baseline before Phase 1 coding

## Goal
Before writing any new import-engine code, prevent duplicate implementations by locking scope, ownership, and reuse rules.

## Existing Implementations To Reuse (Do Not Rebuild)
1. Product bulk import endpoint already exists in backend.
- backend/apps/products/views.py (bulk_import)
- backend/apps/products/urls.py (products/bulk-import)
- backend/primepos/urls.py (api/v1/products/bulk-import)

2. Product bulk export endpoint already exists in backend.
- backend/apps/products/views.py (bulk_export)
- backend/apps/products/urls.py (products/bulk-export)
- backend/primepos/urls.py (api/v1/products/bulk-export)

3. Frontend import flow already exists.
- frontend/components/modals/data-exchange-modal.tsx (handleImport)
- frontend/lib/services/productService.ts (bulkImport)
- frontend/lib/utils/data-exchange-config.ts (products.apiEndpoints.import)

4. Inventory movement and atomic stock helpers already exist.
- backend/apps/inventory/models.py (StockMovement immutable rules)
- backend/apps/inventory/stock_helpers.py (deduct_stock, add_stock, adjust_stock)
- backend/apps/inventory/views.py (adjust, transfer, receive)

## Confirmed Duplicate Risks Found
1. Product serializer has duplicate method definitions.
- backend/apps/products/serializers.py has create/update defined twice.

2. Bulk import/export routes are registered in more than one place.
- backend/apps/products/urls.py
- backend/primepos/urls.py

3. Frontend has more than one way to import.
- Modal direct fetch path and productService bulkImport path.

## Phase 1 Scope Lock (No New Parallel Paths)
1. Keep one backend entrypoint per operation.
- Import: ProductViewSet.bulk_import only.
- Export: ProductViewSet.bulk_export only.

2. Keep one frontend import caller.
- DataExchangeModal must call productService.bulkImport.
- No direct fetch implementation for product import in UI components.

3. Keep one stock write path.
- All stock changes from import must call existing stock helpers.
- No direct LocationStock-only writes for inventory mutation.

## Phase 1 Guard Checklist (Must Pass Before PR Merge)
1. Search for duplicate method names in touched serializers.
- Reject if same method is declared twice in one class.

2. Search for duplicate URL routes for the same action.
- Reject if import/export route is declared in multiple modules without explicit compatibility reason.

3. Search for duplicate API-call implementations in frontend.
- Reject if one feature has both direct fetch and service method patterns.

4. Search for duplicate business logic.
- Reject if import logic is copied into views and services with divergent behavior.

## Naming And Placement Rules For New Phase 1 Code
1. New domain code for enterprise import must live under apps/imports.
2. Existing product view should delegate to service layer, not duplicate parser logic inline.
3. Frontend new import wizard code should live under frontend/components/imports and use one service API.

## Phase 1 Acceptance Criteria (No-Duplicate Definition)
1. One canonical import apply path.
2. One canonical import preview path.
3. One canonical export path.
4. Zero duplicate serializer create/update methods in touched serializers.
5. No copied stock mutation logic outside inventory helpers.

## Immediate Pre-Implementation Actions
1. Remove duplicate create/update methods in ProductSerializer before Phase 1 feature coding.
2. Choose a single source for bulk import/export route registration and deprecate the duplicate.
3. Refactor DataExchangeModal to use productService.bulkImport instead of direct fetch.

## Out Of Scope For This Gate
1. Full preview/apply workflow implementation.
2. New import batch models and worker queue.
3. Performance tuning and load test expansion.

This document is the mandatory gate for Phase 1 start.
