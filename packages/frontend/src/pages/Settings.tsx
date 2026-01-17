import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Wifi, Bell, CheckCircle, XCircle, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { roborockApi, ringApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { clsx } from 'clsx';

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Account Info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Account
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Name</label>
            <p className="font-medium">{user?.name || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Role</label>
            <p className="font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Roborock Connection */}
      <RoborockSettings />

      {/* Ring Connection */}
      <RingSettings />
    </div>
  );
}

function RoborockSettings() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['roborock-status'],
    queryFn: roborockApi.status,
  });

  const authMutation = useMutation({
    mutationFn: () => roborockApi.auth(email, password),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['roborock-status'] });
      queryClient.invalidateQueries({ queryKey: ['roborock-devices'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const connectMutation = useMutation({
    mutationFn: roborockApi.connect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roborock-status'] });
      queryClient.invalidateQueries({ queryKey: ['roborock-devices'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: roborockApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roborock-status'] });
    },
  });

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          Roborock
        </h2>
        {statusLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : status?.connected ? (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-500">
            <XCircle className="w-4 h-4" />
            Disconnected
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Your Roborock account is connected. Your devices should appear on the Dashboard and Vacuum pages.
          </p>
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="btn btn-secondary"
          >
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      ) : status?.hasCredentials ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Credentials stored. Click connect to re-establish connection.
          </p>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="btn btn-primary"
          >
            {connectMutation.isPending ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            authMutation.mutate();
          }}
          className="space-y-4"
        >
          <p className="text-gray-600 dark:text-gray-400">
            Enter your Roborock account credentials (same as the Roborock app).
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={authMutation.isPending}
            className="btn btn-primary"
          >
            {authMutation.isPending ? 'Connecting...' : 'Connect Roborock'}
          </button>
        </form>
      )}
    </div>
  );
}

function RingSettings() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState('');

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['ring-status'],
    queryFn: ringApi.status,
  });

  const authMutation = useMutation({
    mutationFn: () => ringApi.auth(email, password, twoFactorCode || undefined),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setTwoFactorCode('');
      setRequiresTwoFactor(false);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['ring-status'] });
      queryClient.invalidateQueries({ queryKey: ['ring-devices'] });
    },
    onError: (err: any) => {
      if (err.message?.includes('Two-factor') || err.message?.includes('two factor')) {
        setRequiresTwoFactor(true);
        setError('Please enter the 2FA code sent to your phone.');
      } else {
        setError(err.message);
      }
    },
  });

  const connectMutation = useMutation({
    mutationFn: ringApi.connect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ring-status'] });
      queryClient.invalidateQueries({ queryKey: ['ring-devices'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: ringApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ring-status'] });
    },
  });

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Ring
        </h2>
        {statusLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : status?.connected ? (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-500">
            <XCircle className="w-4 h-4" />
            Disconnected
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Your Ring account is connected. Your devices should appear on the Dashboard and Doorbell pages.
          </p>
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="btn btn-secondary"
          >
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      ) : status?.hasCredentials ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Credentials stored. Click connect to re-establish connection.
          </p>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="btn btn-primary"
          >
            {connectMutation.isPending ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            authMutation.mutate();
          }}
          className="space-y-4"
        >
          <p className="text-gray-600 dark:text-gray-400">
            Enter your Ring account credentials (same as the Ring app).
          </p>

          {error && (
            <div className={clsx(
              'p-3 rounded-lg text-sm',
              requiresTwoFactor
                ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            )}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="your@email.com"
              required
              disabled={requiresTwoFactor}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                placeholder="••••••••"
                required
                disabled={requiresTwoFactor}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {requiresTwoFactor && (
            <div>
              <label className="block text-sm font-medium mb-1">2FA Code</label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="input w-full"
                placeholder="123456"
                maxLength={6}
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the code sent to your phone via SMS.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={authMutation.isPending}
            className="btn btn-primary"
          >
            {authMutation.isPending ? 'Connecting...' : requiresTwoFactor ? 'Verify Code' : 'Connect Ring'}
          </button>

          {requiresTwoFactor && (
            <button
              type="button"
              onClick={() => {
                setRequiresTwoFactor(false);
                setTwoFactorCode('');
                setError('');
              }}
              className="btn btn-secondary ml-2"
            >
              Start Over
            </button>
          )}
        </form>
      )}
    </div>
  );
}
