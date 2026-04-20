# PrimePOS MVP Launch - Known Limitations & Phase 2 Roadmap

**Version**: 1.0  
**Launch Date**: April 28, 2026  
**Prepared For**: Client/Stakeholders  

---

## ✅ WHAT'S INCLUDED IN MVP (LAUNCH WEEK)

### **Point of Sale System**
✅ **Retail POS** - Fast checkout for product sales (multiple items, quantity, customer selection)  
✅ **Restaurant POS** - Table management, item modification, kitchen display  
✅ **Bar POS** - Call tracking, drink management, table support  
✅ **Payment** - Cash payments only (card/mobile money in Phase 2)  
✅ **Receipts** - Print to thermal printer or PDF  
✅ **Returns** - Process full/partial returns with instant refunds  
✅ **Refunds** - Issue refunds for completed transactions  

### **Inventory Management**
✅ Multi-location stock tracking (per outlet)  
✅ Real-time stock visibility during POS operations  
✅ Stock adjustments (receive, count, transfer between outlets)  
✅ Low-stock alerts  
✅ Product expiry tracking  
✅ Inventory valuation reports  

### **Business Operations**
✅ Shift management (open/close/reconcile)  
✅ Staff role management (admin, manager, cashier)  
✅ Customer profiles & credit tracking  
✅ Multi-outlet support (manage multiple locations from one account)  
✅ Activity logging (track all user actions)  

### **Reporting & Analytics**
✅ Sales dashboard (7-day default view)  
✅ KPI cards (sales, expenses, profit, customers)  
✅ Sales by product/category  
✅ Stock valuation  
✅ Profit & loss report  
✅ Report export (PDF/Excel)  

### **Security & Data**
✅ Multi-tenant isolation (your data never visible to other businesses)  
✅ Role-based access control (permissions per user)  
✅ Encrypted passwords & API tokens  
✅ Activity audit trail (see who did what & when)  

---

## ❌ KNOWN LIMITATIONS (Not in MVP)

### **Payments**
❌ **Card Payments** (Visa, Mastercard, Amex)  
- Timeline: Phase 2 (Week 2-3 post-launch, ~40 hrs dev)  
- Impact: Customers can only pay with cash now  
- Workaround: Accept cash only, add card processing in next update  

❌ **Mobile Money** (M-Pesa, Airtel Money)  
- Timeline: Phase 2 (~40 hrs dev)  
- Impact: Customers cannot pay via mobile money yet  
- Workaround: Cash only for MVP  

### **Pricing & Taxation**
❌ **Tax Calculations**  
- Timeline: Phase 2 (~30 hrs dev)  
- Current: Tax rate is 0% (no tax added to sales)  
- Future: Configurable tax per outlet, auto-calculated, tax reports  
- Note: Receipt will not show tax line items  

❌ **Discount Rules Engine**  
- Timeline: Phase 2 (~25 hrs dev)  
- Current: Manual discount entry only (% or fixed amount)  
- Future: Bulk discounts, loyalty discounts, time-based promos  

### **Supply Chain**
❌ **Distribution Module**  
- Timeline: Phase 3 (Month 2 post-launch, 80 hrs dev)  
- Features not available: Route planning, delivery orders, POD, payment collection  
- Workaround: Manual management outside PrimePOS for now  

❌ **Supplier Management & Purchase Orders**  
- Timeline: Phase 3 (~60 hrs dev)  
- Impact: Cannot create purchase orders in PrimePOS yet  
- Workaround: Use external ordering system, manually update inventory in PrimePOS  

### **Storefront & E-Commerce**
❌ **Customer Storefront**  
- Timeline: Phase 3 (120 hrs dev)  
- Impact: Customers cannot order online yet  
- Workaround: Manual order entry in POS  

❌ **Delivery Tracking**  
- Timeline: Phase 3 (~80 hrs dev)  
- Impact: Cannot track customer deliveries yet  

### **Advanced Features**
❌ **Loyalty Program** (points, tiers, rewards)  
- Timeline: Phase 3 (~40 hrs dev)  
- Workaround: Manual customer tracking for now  

❌ **Accounting Module** (chart of accounts, double-entry, trial balance)  
- Timeline: Phase 3 (100 hrs dev)  
- Workaround: Export reports to Excel for external accounting  

❌ **Barcode Scanning**  
- Timeline: Phase 2 (~25 hrs dev)  
- Current: Manual product entry only  
- Future: Hardware scanner integration  

❌ **Multi-Language Support**  
- Timeline: Phase 3 (~30 hrs dev)  
- Current: English only  
- Future: French, Swahili, Portuguese  

❌ **Email Notifications**  
- Timeline: Phase 2 (~30 hrs dev)  
- Current: In-app notifications only  
- Future: Email receipts, password reset emails, alerts  

