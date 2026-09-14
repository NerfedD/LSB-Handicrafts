import { supabase } from '../lib/supabaseClient';

export async function provisionAccount(values) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-accounts', { body: values });
    if (error) {
      const detail = await error.context?.json().catch(() => null);
      return { ok: false, message: detail?.message || 'Account creation could not be completed. Check the connection and try again.' };
    }
    return data?.ok && data?.data ? data : { ok: false, message: 'The account was not confirmed by the server.' };
  } catch {
    return { ok: false, message: 'We could not reach the account service. Please try again.' };
  }
}
