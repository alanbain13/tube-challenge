-- Fix the derive_activity_state function with correct syntax
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
    actual_visit_item jsonb;
    actual_visits_array jsonb[] := '{}';
    visited_count int := 0;
    pending_count int := 0;
    total_count int := 0;
    actual_visit_count int := 0;
    state_version bigint;
BEGIN
    -- Get the activity
    SELECT * INTO activity_rec FROM activities WHERE id = activity_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Activity not found');
    END IF;

    -- Create state version from created_at timestamp
    state_version := extract(epoch from activity_rec.created_at)::bigint;
    
    -- Early return for empty plan
    IF activity_rec.station_tfl_ids IS NULL
       OR array_length(activity_rec.station_tfl_ids, 1) IS NULL
       OR array_length(activity_rec.station_tfl_ids, 1) = 0 THEN
      RETURN jsonb_build_object(
        'activity_id', activity_id_param,
        'version', state_version,
        'plan', '[]'::jsonb,
        'actual_visits', '[]'::jsonb,
        'counts', jsonb_build_object('planned_total', 0, 'visited_actual', 0, 'pending', 0),
        'started_at', activity_rec.started_at,
        'finished_at', activity_rec.ended_at,
        'next_expected', NULL,
        'warnings', jsonb_build_object('empty_plan', true)
      );
    END IF;
    
    -- Process planned stations for display
    FOR current_station_id, station_sequence IN
        SELECT tfl_id, ord
        FROM unnest(activity_rec.station_tfl_ids) WITH ORDINALITY AS u(tfl_id, ord)
    LOOP
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
        
        -- Build plan item (for route display)
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
    
    -- Get actual visits in chronological order (free-order)
    FOR latest_visit IN
        SELECT sv.station_tfl_id, sv.visited_at, sv.verification_image_url, sv.status,
               ROW_NUMBER() OVER (ORDER BY sv.visited_at) as visit_sequence
        FROM station_visits sv
        WHERE sv.activity_id = activity_id_param 
          AND sv.status = 'verified'
        ORDER BY sv.visited_at
    LOOP
        -- Get station name
        SELECT name INTO station_name FROM stations WHERE tfl_id = latest_visit.station_tfl_id LIMIT 1;
        IF station_name IS NULL THEN
            station_name := latest_visit.station_tfl_id;
        END IF;
        
        actual_visit_item := jsonb_build_object(
            'sequence', latest_visit.visit_sequence,
            'station_tfl_id', latest_visit.station_tfl_id,
            'display_name', station_name,
            'visited_at', latest_visit.visited_at,
            'image_url', latest_visit.verification_image_url
        );
        
        actual_visits_array := actual_visits_array || actual_visit_item;
        actual_visit_count := actual_visit_count + 1;
    END LOOP;
    
    -- Return the complete state for free-order check-ins
    RETURN jsonb_build_object(
        'activity_id', activity_id_param,
        'version', state_version,
        'plan', to_jsonb(plan_array),
        'actual_visits', to_jsonb(actual_visits_array),
        'counts', jsonb_build_object(
            'planned_total', total_count,
            'visited_actual', actual_visit_count,
            'pending', 0  -- No longer used in free-order mode
        ),
        'started_at', activity_rec.started_at,
        'finished_at', activity_rec.ended_at,
        'next_expected', NULL  -- Removed in free-order mode
    );
END;
$function$