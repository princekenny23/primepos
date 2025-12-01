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
import { Upload, FileText, Download } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface ImportProductsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportProductsModal({ open, onOpenChange }: ImportProductsModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to import.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // In production, this would upload and process the CSV file
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Import Successful",
        description: "Products have been imported successfully.",
      })
      setFile(null)
      onOpenChange(false)
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple products at once
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>CSV File</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {file ? file.name : "No file selected"}
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <Label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>Choose File</span>
                </Button>
              </Label>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm space-y-1">
                <p className="font-medium">CSV Format Requirements:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Columns: Name, SKU, Category, Cost, Price, Stock, Barcode</li>
                  <li>First row should contain headers</li>
                  <li>Maximum 1000 products per import</li>
                </ul>
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Download Sample CSV Template
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? "Importing..." : "Import Products"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

