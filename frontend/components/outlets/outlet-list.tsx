"use client"

import { useTenant } from "@/contexts/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { MapPin, Phone, Mail, Edit, Trash2, Settings, BarChart3, Store, MoreVertical, 
  Power, PowerOff, Monitor, Eye, Copy, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { outletService } from "@/lib/services/outletService"
import { useToast } from "@/components/ui/use-toast"
import { AddEditOutletModal } from "@/components/modals/add-edit-outlet-modal"
import { useBusinessStore } from "@/stores/businessStore"

interface OutletListProps {
  onOutletUpdated?: () => void
}

export function OutletList(props: OutletListProps = {}) {
  const { onOutletUpdated } = props
  const { outlets, currentOutlet, switchOutlet, setOutlets, setCurrentOutlet } = useTenant()
  const { loadOutlets } = useBusinessStore()
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  const router = useRouter()
  const [editingOutlet, setEditingOutlet] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSwitching, setIsSwitching] = useState<string | null>(null)

  const handleEdit = (outlet: any) => {
    setEditingOutlet(outlet)
    setIsEditModalOpen(true)
  }

  const handleOutletUpdated = async () => {
    setIsEditModalOpen(false)
    setEditingOutlet(null)
    
    // Reload outlets from business store
    if (loadOutlets && currentBusiness?.id) {
      await loadOutlets(currentBusiness.id)
      
      // Update tenant context outlets from business store
      const updatedOutlets = useBusinessStore.getState().outlets
      const transformedOutlets = updatedOutlets.map((o: any) => ({
        id: o.id,
        tenantId: o.businessId,
        name: o.name,
        address: o.address || "",
        phone: o.phone || "",
        email: o.email || "",
        isActive: o.isActive,
        settings: o.settings || {},
      }))
      setOutlets(transformedOutlets)
    }
    
    // Trigger refresh event for other components
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("outlets-updated"))
    }
    
    // Force router refresh to update all components
    router.refresh()
    
    if (onOutletUpdated) {
      onOutletUpdated()
    }
    
    toast({
      title: "Success",
      description: "Outlet updated successfully. Changes are now visible.",
    })
  }

  const handleToggleStatus = async (outlet: any) => {
    setIsTogglingStatus(outlet.id)
    try {
      const updatedOutlet = await outletService.update(outlet.id, {
        isActive: !outlet.isActive,
      })
      
      // Reload outlets from business store
      if (loadOutlets && currentBusiness?.id) {
        await loadOutlets(currentBusiness.id)
      }
      
      // Update tenant context outlets from business store
      const updatedOutlets = useBusinessStore.getState().outlets
      const transformedOutlets = updatedOutlets.map((o: any) => ({
        id: o.id,
        tenantId: o.businessId,
        name: o.name,
        address: o.address || "",
        phone: o.phone || "",
        email: o.email || "",
        isActive: o.isActive,
        settings: o.settings || {},
      }))
      setOutlets(transformedOutlets)
      
      // Update current outlet if this is the current outlet
      if (currentOutlet?.id === outlet.id) {
        const updatedCurrentOutlet = transformedOutlets.find((o: any) => o.id === outlet.id)
        if (updatedCurrentOutlet) {
          setCurrentOutlet(updatedCurrentOutlet)
        }
      }
      
      // Trigger refresh event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("outlets-updated"))
      }
      
      // Force router refresh
      router.refresh()
      
      if (onOutletUpdated) {
        onOutletUpdated()
      }
      
      toast({
        title: "Success",
        description: `Outlet ${outlet.isActive ? "deactivated" : "activated"} successfully`,
      })
    } catch (error: any) {
      console.error("Failed to toggle outlet status:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update outlet status",
        variant: "destructive",
      })
    } finally {
      setIsTogglingStatus(null)
    }
  }

  const handleDelete = async (outlet: any) => {
    if (!confirm(`Are you sure you want to delete "${outlet.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(outlet.id)
    try {
      await outletService.delete(outlet.id)
      
      // Reload outlets after deletion
      if (loadOutlets && currentBusiness?.id) {
        await loadOutlets(currentBusiness.id)
      }
      
      if (onOutletUpdated) {
        onOutletUpdated()
      }
      
      toast({
        title: "Success",
        description: `Outlet "${outlet.name}" has been deleted successfully`,
      })
    } catch (error: any) {
      console.error("Failed to delete outlet:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete outlet",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSwitchOutlet = async (outlet: any) => {
    setIsSwitching(outlet.id)
    try {
      await switchOutlet(String(outlet.id))
      toast({
        title: "Success",
        description: `Switched to ${outlet.name}`,
      })
      // Refresh outlet list to show updated current outlet badge
      if (loadOutlets && currentBusiness?.id) {
        await loadOutlets(currentBusiness.id)
      }
      // Refresh the page to update all components
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Outlets</CardTitle>
          <CardDescription>View and manage all your business outlets</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outlet Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outlets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No outlets found. Create your first outlet to get started.
                  </TableCell>
                </TableRow>
              ) : (
                outlets.map((outlet) => (
                  <TableRow key={outlet.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">{outlet.name}</div>
                          {currentOutlet?.id === outlet.id && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Current
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="max-w-[200px] truncate">{outlet.address || "No address"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {outlet.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{outlet.phone}</span>
                          </div>
                        )}
                        {outlet.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="max-w-[150px] truncate">{outlet.email}</span>
                          </div>
                        )}
                        {!outlet.phone && !outlet.email && (
                          <span className="text-muted-foreground text-xs">No contact info</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={outlet.isActive ? "default" : "secondary"}
                        className={
                          outlet.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200"
                        }
                      >
                        {outlet.isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {/* View Button */}
                        <Link href={`/dashboard/office/outlets/${outlet.id}/analytics`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            title="View Outlet Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>

                        {/* Switch Outlet Button - Only show if not current outlet */}
                        {currentOutlet?.id !== outlet.id && outlet.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSwitchOutlet(outlet)}
                            disabled={isSwitching === outlet.id}
                            title="Switch to This Outlet"
                            className="h-8"
                          >
                            {isSwitching === outlet.id ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Switching...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                Switch
                              </>
                            )}
                          </Button>
                        )}

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(outlet)}
                          disabled={isDeleting === outlet.id}
                          title="Delete Outlet"
                        >
                          {isDeleting === outlet.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>

                        {/* More Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/office/outlets/${outlet.id}/settings`} className="flex items-center">
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                              </Link>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/office/outlets/${outlet.id}/tills`} className="flex items-center">
                                <Monitor className="mr-2 h-4 w-4" />
                                Manage Tills
                              </Link>
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => handleEdit(outlet)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Outlet
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(outlet)}
                              disabled={isTogglingStatus === outlet.id}
                            >
                              {outlet.isActive ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isEditModalOpen && editingOutlet && (
        <AddEditOutletModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          outlet={editingOutlet}
          onOutletCreated={handleOutletUpdated}
        />
      )}
    </>
  )
}
