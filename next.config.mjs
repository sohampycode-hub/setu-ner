/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/dashboard/dlo',
        destination: '/dlo/dashboard',
        permanent: true, // HTTP 308 permanent redirect
      },
      {
        source: '/dashboard/officer',
        destination: '/officer/dashboard',
        permanent: true,
      },
      {
        source: '/dashboard',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;