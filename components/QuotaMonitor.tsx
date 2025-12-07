'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import './quota-monitor.css';

interface QuotaStatus {
  isQuotaExhausted: boolean;
  remainingRequests: number;
  maxRequestsPerMinute: number;
  errorCount: number;
  lastError: string | null;
  queueSize: number;
  status: 'healthy' | 'warning' | 'exhausted';
  message: string;
}

export function QuotaMonitor() {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial status
    fetchQuotaStatus();

    // Update every 10 seconds
    const interval = setInterval(() => {
      fetchQuotaStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchQuotaStatus = async () => {
    try {
      const response = await fetch('/api/quota-status');
      const result = await response.json();
      
      if (result.success) {
        setQuotaStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch quota status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-700">Loading quota status...</p>
        </CardContent>
      </Card>
    );
  }

  if (!quotaStatus) return null;

  const getStatusColor = () => {
    switch (quotaStatus.status) {
      case 'healthy': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'exhausted': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusIcon = () => {
    switch (quotaStatus.status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'exhausted': return '❌';
      default: return 'ℹ️';
    }
  };

  const getTextColor = () => {
    switch (quotaStatus.status) {
      case 'healthy': return 'text-green-700';
      case 'warning': return 'text-yellow-700';
      case 'exhausted': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  const percentage = Math.round((quotaStatus.remainingRequests / quotaStatus.maxRequestsPerMinute) * 100);

  return (
    <Card className={getStatusColor()}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-base ${getTextColor()}`}>
          <span>{getStatusIcon()}</span>
          <span>API Quota Status</span>
        </CardTitle>
        <CardDescription className={getTextColor()}>
          {quotaStatus.message}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className={getTextColor()}>Remaining Requests</span>
              <span className={`font-bold ${getTextColor()}`}>
                {quotaStatus.remainingRequests}/{quotaStatus.maxRequestsPerMinute}
              </span>
            </div>
            <div className="quota-progress-bar">
              <div
                className={`quota-progress-fill ${
                  quotaStatus.status === 'healthy' ? 'bg-green-500' :
                  quotaStatus.status === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                aria-label={`${percentage}% remaining`}
                data-percentage={percentage}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`rounded-lg p-3 ${quotaStatus.status === 'healthy' ? 'bg-green-100' : quotaStatus.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <p className={`text-xs ${getTextColor()}`}>Queue Size</p>
              <p className={`text-lg font-bold ${getTextColor()}`}>{quotaStatus.queueSize}</p>
            </div>
            <div className={`rounded-lg p-3 ${quotaStatus.status === 'healthy' ? 'bg-green-100' : quotaStatus.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <p className={`text-xs ${getTextColor()}`}>Error Count</p>
              <p className={`text-lg font-bold ${getTextColor()}`}>{quotaStatus.errorCount}</p>
            </div>
          </div>

          {/* Last Error */}
          {quotaStatus.lastError && (
            <div className="pt-2 border-t border-gray-300">
              <p className={`text-xs ${getTextColor()}`}>
                Last Error: {new Date(quotaStatus.lastError).toLocaleTimeString('id-ID')}
              </p>
            </div>
          )}

          {/* Warning Message */}
          {quotaStatus.status === 'exhausted' && (
            <div className="pt-2 border-t border-red-300">
              <p className="text-xs text-red-700">
                💡 <strong>Saran:</strong> Tunggu 1-5 menit atau gunakan API key baru.
              </p>
            </div>
          )}
          
          {quotaStatus.status === 'warning' && (
            <div className="pt-2 border-t border-yellow-300">
              <p className="text-xs text-yellow-700">
                💡 <strong>Perhatian:</strong> Quota hampir habis. Hindari generate berlebihan.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
