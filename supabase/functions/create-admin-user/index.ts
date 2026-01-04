import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    // Create client with user's auth to verify they're an admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the requesting user is an admin
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Only admins can create admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get request body
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create the user (or upgrade an existing user to admin)
    let targetUserId: string | null = null;
    let targetEmail: string | null = null;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || '' },
    });

    if (createError) {
      // If the user already exists, we can still make them an admin
      const anyErr = createError as any;
      const errorCode = anyErr?.code || anyErr?.error_code;

      if (errorCode === 'email_exists') {
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (listError) {
          console.error('Error listing users after email_exists:', listError);
          return new Response(JSON.stringify({ error: 'User already exists, but failed to look them up.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existing = usersData?.users?.find((u) => (u.email || '').toLowerCase() === String(email).toLowerCase());
        if (!existing) {
          return new Response(JSON.stringify({ error: 'User already exists, but could not be found.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        targetUserId = existing.id;
        targetEmail = existing.email ?? email;
      } else {
        console.error('Error creating user:', createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      if (!newUser.user) {
        return new Response(JSON.stringify({ error: 'Failed to create user.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      targetUserId = newUser.user.id;
      targetEmail = newUser.user.email ?? null;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Failed to determine target user.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The handle_new_user trigger should create profile and user_roles entry
    // But we need to update the role to admin
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', targetUserId);

    if (roleError) {
      // If update fails, try insert (in case trigger didn't run)
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: targetUserId, role: 'admin' });
    }

    // Update profile with full name
    if (fullName) {
      await supabaseAdmin
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', targetUserId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: targetUserId, email: targetEmail || email },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});