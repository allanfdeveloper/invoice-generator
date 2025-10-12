import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">SLA Service Not Found</CardTitle>
          <CardDescription>
            The SLA service you're looking for doesn't exist or has been removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/sla" className="w-full">
            <Button className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to SLA Services
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full">
            <Button variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}