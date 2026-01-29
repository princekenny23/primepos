"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Upload, Image as ImageIcon } from "lucide-react"

interface LogoUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  currentLogo?: string
  onSuccess?: (logoUrl: string) => void
}

export function LogoUploadModal({
  open,
  onOpenChange,
  tenantId,
  currentLogo,
  onSuccess,
}: LogoUploadModalProps) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(currentLogo || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(selectedFile.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PNG, JPG, or WebP image",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    setFile(selectedFile)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      // Get authentication token
      const token = localStorage.getItem("authToken")
      if (!token) {
        throw new Error("Authentication required. Please log in again.")
      }

      // Get API base URL
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

      // Upload logo to tenants upload-logo endpoint
      const response = await fetch(`${API_BASE_URL}/tenants/upload-logo/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to upload logo")
      }

      const data = await response.json()

      toast({
        title: "Logo Uploaded",
        description: "Your business logo has been updated successfully.",
      })

      onSuccess?.(data.logo)
      onOpenChange(false)
      setFile(null)
      setPreview(null)
    } catch (error: any) {
      console.error("Failed to upload logo:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      onOpenChange(false)
      setFile(null)
      setPreview(currentLogo || null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Upload Business Logo
          </DialogTitle>
          <DialogDescription>
            Upload your business logo. Recommended size: 200x200px
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt="Logo preview"
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No logo selected</p>
              </div>
            )}
          </div>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            aria-label="Upload business logo image"
            title="Upload business logo image (PNG, JPEG, WebP)"
            className="hidden"
          />

          {/* Upload Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {file ? "Change Logo" : "Select Logo"}
          </Button>

          {/* File Info */}
          {file && (
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
              <p>
                <span className="font-medium">File:</span> {file.name}
              </p>
              <p>
                <span className="font-medium">Size:</span> {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
            <p className="font-medium text-blue-900 mb-1">Recommended specs:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Format: PNG, JPG, or WebP</li>
              <li>Size: 200x200px or larger</li>
              <li>Max file size: 5MB</li>
              <li>Square aspect ratio recommended</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="bg-blue-900 hover:bg-blue-800"
          >
            {isUploading ? "Uploading..." : "Upload Logo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
