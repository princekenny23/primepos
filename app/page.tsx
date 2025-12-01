import { PublicLayout } from "@/components/layouts/public-layout"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Multi-Business Point of Sale Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            PrimePOS is a comprehensive SaaS solution designed to serve any business type - 
            from retail stores to restaurants, pharmacies to wholesale operations.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Multi-tenant architecture",
              "Real-time inventory management",
              "Comprehensive sales tracking",
              "Multi-outlet support",
              "Advanced reporting & analytics",
              "Customer relationship management",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of businesses using PrimePOS to manage their operations.
          </p>
          <Link href="/auth/register">
            <Button size="lg">Start Free Trial</Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
