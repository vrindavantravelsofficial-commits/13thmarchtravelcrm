'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowLeft, User, Phone, Mail, MapPin, Calendar, Users, 
  FileText, Clock, Download, Eye, Plus, Edit, MessageSquare,
  Activity, RefreshCw, DollarSign, UserCheck, Tag
} from 'lucide-react'

// Time ago helper
const timeAgo = (date) => {
  if (!date) return ''
  const now = new Date()
  const then = new Date(date)
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return then.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Format date time
const formatDateTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function QueryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { getToken, user } = useAuth()
  const [query, setQuery] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [packages, setPackages] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [followUpNote, setFollowUpNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [editForm, setEditForm] = useState({})

  // Query Sources
  const QUERY_SOURCES = [
    { id: 'DQ', label: 'DQ' },
    { id: 'AVT', label: 'AVT.com' },
    { id: 'VP', label: 'VrindavanPackages' },
    { id: 'FB', label: 'Facebook' },
    { id: 'IG', label: 'Instagram' },
    { id: 'WA', label: 'WhatsApp' },
    { id: 'REF', label: 'Referral' },
    { id: 'WEB', label: 'Website' },
    { id: 'GOOGLE', label: 'Google Leads' },
    { id: 'META', label: 'Meta Leads' },
  ]

  useEffect(() => {
    // Load from cache INSTANTLY if available
    const cachedQuery = sessionStorage.getItem(`query_${params.id}`)
    if (cachedQuery) {
      try {
        const parsed = JSON.parse(cachedQuery)
        setQuery(parsed.query)
        setQuotes(parsed.quotes || [])
        setPackages(parsed.packages || [])
        setUsers(parsed.users || [])
        setLoading(false) // Show cached data immediately
      } catch (e) {}
    }
    
    // Then fetch fresh data in background
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    try {
      const token = await getToken()
      // Use cache for faster loading
      const [queryRes, quotesRes, packagesRes, usersRes] = await Promise.all([
        fetch(`/api/queries/${params.id}`, { 
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/itineraries/query/${params.id}`, { 
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/packages`, { 
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/users`, { 
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])
      const queryData = await queryRes.json()
      const quotesData = await quotesRes.json()
      const packagesData = await packagesRes.json()
      const usersData = await usersRes.json()
      
      setQuery(queryData)
      setQuotes(Array.isArray(quotesData) ? quotesData : quotesData ? [quotesData] : [])
      setPackages(packagesData)
      setUsers(usersData)
      
      // Cache for instant loading next time
      sessionStorage.setItem(`query_${params.id}`, JSON.stringify({
        query: queryData,
        quotes: Array.isArray(quotesData) ? quotesData : quotesData ? [quotesData] : [],
        packages: packagesData,
        users: usersData
      }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to log activities
  const logActivity = async (activityData) => {
    try {
      const authToken = await getToken()
      await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(activityData)
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }

  const handleStatusChange = async (newStatus) => {
    const oldStatus = query.status
    setUpdatingStatus(true)
    
    // Optimistic update
    setQuery(prev => ({ ...prev, status: newStatus }))
    
    try {
      const authToken = await getToken()
      const response = await fetch(`/api/queries/${params.id}?_t=${Date.now()}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }
      
      const updatedQuery = await response.json()
      setQuery(updatedQuery)
      
      // Log activity for status change
      await logActivity({
        queryId: params.id,
        type: 'status_change',
        message: `changed status from ${oldStatus} to ${newStatus}`,
        user: user?.name || 'User',
        userId: user?.id
      })
      
      // Immediately fetch fresh data to ensure UI is in sync
      await fetchData()
      
      toast.success(`Status updated to ${newStatus.toUpperCase()}`)
      
      // Show operations message if confirmed
      if (newStatus === 'confirmed') {
        setTimeout(() => {
          toast.info('Query is now confirmed! Operations team can start processing.')
        }, 500)
      }
    } catch (e) {
      // Revert on error
      setQuery(prev => ({ ...prev, status: oldStatus }))
      toast.error(e.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleAddFollowUp = async () => {
    if (!followUpNote.trim()) {
      toast.error('Please enter a follow-up note')
      return
    }
    try {
      const newFollowUp = {
        note: followUpNote,
        scheduledDate: followUpDate || null,
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'System'
      }
      
      const updatedFollowUps = [...(query.followUps || []), newFollowUp]
      
      // Auto-update status to ongoing if it's new
      const updateData = {
        followUps: updatedFollowUps,
        lastFollowUp: new Date().toISOString(),
        nextFollowUp: followUpDate || null
      }
      
      if (query.status === 'new') {
        updateData.status = 'ongoing'
      }
      
      const authToken = await getToken()
      await fetch(`/api/queries/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(updateData)
      })
      
      setQuery({ 
        ...query, 
        ...updateData
      })
      setShowFollowUpDialog(false)
      setFollowUpNote('')
      setFollowUpDate('')
      
      // Log activity for follow-up
      await logActivity({
        queryId: params.id,
        type: 'followup',
        message: `added follow-up: "${followUpNote}"`,
        user: user?.name || 'User',
        userId: user?.id
      })
      
      toast.success('Follow-up added')
      
      if (query.status === 'new') {
        toast.info('Query status updated to Ongoing')
      }
    } catch (e) {
      toast.error('Failed to add follow-up')
    }
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId: params.id })
      })
      
      if (!response.ok) throw new Error('Failed to generate PDF')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `itinerary_${query?.customerName?.replace(/\s+/g, '_') || 'guest'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('PDF downloaded!')
    } catch (error) {
      toast.error('Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const openEditDialog = () => {
    if (!query) {
      toast.error('Query data not loaded yet')
      return
    }
    setEditForm({
      customerName: query.customerName || '',
      email: query.email || '',
      phone: query.phone || '',
      destination: query.destination || '',
      travelDate: query.travelDate ? query.travelDate.split('T')[0] : '',
      nights: query.nights || 1,
      adults: query.adults || 1,
      children: query.children || 0,
      source: query.source || 'DQ',
      tourPackage: query.tourPackage || '',
      quote: query.quote || 0,
      assignedTo: query.assignedTo || '',
      notes: query.notes || '',
      pickUp: query.pickUp || '',
      dropOff: query.dropOff || ''
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    try {
      console.log('handleSaveEdit: Starting...', { query, editForm })
      
      const updatedQuery = { ...query, ...editForm }
      
      // Convert 'none' back to empty string for tourPackage
      if (updatedQuery.tourPackage === 'none') {
        updatedQuery.tourPackage = ''
      }
      
      // Auto-update status to ongoing if it's new
      if (query.status === 'new') {
        updatedQuery.status = 'ongoing'
      }
      
      // Remove fields that don't exist in the database schema
      const { 
        activities,           // doesn't exist in queries table
        followUps,            // doesn't exist in queries table
        queryNumber,          // read-only, generated by DB
        queryId,              // read-only, generated by DB
        createdAt,            // read-only, set by DB
        updatedAt,            // read-only, set by DB
        organizationId,       // read-only, set by context
        createdBy,            // read-only, set by context
        ...validFields 
      } = updatedQuery
      
      console.log('handleSaveEdit: Sending data:', validFields)
      
      const response = await fetch(`/api/queries/${params.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify(validFields)
      })
      
      console.log('handleSaveEdit: Response status:', response.status, response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error response:', errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || errorData.message || 'Failed to update query')
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} - ${errorText}`)
        }
      }
      
      const savedQuery = await response.json()
      console.log('handleSaveEdit: Saved successfully:', savedQuery)
      
      // Update local state with server response
      setQuery(savedQuery)
      setShowEditDialog(false)
      
      // Log activity for query edit
      const changedFields = []
      Object.keys(editForm).forEach(key => {
        if (query[key] !== editForm[key]) {
          changedFields.push(key)
        }
      })
      
      if (changedFields.length > 0) {
        await logActivity({
          queryId: params.id,
          type: 'edit',
          message: `updated query details (${changedFields.join(', ')})`,
          user: user?.name || 'User',
          userId: user?.id
        })
      }
      
      // Refresh all data from server to ensure consistency
      await fetchData()
      
      toast.success('Query updated successfully')
      
      if (query.status === 'new' && savedQuery.status === 'ongoing') {
        toast.info('Query status updated to Ongoing')
      }
    } catch (e) {
      console.error('Error in handleSaveEdit:', e)
      toast.error(e.message || 'Failed to update query')
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return <Badge className={styles[status] || styles.new}>{status?.toUpperCase()}</Badge>
  }

  const getPackageName = (id) => packages.find(p => p.id === id)?.name || id || 'N/A'
  const getUserName = (id) => users.find(u => u.id === id)?.name || 'Unassigned'

  const getActivityIcon = (type) => {
    switch (type) {
      case 'status_change': return <RefreshCw className="w-4 h-4" />
      case 'followup': return <MessageSquare className="w-4 h-4" />
      case 'quote': return <DollarSign className="w-4 h-4" />
      case 'assignment': return <UserCheck className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getActivityColor = (type) => {
    switch (type) {
      case 'status_change': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
      case 'followup': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
      case 'quote': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
      case 'assignment': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!query) {
    return (
      <div className="text-center py-12">
        <p>Query not found</p>
        <Button variant="link" onClick={() => router.push('/queries')}>Back to Queries</Button>
      </div>
    )
  }

  // Build activities from different sources
  const allActivities = [
    // Add quote activities
    ...quotes.map(q => ({
      type: 'quote',
      message: `gave quote with INR ${(q.totalCost || 0).toLocaleString()}`,
      user: q.createdBy || 'System',
      createdAt: q.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Add created activity
  if (query.createdAt) {
    allActivities.push({
      type: 'created',
      message: 'Query created',
      user: 'System',
      createdAt: query.createdAt
    })
  }
  
  // Add follow-up activities
  if (query.followUps && query.followUps.length > 0) {
    query.followUps.forEach(fu => {
      allActivities.push({
        type: 'followup',
        message: fu.note,
        user: fu.createdBy || 'System',
        createdAt: fu.createdAt
      })
    })
  }
  
  // Sort all activities by date
  allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/queries')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold">{query.queryNumber}</h1>
              {getStatusBadge(query.status)}
            </div>
            <p className="text-sm text-muted-foreground">{query.customerName} • {query.destination || 'No destination'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={openEditDialog} className="flex-1 sm:flex-none">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFollowUpDialog(true)} className="flex-1 sm:flex-none">
            <MessageSquare className="w-4 h-4 mr-2" /> Follow-up
          </Button>
          <Select value={query.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
            <SelectTrigger className="w-28 sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Link href={`/itinerary/${params.id}`}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">New</span> Quote
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-4 md:gap-6 min-w-max">
          {[
            { id: 'details', label: 'Basic Details' },
            { id: 'quotes', label: 'All Quotes' },
            { id: 'activities', label: 'Activities' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" /> Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{query.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{query.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{query.email || 'N/A'}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Source: <Badge variant="secondary">{query.source || 'DQ'}</Badge></span>
              </div>
            </CardContent>
          </Card>

          {/* Trip Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Trip Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{query.destination || getPackageName(query.tourPackage)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{query.travelDate ? new Date(query.travelDate).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{query.nights || 0} Nights / {(parseInt(query.nights) || 0) + 1} Days</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>{query.adults || 0} Adults, {query.children || 0} Children</span>
              </div>
            </CardContent>
          </Card>

          {/* Assignment & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" /> Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-muted-foreground" />
                <span>Sales: {getUserName(query.assignedTo)}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span>Quote: ₹{(query.quote || 0).toLocaleString()}</span>
              </div>
              {query.notes && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{query.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'quotes' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" /> All Quotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No quotes generated yet</p>
                <Link href={`/itinerary/${params.id}`}>
                  <Button variant="link">Create First Quote</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quoteNumber || 'Draft'}</TableCell>
                      <TableCell>₹{(quote.totalCost || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{quote.status || 'Draft'}</Badge></TableCell>
                      <TableCell>{new Date(quote.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/itinerary/${params.id}?quoteId=${quote.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleDownloadPDF} 
                          disabled={pdfLoading}
                        >
                          <Download className="w-4 h-4 mr-1" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'activities' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" /> Lead Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No activities yet</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                
                <div className="space-y-6">
                  {allActivities.map((activity, index) => (
                    <div key={index} className="relative flex gap-4 pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      
                      <div className="flex-1 bg-muted/30 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm">
                              <span className="font-semibold text-foreground">{activity.user}</span>
                              <span className="text-muted-foreground"> {activity.message}</span>
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {timeAgo(activity.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Follow-up</DialogTitle>
          </DialogHeader>
          
          {/* Previous Follow-ups */}
          {query.followUps && query.followUps.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase">Previous Follow-ups</p>
              {query.followUps.slice().reverse().map((fu, idx) => (
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

      {/* Edit Query Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {query && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Query - {query.queryNumber}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input 
                value={editForm.customerName || ''} 
                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input 
                value={editForm.phone || ''} 
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={editForm.email || ''} 
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Query Source</Label>
              <Select 
                value={editForm.source || 'DQ'} 
                onValueChange={(v) => setEditForm({ ...editForm, source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUERY_SOURCES.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input 
                value={editForm.destination || ''} 
                onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Travel Date</Label>
              <Input 
                type="date"
                value={editForm.travelDate || ''} 
                onChange={(e) => setEditForm({ ...editForm, travelDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nights</Label>
              <Input 
                type="number" min="1"
                value={editForm.nights || 1} 
                onChange={(e) => setEditForm({ ...editForm, nights: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input 
                type="number" min="1"
                value={editForm.adults || 1} 
                onChange={(e) => setEditForm({ ...editForm, adults: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Children</Label>
              <Input 
                type="number" min="0"
                value={editForm.children || 0} 
                onChange={(e) => setEditForm({ ...editForm, children: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tour Package</Label>
              <Select 
                value={editForm.tourPackage || 'none'} 
                onValueChange={(v) => setEditForm({ ...editForm, tourPackage: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {packages && packages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quote Amount (₹)</Label>
              <Input 
                type="number" min="0"
                value={editForm.quote || 0} 
                onChange={(e) => setEditForm({ ...editForm, quote: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select 
                value={editForm.assignedTo || ''} 
                onValueChange={(v) => setEditForm({ ...editForm, assignedTo: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {users && users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pick-up Location</Label>
              <Input 
                value={editForm.pickUp || ''} 
                onChange={(e) => setEditForm({ ...editForm, pickUp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Drop-off Location</Label>
              <Input 
                value={editForm.dropOff || ''} 
                onChange={(e) => setEditForm({ ...editForm, dropOff: e.target.value })}
              />
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={editForm.notes || ''} 
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