❌ **Two-Factor Authentication (2FA)**  
- Timeline: Phase 3 (~20 hrs dev)  
- Current: Single password login  
- Future: SMS/authenticator app 2FA  

---

## 📊 PHASE 2 ROADMAP (Weeks 2-4 Post-Launch)

| Phase 2 Feature | Dev Time | Priority | Estimated Delivery |
|---|---|---|---|
| Card Payment Integration (Stripe) | 20 hrs | 🔴 P0 | Week 2 |
| Mobile Money (M-Pesa) | 20 hrs | 🔴 P0 | Week 2 |
| Tax Calculation Engine | 30 hrs | 🔴 P0 | Week 2 |
| Advanced Discount Rules | 25 hrs | 🟠 P1 | Week 3 |
| Email Notifications | 30 hrs | 🟠 P1 | Week 3 |
| Barcode Scanner Integration | 25 hrs | 🟠 P1 | Week 3 |
| Celery Async Tasks (reports, imports) | 45 hrs | 🟠 P1 | Week 4 |
| **Total Phase 2** | **~195 hrs** | — | **4 weeks** |

---

## 📊 PHASE 3 ROADMAP (Month 2+)

| Phase 3 Feature | Dev Time | Priority | Estimated Delivery |
|---|---|---|---|
| Distribution Module | 80 hrs | 🟠 P1 | Week 5-6 |
| Supplier Management & Purchase Orders | 60 hrs | 🟠 P1 | Week 5-6 |
| Customer Storefront | 120 hrs | 🟡 P2 | Week 7-9 |
| Loyalty Program | 40 hrs | 🟡 P2 | Week 7 |
| Accounting Module | 100 hrs | 🟡 P2 | Week 8-10 |
| Multi-Language (FR, SW, PT) | 30 hrs | 🟡 P2 | Week 6 |
| **Total Phase 3** | **~430 hrs** | — | **6-8 weeks** |

---

## 🎯 MVP FEATURES OVERVIEW

### **Typical Daily Workflow**

**Morning - Manager opens outlet:**
1. Login to PrimePOS
2. Open today's shift (confirms outlet & user)
3. View dashboard: sales trends, stock alerts, daily revenue

**During Day - Cashier processes sales:**
1. Click "Retail POS" (or Restaurant/Bar)
2. Search/select products
3. Set quantity, add customer
4. Review subtotal, apply discount if needed
5. Select payment method (Cash only in MVP)
6. Print receipt
7. Repeat for next customer

**Mid-Day - Manager checks status:**
1. View real-time dashboard KPIs
2. Check inventory low-stock alerts
3. Review active sales/transactions

**End of Day - Shift reconciliation:**
1. Cashier closes shift (marks end time)
2. Manager receives "cashup report" (total transactions, cash counted)
3. System shows discrepancies if any
4. Manager approves/archives shift

**Next Day - Manager reviews reports:**
1. Daily sales report (by product, by staff)
2. Profit & loss report
3. Inventory valuation
4. Export to Excel for accounting/bank reconciliation

---

## 🔧 TECHNICAL SPECIFICATIONS

### **System Requirements**
- **Browser**: Chrome, Firefox, Safari, Edge (latest versions)
- **Device**: Desktop, Laptop, Tablet (iOS & Android compatible)
- **Internet**: Requires stable connection for online mode
- **Printer**: Thermal receipt printer (80mm, QZ-Tray compatible)

### **Performance**
- Dashboard loads in <3 seconds
- Receipt prints in <5 seconds
- Supports 5-10 concurrent cashiers per outlet
- Up to 1000 products per outlet
- Up to 10,000 transactions per month (unlimited with Phase 2 async)

### **Data**
- Automatic daily backups (Render managed)
- 30-day transaction history visible
- Data never shared between businesses (multi-tenant isolation)
- GDPR-compliant data deletion (on request)

---

## 📞 SUPPORT & ONBOARDING

### **Launch Week Support**
- **Email**: support@primepos.com
- **Response Time**: 24 hrs for non-critical issues
- **Support Hours**: 9 AM - 5 PM EAT (Monday-Friday)
- **Escalation**: Critical issues → on-call engineer

### **Onboarding**
- Included: System walkthrough (1 hr)
- Included: Staff training (product selection, checkout, reports)
- Included: Administrator training (shift management, user roles)
- Optional: Video tutorials (available on support portal)

### **Documentation**
- User guide: Step-by-step POS operation
- Administrator guide: User roles, outlets, settings
- FAQ: Common issues & troubleshooting
- Quick reference: Keyboard shortcuts, tips

---

## ⚠️ KNOWN QUIRKS & WORKAROUNDS

