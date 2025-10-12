"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { m } from "@/components/ui/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { ArrowLeft, Save } from "lucide-react"
import { fetchClients } from "@/lib/mappers"
import type { Client } from "@/lib/invoice-types"
import { useRouter } from "next/navigation"

export default function NewSlaServicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    clientId: "",
    availabilityTarget: 99.9,
    responseTimeTarget: "",
    resolutionTimeTarget: "",
    monthlyServiceFee: "",
    isActive: true
  })

  useEffect(() => {
    const loadClients = async () => {
      try {
        const clientData = await fetchClients()
        setClients(clientData)
      } catch (error) {
        console.error("Error loading clients:", error)
        toast.error("Failed to load clients")
      }
    }
    loadClients()
  }, [])

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.clientId) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/sla/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          responseTimeTarget: formData.responseTimeTarget ? Number(formData.responseTimeTarget) : null,
          resolutionTimeTarget: formData.resolutionTimeTarget ? Number(formData.resolutionTimeTarget) : null,
          monthlyServiceFee: Number(formData.monthlyServiceFee),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create SLA service")
      }

      const result = await response.json()
      toast.success("SLA service created successfully")
      router.push(`/sla/${result.data.id}`)
    } catch (error) {
      console.error("Error creating SLA service:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create SLA service")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <m.div
      className="space-y-6"
      initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={handleCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New SLA Service</h1>
          <p className="text-muted-foreground">
            Create a new Service Level Agreement
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
          <CardDescription>
            Configure the basic information and performance targets for this SLA service.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Web Hosting Service"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) => handleInputChange("clientId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe the service and what it includes..."
                rows={3}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Performance Targets</h3>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="availability">Availability Target (%)</Label>
                  <Input
                    id="availability"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.availabilityTarget}
                    onChange={(e) => handleInputChange("availabilityTarget", parseFloat(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responseTime">Response Time (minutes)</Label>
                  <Input
                    id="responseTime"
                    type="number"
                    min="0"
                    value={formData.responseTimeTarget}
                    onChange={(e) => handleInputChange("responseTimeTarget", e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resolutionTime">Resolution Time (minutes)</Label>
                  <Input
                    id="resolutionTime"
                    type="number"
                    min="0"
                    value={formData.resolutionTimeTarget}
                    onChange={(e) => handleInputChange("resolutionTimeTarget", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthlyFee">Monthly Service Fee</Label>
                <Input
                  id="monthlyFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthlyServiceFee}
                  onChange={(e) => handleInputChange("monthlyServiceFee", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange("isActive", checked)}
                />
                <Label htmlFor="isActive">Service is active</Label>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Creating..." : "Create Service"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </m.div>
  )
}