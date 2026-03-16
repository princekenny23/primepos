// Dashboard Stats Utilities - Generate industry-specific stats
import type { Business } from "../types"
import { saleService } from "../services/saleService"
import { productService } from "../services/productService"
import { customerService } from "../services/customerService"
import { reportService } from "../services/reportService"
import { staffService } from "../services/staffService"
import { requestCache } from "./request-cache"

export interface DashboardKPI {
  sales: { value: number; change: number }
  customers: { value: number; change: number }
  products: { value: number; change: number }
  expenses: { value: number; change: number }
  profit: { value: number; change: number }
  lowStockItems: { value: number; change: number }
  outstandingCredit: { value: number; change: number }
  returns: { value: number; change: number }
}

export interface ChartDataPoint {
  date: string
  sales: number
  profit: number
}

export interface ActivityItem {
  id: string
  type: "sale" | "inventory" | "customer" | "payment" | "alert"
  title: string
  description: string
  timestamp: Date
  amount?: number
}

export interface DashboardDateRange {
  start?: Date
  end?: Date
}

function toDateOnlyString(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split("T")[0]
}

function buildRange(range?: DashboardDateRange): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const end = range?.end ? new Date(range.end) : new Date()
  end.setHours(0, 0, 0, 0)

  const start = range?.start ? new Date(range.start) : new Date(end)
  if (!range?.start) {
    start.setDate(start.getDate() - 6)
  }
  start.setHours(0, 0, 0, 0)

  const diffDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
  const previousEnd = new Date(start)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - (diffDays - 1))

  return { start, end, previousStart, previousEnd }
}

function percentChange(current: number, previous: number): number {
  if (previous > 0) return ((current - previous) / previous) * 100
  return current > 0 ? 100 : 0
}

function extractResults<T = any>(response: any): T[] {
  if (Array.isArray(response)) return response
  return response?.results || []
}

interface DashboardCustomerMetrics {
  totalCustomers: number
  currentPeriodNewCustomers: number
  previousPeriodNewCustomers: number
  outstandingCredit: number
}

interface ProfitLossSnapshot {
  revenue: number
  expenses: number
  netProfit: number
}

function normalizeProfitLossResponse(response: any): ProfitLossSnapshot {
  const revenue = Number(response?.total_revenue || 0)
  const expenses = Number(response?.expenses || response?.total_expenses || 0)

  // Prefer explicit net_profit if backend provides it; otherwise derive it from available fields.
  const netProfit = Number(
    response?.net_profit ??
    response?.profit ??
    ((response?.gross_profit ?? revenue) - expenses)
  )

  return {
    revenue,
    expenses,
    netProfit,
  }
}

async function fetchCustomerMetrics(
  businessId: string,
  outletId: string | undefined,
  startStr: string,
  endStr: string,
  prevStartStr: string,
  prevEndStr: string,
): Promise<DashboardCustomerMetrics> {
  const summary = await requestCache.getOrSet(
    `customer-summary-${businessId}-${outletId || 'all'}-${startStr}-${endStr}-${prevStartStr}-${prevEndStr}`,
    () => customerService.summary({
      outlet: outletId,
      start_date: startStr,
      end_date: endStr,
      previous_start_date: prevStartStr,
      previous_end_date: prevEndStr,
    }).catch(() => ({
      total_customers: 0,
      current_period_new_customers: 0,
      previous_period_new_customers: 0,
      outstanding_credit: 0,
    }))
  )

  return {
    totalCustomers: Number(summary.total_customers || 0),
    currentPeriodNewCustomers: Number(summary.current_period_new_customers || 0),
    previousPeriodNewCustomers: Number(summary.previous_period_new_customers || 0),
    outstandingCredit: Number(summary.outstanding_credit || 0),
  }
}

/**
 * Generate KPI data for business dashboard
 * Calculates trends by comparing with previous period
 */
