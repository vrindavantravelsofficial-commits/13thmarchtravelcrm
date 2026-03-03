'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Search, RefreshCw, Building, Eye, Check, XCircle, Ban, Trash2, Loader2 } from 'lucide-react'

export default function OrganizationsPage() {
  const { isSuperAdmin } = useAuth()
  const router = useRouter()
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  // Fetch with cache-busting to always get fresh data
  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant-organizations?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data)
      }
    } catch (e) { 
      console.error('Fetch error:', e) 
    } finally { 
      setLoading(false) 
    }
  }, [])

  useEffect(() => {
    if (!isSuperAdmin) {
      router.push('/dashboard')
      return
    }
    fetchOrganizations()
    
    // Auto-refresh every 10 seconds for real-time feel
    const interval = setInterval(fetchOrganizations, 10000)
    return () => clearInterval(interval)
  }, [isSuperAdmin, fetchOrganizations, router])

  // Handle action with optimistic update + server sync
  const handleAction = useCallback(async (orgId, action) => {
    setActionLoading(prev => ({ ...prev, [orgId]: action }))
    
    const statusMap = { approve: 'approved', reject: 'rejected', suspend: 'suspended' }
    const newStatus = statusMap[action]
    
    // Optimistic update - instant UI feedback
    setOrganizations(prev => 
      prev.map(org => org.id === orgId ? { ...org, status: newStatus } : org)
    )
    if (selectedOrg?.id === orgId) {
      setSelectedOrg(prev => prev ? { ...prev, status: newStatus } : null)
    }
    
    try {
      const res = await fetch(`/api/tenant-organizations/${orgId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (res.ok) {
        toast.success(`Organization ${action}ed successfully`)
        // Fetch fresh data to confirm server state
        await fetchOrganizations()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Action failed')
        // Revert on failure - refetch to get correct state
        await fetchOrganizations()
      }
    } catch (e) { 
      toast.error('Error performing action')
      await fetchOrganizations()
    } finally { 
      setActionLoading(prev => ({ ...prev, [orgId]: null }))
      setShowDetails(false)
    }
  }, [selectedOrg, fetchOrganizations])

  // Handle delete with optimistic update
  const handleDelete = useCallback(async (orgId) => {
    if (!confirm('Are you sure? This will delete the organization and ALL its data permanently!')) return
    
    setActionLoading(prev => ({ ...prev, [orgId]: 'delete' }))
    
    // Store for potential rollback
    const deletedOrg = organizations.find(org => org.id === orgId)
    
    // Optimistic delete - instant UI feedback
    setOrganizations(prev => prev.filter(org => org.id !== orgId))
    setShowDetails(false)
    
    try {
      const res = await fetch(`/api/tenant-organizations/${orgId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        toast.success('Organization deleted successfully')
        // Confirm with server
        await fetchOrganizations()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Delete failed')
        // Rollback on failure
        if (deletedOrg) {
          setOrganizations(prev => [...prev, deletedOrg])
        }
        await fetchOrganizations()
      }
    } catch (e) { 
      toast.error('Delete failed')
      // Rollback on error
      if (deletedOrg) {
        setOrganizations(prev => [...prev, deletedOrg])
      }
      await fetchOrganizations()
    } finally { 
      setActionLoading(prev => ({ ...prev, [orgId]: null }))
    }
  }, [organizations, fetchOrganizations])

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      suspended: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
    return <Badge className={styles[status] || styles.pending}>{status?.toUpperCase()}</Badge>
  }

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name?.toLowerCase().includes(search.toLowerCase()) || 
      org.adminEmail?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || org.status === filterStatus
    return matchesSearch && matchesStatus
  })

  if (!isSuperAdmin) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-muted-foreground">Manage tenant organizations</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search organizations..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchOrganizations}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredOrgs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No organizations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow key={org.id} className="transition-opacity duration-200">
                      <TableCell>
                        <div className="font-medium">{org.name}</div>
                        <div className="text-xs text-muted-foreground">{org.website}</div>
                      </TableCell>
                      <TableCell>{org.adminEmail}</TableCell>
                      <TableCell>{org.phone || '-'}</TableCell>
                      <TableCell>{getStatusBadge(org.status)}</TableCell>
                      <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setSelectedOrg(org); setShowDetails(true) }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {org.status === 'pending' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600 hover:text-green-700 hover:bg-green-50" 
                                onClick={() => handleAction(org.id, 'approve')}
                                disabled={!!actionLoading[org.id]}
                              >
                                {actionLoading[org.id] === 'approve' ? 
                                  <Loader2 className="w-4 h-4 animate-spin" /> : 
                                  <Check className="w-4 h-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                                onClick={() => handleAction(org.id, 'reject')}
                                disabled={!!actionLoading[org.id]}
                              >
                                {actionLoading[org.id] === 'reject' ? 
                                  <Loader2 className="w-4 h-4 animate-spin" /> : 
                                  <XCircle className="w-4 h-4" />}
                              </Button>
                            </>
                          )}
                          
                          {org.status === 'approved' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                              onClick={() => handleAction(org.id, 'suspend')}
                              disabled={!!actionLoading[org.id]}
                            >
                              {actionLoading[org.id] === 'suspend' ? 
                                <Loader2 className="w-4 h-4 animate-spin" /> : 
                                <Ban className="w-4 h-4" />}
                            </Button>
                          )}
                          
                          {(org.status === 'suspended' || org.status === 'rejected') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-600 hover:text-green-700 hover:bg-green-50" 
                              onClick={() => handleAction(org.id, 'approve')}
                              disabled={!!actionLoading[org.id]}
                            >
                              {actionLoading[org.id] === 'approve' ? 
                                <Loader2 className="w-4 h-4 animate-spin" /> : 
                                <Check className="w-4 h-4" />}
                            </Button>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                            onClick={() => handleDelete(org.id)}
                            disabled={!!actionLoading[org.id]}
                          >
                            {actionLoading[org.id] === 'delete' ? 
                              <Loader2 className="w-4 h-4 animate-spin" /> : 
                              <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Organization Details</DialogTitle>
            <DialogDescription>View and manage organization</DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Organization Name</Label>
                  <p className="font-medium">{selectedOrg.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedOrg.status)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Admin Email</Label>
                  <p className="text-sm">{selectedOrg.adminEmail}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="text-sm">{selectedOrg.phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <p className="text-sm">{selectedOrg.address || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Website</Label>
                  <p className="text-sm">{selectedOrg.website || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="text-sm">{new Date(selectedOrg.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2 justify-end flex-wrap">
                {selectedOrg.status === 'pending' && (
                  <>
                    <Button 
                      variant="outline" 
                      className="text-green-600" 
                      onClick={() => handleAction(selectedOrg.id, 'approve')} 
                      disabled={!!actionLoading[selectedOrg.id]}
                    >
                      {actionLoading[selectedOrg.id] === 'approve' ? 
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                        <Check className="w-4 h-4 mr-2" />} 
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="text-red-600" 
                      onClick={() => handleAction(selectedOrg.id, 'reject')} 
                      disabled={!!actionLoading[selectedOrg.id]}
                    >
                      {actionLoading[selectedOrg.id] === 'reject' ? 
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                        <XCircle className="w-4 h-4 mr-2" />} 
                      Reject
                    </Button>
                  </>
                )}
                {selectedOrg.status === 'approved' && (
                  <Button 
                    variant="outline" 
                    className="text-orange-600" 
                    onClick={() => handleAction(selectedOrg.id, 'suspend')} 
                    disabled={!!actionLoading[selectedOrg.id]}
                  >
                    {actionLoading[selectedOrg.id] === 'suspend' ? 
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                      <Ban className="w-4 h-4 mr-2" />} 
                    Suspend
                  </Button>
                )}
                {(selectedOrg.status === 'suspended' || selectedOrg.status === 'rejected') && (
                  <Button 
                    variant="outline" 
                    className="text-green-600" 
                    onClick={() => handleAction(selectedOrg.id, 'approve')} 
                    disabled={!!actionLoading[selectedOrg.id]}
                  >
                    {actionLoading[selectedOrg.id] === 'approve' ? 
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                      <Check className="w-4 h-4 mr-2" />} 
                    Approve
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  onClick={() => handleDelete(selectedOrg.id)} 
                  disabled={!!actionLoading[selectedOrg.id]}
                >
                  {actionLoading[selectedOrg.id] === 'delete' ? 
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                    <Trash2 className="w-4 h-4 mr-2" />} 
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
