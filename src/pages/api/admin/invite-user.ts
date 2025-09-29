import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Database } from '@/integrations/supabase/types';

// Initialize the Supabase admin client
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { email, team_id } = req.body;

  if (!email || !team_id) {
    return res.status(400).json({ error: 'Email and team_id are required' });
  }

  try {
    // Although we are using the admin client, we still need to ensure the user making this
    // client-side request is an authenticated admin. This part should be handled by your
    // application's auth flow (e.g., checking the user's session/token in a middleware
    // or higher-order component). For this API route, we are proceeding with the assumption
    // that the request is coming from an authorized admin user.

    const { data, error } = await supabaseAdmin.rpc('invite_and_assign_user_to_team', {
      user_email: email,
      target_team_id: team_id,
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return res.status(500).json({ error: error.message });
    }

    // The RPC function might return its own status that we need to check
    if (data && data.status === 'error') {
        return res.status(400).json({ error: data.message });
    }

    return res.status(200).json({ message: 'User invited and assigned successfully.' });

  } catch (error: unknown) {
    console.error('API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}