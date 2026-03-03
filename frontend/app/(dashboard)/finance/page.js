'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, Search, RefreshCw, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function FinancePage() {
  const { getToken, user } = useAuth()
  const router = useRouter()
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Check if user has finance role or is admin
    const userRoles = user?.roles || []
    const hasFinanceRole = userRoles.includes('finance')
    const isAdmin = userRoles.includes('admin')
    
    if (user && !hasFinanceRole && !isAdmin && !user.isSuperAdmin) {
      toast.error('Access denied - Finance team only')
      router.push('/dashboard')
      return
    }
    fetchQueries()
  }, [user])

  const fetchQueries = async () => {
    try {
      const authToken = await getToken()
      const res = await fetch('/api/queries', { headers: { 'Authorization': `Bearer ${authToken}` } })
      const data = await res.json()
      setQueries(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const confirmedQueries = queries.filter(q => q.status === 'confirmed')
  const cancelledQueries = queries.filter(q => q.status === 'cancelled')

  const filteredConfirmed = confirmedQueries.filter(q =>
    q.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    q.destination?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCancelled = cancelledQueries.filter(q =>
    q.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    q.destination?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Finance Management</h1>
          <p className="text-muted-foreground mt-1">Manage confirmed and cancelled queries</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" size="icon" onClick={fetchQueries}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Confirmed Queries</CardTitle>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{confirmedQueries.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Cancelled Queries</CardTitle>
            <XCircle className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{cancelledQueries.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="confirmed" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="confirmed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            Confirmed ({confirmedQueries.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            Cancelled ({cancelledQueries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="confirmed" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden sm:table-cell">Destination</TableHead>
                      <TableHead className="hidden md:table-cell">Travel Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConfirmed.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No confirmed queries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredConfirmed.map((query) => (
                        <TableRow key={query.id}>
                          <TableCell className="font-medium">{query.customerName}</TableCell>
                          <TableCell className="hidden sm:table-cell">{query.destination}</TableCell>
                          <TableCell className="hidden md:table-cell">{query.travelDate}</TableCell>
                          <TableCell className="font-semibold text-green-600">₹{(query.totalCost || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">Confirmed</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/queries/${query.id}`)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden sm:table-cell">Destination</TableHead>
                      <TableHead className="hidden md:table-cell">Travel Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCancelled.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No cancelled queries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCancelled.map((query) => (
                        <TableRow key={query.id}>
                          <TableCell className="font-medium">{query.customerName}</TableCell>
                          <TableCell className="hidden sm:table-cell">{query.destination}</TableCell>
                          <TableCell className="hidden md:table-cell">{query.travelDate}</TableCell>
                          <TableCell className="font-semibold text-red-600">₹{(query.totalCost || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/queries/${query.id}`)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
