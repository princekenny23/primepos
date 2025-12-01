# PrimePOS - Local Development Guide

This guide will help you run and test the PrimePOS frontend application locally on your computer.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** or **pnpm** (comes with Node.js)
- **Git** (optional, for version control)

## Step 1: Install Dependencies

Open your terminal/command prompt in the project directory and run:

```bash
npm install
```

or if you're using yarn:

```bash
yarn install
```

or if you're using pnpm:

```bash
pnpm install
```

This will install all the required packages listed in `package.json`.

## Step 2: Set Up Environment Variables

1. Copy the example environment file:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env.local

# Windows (CMD)
copy .env.example .env.local

# Mac/Linux
cp .env.example .env.local
```

2. Open `.env.local` and update the values if needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=PrimePOS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note**: For now, these are placeholders. When you connect your backend API, update `NEXT_PUBLIC_API_URL` to point to your backend server.

## Step 3: Run the Development Server

Start the development server:

```bash
npm run dev
```

or

```bash
yarn dev
```

or

```bash
pnpm dev
```

You should see output like:

```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
- Ready in 2.3s
```

## Step 4: Open in Browser

Open your web browser and navigate to:

**http://localhost:3000**

You should see the PrimePOS home page!

## Navigation Guide

### Public Pages

1. **Home Page** (`/`)
   - Overview of PrimePOS features
   - Call-to-action buttons
   - Feature highlights

2. **Pricing Page** (`/pricing`)
   - View subscription plans (Starter, Professional, Enterprise)
   - Compare features

3. **About Page** (`/about`)
   - Company story and mission
   - Technology stack information

4. **Contact Page** (`/contact`)
   - Contact form
   - Business information

### Authentication Pages

1. **Login** (`/auth/login`)
   - Email and password fields
   - "Forgot Password" link
   - Redirects to dashboard after login (currently mock)

2. **Register** (`/auth/register`)
   - Registration form
   - Terms & Conditions modal
   - Redirects to onboarding after registration

3. **Forgot Password** (`/auth/forgot-password`)
   - Password recovery form

4. **Reset Password** (`/auth/reset-password`)
   - New password setup

5. **Verify Email** (`/auth/verify-email`)
   - Email verification page

### Onboarding Flow

1. **Setup Business** (`/onboarding/setup-business`)
   - Business information form
   - Logo upload
   - Business details

2. **Setup Outlet** (`/onboarding/setup-outlet`)
   - First outlet creation
   - Location and details

3. **Add First User** (`/onboarding/add-first-user`)
   - Create first staff member
   - Assign role

### Dashboard (Main Application)

**Access**: After "logging in" (click "Get Started" or go to `/auth/login`), you'll be redirected to `/dashboard`

#### Key Features to Test:

1. **Role Switcher** (Top Right)
   - Click the role dropdown to switch between:
     - **Admin**: Sees all menu items
     - **Manager**: Most features (no Staff/Settings)
     - **Cashier**: Only Sales, POS, Customers, Reports
     - **Staff**: Sales, POS, Products, Inventory
   - Notice how the sidebar navigation changes!

2. **Notification Bell** (Top Right)
   - Click the bell icon to see recent notifications
   - Shows unread count badge
   - Links to full notifications page

3. **Activity Log Sidebar**
   - Scroll down in the left sidebar
   - See recent activities (New Sale, Stock Alerts, etc.)
   - Click "View Full Activity Log" for complete history

4. **Breadcrumb Navigation**
   - Navigate to any page (e.g., `/dashboard/products`)
   - See breadcrumbs at the top showing your location
   - Click breadcrumb items to navigate back

5. **Outlet Selector** (Top Bar)
   - Switch between different outlets
   - Data updates based on selected outlet

#### Main Modules to Explore:

**Dashboard** (`/dashboard`)
- KPI cards (Sales, Customers, Products, Expenses, Profit)
- Sales chart
- Recent activity feed
- Low stock alerts
- Top selling items

**Sales** (`/dashboard/sales`)
- Sales list with filters
- View sale details modal
- Quick add sale modal

**POS Terminal** (`/dashboard/pos`)
- Product grid
- Cart panel
- Payment section
- Receipt preview
- Multiple payment methods

**Products** (`/dashboard/products`)
- Product catalog
- Search and filters
- Add/Edit product modal
- Product detail pages with tabs

**Inventory** (`/dashboard/inventory`)
- Stock adjustments
- Stock transfers
- Receiving
- Low stock alerts

**Customers (CRM)** (`/dashboard/customers`)
- Customer list
- Search and filters
- Customer detail pages
- Loyalty points management

**Reports** (`/dashboard/reports`)
- Sales reports
- Product reports
- Customer reports
- Expenses reports
- Profit & Loss
- Stock movement

**Settings** (`/dashboard/settings`)
- Business Info
- Outlet Management
- Tax & Pricing
- Payment Methods
- Receipt Template
- Subscription & Billing
- Integrations
- Notifications

#### Industry-Specific Modules:

**Retail Store** (`/dashboard/retail`)
- Returns
- Discounts
- Loyalty program

**Restaurant** (`/dashboard/restaurant`)
- Tables (grid/list view)
- Orders
- Kitchen (KOT screen)
- Menu
- Recipes

**Bar** (`/dashboard/bar`)
- Drinks inventory
- Tabs management
- Expenses

**System Admin** (`/admin`)
- Tenants management
- Billing
- Support tickets
- Analytics
- Plans
- Users

## Testing Different User Roles

1. **Admin Role**:
   - Switch to "Admin" in the role switcher
   - You should see all menu items in the sidebar
   - Full access to all features

2. **Cashier Role**:
   - Switch to "Cashier"
   - Sidebar should only show: Dashboard, Sales, POS, CRM, Reports, Notifications
   - Limited access as designed

3. **Staff Role**:
   - Switch to "Staff"
   - Sidebar shows: Dashboard, Sales, POS, Products, Inventory, Notifications
   - No access to Settings or Staff management

## Common Issues & Solutions

### Port Already in Use

If port 3000 is already in use:

```bash
# Kill the process using port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- -p 3001
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Check TypeScript configuration
npx tsc --noEmit
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

## Development Tips

1. **Hot Reload**: The app automatically reloads when you save files
2. **Console Logs**: Open browser DevTools (F12) to see console logs
3. **Network Tab**: Check Network tab to see API calls (when backend is connected)
4. **React DevTools**: Install React DevTools browser extension for debugging

## Next Steps

1. **Connect Backend API**:
   - Update `.env.local` with your backend URL
   - API helper functions are ready in `lib/api.ts`
   - Replace mock data with actual API calls

2. **Add Authentication**:
   - Integrate NextAuth.js or your auth solution
   - Update role context to fetch from API
   - Add protected routes

3. **Deploy to Vercel**:
   - See deployment instructions below

## Building for Production

To build the application:

```bash
npm run build
```

To start the production server locally:

```bash
npm start
```

## Deployment to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository

3. **Configure Environment Variables**:
   - In Vercel project settings, add environment variables:
     - `NEXT_PUBLIC_API_URL` (your production API URL)
     - `NEXT_PUBLIC_APP_URL` (your Vercel deployment URL)
     - Any other required variables

4. **Deploy**:
   - Vercel will automatically deploy
   - Your app will be live at `your-project.vercel.app`

## Need Help?

- Check the main `README.md` for project structure
- Review component documentation
- Check Next.js documentation: https://nextjs.org/docs

Happy coding! 🚀

