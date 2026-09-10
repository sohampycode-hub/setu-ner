import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Protect all /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      url.pathname = '/auth';
      url.searchParams.set('error', 'unauthorized_login_required');
      return NextResponse.redirect(url);
    }

    // Query user profile role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, district_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      url.pathname = '/auth';
      url.searchParams.set('error', 'profile_not_provisioned');
      return NextResponse.redirect(url);
    }

    const role = profile.role;

    // Strict role-to-path enforcement
    if (pathname.startsWith('/dashboard/admin') && role !== 'super_admin') {
      url.pathname = '/auth';
      url.searchParams.set('error', 'restricted_super_admin_only');
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/dashboard/dlo') && !['super_admin', 'dlo'].includes(role)) {
      url.pathname = '/auth';
      url.searchParams.set('error', 'restricted_dlo_only');
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/dashboard/field') && !['super_admin', 'dlo', 'field_officer'].includes(role)) {
      url.pathname = '/auth';
      url.searchParams.set('error', 'restricted_field_officer_only');
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/dashboard/driver') && !['super_admin', 'driver'].includes(role)) {
      url.pathname = '/auth';
      url.searchParams.set('error', 'restricted_driver_only');
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};