export async function generateKPIData(
  businessId: string,
  business: Business,
  outletId?: string,
  range?: DashboardDateRange
): Promise<DashboardKPI> {
  try {
    const { start, end, previousStart, previousEnd } = buildRange(range)
    const startStr = toDateOnlyString(start)
    const endStr = toDateOnlyString(end)
    const prevStartStr = toDateOnlyString(previousStart)
    const prevEndStr = toDateOnlyString(previousEnd)
    
    // Fetch all data in parallel with caching
    const [
      currentPnl,
      previousPnl,
      staffList,
      customerMetrics,
    ] = await Promise.all([
      requestCache.getOrSet(`pnl-${businessId}-${outletId || 'all'}-${startStr}-${endStr}`, () => 
        reportService.getProfitLoss({ outlet: outletId, start_date: startStr, end_date: endStr }).catch((err) => {
          console.error('Failed to fetch current profit/loss:', err)
          return null
        })
      ),
      requestCache.getOrSet(`pnl-${businessId}-${outletId || 'all'}-${prevStartStr}-${prevEndStr}`, () =>
        reportService.getProfitLoss({ outlet: outletId, start_date: prevStartStr, end_date: prevEndStr }).catch((err) => {
          console.error('Failed to fetch previous profit/loss:', err)
          return null
        })
      ),
      requestCache.getOrSet(`staff-active-${businessId}-${outletId || 'all'}`, () =>
        staffService.list({ is_active: true }).then(res => res.results || []).catch(() => [])
      ),
      fetchCustomerMetrics(businessId, outletId, startStr, endStr, prevStartStr, prevEndStr),
    ])

    const currentProfitLoss = normalizeProfitLossResponse(currentPnl)
    const previousProfitLoss = normalizeProfitLossResponse(previousPnl)
    
    const currentRevenue = currentProfitLoss.revenue
    const previousRevenue = previousProfitLoss.revenue
    const salesChange = percentChange(currentRevenue, previousRevenue)
    
    // Calculate customer metrics
    const customersCount = customerMetrics.totalCustomers
    const customersChange = percentChange(
      customerMetrics.currentPeriodNewCustomers,
      customerMetrics.previousPeriodNewCustomers
    )
    
    // Calculate expense metrics
    const currentExpenses = currentProfitLoss.expenses
    const previousExpenses = previousProfitLoss.expenses
    const expensesChange = percentChange(currentExpenses, previousExpenses)
    
    // Profit KPI is aligned with Profit & Loss report logic.
    const currentProfit = currentProfitLoss.netProfit
    const previousProfit = previousProfitLoss.netProfit
    const profitChange = percentChange(currentProfit, previousProfit)
    
    // Calculate outstanding credit
    const totalOutstandingCredit = customerMetrics.outstandingCredit
    
    // Calculate outstanding credit change
    // Since we don't have historical credit balance data, we'll show change as 0
    // To properly track this, backend would need to store daily/monthly credit snapshots
    // For now, the card shows the TOTAL outstanding credit amount only
    const outstandingCreditChange = 0
    
    // Calculate employees metrics
    // Filter staff by outlet if outletId is provided (staff can work at multiple outlets)
    const staffArray = Array.isArray(staffList) ? staffList : (staffList?.results || [])
    const filteredStaff = outletId 
      ? staffArray.filter((s: any) => 
          s.outlets && Array.isArray(s.outlets) && 
          s.outlets.some((o: any) => String(o.id) === String(outletId))
        )
      : staffArray
    
    const employeesCount = filteredStaff.length
    
    // Calculate employee change - compare active employees this month vs last month
    const thisRangeNewStaff = filteredStaff.filter((s: any) => {
      if (!s.created_at) return false
      const createdDate = new Date(s.created_at)
      return createdDate >= start && createdDate <= end
    }).length
    
    const previousRangeNewStaff = filteredStaff.filter((s: any) => {
      if (!s.created_at) return false
      const createdDate = new Date(s.created_at)
      return createdDate >= previousStart && createdDate <= previousEnd
    }).length
    
    const employeesChange = percentChange(thisRangeNewStaff, previousRangeNewStaff)
    
    return {
      sales: { value: currentRevenue, change: salesChange },
      customers: { value: customersCount, change: customersChange },
      products: { value: employeesCount, change: employeesChange },
      expenses: { value: currentExpenses, change: expensesChange },
      profit: { value: currentProfit, change: profitChange },
      lowStockItems: { value: 0, change: 0 },
      outstandingCredit: { value: totalOutstandingCredit, change: outstandingCreditChange },
      returns: { value: 0, change: 0 },
    }
  } catch (error) {
    console.error("Failed to load KPI data from API:", error)
    // Return empty/default data
    return {
      sales: { value: 0, change: 0 },
      customers: { value: 0, change: 0 },
      products: { value: 0, change: 0 },
      expenses: { value: 0, change: 0 },
      profit: { value: 0, change: 0 },
      lowStockItems: { value: 0, change: 0 },
      outstandingCredit: { value: 0, change: 0 },
      returns: { value: 0, change: 0 },
    }
  }
}

