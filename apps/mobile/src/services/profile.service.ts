import { API_BASE_URL } from './api';

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export interface ProfileUpdateInput {
  name?: string;
  email?: string;
  gender?: string;
  dob?: string;
}

export const updateMyProfile = async (
  token: string,
  input: ProfileUpdateInput
): Promise<{ user?: any; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/profile`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to update profile' };
    return { user: data };
  } catch (err) {
    console.error('updateMyProfile failed', err);
    return { error: 'Network error while updating profile' };
  }
};
