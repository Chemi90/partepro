import PartePro from "@/components/partepro";
import { headers } from "next/headers";
import { supabaseConfigured } from "@/lib/server/supabase";
import { calendarConfigured } from "@/lib/server/calendar";

export const dynamic = "force-dynamic";

export default async function Home() {
  await headers();
  return (
    <PartePro
      supabaseConfigured={supabaseConfigured()}
      calendarConfigured={calendarConfigured()}
    />
  );
}
