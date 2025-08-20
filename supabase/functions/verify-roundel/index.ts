import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧠 AI: Starting roundel verification...');
    
    const { imageData, stationTflId } = await req.json();
    
    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'No image data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch stations catalogue for name matching
    console.log('🧠 AI: Fetching stations catalogue...');
    const { data: stations, error: stationsError } = await supabase
      .from('stations')
      .select('tfl_id, name');
    
    if (stationsError) {
      throw new Error(`Failed to fetch stations: ${stationsError.message}`);
    }

    // Call OpenAI Vision API to analyze the image
    console.log('🧠 AI: Analyzing image with OpenAI Vision...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at detecting London Underground roundels and extracting station names from them. 
            
            A London Underground roundel is a circular red logo with a blue horizontal bar across the middle containing white text with the station name.
            
            Analyze the image and respond with a JSON object containing:
            - "has_roundel": true/false (whether you can clearly see a London Underground roundel)
            - "station_name": string or null (the exact station name text from the blue bar, or null if unreadable)
            - "confidence": 0.0-1.0 (your confidence in the station name reading)
            - "debug": object with any additional info
            
            Be strict about roundel detection - it must be clearly visible and identifiable as a London Underground roundel.
            For station_name, extract the exact text as it appears, maintaining proper capitalization.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image for a London Underground roundel and extract the station name.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('🧠 AI: OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    
    console.log('🧠 AI: Raw AI response:', content);
    
    // Parse the JSON response from AI
    let aiResult;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('🧠 AI: Failed to parse AI response:', parseError);
      throw new Error('Invalid AI response format');
    }

    console.log('🧠 AI: Parsed AI result:', aiResult);

    // Validate AI response structure
    if (typeof aiResult.has_roundel !== 'boolean') {
      throw new Error('Invalid AI response: missing or invalid has_roundel');
    }

    // If no roundel detected, return failure
    if (!aiResult.has_roundel) {
      console.log('🧠 AI: No roundel detected');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'no_roundel',
          message: "We couldn't detect a Tube roundel in your photo. Try a clearer picture showing the full roundel."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If roundel detected but no readable station name
    if (!aiResult.station_name || aiResult.station_name.trim() === '') {
      console.log('🧠 AI: Roundel detected but name not readable');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'name_not_readable',
          message: "We detected a roundel but couldn't read the station name. Please retake the photo closer and centered."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize the extracted name for matching
    const extractedName = aiResult.station_name.trim();
    const normalizedExtracted = normalizeStationName(extractedName);
    
    console.log('🧠 AI: Extracted name:', extractedName);
    console.log('🧠 AI: Normalized extracted:', normalizedExtracted);

    // Find matching station in catalogue
    const matchedStation = stations.find((station: any) => {
      const normalizedCatalogue = normalizeStationName(station.name);
      return normalizedCatalogue === normalizedExtracted;
    });

    if (!matchedStation) {
      console.log('🧠 AI: No station match found for:', extractedName);
      
      // Find potential fuzzy matches for suggestions
      const suggestions = findSimilarStations(normalizedExtracted, stations, 3);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'name_not_recognized',
          message: `Recognized name: ${extractedName}. This doesn't match any station in our database.`,
          extracted_name: extractedName,
          suggestions: suggestions.map(s => ({ tfl_id: s.tfl_id, name: s.name }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🧠 AI: Station matched successfully:', matchedStation.name);

    // Success - roundel detected, name extracted and matched
    return new Response(
      JSON.stringify({
        success: true,
        station_tfl_id: matchedStation.tfl_id,
        station_name: matchedStation.name,
        extracted_name: extractedName,
        confidence: aiResult.confidence || 0.9,
        debug: aiResult.debug || {}
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🧠 AI: Verification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'verification_failed',
        message: 'Photo verification failed. Please try again.',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to normalize station names for matching
function normalizeStationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/&/g, 'and')
    .replace(/['']/g, '')
    .replace(/[^\w\s]/g, '');
}

// Helper function to find similar station names using simple string similarity
function findSimilarStations(target: string, stations: any[], maxResults: number = 3): any[] {
  const results = stations
    .map((station: any) => ({
      ...station,
      similarity: calculateSimilarity(target, normalizeStationName(station.name))
    }))
    .filter(s => s.similarity > 0.6) // Only include reasonably similar matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
  
  return results;
}

// Simple Levenshtein distance-based similarity
function calculateSimilarity(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : (maxLen - matrix[str2.length][str1.length]) / maxLen;
}