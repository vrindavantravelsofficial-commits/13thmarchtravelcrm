'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useDashboardStats } from '@/hooks/useData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatsGridSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, AlertCircle, Clock, CheckCircle, IndianRupee, Building, TrendingUp, 
  Users, Hotel, Package, MapPin, Calendar, Phone, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, BarChart3, Activity, Target, Bell, Plus, Eye
} from 'lucide-react'
import Link from 'next/link'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  Tooltip
} from 'recharts'

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899']
const STATUS_COLORS = {
  new: '#f59e0b',
  ongoing: '#3b82f6', 
  confirmed: '#10b981',
  cancelled: '#ef4444'
}

export default function DashboardPage() {
  const { user, isSuperAdmin } = useAuth()
  const { data: stats, isLoading } = useDashboardStats()

  // Prepare pie chart data for query status
  const statusData = [
    { name: 'New', value: stats?.newQueries || 0, color: STATUS_COLORS.new },
    { name: 'Ongoing', value: stats?.ongoingQueries || 0, color: STATUS_COLORS.ongoing },
    { name: 'Confirmed', value: stats?.confirmedQueries || 0, color: STATUS_COLORS.confirmed },
    { name: 'Cancelled', value: stats?.cancelledQueries || 0, color: STATUS_COLORS.cancelled },
  ].filter(d => d.value > 0)

  // Source breakdown data for bar chart
  const sourceData = stats?.sourceBreakdown 
    ? Object.entries(stats.sourceBreakdown).map(([name, count]) => ({ name, queries: count }))
    : []

  // Monthly trends data
  const trendsData = stats?.monthlyTrends || []

  // Chart config for shadcn charts
  const chartConfig = {
    queries: { label: 'Queries', color: '#3b82f6' },
    revenue: { label: 'Revenue', color: '#10b981' },
    confirmed: { label: 'Confirmed', color: '#8b5cf6' }
  }

  const statCards = [
    { 
      label: 'Total Queries', 
      value: stats?.totalQueries || 0, 
      icon: FileText, 
      gradient: 'from-blue-500 to-blue-600',
      change: '+12%',
      positive: true
    },
    { 
      label: 'New Queries', 
      value: stats?.newQueries || 0, 
      icon: AlertCircle, 
      gradient: 'from-amber-500 to-amber-600',
    },
    { 
      label: 'Ongoing', 
      value: stats?.ongoingQueries || 0, 
      icon: Clock, 
      gradient: 'from-orange-500 to-orange-600',
    },
    { 
      label: 'Confirmed', 
      value: stats?.confirmedQueries || 0, 
      icon: CheckCircle, 
      gradient: 'from-emerald-500 to-emerald-600',
    },
    { 
      label: 'Total Revenue', 
      value: `₹${(stats?.totalRevenue || 0).toLocaleString()}`, 
      icon: IndianRupee, 
      gradient: 'from-green-500 to-green-600',
    },
  ]

  const resourceCards = [
    { label: 'Hotels', value: stats?.totalHotels || 0, icon: Hotel, href: '/hotels', color: 'text-blue-500' },
    { label: 'Packages', value: stats?.totalPackages || 0, icon: Package, href: '/packages', color: 'text-purple-500' },
    { label: 'Team Members', value: stats?.totalUsers || 0, icon: Users, href: '/settings', color: 'text-amber-500' },
  ]

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[status] || colors.new
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of your travel business {isSuperAdmin && '(Super Admin)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/queries">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All Queries
            </Button>
          </Link>
          <Link href="/queries?new=true">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Query
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Main Stats Grid */}
      {isLoading ? (
        <StatsGridSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {statCards.map((stat, index) => (
            <Card 
              key={index} 
              className="group overflow-hidden hover:shadow-lg transition-all duration-300 card-animate animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
              data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 card-animate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Conversion Rate</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats?.conversionRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800 card-animate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending Follow-ups</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats?.pendingFollowUps || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {resourceCards.slice(0, 2).map((card, idx) => (
          <Link key={idx} href={card.href}>
            <Card className="hover:shadow-md transition-all duration-300 cursor-pointer h-full card-animate">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                    <p className="text-xl font-bold">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        {/* Query Trends Chart */}
        <Card className="col-span-1 card-animate">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  Query Trends
                </CardTitle>
                <CardDescription>Last 6 months performance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {trendsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'currentColor' }} />
                    <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="queries" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorQueries)" 
                      name="Total Queries"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="confirmed" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorConfirmed)" 
                      name="Confirmed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No data available yet</p>
                    <p className="text-sm">Start adding queries to see trends</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Query Status Pie Chart */}
        <Card className="col-span-1 card-animate">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-purple-500" />
                  Query Status Distribution
                </CardTitle>
                <CardDescription>Current query breakdown by status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {statusData.length > 0 ? (
                <div className="flex items-center h-full">
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-[40%] space-y-2">
                    {statusData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No queries yet</p>
                    <p className="text-sm">Add queries to see distribution</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        {/* Query Sources Bar Chart */}
        <Card className="lg:col-span-1 card-animate">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              Query Sources
            </CardTitle>
            <CardDescription>Where your leads come from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" className="text-xs" tick={{ fill: 'currentColor' }} />
                    <YAxis dataKey="name" type="category" width={60} className="text-xs" tick={{ fill: 'currentColor' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="queries" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No source data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Destinations */}
        <Card className="lg:col-span-1 card-animate">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" />
              Top Destinations
            </CardTitle>
            <CardDescription>Most requested travel destinations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.topDestinations?.length > 0 ? (
                stats.topDestinations.map((dest, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                           style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {idx + 1}
                      </div>
                      <span className="font-medium">{dest.name}</span>
                    </div>
                    <Badge variant="secondary">{dest.count} queries</Badge>
                  </div>
                ))
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No destination data</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Queries */}
        <Card className="lg:col-span-1 card-animate">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Recent Queries
                </CardTitle>
                <CardDescription>Latest incoming queries</CardDescription>
              </div>
              <Link href="/queries">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                  <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentQueries?.length > 0 ? (
                stats.recentQueries.slice(0, 4).map((query, idx) => (
                  <Link key={idx} href={`/queries/${query.id}`}>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {query.customerName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{query.customerName}</p>
                          <p className="text-xs text-muted-foreground truncate">{query.destination}</p>
                        </div>
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ${getStatusColor(query.status)}`}>
                        {query.status}
                      </Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No queries yet</p>
                    <Link href="/queries?new=true">
                      <Button variant="outline" size="sm" className="mt-2">
                        <Plus className="w-3 h-3 mr-1" /> Add First Query
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Super Admin Section */}
      {isSuperAdmin && (
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-500" />
              Organization Management
            </CardTitle>
            <CardDescription>Multi-tenant overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats?.totalOrgs || 0}</p>
                <p className="text-sm text-muted-foreground">Total Organizations</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats?.pendingOrgs || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.approvedOrgs || 0}</p>
                <p className="text-sm text-muted-foreground">Active Organizations</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Link href="/organizations">
                <Button variant="outline" size="sm">
                  <Building className="w-4 h-4 mr-2" />
                  Manage Organizations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Welcome Message */}
      <Card className="overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-primary/5 to-blue-500/5 dark:from-primary/10 dark:to-blue-500/10">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Welcome back, {user?.name || 'Admin'}!
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage your travel queries, packages, and hotels from this dashboard. Use the sidebar to navigate between different sections.
          </p>
        </div>
      </Card>
    </div>
  )
}
