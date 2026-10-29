 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
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
 
 const Auth = () => {
   const [isLoading, setIsLoading] = useState(false);
   const { signIn, signUp } = useAuth();
   const { toast } = useToast();
   const navigate = useNavigate();
 
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
 
      const { error } = await signIn(loginEmail, loginPassword);

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
          navigate(roleData ? "/admin" : "/");
        } else {
          navigate("/");
        }
      }
 
     setIsLoading(false);
   };
 
   const handleSignup = async (e: React.FormEvent) => {
     e.preventDefault();
 
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
 
     const { error } = await signUp(signupEmail, signupPassword, signupName);
 
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
 
     setIsLoading(false);
   };
 
   return (
     <div className="min-h-screen bg-background">
       <Navbar />
 
       <main className="pt-32 pb-16 md:pt-36">
         <div className="container mx-auto px-4 max-w-md">
           <Card>
             <CardHeader className="text-center">
               <CardTitle className="text-2xl">Welcome to The Pickle Box</CardTitle>
               <CardDescription>
                 Sign in to book courts and manage your reservations
               </CardDescription>
             </CardHeader>
             <CardContent>
               <Tabs defaultValue="login" className="w-full">
                 <TabsList className="grid w-full grid-cols-2">
                   <TabsTrigger value="login">Login</TabsTrigger>
                   <TabsTrigger value="signup">Sign Up</TabsTrigger>
                 </TabsList>
 
                 <TabsContent value="login" className="space-y-4 mt-4">
                   <form onSubmit={handleLogin} className="space-y-4">
                     <div className="space-y-2">
                       <Label htmlFor="login-email">Email</Label>
                       <Input
                         id="login-email"
                         type="email"
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
                         placeholder="••••••••"
                         value={loginPassword}
                         onChange={(e) => setLoginPassword(e.target.value)}
                         required
                       />
                     </div>
                     <Button type="submit" className="w-full" disabled={isLoading}>
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
                         type="password"
                         placeholder="••••••••"
                         value={signupConfirmPassword}
                         onChange={(e) => setSignupConfirmPassword(e.target.value)}
                         required
                       />
                     </div>
                     <Button type="submit" className="w-full" disabled={isLoading}>
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
         </div>
       </main>
 
       <Footer />
     </div>
   );
 };
 
 export default Auth;
