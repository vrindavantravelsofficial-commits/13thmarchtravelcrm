'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTransports, createOptimisticAdd, createOptimisticUpdate, createOptimisticDelete } from '@/hooks/useData'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Edit, Trash2, RefreshCw, Car } from 'lucide-react'

export default function TransportPage() {
  const { getToken } = useAuth()
  const { data: transports, isLoading: loading, mutate, setData } = useTransports()
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingTransport, setEditingTransport] = useState(null)
  const [formData, setFormData] = useState({
    vehicleType: 'Sedan', vehicleName: '', capacity: 4, pricePerDay: 0, isActive: true
  })

  const handleSave = async () => {
    try {
      const url = editingTransport ? `/api/transports/${editingTransport.id}` : '/api/transports'
      const method = editingTransport ? 'PUT' : 'POST'
      
      // Optimistic update
      if (editingTransport) {
        setData(createOptimisticUpdate(editingTransport.id, formData))
      } else {
        const tempId = `temp-${Date.now()}`
        setData(createOptimisticAdd({ ...formData, id: tempId, isActive: true }))
      }
      
      setShowDialog(false)
      toast.success(editingTransport ? 'Transport updated!' : 'Transport created!')
      
      const token = await getToken()
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        resetForm()
        mutate()
      } else {
        toast.error('Failed to save')
        mutate()
      }
    } catch (e) { 
      toast.error('Failed to save')
      mutate()
    }
  }

  const handleEdit = (transport) => {
    setEditingTransport(transport)
    setFormData({
      vehicleType: transport.vehicleType || 'Sedan',
      vehicleName: transport.vehicleName || '',
      capacity: transport.capacity || 4,
      pricePerDay: transport.pricePerDay || 0,
      isActive: transport.isActive !== false
    })
    setShowDialog(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this transport?')) return
    
    setData(createOptimisticDelete(id))
    toast.success('Transport deleted')
    
    try{
      const token = await getToken()
      const res = await fetch(`/api/transports/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      if (!res.ok) {
        toast.error('Delete failed')
        mutate()
      }
    } catch (e) { 
      toast.error('Delete failed')
      mutate()
    }
  }

  const resetForm = () => {
    setEditingTransport(null)
    setFormData({ vehicleType: 'Sedan', vehicleName: '', capacity: 4, pricePerDay: 0, isActive: true })
  }

  const filteredTransports = transports.filter(t =>
    t.vehicleName?.toLowerCase().includes(search.toLowerCase()) ||
    t.vehicleType?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Transport</h1>
          <p className="text-muted-foreground">Manage vehicle inventory</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true) }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Search vehicles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" onClick={() => mutate()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredTransports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No vehicles found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Type</TableHead>
                  <TableHead>Vehicle Name</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Price/Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransports.map((transport) => (
                  <TableRow key={transport.id}>
                    <TableCell className="font-medium">{transport.vehicleType}</TableCell>
                    <TableCell>{transport.vehicleName}</TableCell>
                    <TableCell>{transport.capacity} persons</TableCell>
                    <TableCell>₹{(transport.pricePerDay || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={transport.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {transport.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(transport)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(transport.id)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTransport ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select value={formData.vehicleType} onValueChange={(v) => setFormData({ ...formData, vehicleType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sedan">Sedan</SelectItem>
                  <SelectItem value="SUV">SUV</SelectItem>
                  <SelectItem value="MPV">MPV</SelectItem>
                  <SelectItem value="Van">Van</SelectItem>
                  <SelectItem value="Bus">Bus</SelectItem>
                  <SelectItem value="Tempo Traveller">Tempo Traveller</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehicle Name *</Label>
              <Input value={formData.vehicleName} onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })} placeholder="e.g., Toyota Innova" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" min="1" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Price per Day (₹)</Label>
                <Input type="number" value={formData.pricePerDay} onChange={(e) => setFormData({ ...formData, pricePerDay: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
