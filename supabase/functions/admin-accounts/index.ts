import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const roles = new Set(['Admin', 'Manager', 'Sales Staff', 'Production Staff', 'Delivery Staff']);

Deno.serve(async (request: Request) => {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ message: 'Use POST.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ message: 'Please sign in again.' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !identity.user?.email) return reply({ message: 'Please sign in again.' }, 401);
    const { data: actor, error: actorError } = await admin.from('staff').select('id, role, status')
      .eq('email', identity.user.email.toLowerCase()).maybeSingle();
    if (actorError || actor?.status !== 'Active' || actor?.role !== 'Admin') {
      return reply({ message: 'Only an active administrator can create accounts.' }, 403);
    }
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    // Stripped to digits, not demanded as digits. The form this arrives from
    // accepts the way people write a phone number -- "0917 555 0201",
    // "+63 917 123 4503", "(02) 8888-8888" -- and used to send it through
    // untouched, so a correctly-filled field was refused here with a complaint
    // about its formatting. The client normalises now too; this makes an older
    // or cached bundle behave rather than fail.
    const contactNumber = String(body.contactNumber ?? '').replace(/\D/g, '');
    const username = String(body.username ?? '').trim();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!name || name.length > 200) return reply({ message: 'Enter a name of at most 200 characters.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ message: 'Enter a valid email address.' }, 400);
    if (!roles.has(body.role)) return reply({ message: 'Choose a valid staff role.' }, 400);
    if (contactNumber && !/^[0-9]{7,15}$/.test(contactNumber)) return reply({ message: 'The phone number must contain 7 to 15 digits.' }, 400);
    if (username && !/^[a-zA-Z0-9._-]{3,50}$/.test(username)) return reply({ message: 'Use 3 to 50 letters, numbers, dots, underscores or hyphens for the username.' }, 400);
    if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return reply({ message: 'Use 8 to 128 password characters, including a capital letter and a number.' }, 400);
    }
    // The database trigger inserts staff in the same transaction as auth.users.
    // Auto-confirm allows the administrator's supplied password to work immediately.
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { lsb_staff: { name, role: body.role, contactNumber, username } },
    });
    if (error) {
      const duplicate = /already|registered|exists/i.test(error.message);
      return reply({ message: duplicate ? 'That email address is already in use.'
        : 'Account creation was rejected. Check that the email and username are unique and the account setup migration is installed.' }, 400);
    }
    const { data: staff, error: staffError } = await admin.from('staff').select('*').eq('email', email).single();
    if (staffError || !staff) {
      // Fail closed if deployed before its migration: no orphan login survives.
      const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
      return reply({ message: cleanupError
        ? 'Account setup is incomplete. An administrator must remove the unused sign-in before retrying.'
        : 'Account setup is unavailable. Install the account setup migration and try again.' }, 503);
    }
    return reply({ ok: true, data: staff });
  } catch {
    return reply({ message: 'The account request could not be completed. Check your entries and try again.' }, 500);
  }
});