/**
 * Generate chart data for last 7 days - optimized single API call
 */
export async function generateChartData(
  businessId: string,
  outletId?: string,
  range?: DashboardDateRange
): Promise<ChartDataPoint[]> {
  try {
    const { start, end } = buildRange(range)
    const startStr = toDateOnlyString(start)
    const endStr = toDateOnlyString(end)

    // Use cache for chart data
    const cacheKey = `chart-${businessId}-${outletId || 'all'}-${startStr}-${endStr}-completed`
    const chartData = await requestCache.getOrSet(cacheKey, () => saleService.getChartData(outletId, "completed", startStr, endStr))
    return chartData.map((item: any) => ({
      date: item.date,
      sales: item.sales,
      profit: item.profit,
    }))
  } catch (error) {
    console.error("Failed to load chart data from API:", error)
    // Return empty array
    return []
  }
}

/**
 * Generate recent activity from sales and other events
 */
export async function generateActivityData(
  businessId: string,
  outletId?: string
): Promise<ActivityItem[]> {
  try {
    const activities: ActivityItem[] = []
    
    // Get recent sales with caching and limit
    const cacheKey = `activity-sales-${outletId}`
    const salesResponse = await requestCache.getOrSet(cacheKey, () =>
      saleService.list({
        outlet: outletId,
        status: "completed",
        page: 1,
      })
    )
    
    const sales = Array.isArray(salesResponse) ? salesResponse : (salesResponse.results || [])
    
    // Add recent sales as activities (limit to 10)
    sales.slice(0, 10).forEach((sale: any) => {
      activities.push({
        id: `activity_${sale.id}`,
        type: "sale",
        title: "New Sale Completed",
        description: `Sale #${sale.receipt_number || sale.id.slice(-6)} - ${sale.items?.length || 0} items`,
        timestamp: new Date(sale.created_at || sale.createdAt),
        amount: sale.total,
      })
    })
    
    // Get low stock products (reuse from KPI data if possible)
    try {
      const lowStockCacheKey = `low-stock-${outletId}`
      const lowStockProducts = await requestCache.getOrSet(lowStockCacheKey, () =>
        productService.getLowStock(outletId)
      )
      lowStockProducts.slice(0, 3).forEach((product: any) => {
        activities.push({
          id: `alert_${product.id}`,
          type: "alert",
          title: "Low Stock Alert",
          description: `${product.name} is running low (${product.stock || 0} remaining)`,
          timestamp: new Date(),
        })
      })
    } catch (error) {
      console.error("Failed to load low stock products:", error)
    }
    
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)
  } catch (error) {
    console.error("Failed to load activity data from API:", error)
    return []
  }
}

/**
 * Generate top selling items - optimized backend query
 */
export async function generateTopSellingItems(
  businessId: string,
  outletId?: string
) {
  try {
    // Use cache for top selling items
    const cacheKey = `top-selling-${businessId}-${outletId || 'all'}`
    return await requestCache.getOrSet(cacheKey, () =>
      saleService.getTopSellingItems({ outlet: outletId })
    )
  } catch (error) {
    console.error("Failed to load top selling items from API:", error)
    return []
  }
}




