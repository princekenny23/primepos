import { PublicLayout } from "@/components/layouts/public-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-6 text-center">About PrimePOS</h1>
          <p className="text-xl text-muted-foreground mb-12 text-center">
            Empowering businesses of all types with a comprehensive point-of-sale solution
          </p>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Our Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  PrimePOS was built with the vision of providing a unified, scalable point-of-sale 
                  platform that can adapt to any business type. Whether you run a retail store, 
                  restaurant, pharmacy, or wholesale operation, PrimePOS has the tools you need 
                  to manage your business efficiently.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Why PrimePOS?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-muted-foreground">
                  <li>• Multi-tenant architecture for scalability</li>
                  <li>• Flexible design that adapts to your business needs</li>
                  <li>• Comprehensive feature set covering all aspects of POS operations</li>
                  <li>• Modern, intuitive user interface</li>
                  <li>• Built with future extensibility in mind</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Our Technology</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  PrimePOS is built on modern web technologies including Next.js, TypeScript, 
                  and Tailwind CSS. Our architecture is designed for performance, scalability, 
                  and maintainability, ensuring your business can grow without limitations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}

