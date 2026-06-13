-- Task 21 (4.3 + 4.4): transactional CSV import for staff tables + indexes for report queries.
-- Apply in Supabase (staging first) before using POST /api/admin/csv-import.

CREATE INDEX IF NOT EXISTS idx_loads_created_at_desc ON loads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_created_at_desc ON ar_invoices (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_open_status ON ar_invoices (billing_status, created_at DESC)
  WHERE billing_status IS NOT NULL
    AND billing_status NOT IN ('Paid', 'Cancelled', 'Write-off');

CREATE OR REPLACE FUNCTION public.import_drivers_csv_transaction(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
  v_row int := 0;
  v_id uuid;
  v_existing uuid;
  v_phone text;
  v_name text;
  v_ins int := 0;
  v_upd int := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row := v_row + 1;
    v_phone := NULLIF(trim(elem->>'phone'), '');
    IF v_phone IS NULL THEN
      RAISE EXCEPTION 'Row %: phone is required', v_row;
    END IF;

    v_id := NULL;
    IF elem ? 'id' AND NULLIF(trim(elem->>'id'), '') IS NOT NULL THEN
      BEGIN
        v_id := trim(elem->>'id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Row %: invalid id (uuid)', v_row;
      END;
    END IF;

    v_name := COALESCE(
      NULLIF(trim(elem->>'name'), ''),
      NULLIF(trim(concat_ws(' ', NULLIF(trim(elem->>'first_name'), ''), NULLIF(trim(elem->>'last_name'), ''))), '')
    );
    IF v_name IS NULL OR v_name = '' THEN
      v_name := 'Driver';
    END IF;

    IF v_id IS NOT NULL THEN
      SELECT d.id INTO v_existing FROM drivers d WHERE d.id = v_id;
      IF FOUND THEN
        UPDATE drivers SET
          name = v_name,
          first_name = NULLIF(trim(elem->>'first_name'), ''),
          last_name = NULLIF(trim(elem->>'last_name'), ''),
          phone = v_phone,
          email = NULLIF(trim(elem->>'email'), ''),
          username = NULLIF(trim(elem->>'username'), ''),
          truck_number = NULLIF(trim(elem->>'truck_number'), ''),
          truck_owner = NULLIF(trim(elem->>'truck_owner'), ''),
          plates = NULLIF(trim(elem->>'plates'), ''),
          license_number = NULLIF(trim(elem->>'license_number'), ''),
          license_state = NULLIF(trim(elem->>'license_state'), ''),
          license_expiry = CASE WHEN NULLIF(trim(elem->>'license_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'license_expiry')::date END,
          medical_expiry = CASE WHEN NULLIF(trim(elem->>'medical_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'medical_expiry')::date END,
          twic_expiry = CASE WHEN NULLIF(trim(elem->>'twic_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'twic_expiry')::date END,
          date_of_birth = CASE WHEN NULLIF(trim(elem->>'date_of_birth'), '') IS NULL THEN NULL ELSE trim(elem->>'date_of_birth')::date END,
          date_of_hire = CASE WHEN NULLIF(trim(elem->>'date_of_hire'), '') IS NULL THEN NULL ELSE trim(elem->>'date_of_hire')::date END,
          emergency_contact = NULLIF(trim(elem->>'emergency_contact'), ''),
          emergency_phone = NULLIF(trim(elem->>'emergency_phone'), ''),
          use_for_pre_appointments = COALESCE((elem->>'use_for_pre_appointments')::boolean, false),
          enabled = COALESCE((elem->>'enabled')::boolean, true),
          status = COALESCE(NULLIF(trim(elem->>'status'), ''), 'Available'),
          notes = NULLIF(trim(elem->>'notes'), '')
        WHERE id = v_id;
        v_upd := v_upd + 1;
        CONTINUE;
      END IF;
    END IF;

    SELECT d.id INTO v_existing FROM drivers d WHERE d.phone = v_phone LIMIT 1;
    IF FOUND THEN
      UPDATE drivers SET
        name = v_name,
        first_name = NULLIF(trim(elem->>'first_name'), ''),
        last_name = NULLIF(trim(elem->>'last_name'), ''),
        phone = v_phone,
        email = NULLIF(trim(elem->>'email'), ''),
        username = NULLIF(trim(elem->>'username'), ''),
        truck_number = NULLIF(trim(elem->>'truck_number'), ''),
        truck_owner = NULLIF(trim(elem->>'truck_owner'), ''),
        plates = NULLIF(trim(elem->>'plates'), ''),
        license_number = NULLIF(trim(elem->>'license_number'), ''),
        license_state = NULLIF(trim(elem->>'license_state'), ''),
        license_expiry = CASE WHEN NULLIF(trim(elem->>'license_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'license_expiry')::date END,
        medical_expiry = CASE WHEN NULLIF(trim(elem->>'medical_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'medical_expiry')::date END,
        twic_expiry = CASE WHEN NULLIF(trim(elem->>'twic_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'twic_expiry')::date END,
        date_of_birth = CASE WHEN NULLIF(trim(elem->>'date_of_birth'), '') IS NULL THEN NULL ELSE trim(elem->>'date_of_birth')::date END,
        date_of_hire = CASE WHEN NULLIF(trim(elem->>'date_of_hire'), '') IS NULL THEN NULL ELSE trim(elem->>'date_of_hire')::date END,
        emergency_contact = NULLIF(trim(elem->>'emergency_contact'), ''),
        emergency_phone = NULLIF(trim(elem->>'emergency_phone'), ''),
        use_for_pre_appointments = COALESCE((elem->>'use_for_pre_appointments')::boolean, false),
        enabled = COALESCE((elem->>'enabled')::boolean, true),
        status = COALESCE(NULLIF(trim(elem->>'status'), ''), 'Available'),
        notes = NULLIF(trim(elem->>'notes'), '')
      WHERE id = v_existing;
      v_upd := v_upd + 1;
    ELSE
      INSERT INTO drivers (
        name, first_name, last_name, phone, email, username,
        truck_number, truck_owner, plates,
        license_number, license_state, license_expiry, medical_expiry, twic_expiry,
        date_of_birth, date_of_hire, emergency_contact, emergency_phone,
        use_for_pre_appointments, enabled, status, notes
      ) VALUES (
        v_name,
        NULLIF(trim(elem->>'first_name'), ''),
        NULLIF(trim(elem->>'last_name'), ''),
        v_phone,
        NULLIF(trim(elem->>'email'), ''),
        NULLIF(trim(elem->>'username'), ''),
        NULLIF(trim(elem->>'truck_number'), ''),
        NULLIF(trim(elem->>'truck_owner'), ''),
        NULLIF(trim(elem->>'plates'), ''),
        NULLIF(trim(elem->>'license_number'), ''),
        NULLIF(trim(elem->>'license_state'), ''),
        CASE WHEN NULLIF(trim(elem->>'license_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'license_expiry')::date END,
        CASE WHEN NULLIF(trim(elem->>'medical_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'medical_expiry')::date END,
        CASE WHEN NULLIF(trim(elem->>'twic_expiry'), '') IS NULL THEN NULL ELSE trim(elem->>'twic_expiry')::date END,
        CASE WHEN NULLIF(trim(elem->>'date_of_birth'), '') IS NULL THEN NULL ELSE trim(elem->>'date_of_birth')::date END,
        CASE WHEN NULLIF(trim(elem->>'date_of_hire'), '') IS NULL THEN NULL ELSE trim(elem->>'date_of_hire')::date END,
        NULLIF(trim(elem->>'emergency_contact'), ''),
        NULLIF(trim(elem->>'emergency_phone'), ''),
        COALESCE((elem->>'use_for_pre_appointments')::boolean, false),
        COALESCE((elem->>'enabled')::boolean, true),
        COALESCE(NULLIF(trim(elem->>'status'), ''), 'Available'),
        NULLIF(trim(elem->>'notes'), '')
      );
      v_ins := v_ins + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_ins, 'updated', v_upd);
END;
$$;

CREATE OR REPLACE FUNCTION public.import_driver_groups_csv_transaction(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
  v_row int := 0;
  v_id uuid;
  v_existing uuid;
  v_name text;
  v_pay text;
  v_rate numeric;
  v_ins int := 0;
  v_upd int := 0;
  v_prof uuid;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row := v_row + 1;
    v_name := NULLIF(trim(elem->>'name'), '');
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Row %: name is required', v_row;
    END IF;

    v_pay := lower(trim(coalesce(elem->>'pay_type', '')));
    IF v_pay NOT IN ('per_move', 'hourly', 'per_mile', 'percentage', 'flat') THEN
      RAISE EXCEPTION 'Row %: pay_type must be per_move, hourly, per_mile, percentage, or flat', v_row;
    END IF;

    BEGIN
      v_rate := (elem->>'base_rate')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Row %: base_rate must be numeric', v_row;
    END;

    v_prof := NULL;
    IF elem ? 'rate_profile_id' AND NULLIF(trim(elem->>'rate_profile_id'), '') IS NOT NULL THEN
      BEGIN
        v_prof := trim(elem->>'rate_profile_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Row %: invalid rate_profile_id', v_row;
      END;
    END IF;

    v_id := NULL;
    IF elem ? 'id' AND NULLIF(trim(elem->>'id'), '') IS NOT NULL THEN
      BEGIN
        v_id := trim(elem->>'id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Row %: invalid id (uuid)', v_row;
      END;
    END IF;

    IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM driver_groups g WHERE g.id = v_id) THEN
      UPDATE driver_groups SET
        name = v_name,
        pay_type = v_pay,
        base_rate = v_rate,
        is_company_driver = COALESCE((elem->>'is_company_driver')::boolean, false),
        default_service_type = NULLIF(trim(elem->>'default_service_type'), ''),
        notes = NULLIF(trim(elem->>'notes'), ''),
        rate_profile_id = v_prof
      WHERE id = v_id;
      v_upd := v_upd + 1;
      CONTINUE;
    END IF;

    SELECT g.id INTO v_existing FROM driver_groups g WHERE lower(trim(g.name)) = lower(v_name) LIMIT 1;
    IF FOUND THEN
      UPDATE driver_groups SET
        name = v_name,
        pay_type = v_pay,
        base_rate = v_rate,
        is_company_driver = COALESCE((elem->>'is_company_driver')::boolean, false),
        default_service_type = NULLIF(trim(elem->>'default_service_type'), ''),
        notes = NULLIF(trim(elem->>'notes'), ''),
        rate_profile_id = v_prof
      WHERE id = v_existing;
      v_upd := v_upd + 1;
    ELSE
      INSERT INTO driver_groups (
        name, pay_type, base_rate, is_company_driver, default_service_type, notes, rate_profile_id
      ) VALUES (
        v_name, v_pay, v_rate,
        COALESCE((elem->>'is_company_driver')::boolean, false),
        NULLIF(trim(elem->>'default_service_type'), ''),
        NULLIF(trim(elem->>'notes'), ''),
        v_prof
      );
      v_ins := v_ins + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_ins, 'updated', v_upd);
END;
$$;

REVOKE ALL ON FUNCTION public.import_drivers_csv_transaction(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_driver_groups_csv_transaction(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_drivers_csv_transaction(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.import_driver_groups_csv_transaction(jsonb) TO service_role;
