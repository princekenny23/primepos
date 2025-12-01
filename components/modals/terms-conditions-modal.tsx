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
import { ScrollArea } from "@/components/ui/scroll-area"

interface TermsConditionsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept?: () => void
}

export function TermsConditionsModal({ open, onOpenChange, onAccept }: TermsConditionsModalProps) {
  const handleAccept = () => {
    onAccept?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Terms & Conditions</DialogTitle>
          <DialogDescription>
            Please read and accept our terms and conditions to continue
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4 text-sm text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground mb-2">1. Acceptance of Terms</h3>
              <p>
                By accessing and using PrimePOS, you accept and agree to be bound by the terms and 
                provision of this agreement. If you do not agree to abide by the above, please do 
                not use this service.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">2. Use License</h3>
              <p>
                Permission is granted to temporarily use PrimePOS for personal, non-commercial 
                transitory viewing only. This is the grant of a license, not a transfer of title, 
                and under this license you may not:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose</li>
                <li>Attempt to reverse engineer any software contained in PrimePOS</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">3. Service Availability</h3>
              <p>
                We strive to ensure PrimePOS is available 24/7, but we do not guarantee uninterrupted 
                access. We reserve the right to modify, suspend, or discontinue any part of the 
                service at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">4. Data and Privacy</h3>
              <p>
                Your use of PrimePOS is also governed by our Privacy Policy. Please review our 
                Privacy Policy to understand our practices regarding the collection and use of 
                your personal information.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">5. Payment Terms</h3>
              <p>
                Subscription fees are billed in advance on a monthly or annual basis. All fees 
                are non-refundable except as required by law. You are responsible for any taxes 
                applicable to your use of the service.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">6. Limitation of Liability</h3>
              <p>
                In no event shall PrimePOS or its suppliers be liable for any damages (including, 
                without limitation, damages for loss of data or profit, or due to business 
                interruption) arising out of the use or inability to use PrimePOS.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">7. Contact Information</h3>
              <p>
                If you have any questions about these Terms & Conditions, please contact us at 
                support@primepos.com
              </p>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Decline
          </Button>
          <Button onClick={handleAccept}>
            Accept Terms & Conditions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

