
-- =====================================================
-- ROLES (separate user_roles table to avoid privilege escalation)
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles readable to authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- =====================================================
-- STUDENT PROFILES
-- =====================================================
CREATE TABLE public.student_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cgpa NUMERIC(3,2) CHECK (cgpa >= 0 AND cgpa <= 10),
  branch TEXT,
  graduation_year INTEGER,
  resume_url TEXT,
  resume_path TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  interests TEXT[] NOT NULL DEFAULT '{}',
  linkedin_url TEXT,
  github_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own student profile" ON public.student_profiles FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins view all student profiles" ON public.student_profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- OPPORTUNITIES
-- =====================================================
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID NOT NULL REFERENCES auth.users(id),
  company_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('job','internship')),
  ctc TEXT,
  location TEXT,
  min_cgpa NUMERIC(3,2) NOT NULL DEFAULT 0,
  eligible_branches TEXT[] NOT NULL DEFAULT '{}',
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  domain_tags TEXT[] NOT NULL DEFAULT '{}',
  deadline DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone authenticated reads active opportunities" ON public.opportunities FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert opportunities" ON public.opportunities FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update opportunities" ON public.opportunities FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete opportunities" ON public.opportunities FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- COURSES / RESOURCES
-- =====================================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by UUID NOT NULL REFERENCES auth.users(id),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  provider TEXT,
  url TEXT NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses readable to authenticated" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage courses" ON public.courses FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- APPLICATIONS
-- =====================================================
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','shortlisted','rejected','selected')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, opportunity_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students view own applications" ON public.applications FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "students create own applications" ON public.applications FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "admins view all applications" ON public.applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update applications" ON public.applications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_opportunity','status_update','recommendation')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =====================================================
-- RECOMMENDATIONS
-- =====================================================
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, opportunity_id)
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students view own recommendations" ON public.recommendations FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "admins view all recommendations" ON public.recommendations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_applications_student ON public.applications(student_id);
CREATE INDEX idx_applications_opportunity ON public.applications(opportunity_id);
CREATE INDEX idx_recommendations_student ON public.recommendations(student_id, score DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_opportunities_active ON public.opportunities(is_active, deadline);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_student_profiles_updated BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_opportunities_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + student role on signup. Role chosen via signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  IF _role = 'student' THEN
    INSERT INTO public.student_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STORAGE: resumes bucket (private; signed urls / RLS)
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "students upload own resume" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "students update own resume" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "students read own resume" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "students delete own resume" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
