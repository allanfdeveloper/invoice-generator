"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ChartProps {
  data: number[]
  labels?: string[]
  height?: number
  color?: string
  title?: string
  showGrid?: boolean
  className?: string
}

export function SimpleLineChart({
  data,
  labels,
  height = 200,
  color = "#3b82f6",
  title,
  showGrid = true,
  className
}: ChartProps) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div className={cn("w-full", className)}>
      {title && (
        <h4 className="text-sm font-medium mb-2">{title}</h4>
      )}
      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {showGrid && (
            <g className="opacity-20">
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              ))}
              {[0, 25, 50, 75, 100].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          )}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.map((value, index) => {
            const x = (index / (data.length - 1)) * 100
            const y = 100 - ((value - min) / range) * 100
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="2"
                fill={color}
              />
            )
          })}
        </svg>
        {labels && (
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            {labels.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  color?: string
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "text-blue-600",
  className
}: MetricCardProps) {
  return (
    <div className={cn("p-6 bg-white border rounded-lg", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <div className={cn(
                "flex items-center text-sm",
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={cn("p-2 rounded-lg bg-muted/50", color)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}