ALTER TABLE public.plan_versions
  ADD COLUMN IF NOT EXISTS entitlements jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  r record;
  v_plan_id uuid;
  v_seed jsonb := '[
    {
      "slug": "free", "name": "Free", "tier_level": 0, "display_order": 0, "is_default": true,
      "color_hex": "#8A8A8E", "icon": "circle",
      "description": "Digital ownership: your bike registered in the WJ ecosystem.",
      "price": 0, "urgent_service_included": true, "urgent_service_fee": 100,
      "features": ["Digital bike passport", "Service history", "Pay-per-service repairs"],
      "entitlements": {
        "services_per_year": 0,
        "priority_booking": false,
        "accessory_discount_pct": 0,
        "loaner_bike": false,
        "pickup_delivery": false,
        "insurance_included": false,
        "concierge": false,
        "urgent_service_included": false,
        "urgent_service_fee_eur": 100,
        "reward_points_multiplier": 1,
        "support": "email",
        "booking_window_days": 14
      }
    },
    {
      "slug": "light", "name": "Light", "tier_level": 1, "display_order": 1, "is_default": false,
      "color_hex": "#C8C8CC", "icon": "star",
      "description": "Essential care: one annual checkup and member pricing.",
      "price": 9.90, "urgent_service_included": false, "urgent_service_fee": 75,
      "features": ["Annual checkup", "24/7 chat support", "5% accessories discount"],
      "entitlements": {
        "services_per_year": 1,
        "priority_booking": false,
        "accessory_discount_pct": 5,
        "loaner_bike": false,
        "pickup_delivery": false,
        "insurance_included": false,
        "concierge": false,
        "urgent_service_included": false,
        "urgent_service_fee_eur": 75,
        "reward_points_multiplier": 1,
        "support": "chat_24_7",
        "booking_window_days": 30
      }
    },
    {
      "slug": "plus", "name": "Plus", "tier_level": 2, "display_order": 2, "is_default": false,
      "color_hex": "#058c42", "icon": "sparkles",
      "description": "Proactive care: two services a year, priority slots and a loaner bike.",
      "price": 19.90, "urgent_service_included": true, "urgent_service_fee": 0,
      "features": ["Bi-annual service", "Priority booking", "10% accessories discount", "Loaner bike"],
      "entitlements": {
        "services_per_year": 2,
        "priority_booking": true,
        "accessory_discount_pct": 10,
        "loaner_bike": true,
        "pickup_delivery": false,
        "insurance_included": false,
        "concierge": false,
        "urgent_service_included": true,
        "urgent_service_fee_eur": 0,
        "reward_points_multiplier": 1.5,
        "support": "chat_24_7",
        "booking_window_days": 60
      }
    },
    {
      "slug": "black", "name": "Black", "tier_level": 3, "display_order": 3, "is_default": false,
      "color_hex": "#0B0B0C", "icon": "crown",
      "description": "Total care: unlimited service, same-day pickup, concierge and insurance.",
      "price": 39.90, "urgent_service_included": true, "urgent_service_fee": 0,
      "features": ["Unlimited service", "Same-day pickup", "20% accessories discount", "Concierge", "Insurance included"],
      "entitlements": {
        "services_per_year": -1,
        "priority_booking": true,
        "accessory_discount_pct": 20,
        "loaner_bike": true,
        "pickup_delivery": true,
        "insurance_included": true,
        "concierge": true,
        "urgent_service_included": true,
        "urgent_service_fee_eur": 0,
        "reward_points_multiplier": 2,
        "support": "concierge",
        "booking_window_days": 90
      }
    }
  ]'::jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(v_seed) AS e(p) LOOP
    SELECT id INTO v_plan_id FROM public.plans WHERE slug = r.p->>'slug';

    IF v_plan_id IS NULL THEN
      INSERT INTO public.plans (name, slug, tier_level, description, color_hex, icon, display_order, is_active, is_default)
      VALUES (
        r.p->>'name', r.p->>'slug', (r.p->>'tier_level')::int, r.p->>'description',
        r.p->>'color_hex', r.p->>'icon', (r.p->>'display_order')::int, true, false
      )
      RETURNING id INTO v_plan_id;
    ELSE
      UPDATE public.plans SET
        name = r.p->>'name',
        tier_level = (r.p->>'tier_level')::int,
        description = COALESCE(description, r.p->>'description'),
        color_hex = COALESCE(color_hex, r.p->>'color_hex'),
        icon = COALESCE(icon, r.p->>'icon'),
        display_order = (r.p->>'display_order')::int,
        is_active = true,
        updated_at = now()
      WHERE id = v_plan_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.plan_versions pv WHERE pv.plan_id = v_plan_id AND pv.status = 'active') THEN
      UPDATE public.plan_versions pv
         SET features = COALESCE(NULLIF(pv.features, '[]'::jsonb), r.p->'features'),
             entitlements = r.p->'entitlements',
             urgent_service_included = (r.p->>'urgent_service_included')::boolean,
             urgent_service_fee = (r.p->>'urgent_service_fee')::numeric
       WHERE pv.plan_id = v_plan_id AND pv.status = 'active';
    ELSE
      INSERT INTO public.plan_versions
        (plan_id, version_number, price, currency, interval, trial_days, features, entitlements, status,
         urgent_service_included, urgent_service_fee)
      VALUES (
        v_plan_id,
        COALESCE((SELECT MAX(version_number) FROM public.plan_versions WHERE plan_id = v_plan_id), 0) + 1,
        (r.p->>'price')::numeric, 'EUR', 'monthly'::plan_interval_enum, 0,
        r.p->'features', r.p->'entitlements', 'active'::plan_version_status_enum,
        (r.p->>'urgent_service_included')::boolean, (r.p->>'urgent_service_fee')::numeric
      );
    END IF;
  END LOOP;

  -- Free is the plan every new member starts on.
  UPDATE public.plans SET is_default = (slug = 'free'), updated_at = now()
   WHERE slug IN ('free','light','plus','black');
END $$;