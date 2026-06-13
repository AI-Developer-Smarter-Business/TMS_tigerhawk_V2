-- ============================================================
-- Create a server-side function to insert loads
-- This bypasses PostgREST's schema cache which may not recognize
-- the "loads" table for INSERT operations after a rename from "shipments"
-- ============================================================

CREATE OR REPLACE FUNCTION insert_load(load_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO loads (
    customer_id,
    container_id,
    driver_id,
    pickup_location,
    delivery_location,
    return_location,
    scheduled_pickup,
    chassis_number,
    rate,
    notes,
    load_type,
    route_type,
    status,
    pickup_apt_from,
    pickup_apt_to,
    delivery_apt_from,
    delivery_apt_to,
    ssl,
    mbol,
    house_bol,
    is_hazmat,
    is_hot,
    is_overweight,
    is_oog,
    is_street_turn,
    is_tanker,
    is_bonded,
    is_liquor,
    is_ev,
    is_double,
    is_genset,
    is_scale
  ) VALUES (
    (load_data->>'customer_id')::uuid,
    NULLIF(load_data->>'container_id', '')::uuid,
    NULLIF(load_data->>'driver_id', '')::uuid,
    load_data->>'pickup_location',
    load_data->>'delivery_location',
    load_data->>'return_location',
    NULLIF(load_data->>'scheduled_pickup', '')::timestamptz,
    load_data->>'chassis_number',
    NULLIF(load_data->>'rate', '')::numeric,
    load_data->>'notes',
    COALESCE(load_data->>'load_type', 'Import'),
    load_data->>'route_type',
    COALESCE(load_data->>'status', 'Created'),
    NULLIF(load_data->>'pickup_apt_from', '')::timestamptz,
    NULLIF(load_data->>'pickup_apt_to', '')::timestamptz,
    NULLIF(load_data->>'delivery_apt_from', '')::timestamptz,
    NULLIF(load_data->>'delivery_apt_to', '')::timestamptz,
    load_data->>'ssl',
    load_data->>'mbol',
    load_data->>'house_bol',
    COALESCE((load_data->>'is_hazmat')::boolean, false),
    COALESCE((load_data->>'is_hot')::boolean, false),
    COALESCE((load_data->>'is_overweight')::boolean, false),
    COALESCE((load_data->>'is_oog')::boolean, false),
    COALESCE((load_data->>'is_street_turn')::boolean, false),
    COALESCE((load_data->>'is_tanker')::boolean, false),
    COALESCE((load_data->>'is_bonded')::boolean, false),
    COALESCE((load_data->>'is_liquor')::boolean, false),
    COALESCE((load_data->>'is_ev')::boolean, false),
    COALESCE((load_data->>'is_double')::boolean, false),
    COALESCE((load_data->>'is_genset')::boolean, false),
    COALESCE((load_data->>'is_scale')::boolean, false)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION insert_load(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_load(jsonb) TO service_role;
