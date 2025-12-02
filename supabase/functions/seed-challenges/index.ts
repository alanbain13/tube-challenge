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

    console.log('🌱 Starting challenge seeding...');

    // Get London Underground metro system ID
    const { data: metroSystem } = await supabase
      .from('metro_systems')
      .select('id')
      .eq('code', 'london')
      .single();

    if (!metroSystem) {
      throw new Error('London Underground metro system not found');
    }

    console.log('✅ Found London Underground metro system:', metroSystem.id);

    // Get all London stations for full network challenge
    const { data: allStations } = await supabase
      .from('stations')
      .select('tfl_id, name')
      .eq('metro_system_id', metroSystem.id)
      .limit(300);

    console.log(`✅ Found ${allStations?.length || 0} total stations`);

    // Get Victoria Line stations for sequenced route challenge
    const { data: victoriaStations } = await supabase
      .from('stations')
      .select('tfl_id, name')
      .eq('metro_system_id', metroSystem.id)
      .contains('lines', ['Victoria']);

    console.log(`✅ Found ${victoriaStations?.length || 0} Victoria Line stations`);

    // Get Circle Line stations for unsequenced route challenge
    const { data: circleStations } = await supabase
      .from('stations')
      .select('tfl_id, name')
      .eq('metro_system_id', metroSystem.id)
      .contains('lines', ['Circle']);

    console.log(`✅ Found ${circleStations?.length || 0} Circle Line stations`);

    // Get specific stations for point-to-point challenge
    const { data: kingsCross } = await supabase
      .from('stations')
      .select('tfl_id')
      .eq('metro_system_id', metroSystem.id)
      .ilike('name', '%king%cross%')
      .limit(1)
      .maybeSingle();

    const { data: stratford } = await supabase
      .from('stations')
      .select('tfl_id')
      .eq('metro_system_id', metroSystem.id)
      .ilike('name', '%stratford%')
      .limit(1)
      .maybeSingle();

    console.log('✅ Point-to-point stations:', { kingsCross: kingsCross?.tfl_id, stratford: stratford?.tfl_id });

    // Update existing "Complete All Lines" challenge to be unsequenced
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ 
        is_sequenced: false, 
        challenge_type: 'unsequenced_route',
        difficulty: 'Expert'
      })
      .eq('name', 'Complete All Lines');

    if (updateError) {
      console.log('⚠️ Error updating Complete All Lines:', updateError.message);
    } else {
      console.log('✅ Updated Complete All Lines challenge');
    }

    // Prepare NEW challenge data (only challenges that don't exist yet)
    const newChallenges = [
      // 1. Sequenced Route Challenge - Victoria Line (visit in order)
      {
        name: 'Victoria Line Sprint',
        description: 'Visit 5 Victoria Line stations in sequence - Brixton to Warren Street',
        metro_system_id: metroSystem.id,
        challenge_type: 'sequenced_route',
        is_official: true,
        is_sequenced: true,
        station_tfl_ids: victoriaStations?.slice(0, 5).map(s => s.tfl_id) || [],
        start_station_tfl_id: victoriaStations?.[0]?.tfl_id || null,
        end_station_tfl_id: victoriaStations?.[4]?.tfl_id || null,
        estimated_duration_minutes: 15,
        ranking_metric: 'time',
        difficulty: 'Easy',
      },
      // 2. Circle Line Unsequenced (different from the sequenced one)
      {
        name: 'Circle Line Explorer',
        description: 'Visit all Circle Line stations in any order',
        metro_system_id: metroSystem.id,
        challenge_type: 'unsequenced_route',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: circleStations?.map(s => s.tfl_id) || [],
        estimated_duration_minutes: 120,
        ranking_metric: 'time',
        difficulty: 'Medium',
      },
      // 3. Timed Challenge - 1 Hour
      {
        name: 'One Hour Rush',
        description: 'Visit as many stations as possible in 60 minutes',
        metro_system_id: metroSystem.id,
        challenge_type: 'timed',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: [], // Any stations count
        time_limit_seconds: 3600, // 1 hour
        ranking_metric: 'stations',
        difficulty: 'Medium',
      },
      // 4. Station Count Challenge - 10 Stations
      {
        name: 'Ten Station Dash',
        description: 'Visit any 10 stations as fast as possible',
        metro_system_id: metroSystem.id,
        challenge_type: 'station_count',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: [], // Any stations count
        target_station_count: 10,
        ranking_metric: 'time',
        difficulty: 'Easy',
      },
      // 5. Point-to-Point Challenge - King's Cross to Stratford
      {
        name: "King's Cross to Stratford",
        description: 'Travel from King\'s Cross to Stratford as fast as possible',
        metro_system_id: metroSystem.id,
        challenge_type: 'point_to_point',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: [kingsCross?.tfl_id, stratford?.tfl_id].filter(Boolean) as string[],
        start_station_tfl_id: kingsCross?.tfl_id || null,
        end_station_tfl_id: stratford?.tfl_id || null,
        estimated_duration_minutes: 20,
        ranking_metric: 'time',
        difficulty: 'Easy',
      },
    ];

    // Insert only new challenges (skip duplicates)
    const results = [];
    for (const challenge of newChallenges) {
      // Check if exists
      const { data: existing } = await supabase
        .from('challenges')
        .select('id, name')
        .eq('name', challenge.name)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Skipping existing challenge: ${challenge.name}`);
        results.push({ name: challenge.name, status: 'skipped' });
      } else {
        const { data: inserted, error } = await supabase
          .from('challenges')
          .insert(challenge)
          .select()
          .single();

        if (error) {
          console.error(`❌ Error inserting ${challenge.name}:`, error.message);
          results.push({ name: challenge.name, status: 'error', error: error.message });
        } else {
          console.log(`✅ Inserted challenge: ${challenge.name}`);
          results.push({ name: challenge.name, status: 'created', id: inserted.id });
        }
      }
    }

    console.log('✅ Seeding complete');

    return new Response(
      JSON.stringify({ 
        message: 'Challenge seeding complete', 
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error seeding challenges:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
