import { redirect } from "next/navigation"

// Add New Load is now a floating modal in the dispatcher layout.
// Redirect any direct navigation here back to dispatcher.
export default function NewLoadPage() {
  redirect("/dashboard/dispatcher")
}
