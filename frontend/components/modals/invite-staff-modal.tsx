"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface InviteStaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteStaffModal({ open, onOpenChange }: InviteStaffModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // In production, this would call API to send invitation
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Invitation Sent",
        description: "Staff member invitation has been sent successfully.",
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Send an invitation to a new staff member to join your team. Role permissions and outlet access are assigned after the account exists.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleInvite}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="staff@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input 
                id="name" 
                type="text" 
                placeholder="John Doe"
                required
              />
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              After the invited user accepts, assign their staff role and outlet access from the Staff tab so permissions come from your configured roles.
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

