// Dashboard Stats Utilities - Generate industry-specific stats
import type { Business } from "../types"
import { saleService } from "../services/saleService"
import { productService } from "../services/productService"
import { customerService } from "../services/customerService"
import { expenseService } from "../services/expenseService"
import { returnService } from "../services/returnService"
import { staffService } from "../services/staffService"
import { requestCache } from "./request-cache"

export interface DashboardKPI {
  sales: { value: number; change: number }
  customers: { value: number; change: number }
  products: { value: number; change: number }
  expenses: { value: number; change: number }
  profit: { value: number; change: number }
  transactions: { value: number; change: number }
  avgOrderValue: { value: number; change: number }
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

async function fetchAllCustomers(outletId?: string): Promise<any[]> {
  const allCustomers: any[] = []
  let page = 1
  const maxPages = 100

  while (page <= maxPages) {
    const response: any = await customerService.list({ outlet: outletId, page })
    const pageItems = extractResults(response)
    allCustomers.push(...pageItems)

    if (Array.isArray(response)) break
    if (!response?.next) break
    if (pageItems.length === 0) break

    page += 1
  }

  return allCustomers
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
      currentStats,
      previousStats,
      currentSales,
      previousSales,
      staffList,
      customersList,
      currentExpenseStats,
      previousExpenseStats,
      lowStockProducts,
      returnsCurrent,
      returnsPrevious,
    ] = await Promise.all([
      requestCache.getOrSet(`stats-${businessId}-${outletId || 'all'}-${startStr}-${endStr}`, () => 
        saleService.getStats({ start_date: startStr, end_date: endStr, outlet: outletId, status: "completed" }).catch((err) => {
          console.error('Failed to fetch current stats:', err)
          return { total_revenue: 0, today_revenue: 0, total_sales: 0, today_sales: 0 }
        })
      ),
      requestCache.getOrSet(`stats-${businessId}-${outletId || 'all'}-${prevStartStr}-${prevEndStr}`, () =>
        saleService.getStats({ start_date: prevStartStr, end_date: prevEndStr, outlet: outletId, status: "completed" }).catch((err) => {
          console.error('Failed to fetch previous stats:', err)
          return { total_revenue: 0, today_revenue: 0, total_sales: 0, today_sales: 0 }
        })
      ),
      requestCache.getOrSet(`sales-${businessId}-${outletId || 'all'}-${startStr}-${endStr}`, () =>
        saleService.list({ outlet: outletId, start_date: startStr, end_date: endStr, page: 1 }).catch((err) => {
          console.error('Failed to fetch current sales:', err)
          return { results: [], count: 0 }
        })
      ),
      requestCache.getOrSet(`sales-${businessId}-${outletId || 'all'}-${prevStartStr}-${prevEndStr}`, () =>
        saleService.list({ outlet: outletId, start_date: prevStartStr, end_date: prevEndStr, page: 1 }).catch((err) => {
          console.error('Failed to fetch previous sales:', err)
          return { results: [], count: 0 }
        })
      ),
      requestCache.getOrSet(`staff-active-${businessId}-${outletId || 'all'}`, () =>
        staffService.list({ is_active: true }).then(res => res.results || []).catch(() => [])
      ),
      requestCache.getOrSet(`customers-${businessId}-${outletId || 'all'}`, () =>
        fetchAllCustomers(outletId).catch(() => [])
      ),
      requestCache.getOrSet(`expenses-${businessId}-${outletId || 'all'}-${startStr}-${endStr}`, () =>
        expenseService.stats({ outlet: outletId, start_date: startStr, end_date: endStr }).catch(() => ({ total_expenses: 0, today_expenses: 0, pending_count: 0, category_breakdown: [], status_breakdown: [] }))
      ),
      requestCache.getOrSet(`expenses-${businessId}-${outletId || 'all'}-${prevStartStr}-${prevEndStr}`, () =>
        expenseService.stats({ outlet: outletId, start_date: prevStartStr, end_date: prevEndStr }).catch(() => ({ total_expenses: 0, today_expenses: 0, pending_count: 0, category_breakdown: [], status_breakdown: [] }))
      ),
      requestCache.getOrSet(`low-stock-${businessId}-${outletId || 'all'}`, () =>
        productService.getLowStock(outletId).catch(() => [])
      ),
      requestCache.getOrSet(`returns-${businessId}-${outletId || 'all'}-${startStr}-${endStr}`, () =>
        returnService.list({ outlet: outletId, start_date: startStr, end_date: endStr }).catch(() => ({ results: [], count: 0 }))
      ),
      requestCache.getOrSet(`returns-${businessId}-${outletId || 'all'}-${prevStartStr}-${prevEndStr}`, () =>
        returnService.list({ outlet: outletId, start_date: prevStartStr, end_date: prevEndStr }).catch(() => ({ results: [], count: 0 }))
      ),
    ])
    
