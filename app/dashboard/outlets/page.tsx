import { DashboardLayout } from "@/components/layouts/dashboard-layout"
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
import { Plus, Store, MapPin, Phone, Mail, Edit, Trash2, Settings, BarChart3 } from "lucide-react"
import Link from "next/link"
import { OutletList } from "@/components/outlets/outlet-list"

export default function OutletsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Outlets</h1>
            <p className="text-muted-foreground">Manage your business locations and outlets</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Outlet
          </Button>
        </div>

        <OutletList />
      </div>
    </DashboardLayout>
  )
}
