'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ImageUpload } from '@/components/ImageUpload'
import { Building2, FileText, Users, Palette, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'

export default function SettingsPage() {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState('organization')
  const [org, setOrg] = useState({
    name: '', email: '', phone: '', website: '', address: '', aboutUs: '',
    logo: null, headerImage: null, footerImage: null,
    gst: '', pan: '', termsAndConditions: '', consultantName: '', primaryColor: '#2563eb',
    pdfTabColor: '#2563eb', pdfFontColor: '#ffffff'
  })
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState(null)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    roles: [],
    phone: '',
    designation: '',
    isOrgAdmin: false
  })

  useEffect(() => { fetchOrganization() }, [])
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    }
  }, [activeTab])

  const fetchOrganization = async () => {
    try {
      const res = await fetch('/api/organization', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      const data = await res.json()
      if (data) setOrg(prev => ({ ...prev, ...data }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/users', {
        headers: { 
          'Authorization': `Bearer ${getToken()}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      const data = await res.json()
      console.log('Fetched users:', data)
      setUsers(data || [])
    } catch (e) {
      console.error('Error fetching users:', e)
      toast.error('Failed to fetch users')
    } finally {
      setUsersLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch('/api/organization', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify(org)
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast.success('Settings saved successfully!')
        // Refresh the organization data
        await fetchOrganization()
      } else {
        console.error('Save error:', data)
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (e) { 
      console.error('Save exception:', e)
      toast.error('Failed to save settings') 
    }
  }

  const handleOpenUserDialog = (user = null) => {
    if (user) {
      setEditingUser(user)
      setUserForm({
        name: user.name || '',
        email: user.email || '',
        password: '',
        roles: user.roles || [],
        phone: user.phone || '',
        designation: user.designation || '',
        isOrgAdmin: user.isOrgAdmin || false
      })
    } else {
      setEditingUser(null)
      setUserForm({
        name: '',
        email: '',
        password: '',
        roles: [],
        phone: '',
        designation: '',
        isOrgAdmin: false
      })
    }
    setShowUserDialog(true)
  }

  const handleSaveUser = async () => {
    try {
      if (!editingUser && !userForm.password) {
        toast.error('Password is required for new users')
        return
      }

      if (!userForm.roles || userForm.roles.length === 0) {
        toast.error('Please select at least one role')
        return
      }

      const method = editingUser ? 'PUT' : 'POST'
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      
      const payload = editingUser 
        ? { ...userForm, password: undefined } // Don't send password on update
        : userForm

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      
      if (res.ok) {
        toast.success(editingUser ? 'User updated successfully' : 'User created successfully')
        setShowUserDialog(false)
        // Wait a bit for the dialog to close, then refresh
        await new Promise(resolve => setTimeout(resolve, 100))
        await fetchUsers()
      } else {
        toast.error(data.error || 'Failed to save user')
      }
    } catch (e) {
      console.error('Error saving user:', e)
      toast.error('Failed to save user')
    }
  }

  const handleRoleToggle = (role) => {
    setUserForm(prev => {
      const roles = prev.roles || []
      if (roles.includes(role)) {
        return { ...prev, roles: roles.filter(r => r !== role) }
      } else {
        return { ...prev, roles: [...roles, role] }
      }
    })
  }

  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })

      if (res.ok) {
        toast.success('User deleted successfully')
        fetchUsers()
      } else {
        toast.error('Failed to delete user')
      }
    } catch (e) {
      console.error('Error deleting user:', e)
      toast.error('Failed to delete user')
    }
    setDeleteUserId(null)
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'finance':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'manager':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'sales':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'operations':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin'
      case 'admin':
        return 'Admin'
      case 'finance':
        return 'Finance'
      case 'manager':
        return 'Manager'
      case 'sales':
        return 'Sales'
      case 'operations':
        return 'Operations'
      default:
        return role
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage organization settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="organization"><Building2 className="w-4 h-4 mr-2" /> Organization</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" /> Users</TabsTrigger>
          <TabsTrigger value="pdf"><FileText className="w-4 h-4 mr-2" /> PDF Settings</TabsTrigger>
          <TabsTrigger value="terms"><FileText className="w-4 h-4 mr-2" /> Terms</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={org.email} onChange={(e) => setOrg({ ...org, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input value={org.gst} onChange={(e) => setOrg({ ...org, gst: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>PAN Number</Label>
                  <Input value={org.pan} onChange={(e) => setOrg({ ...org, pan: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Consultant Name (for PDF)</Label>
                  <Input value={org.consultantName} onChange={(e) => setOrg({ ...org, consultantName: e.target.value })} placeholder="Travel Expert" />
                </div>
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <Input type="color" value={org.primaryColor || '#2563eb'} onChange={(e) => setOrg({ ...org, primaryColor: e.target.value })} className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>About Us</Label>
                <Textarea value={org.aboutUs} onChange={(e) => setOrg({ ...org, aboutUs: e.target.value })} rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload label="Logo" value={org.logo} onChange={(val) => setOrg({ ...org, logo: val })} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save Settings</Button>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">User Management</CardTitle>
                  <CardDescription>Manage users and their roles in your organization</CardDescription>
                </div>
                <Button onClick={() => handleOpenUserDialog()} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No users found. Add your first user to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                            {user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-2">
                            <h4 className="font-medium">{user.name}</h4>
                            {user.isSuperAdmin && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-500 to-pink-500 text-white">
                                Super Admin
                              </span>
                            )}
                            {user.isOrgAdmin && !user.isSuperAdmin && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                                Org Admin
                              </span>
                            )}
                            {!user.isSuperAdmin && user.roles && user.roles.map((role) => (
                              <span key={role} className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(role)}`}>
                                {getRoleLabel(role)}
                              </span>
                            ))}
                            {!user.isActive && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground">{user.phone}</p>
                          )}
                          {user.designation && (
                            <p className="text-xs text-muted-foreground">{user.designation}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUserDialog(user)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteUserId(user.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PDF Header & Footer Images</CardTitle>
              <CardDescription>These images will appear on all pages of the generated PDF (except page 1 for header)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">PDF Header Image</Label>
                <p className="text-xs text-muted-foreground mb-3">Recommended size: 1200px x 80px. Appears at top of pages 2+</p>
                <ImageUpload value={org.headerImage} onChange={(val) => setOrg({ ...org, headerImage: val })} />
              </div>
              <Separator />
              <div>
                <Label className="mb-2 block">PDF Footer Image</Label>
                <p className="text-xs text-muted-foreground mb-3">Recommended size: 1200px x 60px. Appears at bottom of all pages</p>
                <ImageUpload value={org.footerImage} onChange={(val) => setOrg({ ...org, footerImage: val })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PDF Color Customization</CardTitle>
              <CardDescription>Customize colors for your PDF quotes and itineraries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>PDF Tab/Header Color</Label>
                  <p className="text-xs text-muted-foreground mb-2">Color for section headers and tabs in PDF</p>
                  <div className="flex items-center space-x-3">
                    <Input 
                      type="color" 
                      value={org.pdfTabColor || '#2563eb'} 
                      onChange={(e) => setOrg({ ...org, pdfTabColor: e.target.value })} 
                      className="h-12 w-20" 
                    />
                    <Input 
                      value={org.pdfTabColor || '#2563eb'} 
                      onChange={(e) => setOrg({ ...org, pdfTabColor: e.target.value })}
                      placeholder="#2563eb" 
                      className="flex-1"
                    />
                  </div>
                  <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: org.pdfTabColor || '#2563eb' }}>
                    <p className="text-white font-medium text-sm">Preview: Section Header</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PDF Font Color (for colored sections)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Text color on colored backgrounds</p>
                  <div className="flex items-center space-x-3">
                    <Input 
                      type="color" 
                      value={org.pdfFontColor || '#ffffff'} 
                      onChange={(e) => setOrg({ ...org, pdfFontColor: e.target.value })} 
                      className="h-12 w-20" 
                    />
                    <Input 
                      value={org.pdfFontColor || '#ffffff'} 
                      onChange={(e) => setOrg({ ...org, pdfFontColor: e.target.value })}
                      placeholder="#ffffff" 
                      className="flex-1"
                    />
                  </div>
                  <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: org.pdfTabColor || '#2563eb', color: org.pdfFontColor || '#ffffff' }}>
                    <p className="font-medium text-sm" style={{ color: org.pdfFontColor || '#ffffff' }}>Preview: Section Text</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save PDF Settings</Button>
          </div>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Terms & Conditions</CardTitle>
              <CardDescription>These terms will appear on all generated PDF quotes. Enter each term on a new line.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={org.termsAndConditions}
                onChange={(e) => setOrg({ ...org, termsAndConditions: e.target.value })}
                rows={15}
                placeholder="Enter each term on a new line...

Example:
50% advance required at the time of booking.
Check-in time is 12:00 PM and check-out is 10:00 AM.
Vehicle will be available as per the itinerary."
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save Terms</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="john@example.com"
                disabled={editingUser}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Roles * (Select at least one)</Label>
              <div className="space-y-2 border rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-admin"
                    checked={userForm.roles?.includes('admin')}
                    onCheckedChange={() => handleRoleToggle('admin')}
                  />
                  <label htmlFor="role-admin" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Admin</span> - Full access to everything
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-finance"
                    checked={userForm.roles?.includes('finance')}
                    onCheckedChange={() => handleRoleToggle('finance')}
                  />
                  <label htmlFor="role-finance" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Finance</span> - Accounting & payments
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-manager"
                    checked={userForm.roles?.includes('manager')}
                    onCheckedChange={() => handleRoleToggle('manager')}
                  />
                  <label htmlFor="role-manager" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Manager</span> - Team management
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-sales"
                    checked={userForm.roles?.includes('sales')}
                    onCheckedChange={() => handleRoleToggle('sales')}
                  />
                  <label htmlFor="role-sales" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Sales</span> - Queries & leads
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-operations"
                    checked={userForm.roles?.includes('operations')}
                    onCheckedChange={() => handleRoleToggle('operations')}
                  />
                  <label htmlFor="role-operations" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Operations</span> - Bookings & tasks
                  </label>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="is-org-admin"
                  checked={userForm.isOrgAdmin}
                  onCheckedChange={(checked) => setUserForm({ ...userForm, isOrgAdmin: checked })}
                />
                <label htmlFor="is-org-admin" className="text-sm cursor-pointer">
                  <span className="font-medium">Organization Admin</span> - Manage all users in organization
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={userForm.designation}
                onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                placeholder="Travel Consultant"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="bg-blue-600 hover:bg-blue-700">
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user and remove their access to the system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteUser(deleteUserId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
