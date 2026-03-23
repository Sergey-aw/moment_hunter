import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export function LicensePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>License Agreement</CardTitle>
          <CardDescription>Basic terms for using Moment Hunter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <p>By using this app, you agree to use it lawfully and not abuse platform features, APIs, or scoring systems.</p>
          <p>This product is provided as-is for gameplay and testing. Availability and features may change without notice.</p>
          <p>Your account may be restricted for behavior that harms fairness, security, or other users.</p>
          <p>Contact support if you believe your account or data was affected in error.</p>
        </CardContent>
      </Card>
    </main>
  )
}
