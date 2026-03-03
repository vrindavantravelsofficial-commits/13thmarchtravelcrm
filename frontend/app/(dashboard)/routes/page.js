'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRoutes, useActivities, createOptimisticAdd, createOptimisticUpdate, createOptimisticDelete } from '@/hooks/useData'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUpload } from '@/components/ImageUpload'
import { PageSkeleton } from '@/components/ui/skeleton'
import { Plus, Search, Edit, Trash2, RefreshCw, MapPin, Activity as ActivityIcon } from 'lucide-react'

export default function RoutesPage() {
  const { getToken } = useAuth()
  const { data: routes, isLoading: routesLoading, mutate: mutateRoutes, setData: setRoutesData } = useRoutes()
  const { data: activities, isLoading: activitiesLoading, mutate: mutateActivities, setData: setActivitiesData } = useActivities()
  
  const [searchRoute, setSearchRoute] = useState('')
  const [searchActivity, setSearchActivity] = useState('')
  const [showRouteDialog, setShowRouteDialog] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  const [editingActivity, setEditingActivity] = useState(null)
  const [routeFormData, setRouteFormData] = useState({ name: '', activityIds: [], isActive: true })
  const [activityFormData, setActivityFormData] = useState({ name: '', description: '', image: null, isActive: true })

  const handleSaveRoute = async () => {
    try {
      if (!routeFormData.name.trim()) {
        toast.error('Please enter route name')
        return
      }
      const url = editingRoute ? `/api/routes/${editingRoute.id}` : '/api/routes'
      const method = editingRoute ? 'PUT' : 'POST'
      
      // Optimistic update
      if (editingRoute) {
        setRoutesData(createOptimisticUpdate(editingRoute.id, routeFormData))
      } else {
        const tempId = `temp-${Date.now()}`
        setRoutesData(createOptimisticAdd({ ...routeFormData, id: tempId, isActive: true }))
      }
      
      setShowRouteDialog(false)
      toast.success(editingRoute ? 'Route updated!' : 'Route created!')
      
      const token = await getToken()
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(routeFormData)
      })
      if (res.ok) {
        resetRouteForm()
        mutateRoutes()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save route')
        mutateRoutes()
      }
    } catch (e) {
      toast.error('Failed to save route')
      mutateRoutes()
    }
  }

  const handleSaveActivity = async () => {
    try {
      const url = editingActivity ? `/api/activities/${editingActivity.id}` : '/api/activities'
      const method = editingActivity ? 'PUT' : 'POST'
      
      // Optimistic update
      if (editingActivity) {
        setActivitiesData(createOptimisticUpdate(editingActivity.id, activityFormData))
      } else {
        const tempId = `temp-${Date.now()}`
        setActivitiesData(createOptimisticAdd({ ...activityFormData, id: tempId, isActive: true }))
      }
      
      setShowActivityDialog(false)
      toast.success(editingActivity ? 'Activity updated!' : 'Activity created!')
      
      const token = await getToken()
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(activityFormData)
      })
      if (res.ok) {
        resetActivityForm()
        mutateActivities()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save activity')
        mutateActivities()
      }
    } catch (e) {
      toast.error('Failed to save activity')
    }
  }

  const handleEditRoute = (route) => {
    setEditingRoute(route)
    setRouteFormData({ name: route.name || '', activityIds: route.activityIds || [], isActive: route.isActive !== false })
    setShowRouteDialog(true)
  }

  const handleEditActivity = (activity) => {
    setEditingActivity(activity)
    setActivityFormData({ name: activity.name || '', description: activity.description || '', image: activity.image || null, isActive: activity.isActive !== false })
    setShowActivityDialog(true)
  }

  const handleDeleteRoute = async (id) => {
    if (!confirm('Delete this route?')) return
    try {
      const token = await getToken()
      await fetch(`/api/routes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      toast.success('Route deleted')
      mutateRoutes()
    } catch (e) { toast.error('Delete failed') }
  }

  const handleDeleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return
    try {
      const token = await getToken()
      await fetch(`/api/activities/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      toast.success('Activity deleted')
      mutateActivities()
    } catch (e) { toast.error('Delete failed') }
  }

  const resetRouteForm = () => { setEditingRoute(null); setRouteFormData({ name: '', activityIds: [], isActive: true }) }
  const resetActivityForm = () => { setEditingActivity(null); setActivityFormData({ name: '', description: '', image: null, isActive: true }) }

  const toggleActivity = (activityId) => {
    const currentIds = routeFormData.activityIds || []
    const newIds = currentIds.includes(activityId) ? currentIds.filter(id => id !== activityId) : [...currentIds, activityId]
    setRouteFormData({ ...routeFormData, activityIds: newIds })
  }

  const getActivityNames = (activityIds) => {
    if (!activityIds || activityIds.length === 0) return []
    return activityIds.map(id => activities.find(a => a.id === id)?.name).filter(Boolean)
  }

  const filteredRoutes = routes.filter(r => r.name?.toLowerCase().includes(searchRoute.toLowerCase()))
  const filteredActivities = activities.filter(a => a.name?.toLowerCase().includes(searchActivity.toLowerCase()) || a.description?.toLowerCase().includes(searchActivity.toLowerCase()))

  if (routesLoading || activitiesLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="routes-page">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="page-title">Routes & Activities</h1>
          <p className="page-description">Manage travel routes and activities</p>
        </div>
      </div>

      <Tabs defaultValue="routes" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="routes" data-testid="routes-tab"><MapPin className="w-4 h-4 mr-2" />Routes</TabsTrigger>
          <TabsTrigger value="activities" data-testid="activities-tab"><ActivityIcon className="w-4 h-4 mr-2" />Activities</TabsTrigger>
        </TabsList>

        {/* ROUTES TAB */}
        <TabsContent value="routes" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Search routes..." value={searchRoute} onChange={(e) => setSearchRoute(e.target.value)} className="pl-10" data-testid="search-routes-input" />
              </div>
              <Button variant="outline" onClick={() => mutateRoutes()} data-testid="refresh-routes-button"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
            </div>
            <Button onClick={() => { resetRouteForm(); setShowRouteDialog(true) }} className="bg-primary hover:bg-primary/90" data-testid="add-route-button"><Plus className="w-4 h-4 mr-2" /> Add Route</Button>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {filteredRoutes.length === 0 ? (
                <div className="empty-state"><MapPin className="empty-state-icon" /><p className="text-lg font-medium">No routes found</p><p className="text-sm">Create your first route to get started</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Route Name</TableHead><TableHead className="hidden sm:table-cell">Assigned Activities</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredRoutes.map((route) => (
                      <TableRow key={route.id} data-testid={`route-row-${route.id}`}>
                        <TableCell className="font-medium">{route.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {getActivityNames(route.activityIds).length > 0 ? getActivityNames(route.activityIds).map((name, i) => (<Badge key={i} variant="outline" className="text-xs badge-success">{name}</Badge>)) : (<span className="text-xs text-muted-foreground">No activities assigned</span>)}
                          </div>
                        </TableCell>
                        <TableCell><Badge className={route.isActive ? 'badge-success' : 'badge-neutral'}>{route.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditRoute(route)} data-testid={`edit-route-${route.id}`}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteRoute(route.id)} data-testid={`delete-route-${route.id}`}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITIES TAB */}
        <TabsContent value="activities" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Search activities..." value={searchActivity} onChange={(e) => setSearchActivity(e.target.value)} className="pl-10" data-testid="search-activities-input" />
              </div>
              <Button variant="outline" onClick={() => mutateActivities()} data-testid="refresh-activities-button"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
            </div>
            <Button onClick={() => { resetActivityForm(); setShowActivityDialog(true) }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-activity-button"><Plus className="w-4 h-4 mr-2" /> Add Activity</Button>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {filteredActivities.length === 0 ? (
                <div className="empty-state"><ActivityIcon className="empty-state-icon" /><p className="text-lg font-medium">No activities found</p><p className="text-sm">Create your first activity to get started</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Image</TableHead><TableHead>Activity Name</TableHead><TableHead className="hidden md:table-cell">Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredActivities.map((activity) => (
                      <TableRow key={activity.id} data-testid={`activity-row-${activity.id}`}>
                        <TableCell>{activity.image ? (<img src={activity.image} alt={activity.name} className="w-16 h-12 object-cover rounded-lg shadow-sm" />) : (<div className="w-16 h-12 bg-muted rounded-lg flex items-center justify-center"><ActivityIcon className="w-6 h-6 text-muted-foreground" /></div>)}</TableCell>
                        <TableCell className="font-medium">{activity.name}</TableCell>
                        <TableCell className="max-w-md hidden md:table-cell"><div className="line-clamp-2 whitespace-pre-wrap text-muted-foreground">{activity.description || '-'}</div></TableCell>
                        <TableCell><Badge className={activity.isActive ? 'badge-success' : 'badge-neutral'}>{activity.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditActivity(activity)} data-testid={`edit-activity-${activity.id}`}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteActivity(activity.id)} data-testid={`delete-activity-${activity.id}`}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ROUTE DIALOG */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRoute ? 'Edit Route' : 'Add Route'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Route Name *</Label><Input value={routeFormData.name} onChange={(e) => setRouteFormData({ ...routeFormData, name: e.target.value })} placeholder="e.g., Delhi to Vrindavan" data-testid="route-name-input" /></div>
            <div className="space-y-2">
              <Label>Assign Activities</Label>
              <div className="border border-border/50 rounded-lg p-4 max-h-64 overflow-y-auto bg-muted/30">
                {activities.length === 0 ? (<p className="text-sm text-muted-foreground">No activities available. Create activities first from the Activities tab.</p>) : (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <Checkbox id={`activity-${activity.id}`} checked={routeFormData.activityIds?.includes(activity.id)} onCheckedChange={() => toggleActivity(activity.id)} data-testid={`activity-checkbox-${activity.id}`} />
                        <div className="flex-1"><label htmlFor={`activity-${activity.id}`} className="text-sm font-medium leading-none cursor-pointer">{activity.name}</label>{activity.description && (<p className="text-xs text-muted-foreground mt-1 line-clamp-1">{activity.description}</p>)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Selected: {routeFormData.activityIds?.length || 0} activities</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowRouteDialog(false)}>Cancel</Button><Button onClick={handleSaveRoute} data-testid="save-route-button">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACTIVITY DIALOG */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingActivity ? 'Edit Activity' : 'Add Activity'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Activity Name *</Label><Input value={activityFormData.name} onChange={(e) => setActivityFormData({ ...activityFormData, name: e.target.value })} placeholder="e.g., Arrival, Mathura Vrindavan Sightseeing" data-testid="activity-name-input" /></div>
            <div className="space-y-2"><Label>Description</Label><p className="text-xs text-muted-foreground">You can format text with bullets, bold letters, and multiple lines</p><Textarea value={activityFormData.description} onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })} placeholder="Enter activity description..." rows={8} data-testid="activity-description-input" /></div>
            <ImageUpload label="Activity Image" value={activityFormData.image} onChange={(val) => setActivityFormData({ ...activityFormData, image: val })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowActivityDialog(false)}>Cancel</Button><Button onClick={handleSaveActivity} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-activity-button">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
