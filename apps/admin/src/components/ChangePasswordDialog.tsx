import React, { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Dialog, Input, Alert } from '@mechbazar/shared/web';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

// Firebase Auth's own floor -- anything shorter is rejected as
// auth/weak-password, so checking it here just saves a round trip.
const MIN_PASSWORD_LENGTH = 6;

function PasswordInput({
  label,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoComplete: string;
}) {
  const [reveal, setReveal] = useState(false);

  // Label sits outside <Input> (rather than via its `label` prop) so the
  // relative box wraps the field alone and top-1/2 centres the toggle --
  // same structure as the sign-in form.
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-neutral-300">{label}</label>
      <div className="relative">
        <Input
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
          aria-label={reveal ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          tabIndex={-1}
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setDone(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current one.');
      return;
    }

    // The admin password lives in Firebase Auth, not in our own User table, so
    // this goes through the Firebase SDK rather than the backend's
    // /auth/change-password (which bcrypt-compares User.password and only
    // applies to the customer app's phone accounts).
    const user = auth.currentUser;
    if (!user?.email) {
      setError('Your session has expired. Please sign out and sign in again.');
      return;
    }

    setLoading(true);
    try {
      // updatePassword requires a recent sign-in; re-authenticating here both
      // satisfies that and doubles as the "current password correct?" check.
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(user, newPassword);
      setDone(true);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        // The shared mapper says "Invalid email or password" -- the email isn't
        // in play here, so be specific about which field is wrong.
        setError('Current password is incorrect.');
      } else {
        setError(mapFirebaseAuthError(code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Change Password">
      {done ? (
        <div className="space-y-6">
          <Alert
            type="success"
            message="Password updated. Use your new password the next time you sign in."
          />
          <Button onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error" message={error} />}

          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={loading}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={loading}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={loading}
            autoComplete="new-password"
          />

          <p className="text-sm text-neutral-500">
            Must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={loading} disabled={loading} className="flex-1">
              Update Password
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
