-- =========================================================================
-- TRIGGER: Filter Ineligible Notifications
-- Prevents notifications about opportunities from reaching students 
-- who do not meet the opportunity's CGPA or Branch requirements.
-- =========================================================================

CREATE OR REPLACE FUNCTION filter_ineligible_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_cgpa NUMERIC;
  v_branch TEXT;
  v_min_cgpa NUMERIC;
  v_branches TEXT[];
  b TEXT;
  is_branch_allowed BOOLEAN := false;
BEGIN
  -- Only filter if this notification is tied to a specific opportunity
  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the student's profile data
  SELECT cgpa, branch INTO v_cgpa, v_branch
  FROM public.student_profiles
  WHERE user_id = NEW.user_id;

  -- Get the opportunity's requirements
  SELECT min_cgpa, eligible_branches INTO v_min_cgpa, v_branches
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;

  -- 1. Check CGPA requirement
  IF v_min_cgpa > 0 AND (v_cgpa IS NULL OR v_cgpa < v_min_cgpa) THEN
    RETURN NULL; -- Silently cancel the insert
  END IF;

  -- 2. Check Branch requirement
  IF v_branches IS NOT NULL AND array_length(v_branches, 1) > 0 THEN
    -- If student hasn't set a branch, they can't prove eligibility
    IF v_branch IS NULL THEN
      RETURN NULL;
    END IF;
    
    -- Check if student branch matches any eligible branch (case insensitive)
    FOREACH b IN ARRAY v_branches
    LOOP
      IF lower(trim(b)) = lower(trim(v_branch)) THEN
        is_branch_allowed := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT is_branch_allowed THEN
      RETURN NULL; -- Silently cancel the insert
    END IF;
  END IF;

  -- All checks passed, allow the notification
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the notifications table
DROP TRIGGER IF EXISTS trg_filter_notifications ON public.notifications;

CREATE TRIGGER trg_filter_notifications
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION filter_ineligible_notifications();
