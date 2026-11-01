 import { useState } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
 import { Navbar } from "@/components/layout/Navbar";
 import { Footer } from "@/components/layout/Footer";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { useAuth } from "@/hooks/useAuth";
  import { useToast } from "@/hooks/use-toast";
  import { Loader2 } from "lucide-react";
  import { supabase } from "@/integrations/supabase/client";
  import communityImage from "@/assets/venue/community.jpg";
 
 const Auth = () => {
   const [isLoading, setIsLoading] = useState(false);
   const { signIn, signUp } = useAuth();
   const { toast } = useToast();
   const navigate = useNavigate();
   const location = useLocation();
 
   // Login form state
   const [loginEmail, setLoginEmail] = useState("");
   const [loginPassword, setLoginPassword] = useState("");
 
   // Signup form state
   const [signupName, setSignupName] = useState("");
   const [signupEmail, setSignupEmail] = useState("");
   const [signupPassword, setSignupPassword] = useState("");
   const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
 
   const handleLogin = async (e: React.FormEvent) => {
     e.preventDefault();
     setIsLoading(true);
 
     try {
      const { error } = await signIn(loginEmail.trim(), loginPassword);

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Check if user is admin to redirect accordingly
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          toast({
            title: "Welcome back!",
            description: "You have successfully logged in.",
          });
          const from = (location.state as { from?: string } | null)?.from;
          navigate(typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/auth") ? from : roleData ? "/admin" : "/");
        } else {
          navigate("/");
        }
      }
 
     } catch (error: unknown) {
       toast({ title: "Login failed", description: error instanceof Error ? error.message : "Could not sign in. Please try again.", variant: "destructive" });
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleSignup = async (e: React.FormEvent) => {
     e.preventDefault();

     if (!signupName.trim()) {
       toast({ title: "Name required", description: "Enter your full name.", variant: "destructive" });
       return;
     }
 
     if (signupPassword !== signupConfirmPassword) {
       toast({
         title: "Passwords don't match",
         description: "Please make sure your passwords match.",
         variant: "destructive",
       });
       return;
     }
 
     if (signupPassword.length < 6) {
       toast({
         title: "Password too short",
         description: "Password must be at least 6 characters.",
         variant: "destructive",
       });
       return;
     }
 
     setIsLoading(true);
 
     try {
     const { error } = await signUp(signupEmail.trim(), signupPassword, signupName.trim());
 
     if (error) {
       toast({
         title: "Signup failed",
         description: error.message,
         variant: "destructive",
       });
     } else {
       toast({
         title: "Account created!",
         description: "Please check your email to verify your account.",
       });
     }
 
     } catch (error: unknown) {
       toast({ title: "Signup failed", description: error instanceof Error ? error.message : "Could not create your account. Please try again.", variant: "destructive" });
     } finally {
       setIsLoading(false);
     }
   };
 
   return (
     <div className="min-h-screen bg-background">
       <Navbar />
 
       <main id="main-content" className="pb-16 pt-32 md:pt-40">
         <div className="site-container grid items-stretch gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
           <aside className="relative hidden min-h-[640px] overflow-hidden rounded-xl bg-brand-ink lg:block">
             <img src={communityImage} alt="The Pickle Box community greeting each other across the net" width={1302} height={868} className="absolute inset-0 h-full w-full object-cover object-[45%_center]" />
             <div className="absolute inset-x-0 bottom-0 bg-brand-ink p-9 text-white">
               <p className="font-display text-6xl uppercase leading-[.9]">There's a place<br />for you here.</p>
               <p className="mt-5 text-sm text-white/70">Your court. Your people. The Pickle Box.</p>
             </div>
           </aside>
           <div className="mx-auto w-full max-w-[440px] self-center py-4">
           <Card className="border-0 bg-transparent">
             <CardHeader className="px-0 pb-8 pt-0 text-left">
               <h1 className="page-title">Your next game<br />starts here.</h1>
               <CardDescription>
                 Sign in to book courts and manage your reservations
               </CardDescription>
             </CardHeader>
             <CardContent className="p-0">
               <Tabs defaultValue="login" className="w-full">
                 <TabsList className="grid h-12 w-full grid-cols-2">
                   <TabsTrigger value="login" className="h-10">Sign in</TabsTrigger>
                   <TabsTrigger value="signup" className="h-10">Create account</TabsTrigger>
                 </TabsList>
 
                 <TabsContent value="login" className="space-y-4 mt-4">
                   <form onSubmit={handleLogin} className="space-y-4">
                     <div className="space-y-2">
                       <Label htmlFor="login-email">Email</Label>
                       <Input
                         id="login-email"
                         type="email"
                         autoComplete="email"
                         placeholder="you@example.com"
                         value={loginEmail}
                         onChange={(e) => setLoginEmail(e.target.value)}
                         required
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="login-password">Password</Label>
                       <Input
                         id="login-password"
                         type="password"
                         autoComplete="current-password"
                         placeholder="••••••••"
                         value={loginPassword}
                         onChange={(e) => setLoginPassword(e.target.value)}
                         required
                       />
                     </div>
                     <Button type="submit" className="h-12 w-full" disabled={isLoading}>
                       {isLoading ? (
                         <>
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                           Signing in...
                         </>
                       ) : (
                         "Sign In"
                       )}
                     </Button>
                   </form>
                 </TabsContent>
 
                 <TabsContent value="signup" className="space-y-4 mt-4">
                   <form onSubmit={handleSignup} className="space-y-4">
                     <div className="space-y-2">
                       <Label htmlFor="signup-name">Full Name</Label>
                       <Input
                         id="signup-name"
                         autoComplete="name"
                         type="text"
                         placeholder="Juan Dela Cruz"
                         value={signupName}
                         onChange={(e) => setSignupName(e.target.value)}
                         required
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="signup-email">Email</Label>
                       <Input
                         id="signup-email"
                         autoComplete="email"
                         type="email"
                         placeholder="you@example.com"
                         value={signupEmail}
                         onChange={(e) => setSignupEmail(e.target.value)}
                         required
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="signup-password">Password</Label>
                       <Input
                         id="signup-password"
                         autoComplete="new-password"
                         minLength={6}
                         type="password"
                         placeholder="••••••••"
                         value={signupPassword}
                         onChange={(e) => setSignupPassword(e.target.value)}
                         required
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="signup-confirm">Confirm Password</Label>
                       <Input
                         id="signup-confirm"
                         autoComplete="new-password"
                         minLength={6}
                         type="password"
                         placeholder="••••••••"
                         value={signupConfirmPassword}
                         onChange={(e) => setSignupConfirmPassword(e.target.value)}
                         required
                       />
                     </div>
                     <Button type="submit" className="h-12 w-full" disabled={isLoading}>
                       {isLoading ? (
                         <>
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                           Creating account...
                         </>
                       ) : (
                         "Create Account"
                       )}
                     </Button>
                   </form>
                 </TabsContent>
               </Tabs>
             </CardContent>
           </Card>
           <p className="mt-6 text-xs leading-6 text-muted-foreground">Court reservations, payment updates, and check-in passes stay together in your account.</p>
           </div>
         </div>
       </main>
 
       <Footer />
     </div>
   );
 };
 
 export default Auth;
