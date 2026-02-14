// Dashboard Stats Utilities - Generate industry-specific stats
import type { Business } from "../types"
import { saleService } from "../services/saleService"
import { productService } from "../services/productService"
import { customerService } from "../services/customerService"
import { expenseService } from "../services/expenseService"
import { returnService } from "../services/returnService"
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

/**
 * Generate KPI data for business dashboard
 * Calculates trends by comparing with previous period
 */
export async function generateKPIData(
  businessId: string,
  business: Business,
  outletId?: string
): Promise<DashboardKPI> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split("T")[0]
    
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayStr = yesterday.toISOString().split("T")[0]
    
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    const thisMonthStr = thisMonth.toISOString().split("T")[0]
    
    const lastMonth = new Date(thisMonth)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const lastMonthStr = lastMonth.toISOString().split("T")[0]
    
    // Use cache keys for request deduplication
    const cacheKey = `dashboard-kpi-${businessId}-${outletId || 'all'}-${todayStr}`
    
    // Fetch all data in parallel with caching
    const [
      todayStats,
      yesterdayStats,
      todaySales,
      yesterdaySales,
      productCount,
      customersList,
      expenseStats,
      expenseStatsLastMonth,
      lowStockProducts,
      returnsToday,
      returnsYesterday,
    ] = await Promise.all([
      requestCache.getOrSet(`stats-${outletId}-${todayStr}`, () => 
        saleService.getStats({ start_date: todayStr, end_date: todayStr, outlet: outletId }).catch(() => ({ total_revenue: 0, today_revenue: 0, total_sales: 0, today_sales: 0 }))
      ),
      requestCache.getOrSet(`stats-${outletId}-${yesterdayStr}`, () =>
        saleService.getStats({ start_date: yesterdayStr, end_date: yesterdayStr, outlet: outletId }).catch(() => ({ total_revenue: 0, today_revenue: 0, total_sales: 0, today_sales: 0 }))
      ),
      requestCache.getOrSet(`sales-${outletId}-${todayStr}`, () =>
        saleService.list({ outlet: outletId, status: "completed", start_date: todayStr, end_date: todayStr, page: 1 }).catch(() => ({ results: [], count: 0 }))
      ),
      requestCache.getOrSet(`sales-${outletId}-${yesterdayStr}`, () =>
        saleService.list({ outlet: outletId, status: "completed", start_date: yesterdayStr, end_date: yesterdayStr, page: 1 }).catch(() => ({ results: [], count: 0 }))
      ),
      requestCache.getOrSet(`products-count-${outletId}`, () =>
        productService.count({ is_active: true }).catch(() => 0)
      ),
      requestCache.getOrSet(`customers-${outletId}`, () =>
        customerService.list({ outlet: outletId }).catch(() => [])
      ),
      requestCache.getOrSet(`expenses-${outletId}-${thisMonthStr}`, () =>
        expenseService.stats({ outlet: outletId, start_date: thisMonthStr }).catch(() => ({ total_expenses: 0, today_expenses: 0, pending_count: 0, category_breakdown: [], status_breakdown: [] }))
      ),
      requestCache.getOrSet(`expenses-${outletId}-${lastMonthStr}`, () =>
        expenseService.stats({ outlet: outletId, start_date: lastMonthStr, end_date: yesterdayStr }).catch(() => ({ total_expenses: 0, today_expenses: 0, pending_count: 0, category_breakdown: [], status_breakdown: [] }))
      ),
      requestCache.getOrSet(`low-stock-${outletId}`, () =>
        productService.getLowStock(outletId).catch(() => [])
      ),
      requestCache.getOrSet(`returns-${outletId}-${todayStr}`, () =>
        returnService.list({ outlet: outletId, start_date: todayStr, end_date: todayStr }).catch(() => ({ results: [], count: 0 }))
      ),
      requestCache.getOrSet(`returns-${outletId}-${yesterdayStr}`, () =>
        returnService.list({ outlet: outletId, start_date: yesterdayStr, end_date: yesterdayStr }).catch(() => ({ results: [], count: 0 }))
      ),
    ])
    
    // Calculate sales metrics
    const todayRevenue = todayStats.today_revenue || todayStats.total_revenue || 0
    const yesterdayRevenue = yesterdayStats.today_revenue || yesterdayStats.total_revenue || 0
    const salesChange = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : todayRevenue > 0 ? 100 : 0
    
    // Calculate transaction metrics - use count if available, otherwise use results length
    const todayTransactions = todaySales.count ?? (Array.isArray(todaySales) ? todaySales.length : (todaySales.results?.length || 0))
    const yesterdayTransactions = yesterdaySales.count ?? (Array.isArray(yesterdaySales) ? yesterdaySales.length : (yesterdaySales.results?.length || 0))
    const transactionsChange = yesterdayTransactions > 0
      ? ((todayTransactions - yesterdayTransactions) / yesterdayTransactions) * 100
      : todayTransactions > 0 ? 100 : 0
    
    // Calculate average order value
    const todayAvgOrder = todayTransactions > 0 ? todayRevenue / todayTransactions : 0
    const yesterdayAvgOrder = yesterdayTransactions > 0 ? yesterdayRevenue / yesterdayTransactions : 0
    const avgOrderChange = yesterdayAvgOrder > 0
      ? ((todayAvgOrder - yesterdayAvgOrder) / yesterdayAvgOrder) * 100
      : todayAvgOrder > 0 ? 100 : 0
    
    // Calculate customer metrics
    const customersCount = Array.isArray(customersList) ? customersList.length : (customersList.results?.length || 0)
    // For customer change, we'll use a simple approach - compare total customers
    // In a real scenario, you might want to track new customers this month vs last month
    const customersChange = 0 // TODO: Implement proper customer growth tracking
    
    // Calculate expense metrics
    const thisMonthExpenses = expenseStats.total_expenses || 0
    const lastMonthExpenses = expenseStatsLastMonth.total_expenses || 0
    const expensesChange = lastMonthExpenses > 0
      ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
      : thisMonthExpenses > 0 ? 100 : 0
    
    // Calculate profit (sales - expenses for today)
    const todayExpenses = expenseStats.today_expenses || 0
    const todayProfit = todayRevenue - todayExpenses
    const yesterdayProfit = yesterdayRevenue - (expenseStatsLastMonth.today_expenses || 0)
    const profitChange = yesterdayProfit > 0
      ? ((todayProfit - yesterdayProfit) / yesterdayProfit) * 100
      : todayProfit > 0 ? 100 : 0
    
    // Calculate outstanding credit
    const customersWithCredit = Array.isArray(customersList) 
      ? customersList.filter((c: any) => c.credit_enabled && c.outstanding_balance > 0)
      : (customersList.results || []).filter((c: any) => c.credit_enabled && c.outstanding_balance > 0)
    const totalOutstandingCredit = customersWithCredit.reduce((sum: number, c: any) => sum + (c.outstanding_balance || 0), 0)
    
    // Calculate returns
    const returnsTodayCount = Array.isArray(returnsToday) ? returnsToday.length : (returnsToday.count || returnsToday.results?.length || 0)
    const returnsYesterdayCount = Array.isArray(returnsYesterday) ? returnsYesterday.length : (returnsYesterday.count || returnsYesterday.results?.length || 0)
    const returnsChange = returnsYesterdayCount > 0
      ? ((returnsTodayCount - returnsYesterdayCount) / returnsYesterdayCount) * 100
      : returnsTodayCount > 0 ? 100 : 0
    
    // Low stock items count
    const lowStockCount = Array.isArray(lowStockProducts) ? lowStockProducts.length : (lowStockProducts.results?.length || 0)
    
    return {
      sales: { value: todayRevenue, change: salesChange },
      customers: { value: customersCount, change: customersChange },
      products: { value: productCount, change: 0 },
      expenses: { value: thisMonthExpenses, change: expensesChange },
      profit: { value: todayProfit, change: profitChange },
      transactions: { value: todayTransactions, change: transactionsChange },
      avgOrderValue: { value: todayAvgOrder, change: avgOrderChange },
      lowStockItems: { value: lowStockCount, change: 0 },
      outstandingCredit: { value: totalOutstandingCredit, change: 0 },
      returns: { value: returnsTodayCount, change: returnsChange },
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
  outletId?: string
): Promise<ChartDataPoint[]> {
  try {
    // Use cache for chart data
    const cacheKey = `chart-${outletId || 'all'}`
    const chartData = await requestCache.getOrSet(cacheKey, () => saleService.getChartData(outletId))
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
    const cacheKey = `top-selling-${outletId || 'all'}`
    return await requestCache.getOrSet(cacheKey, () =>
      saleService.getTopSellingItems({ outlet: outletId })
    )
  } catch (error) {
    console.error("Failed to load top selling items from API:", error)
    return []
  }
}