    const currentRevenue = Number(currentStats.total_revenue || currentStats.today_revenue || 0)
    const previousRevenue = Number(previousStats.total_revenue || previousStats.today_revenue || 0)
    const salesChange = percentChange(currentRevenue, previousRevenue)

    const currentTransactions = Number(currentStats.total_sales || currentSales.count || (Array.isArray(currentSales) ? currentSales.length : currentSales.results?.length || 0))
    const previousTransactions = Number(previousStats.total_sales || previousSales.count || (Array.isArray(previousSales) ? previousSales.length : previousSales.results?.length || 0))
    const transactionsChange = percentChange(currentTransactions, previousTransactions)

    const currentAvgOrder = currentTransactions > 0 ? currentRevenue / currentTransactions : 0
    const previousAvgOrder = previousTransactions > 0 ? previousRevenue / previousTransactions : 0
    const avgOrderChange = percentChange(currentAvgOrder, previousAvgOrder)
    
    // Calculate customer metrics
    const customersCount = extractResults(customersList).length
    
    // Calculate customer change - compare new customers this month vs last month
    const allCustomers = extractResults(customersList)
    const currentRangeNewCustomers = allCustomers.filter((c: any) => {
      if (!c.created_at && !c.createdAt) return false
      const createdDate = new Date(c.created_at || c.createdAt)
      return createdDate >= start && createdDate <= end
    }).length
    
    const previousRangeNewCustomers = allCustomers.filter((c: any) => {
      if (!c.created_at && !c.createdAt) return false
      const createdDate = new Date(c.created_at || c.createdAt)
      return createdDate >= previousStart && createdDate <= previousEnd
    }).length
    
    const customersChange = percentChange(currentRangeNewCustomers, previousRangeNewCustomers)
    
    // Calculate expense metrics
    const currentExpenses = Number(currentExpenseStats.total_expenses || 0)
    const previousExpenses = Number(previousExpenseStats.total_expenses || 0)
    const expensesChange = percentChange(currentExpenses, previousExpenses)
    
    // Calculate profit (sales - expenses for today)
    const currentProfit = currentRevenue - currentExpenses
    const previousProfit = previousRevenue - previousExpenses
    const profitChange = percentChange(currentProfit, previousProfit)
    
    // Calculate outstanding credit
    const customersWithCredit = extractResults(customersList).filter((c: any) => c.credit_enabled && Number(c.outstanding_balance || 0) > 0)
    const totalOutstandingCredit = customersWithCredit.reduce((sum: number, c: any) => sum + Number(c.outstanding_balance || 0), 0)
    
    // Calculate outstanding credit change
    // Since we don't have historical credit balance data, we'll show change as 0
    // To properly track this, backend would need to store daily/monthly credit snapshots
    // For now, the card shows the TOTAL outstanding credit amount only
    const outstandingCreditChange = 0
    
    // Calculate returns
    const returnsCurrentCount = Array.isArray(returnsCurrent) ? returnsCurrent.length : (returnsCurrent.count || returnsCurrent.results?.length || 0)
    const returnsPreviousCount = Array.isArray(returnsPrevious) ? returnsPrevious.length : (returnsPrevious.count || returnsPrevious.results?.length || 0)
    const returnsChange = percentChange(returnsCurrentCount, returnsPreviousCount)
    
    // Low stock items count
    const lowStockCount = Array.isArray(lowStockProducts) ? lowStockProducts.length : (lowStockProducts.results?.length || 0)
    
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
      transactions: { value: currentTransactions, change: transactionsChange },
      avgOrderValue: { value: currentAvgOrder, change: avgOrderChange },
      lowStockItems: { value: lowStockCount, change: 0 },
      outstandingCredit: { value: totalOutstandingCredit, change: outstandingCreditChange },
      returns: { value: returnsCurrentCount, change: returnsChange },
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
      transactions: { value: 0, change: 0 },
      avgOrderValue: { value: 0, change: 0 },
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




