# PrimePOS System User Guide and Training Playbook

## 1. Purpose
This guide helps administrators, managers, and trainers teach users how to operate the PrimePOS system safely and consistently across all modules.

Training goals:
- Reduce onboarding time
- Standardize operations across outlets
- Minimize errors in sales, inventory, and reporting
- Improve confidence and accountability by role

## 2. System Modules
The primary module groups are:
- Core
- Dash
- Sales
- POS
- Inventory
- Office
- Settings

Depending on tenant configuration, additional domain modules may appear (for example Restaurant, Bar, Distribution).

## 3. Role-Based Access Model
Train users by role first, then by feature.

Recommended roles:
- Cashier
- Supervisor
- Inventory Clerk
- Office/Admin User
- Branch Manager
- System Admin

Role training rules:
- Teach only the pages users are authorized to use
- Explain approval boundaries and escalation points
- Require sign-off before production access

## 4. Training Delivery Framework
Use a consistent teaching loop for each workflow:
1. Explain business objective
2. Demonstrate process once
3. Learner repeats process
4. Validate with scenario test
5. Capture competency sign-off

Recommended training sequence:
- Phase A: Foundation (navigation, login, outlet, shift)
- Phase B: Daily operations (sales, inventory, office)
- Phase C: Exceptions (returns, voids, reconciliation, troubleshooting)
- Phase D: Certification and supervised go-live

## 5. Quick Start for New Users
### 5.1 First Login
1. Open system URL
2. Enter username and password
3. Confirm correct tenant/business context
4. Confirm assigned outlet

### 5.2 Start of Shift Checklist
1. Select correct outlet
2. Start shift with opening cash
3. Verify printer connection status
4. Confirm till assignment
5. Confirm products and prices are visible in POS

### 5.3 End of Shift Checklist
1. Reconcile expected and physical cash
2. Record discrepancies with notes
3. Ensure pending transactions are resolved
4. Close shift
5. Supervisor validates shift summary

## 6. Module SOPs
## 6.1 POS and Sales SOP
Primary users: Cashier, Supervisor

Core workflow:
1. Select items
2. Confirm quantities and unit prices
3. Apply discounts only within role policy
4. Attach customer when required
5. Select payment method
6. Complete sale
7. Print or reprint receipt if needed

Exception handling:
- Return or void requires reason and permissions
- Credit sale actions must include customer linkage
- Failed print should not block transaction completion

Trainer validation tasks:
- Complete one cash sale
- Complete one mobile/transfer sale
- Complete one refund/return flow
- Reprint receipt

## 6.2 Inventory SOP
Primary users: Inventory Clerk, Supervisor

Core workflow:
1. Create or review purchase order
2. Receive stock by outlet
3. Validate quantities and costs
4. Post stock adjustments with reason
5. Process supplier returns when applicable
6. Perform stock take sessions

Controls:
- Never perform bulk adjustment without reference note
- Separate receiving and approval responsibilities if possible
- Validate outlet before transfer or receiving actions

Trainer validation tasks:
- Create purchase order
- Receive stock
- Adjust stock with note
- Complete stock take session

## 6.3 Office SOP
Primary users: Office User, Manager

Core workflow:
1. Manage quotations (create, edit, print, convert)
2. Enter and classify expenses
3. Maintain customer records
4. Manage users and roles (authorized users only)
5. Monitor shift summaries and cashups

Controls:
- Validate customer and item data before quotation approval
- Require expense evidence where policy applies
- Role changes must be tracked and reviewed

Trainer validation tasks:
- Create and update quotation
- Submit expense
- Update customer details
- Run shift report and interpret totals

## 6.4 Reports SOP
Primary users: Supervisor, Manager, Admin

Common reports:
- Sales summary
- Item and category sales
- Cashup and shift reconciliation
- Profit and loss
- Stock valuation

Best practice:
1. Confirm date range
2. Confirm outlet filter
3. Compare report totals to source transactions
4. Export only after validation

Trainer validation tasks:
- Run two report types
- Explain difference between gross sales and net values
- Export and share report output correctly

## 6.5 Settings SOP
Primary users: Admin, Manager

Common settings tasks:
- Outlet and till management
- Printer setup and assignment
- Business info updates
- Notification preferences
- Language preferences

Refresh behavior guidance:
- Refresh: reload current page data
- Sync all: full browser reload and full app state reload

Use Sync all only for:
- Global configuration updates
- Stale state across multiple modules
- Post-maintenance verification

## 7. Teaching Plan (5-Day Example)
### Day 1: Foundation
- Navigation, login, outlets, shifts
- Security and role boundaries
- Basic POS walkthrough

### Day 2: Frontline Operations
- Cashier workflows
- Returns and exception handling
- Shift handover

### Day 3: Inventory and Office
- Purchase, receiving, adjustments
- Quotations and expenses
- Data quality checks

### Day 4: Reporting and Controls
- Core financial and operational reports
- Reconciliation process
- Audit readiness basics

### Day 5: Simulation and Certification
- End-to-end scenario drills
- Error recovery drills
- Competency sign-off

## 8. Scenario Drill Pack
Mandatory drills before go-live:
1. Walk-in sale with receipt print
2. Credit sale with customer assignment
3. Return against existing receipt
4. Purchase receive and stock update
5. Shift close and cashup reconciliation
6. Printer outage fallback process

Scoring model:
- Pass: 90 percent and no critical control breach
- Remedial: 70 to 89 percent
- Retrain: below 70 percent

## 9. Troubleshooting Guide
## 9.1 Login Problems
- Verify username format and password
- Confirm user role is active
- Confirm tenant access is assigned

## 9.2 Outlet or Data Mismatch
- Confirm active outlet selection
- Use Refresh first
- Use Sync all if mismatch persists across modules

## 9.3 Printer Issues
- Confirm assigned outlet and printer
- Confirm connector health status
- Re-run printer discovery if needed
- Use fallback receipt process during outage

## 9.4 Report Discrepancies
- Validate date range and outlet filters
- Compare source transactions
- Check for pending or reversed transactions

## 10. Governance and Compliance
Operational controls:
- Enforce least-privilege access
- Require reasons for voids and adjustments
- Keep audit trail for role changes and approvals
- Review exception logs daily

Recommended review cadence:
- Daily: transaction exceptions
- Weekly: inventory and cash variances
- Monthly: role audit and process compliance

## 11. Go-Live Readiness Checklist
Before production rollout, confirm:
- All users trained by role
- Trainers completed competency sign-off
- Outlet, till, and printer settings validated
- Fallback procedures communicated
- First-week support owner assigned

## 12. Trainer Toolkit Templates
## 12.1 Session Attendance Log
- Date
- Trainer name
- User name
- Role
- Modules covered
- Completion status

## 12.2 Competency Sign-Off Form
- User name and role
- Workflow test list
- Score per workflow
- Critical errors observed
- Final status: Pass, Remedial, Retrain

## 12.3 First-Week Hypercare Tracker
- Incident summary
- Module impacted
- Root cause
- Immediate fix
- Prevention action
- Owner and due date

## 13. Implementation Notes for Your Team
To accelerate adoption:
- Keep module quick reference cards at each counter
- Use short demo videos for repeat tasks
- Schedule daily 15-minute support huddles in week 1
- Track repeated mistakes and retrain by pattern

---
If needed, create role-specific one-page SOP extracts from this guide for Cashier, Supervisor, Inventory, Office, and Manager teams.
