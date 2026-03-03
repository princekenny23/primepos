import { redirect } from "next/navigation"

export default function DriverDashboardPage() {
  redirect("/dashboard/distribution/active-trips")
}
