import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle auth callback (email verification, password reset)
  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (type === 'recovery') {
        // User clicked password reset link - show success message
        toast({
          title: "Password reset link verified",
          description: "You can now update your password below."
        });
        // Clear the hash
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      if (accessToken) {
        // Email verification successful - clear hash and show message
        window.history.replaceState({}, document.title, window.location.pathname);
        toast({
          title: "Email verified!",
          description: "You can now sign in to your account."
        });
      }
    };
    
    handleAuthCallback();
  }, [toast]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Clear form state on mount and when page becomes visible
  useEffect(() => {
    const clearForm = () => {
      setEmail('');
      setPassword('');
      setDisplayName('');
      setUsername('');
    };
    
    clearForm();
    
    // Also clear when page becomes visible (e.g., after navigating back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearForm();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (!error) {
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive"
      });
      return;
    }
    
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a display name",
        variant: "destructive"
      });
      return;
    }
    
    // Validate real name (only letters and spaces)
    if (!/^[a-zA-Z\s]+$/.test(displayName.trim())) {
      toast({
        title: "Invalid Name",
        description: "Your name can only contain letters and spaces",
        variant: "destructive"
      });
      return;
    }
    
    // Validate username (letters, numbers, dashes, underscores, no spaces)
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      toast({
        title: "Invalid Display Name",
        description: "Display name can only contain letters, numbers, dashes and underscores (no spaces)",
        variant: "destructive"
      });
      return;
    }
    
    // Check display name uniqueness before signup
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('display_name', username.trim())
      .maybeSingle();

    if (existingProfile) {
      toast({
        title: "Display Name Taken",
        description: "This display name is already in use. Please choose another.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    // Call Supabase directly to check the response
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        // Swap field mapping: username = real name, display_name = unique ID
        data: { 
          username: displayName.trim(),  // Real name → username field
          display_name: username.trim()  // Unique ID → display_name field
        }
      }
    });
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
    } else if (data?.user?.identities?.length === 0) {
      // User already exists - Supabase returns empty identities array
      toast({
        title: "Account already exists",
        description: "This email is already registered. Please sign in instead, or use 'Forgot password' if you need to reset your password.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "Please check your email for a confirmation link to complete your registration."
      });
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "Password reset link has been sent to your email."
      });
    }
    
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    
    if (error) {
      toast({
        title: "Google sign in failed",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    }
    // Don't set loading false on success - user will be redirected
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Tube Challenge</CardTitle>
          <CardDescription>
            Conquer the London Underground, one station at a time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <div className="mt-6 mb-4">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleGoogleSignIn}
                disabled={loading}
                type="button"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>
            </div>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <Button 
                      variant="link" 
                      type="button" 
                      onClick={handleForgotPassword}
                      className="p-0 h-auto text-sm"
                      disabled={loading}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4" autoComplete="off">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Your Name *</Label>
                  <Input
                    id="signup-name"
                    name="name"
                    type="text"
                    autoComplete="off"
                    placeholder="John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    pattern="[a-zA-Z\s]+"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Your real name - letters and spaces only</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Display Name *</Label>
                  <Input
                    id="signup-username"
                    name="username"
                    type="text"
                    autoComplete="off"
                    placeholder="JohnDoe123"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    pattern="[a-zA-Z0-9_-]+"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Your unique username - letters, numbers, dashes and underscores only (no spaces)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="signup-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}