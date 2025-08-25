-- Fix derive_activity_state function - resolve ambiguous column reference
CREATE OR REPLACE FUNCTION public.derive_activity_state(activity_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    activity_rec record;
    current_station_id text;
    station_sequence int;
    station_name text;
    latest_visit record;
    visit_status text;
    visit_timestamp timestamptz;
    visit_image_url text;
    plan_item jsonb;
    plan_array jsonb[] := '{}';
    visited_count int := 0;
    pending_count int := 0;
    total_count int := 0;
    next_expected_sequence int := NULL;
    next_expected_station text := NULL;
    state_version bigint;
BEGIN
    -- Get the activity
    SELECT * INTO activity_rec FROM activities WHERE id = activity_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Activity not found');
    END IF;

    -- Create state version from created_at timestamp
    state_version := extract(epoch from activity_rec.created_at)::bigint;
    
    -- Process each station in the activity plan
    FOR station_sequence IN 1..array_length(activity_rec.station_tfl_ids, 1) LOOP
        current_station_id := activity_rec.station_tfl_ids[station_sequence];
        total_count := total_count + 1;
        
        -- Get station name from stations table
        SELECT name INTO station_name FROM stations WHERE tfl_id = current_station_id LIMIT 1;
        IF station_name IS NULL THEN
            station_name := current_station_id; -- fallback to ID if name not found
        END IF;
        
        -- Get the latest visit for this station in this activity
        SELECT sv.status, sv.visited_at, sv.verification_image_url
        INTO latest_visit
        FROM station_visits sv
        WHERE sv.activity_id = activity_id_param 
          AND sv.station_tfl_id = current_station_id
        ORDER BY sv.created_at DESC
        LIMIT 1;
        
        -- Determine status (verified > pending > not_visited)
        visit_status := 'not_visited';
        visit_timestamp := NULL;
        visit_image_url := NULL;
        
        IF latest_visit.status IS NOT NULL THEN
            IF latest_visit.status = 'verified' THEN
                visit_status := 'verified';
                visited_count := visited_count + 1;
                visit_timestamp := latest_visit.visited_at;
                visit_image_url := latest_visit.verification_image_url;
            ELSIF latest_visit.status = 'pending' THEN
                visit_status := 'pending';
                pending_count := pending_count + 1;
                visit_timestamp := latest_visit.visited_at;
                visit_image_url := latest_visit.verification_image_url;
            END IF;
        END IF;
        
        -- Set next expected if not yet found and this station isn't verified
        IF next_expected_sequence IS NULL AND visit_status != 'verified' THEN
            next_expected_sequence := station_sequence;
            next_expected_station := current_station_id;
        END IF;
        
        -- Build plan item
        plan_item := jsonb_build_object(
            'sequence', station_sequence,
            'station_tfl_id', current_station_id,
            'display_name', station_name,
            'status', visit_status,
            'visited_at', visit_timestamp,
            'image_url', visit_image_url
        );
        
        plan_array := plan_array || plan_item;
    END LOOP;
    
    -- Return the complete state
    RETURN jsonb_build_object(
        'activity_id', activity_id_param,
        'version', state_version,
        'plan', to_jsonb(plan_array),
        'counts', jsonb_build_object(
            'total', total_count,
            'visited', visited_count,
            'pending', pending_count
        ),
        'next_expected', CASE 
            WHEN next_expected_sequence IS NOT NULL THEN
                jsonb_build_object(
                    'sequence', next_expected_sequence,
                    'station_tfl_id', next_expected_station,
                    'display_name', (
                        SELECT name FROM stations WHERE tfl_id = next_expected_station LIMIT 1
                    )
                )
            ELSE NULL
        END
    );
END;
$function$