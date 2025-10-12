"use client"

import * as React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function SlaDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48 shimmer" />
        <Skeleton className="h-5 w-96 shimmer" />
      </div>

      {/* Key Metrics Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} aria-busy="true">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24 shimmer" />
              <Skeleton className="h-8 w-16 shimmer" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-32 shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 shimmer" />
              <Skeleton className="h-4 w-64 shimmer" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full shimmer" />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40 shimmer" />
              <Skeleton className="h-4 w-48 shimmer" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16 shimmer" />
                      <Skeleton className="h-4 w-8 shimmer" />
                    </div>
                    <Skeleton className="h-2 w-full shimmer" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Service Health Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 shimmer" />
          <Skeleton className="h-4 w-48 shimmer" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-full shimmer" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32 shimmer" />
                      <Skeleton className="h-3 w-24 shimmer" />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-16 shimmer" />
                    <Skeleton className="h-3 w-20 shimmer" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-20 shimmer" />
                    <Skeleton className="h-3 w-24 shimmer" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 shimmer" />
            <Skeleton className="h-4 w-48 shimmer" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border space-y-2">
                <Skeleton className="w-2 h-2 rounded-full shimmer mt-2" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-40 shimmer" />
                    <Skeleton className="h-5 w-16 rounded-full shimmer" />
                  </div>
                  <Skeleton className="h-3 w-full shimmer" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-24 shimmer" />
                    <Skeleton className="h-3 w-20 shimmer" />
                    <Skeleton className="h-3 w-28 shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 shimmer" />
            <Skeleton className="h-4 w-48 shimmer" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32 shimmer" />
                  <Skeleton className="h-5 w-16 rounded-full shimmer" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24 shimmer" />
                  <Skeleton className="h-3 w-40 shimmer" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-20 shimmer" />
                    <Skeleton className="h-3 w-28 shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}