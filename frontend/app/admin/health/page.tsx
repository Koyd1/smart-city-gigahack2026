import { getServerTranslator } from "@/lib/i18n/server";
import { HealthPanel } from "@/components/admin/HealthPanel";

export default async function AdminHealthPage() {
  const { t } = await getServerTranslator();

  return (
    <div className="space-y-10">
      <section className="w-full pt-3">
        <div className="w-full">
          <h1 className="m-0 text-[2.25rem] font-bold tracking-[-0.02em] text-[#111827] md:text-[2.75rem]">
            {t("admin.healthPage.title")}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-[#6b7280]">
            {t("admin.healthPage.description")}
          </p>
        </div>
      </section>
      <HealthPanel />
    </div>
  );
}
