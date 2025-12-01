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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageSquare, Send } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ReplyToSupportTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket?: any
}

export function ReplyToSupportTicketModal({ open, onOpenChange, ticket }: ReplyToSupportTicketModalProps) {
  const { toast } = useToast()
  const [isSending, setIsSending] = useState(false)
  const [reply, setReply] = useState("")
  const [status, setStatus] = useState<string>("")

  if (!ticket) return null

  // Mock conversation history
  const conversation = [
    {
      id: "1",
      sender: ticket.tenant,
      message: "I'm having trouble with payment processing. Can you help?",
      timestamp: "2024-01-15T10:30:00",
      type: "tenant",
    },
    {
      id: "2",
      sender: "Support Team",
      message: "We're looking into this issue. Can you provide more details?",
      timestamp: "2024-01-15T11:00:00",
      type: "admin",
    },
  ]

  const handleSendReply = async () => {
    if (!reply.trim()) {
      toast({
        title: "Reply Required",
        description: "Please enter a reply message.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)

    // In production, this would call API
    setTimeout(() => {
      setIsSending(false)
      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully.",
      })
      setReply("")
      setStatus("")
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reply to Ticket - {ticket.ticketNumber}
          </DialogTitle>
          <DialogDescription>
            {ticket.subject} • {ticket.tenant}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Conversation History */}
          <div className="space-y-2">
            <Label>Conversation History</Label>
            <ScrollArea className="h-[300px] border rounded-lg p-4">
              <div className="space-y-4">
                {conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.type === "admin"
                        ? "bg-blue-50 dark:bg-blue-950 ml-8"
                        : "bg-gray-50 dark:bg-gray-950 mr-8"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{msg.sender}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Reply Section */}
          <div className="space-y-2">
            <Label htmlFor="reply">Your Reply *</Label>
            <Textarea
              id="reply"
              placeholder="Type your reply here..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              required
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Update Status (Optional)</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendReply} disabled={isSending || !reply.trim()}>
            {isSending ? "Sending..." : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Reply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

