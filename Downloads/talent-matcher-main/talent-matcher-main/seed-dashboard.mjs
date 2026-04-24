/**
 * Seed script to populate the admin dashboard with realistic data.
 * Run: node seed-dashboard.mjs
 *
 * Uses service_role key to bypass RLS. Creates:
 * - 8 student users with profiles (branch, cgpa, skills)
 * - 6 opportunities with required_skills
 * - Multiple applications with different statuses
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ynhyfjlrktidmauxjnev.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaHlmamxya3RpZG1hdXhqbmV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ1MDAzMSwiZXhwIjoyMDkxMDI2MDMxfQ.W_MHlQENhsHrfOtZ3hhvDYLRaRDTtc85fx0lzo_h9Dw";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Student data ───────────────────────────────────────────
const STUDENTS = [
  { email: "ankit.kumar@demo.edu",     name: "Ankit Kumar",       branch: "CSE", cgpa: 8.75, skills: ["Python", "React", "SQL", "Machine Learning"],          interests: ["AI", "Web Dev"] },
  { email: "priya.sharma@demo.edu",    name: "Priya Sharma",      branch: "CSE", cgpa: 9.10, skills: ["JavaScript", "React", "Node.js", "AWS"],               interests: ["Cloud", "Frontend"] },
  { email: "rahul.verma@demo.edu",     name: "Rahul Verma",       branch: "ECE", cgpa: 7.80, skills: ["Python", "C++", "MATLAB", "IoT"],                      interests: ["Embedded", "Robotics"] },
  { email: "sneha.patel@demo.edu",     name: "Sneha Patel",       branch: "IT",  cgpa: 8.50, skills: ["Java", "Spring Boot", "Docker", "SQL"],                 interests: ["Backend", "DevOps"] },
  { email: "arjun.reddy@demo.edu",     name: "Arjun Reddy",       branch: "CSE", cgpa: 7.20, skills: ["HTML", "CSS", "JavaScript", "React"],                   interests: ["Frontend", "UI/UX"] },
  { email: "divya.nair@demo.edu",      name: "Divya Nair",        branch: "ECE", cgpa: 8.30, skills: ["Python", "TensorFlow", "Signal Processing"],            interests: ["AI", "Research"] },
  { email: "vikram.singh@demo.edu",    name: "Vikram Singh",      branch: "ME",  cgpa: 6.90, skills: ["AutoCAD", "SolidWorks", "Python"],                      interests: ["Design", "Manufacturing"] },
  { email: "meera.joshi@demo.edu",     name: "Meera Joshi",       branch: "IT",  cgpa: 8.90, skills: ["Python", "AWS", "Docker", "Kubernetes", "Terraform"],   interests: ["Cloud", "DevOps"] },
  { email: "ravi.gupta@demo.edu",      name: "Ravi Gupta",        branch: "CSE", cgpa: 7.50, skills: ["Java", "React", "SQL", "Git"],                          interests: ["Full Stack"] },
  { email: "kavya.menon@demo.edu",     name: "Kavya Menon",       branch: "EE",  cgpa: 8.10, skills: ["Python", "MATLAB", "Machine Learning", "SQL"],          interests: ["Data Science"] },
];

// ─── Opportunities ──────────────────────────────────────────
const OPPORTUNITIES = [
  {
    company_name: "Google", role_title: "Software Engineer", type: "job",
    description: "Build scalable distributed systems at Google Cloud.",
    required_skills: ["Python", "Java", "Docker", "Kubernetes", "SQL"],
    domain_tags: ["Cloud", "Backend"], min_cgpa: 7.5, ctc: "₹25,00,000",
    location: "Bangalore", eligible_branches: ["CSE", "IT", "ECE"],
    deadline: futureDate(25),
  },
  {
    company_name: "Infosys", role_title: "Systems Engineer", type: "job",
    description: "Enterprise application development using Java/Spring.",
    required_skills: ["Java", "Spring Boot", "SQL", "JavaScript"],
    domain_tags: ["Enterprise", "Backend"], min_cgpa: 6.5, ctc: "₹6,50,000",
    location: "Pune", eligible_branches: ["CSE", "IT", "ECE", "EE"],
    deadline: futureDate(18),
  },
  {
    company_name: "Microsoft", role_title: "Cloud Engineer", type: "job",
    description: "Azure cloud infrastructure and DevOps automation.",
    required_skills: ["AWS", "Docker", "Kubernetes", "Terraform", "Python"],
    domain_tags: ["Cloud", "DevOps"], min_cgpa: 8.0, ctc: "₹20,00,000",
    location: "Hyderabad", eligible_branches: ["CSE", "IT"],
    deadline: futureDate(20),
  },
  {
    company_name: "TCS", role_title: "Data Analyst", type: "job",
    description: "Analyze business data and build dashboards for clients.",
    required_skills: ["Python", "SQL", "Machine Learning", "Tableau"],
    domain_tags: ["Data Science", "Analytics"], min_cgpa: 6.0, ctc: "₹5,00,000",
    location: "Chennai", eligible_branches: ["CSE", "IT", "ECE", "EE", "ME"],
    deadline: futureDate(10),
  },
  {
    company_name: "Amazon", role_title: "Frontend Developer", type: "internship",
    description: "Build responsive web interfaces for Amazon retail.",
    required_skills: ["React", "JavaScript", "HTML", "CSS", "Node.js"],
    domain_tags: ["Frontend", "Web Dev"], min_cgpa: 7.0, ctc: "₹50,000/month",
    location: "Bangalore", eligible_branches: ["CSE", "IT"],
    deadline: futureDate(15),
  },
  {
    company_name: "Wipro", role_title: "Backend Developer", type: "internship",
    description: "API development and microservices architecture.",
    required_skills: ["Java", "Python", "SQL", "Git", "Docker"],
    domain_tags: ["Backend", "API"], min_cgpa: 6.5, ctc: "₹30,000/month",
    location: "Delhi", eligible_branches: ["CSE", "IT", "ECE"],
    deadline: futureDate(22),
  },
];

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// ─── Application assignments (studentIdx → [{ oppIdx, status }]) ─────
const APPLICATIONS = [
  { studentIdx: 0, oppIdx: 0, status: "shortlisted" },
  { studentIdx: 0, oppIdx: 3, status: "selected" },
  { studentIdx: 0, oppIdx: 5, status: "applied" },
  { studentIdx: 1, oppIdx: 0, status: "selected" },
  { studentIdx: 1, oppIdx: 4, status: "shortlisted" },
  { studentIdx: 1, oppIdx: 2, status: "applied" },
  { studentIdx: 2, oppIdx: 1, status: "applied" },
  { studentIdx: 2, oppIdx: 3, status: "rejected" },
  { studentIdx: 3, oppIdx: 1, status: "selected" },
  { studentIdx: 3, oppIdx: 5, status: "shortlisted" },
  { studentIdx: 3, oppIdx: 2, status: "applied" },
  { studentIdx: 4, oppIdx: 4, status: "applied" },
  { studentIdx: 4, oppIdx: 0, status: "rejected" },
  { studentIdx: 5, oppIdx: 3, status: "shortlisted" },
  { studentIdx: 5, oppIdx: 0, status: "applied" },
  { studentIdx: 6, oppIdx: 3, status: "applied" },
  { studentIdx: 7, oppIdx: 2, status: "selected" },
  { studentIdx: 7, oppIdx: 0, status: "shortlisted" },
  { studentIdx: 7, oppIdx: 5, status: "applied" },
  { studentIdx: 8, oppIdx: 0, status: "applied" },
  { studentIdx: 8, oppIdx: 1, status: "applied" },
  { studentIdx: 8, oppIdx: 4, status: "shortlisted" },
  { studentIdx: 9, oppIdx: 3, status: "selected" },
  { studentIdx: 9, oppIdx: 1, status: "applied" },
];

// ─── Main ───────────────────────────────────────────────────
async function seed() {
  console.log("🌱 Starting dashboard seed...\n");

  // 1. Check if we already have an admin user to act as poster
  const { data: existingAdmin } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  let adminId;
  if (existingAdmin) {
    adminId = existingAdmin.user_id;
    console.log(`✅ Found existing admin: ${adminId}`);
  } else {
    console.log("⚠️  No admin user found. Creating demo admin...");
    const { data: adminUser, error: adminErr } = await supabase.auth.admin.createUser({
      email: "admin@demo.edu",
      password: "Admin@1234",
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin", role: "admin" },
    });
    if (adminErr) { console.error("❌ Failed to create admin:", adminErr.message); return; }
    adminId = adminUser.user.id;
    console.log(`✅ Created admin: ${adminId}`);
  }

  // 2. Create student users
  console.log("\n📚 Creating student users...");
  const studentIds = [];
  for (const s of STUDENTS) {
    // Check if student already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === s.email);

    if (existing) {
      studentIds.push(existing.id);
      console.log(`  ⏩ ${s.name} already exists (${existing.id})`);
      
      // Ensure student_profile has branch and cgpa
      await supabase.from("student_profiles").upsert({
        user_id: existing.id,
        branch: s.branch,
        cgpa: s.cgpa,
        skills: s.skills,
        interests: s.interests,
      }, { onConflict: "user_id" });
      continue;
    }

    const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password: "Student@1234",
      email_confirm: true,
      user_metadata: { full_name: s.name, role: "student" },
    });

    if (userErr) {
      console.error(`  ❌ Failed to create ${s.name}:`, userErr.message);
      studentIds.push(null);
      continue;
    }

    studentIds.push(newUser.user.id);
    console.log(`  ✅ ${s.name} → ${newUser.user.id}`);

    // The handle_new_user trigger creates profile, user_roles, and student_profiles.
    // We just need to update student_profiles with branch/cgpa/skills
    // Small delay for trigger to execute
    await new Promise(r => setTimeout(r, 300));

    await supabase.from("student_profiles").upsert({
      user_id: newUser.user.id,
      branch: s.branch,
      cgpa: s.cgpa,
      skills: s.skills,
      interests: s.interests,
    }, { onConflict: "user_id" });
  }

  // 3. Create opportunities
  console.log("\n💼 Creating opportunities...");
  const oppIds = [];
  for (const opp of OPPORTUNITIES) {
    // Check if opportunity already exists
    const { data: existingOpp } = await supabase
      .from("opportunities")
      .select("id")
      .eq("company_name", opp.company_name)
      .eq("role_title", opp.role_title)
      .limit(1)
      .single();

    if (existingOpp) {
      oppIds.push(existingOpp.id);
      console.log(`  ⏩ ${opp.role_title} @ ${opp.company_name} exists (${existingOpp.id})`);
      continue;
    }

    const { data: newOpp, error: oppErr } = await supabase
      .from("opportunities")
      .insert({
        posted_by: adminId,
        ...opp,
        is_active: true,
      })
      .select("id")
      .single();

    if (oppErr) {
      console.error(`  ❌ Failed to create ${opp.role_title}@${opp.company_name}:`, oppErr.message);
      oppIds.push(null);
      continue;
    }
    oppIds.push(newOpp.id);
    console.log(`  ✅ ${opp.role_title} @ ${opp.company_name} → ${newOpp.id}`);
  }

  // 4. Create applications
  console.log("\n📝 Creating applications...");
  let appCount = 0;
  for (const a of APPLICATIONS) {
    const studentId = studentIds[a.studentIdx];
    const oppId = oppIds[a.oppIdx];
    if (!studentId || !oppId) {
      console.log(`  ⏩ Skipping (missing student or opportunity)`);
      continue;
    }

    const { error: appErr } = await supabase
      .from("applications")
      .upsert({
        student_id: studentId,
        opportunity_id: oppId,
        status: a.status,
      }, { onConflict: "student_id,opportunity_id" });

    if (appErr) {
      console.error(`  ❌ Application error:`, appErr.message);
    } else {
      appCount++;
    }
  }
  console.log(`  ✅ ${appCount} applications created/updated`);

  // 5. Summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Seed complete!");
  console.log(`   Students:      ${studentIds.filter(Boolean).length}`);
  console.log(`   Opportunities: ${oppIds.filter(Boolean).length}`);
  console.log(`   Applications:  ${appCount}`);
  console.log("=".repeat(50));
  console.log("\n🔄 Refresh your admin dashboard to see the data!");
}

seed().catch(console.error);
