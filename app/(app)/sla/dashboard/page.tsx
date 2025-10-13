"use client"

import * as React from "react"
import { useEffect, useState, useMemo } from "react"
import { m } from "@/components/ui/motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Timer
} from "lucide-react"

import {
  fetchSlaServices,
  fetchSlaIncidents,
  fetchSlaMetrics,
  fetchSlaReports,
  formatDateISO,
  formatCurrency
} from "@/lib/mappers"
import type {
  SlaService,
  SlaIncident,
  SlaMetric,
  SlaReport,
  IncidentSeverity,
  IncidentStatus,
  SlaMetricType
} from "@/lib/invoice-types"

interface DashboardMetrics {
  overallAvailability: number
  totalIncidentsThisMonth: number
  averageResponseTime: number
  servicesWithBreaches: number
  activeServices: number
  totalServices: number
  creditsEarnedThisMonth: number
}

interface ServiceHealth {
  service: SlaService
  currentAvailability: number
  status: 'healthy' | 'warning' | 'critical'
  incidentCount: number
  lastIncident?: SlaIncident
}

export default function SlaDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [services, setServices] = useState<SlaService[]>([])
  const [incidents, setIncidents] = useState<SlaIncident[]>([])
  const [metrics, setMetrics] = useState<SlaMetric[]>([])
  const [reports, setReports] = useState<SlaReport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      setError(null)

      const [servicesData, incidentsData, metricsData, reportsData] = await Promise.all([
        fetchSlaServices(),
        fetchSlaIncidents(),
        fetchSlaMetrics(undefined, 500),
        fetchSlaReports()
      ])

      setServices(servicesData)
      setIncidents(incidentsData)
      setMetrics(metricsData)
      setReports(reportsData)
      setLastRefresh(new Date())
    } catch (err) {
      console.error("Error fetching SLA dashboard data:", err)
      setError("Failed to load dashboard data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const dashboardMetrics = useMemo((): DashboardMetrics => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get current month's availability metrics
    const currentMonthMetrics = metrics.filter(
      m => m.metricType === 'availability' && new Date(m.recordedAt) >= startOfMonth
    )

    const overallAvailability = currentMonthMetrics.length > 0
      ? currentMonthMetrics.reduce((sum, m) => sum + m.value, 0) / currentMonthMetrics.length
      : 0

    // Get this month's incidents
    const thisMonthIncidents = incidents.filter(
      i => new Date(i.startedAt) >= startOfMonth
    )

    // Calculate average response time from metrics
    const responseTimeMetrics = metrics.filter(m => m.metricType === 'response_time')
    const averageResponseTime = responseTimeMetrics.length > 0
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
      : 0

    // Find services with SLA breaches
    const servicesWithBreaches = new Set(
      incidents
        .filter(i => i.severity === 'critical' || i.severity === 'high')
        .map(i => i.slaServiceId)
    ).size

    // Calculate credits earned this month
    const creditsEarnedThisMonth = reports
      .filter(r => new Date(r.generatedAt) >= startOfMonth)
      .reduce((sum, r) => sum + (r.creditsEarned || 0), 0)

    return {
      overallAvailability,
      totalIncidentsThisMonth: thisMonthIncidents.length,
      averageResponseTime,
      servicesWithBreaches,
      activeServices: services.filter(s => s.isActive).length,
      totalServices: services.length,
      creditsEarnedThisMonth
    }
  }, [services, incidents, metrics, reports])

  const serviceHealth = useMemo((): ServiceHealth[] => {
    return services.map(service => {
      // Get latest availability metric for this service
      const latestMetrics = metrics
        .filter(m => m.slaServiceId === service.id && m.metricType === 'availability')
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())

      const currentAvailability = latestMetrics.length > 0 ? latestMetrics[0].value : 0

      // Get recent incidents for this service
      const serviceIncidents = incidents.filter(i => i.slaServiceId === service.id)
      const recentIncidents = serviceIncidents.filter(
        i => new Date(i.startedAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      )

      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (currentAvailability < service.availabilityTarget * 0.95) {
        status = 'critical'
      } else if (currentAvailability < service.availabilityTarget * 0.98 || recentIncidents.length > 0) {
        status = 'warning'
      }

      return {
        service,
        currentAvailability,
        status,
        incidentCount: serviceIncidents.length,
        lastIncident: serviceIncidents[0]
      }
    }).sort((a, b) => {
      // Sort by status priority, then by availability
      const statusPriority = { critical: 0, warning: 1, healthy: 2 }
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status]
      }
      return a.currentAvailability - b.currentAvailability
    })
  }, [services, metrics, incidents])

  const recentIncidents = useMemo(() => {
    return incidents
      .filter(i => i.status !== 'closed')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5)
  }, [incidents])

  const availabilityTrendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      date.setHours(0, 0, 0, 0)
      return date
    })

    return last7Days.map(date => {
      const dayMetrics = metrics.filter(
        m => m.metricType === 'availability' &&
        new Date(m.recordedAt) >= date &&
        new Date(m.recordedAt) < new Date(date.getTime() + 24 * 60 * 60 * 1000)
      )

      const avgAvailability = dayMetrics.length > 0
        ? dayMetrics.reduce((sum, m) => sum + m.value, 0) / dayMetrics.length
        : 0

      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        availability: avgAvailability
      }
    })
  }, [metrics])

  const incidentSeverityData = useMemo(() => {
    const severityCounts = incidents.reduce((acc, incident) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1
      return acc
    }, {} as Record<IncidentSeverity, number>)

    return [
      { severity: 'Critical', count: severityCounts.critical || 0, color: 'bg-red-500' },
      { severity: 'High', count: severityCounts.high || 0, color: 'bg-orange-500' },
      { severity: 'Medium', count: severityCounts.medium || 0, color: 'bg-yellow-500' },
      { severity: 'Low', count: severityCounts.low || 0, color: 'bg-green-500' }
    ]
  }, [incidents])

  const recentReports = useMemo(() => {
    return reports
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, 3)
  }, [reports])

  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'open': return 'destructive'
      case 'investigating': return 'secondary'
      case 'resolved': return 'default'
      case 'closed': return 'outline'
      default: return 'secondary'
    }
  }

  const getServiceHealthIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getServiceHealthColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'text-green-700 bg-green-50 border-green-200'
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'critical': return 'text-red-700 bg-red-50 border-red-200'
    }
  }

  if (error) {
    return (
      <m.div
        className="space-y-6"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <h3 className="font-medium text-red-900">Error Loading Dashboard</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData()}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </m.div>
    )
  }

  return (
    <m.div
      className="space-y-6"
      initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity, filter" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SLA Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor service level agreements and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Overall Availability"
          value={`${dashboardMetrics.overallAvailability.toFixed(2)}%`}
          description="Last 30 days"
          icon={<Activity className="h-4 w-4" />}
          trend={dashboardMetrics.overallAvailability >= 99 ? 'up' : 'down'}
          loading={loading}
        />
        <MetricCard
          title="Incidents This Month"
          value={dashboardMetrics.totalIncidentsThisMonth.toString()}
          description="Active issues"
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={dashboardMetrics.totalIncidentsThisMonth === 0 ? 'up' : 'down'}
          loading={loading}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${dashboardMetrics.averageResponseTime.toFixed(0)}m`}
          description="Response to incidents"
          icon={<Clock className="h-4 w-4" />}
          trend={dashboardMetrics.averageResponseTime <= 60 ? 'up' : 'down'}
          loading={loading}
        />
        <MetricCard
          title="SLA Breaches"
          value={dashboardMetrics.servicesWithBreaches.toString()}
          description="Services below target"
          icon={<XCircle className="h-4 w-4" />}
          trend={dashboardMetrics.servicesWithBreaches === 0 ? 'up' : 'down'}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Availability Trend Chart */}
        <m.div layout className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Availability Trend (7 Days)
              </CardTitle>
              <CardDescription>
                Service availability percentage over the last week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full shimmer" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between h-48 gap-2">
                    {availabilityTrendData.map((data, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full flex flex-col justify-end h-40">
                          <div
                            className="w-full bg-primary rounded-t-sm transition-all duration-300"
                            style={{
                              height: `${(data.availability / 100) * 100}%`,
                              backgroundColor: data.availability >= 99 ? '#22c55e' :
                                             data.availability >= 95 ? '#eab308' : '#ef4444'
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {data.date}
                        </span>
                        <span className="text-xs font-medium">
                          {data.availability.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </m.div>

        {/* Incident Severity Breakdown */}
        <m.div layout>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Incident Severity
              </CardTitle>
              <CardDescription>
                Breakdown by severity level
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full shimmer" />
              ) : (
                <div className="space-y-4">
                  {incidentSeverityData.map((item) => (
                    <div key={item.severity} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.severity}</span>
                        <span>{item.count}</span>
                      </div>
                      <Progress
                        value={incidents.length > 0 ? (item.count / incidents.length) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>Total Incidents</span>
                      <span>{incidents.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </m.div>
      </div>

      {/* Service Health Status */}
      <m.div layout>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Service Health Status
            </CardTitle>
            <CardDescription>
              Current status of all active SLA services
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full shimmer" />
                <Skeleton className="h-16 w-full shimmer" />
                <Skeleton className="h-16 w-full shimmer" />
              </div>
            ) : serviceHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active SLA services found.</p>
            ) : (
              <div className="space-y-3">
                {serviceHealth.map((health, index) => (
                  <m.div
                    key={health.service.id}
                    className={`p-4 rounded-lg border transition-all hover:shadow-md ${getServiceHealthColor(health.status)}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getServiceHealthIcon(health.status)}
                        <div>
                          <h4 className="font-medium">{health.service.name}</h4>
                          <p className="text-sm opacity-75">
                            {health.service.client?.company || 'Unknown Client'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {health.currentAvailability.toFixed(2)}%
                        </div>
                        <div className="text-xs opacity-75">
                          Target: {health.service.availabilityTarget.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {health.incidentCount} incidents
                        </span>
                        {health.lastIncident && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last: {formatDateISO(health.lastIncident.startedAt)}
                          </span>
                        )}
                      </div>
                      <Badge variant={getSeverityColor(health.lastIncident?.severity || 'low')}>
                        {health.status}
                      </Badge>
                    </div>
                  </m.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </m.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Incidents */}
        <m.div layout>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Incidents
              </CardTitle>
              <CardDescription>
                Latest active incidents requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full shimmer" />
                  <Skeleton className="h-16 w-full shimmer" />
                </div>
              ) : recentIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active incidents.</p>
              ) : (
                recentIncidents.map((incident, index) => (
                  <m.div
                    key={incident.id}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.2 }}
                  >
                    <div className="mt-1">
                      {incident.status === 'open' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                      {incident.status === 'investigating' && <div className="w-2 h-2 bg-yellow-500 rounded-full" />}
                      {incident.status === 'resolved' && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{incident.title}</h4>
                        <Badge variant={getSeverityColor(incident.severity)} className="capitalize">
                          {incident.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {incident.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{incident.slaService?.name}</span>
                        <span>{formatDateISO(incident.startedAt)}</span>
                        {incident.affectedUsers > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {incident.affectedUsers} affected
                          </span>
                        )}
                      </div>
                    </div>
                  </m.div>
                ))
              )}
            </CardContent>
          </Card>
        </m.div>

        {/* Recent Reports */}
        <m.div layout>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Recent Reports
              </CardTitle>
              <CardDescription>
                Latest SLA performance reports generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full shimmer" />
                  <Skeleton className="h-16 w-full shimmer" />
                </div>
              ) : recentReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports generated yet.</p>
              ) : (
                recentReports.map((report, index) => (
                  <m.div
                    key={report.id}
                    className="p-3 rounded-lg border"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">
                        {report.reportType} Report
                      </h4>
                      <Badge variant={report.availabilityPercentage && report.availabilityPercentage >= 99 ? 'default' : 'destructive'}>
                        {report.availabilityPercentage ? `${report.availabilityPercentage.toFixed(2)}%` : 'N/A'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Service: {report.slaService?.name}</div>
                      <div>Period: {formatDateISO(report.periodStart)} - {formatDateISO(report.periodEnd)}</div>
                      <div className="flex items-center gap-4">
                        <span>{report.totalIncidents} incidents</span>
                        {report.creditsEarned > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(report.creditsEarned)} credits
                          </span>
                        )}
                      </div>
                    </div>
                  </m.div>
                ))
              )}
            </CardContent>
          </Card>
        </m.div>
      </div>
    </m.div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  trend: 'up' | 'down'
  loading?: boolean
}

function MetricCard({ title, value, description, icon, trend, loading }: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') {
      return <TrendingUp className="h-4 w-4 text-green-500" />
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getTrendColor = () => {
    return trend === 'up' ? 'text-green-600' : 'text-red-600'
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card aria-busy={loading} aria-live="polite" className="transition-transform hover:scale-[1.02] will-change-transform">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="flex items-center gap-2">
              {icon}
              {title}
            </CardDescription>
            {!loading && getTrendIcon()}
          </div>
          {loading ? (
            <Skeleton className="h-8 w-16 shimmer" />
          ) : (
            <CardTitle className={`text-3xl ${getTrendColor()}`}>
              {value}
            </CardTitle>
          )}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {description}
        </CardContent>
      </Card>
    </m.div>
  )
}