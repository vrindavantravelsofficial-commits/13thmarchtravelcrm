'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plane, Building, Sun, Moon } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { user, login, loading: authLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgPhone, setOrgPhone] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [orgWebsite, setOrgWebsite] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'orgRegister') {
        const res = await fetch('/api/organizations/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationName: orgName,
            adminName: name,
            adminEmail: email,
            adminPassword: password,
            phone: orgPhone,
            address: orgAddress,
            website: orgWebsite
          })
        })
        const data = await res.json()
        if (res.ok) {
          toast.success('Registration submitted! Please wait for admin approval.')
          setMode('login')
          setOrgName(''); setName(''); setEmail(''); setPassword(''); setOrgPhone(''); setOrgAddress(''); setOrgWebsite('')
        } else {
          toast.error(data.error || 'Registration failed')
        }
      } else if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, role: 'agent' })
        })
        const data = await res.json()
        if (res.ok) {
          toast.success('Registration successful!')
          setMode('login')
        } else {
          toast.error(data.error || 'Registration failed')
        }
      } else {
        const result = await login(email, password)
        if (result.success) {
          toast.success('Login successful!')
          router.push('/dashboard')
        } else {
          toast.error(result.error || 'Login failed')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error(error.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative" data-testid="login-page">
      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 rounded-xl z-20"
        onClick={toggleTheme}
        data-testid="login-theme-toggle"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </Button>

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 dark:from-primary/10 dark:to-blue-500/10" />
      
      <Card className="w-full max-w-md relative z-10" data-testid="login-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Plane className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Travvip CRM</CardTitle>
            <CardDescription className="text-primary font-medium">Travel Management</CardDescription>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' && 'Sign in to manage your travel queries'}
            {mode === 'register' && 'Create your account'}
            {mode === 'orgRegister' && 'Register your organization'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'orgRegister' && (
              <>
                <div className="space-y-2">
                  <Label>Organization Name *</Label>
                  <Input 
                    placeholder="My Travel Agency" 
                    value={orgName} 
                    onChange={(e) => setOrgName(e.target.value)} 
                    required
                    data-testid="org-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Name *</Label>
                  <Input 
                    placeholder="John Doe" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required
                    data-testid="admin-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email *</Label>
                  <Input 
                    type="email" 
                    placeholder="admin@company.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                    data-testid="admin-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required
                    data-testid="admin-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    placeholder="+91 9876543210" 
                    value={orgPhone} 
                    onChange={(e) => setOrgPhone(e.target.value)}
                    data-testid="org-phone-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input 
                    placeholder="City, Country" 
                    value={orgAddress} 
                    onChange={(e) => setOrgAddress(e.target.value)}
                    data-testid="org-address-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input 
                    placeholder="www.company.com" 
                    value={orgWebsite} 
                    onChange={(e) => setOrgWebsite(e.target.value)}
                    data-testid="org-website-input"
                  />
                </div>
              </>
            )}
            {mode === 'register' && (
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input 
                  placeholder="John Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                  data-testid="register-name-input"
                />
              </div>
            )}
            {mode !== 'orgRegister' && (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    placeholder="admin@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                    data-testid="email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required
                    data-testid="password-input"
                  />
                </div>
              </>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              data-testid="submit-button"
            >
              {loading ? 'Please wait...' : mode === 'orgRegister' ? 'Submit Registration' : mode === 'register' ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {mode === 'login' && (
            <>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => setMode('register')} 
                  className="text-primary hover:underline font-medium"
                  data-testid="signup-link"
                >
                  Sign up
                </button>
              </p>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setMode('orgRegister')}
                data-testid="org-register-button"
              >
                <Building className="w-4 h-4 mr-2" /> Register Your Organization
              </Button>
            </>
          )}
          {mode === 'register' && (
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <button 
                type="button" 
                onClick={() => setMode('login')} 
                className="text-primary hover:underline font-medium"
                data-testid="login-link"
              >
                Sign in
              </button>
            </p>
          )}
          {mode === 'orgRegister' && (
            <p className="text-sm text-muted-foreground">
              <button 
                type="button" 
                onClick={() => setMode('login')} 
                className="text-primary hover:underline font-medium"
                data-testid="back-to-login-link"
              >
                ← Back to login
              </button>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
