import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Initialize the Supabase admin client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  // This is needed if you're calling the function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, team_id } = await req.json()

    if (!email || !team_id) {
      return new Response(JSON.stringify({ error: 'Email and team_id are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Invite the user using the admin client
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      console.error('Supabase inviteUserByEmail error:', inviteError);
      return new Response(JSON.stringify({ error: inviteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!inviteData.user) {
      console.error('No user data returned from inviteUserByEmail');
      return new Response(JSON.stringify({ error: 'Failed to invite user: No user data returned.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Now, create the profile in the public.profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: inviteData.user.id,
          email: inviteData.user.email,
          team_id: team_id,
          // Add any other default profile fields here
        },
      ]);

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Consider rolling back the user invitation if profile creation fails
      return new Response(JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'User invited and assigned successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})