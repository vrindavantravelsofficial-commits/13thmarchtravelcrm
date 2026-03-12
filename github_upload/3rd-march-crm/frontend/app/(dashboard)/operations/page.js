'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar as CalendarIcon } from 'lucide-react'
import { 
  Settings2, Search, RefreshCw, CheckCircle, Eye, Calendar, 
  Hotel, Car, Users, AlertCircle, Plus, Check, X, 
  Clock, MapPin, Phone, Mail, FileText, Package, Bell, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function OperationsPage() {
  const { getToken, user } = useAuth()
  const router = useRouter()
  const [queries, setQueries] = useState([])
  const [itineraries, setItineraries] = useState({})
  const [bookings, setBookings] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [showBookingDialog, setShowBookingDialog] = useState(false)
  const [showExtraServiceDialog, setShowExtraServiceDialog] = useState(false)
  const [bookingType, setBookingType] = useState('')
  const [bookingItem, setBookingItem] = useState(null)
  const [extraService, setExtraService] = useState({ name: '', date: '', notes: '', status: 'pending' })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [upcomingNotifications, setUpcomingNotifications] = useState([])
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    // Only fetch once when component mounts
    if (!hasFetchedRef.current && user) {
      const userRoles = user?.roles || []
      const hasOperationsRole = userRoles.includes('operations')
      const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin')
      
      if (!hasOperationsRole && !isAdmin && !user.isSuperAdmin) {
        toast.error('Access denied - Operations team only')
        router.push('/dashboard')
        return
      }
      
      hasFetchedRef.current = true
      fetchData()
    }
  }, [user]) // Only depend on user, not on other state changes

  const fetchData = async () => {
    setLoading(true)
    try {
      const timestamp = Date.now()
      const token = getToken()
      
      // Fetch only confirmed/ongoing queries (operations-ready)
      const queriesRes = await fetch(`/api/queries?_t=${timestamp}`, { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'max-age=30' // Cache for 30 seconds
        }
      })
      const allQueriesData = await queriesRes.json()
      
      // Filter to only confirmed queries with upcoming travel dates (next 30 days)
      const today = new Date()
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const queriesData = allQueriesData.filter(q => {
        if (q.status !== 'confirmed') return false
        if (!q.travelDate) return true // Include if no date
        const travelDate = new Date(q.travelDate)
        return travelDate >= today && travelDate <= thirtyDaysFromNow
      }).slice(0, 10) // LIMIT to max 10 queries for instant loading
      
      console.log(`Filtered to ${queriesData.length} upcoming confirmed trips (max 10)`)
      
      // Fetch itineraries in PARALLEL (much faster!)
      const itinerariesMap = {}
      const queriesWithConfirmedQuotes = []
      
      // Fetch all itineraries in parallel instead of sequential
      const itineraryPromises = queriesData.map(async (query) => {
        try {
          const itinRes = await fetch(`/api/itineraries/query/${query.id}?_t=${timestamp}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (itinRes.ok) {
            const itinData = await itinRes.json()
            if (Array.isArray(itinData) && itinData.length > 0) {
              // Find the CONFIRMED quote (not just latest)
              const confirmedQuote = itinData.find(itin => itin.status === 'confirmed')
              if (confirmedQuote) {
                return { queryId: query.id, itinerary: confirmedQuote, query }
              }
            }
          }
        } catch (e) {
          console.error(`Failed to fetch itinerary for query ${query.id}`)
        }
        return null
      })
      
      // Wait for all parallel requests to complete
      const results = await Promise.all(itineraryPromises)
      
      // Process results
      results.forEach(result => {
        if (result) {
          itinerariesMap[result.queryId] = result.itinerary
          queriesWithConfirmedQuotes.push(result.query)
        }
      })
      
      // Only show queries that have a confirmed quote
      setQueries(queriesWithConfirmedQuotes)
      setItineraries(itinerariesMap)
      
      // Load bookings from localStorage
      const savedBookings = localStorage.getItem('operationsBookings')
      if (savedBookings) {
        setBookings(JSON.parse(savedBookings))
      }
      
      // Calculate upcoming trip notifications (only for queries with confirmed quotes)
      calculateUpcomingNotifications(queriesWithConfirmedQuotes)
      
    } catch (e) {
      console.error(e)
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const calculateUpcomingNotifications = (confirmedQueries) => {
    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const upcoming = confirmedQueries.filter(q => {
      if (!q.travelDate) return false
      const travelDate = new Date(q.travelDate)
      return travelDate >= now && travelDate <= sevenDaysLater
    }).sort((a, b) => new Date(a.travelDate) - new Date(b.travelDate))
    
    setUpcomingNotifications(upcoming)
  }

  const saveBookings = (newBookings) => {
    setBookings(newBookings)
    localStorage.setItem('operationsBookings', JSON.stringify(newBookings))
  }

  const getQueryBookings = (queryId) => {
    return bookings[queryId] || {
      hotels: {},
      transports: {},
      guides: {},
      extraServices: []
    }
  }

  const markAsBooked = async (queryId, type, itemId) => {
    const newBookings = { ...bookings }
    if (!newBookings[queryId]) {
      newBookings[queryId] = { hotels: {}, transports: {}, guides: {}, extraServices: [] }
    }
    newBookings[queryId][type][itemId] = {
      status: 'booked',
      bookedAt: new Date().toISOString(),
      bookedBy: user?.name || 'Operations'
    }
    saveBookings(newBookings)
    
    // Log activity
    await logActivity(queryId, 'booking', `Marked ${type === 'hotels' ? 'hotel' : 'transport'} as booked`)
    
    toast.success('Marked as booked!')
    setShowBookingDialog(false)
  }

  const markAsUnbooked = async (queryId, type, itemId) => {
    const newBookings = { ...bookings }
    if (newBookings[queryId] && newBookings[queryId][type] && newBookings[queryId][type][itemId]) {
      delete newBookings[queryId][type][itemId]
      saveBookings(newBookings)
      
      // Log activity
      await logActivity(queryId, 'booking', `Unmarked ${type === 'hotels' ? 'hotel' : 'transport'} - reverted to unbooked`)
      
      toast.success('Marked as unbooked!')
    }
  }

  const logActivity = async (queryId, type, message) => {
    try {
      const token = getToken()
      await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          queryId,
          type,
          message,
          user: user?.name || 'Operations User',
          userId: user?.id
        })
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }

  const addExtraService = (queryId) => {
    if (!extraService.name.trim()) {
      toast.error('Please enter service name')
      return
    }
    
    const newBookings = { ...bookings }
    if (!newBookings[queryId]) {
      newBookings[queryId] = { hotels: {}, transports: {}, guides: {}, extraServices: [] }
    }
    
    newBookings[queryId].extraServices.push({
      ...extraService,
      id: Date.now().toString(),
      addedAt: new Date().toISOString(),
      addedBy: user?.name || 'Operations'
    })
    
    saveBookings(newBookings)
    toast.success('Extra service added!')
    setShowExtraServiceDialog(false)
    setExtraService({ name: '', date: '', notes: '', status: 'pending' })
  }

  const updateExtraServiceStatus = (queryId, serviceId, newStatus) => {
    const newBookings = { ...bookings }
    const service = newBookings[queryId]?.extraServices?.find(s => s.id === serviceId)
    if (service) {
      service.status = newStatus
      service.updatedAt = new Date().toISOString()
      service.bookedBy = user?.name || 'Operations'
      saveBookings(newBookings)
      toast.success(`Service marked as ${newStatus}`)
    }
  }

  const getPendingActions = (query) => {
    const itinerary = itineraries[query.id]
    const queryBookings = getQueryBookings(query.id)
    const pending = []

    if (!itinerary) {
      return [{ type: 'quote', message: 'No itinerary/quote created yet' }]
    }

    // Check hotels
    const hotels = itinerary.hotelSelections || []
    const unbookedHotels = hotels.filter((h, idx) => !queryBookings.hotels[`${h.hotelId || ''}-${idx}`])
    if (unbookedHotels.length > 0) {
      pending.push({ type: 'hotel', count: unbookedHotels.length, message: `${unbookedHotels.length} hotel(s) pending` })
    }

    // Check transports
    const transports = itinerary.transportSelections || []
    const unbookedTransports = transports.filter((t, idx) => !queryBookings.transports[`${t.transportId || ''}-${idx}`])
    if (unbookedTransports.length > 0) {
      pending.push({ type: 'transport', count: unbookedTransports.length, message: `${unbookedTransports.length} transport(s) pending` })
    }

    // Check extra services
    const pendingServices = queryBookings.extraServices?.filter(s => s.status === 'pending') || []
    if (pendingServices.length > 0) {
      pending.push({ type: 'service', count: pendingServices.length, message: `${pendingServices.length} extra service(s) pending` })
    }

    return pending
  }

  const getUpcomingTrips = () => {
    const confirmed = queries.filter(q => q.status === 'confirmed' && q.travelDate)
    return confirmed
      .sort((a, b) => new Date(a.travelDate) - new Date(b.travelDate))
      .filter(q => new Date(q.travelDate) >= new Date())
  }

  const getDaysUntilTrip = (travelDate) => {
    const days = Math.ceil((new Date(travelDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days
  }

  // queries state now only contains queries with confirmed quotes
  const filteredQueries = queries.filter(q =>
    q.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    q.destination?.toLowerCase().includes(search.toLowerCase()) ||
    q.queryNumber?.toLowerCase().includes(search.toLowerCase())
  )

  const queriesWithPending = filteredQueries.filter(q => getPendingActions(q).length > 0)
  const queriesCompleted = filteredQueries.filter(q => getPendingActions(q).length === 0)

  return (
    <div className="space-y-6">
      {/* Notification Bell for Upcoming Trips */}
      {upcomingNotifications.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-orange-600 mt-1 animate-pulse" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-300">
                  {upcomingNotifications.length} Upcoming Trip{upcomingNotifications.length > 1 ? 's' : ''} (Within 7 Days)
                </h3>
                <div className="mt-2 space-y-1">
                  {upcomingNotifications.slice(0, 3).map(trip => (
                    <div key={trip.id} className="text-sm text-orange-700 dark:text-orange-400">
                      • {trip.queryNumber} - {trip.customerName} - {new Date(trip.travelDate).toLocaleDateString()} ({getDaysUntilTrip(trip.travelDate)} days)
                    </div>
                  ))}
                  {upcomingNotifications.length > 3 && (
                    <div className="text-sm text-orange-600">+ {upcomingNotifications.length - 3} more...</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Operations Management</h1>
          <p className="text-muted-foreground mt-1">Manage bookings and operations for confirmed queries</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search queries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Confirmed Quotes</CardTitle>
            <CheckCircle className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{queries.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Pending Actions</CardTitle>
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{queriesWithPending.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Completed</CardTitle>
            <Check className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">{queriesCompleted.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Upcoming (7d)</CardTitle>
            <Calendar className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {upcomingNotifications.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Confirmed Quotes ({filteredQueries.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({queriesWithPending.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-muted-foreground">Loading operations...</span>
                </div>
              </CardContent>
            </Card>
          ) : filteredQueries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No confirmed quotes found. Quotes need to be confirmed in the Itinerary Builder to appear here.
              </CardContent>
            </Card>
          ) : (
            filteredQueries.map(query => (
              <QueryOperationCard 
                key={query.id}
                query={query}
                itinerary={itineraries[query.id]}
                bookings={getQueryBookings(query.id)}
                pendingActions={getPendingActions(query)}
                onMarkBooked={(type, item, idx) => {
                  setBookingType(type)
                  setBookingItem({ ...item, idx })
                  setSelectedQuery(query)
                  setShowBookingDialog(true)
                }}
                onUnbook={(type, item, idx) => {
                  const itemId = `${item.hotelId || item.transportId || ''}-${idx}`
                  markAsUnbooked(query.id, type === 'hotel' ? 'hotels' : 'transports', itemId)
                }}
                onAddService={() => {
                  setSelectedQuery(query)
                  setShowExtraServiceDialog(true)
                }}
                onUpdateServiceStatus={updateExtraServiceStatus}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {queriesWithPending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No pending actions at the moment</p>
              </CardContent>
            </Card>
          ) : (
            queriesWithPending.map(query => (
              <QueryOperationCard 
                key={query.id}
                query={query}
                itinerary={itineraries[query.id]}
                bookings={getQueryBookings(query.id)}
                pendingActions={getPendingActions(query)}
                onMarkBooked={(type, item, idx) => {
                  setBookingType(type)
                  setBookingItem({ ...item, idx })
                  setSelectedQuery(query)
                  setShowBookingDialog(true)
                }}
                onUnbook={(type, item, idx) => {
                  const itemId = `${item.hotelId || item.transportId || ''}-${idx}`
                  markAsUnbooked(query.id, type === 'hotel' ? 'hotels' : 'transports', itemId)
                }}
                onAddService={() => {
                  setSelectedQuery(query)
                  setShowExtraServiceDialog(true)
                }}
                onUpdateServiceStatus={updateExtraServiceStatus}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <CalendarView 
            trips={getUpcomingTrips()} 
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            getDaysUntil={getDaysUntilTrip}
            onViewQuery={(q) => router.push(`/queries/${q.id}`)}
          />
        </TabsContent>
      </Tabs>

      {/* Booking Confirmation Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Mark this {bookingType} as booked for {selectedQuery?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this as booked? This action will update the booking status.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookingDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              const itemId = `${bookingItem?.hotelId || bookingItem?.transportId || ''}-${bookingItem?.idx}`
              markAsBooked(selectedQuery?.id, bookingType === 'hotel' ? 'hotels' : 'transports', itemId)
            }}>
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extra Service Dialog */}
      <Dialog open={showExtraServiceDialog} onOpenChange={setShowExtraServiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extra Service</DialogTitle>
            <DialogDescription>
              Add extra service for {selectedQuery?.customerName} - {selectedQuery?.queryNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input 
                placeholder="e.g., VIP Darshan, E-Ricksha, Passes for Ayodhya"
                value={extraService.name}
                onChange={(e) => setExtraService({ ...extraService, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Required Date</Label>
              <Input 
                type="date"
                value={extraService.date}
                onChange={(e) => setExtraService({ ...extraService, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                placeholder="Additional details or instructions..."
                value={extraService.notes}
                onChange={(e) => setExtraService({ ...extraService, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtraServiceDialog(false)}>Cancel</Button>
            <Button onClick={() => addExtraService(selectedQuery?.id)}>Add Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Query Operation Card Component
function QueryOperationCard({ query, itinerary, bookings, pendingActions, onMarkBooked, onUnbook, onAddService, onUpdateServiceStatus }) {
  const [expanded, setExpanded] = useState(false)

  const hotels = itinerary?.hotelSelections || []
  const transports = itinerary?.transportSelections || []
  const quoteExtraServices = itinerary?.extraServices || [] // Extra services from quote
  const manualExtraServices = bookings?.extraServices || [] // Manually added extra services
  
  // Combine both types of extra services
  const allExtraServices = [
    ...quoteExtraServices.map(s => ({ ...s, fromQuote: true, id: `quote-${s.name}-${s.day}` })),
    ...manualExtraServices
  ]

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Calculate check-in and check-out dates for each hotel based on query travel date
  const calculateHotelDates = (hotelIndex) => {
    if (!query.travelDate) {
      return { checkIn: null, checkOut: null }
    }

    // Parse date properly to avoid timezone issues
    const travelDateStr = query.travelDate.split('T')[0] // Get YYYY-MM-DD part only
    const [year, month, day] = travelDateStr.split('-').map(Number)
    const travelDate = new Date(year, month - 1, day) // Month is 0-indexed
    
    // Calculate cumulative nights before this hotel
    let nightsBeforeThisHotel = 0
    for (let i = 0; i < hotelIndex; i++) {
      nightsBeforeThisHotel += hotels[i]?.nights || 0
    }
    
    // Check-in is travel date + nights before this hotel
    const checkIn = new Date(travelDate)
    checkIn.setDate(checkIn.getDate() + nightsBeforeThisHotel)
    
    // Check-out is check-in + nights for this hotel
    const checkOut = new Date(checkIn)
    const hotelNights = hotels[hotelIndex]?.nights || 0
    checkOut.setDate(checkOut.getDate() + hotelNights)
    
    return { checkIn, checkOut }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{query.queryNumber}</CardTitle>
              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Quote Confirmed
              </Badge>
              {pendingActions.length > 0 && (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                  {pendingActions.length} Pending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {query.customerName}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {query.destination || 'N/A'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(query.travelDate)}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {query.nights || 0}N / {(query.adults || 0)}A {(query.children || 0)}C
              </span>
              {itinerary?.totalCost > 0 && (
                <span className="flex items-center gap-1 font-medium text-green-700">
                  ₹{itinerary.totalCost.toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Hide' : 'Details'}
            </Button>
          </div>
        </div>

        {pendingActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingActions.map((action, idx) => (
              <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-900/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                {action.message}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 space-y-4">
          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{query.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{query.email || 'N/A'}</span>
            </div>
          </div>

          {!itinerary ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No itinerary created yet</p>
            </div>
          ) : (
            <>
              {/* Hotels - Show Exact Quote Details */}
              {hotels.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Hotel className="w-4 h-4" />
                    Hotels from Latest Quote ({hotels.length})
                  </h4>
                  <div className="space-y-2">
                    {hotels.map((hotel, idx) => {
                      const isBooked = bookings?.hotels?.[`${hotel.hotelId || ''}-${idx}`]
                      const { checkIn, checkOut } = calculateHotelDates(idx)
                      
                      return (
                        <div key={idx} className="p-3 border rounded-lg bg-white dark:bg-slate-900">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-base">{hotel.hotelName || `Hotel ${idx + 1}`}</p>
                              {hotel.hotelLocation && (
                                <p className="text-sm text-muted-foreground">📍 {hotel.hotelLocation}</p>
                              )}
                              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                                <p>• Nights: <span className="font-medium text-foreground">{hotel.nights || 'N/A'}</span></p>
                                <p>• Rooms: <span className="font-medium text-foreground">{hotel.rooms || 1}</span> ({hotel.roomType || 'Standard'})</p>
                                <p>• Meal Plan: <span className="font-medium text-foreground">{hotel.mealPlan || 'Not specified'}</span></p>
                                <p>• Check-in: <span className="font-medium text-foreground">
                                  {checkIn ? formatDate(checkIn) : (hotel.checkIn ? formatDate(hotel.checkIn) : 'N/A')}
                                </span></p>
                                <p>• Check-out: <span className="font-medium text-foreground">
                                  {checkOut ? formatDate(checkOut) : (hotel.checkOut ? formatDate(hotel.checkOut) : 'N/A')}
                                </span></p>
                                <p>• Guests: <span className="font-medium text-foreground">{hotel.adultsPerRoom || 0} Adults + {hotel.childrenPerRoom || 0} Children per room</span></p>
                                {hotel.pricePerNight > 0 && (
                                  <p>• Price: <span className="font-medium text-foreground">₹{hotel.pricePerNight}/night</span></p>
                                )}
                              </div>
                            </div>
                            {isBooked ? (
                              <div className="ml-3 space-y-2">
                                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  <Check className="w-3 h-3 mr-1" />
                                  Booked
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  by {isBooked.bookedBy}
                                </p>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => onUnbook('hotel', hotel, idx)}
                                  className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Unbook
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => onMarkBooked('hotel', hotel, idx)} className="ml-3">
                                Mark Booked
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Transports - Show Exact Quote Details */}
              {transports.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Vehicles from Latest Quote ({transports.length})
                  </h4>
                  <div className="space-y-2">
                    {transports.map((transport, idx) => {
                      const isBooked = bookings?.transports?.[`${transport.transportId || ''}-${idx}`]
                      return (
                        <div key={idx} className="p-3 border rounded-lg bg-white dark:bg-slate-900">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-base">
                                {transport.vehicleType || 'Vehicle'} - {transport.vehicleName || `Vehicle ${idx + 1}`}
                              </p>
                              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                                <p>• Days: <span className="font-medium text-foreground">{transport.days || 1}</span></p>
                                <p>• Quantity: <span className="font-medium text-foreground">{transport.quantity || 1}</span></p>
                                {transport.amount > 0 && (
                                  <p>• Amount: <span className="font-medium text-foreground">₹{transport.amount}</span></p>
                                )}
                              </div>
                            </div>
                            {isBooked ? (
                              <div className="ml-3 space-y-2">
                                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  <Check className="w-3 h-3 mr-1" />
                                  Booked
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  by {isBooked.bookedBy}
                                </p>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => onUnbook('transport', transport, idx)}
                                  className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Unbook
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => onMarkBooked('transport', transport, idx)} className="ml-3">
                                Mark Booked
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Extra Services - Both from Quote and Manually Added */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Extra Services ({allExtraServices.length})
                  </h4>
                  <Button size="sm" variant="outline" onClick={onAddService}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Manual Service
                  </Button>
                </div>
                {allExtraServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No extra services in quote or added manually</p>
                ) : (
                  <div className="space-y-2">
                    {allExtraServices.map((service, idx) => {
                      const isFromQuote = service.fromQuote
                      const isBooked = isFromQuote 
                        ? bookings?.quoteServices?.[service.id]
                        : service.status === 'booked'
                      
                      return (
                        <div key={service.id || idx} className={`p-3 border rounded-lg ${isFromQuote ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-white dark:bg-slate-900'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{service.name}</p>
                                {isFromQuote && (
                                  <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">
                                    From Quote
                                  </Badge>
                                )}
                              </div>
                              {service.day && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  Day {service.day}
                                </p>
                              )}
                              {service.date && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  Required by: {formatDate(service.date)}
                                </p>
                              )}
                              {service.charges > 0 && (
                                <p className="text-sm font-medium text-foreground mt-1">
                                  Charges: ₹{service.charges}
                                </p>
                              )}
                              {service.notes && (
                                <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-2 rounded">
                                  <strong>Note:</strong> {service.notes}
                                </p>
                              )}
                              {!isFromQuote && service.addedBy && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Added by {service.addedBy} on {formatDate(service.addedAt)}
                                </p>
                              )}
                            </div>
                            <div className="ml-3">
                              {isBooked || service.status === 'booked' ? (
                                <>
                                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <Check className="w-3 h-3 mr-1" />
                                    Booked
                                  </Badge>
                                  {service.bookedBy && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      by {service.bookedBy}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    if (isFromQuote) {
                                      // Handle quote service booking
                                      const newBookings = { ...bookings }
                                      if (!newBookings.quoteServices) newBookings.quoteServices = {}
                                      newBookings.quoteServices[service.id] = {
                                        status: 'booked',
                                        bookedAt: new Date().toISOString(),
                                        bookedBy: 'Operations'
                                      }
                                      localStorage.setItem('operationsBookings', JSON.stringify(newBookings))
                                      window.location.reload() // Refresh to show updated status
                                    } else {
                                      onUpdateServiceStatus(query.id, service.id, 'booked')
                                    }
                                  }}
                                >
                                  Mark Booked
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// Calendar View Component
function CalendarView({ trips, currentMonth, setCurrentMonth, getDaysUntil, onViewQuery }) {
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }
  
  const getTripsForDate = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const dateStr = date.toISOString().split('T')[0]
    return trips.filter(trip => trip.travelDate && trip.travelDate.split('T')[0] === dateStr)
  }
  
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Upcoming Trips Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-[180px] text-center">{monthName}</span>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-semibold text-sm p-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before month starts */}
          {[...Array(firstDayOfMonth)].map((_, idx) => (
            <div key={`empty-${idx}`} className="p-2"></div>
          ))}
          
          {/* Calendar days */}
          {[...Array(daysInMonth)].map((_, idx) => {
            const day = idx + 1
            const tripsForDay = getTripsForDate(day)
            const hasTrips = tripsForDay.length > 0
            const isToday = new Date().getDate() === day && 
                           new Date().getMonth() === currentMonth.getMonth() &&
                           new Date().getFullYear() === currentMonth.getFullYear()
            
            return (
              <div
                key={day}
                className={`relative min-h-[80px] p-2 border rounded-lg ${
                  isToday ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                } ${hasTrips ? 'bg-orange-50 dark:bg-orange-950 border-orange-300 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900' : 'hover:bg-muted/50'}`}
                title={hasTrips ? `${tripsForDay.length} trip(s) on this day` : ''}
              >
                <div className="text-sm font-medium">{day}</div>
                {hasTrips && (
                  <div className="mt-1">
                    <Badge className="bg-orange-600 text-white text-xs">
                      {tripsForDay.length} trip{tripsForDay.length > 1 ? 's' : ''}
                    </Badge>
                    <div className="mt-1 space-y-1">
                      {tripsForDay.map(trip => (
                        <div 
                          key={trip.id}
                          className="text-xs p-1 bg-white dark:bg-slate-800 rounded border cursor-pointer hover:bg-blue-50"
                          onClick={() => onViewQuery(trip)}
                        >
                          <div className="font-medium truncate">{trip.queryNumber}</div>
                          <div className="text-muted-foreground truncate">{trip.customerName}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-2">Legend:</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-50 border border-orange-300 rounded"></div>
              <span>Has trips</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
