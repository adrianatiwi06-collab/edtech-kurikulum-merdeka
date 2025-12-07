/**
 * Email Verification Page
 * URL: /verify-email?token=...&userId=...
 * User clicks link from email to verify
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'rate-limited'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const userId = searchParams.get('userId');

      if (!token || !userId) {
        setStatus('error');
        setMessage('Invalid verification link. Missing token or user ID.');
        return;
      }

      try {
        const response = await fetch('/api/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId }),
        });

        if (response.status === 429) {
          setStatus('rate-limited');
          setMessage('Too many verification attempts. Please try again later.');
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          setStatus('error');
          setMessage(data.error || 'Verification failed. Please try again or request a new link.');
          return;
        }

        setStatus('success');
        setMessage('Email verified successfully! Redirecting to dashboard...');

        // Redirect after 2 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred during verification. Please try again.');
        console.error('Verification error:', error);
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {status === 'loading' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full animate-spin">
              <div className="w-8 h-8 bg-blue-500 rounded-full opacity-75"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verifying Email</h1>
            <p className="text-gray-600">Please wait while we verify your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Email Verified!</h1>
            <p className="text-gray-600">{message}</p>
            <div className="pt-4">
              <Link href="/dashboard">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verification Failed</h1>
            <p className="text-gray-600">{message}</p>
            <div className="space-y-2 pt-4">
              <Link href="/dashboard/template-ujian">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Go to Dashboard
                </Button>
              </Link>
              <p className="text-sm text-gray-500">
                or request a new verification email from your account settings
              </p>
            </div>
          </div>
        )}

        {status === 'rate-limited' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Too Many Attempts</h1>
            <p className="text-gray-600">{message}</p>
            <div className="space-y-2 pt-4">
              <Link href="/dashboard">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Go to Dashboard
                </Button>
              </Link>
              <p className="text-sm text-gray-500">
                Try again after 24 hours
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
