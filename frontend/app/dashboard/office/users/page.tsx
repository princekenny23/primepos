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
import { Plus, Search, Mail, Phone, Shield, Building2, Edit, Trash2, Eye, Lock, Settings, CheckCircle2, ShoppingCart, Package, Users as UsersIcon, BarChart3, FileText, Menu } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { userService } from "@/lib/services/userService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { AddEditUserModal } from "@/components/modals/add-edit-user-modal"
import { ViewUserModal } from "@/components/modals/view-user-modal"
import { AddEditRoleModal } from "@/components/modals/add-edit-role-modal"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { roleService, type Role } from "@/lib/services/staffService"
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
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("users")
  const [showAddUser, setShowAddUser] = useState(false)
  const [showViewUser, setShowViewUser] = useState(false)
  const [showAddRole, setShowAddRole] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [showDeleteRoleDialog, setShowDeleteRoleDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const useReal = useRealAPI()

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
          role: backendUser.role || "staff",
          effective_role: backendUser.effective_role || backendUser.role || "staff",
          businessId: String(currentBusiness.id),
          outletIds: [],
          createdAt: backendUser.date_joined || new Date().toISOString(),
          is_saas_admin: backendUser.is_saas_admin || false,
          tenant: currentBusiness,
          permissions: backendUser.permissions || undefined,
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

  useEffect(() => {
    loadUsers()
    loadRoles()
  }, [loadUsers, loadRoles])
  
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
      toast({
        title: "Role Deleted",
        description: "Role has been deleted successfully.",
      })
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
    return users.filter(user => {
      const name = user.name || ""
      const email = user.email || ""
      const searchLower = searchTerm.toLowerCase()
      return name.toLowerCase().includes(searchLower) || email.toLowerCase().includes(searchLower)
    })
  }, [users, searchTerm])

  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      return role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase())
    })
  }, [roles, searchTerm])

  const tabsConfig: TabConfig[] = [
    {
      value: "users",
      label: "Users",
      icon: UsersIcon,
      badgeCount: users.length,
      badgeVariant: "secondary",
    },
    {
      value: "roles",
      label: "Roles",
      icon: Shield,
      badgeCount: roles.length,
      badgeVariant: "secondary",
    },
    {
      value: "permissions",
      label: "Permissions",
      icon: Lock,
      badgeCount: roles.length,
      badgeVariant: "secondary",
    },
  ]

  return (
    <DashboardLayout>
      <PageLayout
        title={t("settings.menu.users")}
        description={t("settings.users.description")}
        noPadding={true}
      >
        <div className="px-6 pt-4 border-b border-gray-300">
          <FilterableTabs
            tabs={tabsConfig}
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
                    onClick={() => {
                      setSelectedUser(null)
                      setShowAddUser(true)
                    }}
                    className="bg-[#1e3a8a] text-white hover:bg-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
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
                          const isAdmin = user.is_saas_admin || user.role === "admin"
                          
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
                                  isAdmin
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
                                        setSelectedUser(user)
                                        setShowAddUser(true)
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setUserToDelete(user.id)
                                        setShowDeleteDialog(true)
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
                    onClick={() => {
                      setSelectedRole(null)
                      setShowAddRole(true)
                    }}
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
                      // Get role icon and color based on role name
                      const getRoleIcon = (roleName: string) => {
                        const name = roleName.toLowerCase()
                        if (name.includes("admin")) {
                          return { icon: Shield, color: "bg-red-100 text-red-600", iconColor: "text-red-600" }
                        } else if (name.includes("manager")) {
                          return { icon: UsersIcon, color: "bg-blue-100 text-blue-600", iconColor: "text-blue-600" }
                        } else if (name.includes("cashier")) {
                          return { icon: ShoppingCart, color: "bg-green-100 text-green-600", iconColor: "text-green-600" }
                        } else {
                          return { icon: UsersIcon, color: "bg-gray-100 text-gray-600", iconColor: "text-gray-600" }
                        }
                      }

                      const { icon: RoleIcon, color, iconColor } = getRoleIcon(role.name)

                      return (
                        <div
                          key={role.id}
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className={`p-3 rounded-lg ${color}`}>
                            <RoleIcon className={`h-6 w-6 ${iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{role.name.toUpperCase()}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {role.description || "No description provided"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedRole(role)
                                setShowAddRole(true)
                              }}
                            >
                              <Settings className="h-5 w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setRoleToDelete(role)
                                setShowDeleteRoleDialog(true)
                              }}
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

            <TabsContent value="permissions" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Permission Settings</h3>
                    <p className="text-sm text-gray-600">
                      View and manage permissions for each role
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setSelectedRole(null)
                      setShowAddRole(true)
                    }}
                    className="bg-[#1e3a8a] text-white hover:bg-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Role
                  </Button>
                </div>
                <div className="mb-6 pb-4 border-b border-gray-300">
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

                {filteredRoles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No roles found</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {filteredRoles.map((role) => (
                      <div key={role.id} className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-lg font-semibold">{role.name}</h3>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRole(role)
                                setShowAddRole(true)
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                setRoleToDelete(role)
                                setShowDeleteRoleDialog(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>

                        {/* Sales & Transactions */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-base">Sales & Transactions</h4>
                          <div className="space-y-2 pl-4">
                            <div className="flex items-center gap-2">
                              {role.can_sales ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">Process Sales</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_sales ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">View Sales History</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_sales ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">Handle Returns</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_sales ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">Manage Payments</span>
                            </div>
                          </div>
                        </div>

                        {/* Inventory Management */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-base">Inventory Management</h4>
                          <div className="space-y-2 pl-4">
                            <div className="flex items-center gap-2">
                              {role.can_products || role.can_inventory ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">View Products</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_products ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">Add/Edit Products</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_inventory ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">Manage Stock</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_reports || role.can_inventory ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">View Inventory Reports</span>
                            </div>
                          </div>
                        </div>

                        {/* Customer Management */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-base">Customer Management</h4>
                          <div className="space-y-2 pl-4">
                            <div className="flex items-center gap-2">
                              {role.can_customers ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">View Customers</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_customers ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">Add/Edit Customers</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.can_customers || role.can_reports ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              <span className="text-sm">View Customer History</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </FilterableTabs>
        </div>
      </PageLayout>

      {/* Modals */}
      <AddEditUserModal
        open={showAddUser}
        onOpenChange={setShowAddUser}
        user={selectedUser}
        onSuccess={loadUsers}
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
          loadRoles()
        }}
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
                  toast({
                    title: "User Deleted",
                    description: "User has been deleted successfully.",
                  })
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
    </DashboardLayout>
  )
}

