"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, Upload } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { PreviewReceiptModal } from "@/components/modals/preview-receipt-modal"

export function ReceiptTemplateTab() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [includeLogo, setIncludeLogo] = useState(true)
  const [includeFooter, setIncludeFooter] = useState(true)

  const handleSave = async () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Settings Saved",
        description: "Receipt template has been updated successfully.",
      })
    }, 1000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt Template</CardTitle>
        <CardDescription>Customize your receipt layout and content</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-logo"
              checked={includeLogo}
              onCheckedChange={(checked) => setIncludeLogo(checked as boolean)}
            />
            <Label htmlFor="include-logo" className="cursor-pointer">
              Include Business Logo
            </Label>
          </div>
          {includeLogo && (
            <div className="ml-6 space-y-2">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="header-text">Header Text</Label>
          <Input id="header-text" defaultValue="Thank you for your purchase!" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-footer"
              checked={includeFooter}
              onCheckedChange={(checked) => setIncludeFooter(checked as boolean)}
            />
            <Label htmlFor="include-footer" className="cursor-pointer">
              Include Footer Note
            </Label>
          </div>
          {includeFooter && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="footer-text">Footer Text</Label>
              <Textarea
                id="footer-text"
                defaultValue="Visit us again! For inquiries, contact us at contact@primex.com"
                className="min-h-[100px]"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="receipt-width">Receipt Width (mm)</Label>
          <Input id="receipt-width" type="number" defaultValue="80" />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview Receipt
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>

      <PreviewReceiptModal
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </Card>
  )
}

