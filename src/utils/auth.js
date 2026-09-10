import { supabase } from './supabase';

export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch the role assigned to this user in user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, full_name, district_id')
    .eq('id', data.user.id)
    .single();

  if (profileError) {
    return { success: false, error: 'User authenticated, but role profile is missing.' };
  }

  return { success: true, user: data.user, profile };
}

export async function signUpUser(email, password, fullName, role = 'field_officer') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
}