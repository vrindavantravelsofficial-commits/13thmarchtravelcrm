'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useQueries, usePackages, useUsers, createOptimisticAdd } from '@/hooks/useData'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { PageSkeleton } from '@/components/ui/skeleton'
import { 
  Plus, Search, Eye, Trash2, RefreshCw, FileText, Phone, 
  MoreHorizontal, ArrowUpDown, Clock, Calendar, Users, Timer,
  Bell, ChevronDown, MessageSquare, Edit, ExternalLink
} from 'lucide-react'

// Query Sources
const QUERY_SOURCES = [
  { id: 'DQ', label: 'DQ', description: 'Direct Query' },
  { id: 'AVT', label: 'AVT.com', description: 'AVT Website' },
  { id: 'VP', label: 'VrindavanPackages', description: 'Vrindavan Packages' },
  { id: 'FB', label: 'Facebook', description: 'Facebook Leads' },
  { id: 'IG', label: 'Instagram', description: 'Instagram Leads' },
  { id: 'WA', label: 'WhatsApp', description: 'WhatsApp Inquiry' },
  { id: 'REF', label: 'Referral', description: 'Customer Referral' },
  { id: 'WEB', label: 'Website', description: 'Website Form' },
]

// Sort Options
const SORT_OPTIONS = [
  { id: 'followup_oldest', label: 'Oldest Follow-Up First', field: 'nextFollowUp', order: 'asc' },
  { id: 'followup_latest', label: 'Latest Follow-Up First', field: 'nextFollowUp', order: 'desc' },
  { id: 'startdate_asc', label: 'Start Date: Ascending', field: 'travelDate', order: 'asc' },
  { id: 'created_latest', label: 'Latest Created First', field: 'createdAt', order: 'desc' },
  { id: 'adults_most', label: 'Pax: Most Adults First', field: 'adults', order: 'desc' },
  { id: 'duration_longest', label: 'Duration: Longest First', field: 'nights', order: 'desc' },
]

