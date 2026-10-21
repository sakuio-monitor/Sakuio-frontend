import { useTranslation } from "react-i18next";
import HomePage from "./pages/HomePage";

export default function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <header className="px-6 py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("public.title")}</h1>
        <p className="mt-2 text-slate-400">{t("public.subtitle")}</p>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <HomePage />
      </main>
    </div>
  );
}