### **Dashboard**
- Default date range: Last 7 days (not today only)
- KPI "Change %" shows week-over-week trend
- Filters applied: Current outlet only (multi-outlet view coming Phase 3)

### **Inventory**
- Stock movements show time-delayed updates (queued for sync)
- Low-stock alerts trigger at configurable threshold
- Bulk adjustments must be done per outlet (no system-wide mass updates)

### **Reports**
- Cannot filter by date range yet (defaults to 7 days) - coming Phase 2
- Export max: 10,000 rows (use filters to narrow down)
- PDF export uses standard template (custom templates Phase 3)

### **Offline Mode**
- Foundation ready (Phase 0-1 implemented)
- NOT YET ENABLED for production (unstable sync in Phase 2)
- When enabled: Sales queued locally, synced when online
- Recommendation: Keep app online for MVP phase

---

## 💰 PRICING & LICENSING

### **MVP Launch Pricing** (Example - to be customized)
- **Starter**: 1 Outlet, 5 Users → $49/month
- **Growth**: 3 Outlets, 20 Users → $149/month
- **Enterprise**: Unlimited Outlets → Custom quote

### **What's Included**
- POS system (all 3 modes: retail, restaurant, bar)
- Inventory tracking
- Staff management
- Reports & analytics
- Multi-tenant isolation
- Email support
- Daily backups

### **What's NOT Included** (Extra cost Phase 2)
- Advanced payment processing (Stripe/M-Pesa fees apply)
- Email notifications (SendGrid fees ~$10/10k emails)
- Premium analytics (real-time dashboards)
- Custom branding (white-label)

---

## 🚀 HOW TO GET READY FOR LAUNCH

### **Before Launch (Client's Checklist)**
- [ ] Confirm business name, outlet locations
- [ ] Setup staff accounts & assign roles
- [ ] Import product catalog (CSV import coming Phase 2)
- [ ] Configure outlet-specific settings (business type, timezone)
- [ ] Test POS with 5-10 sample transactions
- [ ] Assign manager to handle shift approvals
- [ ] Provide thermal printer details for receipt setup

### **First Week (Training)**
- [ ] Cashier training (1 person → all cashiers)
- [ ] Manager training (1 person → all managers)
- [ ] Admin training (owner/IT manager)
- [ ] Test return/refund flows
- [ ] Verify shift reconciliation process

### **First Month**
- [ ] Daily standups to catch bugs early
- [ ] Weekly training sessions (new staff)
- [ ] Feedback collection from cashiers/managers
- [ ] Feature requests for Phase 2 prioritization
- [ ] Integration with accounting (manual export to Excel)

---

## ❓ FAQ - LAUNCH QUESTIONS

**Q: Can I add card payments this week?**  
A: No, card payments will launch in Week 2. Focus on cash only for MVP.

**Q: Do I need to pay tax on sales?**  
A: No, tax is set to 0% for MVP. Tax calculation engine comes in Phase 2.

**Q: Can I use my mobile money (M-Pesa) now?**  
A: No, mobile money integration is Phase 2 (Weeks 2-3 post-launch).

**Q: What if the system goes down?**  
A: Render provides 99.9% uptime SLA. If it does go down, we have 1-hr response time.

**Q: Can I export my data?**  
A: Yes, all reports can export to Excel. Full data dump available on request.

**Q: What happens to my data if I cancel?**  
A: You have 30 days to export. After that, we delete all data (GDPR compliant).

**Q: Do you support offline mode?**  
A: Offline foundation is ready (Phase 0-1). Full offline sync launching in Phase 2.

**Q: Can I integrate with my accountant's software?**  
A: Manual export to Excel for now. Direct integrations (QuickBooks, Xero) in Phase 3.

**Q: How many users can I add?**  
A: Depends on plan. Starter: 5 users, Growth: 20 users, Enterprise: unlimited.

**Q: Is PrimePOS mobile-friendly?**  
A: Yes, optimized for tablet POS use. Phone browser also works but sub-optimal screen size.

---

## 🎉 LAUNCH CELEBRATION CHECKLIST

**48 Hours Before Launch**
- [ ] All staff trained
- [ ] Sample transactions tested
- [ ] Printer configured & tested
- [ ] Support contact established
- [ ] Known Limitations document acknowledged

**Launch Day**
- [ ] Staff ready (1 manager on-site)
- [ ] Live support team standing by
- [ ] Monitor dashboard for errors
- [ ] Celebrate! 🎉

**Week 1 Post-Launch**
- [ ] Daily check-ins with client
- [ ] Bug fixes pushed immediately
- [ ] Feedback collected for Phase 2
- [ ] Team continues Phase 2 development

---

**Questions?** Contact support@primepos.com or reach out to your assigned account manager.

**Thank you for launching PrimePOS MVP with us! 🚀**
