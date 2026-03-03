'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useHotels, createOptimisticAdd, createOptimisticUpdate, createOptimisticDelete } from '@/hooks/useData'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/ImageUpload'
import { PageSkeleton } from '@/components/ui/skeleton'
import { Plus, Search, Edit, Trash2, RefreshCw, Hotel, Star } from 'lucide-react'

export default function HotelsPage() {
  const { getToken } = useAuth()
  const { data: hotels, isLoading, mutate, setData } = useHotels()
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingHotel, setEditingHotel] = useState(null)
  const [formData, setFormData] = useState({
    name: '', location: '', starRating: 3, roomTypes: ['Standard', 'Deluxe'],
    mealPlans: ['BB'], pricePerNight: 0, image: null, isActive: true
  })

  const handleSave = async () => {
    try {
      const url = editingHotel ? `/api/hotels/${editingHotel.id}` : '/api/hotels'
      const method = editingHotel ? 'PUT' : 'POST'
      
      // Optimistic update - show change instantly
      if (editingHotel) {
        setData(createOptimisticUpdate(editingHotel.id, formData))
      } else {
        const tempId = `temp-${Date.now()}`
        setData(createOptimisticAdd({ ...formData, id: tempId, isActive: true }))
      }
      
      setShowDialog(false)
      toast.success(editingHotel ? 'Hotel updated!' : 'Hotel created!')
      
      const token = await getToken()
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok) {
        resetForm()
        mutate() // Sync with server
      } else {
        toast.error(data.error || 'Failed to save hotel')
        mutate() // Revert on error
      }
    } catch (e) {
      toast.error('Failed to save hotel')
      mutate() // Revert on error
    }
  }

  const handleEdit = (hotel) => {
    setEditingHotel(hotel)
    setFormData({
      name: hotel.name || '',
      location: hotel.location || '',
      starRating: hotel.starRating || 3,
      roomTypes: hotel.roomTypes || ['Standard', 'Deluxe'],
      mealPlans: hotel.mealPlans || ['BB'],
      pricePerNight: hotel.pricePerNight || 0,
      image: hotel.image || null,
      isActive: hotel.isActive !== false
    })
    setShowDialog(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this hotel?')) return
    
    // Optimistic delete - remove instantly
    setData(createOptimisticDelete(id))
    toast.success('Hotel deleted')
    
    try {
      const token = await getToken()
      const res = await fetch(`/api/hotels/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      if (!res.ok) {
        toast.error('Delete failed')
        mutate() // Revert on error
      }
    } catch (e) { 
      toast.error('Delete failed')
      mutate() // Revert on error
    }
  }

  const resetForm = () => {
    setEditingHotel(null)
    setFormData({
      name: '', location: '', starRating: 3, roomTypes: ['Standard', 'Deluxe'],
      mealPlans: ['BB'], pricePerNight: 0, image: null, isActive: true
    })
  }

  const filteredHotels = hotels.filter(h => 
    h.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.location?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="hotels-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Hotel className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="page-title">Hotels</h1>
            <p className="page-description">Manage hotel inventory</p>
          </div>
        </div>
        <Button 
          onClick={() => { resetForm(); setShowDialog(true) }} 
          className="bg-primary hover:bg-primary/90"
          data-testid="add-hotel-button"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Hotel
        </Button>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search hotels..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10"
            data-testid="search-hotels-input"
          />
        </div>
        <Button variant="outline" onClick={() => mutate()} data-testid="refresh-hotels-button">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filteredHotels.length === 0 ? (
            <div className="empty-state">
              <Hotel className="empty-state-icon" />
              <p className="text-lg font-medium">No hotels found</p>
              <p className="text-sm">Add your first hotel to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Hotel Name</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead className="hidden sm:table-cell">Rating</TableHead>
                  <TableHead className="hidden lg:table-cell">Price/Night</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHotels.map((hotel) => (
                  <TableRow key={hotel.id} data-testid={`hotel-row-${hotel.id}`}>
                    <TableCell>
                      {hotel.image ? (
                        <img 
                          src={hotel.image} 
                          alt={hotel.name} 
                          className="w-16 h-12 object-cover rounded-lg shadow-sm" 
                        />
                      ) : (
                        <div className="w-16 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Hotel className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{hotel.name}</span>
                      <span className="block md:hidden text-xs text-muted-foreground mt-1">
                        {hotel.location}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {hotel.location}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-amber-500">
                        {[...Array(hotel.starRating || 0)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-medium">
                      ₹{(hotel.pricePerNight || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={hotel.isActive ? 'badge-success' : 'badge-neutral'}>
                        {hotel.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(hotel)}
                          data-testid={`edit-hotel-${hotel.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive" 
                          onClick={() => handleDelete(hotel.id)}
                          data-testid={`delete-hotel-${hotel.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHotel ? 'Edit Hotel' : 'Add Hotel'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Hotel Name *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="hotel-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input 
                value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                data-testid="hotel-location-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Star Rating</Label>
                <Select 
                  value={String(formData.starRating)} 
                  onValueChange={(v) => setFormData({ ...formData, starRating: parseInt(v) })}
                >
                  <SelectTrigger data-testid="hotel-rating-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} Star</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price per Night (₹)</Label>
                <Input 
                  type="number" 
                  value={formData.pricePerNight} 
                  onChange={(e) => setFormData({ ...formData, pricePerNight: parseInt(e.target.value) || 0 })}
                  data-testid="hotel-price-input"
                />
              </div>
            </div>
            <ImageUpload 
              label="Hotel Image" 
              value={formData.image} 
              onChange={(val) => setFormData({ ...formData, image: val })} 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} data-testid="save-hotel-button">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
