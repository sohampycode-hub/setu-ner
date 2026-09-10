'use client';

// State Emblem of India (Lion Capital with Satyameva Jayate text)
export function StateEmblem({ className = 'h-12 w-auto', variant = 'gold' }) {
  const fillColor = variant === 'gold' ? '#d97706' : variant === 'white' ? '#ffffff' : '#0f172a';

  return (
    <svg
      viewBox="0 0 100 125"
      fill={fillColor}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="State Emblem of India"
    >
      {/* Central Lion Profile Stylization */}
      <path d="M50 12 C44 12, 38 16, 36 22 C34 20, 31 20, 29 22 C26 25, 27 30, 29 33 C26 35, 25 39, 27 43 C29 46, 33 47, 36 46 C38 52, 44 56, 50 56 C56 56, 62 52, 64 46 C67 47, 71 46, 73 43 C75 39, 74 35, 71 33 C73 30, 74 25, 71 22 C69 20, 66 20, 64 22 C62 16, 56 12, 50 12 Z M50 20 C54 20, 56 23, 56 27 C56 31, 53 34, 50 34 C47 34, 44 31, 44 27 C44 23, 46 20, 50 20 Z" />
      {/* Abacus Pedestal Base */}
      <rect x="24" y="60" width="52" height="6" rx="1.5" />
      {/* Central Chakra on Abacus */}
      <circle cx="50" cy="73" r="6" stroke={fillColor} strokeWidth="1.5" fill="none" />
      <circle cx="50" cy="73" r="1.5" />
      {/* Flanking Galloping Horse & Bull Stylized Pedestals */}
      <path d="M28 72 C30 69, 34 71, 35 75 C31 76, 29 74, 28 72 Z" />
      <path d="M72 72 C70 69, 66 71, 65 75 C69 76, 71 74, 72 72 Z" />
      {/* Lower Base Step */}
      <rect x="18" y="80" width="64" height="4" rx="1" />
      {/* Satyameva Jayate Devanagari Banner Representation */}
      <text
        x="50"
        y="96"
        textAnchor="middle"
        fontSize="8"
        fontFamily="sans-serif"
        fontWeight="800"
        letterSpacing="0.8"
      >
        सत्यमेव जयते
      </text>
    </svg>
  );
}

// 24-Spoke Ashoka Chakra Watermark for Dashboard Backgrounds
export function AshokaChakraWatermark({ className = 'w-96 h-96', opacity = '0.03' }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" stroke="#003366" strokeWidth="3" fill="none" />
      <circle cx="50" cy="50" r="8" fill="#003366" />
      {spokes.map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="50"
          x2={50 + 44 * Math.cos((deg * Math.PI) / 180)}
          y2={50 + 44 * Math.sin((deg * Math.PI) / 180)}
          stroke="#003366"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}