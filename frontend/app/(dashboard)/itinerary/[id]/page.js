'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatInlineToWhatsApp, formatRichTextToWhatsAppLines, splitActivityTitleAndDetails } from '@/lib/richText'
import { 
  Hotel, Car, Route, FileText, ClipboardList, Plus, Trash2, 
  ArrowLeft, IndianRupee, Save, Download, Edit, X, MapPin, PlusCircle, CheckCircle2, Share2, Copy
} from 'lucide-react'

export default function ItineraryBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getToken, user } = useAuth()
  
  const [query, setQuery] = useState(null)
  const [hotels, setHotels] = useState([])
  const [activities, setActivities] = useState([])
  const [routes, setRoutes] = useState([])
  const [transports, setTransports] = useState([])
  const [packages, setPackages] = useState([])
  const [users, setUsers] = useState([])
  const [organization, setOrganization] = useState(null)
  const [existingItinerary, setExistingItinerary] = useState(null)
  const [loading, setLoading] = useState(true)

  // Itinerary state
  const [hotelSelections, setHotelSelections] = useState([])
  const [sameHotelForAll, setSameHotelForAll] = useState(false)
  const [transportSelections, setTransportSelections] = useState([])
  const [dayPlans, setDayPlans] = useState([])
  const [extraServices, setExtraServices] = useState([])
  const [inclusions, setInclusions] = useState([])
  const [exclusions, setExclusions] = useState([])
  const [newInclusion, setNewInclusion] = useState('')
  const [newExclusion, setNewExclusion] = useState('')
  const [markupPercent, setMarkupPercent] = useState(0)
  const [markupFixed, setMarkupFixed] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('hotels')
  const [showEditQuery, setShowEditQuery] = useState(false)
  const [editQueryData, setEditQueryData] = useState({})
  const [originalTotalCost, setOriginalTotalCost] = useState(0)

  useEffect(() => {
    // Load from cache INSTANTLY
    const cacheKey = `itinerary_${params.id}_${searchParams.get('quoteId') || 'new'}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setQuery(data.query)
        setHotels(data.hotels)
        setActivities(data.activities)
        setRoutes(data.routes)
        setTransports(data.transports)
        setPackages(data.packages)
        setUsers(data.users)
        if (data.existingItinerary) {
          setExistingItinerary(data.existingItinerary)
          initializeFromExisting(data.existingItinerary, data.query)
        }
        setLoading(false) // Show immediately
      } catch (e) {}
    }
    fetchAllData()
  }, [params.id])

  const fetchAllData = async () => {
    try {
      const token = await getToken()
      const quoteId = searchParams.get('quoteId')
      
      const [queryRes, hotelsRes, activitiesRes, routesRes, transportsRes, packagesRes, usersRes, orgRes] = await Promise.all([
        fetch(`/api/queries/${params.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/hotels', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/activities', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/routes', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/transports', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/organization', { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      
      const queryData = await queryRes.json()
      const hotelsData = await hotelsRes.json()
      const activitiesData = await activitiesRes.json()
      const routesData = await routesRes.json()
      const transportsData = await transportsRes.json()
      const packagesData = await packagesRes.json()
      const usersData = await usersRes.json()
      const orgData = await orgRes.json()
      
      setQuery(queryData)
      setEditQueryData({ ...queryData })
      setHotels(hotelsData)
      setActivities(activitiesData)
      setRoutes(routesData)
      setTransports(transportsData)
      setPackages(packagesData)
      setUsers(usersData)
      setOrganization(orgData)
      
      // Always fetch existing quotes to check if there are any
      const quotesRes = await fetch(`/api/itineraries/query/${params.id}`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      })
      const quotes = await quotesRes.json()
      console.log('Fetched all quotes:', quotes)
      
      let selectedItinerary = null
      
      // If quoteId in URL, load that specific quote
      // Otherwise, load the LATEST quote (most recent)
      if (quoteId) {
        const existing = quotes.find(q => q.id === quoteId)
        console.log('Found specific quote by ID:', existing)
        if (existing) {
          setExistingItinerary(existing)
          initializeFromExisting(existing, queryData)
          selectedItinerary = existing
        } else {
          initializeDefaults(queryData)
        }
      } else if (quotes && quotes.length > 0) {
        // Load the latest quote (most recent createdAt)
        const latestQuote = quotes.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        )[0]
        console.log('Loading latest quote:', latestQuote)
        setExistingItinerary(latestQuote)
        initializeFromExisting(latestQuote, queryData)
        selectedItinerary = latestQuote
      } else {
        // No quotes exist, initialize with defaults
        console.log('No existing quotes, using defaults')
        initializeDefaults(queryData)
      }
      
      // Cache everything for instant loading
      const cacheKey = `itinerary_${params.id}_${quoteId || 'new'}`
      sessionStorage.setItem(cacheKey, JSON.stringify({
        query: queryData,
        hotels: hotelsData,
        activities: activitiesData,
        routes: routesData,
        transports: transportsData,
        packages: packagesData,
        users: usersData,
        existingItinerary: selectedItinerary
      }))
      
    } catch (e) {
      console.error('Background fetch error:', e)
      // Don't show error toast - data loads from cache silently
    } finally {
      setLoading(false)
    }
  }

  const initializeFromExisting = (itinerary, queryData) => {
    console.log('Initializing from existing itinerary:', itinerary)
    const nights = parseInt(queryData?.nights) || 3
    const totalDays = nights + 1
    const startDate = queryData?.travelDate ? new Date(queryData.travelDate) : new Date()
    
    // Load all previous quote data
    setHotelSelections(itinerary.hotelSelections || [{ hotelId: '', nights: nights, rooms: 1, roomType: '', mealPlan: '', adultsPerRoom: 2, childrenPerRoom: 0, pricePerNight: 0 }])
    setTransportSelections(itinerary.transportSelections || [{ transportId: '', days: totalDays, quantity: 1, amount: 0 }])
    setDayPlans(itinerary.dayPlans || generateDayPlans(totalDays, startDate))
    setExtraServices(itinerary.extraServices || [])
    setInclusions(itinerary.inclusions || [])
    setExclusions(itinerary.exclusions || [])
    
    // Load pricing data - check multiple possible locations
    const markupPercentValue = itinerary.costs?.markupPercent || itinerary.markupPercent || 0
    const markupFixedValue = itinerary.costs?.markupFixed || itinerary.markupFixed || 0
    const discountValue = itinerary.costs?.discountAmount || itinerary.discountAmount || 0
    
    console.log('Loading pricing from itinerary:', {
      markupPercent: markupPercentValue,
      markupFixed: markupFixedValue,
      discount: discountValue,
      totalCost: itinerary.totalCost
    })
    
    setMarkupPercent(markupPercentValue)
    setMarkupFixed(markupFixedValue)
    setDiscountAmount(discountValue)
    setOriginalTotalCost(itinerary.totalCost || 0)
    
    console.log('✅ Previous quote data loaded successfully')
  }

  const initializeDefaults = (queryData) => {
    const nights = parseInt(queryData?.nights) || 3
    const totalDays = nights + 1
    const startDate = queryData?.travelDate ? new Date(queryData.travelDate) : new Date()
    
    setHotelSelections([{ hotelId: '', nights: nights, rooms: 1, roomType: '', mealPlan: '', adultsPerRoom: 2, childrenPerRoom: 0, pricePerNight: 0 }])
    setTransportSelections([{ transportId: '', days: totalDays, quantity: 1, amount: 0 }])
    setDayPlans(generateDayPlans(totalDays, startDate))
    
    // Initialize from package if available
    const selectedPackage = packages?.find(p => p.id === queryData?.tourPackage)
    if (selectedPackage) {
      const incList = typeof selectedPackage.inclusions === 'string' 
        ? selectedPackage.inclusions.split('\n').filter(x => x.trim()) 
        : (Array.isArray(selectedPackage.inclusions) ? selectedPackage.inclusions : [])
      const excList = typeof selectedPackage.exclusions === 'string' 
        ? selectedPackage.exclusions.split('\n').filter(x => x.trim()) 
        : (Array.isArray(selectedPackage.exclusions) ? selectedPackage.exclusions : [])
      setInclusions(incList)
      setExclusions(excList)
    }
  }

  const generateDayPlans = (totalDays, startDate) => {
    const plans = []
    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(startDate)
      dayDate.setDate(dayDate.getDate() + i)
      plans.push({ 
        day: i + 1, 
        date: dayDate.toISOString().split('T')[0], 
        routeId: '', 
        routeTitle: '', 
        activities: [], 
        description: '' 
      })
    }
    return plans
  }

  const nights = parseInt(query?.nights) || 3
  const totalDays = nights + 1
  const selectedPackage = packages?.find(p => p.id === query?.tourPackage)

  // Utility functions
  const formatDate = (dateStr) => { if (!dateStr) return ''; const d = new Date(dateStr); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
  const getOrdinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
  const getStatusColor = (status) => {
    const colors = { new: 'bg-yellow-100 text-yellow-800', ongoing: 'bg-blue-100 text-blue-800', confirmed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' }
    return colors[status] || colors.new
  }

  // Hotel functions
  const getTotalHotelNights = () => hotelSelections.reduce((sum, h) => sum + (parseInt(h.nights) || 0), 0)
  const calcHotelRowTotal = (h) => (parseInt(h.nights) || 0) * (parseInt(h.rooms) || 1) * (parseFloat(h.pricePerNight) || 0)
  const addHotel = () => { 
    const usedNights = hotelSelections.reduce((sum, h) => sum + (parseInt(h.nights) || 0), 0)
    const remainingNights = nights - usedNights
    if (remainingNights <= 0) { toast.error('All nights already assigned'); return }
    setHotelSelections([...hotelSelections, { hotelId: '', nights: remainingNights, rooms: 1, roomType: '', mealPlan: '', adultsPerRoom: 2, childrenPerRoom: 0, pricePerNight: 0 }])
  }
  const removeHotel = (idx) => { if (hotelSelections.length > 1) setHotelSelections(hotelSelections.filter((_, i) => i !== idx)) }
  const updateHotel = (idx, field, val) => { 
    const u = [...hotelSelections]; 
    u[idx] = { ...u[idx], [field]: val }
    
    // If hotel is being selected, also save hotel name and location
    if (field === 'hotelId') {
      const hotel = hotels.find(h => h.id === val)
      if (hotel) {
        u[idx].hotelName = hotel.name
        u[idx].hotelLocation = hotel.location
      }
    }
    
    if (field === 'nights') {
      const totalUsed = u.reduce((sum, h, i) => i === idx ? sum : sum + (parseInt(h.nights) || 0), 0)
      const maxAllowed = nights - totalUsed
      if (parseInt(val) > maxAllowed) { u[idx].nights = maxAllowed; toast.error(`Max ${maxAllowed} nights available`) }
    }
    setHotelSelections(u) 
  }

  // Transport functions
  const addTransport = () => { setTransportSelections([...transportSelections, { transportId: '', days: 1, quantity: 1, amount: 0 }]) }
  const removeTransport = (idx) => { if (transportSelections.length > 1) setTransportSelections(transportSelections.filter((_, i) => i !== idx)) }
  const updateTransport = (idx, field, val) => { 
    const u = [...transportSelections]; 
    u[idx] = { ...u[idx], [field]: val }
    
    // If vehicle is being selected, also save vehicle details
    if (field === 'transportId') {
      const transport = transports.find(t => t.id === val)
      if (transport) {
        u[idx].vehicleType = transport.vehicleType
        u[idx].vehicleName = transport.vehicleName
      }
    }
    
    if (field === 'days' && parseInt(val) > totalDays) { u[idx].days = totalDays; toast.error(`Max ${totalDays} days`) }
    setTransportSelections(u) 
  }

  // Day plan functions
  const updateDayPlan = (idx, field, val) => { const u = [...dayPlans]; u[idx] = { ...u[idx], [field]: val }; setDayPlans(u) }
  const getActivitiesForRoute = (routeId) => {
    if (!routeId) return []
    const route = routes.find(r => r.id === routeId)
    if (!route || !route.activities) return []
    return activities.filter(a => route.activities.includes(a.id))
  }
  const addActivityToDay = (dayIdx, activityId) => {
    const activity = activities.find(a => a.id === activityId)
    if (!activity) return
    const u = [...dayPlans]
    const existing = u[dayIdx].activities || []
    if (!existing.find(a => a.id === activityId)) {
      u[dayIdx].activities = [...existing, { id: activity.id, name: activity.name, description: activity.description || '', image: activity.image }]
      setDayPlans(u)
    }
  }
  const removeActivityFromDay = (dayIdx, activityId) => {
    const u = [...dayPlans]
    u[dayIdx].activities = (u[dayIdx].activities || []).filter(a => a.id !== activityId)
    setDayPlans(u)
  }
  const updateActivityInDay = (dayIdx, actId, field, val) => {
    const u = [...dayPlans]
    u[dayIdx].activities = (u[dayIdx].activities || []).map(a => a.id === actId ? { ...a, [field]: val } : a)
    setDayPlans(u)
  }

  // Extra services
  const addExtraService = () => { setExtraServices([...extraServices, { name: '', day: 1, charges: 0 }]) }
  const updateExtraService = (idx, field, val) => { const u = [...extraServices]; u[idx] = { ...u[idx], [field]: val }; setExtraServices(u) }
  const removeExtraService = (idx) => { setExtraServices(extraServices.filter((_, i) => i !== idx)) }

  // Inclusions/Exclusions
  const addInclusion = () => { if (newInclusion.trim()) { setInclusions([...inclusions, newInclusion.trim()]); setNewInclusion('') } }
  const removeInclusion = (idx) => { setInclusions(inclusions.filter((_, i) => i !== idx)) }
  const updateInclusion = (idx, val) => { const u = [...inclusions]; u[idx] = val; setInclusions(u) }
  const addExclusion = () => { if (newExclusion.trim()) { setExclusions([...exclusions, newExclusion.trim()]); setNewExclusion('') } }
  const removeExclusion = (idx) => { setExclusions(exclusions.filter((_, i) => i !== idx)) }
  const updateExclusion = (idx, val) => { const u = [...exclusions]; u[idx] = val; setExclusions(u) }

  // Cost calculations
  const calcHotelCost = () => hotelSelections.reduce((sum, h) => sum + calcHotelRowTotal(h), 0)
  const calcTransportCost = () => transportSelections.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  const calcExtraServicesCost = () => extraServices.reduce((sum, s) => sum + (parseFloat(s.charges) || 0), 0)
  const calcBaseAmount = () => calcHotelCost() + calcTransportCost() + calcExtraServicesCost()
  const calcMarkup = () => { const base = calcBaseAmount(); return (base * markupPercent / 100) + markupFixed }
  const calcSubtotal = () => calcBaseAmount() + calcMarkup()
  const calcTotal = () => calcSubtotal() - (parseFloat(discountAmount) || 0)

  // Edit query handlers
  const handleEditQuerySubmit = async (e) => {
    e.preventDefault()
    try {
      console.log('handleEditQuerySubmit: Starting...', { query, editQueryData })
      
      const dataToSave = { ...editQueryData }
      
      // Convert 'none' back to empty string for tourPackage
      if (dataToSave.tourPackage === 'none') {
        dataToSave.tourPackage = ''
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
      } = dataToSave
      
      console.log('handleEditQuerySubmit: Sending data:', validFields)
      
      const authToken = await getToken()
      const response = await fetch(`/api/queries/${query.id}`, { 
        method: 'PUT', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}` 
        }, 
        body: JSON.stringify(validFields) 
      })
      
      console.log('handleEditQuerySubmit: Response status:', response.status, response.ok)
      
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
      console.log('handleEditQuerySubmit: Saved successfully:', savedQuery)
      
      // Update local query state
      setQuery(savedQuery)
      setEditQueryData({ ...savedQuery })
      setShowEditQuery(false)
      
      // Refresh all data from server
      await fetchAllData()
      
      toast.success('Query updated successfully')
    } catch (e) {
      console.error('Error in handleEditQuerySubmit:', e)
      toast.error(e.message || 'Failed to update query')
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const authToken = await getToken()
      const res = await fetch(`/api/queries/${query.id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, 
        body: JSON.stringify({ ...query, status: newStatus }) 
      })
      if (res.ok) { 
        toast.success(`Status: ${newStatus}`)
        fetchAllData()
      }
    } catch (e) { toast.error('Failed') }
  }

  // Save handler - Updated logic:
  // - If price changes: create new quote version
  // - If price same: overwrite existing quote
  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      const currentTotal = calcTotal()
      
      // Check if price changed from last saved version
      const priceChanged = existingItinerary && Math.abs(currentTotal - originalTotalCost) > 0.01
      const shouldCreateNewVersion = !existingItinerary || priceChanged
      
      // Note: quote number is now generated by the backend for new quotes
      // We only pass the existing quote number when updating
      
      const payload = {
        queryId: params.id,
        // Only include quoteNumber if updating an existing quote
        ...(existingItinerary && !shouldCreateNewVersion && existingItinerary.quoteNumber && { quoteNumber: existingItinerary.quoteNumber }),
        hotelSelections,
        transportSelections,
        dayPlans,
        extraServices,
        inclusions,
        exclusions,
        costs: {
          hotelCost: calcHotelCost(),
          transportCost: calcTransportCost(),
          extraServicesCost: calcExtraServicesCost(),
          markupPercent,
          markupFixed,
          markupAmount: calcMarkup(),
          discountAmount: parseFloat(discountAmount) || 0,
          subtotal: calcSubtotal()
        },
        baseAmount: calcBaseAmount(),
        totalCost: currentTotal,
        status: existingItinerary?.status || 'draft'
      }
      
      let res
      if (shouldCreateNewVersion) {
        // Create new version (POST)
        res = await fetch('/api/itineraries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        })
      } else {
        // Overwrite existing (PUT)
        res = await fetch(`/api/itineraries/${existingItinerary.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        })
      }
      
      if (res.ok) {
        const saved = await res.json()
        console.log('Saved itinerary:', saved, 'New version:', shouldCreateNewVersion)
        
        // Update existing itinerary with saved data
        setExistingItinerary(saved)
        setOriginalTotalCost(saved.totalCost || currentTotal)
        
        // Preserve discount in UI
        const savedDiscount = saved.costs?.discountAmount || discountAmount
        setDiscountAmount(savedDiscount)
        
        // Auto-update query status to ongoing if it's new
        if (query?.status === 'new') {
          await fetch(`/api/queries/${params.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: 'ongoing' })
          })
          setQuery({ ...query, status: 'ongoing' })
          toast.info('Query status updated to Ongoing')
        }
        
        toast.success(shouldCreateNewVersion ? 'New quote version created!' : 'Quote saved!')
      } else {
        throw new Error('Save failed')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to save quote')
    } finally {
      setSaving(false)
    }
  }

  // Confirm Quote handler - marks the quote as confirmed for operations
  // Only ONE quote can be confirmed per query - backend handles un-confirming others
  const handleConfirmQuote = async () => {
    if (!existingItinerary) {
      toast.error('Please save the quote first before confirming')
      return
    }
    
    setConfirming(true)
    try {
      const token = await getToken()
      
      // Simply call the API to confirm this quote
      // The backend will automatically un-confirm all other quotes for this query
      const res = await fetch(`/api/itineraries/${existingItinerary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'confirmed' })
      })
      
      if (res.ok) {
        const updated = await res.json()
        setExistingItinerary(updated)
        
        // Also update the query status to confirmed
        await fetch(`/api/queries/${params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: 'confirmed' })
        })
        setQuery({ ...query, status: 'confirmed' })
        
        toast.success('Quote confirmed! Operations team can now process this booking.')
      } else {
        throw new Error('Failed to confirm quote')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to confirm quote')
    } finally {
      setConfirming(false)
    }
  }

  // PDF generation
  const handleGeneratePDF = async () => {
    setPdfLoading(true)
    try {
      await handleSave()
      
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId: query.id })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `itinerary_${query.customerName?.replace(/\s+/g, '_') || 'guest'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('PDF generated successfully!')
    } catch (error) {
      console.error('PDF Error:', error)
      toast.error(error.message || 'Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  // Generate text format for sharing
  const generateTextFormat = () => {
    const finalCost = calcTotal()
    const subtotalCost = calcSubtotal()
    const org = organization || {}
    
    let text = `🌟 *${query.destination?.toUpperCase() || 'TOUR'} TOUR PACKAGE* 🌟\n\n`
    
    // Organization/Agency header
    text += `*${org.name || 'Travel Agency'}*\n`
    if (user?.name) {
      text += `Quote By: ${user.name}\n`
    }
    text += `\n`
    
    // Tour Details (renamed from Booking Details)
    text += `📋 *Tour Details:*\n`
    text += `• Customer: ${query.customerName}\n`
    text += `• Travel Date: ${query.travelDate ? new Date(query.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}\n`
    text += `• Duration: ${nights} Nights / ${nights + 1} Days\n`
    text += `• Adults: ${query.adults || 0}, Children: ${query.children || 0}\n\n`
    
    // Hotels section - RIGHT AFTER Tour Details
    if (hotelSelections.length > 0 && hotelSelections.some(h => h.hotelId)) {
      text += `🏨 *HOTELS:*\n\n`
      hotelSelections.forEach((hotel, idx) => {
        if (!hotel.hotelId) return
        const hotelData = hotels.find(h => h.id === hotel.hotelId)
        const hotelName = hotel.hotelName || hotelData?.name || 'Hotel'
        const hotelLocation = hotel.hotelLocation || hotelData?.location || '-'
        text += `${idx + 1}. ${hotelName}\n`
        text += `   • Location: ${hotelLocation}\n`
        text += `   • Nights: ${hotel.nights}\n`
        text += `   • Rooms: ${hotel.rooms} (${hotel.roomType || 'Standard'})\n`
        text += `   • Meal Plan: ${hotel.mealPlan || 'Room only'}\n\n`
      })
    }
    
    // Transport
    if (transportSelections.length > 0 && transportSelections.some(t => t.transportId)) {
      text += `🚗 *TRANSPORT:*\n\n`
      transportSelections.forEach((trans, idx) => {
        if (!trans.transportId) return
        const transportData = transports.find(t => t.id === trans.transportId)
        const vehicleType = trans.vehicleType || transportData?.vehicleType || 'Vehicle'
        const vehicleName = trans.vehicleName || transportData?.vehicleName || ''
        text += `${idx + 1}. ${vehicleType}${vehicleName ? ` - ${vehicleName}` : ''}\n`
        text += `   • Days: ${trans.days}\n`
        text += `   • Quantity: ${trans.quantity}\n\n`
      })
    }
    
    // Day-wise itinerary - Show actual itinerary content with route titles and activities
    if (dayPlans.length > 0) {
      text += `📅 *DAY-WISE ITINERARY:*\n\n`
      dayPlans.forEach((day, idx) => {
        // Use routeTitle (the editable field) or day number as fallback
        const dayTitle = day.routeTitle || `Day ${idx + 1}`
        text += `*Day ${idx + 1}: ${dayTitle}*\n`
        
        // Show description if available
        if (day.description && day.description.trim()) {
          text += `${day.description}\n`
        }
        
        // Show activities with their names and descriptions
        if (day.activities && day.activities.length > 0) {
          day.activities.forEach(act => {
            // act has id, name, description properties (set when adding activity to day)
            const { title, details } = splitActivityTitleAndDetails(act.name || '', act.description || '')
            if (!title) return
            text += `  👉 ${formatInlineToWhatsApp(title)}\n`
            if (details && details.trim()) {
              const detailLines = formatRichTextToWhatsAppLines(details, { baseIndent: '    ', bullet: '👉' })
              detailLines.forEach(line => { text += `${line}\n` })
            }
          })
        }
        text += `\n`
      })
    }
    
    // Inclusions
    if (inclusions.length > 0) {
      text += `✅ *INCLUSIONS:*\n\n`
      inclusions.forEach(inc => {
        text += `• ${inc}\n`
      })
      text += `\n`
    }
    
    // Exclusions
    if (exclusions.length > 0) {
      text += `❌ *EXCLUSIONS:*\n\n`
      exclusions.forEach(exc => {
        text += `• ${exc}\n`
      })
      text += `\n`
    }
    
    // Pricing
    text += `💰 *TOUR PACKAGE COST:*\n\n`
    if (discountAmount > 0) {
      text += `Total Cost: ₹${subtotalCost.toLocaleString('en-IN')}\n`
      text += `Special Discount: -₹${parseFloat(discountAmount).toLocaleString('en-IN')}\n`
      text += `*Offer Price: ₹${finalCost.toLocaleString('en-IN')}/-*\n`
    } else {
      text += `*Total Package Cost: ₹${finalCost.toLocaleString('en-IN')}/-*\n`
    }
    text += `(excluding GST)\n\n`
    
    // Contact - Show organization details
    text += `📞 *CONTACT US:*\n\n`
    text += `*${org.name || 'Travel Agency'}*\n`
    if (org.consultantName) {
      text += `Travel Consultant: ${org.consultantName}\n`
    }
    if (org.phone) {
      text += `Phone: ${org.phone}\n`
    }
    if (org.email) {
      text += `Email: ${org.email}\n`
    }
    if (org.website) {
      text += `Website: ${org.website}\n`
    }
    text += `\n`
    
    text += `Thank you for choosing us! ✨\n`
    text += `We look forward to making your trip memorable.`
    
    return text
  }

  // Copy text to clipboard
  const handleCopyText = async () => {
    try {
      const text = generateTextFormat()
      await navigator.clipboard.writeText(text)
      toast.success('Quote copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  // Share to WhatsApp
  const handleShareWhatsApp = () => {
    const text = generateTextFormat()
    const encodedText = encodeURIComponent(text)
    const whatsappUrl = `https://wa.me/?text=${encodedText}`
    window.open(whatsappUrl, '_blank')
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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/queries/${params.id}`)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold">Itinerary Builder</h1>
              {existingItinerary?.status === 'confirmed' && (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Confirmed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{query?.queryNumber} - {query?.customerName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700"
            data-testid="save-quote-btn"
          >
            <Save className="w-4 h-4 mr-2" /> 
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Quote'}</span>
            <span className="sm:hidden">{saving ? '...' : 'Save'}</span>
          </Button>
          {existingItinerary && existingItinerary.status !== 'confirmed' && (
            <Button 
              onClick={handleConfirmQuote} 
              disabled={confirming}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
              data-testid="confirm-quote-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> 
              <span className="hidden sm:inline">{confirming ? 'Confirming...' : 'Confirm Quote'}</span>
              <span className="sm:hidden">{confirming ? '...' : 'Confirm'}</span>
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleGeneratePDF} 
            disabled={pdfLoading}
            className="flex-1 sm:flex-none"
            data-testid="export-pdf-btn"
          >
            <Download className="w-4 h-4 mr-2" /> 
            <span className="hidden sm:inline">{pdfLoading ? 'Generating...' : 'Export PDF'}</span>
            <span className="sm:hidden">{pdfLoading ? '...' : 'PDF'}</span>
          </Button>
          
          {/* Share as Text Dropdown */}
          <div className="relative flex-1 sm:flex-none">
            <Button 
              variant="outline" 
              onClick={handleCopyText}
              className="w-full sm:w-auto"
              data-testid="copy-text-btn"
            >
              <Copy className="w-4 h-4 mr-2" /> 
              <span className="hidden sm:inline">Copy Text</span>
              <span className="sm:hidden">Copy</span>
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-none bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
            data-testid="share-whatsapp-btn"
          >
            <Share2 className="w-4 h-4 mr-2" /> 
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sm:hidden">Share</span>
          </Button>
        </div>
      </div>

      {/* Query Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-bold text-blue-800 text-sm sm:text-base">{query?.queryNumber}</span>
              <Select value={query?.status} onValueChange={handleStatusChange}>
                <SelectTrigger className={`w-28 sm:w-32 h-7 sm:h-8 text-xs ${getStatusColor(query?.status)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">NEW</SelectItem>
                  <SelectItem value="ongoing">ONGOING</SelectItem>
                  <SelectItem value="confirmed">CONFIRMED</SelectItem>
                  <SelectItem value="cancelled">CANCELLED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowEditQuery(true)} className="w-full sm:w-auto">
              <Edit className="w-4 h-4 mr-1" /> Edit Query
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs uppercase">Client</p><p className="font-semibold text-sm">{query?.customerName}</p></div>
            <div><p className="text-muted-foreground text-xs uppercase">Package</p><p className="font-semibold text-sm truncate">{selectedPackage?.name || query?.tourPackage || 'N/A'}</p></div>
            <div><p className="text-muted-foreground text-xs uppercase">Travel Date</p><p className="font-semibold text-sm">{query?.travelDate || 'N/A'}</p></div>
            <div><p className="text-muted-foreground text-xs uppercase">Duration</p><p className="font-semibold text-sm">{nights}N / {totalDays}D</p></div>
            <div><p className="text-muted-foreground text-xs uppercase">Travelers</p><p className="font-semibold text-sm">{query?.adults} Adults{query?.children > 0 ? `, ${query.children} Child` : ''}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Query Dialog */}
      <Dialog open={showEditQuery} onOpenChange={setShowEditQuery}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Query</DialogTitle>
            <DialogDescription>Update query details. Changes will be saved to the query.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditQuerySubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name <span className="text-red-500">*</span></Label>
                <Input 
                  value={editQueryData.customerName || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, customerName: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-red-500">*</span></Label>
                <Input 
                  value={editQueryData.phone || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, phone: e.target.value })} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={editQueryData.email || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, email: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Query Source</Label>
                <Select 
                  value={editQueryData.source || 'DQ'} 
                  onValueChange={(v) => setEditQueryData({ ...editQueryData, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DQ">DQ</SelectItem>
                    <SelectItem value="AVT">AVT.com</SelectItem>
                    <SelectItem value="VP">VrindavanPackages</SelectItem>
                    <SelectItem value="FB">Facebook</SelectItem>
                    <SelectItem value="IG">Instagram</SelectItem>
                    <SelectItem value="WA">WhatsApp</SelectItem>
                    <SelectItem value="REF">Referral</SelectItem>
                    <SelectItem value="WEB">Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input 
                  value={editQueryData.destination || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, destination: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Travel Date</Label>
                <Input 
                  type="date"
                  value={editQueryData.travelDate || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, travelDate: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Nights</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={editQueryData.nights || 1} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, nights: parseInt(e.target.value) || 1 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={editQueryData.adults || 1} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, adults: parseInt(e.target.value) || 1 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={editQueryData.children || 0} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, children: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Tour Package</Label>
                <Select 
                  value={editQueryData.tourPackage || 'none'} 
                  onValueChange={(v) => setEditQueryData({ ...editQueryData, tourPackage: v === 'none' ? '' : v })}
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
                  type="number" 
                  min="0"
                  value={editQueryData.quote || 0} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, quote: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select 
                  value={editQueryData.assignedTo || ''} 
                  onValueChange={(v) => setEditQueryData({ ...editQueryData, assignedTo: v })}
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
                  value={editQueryData.pickUp || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, pickUp: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Drop-off Location</Label>
                <Input 
                  value={editQueryData.dropOff || ''} 
                  onChange={(e) => setEditQueryData({ ...editQueryData, dropOff: e.target.value })} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes / Special Requirements</Label>
              <Textarea 
                value={editQueryData.notes || ''} 
                onChange={(e) => setEditQueryData({ ...editQueryData, notes: e.target.value })} 
                rows={3} 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditQuery(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Update Query</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TABBED NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
          <TabsList className="w-full flex justify-between sm:justify-start h-auto p-1.5 sm:p-2 bg-transparent gap-0 sm:gap-2">
            <TabsTrigger 
              value="hotels" 
              className="flex-1 sm:flex-none data-[state=active]:bg-blue-600 data-[state=active]:text-white px-2 sm:px-6 py-3 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-sm"
            >
              <Hotel className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Hotels</span>
            </TabsTrigger>
            <TabsTrigger 
              value="transport" 
              className="flex-1 sm:flex-none data-[state=active]:bg-blue-600 data-[state=active]:text-white px-2 sm:px-6 py-3 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-sm"
            >
              <Car className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Transport</span>
            </TabsTrigger>
            <TabsTrigger 
              value="routes" 
              className="flex-1 sm:flex-none data-[state=active]:bg-blue-600 data-[state=active]:text-white px-2 sm:px-6 py-3 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-sm"
            >
              <MapPin className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Day-wise</span>
            </TabsTrigger>
            <TabsTrigger 
              value="services" 
              className="flex-1 sm:flex-none data-[state=active]:bg-blue-600 data-[state=active]:text-white px-2 sm:px-6 py-3 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-sm"
            >
              <PlusCircle className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="flex-1 sm:flex-none data-[state=active]:bg-blue-600 data-[state=active]:text-white px-2 sm:px-6 py-3 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-sm"
            >
              <IndianRupee className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
          </TabsList>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* HOTELS TAB */}
          <TabsContent value="hotels" className="mt-0">
          {/* 1. HOTEL SECTION */}
          <Card>
            <CardHeader className="bg-orange-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-6">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Hotel className="w-4 sm:w-5 h-4 sm:h-5" /> Hotels</CardTitle>
                <p className="text-sm text-blue-600">{getTotalHotelNights()}/{nights} nights</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <label className="flex items-center gap-2 text-xs sm:text-sm">
                  <input type="checkbox" checked={sameHotelForAll} onChange={(e) => setSameHotelForAll(e.target.checked)} className="rounded" />
                  <span className="hidden sm:inline">Same hotel for all</span>
                  <span className="sm:hidden">Same hotel</span>
                </label>
                <Button size="sm" onClick={addHotel}><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 space-y-4">
              {hotelSelections.map((h, idx) => (
                <div key={idx} className="border rounded-lg p-3 sm:p-4 bg-gray-50 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm sm:text-base">Hotel {idx + 1}</h4>
                    {hotelSelections.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeHotel(idx)}><X className="w-4 h-4" /></Button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Select Hotel</Label>
                      <Select value={h.hotelId} onValueChange={(v) => updateHotel(idx, 'hotelId', v)}>
                        <SelectTrigger><SelectValue placeholder="Select Hotel" /></SelectTrigger>
                        <SelectContent>{hotels.map(ht => <SelectItem key={ht.id} value={ht.id}>{ht.name} - {ht.location}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:contents">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nights</Label>
                        <Input type="number" min="1" max={nights} value={h.nights} onChange={(e) => updateHotel(idx, 'nights', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Rooms</Label>
                        <Input type="number" min="1" value={h.rooms} onChange={(e) => updateHotel(idx, 'rooms', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Room Type</Label>
                      <Input value={h.roomType || ''} onChange={(e) => updateHotel(idx, 'roomType', e.target.value)} placeholder="deluxe" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Meal Plan</Label>
                      <Select value={h.mealPlan || ''} onValueChange={(v) => updateHotel(idx, 'mealPlan', v)}>
                        <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
                        <SelectContent><SelectItem value="EP">EP</SelectItem><SelectItem value="CP">CP</SelectItem><SelectItem value="MAP">MAP</SelectItem><SelectItem value="AP">AP</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Adults</Label>
                      <Input type="number" min="1" value={h.adultsPerRoom || 2} onChange={(e) => updateHotel(idx, 'adultsPerRoom', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Children</Label>
                      <Input type="number" min="0" value={h.childrenPerRoom || 0} onChange={(e) => updateHotel(idx, 'childrenPerRoom', e.target.value)} />
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label className="text-xs text-muted-foreground">Price/Night (₹)</Label>
                      <Input type="number" value={h.pricePerNight || 0} onChange={(e) => updateHotel(idx, 'pricePerNight', e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 border-t text-sm gap-1">
                    <span className="text-muted-foreground text-xs sm:text-sm">{h.nights}N × {h.rooms} rooms × ₹{h.pricePerNight || 0}</span>
                    <span className="font-bold text-blue-600">₹{calcHotelRowTotal(h).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          </TabsContent>

          {/* TRANSPORT TAB */}
          <TabsContent value="transport" className="mt-0">
          {/* 2. TRANSPORT SECTION */}
          <Card>
            <CardHeader className="bg-green-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Car className="w-4 sm:w-5 h-4 sm:h-5" /> Transport</CardTitle>
              <Button size="sm" onClick={addTransport} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 space-y-4">
              {transportSelections.map((t, idx) => (
                <div key={idx} className="border rounded-lg p-3 sm:p-4 bg-gray-50 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm sm:text-base">Vehicle {idx + 1}</h4>
                    {transportSelections.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeTransport(idx)}><X className="w-4 h-4" /></Button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Select Vehicle</Label>
                      <Select value={t.transportId || ''} onValueChange={(v) => updateTransport(idx, 'transportId', v)}>
                        <SelectTrigger><SelectValue placeholder="Select Vehicle" /></SelectTrigger>
                        <SelectContent>{transports.map(tr => <SelectItem key={tr.id} value={tr.id}>{tr.vehicleType} - {tr.vehicleName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 sm:contents gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Days</Label>
                        <Input type="number" min="1" max={totalDays} value={t.days} onChange={(e) => updateTransport(idx, 'days', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input type="number" min="1" value={t.quantity} onChange={(e) => updateTransport(idx, 'quantity', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                        <Input type="number" value={t.amount || 0} onChange={(e) => updateTransport(idx, 'amount', e.target.value)} placeholder="0" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          </TabsContent>

          {/* DAY-WISE ROUTES TAB */}
          <TabsContent value="routes" className="mt-0">
          {/* 3. DAY-WISE ROUTES & ACTIVITIES */}
          <Card>
            <CardHeader className="bg-purple-50 border-b p-3 sm:p-6"><CardTitle className="text-base sm:text-lg flex items-center gap-2"><Route className="w-4 sm:w-5 h-4 sm:h-5" /> Day-wise Routes & Activities</CardTitle></CardHeader>
            <CardContent className="p-3 sm:p-4 space-y-4">
              {dayPlans.map((dp, idx) => {
                const availableActivities = getActivitiesForRoute(dp.routeId)
                return (
                  <div key={idx} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-blue-600 text-sm sm:text-base">Day {dp.day} - {formatDate(dp.date)}</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Route</Label>
                        <Select value={dp.routeId || ''} onValueChange={(v) => { updateDayPlan(idx, 'routeId', v); const r = routes.find(x => x.id === v); if (r) updateDayPlan(idx, 'routeTitle', r.name) }}>
                          <SelectTrigger><SelectValue placeholder="Select Route" /></SelectTrigger>
                          <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Route Title (Editable)</Label>
                        <Input value={dp.routeTitle || ''} onChange={(e) => updateDayPlan(idx, 'routeTitle', e.target.value)} placeholder="Custom route title" />
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label className="text-xs uppercase text-muted-foreground">Add Activity {dp.routeId ? '(filtered by route)' : '(select route first or choose any)'}</Label>
                      <Select onValueChange={(v) => addActivityToDay(idx, v)} value="">
                        <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Select activity to add" /></SelectTrigger>
                        <SelectContent>
                          {(dp.routeId && availableActivities.length > 0 ? availableActivities : activities).map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name} {a.location ? `(${a.location})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(dp.activities || []).length > 0 && (
                      <div className="space-y-3 mt-3">
                        <Label className="text-xs uppercase text-muted-foreground">Selected Activities</Label>
                        {dp.activities.map((act) => (
                          <div key={act.id} className="flex gap-3 p-3 bg-white border rounded-lg">
                            {act.image && <img src={act.image} alt={act.name} className="w-20 h-20 object-cover rounded" />}
                            <div className="flex-1 space-y-2">
                              <Input value={act.name} onChange={(e) => updateActivityInDay(idx, act.id, 'name', e.target.value)} className="font-medium" />
                              <Textarea value={act.description || ''} onChange={(e) => updateActivityInDay(idx, act.id, 'description', e.target.value)} rows={2} placeholder="Activity description" />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeActivityFromDay(idx, act.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
          </TabsContent>

          {/* SERVICES TAB */}
          <TabsContent value="services" className="mt-0 space-y-4 sm:space-y-6">
          {/* 4. EXTRA SERVICES */}
          <Card>
            <CardHeader className="bg-yellow-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2"><ClipboardList className="w-4 sm:w-5 h-4 sm:h-5" /> Extra Services</CardTitle>
              <Button size="sm" onClick={addExtraService} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-1" /> Add Service</Button>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {extraServices.length === 0 ? <p className="text-muted-foreground text-center py-4 text-sm">No extra services added</p> : (
                <div className="space-y-3 sm:hidden">
                  {/* Mobile view - cards instead of table */}
                  {extraServices.map((s, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <Input value={s.name || ''} onChange={(e) => updateExtraService(idx, 'name', e.target.value)} placeholder="Service name" className="flex-1 mr-2" />
                        <Button variant="ghost" size="icon" onClick={() => removeExtraService(idx)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={String(s.day || 1)} onValueChange={(v) => updateExtraService(idx, 'day', parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from({ length: totalDays }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Day {i + 1}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" value={s.charges || 0} onChange={(e) => updateExtraService(idx, 'charges', e.target.value)} placeholder="₹0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {extraServices.length > 0 && (
                <Table className="hidden sm:table">
                  <TableHeader><TableRow><TableHead>Service Name</TableHead><TableHead>Day</TableHead><TableHead>Charges (₹)</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {extraServices.map((s, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Input value={s.name || ''} onChange={(e) => updateExtraService(idx, 'name', e.target.value)} placeholder="e.g., VIP Darshan" /></TableCell>
                        <TableCell><Select value={String(s.day || 1)} onValueChange={(v) => updateExtraService(idx, 'day', parseInt(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: totalDays }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Day {i + 1}</SelectItem>)}</SelectContent></Select></TableCell>
                        <TableCell><Input type="number" value={s.charges || 0} onChange={(e) => updateExtraService(idx, 'charges', e.target.value)} className="w-24" /></TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeExtraService(idx)}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 5. INCLUSIONS & EXCLUSIONS */}
          <Card>
            <CardHeader className="bg-cyan-50 border-b p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2"><FileText className="w-4 sm:w-5 h-4 sm:h-5" /> Inclusions & Exclusions</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Click to edit</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Inclusions Column */}
              <div className="space-y-3">
                <Label className="text-green-700 font-semibold text-sm">Inclusions</Label>
                <div className="flex gap-2">
                  <Input value={newInclusion} onChange={(e) => setNewInclusion(e.target.value)} placeholder="Add inclusion" onKeyDown={(e) => e.key === 'Enter' && addInclusion()} className="flex-1" />
                  <Button size="icon" onClick={addInclusion} className="bg-blue-600 hover:bg-blue-700 shrink-0"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                  {inclusions.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg group">
                      <span className="text-green-400 cursor-move hidden sm:inline">⋮⋮</span>
                      <Input value={item} onChange={(e) => updateInclusion(idx, e.target.value)} className="flex-1 border-0 bg-transparent p-0 h-auto text-green-800 font-medium focus-visible:ring-0 text-sm" />
                      <button onClick={() => removeInclusion(idx)} className="text-green-600 hover:text-red-500 font-bold">×</button>
                    </div>
                  ))}
                  {inclusions.length === 0 && <p className="text-muted-foreground text-xs sm:text-sm text-center py-4">No inclusions added</p>}
                </div>
              </div>

              {/* Exclusions Column */}
              <div className="space-y-3">
                <Label className="text-red-700 font-semibold text-sm">Exclusions</Label>
                <div className="flex gap-2">
                  <Input value={newExclusion} onChange={(e) => setNewExclusion(e.target.value)} placeholder="Add exclusion" onKeyDown={(e) => e.key === 'Enter' && addExclusion()} className="flex-1" />
                  <Button size="icon" onClick={addExclusion} className="bg-blue-600 hover:bg-blue-700 shrink-0"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                  {exclusions.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg group">
                      <span className="text-red-400 cursor-move hidden sm:inline">⋮⋮</span>
                      <Input value={item} onChange={(e) => updateExclusion(idx, e.target.value)} className="flex-1 border-0 bg-transparent p-0 h-auto text-red-800 font-medium focus-visible:ring-0 text-sm" />
                      <button onClick={() => removeExclusion(idx)} className="text-red-600 hover:text-red-800 font-bold">×</button>
                    </div>
                  ))}
                  {exclusions.length === 0 && <p className="text-muted-foreground text-xs sm:text-sm text-center py-4">No exclusions added</p>}
                </div>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          {/* SUMMARY TAB */}
          <TabsContent value="summary" className="mt-0">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <IndianRupee className="w-4 sm:w-5 h-4 sm:h-5" /> 
                  Cost Summary & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="font-semibold text-sm sm:text-base border-b pb-2">Cost Breakdown</h3>
                    <div className="space-y-2 sm:space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Hotel Cost</span><span className="font-medium">₹{calcHotelCost().toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Transport Cost</span><span className="font-medium">₹{calcTransportCost().toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Extra Services</span><span className="font-medium">₹{calcExtraServicesCost().toLocaleString()}</span></div>
                      <Separator />
                      <div className="flex justify-between font-medium text-sm sm:text-base"><span>Base Amount</span><span>₹{calcBaseAmount().toLocaleString()}</span></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="font-semibold text-sm sm:text-base border-b pb-2">Markup & Discount</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-xs uppercase text-muted-foreground">Markup %</Label>
                      <Input type="number" value={markupPercent} onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)} className="text-right" />
                      
                      <Label className="text-xs uppercase text-muted-foreground">Markup Fixed</Label>
                      <div className="flex gap-2 items-center">
                        <span className="text-muted-foreground">₹</span>
                        <Input type="number" value={markupFixed} onChange={(e) => setMarkupFixed(parseFloat(e.target.value) || 0)} className="flex-1 text-right" />
                      </div>
                      
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Markup Amount</span><span className="font-medium">₹{calcMarkup().toLocaleString()}</span></div>
                      <Separator />
                      <div className="flex justify-between font-medium text-base sm:text-lg"><span>Subtotal</span><span>₹{calcSubtotal().toLocaleString()}</span></div>
                      
                      <Separator />
                      <Label className="text-xs uppercase text-muted-foreground">Discount</Label>
                      <div className="flex gap-2 items-center">
                        <span className="text-muted-foreground">₹</span>
                        <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="flex-1 text-right" placeholder="0" />
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>You save</span>
                          <span className="font-medium">₹{discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <div className="relative overflow-hidden rounded-xl p-4 sm:p-6 text-center" style={{ background: 'linear-gradient(135deg, #1e90ff 0%, #4169e1 100%)', boxShadow: '0 4px 20px rgba(65, 105, 225, 0.3)' }}>
                  <div className="relative z-10">
                    <p className="text-white text-sm font-medium mb-2 opacity-90">Total Package Cost (INR)</p>
                    <p className="text-white text-3xl sm:text-4xl font-bold tracking-tight mb-1">₹{calcTotal().toLocaleString()}/-</p>
                    <p className="text-white text-xs opacity-75">(excluding GST)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </div>

        {/* RIGHT COLUMN - STICKY SUMMARY (Hidden on mobile, visible on lg+) */}
        <div className="hidden lg:block space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="bg-gray-100 border-b"><CardTitle className="text-lg flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Quick Summary</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span className="font-medium">₹{calcBaseAmount().toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Markup</span><span className="font-medium">₹{calcMarkup().toLocaleString()}</span></div>
                <Separator />
                <div className="flex justify-between font-medium"><span>Subtotal</span><span>₹{calcSubtotal().toLocaleString()}</span></div>
                {discountAmount > 0 && (
                  <>
                    <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{discountAmount.toLocaleString()}</span></div>
                    <Separator />
                  </>
                )}
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="font-bold text-blue-900">Total</span>
                  <span className="text-xl font-bold text-blue-600">₹{calcTotal().toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </Tabs>
    </div>
  )
}
