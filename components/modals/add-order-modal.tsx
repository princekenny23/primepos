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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Minus, X } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface AddOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddOrderModal({ open, onOpenChange }: AddOrderModalProps) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const [table, setTable] = useState<string>("")
  const [guests, setGuests] = useState<string>("")
  const [server, setServer] = useState<string>("")
  const [cart, setCart] = useState<any[]>([])

  // Mock menu items
  const menuItems = [
    { id: "1", name: "Burger", price: 12.99, category: "Main Course" },
    { id: "2", name: "Pizza", price: 15.99, category: "Main Course" },
    { id: "3", name: "Pasta", price: 13.99, category: "Main Course" },
    { id: "4", name: "Salad", price: 8.99, category: "Appetizer" },
    { id: "5", name: "Soup", price: 6.99, category: "Appetizer" },
    { id: "6", name: "Ice Cream", price: 5.99, category: "Dessert" },
  ]

  const addToCart = (item: typeof menuItems[0]) => {
    const existingItem = cart.find(c => c.id === item.id)
    if (existingItem) {
      setCart(cart.map(c =>
        c.id === item.id
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
          : c
      ))
    } else {
      setCart([...cart, { ...item, quantity: 1, total: item.price, notes: "" }])
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQuantity, total: newQuantity * item.price }
      }
      return item
    }))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const handleCreate = async () => {
    if (!table || !guests || cart.length === 0) {
      toast({
        title: "Required Fields",
        description: "Please fill in all required fields and add items to the order.",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    // In production, this would call API
    setTimeout(() => {
      setIsCreating(false)
      toast({
        title: "Order Created",
        description: "Order has been created successfully.",
      })
      setTable("")
      setGuests("")
      setServer("")
      setCart([])
      onOpenChange(false)
    }, 1500)
  }

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
          <DialogDescription>
            Create a new restaurant order
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="table">Table *</Label>
              <Select value={table} onValueChange={setTable} required>
                <SelectTrigger id="table">
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Table 1</SelectItem>
                  <SelectItem value="2">Table 2</SelectItem>
                  <SelectItem value="3">Table 3</SelectItem>
                  <SelectItem value="4">Table 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guests">Number of Guests *</Label>
              <Input
                id="guests"
                type="number"
                min="1"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Select value={server} onValueChange={setServer}>
                <SelectTrigger id="server">
                  <SelectValue placeholder="Select server" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="john">John Waiter</SelectItem>
                  <SelectItem value="jane">Jane Server</SelectItem>
                  <SelectItem value="bob">Bob Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Menu Items */}
            <div className="space-y-2">
              <Label>Menu Items</Label>
              <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart(item)}
                      className="p-2 border rounded-lg text-left hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">${item.price.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart */}
            <div className="space-y-2">
              <Label>Order Items</Label>
              <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No items added yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm">{item.quantity}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            ${item.total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm mb-1">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Tax (10%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !table || !guests || cart.length === 0}>
            {isCreating ? "Creating..." : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

