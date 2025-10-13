"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Download,
  Edit,
  FileText,
  Heart,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause
} from "lucide-react"
import { formatCurrency, formatDateISO } from "@/lib/mappers"
import type {
  SlaService,
  SlaIncident,
  SlaMetric,
  SlaConfiguration,
  SlaReport,
  SlaIncidentSeverity,
  SlaIncidentStatus
} from "@/lib/invoice-types"

interface SlaServiceWithDetails extends SlaService {
  incidents: SlaIncident[]
  metrics: SlaMetric[]
  reports: SlaReport[]
}

// Mock data for demonstration
const mockService: SlaServiceWithDetails = {
  id: "1",
  name: "E-commerce Platform Hosting",
  description: "Managed hosting and monitoring for e-commerce platform with 99.9% uptime guarantee",
  clientId: "client-1",
  client: {
    id: "client-1",
    name: "John Smith",
    company: "Tech Retail Ltd",
    email: "john@techretail.com",
    billingAddress: "123 Business St, City, State 12345",
    deliveryAddress: "Same as billing",
    phone: "+27 12 345 6789"
  },
  availabilityTarget: 99.9,
  responseTimeTarget: 30,
  resolutionTimeTarget: 120,
  monthlyServiceFee: 5000,
  isActive: true,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-20T14:22:00Z",
  incidents: [
    {
      id: "inc-1",
      slaServiceId: "1",
      title: "Database connectivity issues",
      description: "Temporary database connection timeout affecting checkout process",
      severity: "medium" as SlaIncidentSeverity,
      status: "resolved" as SlaIncidentStatus,
      startedAt: "2024-01-18T08:15:00Z",
      detectedAt: "2024-01-18T08:20:00Z",
      resolvedAt: "2024-01-18T09:45:00Z",
      assignedTo: "tech-1",
      affectedUsers: 150,
      estimatedRevenueImpact: 2500,
      createdAt: "2024-01-18T08:20:00Z",
      updatedAt: "2024-01-18T09:45:00Z"
    },
    {
      id: "inc-2",
      slaServiceId: "1",
      title: "SSL certificate renewal",
      description: "Scheduled SSL certificate renewal causing brief service interruption",
      severity: "low" as SlaIncidentSeverity,
      status: "resolved" as SlaIncidentStatus,
      startedAt: "2024-01-16T02:00:00Z",
      detectedAt: "2024-01-16T02:05:00Z",
      resolvedAt: "2024-01-16T02:15:00Z",
      assignedTo: "tech-2",
      affectedUsers: 0,
      estimatedRevenueImpact: 0,
      createdAt: "2024-01-16T02:05:00Z",
      updatedAt: "2024-01-16T02:15:00Z"
    }
  ],
  metrics: [
    {
      id: "metric-1",
      slaServiceId: "1",
      metricType: "availability" as any,
      recordedAt: "2024-01-20T12:00:00Z",
      value: 99.95,
      unit: "%",
      totalChecks: 2880,
      successfulChecks: 2878,
      failedChecks: 2,
      monitoringSource: "uptime-robot",
      notes: "Excellent performance",
      createdAt: "2024-01-20T12:00:00Z"
    }
  ],
  reports: [
    {
      id: "report-1",
      slaServiceId: "1",
      reportType: "monthly" as any,
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      availabilityPercentage: 99.95,
      averageResponseTime: 25,
      averageResolutionTime: 95,
      totalIncidents: 2,
      totalDowntimeMinutes: 15,
      slaMet: true,
      serviceCreditEarned: false,
      creditPercentage: 0,
      creditAmount: 0,
      generatedAt: "2024-02-01T10:00:00Z",
      processedForBilling: false,
      processedAt: null,
      slaBreachDetails: {} as Record<string, unknown>
    }
  ]
}

