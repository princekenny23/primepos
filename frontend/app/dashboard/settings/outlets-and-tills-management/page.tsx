"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Button } from "@/components/ui/button"
import { Plus, Store, RefreshCw, ChevronDown, Pencil, Trash2, Menu, Eye, EyeOff } from "lucide-react"
import { OutletList } from "@/components/outlets/outlet-list"
import { AddEditOutletModal } from "@/components/modals/add-edit-outlet-modal"
import { AddEditTillModal } from "@/components/modals/add-edit-till-modal"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTenant } from "@/contexts/tenant-context"
import { useBusinessStore } from "@/stores/businessStore"
import { useAuthStore } from "@/stores/authStore"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { tillService, type Till } from "@/lib/services/tillService"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { useI18n } from "@/contexts/i18n-context"
import { authService } from "@/lib/services/authService"

export default function OutletsAndTillsManagementPage() {
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false)
  const [isTillModalOpen, setIsTillModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSwitching, setIsSwitching] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("outlets")
  const [tills, setTills] = useState<Till[]>([])
  const [isLoadingTills, setIsLoadingTills] = useState(true)
  const [editingTill, setEditingTill] = useState<Till | null>(null)
  const [deletingTill, setDeletingTill] = useState<Till | null>(null)
  const [switchAuthOpen, setSwitchAuthOpen] = useState(false)
  const [pendingOutletId, setPendingOutletId] = useState<string | null>(null)
  const [switchUsername, setSwitchUsername] = useState("")
  const [switchPassword, setSwitchPassword] = useState("")
  const [showSwitchPassword, setShowSwitchPassword] = useState(false)
  const [isVerifyingSwitch, setIsVerifyingSwitch] = useState(false)
  
  const { outlets, currentOutlet, setOutlets, switchOutlet } = useTenant()
  const { currentBusiness, loadOutlets } = useBusinessStore()
  const { user } = useAuthStore()
  const { toast } = useToast()
  const router = useRouter()
  const { t } = useI18n()

  // Load outlets on mount and when business changes
  useEffect(() => {
    const loadData = async () => {
      if (loadOutlets && currentBusiness?.id) {
        try {
          await loadOutlets(currentBusiness.id)
          setRefreshKey(prev => prev + 1)
        } catch (error) {
          console.error("Failed to load outlets:", error)
        }
      }
    }
    loadData()
  }, [currentBusiness?.id, loadOutlets])

  // Load tills for current outlet
  const loadTills = useCallback(async () => {
    if (!currentBusiness || !currentOutlet) {
      setTills([])
      setIsLoadingTills(false)
      return
    }
    
    setIsLoadingTills(true)
    try {
      const response = await tillService.list({ outlet: String(currentOutlet.id) })
      const tillsData = Array.isArray(response) ? response : (response.results || [])
      setTills(tillsData)
    } catch (error) {
      console.error("Failed to load tills:", error)
      toast({
        title: "Error",
        description: "Failed to load tills. Please try again.",
        variant: "destructive",
      })
      setTills([])
    } finally {
      setIsLoadingTills(false)
    }
  }, [currentBusiness, currentOutlet, toast])

  useEffect(() => {
    loadTills()
  }, [loadTills])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Refresh outlets from business store
      if (loadOutlets && currentBusiness?.id) {
        await loadOutlets(currentBusiness.id)
      }
      
      // Refresh tills
      await loadTills()
      
      // Force refresh of outlet list by changing key
      setRefreshKey(prev => prev + 1)
      
      // Also refresh the page data
      router.refresh()
    } catch (error: any) {
      console.error("Failed to refresh:", error)
      toast({
        title: "Error",
        description: "Failed to refresh. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleOutletCreated = async () => {
    // Refresh outlets from business store
    if (loadOutlets && currentBusiness?.id) {
      await loadOutlets(currentBusiness.id)
    }
    // Force refresh of outlet list by changing key
    setRefreshKey(prev => prev + 1)
    setIsOutletModalOpen(false)
  }

  const handleSwitchOutlet = async (outletId: string) => {
    setIsSwitching(outletId)
    try {
      await switchOutlet(outletId)
      // Refresh outlets to update current outlet badge
      if (loadOutlets && currentBusiness?.id) {
        await loadOutlets(currentBusiness.id)
      }
      setRefreshKey(prev => prev + 1)
      router.refresh()
    } catch (error: any) {
      console.error("Failed to switch outlet:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to switch outlet",
        variant: "destructive",
      })
    } finally {
      setIsSwitching(null)
    }
  }

  const requestOutletSwitch = (outletId: string) => {
    if (!outletId || outletId === String(currentOutlet?.id || "")) return
    setPendingOutletId(outletId)
    setSwitchUsername(user?.email || "")
    setSwitchPassword("")
    setSwitchAuthOpen(true)
  }

  const closeSwitchAuth = () => {
    setSwitchAuthOpen(false)
    setPendingOutletId(null)
    setSwitchUsername("")
    setSwitchPassword("")
    setShowSwitchPassword(false)
    setIsVerifyingSwitch(false)
  }

  const confirmOutletSwitch = async () => {
    if (!pendingOutletId || !user?.email) {
      closeSwitchAuth()
      return
    }

    if (!switchUsername.trim() || !switchPassword.trim()) {
      toast({
        title: "Login details required",
        description: "Enter your username and password to switch outlet.",
        variant: "destructive",
      })
      return
    }

    setIsVerifyingSwitch(true)
    try {
      await authService.verifyCredentials(switchUsername.trim(), switchPassword)
      await handleSwitchOutlet(pendingOutletId)
      closeSwitchAuth()
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error?.message || "Invalid login details. Please try again.",
        variant: "destructive",
      })
      setIsVerifyingSwitch(false)
    }
  }

  const handleAddTill = () => {
    setEditingTill(null)
    setIsTillModalOpen(true)
  }

  const handleEditTill = (till: Till) => {
    setEditingTill(till)
    setIsTillModalOpen(true)
  }

  const handleDeleteTill = async () => {
    if (!deletingTill) return

    try {
      await tillService.delete(deletingTill.id)
      setDeletingTill(null)
      loadTills()
    } catch (error: any) {
      console.error("Failed to delete till:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete till.",
        variant: "destructive",
      })
    }
  }

  const handleTillModalSuccess = () => {
    setIsTillModalOpen(false)
    setEditingTill(null)
    loadTills()
  }

  const activeOutlets = outlets.filter(o => o.isActive).length
  const totalOutlets = outlets.length
  const availableOutlets = outlets.filter(o => o.isActive && currentOutlet?.id !== o.id)

  const tabsConfig: TabConfig[] = [
    {
      value: "outlets",
      label: t("settings.outlets.outlets_tab"),
      badgeCount: totalOutlets,
    },
    {
      value: "tills",
      label: t("settings.outlets.tills_tab"),
      badgeCount: tills.length,
    },
  ]

  return (
    <DashboardLayout>
      <PageLayout
        title={t("settings.outlets.title")}
        description={t("settings.outlets.description")}
      >
        {/* Tabs */}
        <FilterableTabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {/* Outlets Tab */}
          <TabsContent value="outlets">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t("settings.outlets.all_outlets")}</CardTitle>
                    <CardDescription>
                      {totalOutlets} {totalOutlets === 1 ? t("settings.outlets.outlet_singular") : t("settings.outlets.outlet_plural")} {t("common.total")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {/* Switch Outlet Dropdown */}
                    {outlets.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button disabled={isSwitching !== null}>
                            <Store className="mr-2 h-4 w-4" />
                            {currentOutlet ? `${t("settings.outlets.current")}: ${currentOutlet.name}` : t("settings.outlets.switch_outlet")}
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{t("settings.outlets.switch_outlet")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {currentOutlet && (
                            <>
                              <DropdownMenuItem disabled className="opacity-100">
                                <div className="flex items-center gap-2 w-full">
                                  <Store className="h-4 w-4 text-primary" />
                                  <div className="flex-1">
                                    <div className="font-medium">{currentOutlet.name}</div>
                                    <div className="text-xs text-muted-foreground">{t("settings.outlets.current")}</div>
                                  </div>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {availableOutlets.length === 0 ? (
                            <DropdownMenuItem disabled>
                              {t("settings.outlets.no_other_outlets")}
                            </DropdownMenuItem>
                          ) : (
                            availableOutlets.map((outlet) => (
                              <DropdownMenuItem
                                key={outlet.id}
                                onClick={() => requestOutletSwitch(String(outlet.id))}
                                disabled={isSwitching === String(outlet.id)}
                              >
                                {isSwitching === String(outlet.id) ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Store className="mr-2 h-4 w-4" />
                                )}
                                {outlet.name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button onClick={() => setIsOutletModalOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("settings.outlets.add_outlet")}
                    </Button>
                    <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <OutletList key={refreshKey} onOutletUpdated={handleOutletCreated} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tills Tab */}
          <TabsContent value="tills">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t("settings.outlets.tills_tab")}</CardTitle>
                    <CardDescription>{t("settings.outlets.tills_description")}</CardDescription>
                  </div>
                  <Button onClick={handleAddTill}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("settings.outlets.add_till")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingTills ? (
                  <p className="text-center text-muted-foreground py-8">{t("common.loading")}</p>
                ) : tills.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t("settings.outlets.no_tills")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Outlet</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>In Use</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tills.map((till) => (
                          <TableRow key={till.id}>
                            <TableCell className="font-medium">{till.name}</TableCell>
                            <TableCell>
                              {typeof till.outlet === 'object' 
                                ? till.outlet.name 
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={till.is_active ? "default" : "secondary"}>
                                {till.is_active ? t("common.active") : t("common.inactive")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={till.is_in_use ? "default" : "outline"}>
                                {till.is_in_use ? t("settings.outlets.in_use") : t("settings.outlets.available")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Menu className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleEditTill(till)}
                                    disabled={till.is_in_use}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setDeletingTill(till)}
                                    disabled={till.is_in_use}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </FilterableTabs>

        {/* Modals */}
        <AddEditOutletModal 
          open={isOutletModalOpen} 
          onOpenChange={setIsOutletModalOpen}
          onOutletCreated={handleOutletCreated}
        />

        <AddEditTillModal
          open={isTillModalOpen}
          onOpenChange={setIsTillModalOpen}
          till={editingTill}
          onSuccess={handleTillModalSuccess}
        />

        <Dialog open={switchAuthOpen} onOpenChange={(open) => (!open ? closeSwitchAuth() : setSwitchAuthOpen(open))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Login</DialogTitle>
              <DialogDescription>
                Enter your password to switch outlet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="switch-outlet-username">Username</Label>
                <Input
                  id="switch-outlet-username"
                  type="text"
                  value={switchUsername}
                  onChange={(event) => setSwitchUsername(event.target.value)}
                  placeholder="Enter username or email"
                  disabled={isVerifyingSwitch}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="switch-outlet-password">Password</Label>
                <div className="relative">
                  <Input
                    id="switch-outlet-password"
                    type={showSwitchPassword ? "text" : "password"}
                    value={switchPassword}
                    onChange={(event) => setSwitchPassword(event.target.value)}
                    placeholder="Enter your password"
                    disabled={isVerifyingSwitch}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSwitchPassword(!showSwitchPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isVerifyingSwitch}
                  >
                    {showSwitchPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeSwitchAuth} disabled={isVerifyingSwitch}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmOutletSwitch} disabled={isVerifyingSwitch}>
                {isVerifyingSwitch ? "Verifying..." : "Verify & Switch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Till Confirmation Dialog */}
        <AlertDialog open={!!deletingTill} onOpenChange={(open) => !open && setDeletingTill(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.outlets.delete_till")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.outlets.delete_till_confirm", { name: deletingTill?.name || "" })}
                {deletingTill?.is_in_use && (
                  <span className="block mt-2 text-destructive font-medium">
                    {t("settings.outlets.till_in_use_warning")}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTill}
                disabled={deletingTill?.is_in_use}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.actions.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageLayout>
    </DashboardLayout>
  )
}