// Time ago helper
const timeAgo = (date) => {
  if (!date) return 'N/A'
  const now = new Date()
  const then = new Date(date)
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return then.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Format date for display
const formatTravelInfo = (query) => {
  const date = query.travelDate ? new Date(query.travelDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'TBD'
  const nights = query.nights ? `${query.nights}N` : ''
  const adults = query.adults ? `${query.adults}A` : ''
  const children = query.children ? `${query.children}C` : ''
  const pax = [adults, children].filter(Boolean).join(' ')
  return [date, nights, pax].filter(Boolean).join(' • ')
}

export default function QueriesPage() {
  const router = useRouter()
  const { getToken, user } = useAuth()
  const { data: queries, isLoading, mutate, setData } = useQueries()
  const { data: packages } = usePackages()
  const { data: users } = useUsers()
  
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('created_latest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [followUpNote, setFollowUpNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  
  const [newQuery, setNewQuery] = useState({
    customerName: '', email: '', phone: '', destination: '',
    travelDate: '', nights: 3, adults: 2, children: 0,
    tourPackage: '', assignedTo: '', notes: '', pickUp: '', dropOff: '',
    source: 'DQ', quote: 0, tags: [], nextFollowUp: ''
  })

  // Check if all mandatory fields are filled
  const isMandatoryFieldsFilled = () => {
    return (
      newQuery.customerName?.trim() &&
      newQuery.phone?.trim() &&
      newQuery.travelDate?.trim() &&
      newQuery.nights > 0 &&
      newQuery.adults > 0 &&
      newQuery.tourPackage?.trim() && 
      newQuery.tourPackage !== 'none'
    )
  }

  const handleCreateQuery = async () => {
    // Validate mandatory fields and collect errors
    const errors = {}
    if (!newQuery.customerName?.trim()) errors.customerName = 'Customer Name is required'
    if (!newQuery.phone?.trim()) errors.phone = 'Phone is required'
    if (!newQuery.travelDate?.trim()) errors.travelDate = 'Travel Date is required'
    if (!newQuery.nights || newQuery.nights < 1) errors.nights = 'Nights must be at least 1'
    if (!newQuery.adults || newQuery.adults < 1) errors.adults = 'Adults must be at least 1'
    if (!newQuery.tourPackage?.trim() || newQuery.tourPackage === 'none') errors.tourPackage = 'Tour Package is required'
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      toast.error('Please fill all required fields (marked with *)')
      return
    }
    
    setValidationErrors({})
    
    try {
      const token = await getToken()
      
      // Clean data - properly convert empty strings to null for UUID/date fields
      const cleanedData = {
        customerName: newQuery.customerName.trim(),
        phone: newQuery.phone.trim(),
        destination: newQuery.destination?.trim() || null,
        adults: newQuery.adults,
        children: newQuery.children || 0,
        nights: newQuery.nights,
        source: newQuery.source,
        quote: newQuery.quote || 0,
        travelDate: newQuery.travelDate.trim(),
        tourPackage: newQuery.tourPackage.trim(),
        // Auto-assign to current user if not assigned to anyone
        assignedTo: newQuery.assignedTo?.trim() || user?.id || null,
        // Optional fields - convert empty to null
        email: newQuery.email?.trim() || null,
        notes: newQuery.notes?.trim() || null,
        pickUp: newQuery.pickUp?.trim() || null,
        dropOff: newQuery.dropOff?.trim() || null,
        tags: Array.isArray(newQuery.tags) && newQuery.tags.length > 0 ? newQuery.tags : null,
        nextFollowUp: newQuery.nextFollowUp?.trim() || null
      }
      
      console.log('Creating query, auto-assigned to:', cleanedData.assignedTo)
      
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(cleanedData)
      })
      
      console.log('Response status:', res.status)
      
      if (res.ok) {
        const savedQuery = await res.json()
        console.log('Query saved successfully:', savedQuery)
        
        // Reset form
        setNewQuery({
          customerName: '', email: '', phone: '', destination: '',
          travelDate: '', nights: 3, adults: 2, children: 0,
          tourPackage: '', assignedTo: '', notes: '', pickUp: '', dropOff: '',
          source: 'DQ', quote: 0, tags: [], nextFollowUp: ''
        })
        setValidationErrors({})
        setShowAddDialog(false)
        toast.success('Query created successfully!')
        
        // Refresh data from server - NO optimistic update
        mutate()
      } else {
        const errorData = await res.json()
        console.error('Failed to create query:', errorData)
        toast.error(`Failed to save: ${errorData.error || 'Please check all required fields'}`)
      }
    } catch (e) {
      console.error('Error creating query:', e)
      toast.error('Error: ' + e.message)
    }
  }

  const handleAddFollowUp = async () => {
    if (!selectedQuery) return
    try {
      const token = await getToken()
      const res = await fetch(`/api/queries/${selectedQuery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          nextFollowUp: followUpDate,
          followUps: [
            ...(selectedQuery.followUps || []),
            { note: followUpNote, date: followUpDate, createdAt: new Date().toISOString() }
          ],
          lastFollowUp: new Date().toISOString()
        })
      })
      if (res.ok) {
        toast.success('Follow-up added!')
        setShowFollowUpDialog(false)
        setFollowUpNote('')
        setFollowUpDate('')
        setSelectedQuery(null)
        mutate()
      } else {
        toast.error('Failed to add follow-up')
      }
    } catch (e) {
      console.error('Error adding follow-up:', e)
      toast.error('Failed to add follow-up')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this query?')) return
    try {
      const token = await getToken()
      const res = await fetch(`/api/queries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        toast.success('Query deleted')
        mutate()
      } else {
        toast.error('Delete failed')
      }
    } catch (e) {
      console.error('Error deleting query:', e)
      toast.error('Delete failed')
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return <Badge className={`${styles[status] || styles.new} text-xs font-medium`}>{status?.toUpperCase()}</Badge>
  }

  const getSourceBadge = (source) => {
    const sourceInfo = QUERY_SOURCES.find(s => s.id === source) || { label: source || 'DQ' }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
        {sourceInfo.label}
      </span>
    )
  }

  const getUserName = (id) => users.find(u => u.id === id)?.name || 'Unassigned'

  // Filter and sort queries
  const filteredAndSortedQueries = useMemo(() => {
    let result = queries.filter(q => {
      const matchesSearch = q.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        q.queryNumber?.toLowerCase().includes(search.toLowerCase()) ||
        q.destination?.toLowerCase().includes(search.toLowerCase()) ||
        q.phone?.includes(search)
      const matchesStatus = filterStatus === 'all' || q.status === filterStatus
      return matchesSearch && matchesStatus
    })

    // Sort
    const sortOption = SORT_OPTIONS.find(s => s.id === sortBy)
    if (sortOption) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortOption.field]
        let bVal = b[sortOption.field]
        
        // Handle dates
        if (sortOption.field === 'travelDate' || sortOption.field === 'createdAt' || sortOption.field === 'nextFollowUp') {
          aVal = aVal ? new Date(aVal).getTime() : (sortOption.order === 'asc' ? Infinity : -Infinity)
          bVal = bVal ? new Date(bVal).getTime() : (sortOption.order === 'asc' ? Infinity : -Infinity)
        }
        
        // Handle numbers
        if (typeof aVal === 'number' || typeof bVal === 'number') {
          aVal = aVal || 0
          bVal = bVal || 0
        }

        if (sortOption.order === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })
    }

    return result
  }, [queries, search, filterStatus, sortBy])

  if (isLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="space-y-4 animate-fade-in" data-testid="queries-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">All Queries</h1>
            <p className="text-sm text-muted-foreground">{filteredAndSortedQueries.length} queries found</p>
          </div>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)} 
          className="bg-primary hover:bg-primary/90"
          data-testid="new-query-button"
        >
          <Plus className="w-4 h-4 mr-2" /> New Query
        </Button>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, ID, destination, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-queries-input"
          />
        </div>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Dropdown */}
        <div className="relative">
          <Button 
            variant="outline" 
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="gap-2"
            data-testid="sort-button"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort
            <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
          </Button>
          
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => { setSortBy(option.id); setShowSortMenu(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 ${
                    sortBy === option.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" onClick={() => mutate()} data-testid="refresh-queries-button">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Queries Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filteredAndSortedQueries.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-lg font-medium">No queries found</p>
              <p className="text-sm text-muted-foreground">Create a new query to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Quote</TableHead>
                  <TableHead>Sales Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedQueries.map((query) => (
                  <TableRow 
                    key={query.id} 
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30" 
                    onClick={() => router.push(`/queries/${query.id}`)}
                    data-testid={`query-row-${query.id}`}
                  >
                    {/* ID */}
                    <TableCell>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-sm">
                        {query.queryNumber}
                      </span>
                    </TableCell>
                    
                    {/* Contact */}
                    <TableCell>
                      <div className="space-y-1">
                        {getSourceBadge(query.source)}
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{query.customerName}</span>
                          {query.phone && (
                            <Phone className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Details */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-sm">{query.destination || 'No destination'}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {formatTravelInfo(query)}
                          <span className="text-muted-foreground/60">•</span>
                          <span>{timeAgo(query.createdAt)}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Quote */}
                    <TableCell className="text-right">
                      <span className="font-semibold text-sm">
                        {query.quote ? `₹${query.quote.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                    
                    {/* Sales Team */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getUserName(query.assignedTo)}
                      </span>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      {getStatusBadge(query.status)}
                    </TableCell>
                    
                    {/* Follow-up */}
                    <TableCell>
                      <div className="space-y-0.5">
                        {query.followUps && query.followUps.length > 0 ? (
                          <>
                            <div className="text-sm text-foreground line-clamp-1 max-w-[180px]">
                              {query.followUps[query.followUps.length - 1]?.note || ''}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {timeAgo(query.lastFollowUp || query.followUps[query.followUps.length - 1]?.createdAt)}
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedQuery(query)
                              setShowFollowUpDialog(true)
                            }}
                            className="text-xs text-blue-500 hover:text-blue-600"
                          >
                            + Add Follow-up
                          </button>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <Link href={`/queries/${query.id}`} prefetch={true}>
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => {
                            setSelectedQuery(query)
                            setShowFollowUpDialog(true)
                          }}>
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Add Follow-up
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/queries/${query.id}?edit=true`)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Query
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(query.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Query Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Query</DialogTitle>
            <DialogDescription>Enter customer and travel details</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {/* Source */}
            <div className="space-y-2">
              <Label>Query Source *</Label>
              <Select 
                value={newQuery.source} 
                onValueChange={(v) => setNewQuery({ ...newQuery, source: v })}
              >
                <SelectTrigger data-testid="query-source-select">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {QUERY_SOURCES.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground ml-2">- {s.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input 
                value={newQuery.customerName} 
                onChange={(e) => setNewQuery({ ...newQuery, customerName: e.target.value })}
                placeholder="Enter customer name"
                required
                className={validationErrors.customerName ? 'border-red-500' : ''}
                data-testid="query-customer-name-input"
              />
              {validationErrors.customerName && (
                <p className="text-xs text-red-500">{validationErrors.customerName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input 
                value={newQuery.phone} 
                onChange={(e) => setNewQuery({ ...newQuery, phone: e.target.value })}
                placeholder="Enter phone number"
                required
                className={validationErrors.phone ? 'border-red-500' : ''}
                data-testid="query-phone-input"
              />
              {validationErrors.phone && (
                <p className="text-xs text-red-500">{validationErrors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                value={newQuery.email} 
                onChange={(e) => setNewQuery({ ...newQuery, email: e.target.value })}
                placeholder="Enter email (optional)"
                data-testid="query-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input 
                value={newQuery.destination} 
                onChange={(e) => setNewQuery({ ...newQuery, destination: e.target.value })}
                placeholder="Enter destination (optional)"
                data-testid="query-destination-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Travel Date *</Label>
              <Input 
                type="date" 
                value={newQuery.travelDate} 
                onChange={(e) => setNewQuery({ ...newQuery, travelDate: e.target.value })}
                required
                className={validationErrors.travelDate ? 'border-red-500' : ''}
                data-testid="query-travel-date-input"
              />
              {validationErrors.travelDate && (
                <p className="text-xs text-red-500">{validationErrors.travelDate}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nights *</Label>
              <Input 
                type="number" 
                min="1" 
                value={newQuery.nights} 
                onChange={(e) => setNewQuery({ ...newQuery, nights: parseInt(e.target.value) || 1 })}
                required
                className={validationErrors.nights ? 'border-red-500' : ''}
                data-testid="query-nights-input"
              />
              {validationErrors.nights && (
                <p className="text-xs text-red-500">{validationErrors.nights}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Adults *</Label>
              <Input 
                type="number" 
                min="1" 
                value={newQuery.adults} 
                onChange={(e) => setNewQuery({ ...newQuery, adults: parseInt(e.target.value) || 1 })}
                required
                className={validationErrors.adults ? 'border-red-500' : ''}
                data-testid="query-adults-input"
              />
              {validationErrors.adults && (
                <p className="text-xs text-red-500">{validationErrors.adults}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Children</Label>
              <Input 
                type="number" 
                min="0" 
                value={newQuery.children} 
                onChange={(e) => setNewQuery({ ...newQuery, children: parseInt(e.target.value) || 0 })}
                data-testid="query-children-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Quote Amount (₹)</Label>
              <Input 
                type="number" 
                min="0" 
                value={newQuery.quote} 
                onChange={(e) => setNewQuery({ ...newQuery, quote: parseInt(e.target.value) || 0 })}
                data-testid="query-quote-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Tour Package *</Label>
              <Select 
                value={newQuery.tourPackage || ""} 
                onValueChange={(v) => setNewQuery({ ...newQuery, tourPackage: v === "none" ? "" : v })}
                required
              >
                <SelectTrigger 
                  data-testid="query-package-select"
                  className={validationErrors.tourPackage ? 'border-red-500' : ''}
                >
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No package selected</SelectItem>
                  {packages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.tourPackage && (
                <p className="text-xs text-red-500">{validationErrors.tourPackage}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select 
                value={newQuery.assignedTo || ""} 
                onValueChange={(v) => setNewQuery({ ...newQuery, assignedTo: v === "none" ? "" : v })}
              >
                <SelectTrigger data-testid="query-assigned-select">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next Follow-up</Label>
              <Input 
                type="datetime-local" 
                value={newQuery.nextFollowUp} 
                onChange={(e) => setNewQuery({ ...newQuery, nextFollowUp: e.target.value })}
                data-testid="query-followup-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Pick-up Location</Label>
              <Input 
                value={newQuery.pickUp} 
                onChange={(e) => setNewQuery({ ...newQuery, pickUp: e.target.value })}
                data-testid="query-pickup-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Drop-off Location</Label>
              <Input 
                value={newQuery.dropOff} 
                onChange={(e) => setNewQuery({ ...newQuery, dropOff: e.target.value })}
                data-testid="query-dropoff-input"
              />
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={newQuery.notes} 
                onChange={(e) => setNewQuery({ ...newQuery, notes: e.target.value })} 
                rows={2}
                data-testid="query-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false)
              setValidationErrors({})
            }}>Cancel</Button>
            <Button 
              onClick={handleCreateQuery} 
              disabled={!isMandatoryFieldsFilled()}
              data-testid="create-query-button"
              className={!isMandatoryFieldsFilled() ? 'opacity-50 cursor-not-allowed' : ''}
            >
              Create Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Follow-up</DialogTitle>
            <DialogDescription>
              {selectedQuery?.customerName} - {selectedQuery?.queryNumber}
            </DialogDescription>
          </DialogHeader>
          
          {/* Previous Follow-ups */}
          {selectedQuery?.followUps && selectedQuery.followUps.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase">Previous Follow-ups</p>
              {selectedQuery.followUps.slice().reverse().map((fu, idx) => (
                <div key={idx} className="bg-background rounded-lg p-3 border">
                  <p className="text-sm">{fu.note}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{fu.createdBy || 'System'}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(fu.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Follow-up Note *</Label>
              <Textarea 
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="Enter follow-up details..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Schedule Next Follow-up (Optional)</Label>
              <Input 
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>Cancel</Button>
            <Button onClick={handleAddFollowUp}>Save Follow-up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