const mockConfiguration: SlaConfiguration = {
  id: "config-1",
  slaServiceId: "1",
  creditTiers: [
    { threshold: 99.5, credit: 10 },
    { threshold: 99.0, credit: 25 },
    { threshold: 98.0, credit: 50 },
    { threshold: 95.0, credit: 100 }
  ],
  checkIntervalSeconds: 300,
  alertThresholds: {
    responseTimeWarning: 60,
    responseTimeCritical: 120,
    resolutionTimeWarning: 240,
    resolutionTimeCritical: 480
  } as Record<string, number>,
  businessHoursOnly: false,
  excludeMaintenanceWindows: true,
  maintenanceWindows: [
    {
      start: "2024-01-21T02:00:00Z",
      end: "2024-01-21T04:00:00Z",
      description: "Scheduled maintenance window"
    }
  ],
  notificationEmails: ["support@company.com", "alerts@company.com"],
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-20T14:22:00Z"
}

export default function SlaServiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [service, setService] = useState<SlaServiceWithDetails | null>(null)
  const [configuration] = useState<SlaConfiguration | null>(mockConfiguration)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    const loadService = async () => {
      if (!params.id) return

      try {
        // For now, use mock data. In production, this would fetch from API
        // const fetchedService = await fetchSlaServiceById(params.id as string)
        // const incidents = await fetchSlaIncidents(params.id as string)
        // const metrics = await fetchSlaMetrics(params.id as string)
        // const reports = await fetchSlaReports(params.id as string)

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        setService(mockService)
      } catch (error) {
        console.error("Failed to load SLA service:", error)
        router.push("/sla")
      } finally {
        setLoading(false)
      }
    }

    loadService()
  }, [params.id, router])

  const getSeverityColor = (severity: SlaIncidentSeverity) => {
    switch (severity) {
      case "critical": return "destructive"
      case "high": return "destructive"
      case "medium": return "default"
      case "low": return "secondary"
      default: return "secondary"
    }
  }

  const getStatusColor = (status: SlaIncidentStatus) => {
    switch (status) {
      case "open": return "destructive"
      case "investigating": return "default"
      case "resolved": return "default"
      case "closed": return "secondary"
      default: return "secondary"
    }
  }

  const getStatusIcon = (status: SlaIncidentStatus) => {
    switch (status) {
      case "open": return <XCircle className="h-4 w-4" />
      case "investigating": return <AlertCircle className="h-4 w-4" />
      case "resolved": return <CheckCircle className="h-4 w-4" />
      case "closed": return <CheckCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const calculateCurrentAvailability = () => {
    if (!service || service.metrics.length === 0) return service?.availabilityTarget || 0
    const latestMetric = service.metrics[0]
    return latestMetric.value
  }

  const calculateSlaStatus = () => {
    const current = calculateCurrentAvailability()
    const target = service?.availabilityTarget || 0
    return current >= target
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">SLA Service not found</h1>
          <p className="text-muted-foreground">The service you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  const slaMet = calculateSlaStatus()
  const currentAvailability = calculateCurrentAvailability()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
            <p className="text-muted-foreground mt-1">{service.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Service
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Incident
            </Button>
          </div>
        </div>

        {/* Service Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Client</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{service.client?.company}</div>
              <p className="text-xs text-muted-foreground mt-1">{service.client?.name}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Service Status</CardTitle>
              {service.isActive ? (
                <Play className="h-4 w-4 text-green-600" />
              ) : (
                <Pause className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={service.isActive ? "default" : "destructive"}>
                  {service.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Monthly fee: {formatCurrency(service.monthlyServiceFee)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Availability</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentAvailability.toFixed(2)}%</div>
              <div className="flex items-center gap-2 mt-2">
                <Progress
                  value={currentAvailability}
                  className="flex-1 h-2"
                  indicatorClassName={slaMet ? "bg-green-500" : "bg-red-500"}
                />
                {slaMet ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Target: {service.availabilityTarget}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SLA Status</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={slaMet ? "default" : "destructive"}>
                  {slaMet ? "SLA Met" : "SLA Breach"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {slaMet ? "Performance within targets" : "Performance below targets"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Service Details</CardTitle>
                  <CardDescription>Basic information about this SLA service</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Service Name</p>
                      <p className="font-medium">{service.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created</p>
                      <p className="font-medium">{formatDateISO(service.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Availability Target</p>
                      <p className="font-medium">{service.availabilityTarget}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Fee</p>
                      <p className="font-medium">{formatCurrency(service.monthlyServiceFee)}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                    <p className="text-sm">{service.description}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {currentAvailability.toFixed(2)}%
                      </div>
                      <p className="text-sm text-muted-foreground">Current Availability</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {service.responseTimeTarget || 30}min
                      </div>
                      <p className="text-sm text-muted-foreground">Response Time Target</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {service.resolutionTimeTarget || 120}min
                      </div>
                      <p className="text-sm text-muted-foreground">Resolution Time Target</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {service.incidents.length}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Incidents</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Incidents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Incidents</CardTitle>
                    <CardDescription>Latest incidents for this service</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    View All Incidents
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {service.incidents.slice(0, 3).map((incident) => (
                    <div key={incident.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getStatusIcon(incident.status)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{incident.title}</h4>
                            <Badge variant={getSeverityColor(incident.severity)}>
                              {incident.severity}
                            </Badge>
                            <Badge variant={getStatusColor(incident.status)}>
                              {incident.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {incident.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Started: {formatDateISO(incident.startedAt)}</span>
                            {incident.resolvedAt && (
                              <span>Resolved: {formatDateISO(incident.resolvedAt)}</span>
                            )}
                            <span>Affected: {incident.affectedUsers} users</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {service.incidents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <p>No incidents reported</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Availability Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Availability Trends</CardTitle>
                  <CardDescription>Service availability over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">Availability chart will be displayed here</p>
                      <p className="text-sm text-muted-foreground">Integrate with charting library</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Response Time Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Response Time Metrics</CardTitle>
                  <CardDescription>Average response times over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium">Current Response Time</p>
                          <p className="text-sm text-muted-foreground">Last 24 hours average</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">25min</div>
                        <p className="text-sm text-muted-foreground">Target: {service.responseTimeTarget || 30}min</p>
                      </div>
                    </div>
                    <div className="h-32 flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Response time chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resolution Time Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Resolution Time Metrics</CardTitle>
                  <CardDescription>Average incident resolution times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="font-medium">Current Resolution Time</p>
                          <p className="text-sm text-muted-foreground">Last 30 days average</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">95min</div>
                        <p className="text-sm text-muted-foreground">Target: {service.resolutionTimeTarget || 120}min</p>
                      </div>
                    </div>
                    <div className="h-32 flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Resolution time chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Health Indicators */}
              <Card>
                <CardHeader>
                  <CardTitle>Health Indicators</CardTitle>
                  <CardDescription>Current service health status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Heart className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Service Health</span>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Healthy
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Monitoring Status</span>
                      </div>
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="font-medium">Active Alerts</span>
                      </div>
                      <Badge variant="default" className="bg-orange-100 text-orange-800">
                        2 Warnings
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Incident Management</h3>
                <p className="text-sm text-muted-foreground">Track and manage service incidents</p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Incident
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Incident Stats */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Incident Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {service.incidents.filter(i => i.status === "open").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Open Incidents</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {service.incidents.filter(i => i.status === "investigating").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Investigating</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {service.incidents.filter(i => i.status === "resolved").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                  </div>
                </CardContent>
              </Card>

              {/* Incidents List */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>All Incidents</CardTitle>
                  <CardDescription>Complete incident history for this service</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {service.incidents.map((incident) => (
                        <div key={incident.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(incident.status)}
                              <h4 className="font-medium">{incident.title}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getSeverityColor(incident.severity)}>
                                {incident.severity}
                              </Badge>
                              <Badge variant={getStatusColor(incident.status)}>
                                {incident.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {incident.description}
                          </p>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium">Started:</span> {formatDateISO(incident.startedAt)}
                            </div>
                            {incident.resolvedAt && (
                              <div>
                                <span className="font-medium">Resolved:</span> {formatDateISO(incident.resolvedAt)}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Affected Users:</span> {incident.affectedUsers}
                            </div>
                            <div>
                              <span className="font-medium">Revenue Impact:</span> {formatCurrency(incident.estimatedRevenueImpact)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Button variant="outline" size="sm">View Details</Button>
                            {incident.status !== "resolved" && incident.status !== "closed" && (
                              <Button variant="outline" size="sm">Update Status</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Service Configuration</h3>
                <p className="text-sm text-muted-foreground">Manage SLA settings and thresholds</p>
              </div>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Edit Configuration
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Credit Tiers */}
              <Card>
                <CardHeader>
                  <CardTitle>Credit Tiers</CardTitle>
                  <CardDescription>Service credit based on availability levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {configuration?.creditTiers.map((tier, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">Below {tier.threshold}%</p>
                          <p className="text-sm text-muted-foreground">Service credit</p>
                        </div>
                        <Badge variant="outline">{tier.credit}%</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monitoring Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Monitoring Settings</CardTitle>
                  <CardDescription>Service monitoring configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Check Interval</span>
                      <span className="text-sm">{configuration?.checkIntervalSeconds}s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Business Hours Only</span>
                      <Badge variant={configuration?.businessHoursOnly ? "default" : "secondary"}>
                        {configuration?.businessHoursOnly ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Exclude Maintenance</span>
                      <Badge variant={configuration?.excludeMaintenanceWindows ? "default" : "secondary"}>
                        {configuration?.excludeMaintenanceWindows ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alert Thresholds */}
              <Card>
                <CardHeader>
                  <CardTitle>Alert Thresholds</CardTitle>
                  <CardDescription>Configure when alerts are triggered</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Response Time Warning</span>
                      <span className="text-sm">{configuration?.alertThresholds.responseTimeWarning}min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Response Time Critical</span>
                      <span className="text-sm">{configuration?.alertThresholds.responseTimeCritical}min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Resolution Time Warning</span>
                      <span className="text-sm">{configuration?.alertThresholds.resolutionTimeWarning}min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Resolution Time Critical</span>
                      <span className="text-sm">{configuration?.alertThresholds.resolutionTimeCritical}min</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Configure alert notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Notification Emails</p>
                      <div className="space-y-2">
                        {configuration?.notificationEmails.map((email, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <span className="text-sm">{email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">SLA Reports</h3>
                <p className="text-sm text-muted-foreground">Generate and view SLA performance reports</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Reports
                </Button>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Report Generation */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Generate Report</CardTitle>
                  <CardDescription>Create a new SLA report</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      Daily Report
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Weekly Report
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Monthly Report
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Quarterly Report
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Custom Period
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Reports */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Reports</CardTitle>
                  <CardDescription>Generated SLA performance reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {service.reports.map((report) => (
                      <div key={report.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium capitalize">{report.reportType} Report</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatDateISO(report.periodStart)} - {formatDateISO(report.periodEnd)}
                            </p>
                          </div>
                          <Badge variant={report.slaMet ? "default" : "destructive"}>
                            {report.slaMet ? "SLA Met" : "SLA Breach"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Availability:</span>
                            <span className="ml-1 font-medium">{report.availabilityPercentage}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Incidents:</span>
                            <span className="ml-1 font-medium">{report.totalIncidents}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Downtime:</span>
                            <span className="ml-1 font-medium">{report.totalDowntimeMinutes}min</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Credit:</span>
                            <span className="ml-1 font-medium">
                              {report.serviceCreditEarned ? `${report.creditPercentage}%` : "None"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button variant="outline" size="sm">View Report</Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}