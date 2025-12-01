# Start Day Shift Module - Design Document

## Overview
The Start Day Shift module is a critical component that must be completed before any sales can be processed. It ensures proper cash management, till assignment, and shift tracking for cashiers and managers.

## User Flow

### Entry Points
1. **Direct Navigation**: User navigates to `/dashboard/pos/start-shift`
2. **Automatic Redirect**: When accessing `/dashboard/pos` without an active shift, redirect to start shift page
3. **Register Closed State**: POS page shows "REGISTER CLOSED" with a button to "START SELLING" → redirects to start shift

### Flow Diagram
```
User accesses POS → Check if active shift exists
    ↓
No active shift → Show Start Day Shift page
    ↓
User fills form → Validation → Submit
    ↓
Shift created → Redirect to POS with active shift
    ↓
POS now accessible for sales
```

## Page Layout & Design

### Visual Structure
```
┌─────────────────────────────────────────────────────────┐
│  [Header with Tenant/Outlet Info]                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              ┌─────────────────────┐                    │
│              │   [Cash Register    │                    │
│              │      Icon]          │                    │
│              └─────────────────────┘                    │
│                                                         │
│              REGISTER CLOSED                            │
│                                                         │
│              Please start your day shift to begin       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Start Day Shift                                 │  │
│  ├─────────────────────────────────────────────────┤  │
│  │                                                  │  │
│  │  Outlet *                                        │  │
│  │  [Dropdown: Select Outlet ▼]                    │  │
│  │                                                  │  │
│  │  Operating Date *                                │  │
│  │  [Date Picker: Today's Date]                    │  │
│  │                                                  │  │
│  │  Till *                                          │  │
│  │  [Dropdown: Select Till ▼]                      │  │
│  │                                                  │  │
│  │  Opening Cash Balance *                          │  │
│  │  [Input: 0.00]                                   │  │
│  │  (Amount of cash in drawer at start)            │  │
│  │                                                  │  │
│  │  Floating Cash (Optional)                        │  │
│  │  [Input: 0.00]                                   │  │
│  │  (Additional cash for change)                    │  │
│  │                                                  │  │
│  │  Notes (Optional)                                 │  │
│  │  [Textarea: Enter any notes...]                 │  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐   │  │
│  │  │  [🛒 START SELLING]                      │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  │                                                  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Form Fields & Validation

### Required Fields (*)

1. **Outlet Selection**
   - Type: Dropdown/Select
   - Source: Current user's accessible outlets (from tenant context)
   - Default: Current outlet if available
   - Validation: Must select an outlet
   - Display: Outlet name + address (if available)

2. **Operating Date**
   - Type: Date Picker
   - Default: Today's date
   - Validation: 
     - Cannot be in the future
     - Cannot be more than X days in the past (configurable, default: 7 days)
     - Check if shift already exists for this date + outlet + till combination
   - Format: DD/MM/YYYY or MM/DD/YYYY (based on locale)

3. **Till Selection**
   - Type: Dropdown/Select
   - Source: Available tills for selected outlet
   - Validation: 
     - Must select a till
     - Check if till is already in use (another shift active)
   - Display: Till name/number + status

4. **Opening Cash Balance**
   - Type: Number input (currency formatted)
   - Default: 0.00
   - Validation:
     - Must be >= 0
     - Cannot be negative
     - Decimal precision: 2
   - Format: Currency format (e.g., $1,234.56)
   - Helper text: "Amount of cash in drawer at start of shift"

### Optional Fields

5. **Floating Cash**
   - Type: Number input (currency formatted)
   - Default: 0.00
   - Validation:
     - Must be >= 0 if provided
     - Decimal precision: 2
   - Format: Currency format
   - Helper text: "Additional cash available for making change"

6. **Notes**
   - Type: Textarea
   - Max length: 500 characters
   - Placeholder: "Enter any notes about this shift (optional)"
   - Use cases: Special instructions, issues, etc.

## Business Logic & Rules

### Shift Validation Rules
1. **One Active Shift Per Till**: A till can only have one active shift at a time
2. **Date Validation**: Cannot start a shift for a future date
3. **Outlet Access**: User must have access to selected outlet
4. **Till Availability**: Till must be available (not in use by another user)
5. **Previous Shift Check**: If previous shift exists for same till, ensure it's closed

### Shift Creation
When shift is successfully created:
- Create shift record with:
  - Shift ID (unique)
  - Outlet ID
  - Till ID
  - User ID (current user)
  - Operating Date
  - Opening Cash Balance
  - Floating Cash
  - Notes
  - Status: "OPEN"
  - Start Time: Current timestamp
  - End Time: null (until shift is closed)

### State Management
- Store active shift in:
  - Local storage (for persistence)
  - Context/State (for app-wide access)
  - Session storage (optional, for security)

### Redirect After Success
- After successful shift creation:
  - Store shift data in context/localStorage
  - Redirect to `/dashboard/pos`
  - POS page checks for active shift and allows sales

## UI/UX Considerations

### Visual Design
- **Color Scheme**: 
  - Primary button: Teal/Dark blue (matching POS theme)
  - Background: White/Light grey
  - Icons: Muted colors
- **Typography**: 
  - Heading: Large, bold
  - Labels: Medium weight
  - Helper text: Small, muted
- **Spacing**: Generous padding, clear visual hierarchy

### User Experience
1. **Auto-fill**: Pre-fill outlet and date when possible
2. **Keyboard Navigation**: Tab through fields, Enter to submit
3. **Error Messages**: Clear, inline validation messages
4. **Loading States**: Show loading spinner on submit
5. **Success Feedback**: Brief success message before redirect
6. **Accessibility**: Proper labels, ARIA attributes, keyboard support

### Responsive Design
- Desktop: Centered form, max-width container
- Tablet: Similar to desktop
- Mobile: Full-width form, stacked layout

## Error Handling

### Validation Errors
- Display inline below each field
- Red border on invalid fields
- Summary at top if form has errors

### Business Logic Errors
1. **Till Already in Use**: 
   - Message: "This till is currently in use by [User Name]. Please select another till or wait for the current shift to close."
   - Action: Disable till in dropdown or show warning

2. **Shift Already Exists**:
   - Message: "A shift already exists for this outlet, date, and till combination."
   - Action: Offer to view existing shift or select different date/till

3. **No Outlet Access**:
   - Message: "You don't have access to this outlet."
   - Action: Redirect to outlet selection or show only accessible outlets

4. **Network Errors**:
   - Message: "Unable to start shift. Please check your connection and try again."
   - Action: Retry button

## Integration Points

### With Existing Components
1. **Tenant Context**: Get available outlets
2. **Role Context**: Check permissions (cashier/manager)
3. **POS Page**: Check for active shift before allowing sales
4. **Dashboard Layout**: Show shift status in header (optional)

### API Endpoints (Future)
- `POST /api/shifts/start` - Create new shift
- `GET /api/shifts/active` - Get active shift for user
- `GET /api/outlets/:id/tills` - Get available tills for outlet
- `GET /api/shifts/check` - Check if shift exists for date/outlet/till

## Security Considerations

1. **Authorization**: Only cashiers/managers can start shifts
2. **Audit Trail**: Log all shift start/end actions
3. **Data Validation**: Server-side validation required
4. **Session Management**: Secure shift data storage

## Future Enhancements

1. **Shift Templates**: Save common opening cash amounts
2. **Quick Start**: One-click start with default values
3. **Shift History**: View previous shifts before starting
4. **Multi-till Support**: Start multiple shifts simultaneously (manager)
5. **Cash Count Verification**: Photo/verification of opening cash
6. **Shift Transfer**: Transfer shift between users
7. **Notifications**: Alert when shift is about to expire

## File Structure

```
app/dashboard/pos/
├── start-shift/
│   └── page.tsx              # Start Day Shift page
├── page.tsx                   # POS page (check for active shift)
└── components/
    └── start-shift-form.tsx   # Reusable form component

components/modals/
└── start-shift-modal.tsx      # Optional: Modal version

contexts/
└── shift-context.tsx          # Shift state management
```

## Technical Implementation Notes

### State Management
- Use React Context for shift state
- Persist to localStorage for page refresh
- Clear on logout

### Form Handling
- Use React Hook Form (if available) or controlled components
- Real-time validation
- Debounced API calls for till availability

### Date Handling
- Use date-fns (already in dependencies)
- Format based on user locale
- Handle timezone properly

### Currency Formatting
- Format inputs as user types
- Use Intl.NumberFormat for display
- Store as decimal numbers in backend

---

## Approval Checklist

- [ ] Design matches professional POS requirements
- [ ] All required fields identified
- [ ] Validation rules defined
- [ ] Error handling scenarios covered
- [ ] Integration points identified
- [ ] Security considerations addressed
- [ ] User experience optimized
- [ ] Responsive design planned

---

**Ready for Implementation**: Once approved, we'll proceed with coding the Start Day Shift module.

