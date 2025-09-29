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
    const { action, ...payload } = await req.json()

    switch (action) {
      case 'ASSIGN_USER_TO_TEAM': {
        const { userId, teamId } = payload
        if (!userId) { // teamId can be null to unassign
          throw new Error('User ID is required for this action.')
        }
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ team_id: teamId })
          .eq('id', userId)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'User assigned to team successfully.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'DELETE_USER': {
        const { userId } = payload
        if (!userId) {
          throw new Error('User ID is required for this action.')
        }
        
        // First, attempt to delete the user from auth.users
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        // We ignore "User not found" errors, as the user might already be deleted from auth
        if (authError && authError.message !== 'User not found') {
          throw authError
        }

        // Then, always attempt to delete the user's profile to clean up orphaned records
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', userId)
        if (profileError) throw profileError

        return new Response(JSON.stringify({ message: 'User deleted successfully.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'DELETE_TEAM': {
        const { teamId } = payload
        if (!teamId) {
          throw new Error('Team ID is required for this action.')
        }
        const { error } = await supabaseAdmin
          .from('teams')
          .delete()
          .eq('id', teamId)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'Team deleted successfully.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action specified.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
    }
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})