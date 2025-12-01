# PrimePOS - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Environment
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=PrimePOS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 3: Run Development Server
```bash
npm run dev
```

Open **http://localhost:3000** in your browser! 🎉

## 🧭 Quick Navigation Guide

### Test Different Roles
1. Click the **Role Switcher** (top right, shield icon)
2. Switch between: Admin, Manager, Cashier, Staff
3. Notice how the sidebar menu changes!

### Key Pages to Explore

**Public Pages:**
- `/` - Home page
- `/pricing` - Pricing plans
- `/about` - About page
- `/contact` - Contact form

**Authentication:**
- `/auth/login` - Login page
- `/auth/register` - Registration

**Dashboard (after login):**
- `/dashboard` - Main dashboard
- `/dashboard/pos` - POS Terminal
- `/dashboard/products` - Products
- `/dashboard/sales` - Sales
- `/dashboard/customers` - Customers
- `/dashboard/reports` - Reports
- `/dashboard/settings` - Settings

**Industry Modules:**
- `/dashboard/restaurant/tables` - Restaurant tables
- `/dashboard/bar/drinks` - Bar drinks
- `/dashboard/retail/returns` - Retail returns

**Admin (Super Admin):**
- `/admin/tenants` - Tenant management
- `/admin/billing` - Billing
- `/admin/support-tickets` - Support tickets

## 🎯 Testing Features

1. **Notification Bell**: Click the bell icon (top right) to see notifications
2. **Activity Log**: Scroll down in the left sidebar to see recent activities
3. **Breadcrumbs**: Navigate to any page to see breadcrumb navigation
4. **Outlet Switcher**: Switch between outlets in the top bar
5. **Modals**: Click "Add" buttons to see various modals

## 📝 Notes

- All data is currently **mock data** (ready for API integration)
- Role switching is for **testing purposes** (will be from API in production)
- Forms are **UI-ready** but need backend integration
- See `LOCAL_DEVELOPMENT.md` for detailed guide

## 🐛 Troubleshooting

**Port 3000 in use?**
```bash
npm run dev -- -p 3001
```

**Module errors?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Build errors?**
```bash
rm -rf .next
npm run dev
```

## 📚 More Information

- **Full Guide**: See `LOCAL_DEVELOPMENT.md`
- **Project Structure**: See `README.md`
- **API Integration**: See `lib/api.ts`

Happy coding! 🚀

