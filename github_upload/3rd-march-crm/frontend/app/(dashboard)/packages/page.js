'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePackages, createOptimisticAdd, createOptimisticUpdate, createOptimisticDelete } from '@/hooks/useData'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/ImageUpload'
import { PageSkeleton } from '@/components/ui/skeleton'
import { Plus, Search, Edit, Trash2, RefreshCw, Package } from 'lucide-react'

export default function PackagesPage() {
  const { getToken } = useAuth()
  const { data: packages, isLoading, mutate, setData } = usePackages()
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [formData, setFormData] = useState({
    name: '', destination: '',
    description: '', inclusions: '', exclusions: '', image: null, isActive: true
  })

  const handleSave = async () => {
    try {
      const url = editingPackage ? `/api/packages/${editingPackage.id}` : '/api/packages'
      const method = editingPackage ? 'PUT' : 'POST'
      
      // Optimistic update - show change instantly
      if (editingPackage) {
        setData(createOptimisticUpdate(editingPackage.id, formData))
      } else {
        const tempId = `temp-${Date.now()}`
        setData(createOptimisticAdd({ ...formData, id: tempId, isActive: true }))
      }
      
      setShowDialog(false)
      toast.success(editingPackage ? 'Package updated!' : 'Package created!')
      
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
        toast.error(data.error || 'Failed to save package')
        mutate() // Revert on error
      }
    } catch (e) {
      toast.error('Failed to save package')
      mutate() // Revert on error
    }
  }

  const handleEdit = (pkg) => {
    setEditingPackage(pkg)
    setFormData({
      name: pkg.name || '',
      destination: pkg.destination || '',
      description: pkg.description || '',
      inclusions: pkg.inclusions || '',
      exclusions: pkg.exclusions || '',
      image: pkg.image || null,
      isActive: pkg.isActive !== false
    })
    setShowDialog(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this package?')) return
    
    // Optimistic delete - remove instantly
    setData(createOptimisticDelete(id))
    toast.success('Package deleted')
    
    try {
      const token = await getToken()
      const res = await fetch(`/api/packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
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
    setEditingPackage(null)
    setFormData({
      name: '', destination: '',
      description: '', inclusions: '', exclusions: '', image: null, isActive: true
    })
  }

  const filteredPackages = packages.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.destination?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="packages-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="page-title">Tour Packages</h1>
            <p className="page-description">Manage tour packages</p>
          </div>
        </div>
        <Button 
          onClick={() => { resetForm(); setShowDialog(true) }} 
          className="bg-primary hover:bg-primary/90"
          data-testid="add-package-button"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Package
        </Button>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search packages..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10"
            data-testid="search-packages-input"
          />
        </div>
        <Button variant="outline" onClick={() => mutate()} data-testid="refresh-button">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filteredPackages.length === 0 ? (
            <div className="empty-state">
              <Package className="empty-state-icon" />
              <p className="text-lg font-medium">No packages found</p>
              <p className="text-sm">Create your first tour package to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Package Name</TableHead>
                  <TableHead className="hidden md:table-cell">Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <TableRow key={pkg.id} data-testid={`package-row-${pkg.id}`}>
                    <TableCell>
                      {pkg.image ? (
                        <img 
                          src={pkg.image} 
                          alt={pkg.name} 
                          className="w-16 h-12 object-cover rounded-lg shadow-sm" 
                        />
                      ) : (
                        <div className="w-16 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{pkg.name}</span>
                      <span className="block md:hidden text-xs text-muted-foreground mt-1">
                        {pkg.destination}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {pkg.destination}
                    </TableCell>
                    <TableCell>
                      <Badge className={pkg.isActive ? 'badge-success' : 'badge-neutral'}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(pkg)}
                          data-testid={`edit-package-${pkg.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive" 
                          onClick={() => handleDelete(pkg.id)}
                          data-testid={`delete-package-${pkg.id}`}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPackage ? 'Edit Package' : 'Add Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Package Name *</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="package-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Input 
                  value={formData.destination} 
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  data-testid="package-destination-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                rows={3}
                data-testid="package-description-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Inclusions (one per line)</Label>
              <Textarea 
                value={formData.inclusions} 
                onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })} 
                rows={3}
                data-testid="package-inclusions-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Exclusions (one per line)</Label>
              <Textarea 
                value={formData.exclusions} 
                onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })} 
                rows={3}
                data-testid="package-exclusions-input"
              />
            </div>
            <ImageUpload 
              label="Package Banner (1200x600 recommended)" 
              value={formData.image} 
              onChange={(val) => setFormData({ ...formData, image: val })} 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} data-testid="save-package-button">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
