"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { AddEditStaffModal } from "@/components/modals/add-edit-staff-modal"
import { staffService, type Staff } from "@/lib/services/staffService"
import { useBusinessStore } from "@/stores/businessStore"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Search, Edit, Trash2 } from "lucide-react"

export default function StaffManagementPage() {
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()

  const [staffMembers, setStaffMembers] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddEdit, setShowAddEdit] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const loadStaff = useCallback(async () => {
    if (!currentBusiness) {
      setStaffMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await staffService.list({ tenant: currentBusiness.id })
      setStaffMembers(response.results || [])
    } catch (error: any) {
      console.error("Failed to load staff:", error)
      setStaffMembers([])
      toast({
        title: "Error",
        description: error?.message || "Failed to load staff members.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, toast])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const handleAddStaff = () => {
    setSelectedStaff(null)
    setShowAddEdit(true)
  }

  const handleEditStaff = (staff: Staff) => {
    setSelectedStaff(staff)
    setShowAddEdit(true)
  }

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return

    try {
      await staffService.delete(staffToDelete.id)
      toast({
        title: "Staff Removed",
        description: "Staff member has been removed successfully.",
      })
      setShowDeleteDialog(false)
      setStaffToDelete(null)
      loadStaff()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove staff member.",
        variant: "destructive",
      })
    }
  }

  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return staffMembers

    return staffMembers.filter((staff) => {
      const name = staff.user?.name?.toLowerCase() || ""
      const email = staff.user?.email?.toLowerCase() || ""
      const role = staff.role?.name?.toLowerCase() || ""
      return name.includes(term) || email.includes(term) || role.includes(term)
    })
  }, [staffMembers, searchTerm])

  return (
    <DashboardLayout>
      <PageLayout
        title="Staff Management"
        description="Manage employees, assign roles, and map staff to outlets."
        noPadding={true}
      >
        <div className="space-y-6 p-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or role"
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleAddStaff}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Staff
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Outlets</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          Loading staff members...
                        </TableCell>
                      </TableRow>
                    ) : filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          No staff members found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((staff) => (
                        <TableRow key={staff.id}>
                          <TableCell className="font-medium">{staff.user?.name || "-"}</TableCell>
                          <TableCell>{staff.user?.email || "-"}</TableCell>
                          <TableCell>{staff.role?.name || "Unassigned"}</TableCell>
                          <TableCell>
                            {staff.outlets?.length ? staff.outlets.map((o) => o.name).join(", ") : "Not assigned"}
                          </TableCell>
                          <TableCell>
                            <span className={staff.is_active ? "text-green-600" : "text-amber-600"}>
                              {staff.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditStaff(staff)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStaffToDelete(staff)
                                  setShowDeleteDialog(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <AddEditStaffModal
          open={showAddEdit}
          onOpenChange={setShowAddEdit}
          staff={selectedStaff}
          onSuccess={loadStaff}
        />

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently remove
                {" "}
                <strong>{staffToDelete?.user?.name || "this staff member"}</strong>
                {" "}
                from staff records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStaff} className="bg-red-600 hover:bg-red-700">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageLayout>
    </DashboardLayout>
  )
}
