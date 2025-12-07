'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  signUpSchema, 
  signInSchema,
  getPasswordValidationErrors,
  getPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor
} from '@/lib/validation';
import { z } from 'zod';

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  displayName?: string;
  general?: string;
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const label = getPasswordStrengthLabel(strength);
  const color = getPasswordStrengthColor(strength);
  const errors = getPasswordValidationErrors(password);

  // Determine color classes
  const colorClass = strength < 40 ? 'text-red-600' : 
                     strength < 60 ? 'text-orange-600' :
                     strength < 80 ? 'text-yellow-600' : 'text-green-600';
  
  const barColorClass = strength < 40 ? 'bg-red-500' :
                        strength < 60 ? 'bg-orange-500' :
                        strength < 80 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Password Strength</span>
        <span className={`text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      </div>
      
      {/* Strength bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColorClass}`}
          style={{ width: `${strength}%` }}
        />
      </div>

      {/* Requirements list */}
      {password && errors.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1 mt-2">
          <p className="font-medium text-red-600">Missing:</p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {password && errors.length === 0 && (
        <p className="text-xs text-green-600 font-medium">✓ Password requirements met</p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validate form
      if (isSignUp) {
        const formData = { email, password, confirmPassword, displayName };
        const validated = signUpSchema.parse(formData);
        
        const user = await signUp(validated.email, validated.password, validated.displayName);
        
        // Redirect to email verification pending page
        router.push(`/verify-email-pending?email=${encodeURIComponent(validated.email)}&userId=${user.uid}`);
      } else {
        const formData = { email, password };
        const validated = signInSchema.parse(formData);
        
        await signIn(validated.email, validated.password);
        
        // After login, redirect to dashboard
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const fieldErrors: FormErrors = {};
        err.errors.forEach(error => {
          const path = error.path[0] as string;
          fieldErrors[path as keyof FormErrors] = error.message;
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: err.message || 'Terjadi kesalahan' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrors({});
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      setErrors({ general: err.message || 'Terjadi kesalahan saat login dengan Google' });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            EdTech Kurikulum Merdeka
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp ? 'Buat akun baru' : 'Login ke akun Anda'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Lengkap *</label>
                <Input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={errors.displayName ? 'border-red-500' : ''}
                />
                {errors.displayName && (
                  <p className="text-xs text-red-600">{errors.displayName}</p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Password *</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={errors.password ? 'border-red-500' : ''}
              />
              {isSignUp && <PasswordStrengthMeter password={password} />}
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Konfirmasi Password *</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {errors.general && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {errors.general}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? 'Memproses...' : isSignUp ? 'Daftar' : 'Login'}
            </Button>
            
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Atau</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? 'Memproses...' : 'Login dengan Google'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
              className="text-sm text-primary hover:underline"
            >
              {isSignUp ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar'}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
