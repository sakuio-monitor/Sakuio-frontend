import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type NodeRow = {
  uuid: string;
  name: string;
  online?: boolean;
};

export default function HomePage() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<NodeRow[]>([]);

  useEffect(() => {
    fetch("/api/nodes")
      .then((r) => r.json())
      .then((d: { nodes?: NodeRow[] }) => setNodes(d.nodes ?? []))
      .catch(() => setNodes([]));
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {nodes.map((n) => (
        <article
          key={n.uuid}
          className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-sm"
        >
          <h2 className="font-medium">{n.name}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {n.online ? t("public.online") : t("public.offline")}
          </p>
        </article>
      ))}
    </div>
  );
}
