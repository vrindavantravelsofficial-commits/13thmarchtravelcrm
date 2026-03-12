'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, Copy, Trash2, RefreshCw, Link2, Globe, Code, 
  Check, AlertCircle, Webhook, Key, ExternalLink
} from 'lucide-react'

const SOURCE_TYPES = [
  { id: 'wordpress', label: 'WordPress', icon: '🌐', description: 'Contact Form 7, WPForms, Gravity Forms' },
  { id: 'html', label: 'HTML Form', icon: '📄', description: 'Custom HTML forms on any website' },
  { id: 'google', label: 'Google Leads', icon: '🔍', description: 'Google Ads Lead Form Extensions' },
  { id: 'meta', label: 'Meta Leads', icon: '📘', description: 'Facebook & Instagram Lead Ads' },
  { id: 'custom', label: 'Custom API', icon: '⚙️', description: 'Any custom integration via API' },
]

export default function LeadSourcesPage() {
  const { getToken, user } = useAuth()
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCodeDialog, setShowCodeDialog] = useState(false)
  const [selectedSource, setSelectedSource] = useState(null)
  const [copiedField, setCopiedField] = useState(null)
  const [newSource, setNewSource] = useState({
    name: '',
    type: 'wordpress',
    website: ''
  })

  const webhookBaseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhooks/lead` 
    : '/api/webhooks/lead'

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    try {
      const authToken = await getToken()
      const res = await fetch('/api/lead-sources', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (res.ok) {
        setSources(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = 'tvp_'
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }

  const handleCreateSource = async () => {
    if (!newSource.name.trim()) {
      toast.error('Please enter a source name')
      return
    }
    
    try {
      const token = generateToken()
      const source = {
        ...newSource,
        token,
        createdAt: new Date().toISOString(),
        leadsCount: 0,
        isActive: true
      }
      
      const authToken = await getToken()
      const res = await fetch('/api/lead-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(source)
      })
      
      if (res.ok) {
        toast.success('Lead source created!')
        setShowAddDialog(false)
        setNewSource({ name: '', type: 'wordpress', website: '' })
        fetchSources()
      }
    } catch (e) {
      toast.error('Failed to create source')
    }
  }

  const handleDeleteSource = async (id) => {
    if (!confirm('Delete this lead source? This will not delete existing leads.')) return
    
    try {
      const authToken = await getToken()
      await fetch(`/api/lead-sources/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      toast.success('Source deleted')
      fetchSources()
    } catch (e) {
      toast.error('Failed to delete')
    }
  }

  const handleRegenerateToken = async (source) => {
    try {
      const newToken = generateToken()
      const authToken = await getToken()
      await fetch(`/api/lead-sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ...source, token: newToken })
      })
      toast.success('Token regenerated')
      fetchSources()
    } catch (e) {
      toast.error('Failed to regenerate token')
    }
  }

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getIntegrationCode = (source) => {
    const webhookUrl = `${webhookBaseUrl}?token=${source.token}`
    
    switch (source.type) {
      case 'wordpress':
        return {
          title: 'WordPress Integration',
          description: 'Add this webhook URL to your Contact Form 7 or WPForms settings',
          code: `// For Contact Form 7 - Add to functions.php
add_action('wpcf7_mail_sent', function($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    $data = $submission->get_posted_data();
    
    wp_remote_post('${webhookUrl}', array(
        'body' => json_encode(array(
            'customerName' => $data['your-name'] ?? '',
            'email' => $data['your-email'] ?? '',
            'phone' => $data['your-phone'] ?? '',
            'destination' => $data['destination'] ?? '',
            'message' => $data['your-message'] ?? ''
        )),
        'headers' => array('Content-Type' => 'application/json')
    ));
});`
        }
      
      case 'html':
        return {
          title: 'HTML Form Integration',
          description: 'Add this script to your HTML page with the form',
          code: `<!-- Add this form to your HTML -->
<form id="leadForm" onsubmit="submitLead(event)">
  <input name="customerName" placeholder="Name" required>
  <input name="email" type="email" placeholder="Email">
  <input name="phone" placeholder="Phone" required>
  <input name="destination" placeholder="Destination">
  <textarea name="notes" placeholder="Message"></textarea>
  <button type="submit">Submit</button>
</form>

<script>
async function submitLead(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  
  try {
    await fetch('${webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    alert('Thank you! We will contact you soon.');
    form.reset();
  } catch(err) {
    alert('Error submitting form');
  }
}
</script>`
        }
      
      case 'google':
        return {
          title: 'Google Lead Form Extensions',
          description: 'Configure your Google Ads webhook with this URL',
          code: `Webhook URL: ${webhookUrl}

Field Mapping (in Google Ads):
- Full Name → customerName
- Email → email  
- Phone Number → phone
- What are you interested in? → destination
- Comments → notes

Steps:
1. Go to Google Ads > Tools > Lead Form Extensions
2. Select your lead form
3. Go to "Lead delivery" settings
4. Add webhook URL above
5. Map fields as shown above`
        }
      
      case 'meta':
        return {
          title: 'Meta (Facebook/Instagram) Lead Ads',
          description: 'Connect your Meta Lead Ads using Zapier or direct webhook',
          code: `Webhook URL: ${webhookUrl}

Option 1: Using Zapier
1. Create new Zap: Facebook Lead Ads → Webhooks
2. Set webhook URL to: ${webhookUrl}
3. Map fields:
   - full_name → customerName
   - email → email
   - phone_number → phone

Option 2: Direct Integration (Requires Meta Developer Account)
POST ${webhookUrl}
Content-Type: application/json

{
  "customerName": "{{full_name}}",
  "email": "{{email}}",
  "phone": "{{phone_number}}",
  "notes": "From Facebook Lead Ad"
}`
        }
      
      default:
        return {
          title: 'Custom API Integration',
          description: 'Send POST requests to this endpoint',
          code: `POST ${webhookUrl}
Content-Type: application/json

{
  "customerName": "John Doe",
  "email": "john@example.com",
  "phone": "+91 9876543210",
  "destination": "Goa",
  "travelDate": "2026-03-15",
  "adults": 2,
  "children": 0,
  "nights": 3,
  "notes": "Looking for beach resort"
}

// Response (Success)
{
  "success": true,
  "queryId": "q_abc123",
  "queryNumber": "QRY-00123"
}`
        }
    }
  }

  const getSourceIcon = (type) => {
    return SOURCE_TYPES.find(s => s.id === type)?.icon || '🔗'
  }

  return (
    <div className="space-y-6" data-testid="lead-sources-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Lead Sources</h1>
            <p className="text-sm text-muted-foreground">Connect websites & platforms to capture leads automatically</p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Source
        </Button>
      </div>

      {/* Sources Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Lead Sources</h3>
            <p className="text-muted-foreground mb-4">Add a source to start capturing leads from your websites</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Your First Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <Card key={source.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getSourceIcon(source.type)}</span>
                    <div>
                      <CardTitle className="text-base">{source.name}</CardTitle>
                      <CardDescription className="text-xs">{source.website || 'No website'}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={source.isActive ? 'default' : 'secondary'}>
                    {source.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <code className="flex-1 bg-muted px-2 py-1 rounded text-xs truncate">{source.token}</code>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(source.token, `token-${source.id}`)}
                  >
                    {copiedField === `token-${source.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{source.leadsCount || 0} leads captured</span>
                  <span>Created {new Date(source.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => { setSelectedSource(source); setShowCodeDialog(true); }}
                  >
                    <Code className="w-4 h-4 mr-1" /> Setup
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRegenerateToken(source)}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteSource(source.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Source Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lead Source</DialogTitle>
            <DialogDescription>Connect a new website or platform to capture leads</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Name *</Label>
              <Input 
                placeholder="e.g., Main Website, Landing Page"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select 
                value={newSource.type} 
                onValueChange={(v) => setNewSource({ ...newSource, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <span className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Website URL (Optional)</Label>
              <Input 
                placeholder="https://yourwebsite.com"
                value={newSource.website}
                onChange={(e) => setNewSource({ ...newSource, website: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSource}>Create Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integration Code Dialog */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Integration Setup - {selectedSource?.name}</DialogTitle>
          </DialogHeader>
          {selectedSource && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      {getIntegrationCode(selectedSource).title}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {getIntegrationCode(selectedSource).description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Webhook URL</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(`${webhookBaseUrl}?token=${selectedSource.token}`, 'webhook-url')}
                  >
                    {copiedField === 'webhook-url' ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    Copy
                  </Button>
                </div>
                <code className="block w-full p-3 bg-muted rounded text-xs break-all">
                  {webhookBaseUrl}?token={selectedSource.token}
                </code>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Integration Code</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(getIntegrationCode(selectedSource).code, 'integration-code')}
                  >
                    {copiedField === 'integration-code' ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    Copy
                  </Button>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto">
                  {getIntegrationCode(selectedSource).code}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowCodeDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
