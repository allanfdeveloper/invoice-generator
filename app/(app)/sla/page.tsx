"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useTransition, Suspense } from "react"
import { m } from "@/components/ui/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Search, Plus, Activity, AlertTriangle, CheckCircle, TrendingUp, Eye, Settings } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { InlineSpinner } from "@/components/ui/inline-spinner"
import {
  fetchClients,
  fetchCompanySettings,
  fetchSlaServices,
  fetchSlaIncidents,
  formatCurrency
} from "@/lib/mappers"
import type { Client, CompanySettings, SlaService, SlaIncident } from "@/lib/invoice-types"
import { IncidentSeverity, IncidentStatus } from "@/lib/invoice-types"
import { useRouter } from "next/navigation"

// Summary statistics interface
interface SlaSummaryStats {
  totalServices: number
  activeServices: number
  activeIncidents: number
  criticalIncidents: number
  averageAvailability: number
  monthlyRevenue: number
}

export default function SlaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [slaServices, setSlaServices] = useState<SlaService[]>([])
  const [incidents, setIncidents] = useState<SlaIncident[]>([])

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [client, setClient] = useState<string>("all")
  const [isPending, startUiTransition] = useTransition()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [s, cs, ss, inc] = await Promise.all([
          fetchCompanySettings(),
          fetchClients(),
          fetchSlaServices(),
          fetchSlaIncidents()
        ])
        if (!mounted) return
        console.log("Debug - fetched SLA data:", { settings: s, clients: cs, services: ss, incidents: inc })
        setSettings(s)
        setClients(cs)
        setSlaServices(ss)
        setIncidents(inc)
      } catch (e) {
        console.error("Error loading SLA data:", e)
        toast.error("Failed to load SLA services")
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Calculate summary statistics
  const summaryStats = useMemo((): SlaSummaryStats => {
    const activeServices = slaServices.filter(s => s.isActive).length
    const activeIncidents = incidents.filter(i => i.status === IncidentStatus.Open || i.status === IncidentStatus.Investigating).length
    const criticalIncidents = incidents.filter(i =>
      (i.status === IncidentStatus.Open || i.status === IncidentStatus.Investigating) &&
      i.severity === IncidentSeverity.Critical
    ).length

    // Calculate average availability (mock calculation for now)
    const averageAvailability = slaServices.length > 0
      ? slaServices.reduce((sum, service) => sum + service.availabilityTarget, 0) / slaServices.length
      : 0

    // Calculate monthly revenue from SLA services
    const monthlyRevenue = slaServices.reduce((sum, service) => sum + service.monthlyServiceFee, 0)

    return {
      totalServices: slaServices.length,
      activeServices,
      activeIncidents,
      criticalIncidents,
      averageAvailability,
      monthlyRevenue
    }
  }, [slaServices, incidents])

  // Filter SLA services based on search and filters
  const filtered = useMemo(() => {
    return slaServices.filter((service) => {
      const clientObj = clients.find((c) => c.id === service.clientId)
      const text = `${service.name} ${service.description ?? ""} ${clientObj?.company ?? ""}`.toLowerCase()
      const matchesQuery = text.includes(query.toLowerCase())
      const matchesStatus = status === "all" ? true :
        status === "active" ? service.isActive : !service.isActive
      const matchesClient = client === "all" ? true : service.clientId === client

      return matchesQuery && matchesStatus && matchesClient
    })
  }, [slaServices, clients, query, status, client])

  // Get service health status based on recent incidents
  const getServiceHealthStatus = (serviceId: string): "healthy" | "warning" | "critical" => {
    const serviceIncidents = incidents.filter(i => i.slaServiceId === serviceId)
    const openIncidents = serviceIncidents.filter(i =>
      i.status === IncidentStatus.Open || i.status === IncidentStatus.Investigating
    )

    if (openIncidents.some(i => i.severity === IncidentSeverity.Critical)) {
      return "critical"
    } else if (openIncidents.length > 0) {
      return "warning"
    } else {
      return "healthy"
    }
  }

  const getStatusBadgeVariant = (status: "healthy" | "warning" | "critical") => {
    switch (status) {
      case "healthy":
        return "default" as const
      case "warning":
        return "secondary" as const
      case "critical":
        return "destructive" as const
    }
  }

  const getStatusIcon = (status: "healthy" | "warning" | "critical") => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4" />
      case "warning":
        return <AlertTriangle className="w-4 h-4" />
      case "critical":
        return <Activity className="w-4 h-4" />
    }
  }

  const handleNewService = () => {
    router.push("/sla/new")
  }

  const handleViewService = (service: SlaService) => {
    router.push(`/sla/${service.id}`)
  }

  const handleEditService = (service: SlaService) => {
    router.push(`/sla/${service.id}/edit`)
  }

  const handleViewIncidents = (service: SlaService) => {
    router.push(`/sla/${service.id}/incidents`)
  }

  return (
    <m.div
      className="space-y-6"
      initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SLA Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage Service Level Agreement compliance
          </p>
        </div>
        <m.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
          <Button onClick={handleNewService}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New SLA Service
          </Button>
        </m.div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalServices}</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats.activeServices} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summaryStats.activeIncidents}</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats.criticalIncidents} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Availability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.averageAvailability.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Target across all services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summaryStats.monthlyRevenue, settings?.currency ?? "ZAR")}
            </div>
            <p className="text-xs text-muted-foreground">
              From SLA services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main SLA Services Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>SLA Services</CardTitle>
          <CardDescription>Monitor service availability and compliance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search SLA services"
                placeholder="Search by service name or client"
                className="pl-8 pr-8 transition-[border-color,box-shadow] duration-150"
                value={query}
                onChange={(e) =>
                  startUiTransition(() => {
                    setQuery(e.target.value)
                  })
                }
              />
              <div className="absolute right-2.5 top-2.5 text-muted-foreground">
                <AnimatePresence>{isPending && <InlineSpinner size={14} />}</AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="sr-only">
                Status filter
              </label>
              <Select
                value={status}
                onValueChange={(v) =>
                  startUiTransition(() => {
                    setStatus(v as "all" | "active" | "inactive")
                  })
                }
              >
                <SelectTrigger id="status-filter" className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="client-filter" className="sr-only">
                Client filter
              </label>
              <Select
                value={client}
                onValueChange={(v) =>
                  startUiTransition(() => {
                    setClient(v)
                  })
                }
              >
                <SelectTrigger id="client-filter" className="w-44">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grow" />
          </div>

          <Separator />

          {/* Services Table */}
          <Suspense fallback={<div className="rounded-md border p-6 text-sm text-muted-foreground">Loading…</div>}>
            <ResponsiveTable
              headers={["Service Name", "Client", "Availability Target", "Monthly Fee", "Health", "Status", "Actions"]}
              data={filtered.map((service) => {
                const clientObj = clients.find((c) => c.id === service.clientId)
                const healthStatus = getServiceHealthStatus(service.id)

                return {
                  id: service.id,
                  cells: [
                    <div key="name" className="space-y-1">
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {service.description}
                        </div>
                      )}
                    </div>,
                    <span key="client">{clientObj?.company ?? "—"}</span>,
                    <div key="availability" className="flex items-center gap-2">
                      <span className="font-mono">{service.availabilityTarget}%</span>
                      {service.responseTimeTarget && (
                        <span className="text-xs text-muted-foreground">
                          / {service.responseTimeTarget}m
                        </span>
                      )}
                    </div>,
                    <span key="fee" className="font-mono">
                      {formatCurrency(service.monthlyServiceFee, settings?.currency ?? "ZAR")}
                    </span>,
                    <Badge key="health" variant={getStatusBadgeVariant(healthStatus)} className="capitalize">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(healthStatus)}
                        {healthStatus}
                      </div>
                    </Badge>,
                    <Badge key="status" variant={service.isActive ? "default" : "secondary"} className="capitalize">
                      {service.isActive ? "Active" : "Inactive"}
                    </Badge>,
                    <div key="actions" className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewService(service)}
                        title="View Service"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewIncidents(service)}
                        title="View Incidents"
                      >
                        <Activity className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditService(service)}
                        title="Edit Service"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  ]
                }
              })}
              loading={loading}
              emptyMessage="No SLA services found"
            />
          </Suspense>
        </CardContent>
      </Card>
    </m.div>
  )
}