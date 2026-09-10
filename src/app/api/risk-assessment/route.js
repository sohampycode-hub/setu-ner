import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase';

export async function POST(request) {
  try {
    const { roadId, latitude, longitude, slopeFactor = 1.2 } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and Longitude are mandatory for GIS assessment.' },
        { status: 400 }
      );
    }

    // 1. Fetch live precipitation from Open-Meteo API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,rain&timezone=Asia%2FKolkata`;
    
    const weatherRes = await fetch(weatherUrl, { next: { revalidate: 300 } });
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo API error status: ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const precipitation = weatherData.current?.precipitation || weatherData.current?.rain || 0;

    // 2. Deterministic Heuristic Risk Calculation
    // Base risk formula weighted for hilly Northeastern Himalayan terrain
    const calculatedScore = Math.min(100, Math.max(0, (precipitation * 5.0) + (slopeFactor * 12.0)));
    
    let roadStatus = 'clear';
    if (calculatedScore >= 70) {
      roadStatus = 'blocked';
    } else if (calculatedScore >= 35) {
      roadStatus = 'at_risk';
    }

    // 3. Update road segment status in Supabase if roadId is passed
    if (roadId) {
      await supabase
        .from('road_segments')
        .update({
          risk_score: calculatedScore.toFixed(2),
          rainfall_mm: precipitation.toFixed(2),
          status: roadStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roadId);
    }

    return NextResponse.json({
      success: true,
      data: {
        rainfall_mm: precipitation,
        risk_score: Number(calculatedScore.toFixed(2)),
        status: roadStatus,
        assessment_timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to compute GIS risk metrics.' },
      { status: 500 }
    );
  }
}