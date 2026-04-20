"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, Mail, Phone, Shield, Building2, Edit, Trash2, Eye, Settings, Users as UsersIcon, Menu } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { userService } from "@/lib/services/userService"
import { useBusinessStore } from "@/stores/businessStore"
import { useAuthStore } from "@/stores/authStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { AddEditUserModal } from "@/components/modals/add-edit-user-modal"
import { ViewUserModal } from "@/components/modals/view-user-modal"
import { AddEditRoleModal } from "@/components/modals/add-edit-role-modal"
import { AddEditStaffModal } from "@/components/modals/add-edit-staff-modal"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { roleService, staffService, type Role, type Staff } from "@/lib/services/staffService"
import { useRole } from "@/contexts/role-context"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User } from "@/lib/types"
import { useI18n } from "@/contexts/i18n-context"

export default function AccountsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const { hasPermission } = useRole()
  const { toast } = useToast()
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [staffMembers, setStaffMembers] = useState<Staff[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStaffLoading, setIsStaffLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("users")
  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [showViewUser, setShowViewUser] = useState(false)
  const [showAddRole, setShowAddRole] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [showDeleteRoleDialog, setShowDeleteRoleDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDeleteStaffDialog, setShowDeleteStaffDialog] = useState(false)
  const [showPermissionDeniedDialog, setShowPermissionDeniedDialog] = useState(false)
  const [permissionDeniedMessage, setPermissionDeniedMessage] = useState("You do not have permission to perform this action.")
  const useReal = useRealAPI()

  const currentOutletId = currentOutlet?.id ? String(currentOutlet.id) : ""
  const canManageUsers = hasPermission("staff")
  const canManageStaff = hasPermission("staff")
  const canManageRoles = hasPermission("roles_manage")

  const showPermissionDenied = useCallback((message: string) => {
    setPermissionDeniedMessage(message)
    setShowPermissionDeniedDialog(true)
  }, [])

  const openUserModal = useCallback((user?: User | null) => {
    if (!canManageUsers) {
      showPermissionDenied("You do not have permission to manage users.")
      return
    }
    setSelectedUser(user || null)
    setShowAddUser(true)
  }, [canManageUsers, showPermissionDenied])

  const openStaffModal = useCallback((staff?: Staff | null) => {
    if (!canManageStaff) {
      showPermissionDenied("You do not have permission to manage staff assignments.")
      return
    }
    setSelectedStaff(staff || null)
    setShowAddStaff(true)
  }, [canManageStaff, showPermissionDenied])

  const openRoleModal = useCallback((role?: Role | null) => {
    if (!canManageRoles) {
      showPermissionDenied("You do not have permission to manage roles and permissions.")
      return
    }
    setSelectedRole(role || null)
    setShowAddRole(true)
  }, [canManageRoles, showPermissionDenied])

  const requestUserDelete = useCallback((userId: string) => {
    if (!canManageUsers) {
      showPermissionDenied("You do not have permission to delete users.")
      return
    }
    setUserToDelete(userId)
    setShowDeleteDialog(true)
  }, [canManageUsers, showPermissionDenied])

  const requestRoleDelete = useCallback((role: Role) => {
    if (!canManageRoles) {
      showPermissionDenied("You do not have permission to delete roles.")
      return
    }
    setRoleToDelete(role)
    setShowDeleteRoleDialog(true)
  }, [canManageRoles, showPermissionDenied])

  const extractUserOutletIds = (backendUser: any): string[] => {
    const fromPrimitiveArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) return []
      return value
        .map((item) => {
          if (item === null || item === undefined) return ""
          if (typeof item === "object") {
            const maybeId = (item as any).id ?? (item as any).outlet_id
            return maybeId !== undefined && maybeId !== null ? String(maybeId) : ""
          }
          return String(item)
        })
        .filter(Boolean)
    }

    const candidates = [
      backendUser?.outlet_ids,
      backendUser?.outletIds,
      backendUser?.outlets,
      backendUser?.staff?.outlets,
      backendUser?.staff_profile?.outlets,
    ]

    const ids = candidates.flatMap((candidate) => fromPrimitiveArray(candidate))
    return Array.from(new Set(ids))
  }

  const loadUsers = useCallback(async () => {
    if (!currentBusiness) {
      setUsers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      if (useReal) {
        // Get users from tenant endpoint (tenant includes users)
        const tenantResponse = await api.get<any>(`/tenants/${currentBusiness.id}/`)
        
        // Transform backend user data to frontend User format
        const backendUsers = tenantResponse.users || []
        const transformedUsers: User[] = backendUsers.map((backendUser: any) => ({
          id: String(backendUser.id),
          email: backendUser.email || "",
          name: backendUser.name || backendUser.username || backendUser.email?.split("@")[0] || "",
          phone: backendUser.phone || "",
          role: backendUser.role || "staff",
          effective_role: backendUser.effective_role || backendUser.role || "staff",
          businessId: String(currentBusiness.id),
          outletIds: extractUserOutletIds(backendUser),
          createdAt: backendUser.date_joined || new Date().toISOString(),
          is_saas_admin: backendUser.is_saas_admin || false,
          tenant: currentBusiness,
          permissions: backendUser.permissions || undefined,
          permission_codes: backendUser.permission_codes || undefined,
          staff_role: backendUser.staff_role || undefined,
        }))
        
        setUsers(transformedUsers)
      } else {
        setUsers([])
      }
    } catch (error: any) {
      console.error("Failed to load users:", error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, useReal])

  const loadRoles = useCallback(async () => {
    if (!currentBusiness) {
      setRoles([])
      return
    }

    try {
      if (useReal) {
        const response = await roleService.list({ tenant: currentBusiness.id })
        setRoles(response.results || [])
      } else {
        setRoles([])
      }
    } catch (error) {
      console.error("Failed to load roles:", error)
      setRoles([])
    }
  }, [currentBusiness, useReal])

  const loadStaff = useCallback(async () => {
    if (!currentBusiness) {
      setStaffMembers([])
      setIsStaffLoading(false)
      return
    }

    setIsStaffLoading(true)
    try {
      if (useReal) {
        const response = await staffService.list({
          tenant: currentBusiness.id,
        })
        setStaffMembers(response.results || [])
      } else {
        setStaffMembers([])
      }
    } catch (error) {
      console.error("Failed to load staff:", error)
      setStaffMembers([])
    } finally {
      setIsStaffLoading(false)
    }
  }, [currentBusiness, currentOutletId, useReal])

  useEffect(() => {
    loadUsers()
    loadStaff()
    loadRoles()
  }, [loadUsers, loadStaff, loadRoles])

  const handleAccessStateRefresh = useCallback(async () => {
    await Promise.allSettled([
      loadUsers(),
      loadStaff(),
      loadRoles(),
      refreshUser(),
    ])
  }, [loadUsers, loadStaff, loadRoles, refreshUser])
  
  const handleDeleteUser = useCallback(async (userId: string) => {
    if (currentBusiness) {
      loadUsers()
      loadRoles()
    }
  }, [currentBusiness, loadUsers, loadRoles])

  const handleDeleteRole = useCallback(async () => {
    if (!roleToDelete) return

    try {
      await roleService.delete(String(roleToDelete.id))
      setShowDeleteRoleDialog(false)
      setRoleToDelete(null)
      loadRoles()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role.",
        variant: "destructive",
      })
    }
  }, [roleToDelete, loadRoles, toast])

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return users.filter((user) => {
      const name = (user.name || "").toLowerCase()
      const email = (user.email || "").toLowerCase()
      const matchesSearch = name.includes(term) || email.includes(term)
      return matchesSearch
    })
  }, [users, searchTerm])

  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      return role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase())
    })
  }, [roles, searchTerm])

  const filteredStaff = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return staffMembers.filter(staff => {
      const name = staff.user?.name?.toLowerCase() || ""
      const email = staff.user?.email?.toLowerCase() || ""
      const role = staff.role?.name?.toLowerCase() || ""
      return name.includes(term) || email.includes(term) || role.includes(term)
    })
  }, [staffMembers, searchTerm])

  const tabsConfig = [
    {
      value: "users",
      label: "Users",
      icon: UsersIcon,
      badgeCount: filteredUsers.length,
      badgeVariant: "secondary",
    },
    {
      value: "staff",
      label: "Staff",
      icon: UsersIcon,
      badgeCount: filteredStaff.length,
      badgeVariant: "secondary",
    },
    {
      value: "roles",
      label: "Roles",
      icon: Shield,
      badgeCount: roles.length,
      badgeVariant: "secondary",
    },
  ] satisfies TabConfig[]

  const visibleTabsConfig = tabsConfig.filter((tab) => {
    if (tab.value === "roles") {
      return canManageRoles
    }
    return true
  })

  useEffect(() => {
    if (activeTab === "roles" && !canManageRoles) {
      setActiveTab("users")
    }
  }, [activeTab, canManageRoles])

  return (
    <DashboardLayout>
      <PageLayout
        title="User and Staff Management"
        description={t("settings.users.description")}
        noPadding={true}
      >
        <div className="px-6 pt-4 border-b border-gray-300">
          <FilterableTabs
            tabs={visibleTabsConfig}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          >
            <TabsContent value="users" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Users</h3>
                    <p className="text-sm text-gray-600">
                      {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
                    </p>
                  </div>
                  <Button 
                    onClick={() => openUserModal(null)}
                    className="bg-[#1e3a8a] text-white hover:bg-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create User
                  </Button>
                </div>
                <div className="mb-4 pb-4 border-b border-gray-300">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder={t("settings.users.search_placeholder")}
                      className="pl-10 bg-white border-gray-300"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-gray-900 font-semibold">Name</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Email</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Role</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Business</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <p className="text-gray-600">Loading users...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <p className="text-gray-600">No users found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => {
                          const userName = user.name || user.email?.split("@")[0] || "N/A"
                          const userEmail = user.email || "N/A"
                          // Display staff_role name if available, otherwise fall back to role
                          const displayRole = user.staff_role?.name || user.effective_role || user.role || "staff"
                          const isPrivileged = Boolean(user.is_saas_admin || user.permissions?.can_settings)
                          
                          return (
                            <TableRow key={user.id} className="border-gray-300">
                              <TableCell className="font-medium">{userName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  {userEmail}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 inline-block w-fit">
                                    {displayRole}
                                  </span>
                                  {user.staff_role && user.staff_role.description && (
                                    <span className="text-xs text-gray-500">
                                      {user.staff_role.description}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    {user.tenant && typeof user.tenant === 'object' && user.tenant.name
                                      ? user.tenant.name
                                      : currentBusiness?.name || "N/A"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  isPrivileged
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-green-100 text-green-800"
                                }`}>
                                  {user.is_saas_admin ? "SaaS Admin" : "Active"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="border-gray-300">
                                      <Menu className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUser(user)
                                        setShowViewUser(true)
                                      }}
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        openUserModal(user)
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        requestUserDelete(user.id)
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="staff" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Staff</h3>
                    <p className="text-sm text-gray-600">
                      {filteredStaff.length} staff member{filteredStaff.length !== 1 ? "s" : ""} found
                    </p>
                  </div>
                  <Button
                    onClick={() => openStaffModal(null)}
                    className="bg-[#1e3a8a] text-white hover:bg-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Assign Staff
                  </Button>
                </div>

                <div className="mb-4 pb-4 border-b border-gray-300">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search by name, email, or role"
                      className="pl-10 bg-white border-gray-300"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-gray-900 font-semibold">Name</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Email</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Role</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Outlets</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                        <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isStaffLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <p className="text-gray-600">Loading staff...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredStaff.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <p className="text-gray-600">No staff found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStaff.map((staff) => (
                          <TableRow key={staff.id} className="border-gray-300">
                            <TableCell className="font-medium">{staff.user?.name || "-"}</TableCell>
                            <TableCell>{staff.user?.email || "-"}</TableCell>
                            <TableCell>{staff.role?.name || "Unassigned"}</TableCell>
                            <TableCell>
                              {staff.outlets?.length ? staff.outlets.map((o) => o.name).join(", ") : "Not assigned"}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${staff.is_active ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                {staff.is_active ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openStaffModal(staff)}
                                aria-label={`Edit role for ${staff.user?.name || staff.user?.email || "staff member"}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="roles" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Roles</h3>
                    <p className="text-sm text-gray-600">
                      {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""} found
                    </p>
                  </div>
                  <Button 
                    onClick={() => openRoleModal(null)}
                    className="bg-[#1e3a8a] text-white hover:bg-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Role
                  </Button>
                </div>
                <div className="mb-4 pb-4 border-b border-gray-300">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder={t("settings.users.search_roles_placeholder")}
                      className="pl-10 bg-white border-gray-300"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredRoles.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No roles found</p>
                    </div>
                  ) : (
                    filteredRoles.map((role) => {
                      const codeCount = Array.isArray(role.effective_permission_codes)
                        ? role.effective_permission_codes.length
                        : 0
                      const legacyCount = [
                        role.can_dashboard,
                        role.can_sales,
                        role.can_inventory,
                        role.can_products,
                        role.can_customers,
                        role.can_reports,
                        role.can_staff,
                        role.can_settings,
                        role.can_distribution,
                        role.can_storefront,
                        role.can_pos_retail,
                        role.can_pos_restaurant,
                        role.can_pos_bar,
                        role.can_switch_outlet,
                      ].filter(Boolean).length
                      const permissionCount = Math.max(codeCount, legacyCount)
                      const accentClass = permissionCount >= 8
                        ? "bg-blue-100 text-blue-600"
                        : permissionCount >= 4
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-gray-100 text-gray-600"

                      return (
                        <div
                          key={role.id}
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className={`p-3 rounded-lg ${accentClass}`}>
                            <Shield className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{role.name.toUpperCase()}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {role.description || "No description provided"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {permissionCount} permission{permissionCount === 1 ? "" : "s"} enabled
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openRoleModal(role)}
                            >
                              <Settings className="h-5 w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => requestRoleDelete(role)}
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </TabsContent>

          </FilterableTabs>
        </div>
      </PageLayout>

      {/* Modals */}
      <AddEditUserModal
        open={showAddUser}
        onOpenChange={(open) => {
          setShowAddUser(open)
          if (!open) setSelectedUser(null)
        }}
        user={selectedUser}
        onSuccess={handleAccessStateRefresh}
      />

      <ViewUserModal
        open={showViewUser}
        onOpenChange={setShowViewUser}
        user={selectedUser}
      />

      <AddEditRoleModal
        open={showAddRole}
        onOpenChange={(open) => {
          setShowAddRole(open)
          if (!open) setSelectedRole(null)
        }}
        role={selectedRole}
        onSuccess={() => {
          handleAccessStateRefresh()
        }}
      />

      <AddEditStaffModal
        open={showAddStaff}
        onOpenChange={(open) => {
          setShowAddStaff(open)
          if (!open) setSelectedStaff(null)
        }}
        staff={selectedStaff}
        onSuccess={handleAccessStateRefresh}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone. The user will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!userToDelete) return

                try {
                  await userService.delete(userToDelete)
                  loadUsers()
                  setShowDeleteDialog(false)
                  setUserToDelete(null)
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to delete user.",
                    variant: "destructive",
                  })
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={showDeleteRoleDialog} onOpenChange={setShowDeleteRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPermissionDeniedDialog} onOpenChange={setShowPermissionDeniedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permission Denied</AlertDialogTitle>
            <AlertDialogDescription>
              {permissionDeniedMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPermissionDeniedDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteStaffDialog} onOpenChange={setShowDeleteStaffDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this staff member record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!staffToDelete) return

                try {
                  await staffService.delete(String(staffToDelete.id))
                  setShowDeleteStaffDialog(false)
                  setStaffToDelete(null)
                  loadStaff()
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to delete staff member.",
                    variant: "destructive",
                  })
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

