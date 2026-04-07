# Coding Standards and Workflow

## Branching and Commits
- Use short-lived feature branches.
- Keep commits focused and descriptive.
- Do not mix unrelated fixes in one commit.

## Pull Request Rules
- Include summary, scope, and risk.
- Add screenshots for UI changes.
- Add test notes for QA.

## Backend Standards
- Keep business rules in service/domain layer where possible.
- Validate tenant/outlet ownership on all sensitive endpoints.
- Avoid exposing internal stack traces in API responses.

## Frontend Standards
- Keep components small and readable.
- Reuse shared UI primitives.
- Handle loading, empty, and error states explicitly.

## API Documentation Standard
For each endpoint, document:
- Method and URL
- Auth requirement
- Request schema
- Response schema
- Error cases

## Migration and Data Safety
- Review every migration before deploy.
- Back up production before major schema changes.
- Never run destructive migration without rollback strategy.

## Multi-Tenant Safety Rules
- Never trust tenant from public request payload.
- Always resolve tenant from authenticated context or storefront slug/domain.
- Add tests for cross-tenant access denial.

## Definition of Done
- Feature implemented
- Errors handled
- Documentation updated
- Release note entry added
- QA checklist completed
