-- =====================================================
-- FIX: Notify admins when a student applies for a role
-- =====================================================

-- 1. Add 'new_application' to allowed notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_opportunity','status_update','recommendation','new_application'));

-- 2. Add INSERT policy on notifications (was missing — no one could insert notifications)
CREATE POLICY "authenticated insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Trigger function: auto-notify all admins when a new application is created
CREATE OR REPLACE FUNCTION public.notify_admins_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _opp RECORD;
  _student_name TEXT;
BEGIN
  -- Get opportunity details
  SELECT role_title, company_name INTO _opp
  FROM public.opportunities WHERE id = NEW.opportunity_id;

  -- Get student name
  SELECT full_name INTO _student_name
  FROM public.profiles WHERE id = NEW.student_id;

  -- Insert a notification for every admin user
  FOR _admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, opportunity_id)
    VALUES (
      _admin.user_id,
      'new_application',
      'New Application Received',
      COALESCE(_student_name, 'A student') || ' applied for ' ||
        COALESCE(_opp.role_title, 'a role') || ' at ' ||
        COALESCE(_opp.company_name, 'a company') || '.',
      NEW.opportunity_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4. Attach the trigger to the applications table
CREATE TRIGGER trg_notify_admins_on_application
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_application();
