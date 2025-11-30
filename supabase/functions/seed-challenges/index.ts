import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get London Underground metro system ID
    const { data: metroSystem } = await supabase
      .from('metro_systems')
      .select('id')
      .eq('code', 'london')
      .single();

    if (!metroSystem) {
      throw new Error('London Underground metro system not found');
    }

    // Get all London stations for full network challenge
    const { data: allStations } = await supabase
      .from('stations')
      .select('tfl_id')
      .eq('metro_system_id', metroSystem.id)
      .limit(272);

    // Get Circle Line stations
    const { data: circleStations } = await supabase
      .from('stations')
      .select('tfl_id')
      .eq('metro_system_id', metroSystem.id)
      .contains('lines', ['Circle'])
      .limit(36);

    // Check if challenges already exist
    const { data: existingChallenges } = await supabase
      .from('challenges')
      .select('id')
      .eq('is_official', true);

    if (existingChallenges && existingChallenges.length > 0) {
      return new Response(
        JSON.stringify({ message: 'Challenges already seeded', count: existingChallenges.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert challenges
    const challengesToInsert = [
      {
        name: 'Complete All Lines',
        description: 'Visit every station on all London Underground lines',
        metro_system_id: metroSystem.id,
        challenge_type: 'Full Network',
        is_official: true,
        station_tfl_ids: allStations?.map(s => s.tfl_id) || [],
        estimated_duration_minutes: 1115,
      },
      {
        name: 'Circle Line Challenge',
        description: 'Complete the entire Circle Line in one journey',
        metro_system_id: metroSystem.id,
        challenge_type: 'Single Line',
        is_official: true,
        station_tfl_ids: circleStations?.map(s => s.tfl_id) || [],
        estimated_duration_minutes: 107,
      },
    ];

    const { data: insertedChallenges, error: insertError } = await supabase
      .from('challenges')
      .insert(challengesToInsert)
      .select();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        message: 'Challenges seeded successfully', 
        challenges: insertedChallenges 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
